import { useMemo, useState } from "react";
import { Camera, ImageOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FotoGoruntuleyici } from "@/components/foto-goruntuleyici";
import type { Gorev } from "@/lib/saha-types";

type FotoKayit = {
  id: string;
  yol: string;
  baslik: string;
  personel: string;
  tarih: string;
};

export function FotoMenusu({ gorevler }: { gorevler: Gorev[] }) {
  const [acik, setAcik] = useState(false);
  const [secili, setSecili] = useState<FotoKayit | null>(null);

  const fotolar = useMemo(() => {
    const list: FotoKayit[] = [];
    gorevler.forEach((g) => {
      g.is_loglari
        .filter((l) => !!l.foto_url)
        .forEach((l) => {
          list.push({
            id: `${g.id}-${l.id}`,
            yol: l.foto_url!,
            baslik: `${g.is_basligi} · ${g.bloklar?.blok_adi ?? "—"}`,
            personel: g.personel?.ad_soyad ?? "—",
            tarih: l.tamamlanma_tarihi,
          });
        });
    });
    return list.sort(
      (a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime(),
    );
  }, [gorevler]);

  return (
    <Dialog open={acik} onOpenChange={setAcik}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Saha Fotoğrafları"
          className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy-foreground/10 ring-1 ring-navy-foreground/20 transition-colors hover:bg-navy-foreground/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-foreground/50"
        >
          <Camera className="h-4 w-4 text-navy-foreground" />
          {fotolar.length > 0 && (
            <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-status-tamam px-1 text-[10px] font-bold text-status-tamam-foreground">
              {fotolar.length > 9 ? "9+" : fotolar.length}
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Saha Fotoğrafları
          </DialogTitle>
        </DialogHeader>

        {fotolar.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 pb-8 text-muted-foreground">
            <ImageOff className="h-10 w-10" />
            <p className="text-sm">Henüz saha fotoğrafı yüklenmemiş.</p>
          </div>
        ) : (
          <div className="flex h-full flex-col gap-4 overflow-hidden px-5 pb-5">
            {secili ? (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setSecili(null)}
                  className="self-start text-sm font-medium text-primary hover:underline"
                >
                  ← Galeriye dön
                </button>
                <div className="flex flex-col gap-2">
                  <FotoGoruntuleyici
                    yol={secili.yol}
                    alt={secili.baslik}
                    className="aspect-video w-full rounded-xl"
                  />
                  <p className="text-sm font-medium">{secili.baslik}</p>
                  <p className="text-xs text-muted-foreground">
                    {secili.personel} ·{" "}
                    {new Date(secili.tarih).toLocaleString("tr-TR")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
                {fotolar.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSecili(f)}
                    className="group flex flex-col gap-2 rounded-xl bg-muted p-2 text-left transition-colors hover:bg-muted/80"
                  >
                    <FotoGoruntuleyici
                      yol={f.yol}
                      alt={f.baslik}
                      className="aspect-square w-full rounded-lg"
                    />
                    <span className="block truncate text-xs font-medium">
                      {f.baslik}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {new Date(f.tarih).toLocaleDateString("tr-TR")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
