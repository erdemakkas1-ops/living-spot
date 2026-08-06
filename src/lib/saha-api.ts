import { supabase } from "@/integrations/supabase/client";
import type { Blok, Gorev, Personel } from "./saha-types";

const GOREV_SELECT =
  "id, blok_id, personel_id, is_basligi, aciklama, durum, aciliyet, olusturma_tarihi, bloklar(blok_adi), personel(ad_soyad), is_loglari(id, gorev_id, foto_url, personel_notu, tamamlanma_tarihi)";

export async function girisYap(telefon: string, pin: string): Promise<Personel> {
  const { data, error } = await supabase
    .from("personel")
    .select("id, ad_soyad, rol, telefon, aktif")
    .eq("telefon", telefon.trim())
    .eq("pin_kodu", pin.trim())
    .maybeSingle();
  if (error) throw new Error("Giriş sırasında bir hata oluştu.");
  if (!data) throw new Error("Telefon veya PIN kodu hatalı.");
  return data as Personel;
}

const dogalSiralama = new Intl.Collator("tr", { numeric: true, sensitivity: "base" });

export async function bloklariGetir(): Promise<Blok[]> {
  const { data, error } = await supabase
    .from("bloklar")
    .select("id, blok_adi")
    .order("blok_adi");
  if (error) throw error;
  return ((data ?? []) as Blok[]).sort((a, b) => dogalSiralama.compare(a.blok_adi, b.blok_adi));
}

export async function personelGetir(): Promise<Personel[]> {
  const { data, error } = await supabase
    .from("personel")
    .select("id, ad_soyad, rol, telefon, aktif")
    .eq("rol", "personel")
    .order("ad_soyad");
  if (error) throw error;
  return (data ?? []) as Personel[];
}

export async function tumGorevleriGetir(): Promise<Gorev[]> {
  const { data, error } = await supabase
    .from("gorevler")
    .select(GOREV_SELECT)
    .order("olusturma_tarihi", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Gorev[];
}

export async function personelGorevleriniGetir(personelId: string): Promise<Gorev[]> {
  const { data, error } = await supabase
    .from("gorevler")
    .select(GOREV_SELECT)
    .eq("personel_id", personelId)
    .order("olusturma_tarihi", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Gorev[];
}

export async function gorevGetir(id: string): Promise<Gorev | null> {
  const { data, error } = await supabase
    .from("gorevler")
    .select(GOREV_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Gorev) ?? null;
}

export async function gorevOlustur(input: {
  blok_id: string;
  personel_id: string;
  is_basligi: string;
  aciklama: string;
  aciliyet: string;
}) {
  const { error } = await supabase.from("gorevler").insert(input);
  if (error) throw error;
}

export async function gorevDurumGuncelle(id: string, durum: string) {
  const { error } = await supabase.from("gorevler").update({ durum }).eq("id", id);
  if (error) throw error;
}

export async function fotoYukle(gorevId: string, file: File): Promise<string> {
  const uzanti = file.name.split(".").pop() || "jpg";
  const yol = `${gorevId}/${Date.now()}.${uzanti}`;
  const { error } = await supabase.storage.from("is-fotolari").upload(yol, file, {
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  return yol;
}

export async function fotoUrlAl(yol: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from("is-fotolari")
    .createSignedUrl(yol, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function gorevTamamla(input: {
  gorevId: string;
  fotoYolu: string;
  not: string;
}) {
  const { error } = await supabase.from("is_loglari").insert({
    gorev_id: input.gorevId,
    foto_url: input.fotoYolu,
    personel_notu: input.not,
  });
  if (error) throw error;
  await gorevDurumGuncelle(input.gorevId, "tamamlandi");
}