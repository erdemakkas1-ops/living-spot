import { Download, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

interface KurulumIstemi extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaYoneticisi() {
  const [kurulumIstemi, setKurulumIstemi] = useState<KurulumIstemi | null>(null);
  const [guncelleme, setGuncelleme] = useState<ServiceWorkerRegistration | null>(null);
  const [gizlendi, setGizlendi] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const kurulumYakala = (event: Event) => {
      event.preventDefault();
      setKurulumIstemi(event as KurulumIstemi);
    };
    window.addEventListener("beforeinstallprompt", kurulumYakala);

    let kayit: ServiceWorkerRegistration | undefined;
    void navigator.serviceWorker.register("/sw.js").then((registration) => {
      kayit = registration;
      if (registration.waiting) setGuncelleme(registration);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            setGuncelleme(registration);
          }
        });
      });
    });

    const yenidenYukle = () => window.location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", yenidenYukle);
    return () => {
      window.removeEventListener("beforeinstallprompt", kurulumYakala);
      navigator.serviceWorker.removeEventListener("controllerchange", yenidenYukle);
      kayit = undefined;
    };
  }, []);

  if (guncelleme) {
    return (
      <div className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border bg-card p-3 shadow-xl">
        <RefreshCw className="h-5 w-5 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-sm font-semibold">Yeni sürüm hazır.</p>
        <Button size="sm" onClick={() => guncelleme.waiting?.postMessage({ type: "SKIP_WAITING" })}>
          Yenile
        </Button>
      </div>
    );
  }

  if (!kurulumIstemi || gizlendi) return null;
  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border bg-card p-3 shadow-xl">
      <Download className="h-5 w-5 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-sm font-semibold">Saha Takip'i telefona yükleyin.</p>
      <Button
        size="sm"
        onClick={async () => {
          await kurulumIstemi.prompt();
          const sonuc = await kurulumIstemi.userChoice;
          if (sonuc.outcome === "accepted") setKurulumIstemi(null);
        }}
      >
        Yükle
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Kurulum önerisini kapat"
        onClick={() => setGizlendi(true)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
