import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getCookie, getRequestIP, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  auditLoglariGetirSunucu,
  bloklariGetirSunucu,
  fotoUrlAlSunucu,
  fotoYukleSunucu,
  girisYapSunucu,
  mfaDogrulaSunucu,
  gorevDurumGuncelleSunucu,
  gorevGetirSunucu,
  gorevOlusturSunucu,
  gorevTamamlaSunucu,
  konumGonderSunucu,
  konumIzniGetirSunucu,
  konumIzniGuncelleSunucu,
  mesaiDurumuGetirSunucu,
  mesaiDurumuGuncelleSunucu,
  personelAktiflikGuncelleSunucu,
  personelDuzenleSunucu,
  personelEkleSunucu,
  personelGetirSunucu,
  personelDurumlariSunucu,
  personelGorevleriniGetirSunucu,
  personelSilSunucu,
  sonKonumlariGetirSunucu,
  tumGorevleriGetirSunucu,
} from "./saha-server.server";

const OTURUM_COOKIE = "saha-oturum-token";
const MFA_ADAY_COOKIE = "saha-mfa-aday";

function guvenliCookie(maxAge: number, _mfaAday = false) {
  return {
    httpOnly: true,
    secure: true,
    // Lovable sunucu fonksiyonları uygulamadan farklı site bağlamında çalışabildiği için
    // Lax çerez sonraki API isteğinde taşınmıyor. SameSite=None zorunludur; siteler arası
    // yazma istekleri src/start.ts içindeki CSRF middleware tarafından reddedilir.
    sameSite: "none" as const,
    path: "/",
    maxAge,
  };
}

// CSRF koruması src/start.ts içindeki createCsrfMiddleware tarafından yapılır.
// Elle origin karşılaştırması yapılmaz: proxy/iframe (Lovable preview) arkasında
// istek origin'i ile sunucunun gördüğü host farklı olduğu için tüm çağrılar kırılıyordu.
function ayniOriginDogrula() {}

function oturumTokeni() {
  ayniOriginDogrula();
  return getCookie(OTURUM_COOKIE) ?? "";
}

async function girisKaynagiHmac(kaynak: string) {
  const secret = process.env["SAHA_SESSION_SECRET"];
  if (!secret || secret.length < 32) {
    throw new Error("SAHA_SESSION_SECRET yapılandırılmamış.");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const imza = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`giris-kaynagi:${kaynak}`),
  );
  return Array.from(new Uint8Array(imza), (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export const girisYapFn = createServerFn({ method: "POST" })
  .validator((d) =>
    z.object({ telefon: z.string().min(3).max(30), pin: z.string().min(3).max(12) }).parse(d),
  )
  .handler(async ({ data }) => {
    ayniOriginDogrula();
    const kaynak = getRequestIP({ xForwardedFor: true }) ?? "bilinmeyen";
    const kaynakOzeti = await girisKaynagiHmac(kaynak);
    const sonuc = await girisYapSunucu(data.telefon, data.pin, kaynakOzeti);
    if (sonuc.mfaGerekli) {
      setCookie(MFA_ADAY_COOKIE, sonuc.mfaAdayToken, guvenliCookie(5 * 60, true));
      return { mfaGerekli: true as const, kurulum: sonuc.kurulum };
    }
    setCookie(OTURUM_COOKIE, sonuc.token, guvenliCookie(12 * 60 * 60));
    return { mfaGerekli: false as const, personel: sonuc.personel };
  });

export const mfaDogrulaFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ kod: z.string().regex(/^(?:\d{6}|[A-Z0-9]{4}-?[A-Z0-9]{4})$/i) }).parse(d))
  .handler(async ({ data }) => {
    ayniOriginDogrula();
    const { personel, token, kurtarmaKodlari } = await mfaDogrulaSunucu(getCookie(MFA_ADAY_COOKIE) ?? "", data.kod);
    setCookie(OTURUM_COOKIE, token, guvenliCookie(12 * 60 * 60));
    deleteCookie(MFA_ADAY_COOKIE, { path: "/" });
    return { personel, kurtarmaKodlari };
  });

export const cikisYapFn = createServerFn({ method: "POST" }).handler(() => {
  ayniOriginDogrula();
  deleteCookie(OTURUM_COOKIE, { path: "/" });
  deleteCookie(MFA_ADAY_COOKIE, { path: "/" });
  return { ok: true };
});

export const bloklariGetirFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(() => bloklariGetirSunucu(oturumTokeni()));

export const personelGetirFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(() => personelGetirSunucu(oturumTokeni()));

export const mesaiDurumuGuncelleFn = createServerFn({ method: "POST" })
  .validator((d) =>
    z.object({ token: z.string().min(10), durum: z.enum(["calisiyor", "molada"]) }).parse(d),
  )
  .handler(({ data }) => mesaiDurumuGuncelleSunucu(oturumTokeni(), data.durum));

export const mesaiDurumuGetirFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(() => mesaiDurumuGetirSunucu(oturumTokeni()));

export const personelDurumlariFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(() => personelDurumlariSunucu(oturumTokeni()));

export const sonKonumlariGetirFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(() => sonKonumlariGetirSunucu(oturumTokeni()));

export const konumGonderFn = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        token: z.string().min(10),
        enlem: z.number().finite().min(-90).max(90),
        boylam: z.number().finite().min(-180).max(180),
        dogruluk: z.number().finite().min(0).max(100_000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(({ data }) => konumGonderSunucu(oturumTokeni(), data));

export const konumIzniGetirFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(() => konumIzniGetirSunucu(oturumTokeni()));

export const konumIzniGuncelleFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ token: z.string().min(10), izinVerildi: z.boolean() }).parse(d))
  .handler(({ data }) => konumIzniGuncelleSunucu(oturumTokeni(), data.izinVerildi));

export const tumGorevleriGetirFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(() => tumGorevleriGetirSunucu(oturumTokeni()));

export const personelGorevleriniGetirFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(() => personelGorevleriniGetirSunucu(oturumTokeni()));

export const gorevGetirFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ token: z.string().min(10), id: z.string().uuid() }).parse(d))
  .handler(({ data }) => gorevGetirSunucu(oturumTokeni(), data.id));

export const gorevOlusturFn = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        token: z.string().min(10),
        blok_id: z.string().uuid(),
        personel_id: z.string().uuid(),
        is_basligi: z.string().min(1).max(200),
        aciklama: z.string().max(2000),
        aciliyet: z.enum(["normal", "acil"]),
        planlanan_tarih: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        is_turu: z.enum([
          "peyzaj",
          "bakim",
          "temizlik",
          "guvenlik",
          "elektrik",
          "sihhi_tesisat",
          "tadilat",
          "genel",
        ]),
      })
      .parse(d),
  )
  .handler(({ data }) =>
    gorevOlusturSunucu(oturumTokeni(), {
      blok_id: data.blok_id,
      personel_id: data.personel_id,
      is_basligi: data.is_basligi,
      aciklama: data.aciklama,
      aciliyet: data.aciliyet,
      is_turu: data.is_turu,
      planlanan_tarih: data.planlanan_tarih,
    }),
  );

export const gorevDurumGuncelleFn = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        token: z.string().min(10),
        id: z.string().uuid(),
        durum: z.enum(["bekliyor", "devam_ediyor"]),
      })
      .parse(d),
  )
  .handler(({ data }) => gorevDurumGuncelleSunucu(oturumTokeni(), data.id, data.durum));

export const fotoYukleFn = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        token: z.string().min(10),
        gorevId: z.string().uuid(),
        base64: z.string().min(1).max(15_000_000),
        contentType: z.string().max(100),
        uzanti: z.string().regex(/^[a-zA-Z0-9]{1,5}$/),
      })
      .parse(d),
  )
  .handler(({ data }) => fotoYukleSunucu(oturumTokeni(), data));

export const fotoUrlAlFn = createServerFn({ method: "POST" })
  .validator((d) =>
    z.object({ token: z.string().min(10), yol: z.string().min(3).max(300) }).parse(d),
  )
  .handler(({ data }) => fotoUrlAlSunucu(oturumTokeni(), data.yol));

export const gorevTamamlaFn = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        token: z.string().min(10),
        gorevId: z.string().uuid(),
        fotoYolu: z.string().min(3).max(300),
        not: z.string().max(2000),
      })
      .parse(d),
  )
  .handler(({ data }) => gorevTamamlaSunucu(oturumTokeni(), data));
export const personelEkleFn = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        token: z.string().min(10),
        ad_soyad: z.string().min(2).max(120),
        telefon: z.string().min(10).max(20),
        pin_kodu: z.string().regex(/^\d{4}$/),
      })
      .parse(d),
  )
  .handler(({ data }) =>
    personelEkleSunucu(oturumTokeni(), {
      ad_soyad: data.ad_soyad,
      telefon: data.telefon,
      pin_kodu: data.pin_kodu,
    }),
  );

export const personelAktiflikGuncelleFn = createServerFn({ method: "POST" })
  .validator((d) =>
    z.object({ token: z.string().min(10), id: z.string().uuid(), aktif: z.boolean() }).parse(d),
  )
  .handler(({ data }) => personelAktiflikGuncelleSunucu(oturumTokeni(), data.id, data.aktif));

export const personelDuzenleFn = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        token: z.string().min(10),
        id: z.string().uuid(),
        ad_soyad: z.string().min(2).max(120),
        telefon: z.string().min(10).max(20),
        // Hedef rol sunucuda veritabanından doğrulanır: personel 4, yönetici 6-8 hane.
        pin_kodu: z.string().regex(/^\d{4,8}$/).optional(),
        aktif: z.boolean(),
      })
      .parse(d),
  )
  .handler(({ data }) => personelDuzenleSunucu(oturumTokeni(), data));

export const personelSilFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ token: z.string().min(10), id: z.string().uuid() }).parse(d))
  .handler(({ data }) => personelSilSunucu(oturumTokeni(), data.id));

export const auditLoglariGetirFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(() => auditLoglariGetirSunucu(oturumTokeni()));
