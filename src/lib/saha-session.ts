import { useEffect, useState } from "react";
import type { Personel } from "./saha-types";

const KEY = "saha-oturum";
const TOKEN_KEY = "saha-token";
const SEBEP_KEY = "saha-oturum-sebep";

export const OTURUM_SURESI_DOLDU = "Oturum süreniz doldu. Lütfen tekrar giriş yapın.";

export function tokenOku(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TOKEN_KEY) ?? "";
}

export function tokenYaz(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function oturumOku(): Personel | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    // Oturum kaydı olsa da imzalı token yoksa (eski sürümden kalan kayıt)
    // oturum geçersizdir; yeniden PIN girişi gerekir.
    if (!window.localStorage.getItem(TOKEN_KEY)) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return JSON.parse(raw) as Personel;
  } catch {
    return null;
  }
}

export function oturumYaz(p: Personel) {
  window.localStorage.setItem(KEY, JSON.stringify(p));
  window.dispatchEvent(new Event("saha-oturum-degisti"));
}

export function oturumSil() {
  if (typeof window === "undefined") return;
  try {
    // Uygulamaya ait tüm yerel oturum verileri temizlenir.
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith("saha-"))
      .forEach((k) => window.localStorage.removeItem(k));
    window.sessionStorage.removeItem(SEBEP_KEY);
  } catch {
    /* yoksay */
  }
  window.dispatchEvent(new Event("saha-oturum-degisti"));
}

/**
 * Yetkisiz / süresi dolmuş sunucu yanıtında çağrılır: yerel oturumu temizler,
 * giriş ekranında gösterilecek bildirimi bırakır ve kullanıcıyı yönlendirir.
 */
export function oturumSonlandir(mesaj = OTURUM_SURESI_DOLDU) {
  if (typeof window === "undefined") return;
  oturumSil();
  try {
    window.sessionStorage.setItem(SEBEP_KEY, mesaj);
  } catch {
    /* yoksay */
  }
  if (window.location.pathname !== "/") window.location.replace("/");
}

/** Giriş ekranı için bekleyen oturum bildirimini okur ve tüketir. */
export function oturumSebebiAl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const mesaj = window.sessionStorage.getItem(SEBEP_KEY);
    if (mesaj) window.sessionStorage.removeItem(SEBEP_KEY);
    return mesaj;
  } catch {
    return null;
  }
}

export function useOturum() {
  const [kullanici, setKullanici] = useState<Personel | null>(null);
  const [hazir, setHazir] = useState(false);

  useEffect(() => {
    const oku = () => setKullanici(oturumOku());
    oku();
    setHazir(true);
    window.addEventListener("saha-oturum-degisti", oku);
    window.addEventListener("storage", oku);
    return () => {
      window.removeEventListener("saha-oturum-degisti", oku);
      window.removeEventListener("storage", oku);
    };
  }, []);

  return { kullanici, hazir };
}

export function useCevrimici() {
  const [cevrimici, setCevrimici] = useState(true);
  useEffect(() => {
    const guncelle = () => setCevrimici(navigator.onLine);
    guncelle();
    window.addEventListener("online", guncelle);
    window.addEventListener("offline", guncelle);
    return () => {
      window.removeEventListener("online", guncelle);
      window.removeEventListener("offline", guncelle);
    };
  }, []);
  return cevrimici;
}