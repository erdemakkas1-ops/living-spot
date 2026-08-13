/** Fotoğraflardan konum/cihaz/açıklama metadata'sını görüntüyü yeniden kodlamadan kaldırır. */
export function fotoMetadataTemizle(bytes: Uint8Array, mime: string): Uint8Array {
  if (mime === "image/jpeg") return jpegMetadataTemizle(bytes);
  if (mime === "image/png") return pngMetadataTemizle(bytes);
  if (mime === "image/webp") return webpMetadataTemizle(bytes);
  return bytes;
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
    if (tur === "IEND") return birlestir(parcalar);
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
