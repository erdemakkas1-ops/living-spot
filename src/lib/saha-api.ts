/**
 * Tarayıcı tarafı saha API'si. Veritabanına doğrudan erişim yoktur;
 * tüm sorgular yetki kontrolü yapan sunucu fonksiyonları üzerinden geçer.
 */
import {
  bloklariGetirFn,
  fotoUrlAlFn,
  fotoYukleFn,
  girisYapFn,
  gorevDurumGuncelleFn,
  gorevGetirFn,
  gorevOlusturFn,
  gorevTamamlaFn,
  konumGonderFn,
  mesaiDurumuGetirFn,
  mesaiDurumuGuncelleFn,
  personelDurumlariFn,
  personelGetirFn,
  personelGorevleriniGetirFn,
  sonKonumlariGetirFn,
  tumGorevleriGetirFn,
} from "./saha-api.functions";
import { tokenOku, tokenYaz } from "./saha-session";
import type {
  AnlikDurum,
  Blok,
  Gorev,
  MesaiDurumu,
  Personel,
  PersonelKonum,
} from "./saha-types";

function token() {
  const t = tokenOku();
  if (!t) throw new Error("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
  return t;
}

export async function girisYap(telefon: string, pin: string): Promise<Personel> {
  const sonuc = await girisYapFn({ data: { telefon, pin } });
  tokenYaz(sonuc.token);
  return sonuc.personel as Personel;
}

const dogalSiralama = new Intl.Collator("tr", { numeric: true, sensitivity: "base" });

export async function bloklariGetir(): Promise<Blok[]> {
  const data = await bloklariGetirFn({ data: { token: token() } });
  return (data as Blok[]).slice().sort((a, b) => dogalSiralama.compare(a.blok_adi, b.blok_adi));
}

export async function personelGetir(): Promise<Personel[]> {
  return (await personelGetirFn({ data: { token: token() } })) as Personel[];
}

export async function mesaiDurumuGuncelle(_personelId: string, durum: MesaiDurumu) {
  await mesaiDurumuGuncelleFn({ data: { token: token(), durum } });
}

export async function mesaiDurumuGetir(_personelId?: string): Promise<MesaiDurumu> {
  return (await mesaiDurumuGetirFn({ data: { token: token() } })) as MesaiDurumu;
}

export type PersonelAnlikDurum = {
  id: string;
  ad_soyad: string;
  telefon: string;
  durum: AnlikDurum;
  son_gorulme: string | null;
};

const CANLI_ESIK_MS = 15 * 60 * 1000;

/** Aktif saha personelinin anlık durumunu (çalışıyor / molada / çevrimdışı) döner. */
export async function personelAnlikDurumlariGetir(): Promise<PersonelAnlikDurum[]> {
  const { personeller, konumlar } = await personelDurumlariFn({ data: { token: token() } });
  const sonKonum = new Map(
    (konumlar as PersonelKonum[]).map((k) => [k.personel_id, k.kayit_tarihi]),
  );

  return (personeller as Personel[])
    .filter((p) => p.aktif)
    .map((p) => {
      const gorulme = sonKonum.get(p.id) ?? null;
      const canliMi = !!gorulme && Date.now() - new Date(gorulme).getTime() < CANLI_ESIK_MS;
      const durum: AnlikDurum =
        p.mesai_durumu === "molada" ? "molada" : canliMi ? "calisiyor" : "cevrimdisi";
      return {
        id: p.id,
        ad_soyad: p.ad_soyad,
        telefon: p.telefon,
        durum,
        son_gorulme: gorulme,
      };
    });
}

export async function tumGorevleriGetir(): Promise<Gorev[]> {
  return (await tumGorevleriGetirFn({ data: { token: token() } })) as Gorev[];
}

export async function personelGorevleriniGetir(_personelId?: string): Promise<Gorev[]> {
  return (await personelGorevleriniGetirFn({ data: { token: token() } })) as Gorev[];
}

export async function gorevGetir(id: string): Promise<Gorev | null> {
  return (await gorevGetirFn({ data: { token: token(), id } })) as Gorev | null;
}

export async function gorevOlustur(input: {
  blok_id: string;
  personel_id: string;
  is_basligi: string;
  aciklama: string;
  aciliyet: string;
  is_turu: string;
}) {
  await gorevOlusturFn({ data: { token: token(), ...input } as never });
}

export async function gorevDurumGuncelle(id: string, durum: string) {
  await gorevDurumGuncelleFn({ data: { token: token(), id, durum } as never });
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
  if (file.size > 10 * 1024 * 1024) throw new Error("Fotoğraf 10MB'dan büyük olamaz.");
  const uzanti = (file.name.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "").slice(0, 5) || "jpg";
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
  const { url } = await fotoUrlAlFn({ data: { token: token(), yol } });
  return url;
}

export async function gorevTamamla(input: {
  gorevId: string;
  fotoYolu: string;
  not: string;
}) {
  await gorevTamamlaFn({ data: { token: token(), ...input } });
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
  const data = (await sonKonumlariGetirFn({ data: { token: token() } })) as PersonelKonum[];
  return data
    .slice()
    .sort((a, b) => (a.personel?.ad_soyad ?? "").localeCompare(b.personel?.ad_soyad ?? "", "tr"));
}
