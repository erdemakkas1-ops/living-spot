import { useEffect, useState } from "react";
import { oturumKullanicisiGetirFn } from "./saha-session.functions";
import type { Personel } from "./saha-types";
import { cevrimdisiDepoyuTemizle } from "./cevrimdisi-depo";

const KEY = "saha-oturum";
const TOKEN_KEY = "saha-token";
const SEBEP_KEY = "saha-oturum-sebep";

export const OTURUM_SURESI_DOLDU = "Oturum süreniz doldu. Lütfen tekrar giriş yapın.";
export const HESAP_PASIF = "Hesabınız pasif durumda. Yönetimle iletişime geçin.";
export const OTURUM_GECERSIZ = "Oturum geçersiz. Lütfen tekrar giriş yapın.";

/**
 * Aynı origin (aynı alan adı) sekmeleri arasında oturum değişikliklerini
 * anında duyurur. BroadcastChannel origin ile sınırlıdır; Lovable Preview ile
 * canlı alan adı farklı origin olduğu için oturumlar birbirine karışmaz.
 * Kanaldan yalnızca "değişti" sinyali geçer; token/PIN gibi gizli veri geçmez.
 */
const KANAL_ADI = "saha-oturum";
let kanal: BroadcastChannel | null = null;
// Çıkış sırasında daha önce başlamış profil isteğinin kullanıcıyı yeniden yazmasını engeller.
let oturumNesli = 0;
function kanalAl(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  if (!kanal) kanal = new BroadcastChannel(KANAL_ADI);
  return kanal;
}

function degisikligiDuyur() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("saha-oturum-degisti"));
  try {
    kanalAl()?.postMessage("degisti");
  } catch {
    /* yoksay */
  }
}

export function oturumOku(): Personel | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const personel = JSON.parse(raw) as Personel;
    return personel;
  } catch {
    return null;
  }
}

export function oturumYaz(p: Personel) {
  // Eski sürümlerden kalan JavaScript-okunabilir tokenı temizle.
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.setItem(KEY, JSON.stringify(p));
  degisikligiDuyur();
}

export function oturumSil() {
  if (typeof window === "undefined") return;
  oturumNesli += 1;
  try {
    // Uygulamaya ait tüm yerel oturum verileri temizlenir.
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith("saha-"))
      .forEach((k) => window.localStorage.removeItem(k));
    window.sessionStorage.removeItem(SEBEP_KEY);
  } catch {
    /* yoksay */
  }
  // Başka bir personel aynı cihazı kullandığında önceki kişiye ait görev/fotoğraf kalmasın.
  void cevrimdisiDepoyuTemizle();
  degisikligiDuyur();
}

/**
 * Yetkisiz / süresi dolmuş sunucu yanıtında çağrılır: yerel oturumu temizler,
 * giriş ekranında gösterilecek bildirimi bırakır ve kullanıcıyı yönlendirir.
 */
let yonlendiriliyor = false;

export function oturumSonlandir(mesaj = OTURUM_SURESI_DOLDU) {
  if (typeof window === "undefined") return;
  // Aynı sayfa yaşam döngüsünde tek yönlendirme yapılır (yenileme döngüsü olmasın).
  if (yonlendiriliyor) return;
  yonlendiriliyor = true;
  oturumSil();
  try {
    window.sessionStorage.setItem(SEBEP_KEY, mesaj);
  } catch {
    /* yoksay */
  }
  // Giriş ekranına tam sayfa yönlendirme: askıda kalan istekler ve boş render
  // ağacı temizlenir, böylece beyaz ekran yerine PIN formu görünür.
  if (window.location.pathname !== "/") window.location.replace("/");
  else window.location.reload();
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
    let aktif = true;
    let istekNo = 0;
    const dogrula = async () => {
      const buIstek = ++istekNo;
      const baslangicNesli = oturumNesli;
      try {
        const sunucuKullanicisi = (await oturumKullanicisiGetirFn()) as Personel | null;
        if (!aktif || buIstek !== istekNo || baslangicNesli !== oturumNesli) return;
        if (!sunucuKullanicisi) {
          window.localStorage.removeItem(KEY);
          window.localStorage.removeItem(TOKEN_KEY);
          setKullanici(null);
          return;
        }
        window.localStorage.removeItem(TOKEN_KEY);
        window.localStorage.setItem(KEY, JSON.stringify(sunucuKullanicisi));
        setKullanici(sunucuKullanicisi);
      } catch (hata) {
        if (!aktif || buIstek !== istekNo) return;
        const mesaj = hata instanceof Error ? hata.message : String(hata);
        const oturumYok =
          mesaj.includes("Oturum geçersiz") ||
          mesaj.includes("Oturum bulunamadı") ||
          mesaj.includes("süresi dolmuş") ||
          mesaj.includes("Unauthorized");
        if (oturumYok) {
          window.localStorage.removeItem(KEY);
          window.localStorage.removeItem(TOKEN_KEY);
          setKullanici(null);
        } else {
          // Geçici bağlantı hatasında çevrimdışı görünüm için son güvenilir profil korunur.
          setKullanici(oturumOku());
        }
      } finally {
        if (aktif && buIstek === istekNo) setHazir(true);
      }
    };
    const okuVeDogrula = () => {
      setKullanici(oturumOku());
      void dogrula();
    };
    void dogrula();
    window.addEventListener("saha-oturum-degisti", okuVeDogrula);
    window.addEventListener("storage", okuVeDogrula);
    // Sekme yeniden öne geldiğinde oturum durumu tazelenir.
    window.addEventListener("focus", okuVeDogrula);
    document.addEventListener("visibilitychange", okuVeDogrula);
    const bc = kanalAl();
    if (bc) bc.addEventListener("message", okuVeDogrula);
    return () => {
      aktif = false;
      window.removeEventListener("saha-oturum-degisti", okuVeDogrula);
      window.removeEventListener("storage", okuVeDogrula);
      window.removeEventListener("focus", okuVeDogrula);
      document.removeEventListener("visibilitychange", okuVeDogrula);
      if (bc) bc.removeEventListener("message", okuVeDogrula);
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
