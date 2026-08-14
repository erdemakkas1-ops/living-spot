import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, MapPin, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { konumTakipSaatleriGetir, konumTakipSaatiGuncelle, sonKonumlariGetir, type KonumTakipSaati } from "@/lib/saha-api";
import { toast } from "sonner";
import type { PersonelKonum } from "@/lib/saha-types";

function gecenSure(tarih: string) {
  const dk = Math.max(0, Math.round((Date.now() - new Date(tarih).getTime()) / 60000));
  if (dk < 1) return "az önce";
  if (dk < 60) return `${dk} dk önce`;
  const saat = Math.round(dk / 60);
  if (saat < 24) return `${saat} sa önce`;
  return `${Math.round(saat / 24)} gün önce`;
}

function canli(tarih: string) {
  return Date.now() - new Date(tarih).getTime() < 15 * 60 * 1000;
}

export function KonumTakibi() {
  const qc = useQueryClient();
  const [acik, setAcik] = useState(false);
  const [secili, setSecili] = useState<PersonelKonum | null>(null);

  const konumlar = useQuery({
    queryKey: ["konumlar"],
    queryFn: sonKonumlariGetir,
    enabled: acik,
    refetchInterval: acik ? 30_000 : false,
  });
  const saatler = useQuery({ queryKey: ["konum-takip-saatleri"], queryFn: konumTakipSaatleriGetir, enabled: acik });

  const liste = konumlar.data ?? [];
  const aktifSayi = liste.filter((k) => canli(k.kayit_tarihi)).length;
  const gosterilen = secili ?? liste[0] ?? null;

  return (
    <Dialog open={acik} onOpenChange={setAcik}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Personel konum takibi"
          title="Personel konum takibi"
          className="relative grid h-9 w-9 place-items-center rounded-lg bg-navy-foreground/10 ring-1 ring-navy-foreground/20 transition-colors hover:bg-navy-foreground/20"
        >
          <MapPin className="h-4 w-4 text-navy-foreground" />
          {aktifSayi > 0 && (
            <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-status-devam px-1 text-[10px] font-bold text-status-devam-foreground">
              {aktifSayi}
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Personel Konum Takibi
          </DialogTitle>
          <DialogDescription>
            Saha personelinin mobil ekranından gönderilen son konum bilgileri. Son 15 dakika
            içinde sinyal gönderenler "sahada" olarak işaretlenir.
          </DialogDescription>
        </DialogHeader>

        <section className="max-h-64 overflow-auto rounded-xl border p-3">
          <div className="mb-2 grid min-w-[650px] grid-cols-[minmax(150px,1fr)_110px_110px_130px_100px] gap-2 text-xs font-semibold text-muted-foreground">
            <span>Personel</span><span>İşe başlangıç</span><span>İş bitişi</span><span>Ek çalışma bitişi</span><span>İşlem</span>
          </div>
          <div className="min-w-[650px] space-y-2">
            {(saatler.data ?? []).map((s) => <SaatSatiri key={s.personel_id} saat={s} onKaydet={() => void qc.invalidateQueries({ queryKey: ["konum-takip-saatleri"] })} />)}
            {saatler.isLoading && <p className="py-3 text-sm text-muted-foreground">Çalışma saatleri yükleniyor...</p>}
            {saatler.isError && (
              <p className="py-3 text-sm text-destructive">
                Çalışma saatleri yüklenemedi. Pencereyi kapatıp yeniden açın.
              </p>
            )}
            {!saatler.isLoading && !saatler.isError && saatler.data?.length === 0 && (
              <p className="py-3 text-sm text-muted-foreground">
                Saat tanımlanabilecek personel kaydı bulunamadı.
              </p>
            )}
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {liste.length} personel · {aktifSayi} sahada
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => konumlar.refetch()}
                disabled={konumlar.isFetching}
              >
                <RefreshCw className={`h-4 w-4 ${konumlar.isFetching ? "animate-spin" : ""}`} />
                Yenile
              </Button>
            </div>

            {konumlar.isLoading && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Konumlar yükleniyor...
              </p>
            )}
            {!konumlar.isLoading && liste.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Henüz konum sinyali gelmedi. Personel saha ekranında konum iznini onayladığında
                burada görünecek.
              </p>
            )}

            {liste.map((k) => {
              const seciliMi = gosterilen?.personel_id === k.personel_id;
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setSecili(k)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    seciliMi ? "border-primary bg-accent" : "border-border hover:bg-accent/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">
                      {k.personel?.ad_soyad ?? "Personel"}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        canli(k.kayit_tarihi)
                          ? "bg-status-tamam text-status-tamam-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {canli(k.kayit_tarihi) ? "Sahada" : "Çevrimdışı"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {gecenSure(k.kayit_tarihi)} · {k.enlem.toFixed(5)}, {k.boylam.toFixed(5)}
                    {k.dogruluk ? ` · ±${Math.round(k.dogruluk)} m` : ""}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            {gosterilen ? (
              <>
                <div className="overflow-hidden rounded-xl border border-border">
                  <iframe
                    title="Personel konumu haritası"
                    className="h-[320px] w-full"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${gosterilen.boylam - 0.004}%2C${gosterilen.enlem - 0.003}%2C${gosterilen.boylam + 0.004}%2C${gosterilen.enlem + 0.003}&layer=mapnik&marker=${gosterilen.enlem}%2C${gosterilen.boylam}`}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {gosterilen.personel?.ad_soyad ?? "Personel"}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {new Date(gosterilen.kayit_tarihi).toLocaleString("tr-TR")}
                    </span>
                  </p>
                  <a
                    href={`https://www.google.com/maps?q=${gosterilen.enlem},${gosterilen.boylam}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Google Maps'te aç
                  </a>
                </div>
              </>
            ) : (
              <div className="grid h-[320px] place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                Haritada göstermek için soldan bir personel seçin.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SaatSatiri({ saat, onKaydet }: { saat: KonumTakipSaati; onKaydet: () => void }) {
  const [baslangic, setBaslangic] = useState(saat.ise_baslangic);
  const [bitis, setBitis] = useState(saat.is_bitisi);
  const [ekBitis, setEkBitis] = useState(saat.ek_calisma_bitisi ?? "");
  const [aktif, setAktif] = useState(saat.takip_aktif);
  const kaydet = useMutation({
    mutationFn: () => konumTakipSaatiGuncelle({ personel_id: saat.personel_id, ise_baslangic: baslangic, is_bitisi: bitis, ek_calisma_bitisi: ekBitis || null, takip_aktif: aktif }),
    onSuccess: () => { toast.success(`${saat.ad_soyad} takip saatleri kaydedildi.`); onKaydet(); },
    onError: (h: unknown) => toast.error(h instanceof Error ? h.message : "Saatler kaydedilemedi."),
  });
  return <div className="grid grid-cols-[minmax(150px,1fr)_110px_110px_130px_100px] items-center gap-2">
    <button type="button" onClick={() => setAktif(!aktif)} className={`truncate rounded-md px-2 py-2 text-left text-sm font-medium ${aktif ? "bg-emerald-100 text-emerald-900" : "bg-muted text-muted-foreground"}`}>{saat.ad_soyad} · {aktif ? "Açık" : "Kapalı"}</button>
    <Input type="time" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} aria-label={`${saat.ad_soyad} işe başlangıç`} />
    <Input type="time" value={bitis} onChange={(e) => setBitis(e.target.value)} aria-label={`${saat.ad_soyad} iş bitişi`} />
    <Input type="time" value={ekBitis} onChange={(e) => setEkBitis(e.target.value)} aria-label={`${saat.ad_soyad} ek çalışma bitişi`} />
    <Button size="sm" onClick={() => kaydet.mutate()} disabled={kaydet.isPending}>{kaydet.isPending ? "..." : "Kaydet"}</Button>
  </div>;
}
