/** Sunucu tarafı saha veri erişimi. Tüm tablo erişimi burada, yetki kontrolü ile yapılır. */
import { ikDogrula, tokenDogrula, tokenUret } from "./saha-token.server";
import type { Blok, Gorev, MesaiDurumu, Personel, PersonelKonum } from "./saha-types";

const GOREV_SELECT =
  "id, blok_id, personel_id, is_basligi, aciklama, durum, aciliyet, is_turu, olusturma_tarihi, bloklar(blok_adi), personel(ad_soyad), is_loglari(id, gorev_id, foto_url, personel_notu, tamamlanma_tarihi)";
const PERSONEL_SELECT =
  "id, ad_soyad, rol, telefon, aktif, mesai_durumu, durum_guncelleme";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function girisYapSunucu(telefon: string, pin: string) {
  const sb = await db();
  const { data, error } = await sb
    .from("personel")
    .select(PERSONEL_SELECT)
    .eq("telefon", telefon.trim())
    .eq("pin_kodu", pin.trim())
    .eq("aktif", true)
    .maybeSingle();
  if (error) throw new Error("Giriş sırasında bir hata oluştu.");
  if (!data) throw new Error("Telefon veya PIN kodu hatalı.");
  const personel = data as unknown as Personel;
  return { personel, token: await tokenUret(personel.id, personel.rol) };
}

export async function bloklariGetirSunucu(token: unknown): Promise<Blok[]> {
  await tokenDogrula(token);
  const sb = await db();
  const { data, error } = await sb.from("bloklar").select("id, blok_adi").order("blok_adi");
  if (error) throw error;
  return (data ?? []) as Blok[];
}

export async function personelGetirSunucu(token: unknown): Promise<Personel[]> {
  await ikDogrula(token);
  const sb = await db();
  const { data, error } = await sb
    .from("personel")
    .select(PERSONEL_SELECT)
    .eq("rol", "personel")
    .order("ad_soyad");
  if (error) throw error;
  return (data ?? []) as unknown as Personel[];
}

export async function mesaiDurumuGuncelleSunucu(token: unknown, durum: MesaiDurumu) {
  const claims = await tokenDogrula(token);
  const sb = await db();
  const { error } = await sb
    .from("personel")
    .update({ mesai_durumu: durum, durum_guncelleme: new Date().toISOString() })
    .eq("id", claims.id);
  if (error) throw error;
  return { ok: true };
}

export async function mesaiDurumuGetirSunucu(token: unknown): Promise<MesaiDurumu> {
  const claims = await tokenDogrula(token);
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
  await ikDogrula(token);
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

export async function konumGonderSunucu(
  token: unknown,
  input: { enlem: number; boylam: number; dogruluk?: number | null | undefined },
) {
  const claims = await tokenDogrula(token);
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
  await ikDogrula(token);
  const sb = await db();
  const { data, error } = await sb
    .from("gorevler")
    .select(GOREV_SELECT)
    .order("olusturma_tarihi", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Gorev[];
}

export async function personelGorevleriniGetirSunucu(token: unknown): Promise<Gorev[]> {
  const claims = await tokenDogrula(token);
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
  const claims = await tokenDogrula(token);
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
  },
) {
  await ikDogrula(token);
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