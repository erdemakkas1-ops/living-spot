import type { Gorev } from "./saha-types";

const DB_ADI = "saha-cevrimdisi-v1";
const DB_SURUMU = 1;
const GOREVLER = "gorevler";
const KUYRUK = "kuyruk";
const SAKLAMA_SURESI = 24 * 60 * 60 * 1000;

export type CevrimdisiIslem =
  | { id: string; tur: "baslat"; personelId: string; gorevId: string; createdAt: number }
  | { id: string; tur: "tamamla"; personelId: string; gorevId: string; not: string; foto: Blob; createdAt: number };

type GorevAnlikGoruntusu = { personelId: string; gorevler: Gorev[]; kayitZamani: number };

function dbAc(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const istek = indexedDB.open(DB_ADI, DB_SURUMU);
    istek.onupgradeneeded = () => {
      const db = istek.result;
      if (!db.objectStoreNames.contains(GOREVLER)) db.createObjectStore(GOREVLER, { keyPath: "personelId" });
      if (!db.objectStoreNames.contains(KUYRUK)) db.createObjectStore(KUYRUK, { keyPath: "id" });
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

export async function gorevleriKaydet(personelId: string, gorevler: Gorev[]) {
  const kayit: GorevAnlikGoruntusu = { personelId, gorevler, kayitZamani: Date.now() };
  await islem(GOREVLER, "readwrite", (store) => store.put(kayit));
}

export async function kayitliGorevleriGetir(personelId: string): Promise<Gorev[] | null> {
  const kayit = await islem<GorevAnlikGoruntusu | undefined>(GOREVLER, "readonly", (store) => store.get(personelId));
  if (!kayit) return null;
  if (Date.now() - kayit.kayitZamani > SAKLAMA_SURESI) {
    await islem(GOREVLER, "readwrite", (store) => store.delete(personelId));
    return null;
  }
  return kayit.gorevler;
}

export async function kayitliGoreviGuncelle(personelId: string, gorevId: string, durum: Gorev["durum"]) {
  const gorevler = await kayitliGorevleriGetir(personelId);
  if (!gorevler) return;
  await gorevleriKaydet(personelId, gorevler.map((g) => g.id === gorevId ? { ...g, durum } : g));
}

export async function kuyrugaEkle(islemKaydi: CevrimdisiIslem) {
  await islem(KUYRUK, "readwrite", (store) => store.put(islemKaydi));
}

export async function kuyruguGetir(personelId: string): Promise<CevrimdisiIslem[]> {
  const tumu = await islem<CevrimdisiIslem[]>(KUYRUK, "readonly", (store) => store.getAll());
  const suresiDolanlar = tumu.filter((kayit) => Date.now() - kayit.createdAt > SAKLAMA_SURESI);
  await Promise.all(suresiDolanlar.map((kayit) => kuyruktanSil(kayit.id)));
  return tumu.filter((kayit) => kayit.personelId === personelId && Date.now() - kayit.createdAt <= SAKLAMA_SURESI)
    .sort((a, b) => a.createdAt - b.createdAt);
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
