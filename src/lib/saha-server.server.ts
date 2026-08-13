/** Sunucu tarafı saha veri erişimi. Tüm tablo erişimi burada, yetki kontrolü ile yapılır. */
import { mfaAdayTokenDogrula, mfaAdayTokenUret, tokenDogrula, tokenUret, type SahaClaims } from "./saha-token.server";
import { pinDogrula, pinHashle } from "./saha-pin.server";
import { mfaAnahtariCoz, mfaAnahtariSifrele, mfaAnahtariUret, mfaKoduDogrula, mfaKurulumUri } from "./saha-mfa.server";
import { auditYaz, telefonMaskele } from "./saha-audit.server";
import { fotoMetadataTemizle } from "./saha-foto.server";
import type { Blok, Gorev, MesaiDurumu, Personel, PersonelKonum } from "./saha-types";

const GOREV_SELECT =
  "id, blok_id, personel_id, is_basligi, aciklama, durum, aciliyet, is_turu, olusturma_tarihi, planlanan_tarih, bloklar(blok_adi), personel(ad_soyad), is_loglari(id, gorev_id, foto_url, personel_notu, tamamlanma_tarihi)";
const PERSONEL_SELECT = "id, ad_soyad, rol, telefon, aktif, mesai_durumu, durum_guncelleme";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const OTURUM_GECERSIZ = "Oturum geçersiz. Lütfen tekrar giriş yapın.";
export const HESAP_PASIF = "Hesabınız pasif durumda. Yönetimle iletişime geçin.";
/** PIN yenilendiğinde eski oturumlar geçersizdir; istemci bu mesajda oturumu kapatır. */
export const OTURUM_YENILENDI =
  "Oturum geçersiz: giriş bilgileriniz güncellendi. Lütfen tekrar giriş yapın.";

type Sb = Awaited<ReturnType<typeof db>>;

/** Pasife alma nedeniyle kapatılan oturumu denetim kaydına yazar (10 dk'da bir). */
async function oturumIptalLogla(sb: Sb, personelId: string) {
  const esik = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await sb
    .from("audit_loglari")
    .select("id", { count: "exact", head: true })
    .eq("islem_turu", "oturum_iptal")
    .eq("hedef_personel_id", personelId)
    .gte("created_at", esik);
  if ((count ?? 0) > 0) return;
  await auditYaz(sb, {
    yonetici_id: null,
    islem_turu: "oturum_iptal",
    hedef_personel_id: personelId,
    aciklama: "Hesap pasif olduğu için açık oturum geçersiz kılındı.",
  });
}

/**
 * İmzalı token'ı doğrular ve ardından kullanıcı kaydını veritabanından kontrol eder:
 * kayıt silinmişse, pasife alınmışsa veya güncel rolü token'daki rolle uyuşmuyorsa
 * oturum geçersizdir. Böylece açık sekmeler anında devre dışı kalır.
 */
async function oturumDogrula(token: unknown): Promise<SahaClaims> {
  const claims = await tokenDogrula(token);
  const sb = await db();
  const { data, error } = await sb
    .from("personel")
    .select("id, rol, aktif, oturum_surumu")
    .eq("id", claims.id)
    .maybeSingle();
  if (error) throw new Error(OTURUM_GECERSIZ);
  const kayit = data as { id: string; rol: string; aktif: boolean; oturum_surumu: number } | null;
  // Silinen kullanıcı veya rolü değişmiş oturum: genel geçersizlik mesajı.
  if (!kayit || kayit.rol !== claims.rol) throw new Error(OTURUM_GECERSIZ);
  if (kayit.oturum_surumu !== claims.oturumSurumu) throw new Error(OTURUM_YENILENDI);
  if (!kayit.aktif) {
    await oturumIptalLogla(sb, claims.id);
    throw new Error(HESAP_PASIF);
  }
  return claims;
}

/** Yalnızca aktif İK / yönetim hesabına izin verir. */
async function ikOturumDogrula(token: unknown): Promise<SahaClaims> {
  const claims = await oturumDogrula(token);
  if (claims.rol !== "ik") throw new Error("Bu işlem için yönetim yetkisi gerekiyor.");
  return claims;
}

/** Personel yönetimi işlemleri yalnızca saha personeli kayıtlarını hedefleyebilir. */
async function hedefPersonelDogrula(sb: Sb, id: string) {
  const { data } = await sb.from("personel").select("id, rol").eq("id", id).maybeSingle();
  const kayit = data as { id: string; rol: string } | null;
  if (!kayit) throw new Error("Personel kaydı bulunamadı.");
  if (kayit.rol !== "personel") {
    throw new Error("Yönetici hesapları personel işlemleriyle değiştirilemez.");
  }
  return kayit;
}

const MAKS_DENEME = 5;
const PENCERE_MS = 15 * 60 * 1000;
const KILIT_MESAJI =
  "Çok fazla başarısız deneme yapıldı. Lütfen 15 dakika sonra tekrar deneyin.";
const HATA_MESAJI = "Telefon veya PIN kodu hatalı.";

export async function girisYapSunucu(
  telefon: string,
  pin: string,
  kaynakOzeti: string,
): Promise<
  | { mfaGerekli: true; mfaAdayToken: string; kurulum: { anahtar: string; uri: string } | undefined }
  | { mfaGerekli: false; personel: Personel; token: string }
> {
  const sb = await db();
  // Telefonlar veritabanında sadece rakam olarak tutulur ("0533 533 53 53" -> "05335335353").
  const tel = telefon.replace(/\D/g, "");
  const pencereBasi = new Date(Date.now() - PENCERE_MS).toISOString();

  // Sunucu tarafı hız sınırı: aynı ağ/cihaz kaynağı + telefon için 15 dk içinde 5 deneme.
  // Böylece başka biri yalnız telefon numarasını bilerek hesabı herkese kilitleyemez.
  const { count } = await sb
    .from("giris_denemeleri")
    .select("id", { count: "exact", head: true })
    .eq("telefon", tel)
    .eq("kaynak_ozeti", kaynakOzeti)
    .gte("deneme_tarihi", pencereBasi);
  if ((count ?? 0) >= MAKS_DENEME) throw new Error(KILIT_MESAJI);

  const { data, error } = await sb
    .from("personel")
    .select(`${PERSONEL_SELECT}, pin_kodu, pin_hash, oturum_surumu, mfa_secret_enc, mfa_aktif`)
    .eq("telefon", tel)
    .eq("aktif", true)
    .maybeSingle();
  if (error) throw new Error("Giriş sırasında bir hata oluştu.");
  const kayit = data as unknown as
    | (Personel & { pin_kodu: string | null; pin_hash: string | null; oturum_surumu: number; mfa_secret_enc: string | null; mfa_aktif: boolean })
    | null;
  const girilen = pin.trim();
  // Hash varsa onunla doğrula; yoksa eski düz metin PIN ile doğrulayıp
  // aşamalı geçiş kapsamında hemen hash'e dönüştür.
  let gecerli = false;
  if (kayit?.pin_hash) {
    gecerli = pinDogrula(girilen, kayit.pin_hash);
  } else if (kayit?.pin_kodu) {
    gecerli = kayit.pin_kodu === girilen;
    if (gecerli) {
      await sb
        .from("personel")
        .update({ pin_hash: pinHashle(girilen), pin_kodu: null })
        .eq("id", kayit.id);
    }
  }
  if (!kayit || !gecerli) {
    await sb.from("giris_denemeleri").insert({ telefon: tel, kaynak_ozeti: kaynakOzeti });
    if ((count ?? 0) + 1 >= 3) {
      await auditYaz(sb, {
        yonetici_id: null,
        islem_turu: "basarisiz_giris",
        hedef_personel_id: kayit?.id ?? null,
        aciklama: `Başarısız giriş denemesi: ${telefonMaskele(tel)} (son 15 dk: ${(count ?? 0) + 1})`,
      });
    }
    // Bu denemeyle sınır dolduysa kilit mesajını ver.
    if ((count ?? 0) + 1 >= MAKS_DENEME) throw new Error(KILIT_MESAJI);
    throw new Error(HATA_MESAJI);
  }
  // Başarılı girişte o telefona ait deneme kayıtları temizlenir.
  await sb
    .from("giris_denemeleri")
    .delete()
    .eq("telefon", tel)
    .eq("kaynak_ozeti", kaynakOzeti);
  // PIN/hash alanları asla yanıt gövdesine konmaz.
  const { pin_kodu: _pk, pin_hash: _ph, oturum_surumu: _os, mfa_secret_enc: _ms, mfa_aktif: _ma, ...temiz } = kayit;
  const personel = temiz as Personel;
  if (personel.rol === "ik") {
    let secretEnc = kayit.mfa_secret_enc;
    let secret: string | undefined;
    if (!secretEnc) {
      secret = mfaAnahtariUret();
      secretEnc = await mfaAnahtariSifrele(secret);
      const { error: mfaError } = await sb
        .from("personel")
        .update({ mfa_secret_enc: secretEnc, mfa_aktif: false })
        .eq("id", personel.id);
      if (mfaError) throw new Error("MFA kurulumu başlatılamadı.");
    } else if (!kayit.mfa_aktif) {
      secret = await mfaAnahtariCoz(secretEnc);
    }
    return {
      mfaGerekli: true as const,
      mfaAdayToken: await mfaAdayTokenUret(personel.id),
      kurulum: secret ? { anahtar: secret, uri: mfaKurulumUri(secret, personel.ad_soyad) } : undefined,
    };
  }
  return { mfaGerekli: false as const, personel, token: await tokenUret(personel.id, personel.rol, kayit.oturum_surumu) };
}

export async function mfaDogrulaSunucu(adayToken: unknown, kod: string) {
  const claims = await mfaAdayTokenDogrula(adayToken);
  const sb = await db();
  const { data, error } = await sb
    .from("personel")
    .select(`${PERSONEL_SELECT}, oturum_surumu, mfa_secret_enc, mfa_aktif`)
    .eq("id", claims.id)
    .eq("rol", "ik")
    .eq("aktif", true)
    .maybeSingle();
  if (error || !data) throw new Error("MFA doğrulama isteği geçersiz veya süresi dolmuş.");
  const kayit = data as unknown as Personel & {
    oturum_surumu: number;
    mfa_secret_enc: string | null;
    mfa_aktif: boolean;
  };
  if (!kayit.mfa_secret_enc) throw new Error("MFA kurulumu bulunamadı.");
  const secret = await mfaAnahtariCoz(kayit.mfa_secret_enc);
  if (!(await mfaKoduDogrula(secret, kod.trim()))) throw new Error("Authenticator kodu hatalı.");
  if (!kayit.mfa_aktif) {
    const { error: updateError } = await sb.from("personel").update({ mfa_aktif: true }).eq("id", kayit.id);
    if (updateError) throw new Error("MFA kurulumu tamamlanamadı.");
    await auditYaz(sb, {
      yonetici_id: kayit.id,
      islem_turu: "mfa_aktiflestirildi",
      hedef_personel_id: kayit.id,
      aciklama: "Yönetici hesabında Authenticator ikinci faktörü etkinleştirildi.",
    });
  }
  const { oturum_surumu, mfa_secret_enc: _secret, mfa_aktif: _aktif, ...personel } = kayit;
  return {
    personel: personel as Personel,
    token: await tokenUret(kayit.id, "ik", oturum_surumu),
  };
}

export async function bloklariGetirSunucu(token: unknown): Promise<Blok[]> {
  await oturumDogrula(token);
  const sb = await db();
  const { data, error } = await sb.from("bloklar").select("id, blok_adi").order("blok_adi");
  if (error) throw error;
  return (data ?? []) as Blok[];
}

export async function personelGetirSunucu(token: unknown): Promise<Personel[]> {
  await ikOturumDogrula(token);
  const sb = await db();
  const { data, error } = await sb
    .from("personel")
    .select(PERSONEL_SELECT)
    .order("ad_soyad");
  if (error) throw error;
  return (data ?? []) as unknown as Personel[];
}

export async function mesaiDurumuGuncelleSunucu(token: unknown, durum: MesaiDurumu) {
  const claims = await oturumDogrula(token);
  const sb = await db();
  const { error } = await sb
    .from("personel")
    .update({ mesai_durumu: durum, durum_guncelleme: new Date().toISOString() })
    .eq("id", claims.id);
  if (error) throw error;
  return { ok: true };
}

export async function mesaiDurumuGetirSunucu(token: unknown): Promise<MesaiDurumu> {
  const claims = await oturumDogrula(token);
  const sb = await db();
  const { data, error } = await sb
    .from("personel")
    .select("mesai_durumu")
    .eq("id", claims.id)
    .maybeSingle();
  if (error) throw error;
  return ((data as { mesai_durumu?: MesaiDurumu } | null)?.mesai_durumu ??
    "calisiyor") as MesaiDurumu;
}

export async function sonKonumlariGetirSunucu(token: unknown): Promise<PersonelKonum[]> {
  await ikOturumDogrula(token);
  const sb = await db();
  const saklamaEsigi = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from("personel_konumlari")
    .select("id, personel_id, enlem, boylam, dogruluk, kayit_tarihi, personel(ad_soyad, telefon)")
    .gte("kayit_tarihi", saklamaEsigi)
    .order("kayit_tarihi", { ascending: false })
    .limit(500);
  if (error) throw error;
  const enYeni = new Map<string, PersonelKonum>();
  for (const k of (data ?? []) as unknown as PersonelKonum[]) {
    if (!enYeni.has(k.personel_id)) enYeni.set(k.personel_id, k);
  }
  return [...enYeni.values()];
}

/** Personel durum çubuğu yalnızca İK / yönetim tarafından okunabilir. */
export async function personelDurumlariSunucu(
  token: unknown,
): Promise<{ personeller: Personel[]; konumlar: PersonelKonum[] }> {
  await ikOturumDogrula(token);
  const sb = await db();
  const { data, error } = await sb
    .from("personel")
    .select(PERSONEL_SELECT)
    .eq("aktif", true)
    .order("ad_soyad");
  if (error) throw error;
  const personeller = (data ?? []) as unknown as Personel[];
  return {
    personeller,
    konumlar: await sonKonumlariGetirSunucu(token),
  };
}

export async function konumGonderSunucu(
  token: unknown,
  input: { enlem: number; boylam: number; dogruluk?: number | null | undefined },
) {
  const claims = await oturumDogrula(token);
  if (!Number.isFinite(input.enlem) || input.enlem < -90 || input.enlem > 90) {
    throw new Error("Geçersiz enlem bilgisi.");
  }
  if (!Number.isFinite(input.boylam) || input.boylam < -180 || input.boylam > 180) {
    throw new Error("Geçersiz boylam bilgisi.");
  }
  if (
    input.dogruluk != null &&
    (!Number.isFinite(input.dogruluk) || input.dogruluk < 0 || input.dogruluk > 100_000)
  ) {
    throw new Error("Geçersiz konum doğruluk bilgisi.");
  }
  const sb = await db();
  const { error } = await sb.from("personel_konumlari").insert({
    personel_id: claims.id,
    enlem: input.enlem,
    boylam: input.boylam,
    dogruluk: input.dogruluk ?? null,
  });
  if (error) throw error;
  return { ok: true };
}

export async function tumGorevleriGetirSunucu(token: unknown): Promise<Gorev[]> {
  await ikOturumDogrula(token);
  const sb = await db();
  const { data, error } = await sb
    .from("gorevler")
    .select(GOREV_SELECT)
    .order("olusturma_tarihi", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Gorev[];
}

export async function personelGorevleriniGetirSunucu(token: unknown): Promise<Gorev[]> {
  const claims = await oturumDogrula(token);
  const sb = await db();
  const { data, error } = await sb
    .from("gorevler")
    .select(GOREV_SELECT)
    .eq("personel_id", claims.id)
    .order("olusturma_tarihi", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Gorev[];
}

/** Görevi getirir; personel yalnızca kendisine atanan görevi görebilir. */
export async function gorevGetirSunucu(token: unknown, id: string): Promise<Gorev | null> {
  const claims = await oturumDogrula(token);
  const sb = await db();
  let sorgu = sb.from("gorevler").select(GOREV_SELECT).eq("id", id);
  if (claims.rol !== "ik") sorgu = sorgu.eq("personel_id", claims.id);
  const { data, error } = await sorgu.maybeSingle();
  if (error) throw error;
  return (data as unknown as Gorev) ?? null;
}

async function gorevErisimiDogrula(token: unknown, gorevId: string) {
  const gorev = await gorevGetirSunucu(token, gorevId);
  if (!gorev) throw new Error("Bu görev için yetkiniz yok.");
  return gorev;
}

/** Görevi değiştiren saha işlemleri yalnızca görevin atandığı personel tarafından yapılabilir. */
async function gorevYazmaErisimiDogrula(token: unknown, gorevId: string) {
  const claims = await oturumDogrula(token);
  if (claims.rol !== "personel") {
    throw new Error("Bu işlem yalnızca görevin atandığı saha personeli tarafından yapılabilir.");
  }
  const sb = await db();
  const { data, error } = await sb
    .from("gorevler")
    .select("id, personel_id, durum")
    .eq("id", gorevId)
    .eq("personel_id", claims.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Bu görev için yetkiniz yok.");
  return data as { id: string; personel_id: string; durum: string };
}

export async function gorevOlusturSunucu(
  token: unknown,
  input: {
    blok_id: string;
    personel_id: string;
    is_basligi: string;
    aciklama: string;
    aciliyet: string;
    is_turu: string;
    planlanan_tarih: string;
  },
) {
  await ikOturumDogrula(token);
  const sb = await db();
  const { data: hedef, error: hedefHatasi } = await sb
    .from("personel")
    .select("id")
    .eq("id", input.personel_id)
    .eq("rol", "personel")
    .eq("aktif", true)
    .maybeSingle();
  if (hedefHatasi) throw hedefHatasi;
  if (!hedef) throw new Error("Seçilen personel aktif değil veya görev almaya yetkili değil.");
  const { error } = await sb.from("gorevler").insert(input);
  if (error) throw error;
  return { ok: true };
}

export async function gorevDurumGuncelleSunucu(token: unknown, id: string, durum: string) {
  if (durum !== "bekliyor" && durum !== "devam_ediyor") {
    throw new Error("Görev yalnızca fotoğraflı tamamlama akışıyla kapatılabilir.");
  }
  await gorevYazmaErisimiDogrula(token, id);
  const sb = await db();
  const { error } = await sb.from("gorevler").update({ durum }).eq("id", id);
  if (error) throw error;
  return { ok: true };
}

function base64ToBytes(base64: string) {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const FOTO_TURLERI = {
  jpeg: { mime: "image/jpeg", uzanti: "jpg" },
  png: { mime: "image/png", uzanti: "png" },
  webp: { mime: "image/webp", uzanti: "webp" },
} as const;

function fotoTurunuAlgila(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return FOTO_TURLERI.jpeg;
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return FOTO_TURLERI.png;
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return FOTO_TURLERI.webp;
  }
  throw new Error("Yalnızca geçerli JPEG, PNG veya WebP fotoğrafları yüklenebilir.");
}

export async function fotoYukleSunucu(
  token: unknown,
  input: { gorevId: string; base64: string; contentType: string; uzanti: string },
) {
  const gorev = await gorevYazmaErisimiDogrula(token, input.gorevId);
  if (gorev.durum === "tamamlandi") throw new Error("Tamamlanmış göreve fotoğraf yüklenemez.");
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(input.base64);
  } catch {
    throw new Error("Fotoğraf verisi geçersiz.");
  }
  if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("Fotoğraf 8MB'dan büyük olamaz.");
  const tur = fotoTurunuAlgila(bytes);
  bytes = fotoMetadataTemizle(bytes, tur.mime);
  const yol = `${input.gorevId}/${crypto.randomUUID()}.${tur.uzanti}`;
  const sb = await db();
  // Aynı görevde daha önce yüklenmiş fakat iş_loglarına bağlanmamış dosyaları temizle.
  const { data: oncekiDosyalar } = await sb.storage.from("is-fotolari").list(input.gorevId, {
    limit: 100,
  });
  if (oncekiDosyalar?.length) {
    const yollar = oncekiDosyalar.map((f) => `${input.gorevId}/${f.name}`);
    const { data: bagli } = await sb.from("is_loglari").select("foto_url").in("foto_url", yollar);
    const bagliYollar = new Set((bagli ?? []).map((k) => k.foto_url).filter(Boolean));
    const sahipsiz = yollar.filter((p) => !bagliYollar.has(p));
    if (sahipsiz.length) await sb.storage.from("is-fotolari").remove(sahipsiz);
  }
  const { error } = await sb.storage
    .from("is-fotolari")
    .upload(yol, bytes, { contentType: tur.mime, upsert: false });
  if (error) throw error;
  return { yol };
}

/** Fotoğraf için kısa süreli imzalı bağlantı üretir; erişim görev yetkisine bağlıdır. */
export async function fotoUrlAlSunucu(token: unknown, yol: string) {
  const gorevId = yol.split("/")[0] ?? "";
  await gorevErisimiDogrula(token, gorevId);
  const sb = await db();
  const { data } = await sb.storage.from("is-fotolari").createSignedUrl(yol, 60 * 60);
  return { url: data?.signedUrl ?? null };
}

export async function gorevTamamlaSunucu(
  token: unknown,
  input: { gorevId: string; fotoYolu: string; not: string },
) {
  const gorev = await gorevYazmaErisimiDogrula(token, input.gorevId);
  if (gorev.durum === "tamamlandi") throw new Error("Görev zaten tamamlanmış.");
  if (!input.fotoYolu.startsWith(`${input.gorevId}/`)) {
    throw new Error("Fotoğraf bu göreve ait değil.");
  }
  const sb = await db();
  const { data: foto, error: fotoHatasi } = await sb.storage
    .from("is-fotolari")
    .download(input.fotoYolu);
  if (fotoHatasi || !foto) throw new Error("Göreve ait fotoğraf bulunamadı.");
  const { error } = await sb.rpc("gorev_tamamla_atomik", {
    p_gorev_id: input.gorevId,
    p_foto_yolu: input.fotoYolu,
    p_personel_notu: input.not,
  });
  if (error) throw new Error(error.message || "Görev tamamlanamadı.");
  return { ok: true };
}
/** İK: yeni saha personeli ekler. Telefon numarası sistemde tekil olmalıdır. */
export async function personelEkleSunucu(
  token: unknown,
  input: { ad_soyad: string; telefon: string; pin_kodu: string },
) {
  const yonetici = await ikOturumDogrula(token);
  const telefon = input.telefon.replace(/\D/g, "");
  if (telefon.length < 10) throw new Error("Geçerli bir telefon numarası girin.");
  const sb = await db();
  const { data: mevcut, error: kontrolHatasi } = await sb
    .from("personel")
    .select("id")
    .eq("telefon", telefon)
    .maybeSingle();
  if (kontrolHatasi) throw kontrolHatasi;
  if (mevcut) throw new Error("Bu telefon numarası zaten kayıtlı.");
  const { error } = await sb.rpc("personel_yonet_atomik", {
    p_islem: "ekle",
    p_yonetici_id: yonetici.id,
    p_hedef_id: null,
    p_veri: { ad_soyad: input.ad_soyad.trim(), telefon, pin_hash: pinHashle(input.pin_kodu) },
    p_audit_aciklama: `Personel eklendi: ${input.ad_soyad.trim()} (${telefonMaskele(telefon)})`,
    p_pin_degisti: false,
  });
  if (error) throw error;
  return { ok: true };
}

/** İK: personelin aktiflik durumunu değiştirir (işten çıkarma / geri alma). */
export async function personelAktiflikGuncelleSunucu(token: unknown, id: string, aktif: boolean) {
  const yonetici = await ikOturumDogrula(token);
  const sb = await db();
  // Yönetici hesabı bu işlemle pasife alınamaz.
  await hedefPersonelDogrula(sb, id);
  const { error } = await sb.rpc("personel_yonet_atomik", {
    p_islem: "aktiflik",
    p_yonetici_id: yonetici.id,
    p_hedef_id: id,
    p_veri: { aktif },
    p_audit_aciklama: aktif ? "Personel aktif yapıldı." : "Personel pasif yapıldı.",
    p_pin_degisti: false,
  });
  if (error) throw error;
  return { ok: true };
}

/** İK: personel veya yönetici kaydının iletişim ve giriş bilgilerini günceller. */
export async function personelDuzenleSunucu(
  token: unknown,
  input: { id: string; ad_soyad: string; telefon: string; pin_kodu?: string | undefined; aktif: boolean },
) {
  const yonetici = await ikOturumDogrula(token);
  const telefon = input.telefon.replace(/\D/g, "");
  if (telefon.length < 10) throw new Error("Geçerli bir telefon numarası girin.");
  const sb = await db();
  const { data: onceki } = await sb
    .from("personel")
    .select("ad_soyad, telefon, aktif, rol, oturum_surumu")
    .eq("id", input.id)
    .maybeSingle();
  // Yönetici kaydı düzenlenebilir ama yanlışlıkla pasife alınamaz.
  if (onceki && (onceki as { rol?: string }).rol === "ik" && !input.aktif) {
    throw new Error("Yönetici hesabı pasife alınamaz.");
  }
  if (input.pin_kodu) {
    const yoneticiHesabi = (onceki as { rol?: string } | null)?.rol === "ik";
    const pinGecerli = yoneticiHesabi
      ? /^\d{6,8}$/.test(input.pin_kodu)
      : /^\d{4}$/.test(input.pin_kodu);
    if (!pinGecerli) {
      throw new Error(
        yoneticiHesabi
          ? "Yönetici PIN kodu 6-8 haneli olmalıdır."
          : "Personel PIN kodu 4 haneli olmalıdır.",
      );
    }
  }
  const { data: mevcut, error: kontrolHatasi } = await sb
    .from("personel")
    .select("id")
    .eq("telefon", telefon)
    .neq("id", input.id)
    .maybeSingle();
  if (kontrolHatasi) throw kontrolHatasi;
  if (mevcut) throw new Error("Bu telefon numarası başka bir kayıtta kullanılıyor.");
  const degisiklikler: string[] = [];
  if (onceki && onceki.ad_soyad !== input.ad_soyad.trim())
    degisiklikler.push(`ad: ${onceki.ad_soyad} -> ${input.ad_soyad.trim()}`);
  if (onceki && (onceki.telefon ?? "") !== telefon)
    degisiklikler.push(`telefon: ${telefonMaskele(onceki.telefon)} -> ${telefonMaskele(telefon)}`);
  if (onceki && onceki.aktif !== input.aktif)
    degisiklikler.push(`durum: ${onceki.aktif ? "aktif" : "pasif"} -> ${input.aktif ? "aktif" : "pasif"}`);
  const { error } = await sb.rpc("personel_yonet_atomik", {
    p_islem: "duzenle",
    p_yonetici_id: yonetici.id,
    p_hedef_id: input.id,
    p_veri: {
      ad_soyad: input.ad_soyad.trim(),
      telefon,
      aktif: input.aktif,
      ...(input.pin_kodu ? { pin_hash: pinHashle(input.pin_kodu) } : {}),
    },
    p_audit_aciklama: degisiklikler.length
      ? `Personel güncellendi (${degisiklikler.join(", ")})`
      : "Personel güncellendi (değişiklik yok).",
    p_pin_degisti: Boolean(input.pin_kodu),
  });
  if (error) throw error;
  return { ok: true };
}

/** İK: personel kaydını tamamen siler; görev kayıtlarındaki atama boşa çıkarılır. */
export async function personelSilSunucu(token: unknown, id: string) {
  const yonetici = await ikOturumDogrula(token);
  const sb = await db();
  await hedefPersonelDogrula(sb, id);
  const { data: silinen } = await sb
    .from("personel")
    .select("ad_soyad, telefon")
    .eq("id", id)
    .maybeSingle();
  const { error } = await sb.rpc("personel_yonet_atomik", {
    p_islem: "sil",
    p_yonetici_id: yonetici.id,
    p_hedef_id: id,
    p_veri: {},
    p_audit_aciklama: `Personel silindi: ${silinen?.ad_soyad ?? "bilinmiyor"} (${telefonMaskele(silinen?.telefon)})`,
    p_pin_degisti: false,
  });
  if (error) throw error;
  return { ok: true };
}

/** İK: yönetim işlemlerinin denetim kayıtlarını en yeniden eskiye listeler. */
export async function auditLoglariGetirSunucu(token: unknown, limit = 200) {
  await ikOturumDogrula(token);
  const sb = await db();
  const { data, error } = await sb
    .from("audit_loglari")
    .select("id, islem_turu, aciklama, created_at, yonetici_id, hedef_personel_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const kayitlar = (data ?? []) as {
    id: string;
    islem_turu: string;
    aciklama: string;
    created_at: string;
    yonetici_id: string | null;
    hedef_personel_id: string | null;
  }[];
  const idler = [
    ...new Set(
      kayitlar.flatMap((k) => [k.yonetici_id, k.hedef_personel_id].filter(Boolean) as string[]),
    ),
  ];
  const adlar = new Map<string, string>();
  if (idler.length) {
    const { data: kisiler } = await sb.from("personel").select("id, ad_soyad").in("id", idler);
    for (const k of (kisiler ?? []) as { id: string; ad_soyad: string }[]) {
      adlar.set(k.id, k.ad_soyad);
    }
  }
  // Yanıt yalnızca gösterime uygun alanları içerir; PIN/hash/token asla dönmez.
  return kayitlar.map((k) => ({
    id: k.id,
    islem_turu: k.islem_turu,
    aciklama: k.aciklama,
    created_at: k.created_at,
    yonetici_adi: k.yonetici_id ? (adlar.get(k.yonetici_id) ?? "Bilinmiyor") : "Bilinmiyor",
    hedef_adi: k.hedef_personel_id ? (adlar.get(k.hedef_personel_id) ?? "Silinmiş kayıt") : "-",
  }));
}
