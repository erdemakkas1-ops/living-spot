import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Building,
  CheckCircle,
  ChevronRight,
  Clock,
  Coffee,
  HardHat,
  LogOut,
  MapPin,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { BaglantiRozeti } from "@/components/baglanti-rozeti";
import { IsTuruRozeti } from "@/components/is-turu-rozeti";
import { PersonelDurumCubugu } from "@/components/personel-durum-cubugu";
import {
  mesaiDurumuGetir,
  mesaiDurumuGuncelle,
  konumIzniGetir,
  konumIzniGuncelle,
  guvenliCikisYap,
  personelGorevleriniGetir,
  tumGorevleriGetir,
} from "@/lib/saha-api";
import { useOturum } from "@/lib/saha-session";
import { useKonumPaylas } from "@/lib/konum-takip";
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
  const qc = useQueryClient();

  const cikisYap = async () => {
    await guvenliCikisYap();
    qc.clear();
    navigate({ to: "/" });
  };

  useEffect(() => {
    if (hazir && !kullanici) navigate({ to: "/" });
  }, [hazir, kullanici, navigate]);

  const onizleme = kullanici?.rol === "ik";

  const gorevler = useQuery({
    queryKey: ["gorevlerim", kullanici?.id, onizleme],
    queryFn: () => (onizleme ? tumGorevleriGetir() : personelGorevleriniGetir(kullanici?.id)),
    enabled: !!kullanici,
  });

  const liste = gorevler.data ?? [];
  const acikIsler = liste.filter((g) => g.durum !== "tamamlandi");
  const bitenIsler = liste.filter((g) => g.durum === "tamamlandi");

  const [mesai, setMesai] = useState<MesaiDurumu>("calisiyor");
  const [izinKaydediliyor, setIzinKaydediliyor] = useState(false);
  useEffect(() => {
    if (!kullanici?.id || onizleme) return;
    void mesaiDurumuGetir(kullanici.id)
      .then(setMesai)
      .catch(() => setMesai("calisiyor"));
  }, [kullanici?.id, onizleme]);

  const konumIzni = useQuery({
    queryKey: ["konum-izni", kullanici?.id],
    queryFn: konumIzniGetir,
    enabled: Boolean(kullanici?.id && !onizleme),
  });

  const izinDegistir = async (izinVerildi: boolean) => {
    setIzinKaydediliyor(true);
    try {
      await konumIzniGuncelle(izinVerildi);
      qc.setQueryData(["konum-izni", kullanici?.id], izinVerildi);
    } finally {
      setIzinKaydediliyor(false);
    }
  };

  const molaDegistir = () => {
    if (!kullanici?.id) return;
    const yeni: MesaiDurumu = mesai === "molada" ? "calisiyor" : "molada";
    setMesai(yeni);
    void mesaiDurumuGuncelle(kullanici.id, yeni).catch(() => setMesai(mesai));
  };

  // Konum paylaşımı yalnızca mesai sürerken aktiftir.
  const konumDurum = useKonumPaylas(
    kullanici?.id,
    !!kullanici && !onizleme && mesai === "calisiyor" && konumIzni.data === true,
  );
  const konumEtiket =
    konumDurum === "aktif"
      ? "Konum paylaşımı açık"
      : konumDurum === "bekleniyor"
        ? "Konum alınıyor..."
        : konumDurum === "izin_yok"
          ? "Konum izni verilmedi"
          : konumDurum === "hata"
            ? "Konum alınamadı"
            : "Konum paylaşımı kapalı";

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="bg-gradient-navy px-4 pt-6 pb-8">
        <div className="mx-auto grid max-w-lg grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-navy-foreground/70">
              {onizleme ? "Saha Ekranı (İK Önizleme)" : "Saha Personeli"}
            </p>
            <h1 className="truncate text-xl font-bold text-navy-foreground">
              {kullanici?.ad_soyad}
            </h1>
            <div className="mt-2">
              <BaglantiRozeti className="bg-navy-foreground/10 text-navy-foreground" />
            </div>
            {!onizleme && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-navy-foreground/70">
                <MapPin
                  className={`h-3.5 w-3.5 ${konumDurum === "aktif" ? "text-status-tamam" : ""}`}
                />
                {konumEtiket}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {onizleme ? (
              <Button variant="secondary" size="sm" onClick={() => navigate({ to: "/panel" })}>
                Panele Dön
              </Button>
            ) : (
              <>
                <Button
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={cikisYap}
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
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-4 max-w-lg px-4">
        {!onizleme && konumIzni.isSuccess && !konumIzni.data && (
          <section className="mb-4 rounded-2xl border border-primary/20 bg-card p-4 shadow-card">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <h2 className="font-bold">Konum paylaşımı onayı</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Konumunuz yalnız çalıştığınız sırada görev koordinasyonu ve güvenlik amacıyla,
                  yaklaşık dakikada bir paylaşılır. Kayıtlar en fazla 30 gün saklanır. Onayı
                  istediğiniz zaman geri çekebilirsiniz.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" disabled={izinKaydediliyor} onClick={() => void izinDegistir(true)}>
                    Konum paylaşımına izin ver
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/kvkk">Aydınlatma metni</Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}
        {!onizleme && konumIzni.data === true && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 text-xs shadow-card">
            <span className="text-muted-foreground">Konum paylaşımı onayınız kayıtlıdır.</span>
            <Button size="sm" variant="ghost" disabled={izinKaydediliyor} onClick={() => void izinDegistir(false)}>
              Onayı geri çek
            </Button>
          </div>
        )}
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

        {onizleme && <PersonelDurumCubugu />}

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
