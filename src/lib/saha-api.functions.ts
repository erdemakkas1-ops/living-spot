import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
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
  personelEkleSunucu,
  personelGetirSunucu,
  personelGorevleriniGetirSunucu,
  personelSilSunucu,
  sonKonumlariGetirSunucu,
  tumGorevleriGetirSunucu,
} from "./saha-server.server";

export const girisYapFn = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({ telefon: z.string().min(3).max(30), pin: z.string().min(3).max(12) })
      .parse(d),
  )
  .handler(({ data }) => girisYapSunucu(data.telefon, data.pin));

export const bloklariGetirFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(({ data }) => bloklariGetirSunucu(data.token));

export const personelGetirFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(({ data }) => personelGetirSunucu(data.token));

export const mesaiDurumuGuncelleFn = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({ token: z.string().min(10), durum: z.enum(["calisiyor", "molada"]) })
      .parse(d),
  )
  .handler(({ data }) => mesaiDurumuGuncelleSunucu(data.token, data.durum));

export const mesaiDurumuGetirFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(({ data }) => mesaiDurumuGetirSunucu(data.token));

export const personelDurumlariFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => ({
    personeller: await personelGetirSunucu(data.token),
    konumlar: await sonKonumlariGetirSunucu(data.token),
  }));

export const sonKonumlariGetirFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(({ data }) => sonKonumlariGetirSunucu(data.token));

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
  .handler(({ data }) => konumGonderSunucu(data.token, data));

export const tumGorevleriGetirFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(({ data }) => tumGorevleriGetirSunucu(data.token));

export const personelGorevleriniGetirFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(({ data }) => personelGorevleriniGetirSunucu(data.token));

export const gorevGetirFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ token: z.string().min(10), id: z.string().uuid() }).parse(d))
  .handler(({ data }) => gorevGetirSunucu(data.token, data.id));

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
    gorevOlusturSunucu(data.token, {
      blok_id: data.blok_id,
      personel_id: data.personel_id,
      is_basligi: data.is_basligi,
      aciklama: data.aciklama,
      aciliyet: data.aciliyet,
      is_turu: data.is_turu,
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
  .handler(({ data }) => gorevDurumGuncelleSunucu(data.token, data.id, data.durum));

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
  .handler(({ data }) => fotoYukleSunucu(data.token, data));

export const fotoUrlAlFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ token: z.string().min(10), yol: z.string().min(3).max(300) }).parse(d))
  .handler(({ data }) => fotoUrlAlSunucu(data.token, data.yol));

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
  .handler(({ data }) => gorevTamamlaSunucu(data.token, data));
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
    personelEkleSunucu(data.token, {
      ad_soyad: data.ad_soyad,
      telefon: data.telefon,
      pin_kodu: data.pin_kodu,
    }),
  );

export const personelAktiflikGuncelleFn = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({ token: z.string().min(10), id: z.string().uuid(), aktif: z.boolean() })
      .parse(d),
  )
  .handler(({ data }) => personelAktiflikGuncelleSunucu(data.token, data.id, data.aktif));

export const personelSilFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ token: z.string().min(10), id: z.string().uuid() }).parse(d))
  .handler(({ data }) => personelSilSunucu(data.token, data.id));
