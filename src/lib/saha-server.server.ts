/** Sunucu tarafı saha veri erişimi. Tüm tablo erişimi burada, yetki kontrolü ile yapılır. */
import { tokenDogrula, tokenUret, type SahaClaims } from "./saha-token.server";
import { pinDogrula, pinHashle } from "./saha-pin.server";
import { auditYaz, telefonMaskele } from "./saha-audit.server";
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
    .select("id, rol, aktif")
    .eq("id", claims.id)
    .maybeSingle();
  if (error) throw new Error(OTURUM_GECERSIZ);
  const kayit = data as { id: string; rol: string; aktif: boolean } | null;
  // Silinen kullanıcı veya rolü değişmiş oturum: genel geçersizlik mesajı.
  if (!kayit || kayit.rol !== claims.rol) throw new Error(OTURUM_GECERSIZ);
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

export async function girisYapSunucu(telefon: string, pin: string) {
  const sb = await db();
  // Telefonlar veritabanında sadece rakam olarak tutulur ("0533 533 53 53" -> "05335335353").
  const tel = telefon.replace(/\D/g, "");
  const pencereBasi = new Date(Date.now() - PENCERE_MS).toISOString();

  // Sunucu tarafı hız sınırı: aynı telefon için 15 dk içinde 5 başarısız deneme.
  const { count } = await sb
    .from("giris_denemeleri")
    .select("id", { count: "exact", head: true })
    .eq("telefon", tel)
    .gte("deneme_tarihi", pencereBasi);
  if ((count ?? 0) >= MAKS_DENEME) throw new Error(KILIT_MESAJI);

  const { data, error } = await sb
    .from("personel")
    .select(`${PERSONEL_SELECT}, pin_kodu, pin_hash`)
    .eq("telefon", tel)
    .eq("aktif", true)
    .maybeSingle();
  if (error) throw new Error("Giriş sırasında bir hata oluştu.");
  const kayit = data as unknown as
    | (Personel & { pin_kodu: string | null; pin_hash: string | null })
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
    await sb.from("giris_denemeleri").insert({ telefon: tel });
    // Bu denemeyle sınır dolduysa kilit mesajını ver.
    if ((count ?? 0) + 1 >= MAKS_DENEME) throw new Error(KILIT_MESAJI);
    throw new Error(HATA_MESAJI);
  }
  // Başarılı girişte o telefona ait deneme kayıtları temizlenir.
  await sb.from("giris_denemeleri").delete().eq("telefon", tel);
  // PIN/hash alanları asla yanıt gövdesine konmaz.
  const { pin_kodu: _pk, pin_hash: _ph, ...temiz } = kayit;
  const personel = temiz as Personel;
  return { personel, token: await tokenUret(personel.id, personel.rol) };
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
  const { data, error } = await sb
    .from("personel_konumlari")
    .select("id, personel_id, enlem, boylam, dogruluk, kayit_tarihi, personel(ad_soyad, telefon)")
    .order("kayit_tarihi", { ascending: false })
    .limit(500);
  if (error) throw error;
  const enYeni = new Map<string, PersonelKonum>();
  for (const k of (data ?? []) as unknown as PersonelKonum[]) {
    if (!enYeni.has(k.personel_id)) enYeni.set(k.personel_id, k);
  }
  return [...enYeni.values()];
}

/** Personel durum çubuğu: tüm oturumlar (saha dahil) okuyabilir; konumlar yalnız İK için. */
export async function personelDurumlariSunucu(
  token: unknown,
): Promise<{ personeller: Personel[]; konumlar: PersonelKonum[] }> {
  const claims = await oturumDogrula(token);
  const sb = await db();
  const { data, error } = await sb
    .from("personel")
    .select(PERSONEL_SELECT)
    .eq("aktif", true)
    .order("ad_soyad");
  if (error) throw error;
  const personeller = (data ?? []) as unknown as Personel[];
  const ik = claims.rol === "ik";
  return {
    personeller: ik ? personeller : personeller.map((p) => ({ ...p, telefon: "" })),
    konumlar: ik ? await sonKonumlariGetirSunucu(token) : [],
  };
}

export async function konumGonderSunucu(
  token: unknown,
  input: { enlem: number; boylam: number; dogruluk?: number | null | undefined },
) {
  const claims = await oturumDogrula(token);
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
  await gorevErisimiDogrula(token, id);
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

export async function fotoYukleSunucu(
  token: unknown,
  input: { gorevId: string; base64: string; contentType: string; uzanti: string },
) {
  await gorevErisimiDogrula(token, input.gorevId);
  const bytes = base64ToBytes(input.base64);
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error("Fotoğraf 10MB'dan büyük olamaz.");
  const yol = `${input.gorevId}/${Date.now()}.${input.uzanti}`;
  const sb = await db();
  const { error } = await sb.storage
    .from("is-fotolari")
    .upload(yol, bytes, { contentType: input.contentType });
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
  await gorevErisimiDogrula(token, input.gorevId);
  const sb = await db();
  const { error } = await sb.from("is_loglari").insert({
    gorev_id: input.gorevId,
    foto_url: input.fotoYolu,
    personel_notu: input.not,
  });
  if (error) throw error;
  const { error: hata2 } = await sb
    .from("gorevler")
    .update({ durum: "tamamlandi" })
    .eq("id", input.gorevId);
  if (hata2) throw hata2;
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
  const { data: yeni, error } = await sb
    .from("personel")
    .insert({
    ad_soyad: input.ad_soyad.trim(),
    telefon,
    pin_kodu: null,
    pin_hash: pinHashle(input.pin_kodu),
    rol: "personel",
    aktif: true,
    })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  await auditYaz(sb, {
    yonetici_id: yonetici.id,
    islem_turu: "personel_ekle",
    hedef_personel_id: yeni?.id ?? null,
    aciklama: `Personel eklendi: ${input.ad_soyad.trim()} (${telefonMaskele(telefon)})`,
  });
  return { ok: true };
}

/** İK: personelin aktiflik durumunu değiştirir (işten çıkarma / geri alma). */
export async function personelAktiflikGuncelleSunucu(token: unknown, id: string, aktif: boolean) {
  const yonetici = await ikOturumDogrula(token);
  const sb = await db();
  // Yönetici hesabı bu işlemle pasife alınamaz.
  await hedefPersonelDogrula(sb, id);
  const { error } = await sb.from("personel").update({ aktif }).eq("id", id).eq("rol", "personel");
  if (error) throw error;
  await auditYaz(sb, {
    yonetici_id: yonetici.id,
    islem_turu: "personel_aktiflik",
    hedef_personel_id: id,
    aciklama: aktif ? "Personel aktif yapıldı." : "Personel pasif yapıldı.",
  });
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
    .select("ad_soyad, telefon, aktif, rol")
    .eq("id", input.id)
    .maybeSingle();
  // Yönetici kaydı düzenlenebilir ama yanlışlıkla pasife alınamaz.
  if (onceki && (onceki as { rol?: string }).rol === "ik" && !input.aktif) {
    throw new Error("Yönetici hesabı pasife alınamaz.");
  }
  const { data: mevcut, error: kontrolHatasi } = await sb
    .from("personel")
    .select("id")
    .eq("telefon", telefon)
    .neq("id", input.id)
    .maybeSingle();
  if (kontrolHatasi) throw kontrolHatasi;
  if (mevcut) throw new Error("Bu telefon numarası başka bir kayıtta kullanılıyor.");
  const { error } = await sb
    .from("personel")
    .update({
      ad_soyad: input.ad_soyad.trim(),
      telefon,
      aktif: input.aktif,
      // PIN alanı boş bırakıldıysa mevcut PIN korunur.
      ...(input.pin_kodu ? { pin_kodu: null, pin_hash: pinHashle(input.pin_kodu) } : {}),
    })
    .eq("id", input.id);
  if (error) throw error;
  const degisiklikler: string[] = [];
  if (onceki && onceki.ad_soyad !== input.ad_soyad.trim())
    degisiklikler.push(`ad: ${onceki.ad_soyad} -> ${input.ad_soyad.trim()}`);
  if (onceki && (onceki.telefon ?? "") !== telefon)
    degisiklikler.push(`telefon: ${telefonMaskele(onceki.telefon)} -> ${telefonMaskele(telefon)}`);
  if (onceki && onceki.aktif !== input.aktif)
    degisiklikler.push(`durum: ${onceki.aktif ? "aktif" : "pasif"} -> ${input.aktif ? "aktif" : "pasif"}`);
  await auditYaz(sb, {
    yonetici_id: yonetici.id,
    islem_turu: "personel_duzenle",
    hedef_personel_id: input.id,
    aciklama: degisiklikler.length
      ? `Personel güncellendi (${degisiklikler.join(", ")})`
      : "Personel güncellendi (değişiklik yok).",
  });
  if (input.pin_kodu) {
    // Yalnızca PIN'in değiştirildiği bilgisi tutulur; PIN veya hash'i asla kaydedilmez.
    await auditYaz(sb, {
      yonetici_id: yonetici.id,
      islem_turu: "personel_pin_degistir",
      hedef_personel_id: input.id,
      aciklama: "Personel PIN kodu yönetici tarafından yenilendi.",
    });
  }
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
  const { error: gorevHatasi } = await sb
    .from("gorevler")
    .update({ personel_id: null })
    .eq("personel_id", id);
  if (gorevHatasi) throw gorevHatasi;
  await sb.from("personel_konumlari").delete().eq("personel_id", id);
  const { error } = await sb.from("personel").delete().eq("id", id).eq("rol", "personel");
  if (error) throw error;
  await auditYaz(sb, {
    yonetici_id: yonetici.id,
    islem_turu: "personel_sil",
    hedef_personel_id: id,
    aciklama: `Personel silindi: ${silinen?.ad_soyad ?? "bilinmiyor"} (${telefonMaskele(silinen?.telefon)})`,
  });
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
