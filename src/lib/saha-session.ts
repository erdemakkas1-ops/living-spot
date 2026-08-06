import { useEffect, useState } from "react";
import type { Personel } from "./saha-types";

const KEY = "saha-oturum";
const TOKEN_KEY = "saha-token";

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
    return raw ? (JSON.parse(raw) as Personel) : null;
  } catch {
    return null;
  }
}

export function oturumYaz(p: Personel) {
  window.localStorage.setItem(KEY, JSON.stringify(p));
  window.dispatchEvent(new Event("saha-oturum-degisti"));
}

export function oturumSil() {
  window.localStorage.removeItem(KEY);
  window.localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event("saha-oturum-degisti"));
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