/** Fotoğraflardan konum/cihaz/açıklama metadata'sını görüntüyü yeniden kodlamadan kaldırır. */
export function fotoMetadataTemizle(bytes: Uint8Array, mime: string): Uint8Array {
  if (mime === "image/jpeg") return jpegMetadataTemizle(bytes);
  if (mime === "image/png") return pngMetadataTemizle(bytes);
  if (mime === "image/webp") return webpMetadataTemizle(bytes);
  return bytes;
}

const MAKS_BOYUT = 4096;
const MAKS_PIKSEL = 16_000_000;

function boyutDogrula(genislik: number, yukseklik: number) {
  if (!Number.isInteger(genislik) || !Number.isInteger(yukseklik) || genislik < 1 || yukseklik < 1) throw new Error("Fotoğraf boyutları geçersiz.");
  if (genislik > MAKS_BOYUT || yukseklik > MAKS_BOYUT || genislik * yukseklik > MAKS_PIKSEL) throw new Error("Fotoğraf en fazla 4096×4096 ve 16 megapiksel olabilir.");
}

export function fotoYapisiniDogrula(bytes: Uint8Array, mime: string) {
  if (mime === "image/png") {
    if (bytes.length < 33 || String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR") throw new Error("PNG yapısı geçersiz.");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    boyutDogrula(view.getUint32(16), view.getUint32(20));
    return;
  }
  if (mime === "image/jpeg") {
    if (bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) throw new Error("JPEG dosyası eksik veya bozuk.");
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      if (marker === undefined) throw new Error("JPEG yapısı geçersiz.");
      if (marker === 0xda || marker === 0xd9) break;
      const length = ((bytes[i + 2] ?? 0) << 8) | (bytes[i + 3] ?? 0);
      if (length < 2 || i + 2 + length > bytes.length) throw new Error("JPEG yapısı geçersiz.");
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        boyutDogrula(((bytes[i + 7] ?? 0) << 8) | (bytes[i + 8] ?? 0), ((bytes[i + 5] ?? 0) << 8) | (bytes[i + 6] ?? 0));
        return;
      }
      i += 2 + length;
    }
    throw new Error("JPEG görüntü boyutları okunamadı.");
  }
  if (mime === "image/webp") {
    if (bytes.length < 30 || new DataView(bytes.buffer, bytes.byteOffset + 4, 4).getUint32(0, true) + 8 !== bytes.length) throw new Error("WebP yapısı geçersiz.");
    const type = String.fromCharCode(...bytes.slice(12, 16));
    if (type !== "VP8X") throw new Error("Bu WebP türü güvenli biçimde doğrulanamadı; fotoğrafı yeniden seçin.");
    boyutDogrula(1 + (bytes[24] ?? 0) + ((bytes[25] ?? 0) << 8) + ((bytes[26] ?? 0) << 16), 1 + (bytes[27] ?? 0) + ((bytes[28] ?? 0) << 8) + ((bytes[29] ?? 0) << 16));
    return;
  }
  throw new Error("Desteklenmeyen fotoğraf türü.");
}

function birlestir(parcalar: Uint8Array[]) {
  const sonuc = new Uint8Array(parcalar.reduce((t, p) => t + p.length, 0));
  let konum = 0;
  for (const parca of parcalar) { sonuc.set(parca, konum); konum += parca.length; }
  return sonuc;
}

function jpegMetadataTemizle(bytes: Uint8Array) {
  const parcalar = [bytes.slice(0, 2)];
  let i = 2;
  while (i + 4 <= bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1];
    if (marker === undefined) throw new Error("JPEG yapısı geçersiz.");
    if (marker === 0xda || marker === 0xd9) { parcalar.push(bytes.slice(i)); return birlestir(parcalar); }
    const uzunluk = ((bytes[i + 2] ?? 0) << 8) | (bytes[i + 3] ?? 0);
    if (uzunluk < 2 || i + 2 + uzunluk > bytes.length) throw new Error("JPEG yapısı geçersiz.");
    // APP1(EXIF/GPS/XMP), APP13(IPTC) ve yorum blokları kişisel metadata taşıyabilir.
    if (marker !== 0xe1 && marker !== 0xed && marker !== 0xfe) {
      parcalar.push(bytes.slice(i, i + 2 + uzunluk));
    }
    i += 2 + uzunluk;
  }
  throw new Error("JPEG yapısı geçersiz.");
}

function pngMetadataTemizle(bytes: Uint8Array) {
  const parcalar = [bytes.slice(0, 8)];
  let i = 8;
  const gizli = new Set(["eXIf", "tEXt", "zTXt", "iTXt"]);
  while (i + 12 <= bytes.length) {
    const uzunluk = new DataView(bytes.buffer, bytes.byteOffset + i, 4).getUint32(0);
    const son = i + 12 + uzunluk;
    if (son > bytes.length) throw new Error("PNG yapısı geçersiz.");
    const tur = String.fromCharCode(...bytes.slice(i + 4, i + 8));
    if (!gizli.has(tur)) parcalar.push(bytes.slice(i, son));
    i = son;
    if (tur === "IEND") {
      if (son !== bytes.length) throw new Error("PNG sonunda beklenmeyen veri bulundu.");
      return birlestir(parcalar);
    }
  }
  throw new Error("PNG yapısı geçersiz.");
}

function webpMetadataTemizle(bytes: Uint8Array) {
  const parcalar: Uint8Array[] = [];
  let i = 12;
  while (i + 8 <= bytes.length) {
    const tur = String.fromCharCode(...bytes.slice(i, i + 4));
    const uzunluk = new DataView(bytes.buffer, bytes.byteOffset + i + 4, 4).getUint32(0, true);
    const son = i + 8 + uzunluk + (uzunluk % 2);
    if (son > bytes.length) throw new Error("WebP yapısı geçersiz.");
    if (tur !== "EXIF" && tur !== "XMP ") {
      const parca = bytes.slice(i, son);
      if (tur === "VP8X" && parca.length > 8) parca[8] = (parca[8] ?? 0) & ~0x0c;
      parcalar.push(parca);
    }
    i = son;
  }
  const govde = birlestir(parcalar);
  const sonuc = new Uint8Array(12 + govde.length);
  sonuc.set(bytes.slice(0, 4), 0);
  new DataView(sonuc.buffer).setUint32(4, sonuc.length - 8, true);
  sonuc.set(bytes.slice(8, 12), 8);
  sonuc.set(govde, 12);
  return sonuc;
}
