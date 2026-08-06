export type Rol = "ik" | "personel";
export type MesaiDurumu = "calisiyor" | "molada";
export type AnlikDurum = "calisiyor" | "molada" | "cevrimdisi";
export type Durum = "bekliyor" | "devam_ediyor" | "tamamlandi";
export type Aciliyet = "normal" | "acil";
export type IsTuru =
  | "peyzaj"
  | "bakim"
  | "temizlik"
  | "guvenlik"
  | "elektrik"
  | "sihhi_tesisat"
  | "tadilat"
  | "genel";

export type Blok = { id: string; blok_adi: string };

export type Personel = {
  id: string;
  ad_soyad: string;
  rol: Rol;
  telefon: string;
  aktif: boolean;
  mesai_durumu?: MesaiDurumu;
  durum_guncelleme?: string;
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
  is_turu: IsTuru;
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

export const IS_TURU_ETIKET: Record<IsTuru, string> = {
  peyzaj: "Peyzaj",
  bakim: "Bakım",
  temizlik: "Temizlik",
  guvenlik: "Güvenlik",
  elektrik: "Elektrik",
  sihhi_tesisat: "Sıhhi Tesisat",
  tadilat: "Tadilat",
  genel: "Genel",
};

export const IS_TURU_SINIF: Record<IsTuru, string> = {
  peyzaj: "bg-is-turu-peyzaj text-is-turu-peyzaj-foreground",
  bakim: "bg-is-turu-bakim text-is-turu-bakim-foreground",
  temizlik: "bg-is-turu-temizlik text-is-turu-temizlik-foreground",
  guvenlik: "bg-is-turu-guvenlik text-is-turu-guvenlik-foreground",
  elektrik: "bg-is-turu-elektrik text-is-turu-elektrik-foreground",
  sihhi_tesisat: "bg-is-turu-sihhi-tesisat text-is-turu-sihhi-tesisat-foreground",
  tadilat: "bg-is-turu-tadilat text-is-turu-tadilat-foreground",
  genel: "bg-is-turu-genel text-is-turu-genel-foreground",
};

export const IS_BASLIKLARI: Record<IsTuru, string[]> = {
  peyzaj: ["Bahçe bakımı", "Çim biçme", "Ağaç/çalı budama", "Çiçeklendirme", "Sulama sistemi kontrolü", "Peyzaj temizliği"],
  bakim: ["Asansör bakımı", "Isıtma sistemi kontrolü", "Havalandırma kontrolü", "Yangın sistemi kontrolü", "Jeneratör kontrolü", "Kapı/pencere bakımı"],
  temizlik: ["Genel temizlik", "Merdiven temizliği", "Otopark temizliği", "Sıva temizliği", "Cam temizliği", "Çöp toplama"],
  guvenlik: ["Güvenlik devriyesi", "Kamera sistemi kontrolü", "Gece kontrolü", "Yangın tatbikatı", "Misafir yönlendirme", "Kapı giriş kontrolü"],
  elektrik: ["Elektrik arızası", "Aydınlatma kontrolü", "Pano kontrolü", "Elektrik tesisatı bakımı", "Yıldırım sistem kontrolü", "Güç kaynağı kontrolü"],
  sihhi_tesisat: ["Su kaçağı", "Tıkanıklık açma", "Sıhhi tesisat kontrolü", "Pis su arıtma kontrolü", "Hidrofor kontrolü", "Musluk/batarya kontrolü"],
  tadilat: ["Boya-badana", "Seramik tamiratı", "Sıva tamiratı", "Kapı kilidi tamiri", "Mermer parlatma", "Tavan tamiratı"],
  genel: ["Genel kontrol", "Anahtar teslim kontrolü", "Depo sayımı", "Araç kontrolü", "Yönetim talimatı", "Dış mekan kontrolü"],
};

export type PersonelKonum = {
  id: string;
  personel_id: string;
  enlem: number;
  boylam: number;
  dogruluk: number | null;
  kayit_tarihi: string;
  personel: { ad_soyad: string; telefon: string } | null;
};
