import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Building,
  CheckCircle,
  ChevronRight,
  Clock,
  Coffee,
  HardHat,
  LogOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { BaglantiRozeti } from "@/components/baglanti-rozeti";
import { IsTuruRozeti } from "@/components/is-turu-rozeti";
import {
  mesaiDurumuGetir,
  mesaiDurumuGuncelle,
  personelGorevleriniGetir,
} from "@/lib/saha-api";
import { oturumSil, useOturum } from "@/lib/saha-session";
import { DURUM_ETIKET, DURUM_SINIF, type MesaiDurumu } from "@/lib/saha-types";

export const Route = createFileRoute("/saha/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Görevlerim | Saha Personeli" },
      {
        name: "description",
        content:
          "Saha personeli için günlük görev listesi: blok, iş tanımı, aciliyet etiketi ve iş kapama akışı.",
      },
      { property: "og:title", content: "Görevlerim | Saha Personeli" },
      {
        property: "og:description",
        content: "Günlük saha görevlerini görüntüle, fotoğraf yükle ve işi kapat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SahaListesi,
});

function SahaListesi() {
  const navigate = useNavigate();
  const { kullanici, hazir } = useOturum();

  useEffect(() => {
    if (hazir && !kullanici) navigate({ to: "/" });
    if (hazir && kullanici?.rol === "ik") navigate({ to: "/panel" });
  }, [hazir, kullanici, navigate]);

  const gorevler = useQuery({
    queryKey: ["gorevlerim", kullanici?.id],
    queryFn: () => personelGorevleriniGetir(kullanici?.id),
    enabled: !!kullanici,
  });

  const liste = gorevler.data ?? [];
  const acikIsler = liste.filter((g) => g.durum !== "tamamlandi");
  const bitenIsler = liste.filter((g) => g.durum === "tamamlandi");

  const [mesai, setMesai] = useState<MesaiDurumu>("calisiyor");
  useEffect(() => {
    if (!kullanici?.id) return;
    void mesaiDurumuGetir(kullanici.id)
      .then(setMesai)
      .catch(() => setMesai("calisiyor"));
  }, [kullanici?.id]);

  const molaDegistir = () => {
    if (!kullanici?.id) return;
    const yeni: MesaiDurumu = mesai === "molada" ? "calisiyor" : "molada";
    setMesai(yeni);
    void mesaiDurumuGuncelle(kullanici.id, yeni).catch(() => setMesai(mesai));
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="bg-gradient-navy px-4 pt-6 pb-8">
        <div className="mx-auto grid max-w-lg grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-navy-foreground/70">Saha Personeli</p>
            <h1 className="truncate text-xl font-bold text-navy-foreground">
              {kullanici?.ad_soyad}
            </h1>
            <div className="mt-2">
              <BaglantiRozeti className="bg-navy-foreground/10 text-navy-foreground" />
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => {
                oturumSil();
                navigate({ to: "/" });
              }}
            >
              <LogOut className="h-4 w-4" />
              Çıkış
            </Button>
            <Button
              size="sm"
              variant={mesai === "molada" ? "default" : "outline"}
              className={
                mesai === "molada"
                  ? "shrink-0"
                  : "shrink-0 border-navy-foreground/30 bg-transparent text-navy-foreground hover:bg-navy-foreground/10"
              }
              onClick={molaDegistir}
            >
              {mesai === "molada" ? (
                <>
                  <HardHat className="h-4 w-4" />
                  İşe Dön
                </>
              ) : (
                <>
                  <Coffee className="h-4 w-4" />
                  Molaya Çık
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-4 max-w-lg px-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-card p-4 shadow-card">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Açık İş
            </span>
            <p className="mt-1 text-3xl font-bold">{acikIsler.length}</p>
          </div>
          <div className="rounded-2xl bg-card p-4 shadow-card">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <CheckCircle className="h-3.5 w-3.5" /> Tamamlanan
            </span>
            <p className="mt-1 text-3xl font-bold">{bitenIsler.length}</p>
          </div>
        </div>

        <h2 className="mt-7 mb-3 flex items-center gap-2 text-base font-bold">
          <HardHat className="h-4 w-4 text-primary" />
          Günlük Görev Listem
        </h2>

        {gorevler.isLoading && (
          <p className="py-8 text-center text-sm text-muted-foreground">Görevler yükleniyor...</p>
        )}

        {!gorevler.isLoading && liste.length === 0 && (
          <p className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
            Şu anda üzerinize atanmış görev bulunmuyor.
          </p>
        )}

        <ul className="space-y-3">
          {[...acikIsler, ...bitenIsler].map((g) => (
            <li key={g.id}>
              <Link
                to="/saha/$gorevId"
                params={{ gorevId: g.id }}
                className="block rounded-2xl bg-card p-4 shadow-card transition-transform active:scale-[0.99]"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                        <Building className="h-3.5 w-3.5" />
                        {g.bloklar?.blok_adi}
                      </span>
                      <IsTuruRozeti turu={g.is_turu} />
                    </div>
                    <p className="mt-1 text-base leading-snug font-bold">{g.is_basligi}</p>
                    {g.aciklama && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {g.aciklama}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${DURUM_SINIF[g.durum]}`}
                  >
                    {DURUM_ETIKET[g.durum]}
                  </span>
                  {g.aciliyet === "acil" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/12 px-2.5 py-1 text-xs font-bold text-destructive">
                      <AlertCircle className="h-3.5 w-3.5" /> ACİL
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}