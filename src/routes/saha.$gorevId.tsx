import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Building,
  Camera,
  CheckCircle,
  Play,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BaglantiRozeti } from "@/components/baglanti-rozeti";
import { IsTuruRozeti } from "@/components/is-turu-rozeti";
import { gorevDurumGuncelle, gorevGetir, gorevTamamla, fotoYukle } from "@/lib/saha-api";
import { useOturum } from "@/lib/saha-session";
import { DURUM_ETIKET, DURUM_SINIF } from "@/lib/saha-types";

export const Route = createFileRoute("/saha/$gorevId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Görev Detayı | Saha İş Takip" },
      {
        name: "description",
        content:
          "Görevi başlat, sahadan fotoğraf yükle, notunu yaz ve işi tamamla. Fotoğraf olmadan görev kapatılamaz.",
      },
      { property: "og:title", content: "Görev Detayı | Saha İş Takip" },
      {
        property: "og:description",
        content: "İşe başla, fotoğraf ve not ekle, görevi tamamla.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GorevDetay,
});

function GorevDetay() {
  const { gorevId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { kullanici, hazir } = useOturum();
  const dosyaRef = useRef<HTMLInputElement>(null);

  const [foto, setFoto] = useState<File | null>(null);
  const [onizleme, setOnizleme] = useState<string | null>(null);
  const [not, setNot] = useState("");

  useEffect(() => {
    if (hazir && !kullanici) navigate({ to: "/" });
  }, [hazir, kullanici, navigate]);

  useEffect(() => {
    if (!foto) {
      setOnizleme(null);
      return;
    }
    const url = URL.createObjectURL(foto);
    setOnizleme(url);
    return () => URL.revokeObjectURL(url);
  }, [foto]);

  const gorev = useQuery({
    queryKey: ["gorev", gorevId],
    queryFn: () => gorevGetir(gorevId),
  });

  const basla = useMutation({
    mutationFn: () => gorevDurumGuncelle(gorevId, "devam_ediyor"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gorev", gorevId] });
      qc.invalidateQueries({ queryKey: ["gorevlerim"] });
      toast.success("İşe başladınız.");
    },
    onError: () => toast.error("Durum güncellenemedi."),
  });

  const tamamla = useMutation({
    mutationFn: async () => {
      if (!foto) throw new Error("Fotoğraf zorunludur.");
      const yol = await fotoYukle(gorevId, foto);
      await gorevTamamla({ gorevId, fotoYolu: yol, not: not.trim().slice(0, 1000) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gorev", gorevId] });
      qc.invalidateQueries({ queryKey: ["gorevlerim"] });
      toast.success("Görev tamamlandı ve yönetime bildirildi.");
      navigate({ to: "/saha" });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Görev tamamlanamadı."),
  });

  const g = gorev.data;
  const tamamlandi = g?.durum === "tamamlandi";

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="bg-gradient-navy px-4 pt-5 pb-7">
        <div className="mx-auto max-w-lg">
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate({ to: "/saha" })}
            >
              <ArrowLeft className="h-4 w-4" />
              Geri
            </Button>
            <BaglantiRozeti className="bg-navy-foreground/10 text-navy-foreground" />
          </div>
          {g && (
            <div className="mt-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-navy-foreground/80">
                <Building className="h-3.5 w-3.5" />
                {g.bloklar?.blok_adi}
              </span>
              <h1 className="mt-1 text-xl leading-snug font-bold text-navy-foreground">
                {g.is_basligi}
              </h1>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto -mt-3 max-w-lg space-y-4 px-4">
        {gorev.isLoading && (
          <p className="py-10 text-center text-sm text-muted-foreground">Yükleniyor...</p>
        )}

        {!gorev.isLoading && !g && (
          <p className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
            Görev bulunamadı.
          </p>
        )}

        {g && (
          <>
            <section className="rounded-2xl bg-card p-4 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <IsTuruRozeti turu={g.is_turu} />
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
              <p className="mt-3 text-sm leading-relaxed">
                {g.aciklama || "Ek açıklama girilmemiş."}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Atama: {new Date(g.olusturma_tarihi).toLocaleString("tr-TR")}
              </p>
            </section>

            {g.durum === "bekliyor" && (
              <Button
                onClick={() => basla.mutate()}
                disabled={basla.isPending}
                className="h-16 w-full text-base font-bold"
              >
                <Play className="h-5 w-5" />
                İşe Başla
              </Button>
            )}

            {!tamamlandi && (
              <section className="rounded-2xl bg-card p-4 shadow-card">
                <Label className="text-sm font-bold">Kameradan Fotoğraf Yükle</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Fotoğraf yüklenmeden görev kapatılamaz.
                </p>

                <input
                  ref={dosyaRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
                />

                {onizleme ? (
                  <div className="mt-3">
                    <img
                      src={onizleme}
                      alt="Yüklenecek saha fotoğrafı önizlemesi"
                      className="h-56 w-full rounded-xl object-cover"
                    />
                    <Button
                      variant="outline"
                      onClick={() => setFoto(null)}
                      className="mt-2 h-12 w-full"
                    >
                      <Trash2 className="h-4 w-4" />
                      Fotoğrafı Kaldır
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => dosyaRef.current?.click()}
                    className="mt-3 h-24 w-full flex-col gap-1 border-dashed text-base font-semibold"
                  >
                    <Camera className="h-7 w-7" />
                    Fotoğraf Çek / Seç
                  </Button>
                )}

                <div className="mt-4 space-y-2">
                  <Label htmlFor="not" className="text-sm font-bold">
                    Personel Notu
                  </Label>
                  <Textarea
                    id="not"
                    rows={4}
                    maxLength={1000}
                    value={not}
                    onChange={(e) => setNot(e.target.value)}
                    placeholder="Yapılan işlemi kısaca yazın..."
                    className="text-base"
                  />
                </div>
              </section>
            )}

            {g.is_loglari.length > 0 && (
              <section className="rounded-2xl bg-card p-4 shadow-card">
                <h2 className="text-sm font-bold">Kayıtlı İş Notları</h2>
                {g.is_loglari.map((log) => (
                  <div key={log.id} className="mt-3 rounded-xl bg-surface-soft p-3">
                    <p className="text-sm">{log.personel_notu || "Not girilmedi."}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(log.tamamlanma_tarihi).toLocaleString("tr-TR")}
                    </p>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </main>

      {g && !tamamlandi && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 p-4 backdrop-blur">
          <div className="mx-auto max-w-lg">
            <Button
              onClick={() => tamamla.mutate()}
              disabled={!foto || tamamla.isPending}
              className="h-16 w-full bg-status-tamam text-base font-bold text-status-tamam-foreground hover:bg-status-tamam/90"
            >
              <CheckCircle className="h-5 w-5" />
              {tamamla.isPending ? "Kaydediliyor..." : "Görevi Tamamla"}
            </Button>
            {!foto && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Tamamlamak için önce fotoğraf ekleyin.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}