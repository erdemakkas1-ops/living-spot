/**
 * Tarayıcı tarafı saha API'si. Veritabanına doğrudan erişim yoktur;
 * tüm sorgular yetki kontrolü yapan sunucu fonksiyonları üzerinden geçer.
 */
import {
  auditLoglariGetirFn,
  bloklariGetirFn,
  cikisYapFn,
  fotoUrlAlFn,
  fotoYukleFn,
  girisYapFn,
  mfaDogrulaFn,
  gorevDurumGuncelleFn,
  gorevGetirFn,
  gorevOlusturFn,
  gorevTamamlaFn,
  konumGonderFn,
  mesaiDurumuGetirFn,
  mesaiDurumuGuncelleFn,
  personelAktiflikGuncelleFn,
  personelDurumlariFn,
  personelEkleFn,
  personelDuzenleFn,
  personelGetirFn,
  personelGorevleriniGetirFn,
  personelSilFn,
  sonKonumlariGetirFn,
  tumGorevleriGetirFn,
} from "./saha-api.functions";
import {
  HESAP_PASIF,
  OTURUM_SURESI_DOLDU,
  oturumSil,
  oturumSonlandir,
} from "./saha-session";
import type { AnlikDurum, Blok, Gorev, MesaiDurumu, Personel, PersonelKonum } from "./saha-types";

/**
 * Sunucu tarafındaki oturum hatalarını (süresi dolmuş/geçersiz imzalı token)
 * yakalar: yerel oturumu temizler ve kullanıcıyı giriş ekranına gönderir.
 * Böylece beyaz ekran yerine PIN girişi görünür.
 */
async function cagir<T>(islem: Promise<T>): Promise<T> {
  try {
    return await islem;
  } catch (hata) {
    const mesaj = hata instanceof Error ? hata.message : String(hata);
    // Hesap pasife alındıysa yerel oturum temizlenir ve uyarı mesajı gösterilir.
    if (mesaj.includes("Hesabınız pasif durumda") && typeof window !== "undefined") {
      oturumSonlandir(HESAP_PASIF);
      return await new Promise<T>(() => {});
    }
    // Yalnızca gerçek oturum hataları oturumu kapatır. "yetki" içeren yetkilendirme
    // hataları (ör. İK'ya özel işlem) oturumu düşürmemeli.
    const oturumHatasi =
      mesaj.includes("Oturum geçersiz") ||
      mesaj.includes("Oturum bulunamadı") ||
      mesaj.includes("süresi dolmuş") ||
      mesaj.includes(OTURUM_SURESI_DOLDU) ||
      mesaj.includes("Unauthorized");
    if (oturumHatasi && typeof window !== "undefined") {
      // PIN yenilendiği için düşen oturumda sunucunun açıklayıcı mesajı gösterilir.
      oturumSonlandir(
        mesaj.includes("giriş bilgileriniz güncellendi") ? mesaj : OTURUM_SURESI_DOLDU,
      );
      // Hata yeniden atılırsa React error boundary beyaz ekran gösteriyor;
      // yönlendirme tamamlanana kadar bekleyen bir promise döndürüyoruz.
      return await new Promise<T>(() => {});
    }
    throw hata;
  }
}

function token() {
  // Gerçek token yalnız HttpOnly çerezde taşınır; bu değer gizli bilgi içermez.
  return "http-only-cookie";
}

export type GirisSonucu =
  | { mfaGerekli: false; personel: Personel }
  | { mfaGerekli: true; kurulum: { anahtar: string; uri: string } | undefined };

export async function girisYap(telefon: string, pin: string): Promise<GirisSonucu> {
  const sonuc = await girisYapFn({
    data: { telefon: telefon.replace(/\D/g, ""), pin: pin.trim() },
  });
  return sonuc as GirisSonucu;
}

export async function mfaDogrula(kod: string): Promise<Personel> {
  const sonuc = await mfaDogrulaFn({ data: { kod: kod.trim() } });
  return sonuc.personel as Personel;
}

export async function guvenliCikisYap() {
  try {
    await cikisYapFn();
  } finally {
    oturumSil();
  }
}

const dogalSiralama = new Intl.Collator("tr", { numeric: true, sensitivity: "base" });

export async function bloklariGetir(): Promise<Blok[]> {
  const data = await cagir(bloklariGetirFn({ data: { token: token() } }));
  return (data as Blok[]).slice().sort((a, b) => dogalSiralama.compare(a.blok_adi, b.blok_adi));
}

export async function personelGetir(): Promise<Personel[]> {
  return (await cagir(personelGetirFn({ data: { token: token() } }))) as Personel[];
}

export async function mesaiDurumuGuncelle(_personelId: string, durum: MesaiDurumu) {
  await cagir(mesaiDurumuGuncelleFn({ data: { token: token(), durum } }));
}

export async function mesaiDurumuGetir(_personelId?: string): Promise<MesaiDurumu> {
  return (await cagir(mesaiDurumuGetirFn({ data: { token: token() } }))) as MesaiDurumu;
}

export type PersonelAnlikDurum = {
  id: string;
  ad_soyad: string;
  telefon: string;
  durum: AnlikDurum;
  son_gorulme: string | null;
};

/** Aktif saha personelinin anlık durumunu (çalışıyor / molada / çevrimdışı) döner. */
export async function personelAnlikDurumlariGetir(): Promise<PersonelAnlikDurum[]> {
  const { personeller, konumlar } = await cagir(personelDurumlariFn({ data: { token: token() } }));
  const sonKonum = new Map(
    (konumlar as PersonelKonum[]).map((k) => [k.personel_id, k.kayit_tarihi]),
  );

  return (personeller as Personel[])
    .filter((p) => p.aktif)
    .map((p) => {
      const gorulme = sonKonum.get(p.id) ?? null;
      // Mesai durumu personelin kendi bildirimi olduğu için esas alınır;
      // konum kaydı yalnızca "son görülme" bilgisi olarak gösterilir.
      const durum: AnlikDurum = p.mesai_durumu === "molada" ? "molada" : "calisiyor";
      return {
        id: p.id,
        ad_soyad: p.ad_soyad,
        telefon: p.telefon,
        durum,
        son_gorulme: gorulme ?? p.durum_guncelleme ?? null,
      };
    });
}

export async function tumGorevleriGetir(): Promise<Gorev[]> {
  return (await cagir(tumGorevleriGetirFn({ data: { token: token() } }))) as Gorev[];
}

export async function personelGorevleriniGetir(_personelId?: string): Promise<Gorev[]> {
  return (await cagir(personelGorevleriniGetirFn({ data: { token: token() } }))) as Gorev[];
}

export async function gorevGetir(id: string): Promise<Gorev | null> {
  return (await cagir(gorevGetirFn({ data: { token: token(), id } }))) as Gorev | null;
}

export async function gorevOlustur(input: {
  blok_id: string;
  personel_id: string;
  is_basligi: string;
  aciklama: string;
  aciliyet: "normal" | "acil";
  planlanan_tarih: string;
  is_turu:
    | "peyzaj"
    | "bakim"
    | "temizlik"
    | "guvenlik"
    | "elektrik"
    | "sihhi_tesisat"
    | "tadilat"
    | "genel";
}) {
  await cagir(gorevOlusturFn({ data: { token: token(), ...input } }));
}

export async function gorevDurumGuncelle(id: string, durum: "bekliyor" | "devam_ediyor") {
  await cagir(gorevDurumGuncelleFn({ data: { token: token(), id, durum } }));
}

function dosyadanBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const okuyucu = new FileReader();
    okuyucu.onload = () => {
      const sonuc = String(okuyucu.result);
      resolve(sonuc.slice(sonuc.indexOf(",") + 1));
    };
    okuyucu.onerror = () => reject(new Error("Fotoğraf okunamadı."));
    okuyucu.readAsDataURL(file);
  });
}

export async function fotoYukle(gorevId: string, file: File): Promise<string> {
  const izinliTurler = ["image/jpeg", "image/png", "image/webp"];
  if (!izinliTurler.includes(file.type)) {
    throw new Error("Yalnızca JPEG, PNG veya WebP fotoğrafı seçebilirsiniz.");
  }
  if (file.size > 8 * 1024 * 1024) throw new Error("Fotoğraf 8MB'dan büyük olamaz.");
  const uzanti =
    (file.name.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "").slice(0, 5) || "jpg";
  const base64 = await dosyadanBase64(file);
  const { yol } = await fotoYukleFn({
    data: {
      token: token(),
      gorevId,
      base64,
      contentType: file.type || "image/jpeg",
      uzanti,
    },
  });
  return yol;
}

export async function fotoUrlAl(yol: string): Promise<string | null> {
  const { url } = await cagir(fotoUrlAlFn({ data: { token: token(), yol } }));
  return url;
}

export async function gorevTamamla(input: { gorevId: string; fotoYolu: string; not: string }) {
  await cagir(gorevTamamlaFn({ data: { token: token(), ...input } }));
}

export async function konumGonder(input: {
  personel_id: string;
  enlem: number;
  boylam: number;
  dogruluk?: number | null;
}) {
  await konumGonderFn({
    data: {
      token: token(),
      enlem: input.enlem,
      boylam: input.boylam,
      dogruluk: input.dogruluk ?? null,
    },
  });
}

export async function sonKonumlariGetir(): Promise<PersonelKonum[]> {
  const data = (await cagir(sonKonumlariGetirFn({ data: { token: token() } }))) as PersonelKonum[];
  return data
    .slice()
    .sort((a, b) => (a.personel?.ad_soyad ?? "").localeCompare(b.personel?.ad_soyad ?? "", "tr"));
}

export async function personelEkle(input: { ad_soyad: string; telefon: string; pin_kodu: string }) {
  await cagir(personelEkleFn({ data: { token: token(), ...input } }));
}

export async function personelAktiflikGuncelle(id: string, aktif: boolean) {
  await cagir(personelAktiflikGuncelleFn({ data: { token: token(), id, aktif } }));
}

export async function personelDuzenle(input: {
  id: string;
  ad_soyad: string;
  telefon: string;
  pin_kodu?: string;
  aktif: boolean;
}) {
  await cagir(personelDuzenleFn({ data: { token: token(), ...input } }));
}

export async function personelSil(id: string) {
  await cagir(personelSilFn({ data: { token: token(), id } }));
}

export type AuditKaydi = {
  id: string;
  islem_turu: string;
  aciklama: string;
  created_at: string;
  yonetici_adi: string;
  hedef_adi: string;
};

/** İK: yönetim işlemleri denetim kayıtları (en yeniden eskiye). */
export async function auditLoglariGetir(): Promise<AuditKaydi[]> {
  return (await cagir(auditLoglariGetirFn({ data: { token: token() } }))) as AuditKaydi[];
}
