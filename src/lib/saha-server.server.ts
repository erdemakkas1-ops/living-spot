/** Sunucu tarafı saha veri erişimi. Tüm tablo erişimi burada, yetki kontrolü ile yapılır. */
import { mfaAdayTokenDogrula, mfaAdayTokenUret, tokenDogrula, tokenUret, type SahaClaims } from "./saha-token.server";
import { pinDogrula, pinHashle } from "./saha-pin.server";
import { kurtarmaKoduBul, kurtarmaKodlariUret, mfaAnahtariCoz, mfaAnahtariSifrele, mfaAnahtariUret, mfaKoduDogrula, mfaKurulumUri, mfaVerisiCoz, mfaVerisiSifrele } from "./saha-mfa.server";
import { auditYaz, telefonMaskele } from "./saha-audit.server";
import { fotoMetadataTemizle, fotoYapisiniDogrula } from "./saha-foto.server";
import type { Blok, Gorev, MesaiDurumu, Personel, PersonelKonum } from "./saha-types";
import { PERSONEL_AYDINLATMA_METNI, PERSONEL_AYDINLATMA_SURUMU } from "./personel-aydinlatma";

const GOREV_SELECT =
  "id, blok_id, personel_id, is_basligi, aciklama, durum, aciliyet, is_turu, olusturma_tarihi, planlanan_tarih, bloklar(blok_adi), personel(ad_soyad), is_loglari(id, gorev_id, foto_url, personel_notu, tamamlanma_tarihi)";
const PERSONEL_SELECT = "id, ad_soyad, rol, telefon, aktif, mesai_durumu, durum_guncelleme";
export const KONUM_METIN_SURUMU = "2026-08-14-v2";
export const KVKK_METIN_SURUMU = PERSONEL_AYDINLATMA_SURUMU;

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

async function aydinlatmaBelgeOzeti() {
  const ozet = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(PERSONEL_AYDINLATMA_METNI));
  return Array.from(new Uint8Array(ozet), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function guncelAydinlatmaKaydiVar(sb: Sb, personelId: string) {
  const belgeOzeti = await aydinlatmaBelgeOzeti();
  const { data, error } = await sb.from("personel_metin_onaylari").select("id")
    .eq("personel_id", personelId).eq("metin_turu", "kvkk_aydinlatma")
    .eq("metin_surumu", PERSONEL_AYDINLATMA_SURUMU).eq("belge_ozeti", belgeOzeti).maybeSingle();
  if (error) throw new Error(`Aydınlatma kaydı doğrulanamadı: ${error.message}`);
  return Boolean(data);
}

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
async function oturumDogrula(token: unknown, aydinlatmaGerekli = true): Promise<SahaClaims> {
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
  // Saklama temizliği yalnız yönetici girişine bağlı kalmaz; herhangi bir aktif kullanımda
  // günlük kilit üzerinden en fazla bir kez çalışır.
  try {
    await veriSaklamaBakimiSunucu(sb);
  } catch (error) {
    console.error("[KVKK] Veri saklama bakımı tamamlanamadı:", error);
    await sb.from("sistem_bakim_durumu").update({ son_calisma: new Date(0).toISOString() }).eq("anahtar", "kvkk-gunluk-temizlik");
  }
  if (aydinlatmaGerekli && claims.rol === "personel" && !(await guncelAydinlatmaKaydiVar(sb, claims.id))) {
    throw new Error("Güncel KVKK ve konum takibi aydınlatma bildirimi tamamlanmalıdır.");
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
const MAKS_HESAP_DENEME = 20;
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
  const { data: rezervasyonVerisi, error: rezervasyonHatasi } = await sb.rpc("giris_denemesi_rezerve_et", {
    p_kimlik: tel, p_kaynak: kaynakOzeti, p_kaynak_limit: MAKS_DENEME, p_hesap_limit: MAKS_HESAP_DENEME,
  });
  if (rezervasyonHatasi) throw new Error("Giriş güvenlik kontrolü yapılamadı.");
  const rezervasyon = rezervasyonVerisi as { izinli?: boolean; kaynak?: number; hesap?: number };
  const kaynakDenemesi = rezervasyon.kaynak ?? 0;
  const hesapDenemesi = rezervasyon.hesap ?? 0;
  if (!rezervasyon.izinli) {
    throw new Error(KILIT_MESAJI);
  }

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
    if (kaynakDenemesi >= 3 || hesapDenemesi >= 10) {
      await auditYaz(sb, {
        yonetici_id: null,
        islem_turu: "basarisiz_giris",
        hedef_personel_id: kayit?.id ?? null,
        aciklama: `Başarısız giriş denemesi: ${telefonMaskele(tel)} (kaynak: ${kaynakDenemesi}, hesap geneli: ${hesapDenemesi})`,
      });
    }
    // Bu denemeyle sınır dolduysa kilit mesajını ver.
    if (kaynakDenemesi >= MAKS_DENEME || hesapDenemesi >= MAKS_HESAP_DENEME) {
      throw new Error(KILIT_MESAJI);
    }
    throw new Error(HATA_MESAJI);
  }
  // Başarılı girişte o telefona ait deneme kayıtları temizlenir.
  await sb.from("giris_denemeleri").delete().eq("telefon", tel);
  // PIN/hash alanları asla yanıt gövdesine konmaz.
  const { pin_kodu: _pk, pin_hash: _ph, oturum_surumu: _os, mfa_secret_enc: _ms, mfa_aktif: _ma, ...temiz } = kayit;
  const personel = temiz as Personel;
  if (personel.rol === "ik") {
    let secretEnc = kayit.mfa_secret_enc;
    let secret: string | undefined;
    if (!secretEnc) {
      if (process.env["SAHA_MFA_BOOTSTRAP_ENABLED"] !== "true") {
        throw new Error("Yönetici MFA kurulumu yönetim tarafından geçici olarak etkinleştirilmelidir.");
      }
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
    const mfaAdayJti = crypto.randomUUID();
    const { error: adayHatasi } = await sb.from("personel").update({ mfa_aday_jti: mfaAdayJti }).eq("id", personel.id);
    if (adayHatasi) throw new Error("MFA doğrulama isteği başlatılamadı.");
    return {
      mfaGerekli: true as const,
      mfaAdayToken: await mfaAdayTokenUret(personel.id, mfaAdayJti),
      kurulum: secret ? { anahtar: secret, uri: mfaKurulumUri(secret, personel.ad_soyad) } : undefined,
    };
  }
  return { mfaGerekli: false as const, personel, token: await tokenUret(personel.id, personel.rol, kayit.oturum_surumu) };
}

export async function mfaDogrulaSunucu(adayToken: unknown, kod: string, kaynakOzeti: string) {
  const claims = await mfaAdayTokenDogrula(adayToken);
  const sb = await db();
  const mfaKimligi = `mfa:${claims.id}`;
  const { data: rezervasyonVerisi, error: rezervasyonHatasi } = await sb.rpc("giris_denemesi_rezerve_et", {
    p_kimlik: mfaKimligi, p_kaynak: kaynakOzeti, p_kaynak_limit: 5, p_hesap_limit: 10,
  });
  if (rezervasyonHatasi) throw new Error("MFA güvenlik kontrolü yapılamadı.");
  const rezervasyon = rezervasyonVerisi as { izinli?: boolean; kaynak?: number; hesap?: number };
  if (!rezervasyon.izinli) {
    throw new Error("Çok fazla MFA denemesi yapıldı. PIN ile yeniden giriş yapın.");
  }
  const { data, error } = await sb
    .from("personel")
    .select(`${PERSONEL_SELECT}, oturum_surumu, mfa_secret_enc, mfa_aktif, mfa_son_sayac, mfa_aday_jti`)
    .eq("id", claims.id)
    .eq("rol", "ik")
    .eq("aktif", true)
    .maybeSingle();
  if (error || !data) throw new Error("MFA doğrulama isteği geçersiz veya süresi dolmuş.");
  const kayit = data as unknown as Personel & {
    oturum_surumu: number;
    mfa_secret_enc: string | null;
    mfa_aktif: boolean;
    mfa_son_sayac: number | null;
    mfa_aday_jti: string | null;
  };
  if (kayit.mfa_aday_jti !== claims.jti) throw new Error("MFA doğrulama isteği daha önce kullanılmış veya geçersiz.");
  if (!kayit.mfa_secret_enc) throw new Error("MFA kurulumu bulunamadı.");
  const mfaVerisi = await mfaVerisiCoz(kayit.mfa_secret_enc);
  const girilenKod = kod.trim().toUpperCase();
  const totpSayaci = await mfaKoduDogrula(mfaVerisi.secret, girilenKod);
  const totpGecerli = totpSayaci !== null && (kayit.mfa_son_sayac === null || totpSayaci > kayit.mfa_son_sayac);
  const kurtarmaIndex = totpGecerli ? -1 : await kurtarmaKoduBul(mfaVerisi.kurtarmaHashleri, girilenKod);
  if (!totpGecerli && kurtarmaIndex < 0) {
    const yeniKaynak = rezervasyon.kaynak ?? 0;
    const yeniHesap = rezervasyon.hesap ?? 0;
    if (yeniKaynak >= 3 || yeniHesap >= 5) {
      await auditYaz(sb, {
        yonetici_id: null, islem_turu: "basarisiz_giris", hedef_personel_id: claims.id,
        aciklama: `Başarısız MFA denemesi (kaynak: ${yeniKaynak}, hesap geneli: ${yeniHesap}).`,
      });
    }
    if (yeniKaynak >= 5 || yeniHesap >= 10) {
      throw new Error("Çok fazla MFA denemesi yapıldı. PIN ile yeniden giriş yapın.");
    }
    throw new Error("Authenticator veya kurtarma kodu hatalı.");
  }
  await sb.from("giris_denemeleri").delete().eq("telefon", mfaKimligi);

  let kurtarmaKodlari: string[] | undefined;
  let yeniMfaVerisi = mfaVerisi;
  if (kurtarmaIndex >= 0) {
    yeniMfaVerisi = {
      ...mfaVerisi,
      kurtarmaHashleri: mfaVerisi.kurtarmaHashleri.filter((_, index) => index !== kurtarmaIndex),
    };
  } else if (mfaVerisi.kurtarmaHashleri.length === 0) {
    const uretilen = await kurtarmaKodlariUret();
    kurtarmaKodlari = uretilen.kodlar;
    yeniMfaVerisi = { secret: mfaVerisi.secret, kurtarmaHashleri: uretilen.hashler };
  }
  if (yeniMfaVerisi !== mfaVerisi || totpGecerli) {
    const yeniSifreli = await mfaVerisiSifrele(yeniMfaVerisi);
    let guncelleme = sb
      .from("personel")
      .update({ mfa_secret_enc: yeniSifreli, mfa_son_sayac: totpGecerli ? totpSayaci : kayit.mfa_son_sayac, mfa_aday_jti: null })
      .eq("id", kayit.id)
      .eq("mfa_secret_enc", kayit.mfa_secret_enc)
      .eq("mfa_aday_jti", claims.jti);
    guncelleme = kayit.mfa_son_sayac === null ? guncelleme.is("mfa_son_sayac", null) : guncelleme.eq("mfa_son_sayac", kayit.mfa_son_sayac);
    const { data: guncellenen, error: mfaKayitHatasi } = await guncelleme.select("id").maybeSingle();
    if (mfaKayitHatasi || !guncellenen) throw new Error("MFA güvenlik kaydı güncellenemedi; tekrar deneyin.");
  }
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
  const { oturum_surumu, mfa_secret_enc: _secret, mfa_aktif: _aktif, mfa_son_sayac: _sayac, mfa_aday_jti: _aday, ...personel } = kayit;
  // Saklama temizliği girişin başarısını engellemez; günde en fazla bir kez çalışır.
  try {
    await veriSaklamaBakimiSunucu(sb);
  } catch (error) {
    console.error("[KVKK] Günlük veri saklama temizliği tamamlanamadı:", error);
    await sb.from("sistem_bakim_durumu").update({ son_calisma: new Date(0).toISOString() }).eq("anahtar", "kvkk-gunluk-temizlik");
  }
  return {
    personel: personel as Personel,
    token: await tokenUret(kayit.id, "ik", oturum_surumu),
    kurtarmaKodlari,
  };
}

async function veriSaklamaBakimiSunucu(sb: Sb) {
  const { data: calissin, error: kilitHatasi } = await sb.rpc("veri_saklama_bakimi_baslat");
  if (kilitHatasi) throw kilitHatasi;
  if (!calissin) return;

  const fotoEsigi = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  for (let tur = 0; tur < 20; tur++) {
    const { data: eskiLoglar, error: logHatasi } = await sb.from("is_loglari").select("id, foto_url")
      .lt("tamamlanma_tarihi", fotoEsigi).order("tamamlanma_tarihi", { ascending: true }).limit(500);
    if (logHatasi) throw logHatasi;
    const loglar = (eskiLoglar ?? []) as { id: string; foto_url: string | null }[];
    const fotoYollari = loglar.flatMap((log) => (log.foto_url ? [log.foto_url] : []));
    if (fotoYollari.length) {
      const { error: storageHatasi } = await sb.storage.from("is-fotolari").remove(fotoYollari);
      if (storageHatasi) throw storageHatasi;
    }
    const { error: temizlikHatasi } = await sb.rpc("veri_saklama_kayitlarini_temizle", { p_log_ids: loglar.map((log) => log.id) });
    if (temizlikHatasi) throw temizlikHatasi;
    if (loglar.length < 500) break;
  }
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

async function auditSinirli(sb: Sb, actorId: string, tur: "foto_goruntule" | "konum_goruntule", aciklama: string) {
  const esik = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await sb.from("audit_loglari").select("id", { count: "exact", head: true })
    .eq("yonetici_id", actorId).eq("islem_turu", tur).gte("created_at", esik);
  if ((count ?? 0) === 0) await auditYaz(sb, { yonetici_id: actorId, hedef_personel_id: actorId, islem_turu: tur, aciklama });
}

/** İstemcide saklanan profil yalnız görüntü önbelleğidir; gerçek kullanıcıyı oturumdan döndürür. */
export async function oturumKullanicisiGetirSunucu(token: unknown): Promise<Personel> {
  const claims = await oturumDogrula(token, false);
  const sb = await db();
  const { data, error } = await sb
    .from("personel")
    .select(PERSONEL_SELECT)
    .eq("id", claims.id)
    .maybeSingle();
  if (error || !data) throw new Error(OTURUM_GECERSIZ);
  return data as unknown as Personel;
}

export type BakimDurumu = {
  sonCalisma: string | null;
  gecikmis: boolean;
  eskiKonum: number;
  eskiFoto: number;
  eskiAudit: number;
  kritikRls: boolean;
  publicYetkiYok: boolean;
  kvkkCronAktif: boolean;
  fotoBucketOzel: boolean;
  storagePublicPolicyYok: boolean;
  rpcPublicYok: boolean;
  auditDegistirilemez: boolean;
  bildirimCronAktif: boolean;
};

/** Yalnız yöneticinin görebildiği KVKK saklama/temizlik sağlık özeti. */
export async function bakimDurumuGetirSunucu(token: unknown): Promise<BakimDurumu> {
  await ikOturumDogrula(token);
  const sb = await db();
  const konumEsigi = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const fotoEsigi = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const auditEsigi = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString();
  const [bakim, konum, foto, audit, guvenlik] = await Promise.all([
    sb.from("sistem_bakim_durumu").select("son_calisma").eq("anahtar", "kvkk-gunluk-temizlik").maybeSingle(),
    sb.from("personel_konumlari").select("id", { count: "exact", head: true }).lt("kayit_tarihi", konumEsigi),
    sb.from("is_loglari").select("id", { count: "exact", head: true }).lt("tamamlanma_tarihi", fotoEsigi),
    sb.from("audit_loglari").select("id", { count: "exact", head: true }).lt("created_at", auditEsigi),
    sb.rpc("guvenlik_yapilandirmasi_dogrula"),
  ]);
  const hata = bakim.error ?? konum.error ?? foto.error ?? audit.error;
  if (hata) throw new Error("Sistem bakım durumu okunamadı.");
  const sonCalisma = (bakim.data as { son_calisma?: string } | null)?.son_calisma ?? null;
  if (guvenlik.error) console.error("[Güvenlik sağlık kontrolü]", guvenlik.error.code);
  const guvenlikDurumu = (guvenlik.error ? {} : guvenlik.data ?? {}) as {
    kritik_rls?: boolean;
    public_yetki_yok?: boolean;
    kvkk_cron_aktif?: boolean;
    foto_bucket_ozel?: boolean;
    storage_public_policy_yok?: boolean;
    rpc_public_yok?: boolean;
    audit_degistirilemez?: boolean;
    bildirim_cron_aktif?: boolean;
  };
  return {
    sonCalisma,
    gecikmis: !sonCalisma || Date.now() - new Date(sonCalisma).getTime() > 48 * 60 * 60 * 1000,
    eskiKonum: konum.count ?? 0,
    eskiFoto: foto.count ?? 0,
    eskiAudit: audit.count ?? 0,
    kritikRls: guvenlikDurumu.kritik_rls === true,
    publicYetkiYok: guvenlikDurumu.public_yetki_yok === true,
    kvkkCronAktif: guvenlikDurumu.kvkk_cron_aktif === true,
    fotoBucketOzel: guvenlikDurumu.foto_bucket_ozel === true,
    storagePublicPolicyYok: guvenlikDurumu.storage_public_policy_yok === true,
    rpcPublicYok: guvenlikDurumu.rpc_public_yok === true,
    auditDegistirilemez: guvenlikDurumu.audit_degistirilemez === true,
    bildirimCronAktif: guvenlikDurumu.bildirim_cron_aktif === true,
  };
}

export async function konumIzniGetirSunucu(token: unknown) {
  const claims = await oturumDogrula(token);
  if (claims.rol !== "personel") return { izinVerildi: false, guncelMetin: false, geriCekildi: false };
  const sb = await db();
  const { data, error } = await sb
    .from("konum_izinleri")
    .select("izin_verildi, metin_surumu, geri_cekildi_at")
    .eq("personel_id", claims.id)
    .maybeSingle();
  if (error) throw error;
  return { izinVerildi: Boolean(data?.izin_verildi), guncelMetin: data?.metin_surumu === KONUM_METIN_SURUMU, geriCekildi: Boolean(data?.geri_cekildi_at) };
}

export async function kvkkIlkGirisDurumuGetirSunucu(token: unknown) {
  const claims = await oturumDogrula(token, false);
  if (claims.rol !== "personel") return { okundu: true, metinSurumu: KVKK_METIN_SURUMU };
  const sb = await db();
  return { okundu: await guncelAydinlatmaKaydiVar(sb, claims.id), metinSurumu: KVKK_METIN_SURUMU };
}

export async function kvkkIlkGirisOnaylaSunucu(token: unknown) {
  const claims = await oturumDogrula(token, false);
  if (claims.rol !== "personel") throw new Error("Bu işlem yalnız personel hesabında yapılabilir.");
  const sb = await db();
  const belgeOzeti = await aydinlatmaBelgeOzeti();
  const [{ data: oncekiRiza }, zatenKayitli] = await Promise.all([
    sb.from("konum_izinleri").select("geri_cekildi_at").eq("personel_id", claims.id).maybeSingle(),
    guncelAydinlatmaKaydiVar(sb, claims.id),
  ]);
  if (!zatenKayitli) {
    const { error } = await sb.from("personel_metin_onaylari").upsert({
      personel_id: claims.id,
      metin_turu: "kvkk_aydinlatma",
      metin_surumu: KVKK_METIN_SURUMU,
      belge_ozeti: belgeOzeti,
      hukuki_sebep: "kvkk_m5_2_sozlesme_hukuki_yukumluluk_mesru_menfaat",
      onceki_riza_geri_cekildi: Boolean(oncekiRiza?.geri_cekildi_at),
    }, { onConflict: "personel_id,metin_turu,metin_surumu,belge_ozeti", ignoreDuplicates: true });
    if (error) throw new Error(`KVKK onayı kaydedilemedi: ${error.message}`);
    await auditYaz(sb, { yonetici_id: claims.id, hedef_personel_id: claims.id,
      islem_turu: "kvkk_aydinlatma_okundu", aciklama: `KVKK ve konum aydınlatma metni okundu (${KVKK_METIN_SURUMU}, belge: ${belgeOzeti.slice(0, 12)}). Önceki rıza geri çekilmiş: ${Boolean(oncekiRiza?.geri_cekildi_at) ? "evet" : "hayır"}.` });
  }
  return { okundu: true };
}

export async function konumIzniGuncelleSunucu(token: unknown, izinVerildi: boolean) {
  const claims = await oturumDogrula(token);
  if (claims.rol !== "personel") throw new Error("Konum izni yalnız personel hesabında değiştirilebilir.");
  const sb = await db();
  const simdi = new Date().toISOString();
  const { data: mevcut, error: mevcutHatasi } = await sb.from("konum_izinleri")
    .select("izin_verildi, geri_cekildi_at").eq("personel_id", claims.id).maybeSingle();
  if (mevcutHatasi) throw new Error("Konum onayı durumu okunamadı.");
  if (izinVerildi && mevcut?.geri_cekildi_at) {
    throw new Error("Geri çekilmiş açık rıza personel tarafından yeniden etkinleştirilemez. Yöneticinizle iletişime geçin.");
  }
  const { error } = await sb.from("konum_izinleri").upsert({
    personel_id: claims.id,
    izin_verildi: izinVerildi,
    metin_surumu: KONUM_METIN_SURUMU,
    verildi_at: izinVerildi ? simdi : null,
    geri_cekildi_at: izinVerildi ? null : simdi,
    guncellendi_at: simdi,
  });
  if (error) throw new Error(`Konum onayı kaydedilemedi: ${error.message}`);
  if (!izinVerildi && mevcut?.izin_verildi) {
    const [{ data: yoneticiler }, { data: personel }] = await Promise.all([
      sb.from("personel").select("id").eq("rol", "ik").eq("aktif", true),
      sb.from("personel").select("ad_soyad").eq("id", claims.id).single(),
    ]);
    if (yoneticiler?.length) {
      const { error: bildirimHatasi } = await sb.from("personel_bildirimleri").insert(yoneticiler.map((y) => ({
        personel_id: y.id,
        tur: "riza_geri_cekildi",
        baslik: "Konum açık rızası geri çekildi",
        mesaj: `${personel?.ad_soyad ?? "Personel"} konum açık rızasını geri çekti. Konum takibi hemen durduruldu; Personel Listesi üzerinden yeniden rıza alım sürecini yönetebilirsiniz.`,
      })));
      if (bildirimHatasi) throw new Error("Rıza geri çekildi ancak yönetici bildirimi oluşturulamadı.");
    }
    await auditYaz(sb, { yonetici_id: claims.id, hedef_personel_id: claims.id, islem_turu: "riza_geri_cekildi", aciklama: "Personel konum açık rızasını geri çekti." });
  }
  return { izinVerildi };
}

export type PersonelBildirimi = { id: string; tur: string; baslik: string; mesaj: string; created_at: string; okundu_at: string | null };
export async function personelBildirimleriGetirSunucu(token: unknown): Promise<PersonelBildirimi[]> {
  const claims = await oturumDogrula(token);
  const sb = await db();
  await sb.from("personel_bildirimleri").delete().eq("personel_id", claims.id)
    .lt("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
  const { data, error } = await sb.from("personel_bildirimleri")
    .select("id, tur, baslik, mesaj, created_at, okundu_at")
    .eq("personel_id", claims.id).order("created_at", { ascending: false }).limit(20);
  if (error) throw new Error("Bildirimler alınamadı.");
  return (data ?? []) as PersonelBildirimi[];
}

export async function personelBildirimiOkunduSunucu(token: unknown, id: string) {
  const claims = await oturumDogrula(token);
  const sb = await db();
  const { error } = await sb.from("personel_bildirimleri").update({ okundu_at: new Date().toISOString() })
    .eq("id", id).eq("personel_id", claims.id);
  if (error) throw new Error("Bildirim güncellenemedi.");
  return { ok: true };
}

export async function konumRizasiYenilemeyeAcSunucu(token: unknown, personelId: string) {
  const yonetici = await ikOturumDogrula(token);
  const sb = await db();
  const { data: mevcut, error: mevcutHatasi } = await sb.from("konum_izinleri")
    .select("geri_cekildi_at").eq("personel_id", personelId).maybeSingle();
  if (mevcutHatasi) throw mevcutHatasi;
  if (!mevcut?.geri_cekildi_at) throw new Error("Bu personelin bekleyen bir rıza yenileme işlemi bulunmuyor.");
  const { error } = await sb.from("konum_izinleri").update({
    izin_verildi: false,
    geri_cekildi_at: null,
    verildi_at: null,
    guncellendi_at: new Date().toISOString(),
  }).eq("personel_id", personelId);
  if (error) throw new Error("Rıza yenileme süreci açılamadı.");
  await sb.from("personel_bildirimleri").insert({
    personel_id: personelId,
    tur: "riza_yenileme",
    baslik: "Konum rızası yeniden değerlendirmeye açıldı",
    mesaj: "Yönetici rıza yenileme sürecini açtı. Konum bilgilendirme metnini okuyup tercihinizi yeniden belirleyebilirsiniz.",
  });
  await auditYaz(sb, { yonetici_id: yonetici.id, hedef_personel_id: personelId, islem_turu: "riza_yenileme_acildi", aciklama: "Personel için konum rızası yenileme süreci açıldı." });
  return { ok: true };
}

export async function personelBildirimiGonderSunucu(
  token: unknown,
  input: { personelId: string; tur: string; baslik: string; mesaj: string },
) {
  const yonetici = await ikOturumDogrula(token);
  const sb = await db();
  const { data: hedef, error: hedefHatasi } = await sb.from("personel")
    .select("id, ad_soyad").eq("id", input.personelId).eq("rol", "personel").eq("aktif", true).maybeSingle();
  if (hedefHatasi) throw hedefHatasi;
  if (!hedef) throw new Error("Bildirim yalnız aktif saha personeline gönderilebilir.");
  const { error } = await sb.from("personel_bildirimleri").insert({
    personel_id: input.personelId,
    tur: input.tur.slice(0, 40),
    baslik: input.baslik.trim().slice(0, 120),
    mesaj: input.mesaj.trim().slice(0, 1000),
  });
  if (error) throw new Error("Bildirim gönderilemedi.");
  await auditYaz(sb, {
    yonetici_id: yonetici.id,
    hedef_personel_id: input.personelId,
    islem_turu: "bildirim_gonder",
    aciklama: `Personel bildirimi gönderildi: ${input.tur} - ${hedef.ad_soyad}`,
  });
  return { ok: true };
}

export type KonumTakipSaati = {
  personel_id: string;
  ad_soyad: string;
  ise_baslangic: string;
  is_bitisi: string;
  ek_calisma_bitisi: string | null;
  takip_aktif: boolean;
};

export async function konumTakipSaatleriGetirSunucu(token: unknown): Promise<KonumTakipSaati[]> {
  await ikOturumDogrula(token);
  const sb = await db();
  const [personelSonucu, saatSonucu] = await Promise.all([
    // Pasif personeli de göster: yönetici, personeli yeniden aktifleştirmeden önce
    // çalışma saatlerini hazırlayabilmeli. Konum gönderimi zaten aktif oturum
    // denetiminden geçtiği için bu, pasif hesabın takip edilmesini sağlamaz.
    sb.from("personel").select("id, ad_soyad").eq("rol", "personel").order("ad_soyad"),
    sb.from("personel_konum_takip_saatleri").select("personel_id, ise_baslangic, is_bitisi, ek_calisma_bitisi, takip_aktif"),
  ]);
  if (personelSonucu.error || saatSonucu.error) throw new Error("Konum takip saatleri alınamadı.");
  const saatler = new Map((saatSonucu.data ?? []).map((s) => [s.personel_id, s]));
  return (personelSonucu.data ?? []).map((p) => {
    const s = saatler.get(p.id);
    return {
      personel_id: p.id,
      ad_soyad: p.ad_soyad,
      ise_baslangic: s?.ise_baslangic?.slice(0, 5) ?? "08:00",
      is_bitisi: s?.is_bitisi?.slice(0, 5) ?? "18:00",
      ek_calisma_bitisi: s?.ek_calisma_bitisi?.slice(0, 5) ?? null,
      takip_aktif: s?.takip_aktif ?? false,
    };
  });
}

export async function konumTakipSaatiGuncelleSunucu(token: unknown, input: Omit<KonumTakipSaati, "ad_soyad">) {
  const yonetici = await ikOturumDogrula(token);
  const saatDeseni = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (!saatDeseni.test(input.ise_baslangic) || !saatDeseni.test(input.is_bitisi) ||
      (input.ek_calisma_bitisi !== null && !saatDeseni.test(input.ek_calisma_bitisi))) {
    throw new Error("Çalışma saatleri HH:MM biçiminde olmalıdır.");
  }
  if (input.ise_baslangic === input.is_bitisi) throw new Error("Başlangıç ve bitiş aynı olamaz.");
  const sb = await db();
  const { error } = await sb.rpc("konum_takip_saati_guncelle", {
    p_yonetici_id: yonetici.id, p_personel_id: input.personel_id,
    p_ise_baslangic: input.ise_baslangic, p_is_bitisi: input.is_bitisi,
    p_ek_calisma_bitisi: input.ek_calisma_bitisi as string, p_takip_aktif: input.takip_aktif,
  });
  if (error) throw new Error(error.message || "Konum takip saati kaydedilemedi.");
  return { ok: true };
}

export async function kendiKonumTakipDurumuGetirSunucu(token: unknown) {
  const claims = await oturumDogrula(token);
  if (claims.rol !== "personel") return { takip_aktif: false, saat_icinde: false, ise_baslangic: null, bitis: null };
  const sb = await db();
  const { data, error } = await sb.from("personel_konum_takip_saatleri")
    .select("ise_baslangic, is_bitisi, ek_calisma_bitisi, takip_aktif").eq("personel_id", claims.id).maybeSingle();
  if (error) throw new Error("Konum takip planı alınamadı.");
  if (!data?.takip_aktif) return { takip_aktif: false, saat_icinde: false, ise_baslangic: data?.ise_baslangic?.slice(0,5) ?? null, bitis: null };
  const parcalar = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const simdi = Number(parcalar.find((p) => p.type === "hour")?.value) * 60 + Number(parcalar.find((p) => p.type === "minute")?.value);
  const dakikaya = (s: string) => Number(s.slice(0,2)) * 60 + Number(s.slice(3,5));
  const bas = dakikaya(data.ise_baslangic);
  const bitisMetni = data.ek_calisma_bitisi ?? data.is_bitisi;
  const bit = dakikaya(bitisMetni);
  const saat_icinde = bas < bit ? simdi >= bas && simdi <= bit : simdi >= bas || simdi <= bit;
  return { takip_aktif: true, saat_icinde, ise_baslangic: data.ise_baslangic.slice(0,5), bitis: bitisMetni.slice(0,5) };
}

export async function sonKonumlariGetirSunucu(token: unknown): Promise<PersonelKonum[]> {
  const yonetici = await ikOturumDogrula(token);
  const sb = await db();
  const saklamaEsigi = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from("personel_konumlari")
    .select("id, personel_id, enlem, boylam, dogruluk, kayit_tarihi, personel(ad_soyad, telefon)")
    .gte("kayit_tarihi", saklamaEsigi)
    .order("kayit_tarihi", { ascending: false })
    .limit(500);
  if (error) throw error;
  await auditSinirli(sb, yonetici.id, "konum_goruntule", "Yönetici personel konum takip ekranını görüntüledi.");
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
  if (claims.rol !== "personel") throw new Error("Konum yalnız personel hesabından gönderilebilir.");
  const sb = await db();
  const { data: hizIzni, error: hizHatasi } = await sb.rpc("api_hiz_hakki_kullan", {
    p_personel_id: claims.id, p_tur: "konum", p_limit: 3, p_pencere_saniye: 60,
  });
  if (hizHatasi || !hizIzni) throw new Error("Konum güncelleme sınırı aşıldı; kısa süre sonra yeniden denenecek.");
  const takip = await kendiKonumTakipDurumuGetirSunucu(token);
  if (!takip.takip_aktif || !takip.saat_icinde) throw new Error("Konum takibi çalışma saatleri dışında kapalıdır.");
  const aydinlatma = await kvkkIlkGirisDurumuGetirSunucu(token);
  if (!aydinlatma.okundu) {
    throw new Error("Güncel KVKK ve konum takibi aydınlatma metni okunmamış.");
  }
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
  const yonetici = await ikOturumDogrula(token);
  const sb = await db();
  const { error } = await sb.rpc("gorev_olustur_atomik", {
    p_yonetici_id: yonetici.id, p_personel_id: input.personel_id, p_blok_id: input.blok_id,
    p_is_basligi: input.is_basligi, p_aciklama: input.aciklama ?? "", p_aciliyet: input.aciliyet,
    p_is_turu: input.is_turu, p_planlanan_tarih: input.planlanan_tarih,
  });
  if (error) throw new Error(`Görev oluşturulamadı: ${error.message}`);
  return { ok: true };
}

export async function gorevDurumGuncelleSunucu(token: unknown, id: string) {
  const gorev = await gorevYazmaErisimiDogrula(token, id);
  // Yalnız bekliyor -> devam_ediyor geçişine izin verilir. WHERE koşulu
  // eşzamanlı/çevrimdışı eski isteklerin tamamlanmış görevi geriye almasını engeller.
  const sb = await db();
  const { data: degisti, error } = await sb.rpc("gorev_baslat_atomik", { p_gorev_id: id, p_personel_id: gorev.personel_id });
  if (error) throw error;
  return { ok: true, degisti: Boolean(degisti) };
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
  input: { gorevId: string; base64: string; contentType: string; uzanti: string; islemId: string },
) {
  const gorev = await gorevYazmaErisimiDogrula(token, input.gorevId);
  const sb = await db();
  const { data: hizIzni, error: hizHatasi } = await sb.rpc("api_hiz_hakki_kullan", {
    p_personel_id: gorev.personel_id, p_tur: "foto_yukle", p_limit: 10, p_pencere_saniye: 3600,
  });
  if (hizHatasi || !hizIzni) throw new Error("Saatlik fotoğraf yükleme sınırı aşıldı.");
  const { data: dahaOnce } = await sb.from("is_loglari").select("foto_url")
    .eq("istemci_islem_id", input.islemId).maybeSingle();
  if (dahaOnce?.foto_url) return { yol: dahaOnce.foto_url };
  if (gorev.durum === "tamamlandi") throw new Error("Tamamlanmış göreve fotoğraf yüklenemez.");
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(input.base64);
  } catch {
    throw new Error("Fotoğraf verisi geçersiz.");
  }
  if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("Fotoğraf 8MB'dan büyük olamaz.");
  const tur = fotoTurunuAlgila(bytes);
  fotoYapisiniDogrula(bytes, tur.mime);
  bytes = fotoMetadataTemizle(bytes, tur.mime);
  fotoYapisiniDogrula(bytes, tur.mime);
  const yol = `${input.gorevId}/${crypto.randomUUID()}.${tur.uzanti}`;
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
  try {
    await auditYaz(sb, {
      yonetici_id: gorev.personel_id, hedef_personel_id: gorev.personel_id,
      islem_turu: "foto_yukle", aciklama: `Görev fotoğrafı yüklendi: ${input.gorevId}`,
    });
  } catch (auditHatasi) {
    await sb.storage.from("is-fotolari").remove([yol]);
    throw auditHatasi;
  }
  return { yol };
}

/** Fotoğraf için kısa süreli imzalı bağlantı üretir; erişim görev yetkisine bağlıdır. */
export async function fotoUrlAlSunucu(token: unknown, yol: string) {
  const gorevId = yol.split("/")[0] ?? "";
  const claims = await oturumDogrula(token);
  await gorevErisimiDogrula(token, gorevId);
  const sb = await db();
  const { data } = await sb.storage.from("is-fotolari").createSignedUrl(yol, 60 * 60);
  await auditSinirli(sb, claims.id, "foto_goruntule", `Görev fotoğrafı görüntülendi: ${gorevId}`);
  return { url: data?.signedUrl ?? null };
}

export async function gorevTamamlaSunucu(
  token: unknown,
  input: { gorevId: string; fotoYolu: string; not: string; islemId: string },
) {
  const claims = await oturumDogrula(token);
  const gorev = await gorevYazmaErisimiDogrula(token, input.gorevId);
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
    p_personel_id: claims.id,
    p_istemci_islem_id: input.islemId,
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
  if (!/^\d{4,6}$/.test(input.pin_kodu)) {
    throw new Error("Personel PIN kodu 4-6 haneli olmalıdır.");
  }
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
    p_hedef_id: null as unknown as string,
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
      : /^\d{4,6}$/.test(input.pin_kodu);
    if (!pinGecerli) {
      throw new Error(
        yoneticiHesabi
          ? "Yönetici PIN kodu 6-8 haneli olmalıdır."
          : "Personel PIN kodu 4-6 haneli olmalıdır.",
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
