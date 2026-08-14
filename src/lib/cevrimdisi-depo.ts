import type { Gorev } from "./saha-types";

const DB_ADI = "saha-cevrimdisi-v1";
const DB_SURUMU = 2;
const GOREVLER = "gorevler";
const KUYRUK = "kuyruk";
const ANAHTARLAR = "anahtarlar";
const ANAHTAR_ID = "cihaz-anahtari";
const SAKLAMA_SURESI = 24 * 60 * 60 * 1000;

export type CevrimdisiIslem =
  | { id: string; tur: "baslat"; personelId: string; gorevId: string; createdAt: number }
  | { id: string; tur: "tamamla"; personelId: string; gorevId: string; islemId: string; not: string; foto: Blob; createdAt: number };

type SifreliKayit = {
  id: string;
  iv: Uint8Array;
  veri: ArrayBuffer;
  fotoIv?: Uint8Array;
  fotoVeri?: ArrayBuffer;
  kayitZamani: number;
};

function dbAc(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const istek = indexedDB.open(DB_ADI, DB_SURUMU);
    istek.onupgradeneeded = () => {
      const db = istek.result;
      // v1'deki şifresiz kayıtları yeni şifreli biçime taşımak yerine sileriz.
      // Böylece cihazda eski düz metin görev/fotoğraf bırakılmaz.
      if (db.objectStoreNames.contains(GOREVLER)) istek.transaction?.objectStore(GOREVLER).clear();
      else db.createObjectStore(GOREVLER, { keyPath: "id" });
      if (db.objectStoreNames.contains(KUYRUK)) istek.transaction?.objectStore(KUYRUK).clear();
      else db.createObjectStore(KUYRUK, { keyPath: "id" });
      if (!db.objectStoreNames.contains(ANAHTARLAR)) db.createObjectStore(ANAHTARLAR, { keyPath: "id" });
    };
    istek.onsuccess = () => resolve(istek.result);
    istek.onerror = () => reject(istek.error ?? new Error("Çevrimdışı depo açılamadı."));
  });
}

async function islem<T>(magaza: string, mod: IDBTransactionMode, calistir: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await dbAc();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = calistir(db.transaction(magaza, mod).objectStore(magaza));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Çevrimdışı depo işlemi başarısız."));
    });
  } finally { db.close(); }
}

async function cihazAnahtari(): Promise<CryptoKey> {
  const mevcut = await islem<{ id: string; anahtar: CryptoKey } | undefined>(ANAHTARLAR, "readonly", (store) => store.get(ANAHTAR_ID));
  if (mevcut?.anahtar) return mevcut.anahtar;
  // Dışa aktarılamayan anahtar yalnızca bu originin WebCrypto işlemlerinde kullanılabilir.
  const anahtar = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await islem(ANAHTARLAR, "readwrite", (store) => store.put({ id: ANAHTAR_ID, anahtar }));
  return anahtar;
}

async function sifrele(veri: unknown): Promise<Pick<SifreliKayit, "iv" | "veri">> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const acik = new TextEncoder().encode(JSON.stringify(veri));
  return { iv, veri: await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await cihazAnahtari(), acik) };
}

async function sifreCoz<T>(kayit: Pick<SifreliKayit, "iv" | "veri">): Promise<T> {
  const acik = await crypto.subtle.decrypt({ name: "AES-GCM", iv: kayit.iv }, await cihazAnahtari(), kayit.veri);
  return JSON.parse(new TextDecoder().decode(acik)) as T;
}

async function blobSifrele(blob: Blob) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const veri = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await cihazAnahtari(), await blob.arrayBuffer());
  return { iv, veri };
}

async function blobSifreCoz(iv: Uint8Array, veri: ArrayBuffer) {
  return new Blob([await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await cihazAnahtari(), veri)], { type: "image/jpeg" });
}

export async function gorevleriKaydet(personelId: string, gorevler: Gorev[]) {
  const sifreli = await sifrele({ personelId, gorevler });
  await islem(GOREVLER, "readwrite", (store) => store.put({ id: personelId, ...sifreli, kayitZamani: Date.now() } satisfies SifreliKayit));
}

export async function kayitliGorevleriGetir(personelId: string): Promise<Gorev[] | null> {
  const kayit = await islem<SifreliKayit | undefined>(GOREVLER, "readonly", (store) => store.get(personelId));
  if (!kayit) return null;
  if (Date.now() - kayit.kayitZamani > SAKLAMA_SURESI) {
    await islem(GOREVLER, "readwrite", (store) => store.delete(personelId));
    return null;
  }
  try {
    const acik = await sifreCoz<{ personelId: string; gorevler: Gorev[] }>(kayit);
    return acik.personelId === personelId ? acik.gorevler : null;
  } catch {
    await islem(GOREVLER, "readwrite", (store) => store.delete(personelId));
    return null;
  }
}

export async function kayitliGoreviGuncelle(personelId: string, gorevId: string, durum: Gorev["durum"]) {
  const gorevler = await kayitliGorevleriGetir(personelId);
  if (!gorevler) return;
  await gorevleriKaydet(personelId, gorevler.map((g) => g.id === gorevId ? { ...g, durum } : g));
}

export async function kuyrugaEkle(islemKaydi: CevrimdisiIslem) {
  const { foto, ...meta } = islemKaydi.tur === "tamamla" ? islemKaydi : { ...islemKaydi, foto: undefined };
  const sifreli = await sifrele(meta);
  const sifreliFoto = foto ? await blobSifrele(foto) : undefined;
  await islem(KUYRUK, "readwrite", (store) => store.put({
    id: islemKaydi.id, ...sifreli,
    fotoIv: sifreliFoto?.iv, fotoVeri: sifreliFoto?.veri,
    kayitZamani: islemKaydi.createdAt,
  } satisfies SifreliKayit));
}

export async function kuyruguGetir(personelId: string): Promise<CevrimdisiIslem[]> {
  const tumu = await islem<SifreliKayit[]>(KUYRUK, "readonly", (store) => store.getAll());
  const sonuc: CevrimdisiIslem[] = [];
  for (const kayit of tumu) {
    if (Date.now() - kayit.kayitZamani > SAKLAMA_SURESI) {
      await kuyruktanSil(kayit.id);
      continue;
    }
    try {
      const meta = await sifreCoz<Exclude<CevrimdisiIslem, { tur: "tamamla" }> | Omit<Extract<CevrimdisiIslem, { tur: "tamamla" }>, "foto">>(kayit);
      if (meta.personelId !== personelId) continue;
      if (meta.tur === "tamamla") {
        if (!kayit.fotoIv || !kayit.fotoVeri) throw new Error("Şifreli fotoğraf eksik.");
        sonuc.push({ ...meta, foto: await blobSifreCoz(kayit.fotoIv, kayit.fotoVeri) });
      } else sonuc.push(meta);
    } catch {
      await kuyruktanSil(kayit.id);
    }
  }
  return sonuc.sort((a, b) => a.createdAt - b.createdAt);
}

export async function kuyruktanSil(id: string) {
  await islem(KUYRUK, "readwrite", (store) => store.delete(id));
}

export async function cevrimdisiDepoyuTemizle() {
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve) => {
    const istek = indexedDB.deleteDatabase(DB_ADI);
    istek.onsuccess = () => resolve();
    istek.onerror = () => resolve();
    istek.onblocked = () => resolve();
  });
}

export function islemKimligi(tur: CevrimdisiIslem["tur"], gorevId: string) {
  return `${tur}:${gorevId}`;
}
