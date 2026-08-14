import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getCookie } from "@tanstack/react-start/server";

import { oturumKullanicisiGetirSunucu } from "./saha-server.server";

const OTURUM_COOKIE = "saha-oturum-token";

export const oturumKullanicisiGetirFn = createServerFn({ method: "POST" }).handler(async () => {
  try {
    return await oturumKullanicisiGetirSunucu(getCookie(OTURUM_COOKIE) ?? "");
  } catch (hata) {
    const mesaj = hata instanceof Error ? hata.message : String(hata);
    if (
      mesaj.includes("Oturum geçersiz") ||
      mesaj.includes("Oturum bulunamadı") ||
      mesaj.includes("süresi dolmuş")
    ) {
      // Anahtar rotasyonu veya süre aşımından kalan HttpOnly çerezi sunucuda
      // temizle; beklenen oturum kaybını geliştirme ekranında runtime hatasına çevirme.
      deleteCookie(OTURUM_COOKIE, { path: "/", secure: true, sameSite: "none" });
      return null;
    }
    throw hata;
  }
});
