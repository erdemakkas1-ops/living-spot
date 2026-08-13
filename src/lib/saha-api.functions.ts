import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  auditLoglariGetirSunucu,
  bloklariGetirSunucu,
  fotoUrlAlSunucu,
  fotoYukleSunucu,
  girisYapSunucu,
  gorevDurumGuncelleSunucu,
  gorevGetirSunucu,
  gorevOlusturSunucu,
  gorevTamamlaSunucu,
  konumGonderSunucu,
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

// CSRF koruması src/start.ts içindeki createCsrfMiddleware tarafından yapılır.
// Elle origin karşılaştırması yapılmaz: proxy/iframe (Lovable preview) arkasında
// istek origin'i ile sunucunun gördüğü host farklı olduğu için tüm çağrılar kırılıyordu.
function ayniOriginDogrula() {}

function oturumTokeni() {
  ayniOriginDogrula();
  return getCookie(OTURUM_COOKIE) ?? "";
}

export const girisYapFn = createServerFn({ method: "POST" })
  .validator((d) =>
    z.object({ telefon: z.string().min(3).max(30), pin: z.string().min(3).max(12) }).parse(d),
  )
  .handler(async ({ data }) => {
    ayniOriginDogrula();
    const { personel, token } = await girisYapSunucu(data.telefon, data.pin);
    setCookie(OTURUM_COOKIE, token, {
      httpOnly: true,
      secure: true,
      // Uygulama Lovable önizlemesinde iframe (cross-site) içinde çalışır; Lax
      // olduğunda çerez isteklere hiç eklenmediği için oturum hemen düşüyordu.
      // SameSite=None + Secure her ortamda kullanılır (localhost güvenli sayılır).
      sameSite: "none",
      path: "/",
      maxAge: 12 * 60 * 60,
    });
    return { personel };
  });

export const cikisYapFn = createServerFn({ method: "POST" }).handler(() => {
  ayniOriginDogrula();
  deleteCookie(OTURUM_COOKIE, { path: "/" });
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
        enlem: z.number(),
        boylam: z.number(),
        dogruluk: z.number().nullable().optional(),
      })
      .parse(d),
  )
  .handler(({ data }) => konumGonderSunucu(oturumTokeni(), data));

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
