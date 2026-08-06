import { useEffect, useRef, useState } from "react";

import { konumGonder } from "./saha-api";

const ARALIK_MS = 60_000;

export type KonumDurum = "kapali" | "bekleniyor" | "aktif" | "izin_yok" | "hata";

/** Saha personelinin konumunu periyodik olarak yönetim paneline gönderir. */
export function useKonumPaylas(personelId: string | undefined, aktif: boolean) {
  const [durum, setDurum] = useState<KonumDurum>("kapali");
  const sonGonderim = useRef(0);

  useEffect(() => {
    if (!aktif || !personelId) {
      setDurum("kapali");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setDurum("hata");
      return;
    }

    setDurum("bekleniyor");
    const izleyici = navigator.geolocation.watchPosition(
      (pos) => {
        setDurum("aktif");
        const simdi = Date.now();
        if (simdi - sonGonderim.current < ARALIK_MS) return;
        sonGonderim.current = simdi;
        void konumGonder({
          personel_id: personelId,
          enlem: pos.coords.latitude,
          boylam: pos.coords.longitude,
          dogruluk: pos.coords.accuracy,
        }).catch(() => setDurum("hata"));
      },
      (err) => setDurum(err.code === err.PERMISSION_DENIED ? "izin_yok" : "hata"),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    );

    return () => navigator.geolocation.clearWatch(izleyici);
  }, [aktif, personelId]);

  return durum;
}
