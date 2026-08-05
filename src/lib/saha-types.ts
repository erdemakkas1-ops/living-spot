export type Rol = "ik" | "personel";
export type Durum = "bekliyor" | "devam_ediyor" | "tamamlandi";
export type Aciliyet = "normal" | "acil";

export type Blok = { id: string; blok_adi: string };

export type Personel = {
  id: string;
  ad_soyad: string;
  rol: Rol;
  telefon: string;
  aktif: boolean;
};

export type IsLog = {
  id: string;
  gorev_id: string;
  foto_url: string | null;
  personel_notu: string | null;
  tamamlanma_tarihi: string;
};

export type Gorev = {
  id: string;
  blok_id: string;
  personel_id: string | null;
  is_basligi: string;
  aciklama: string | null;
  durum: Durum;
  aciliyet: Aciliyet;
  olusturma_tarihi: string;
  bloklar: { blok_adi: string } | null;
  personel: { ad_soyad: string } | null;
  is_loglari: IsLog[];
};

export const DURUM_ETIKET: Record<Durum, string> = {
  bekliyor: "Bekliyor",
  devam_ediyor: "Devam Ediyor",
  tamamlandi: "Tamamlandı",
};

export const DURUM_SINIF: Record<Durum, string> = {
  bekliyor: "bg-status-bekliyor text-status-bekliyor-foreground",
  devam_ediyor: "bg-status-devam text-status-devam-foreground",
  tamamlandi: "bg-status-tamam text-status-tamam-foreground",
};