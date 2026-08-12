import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DURUM_ETIKET, DURUM_SINIF, type Gorev } from "@/lib/saha-types";
import { cn } from "@/lib/utils";

const GUNLER = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function anahtar(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Geriye ve ileriye dönük gezinilebilen aylık iş takvimi. */
export function IsTakvimi({ gorevler }: { gorevler: Gorev[] }) {
  const bugun = new Date();
  const [ay, setAy] = useState(() => new Date(bugun.getFullYear(), bugun.getMonth(), 1));
  const [secili, setSecili] = useState<string>(() => anahtar(bugun));

  const gunBazli = useMemo(() => {
    const harita = new Map<string, Gorev[]>();
    for (const g of gorevler) {
      const k = g.planlanan_tarih || anahtar(new Date(g.olusturma_tarihi));
      const mevcut = harita.get(k);
      if (mevcut) mevcut.push(g);
      else harita.set(k, [g]);
    }
    return harita;
  }, [gorevler]);

  const hucreler = useMemo(() => {
    const ilk = new Date(ay.getFullYear(), ay.getMonth(), 1);
    const gunSayisi = new Date(ay.getFullYear(), ay.getMonth() + 1, 0).getDate();
    const bosluk = (ilk.getDay() + 6) % 7; // Pazartesi başlangıç
    const liste: (Date | null)[] = Array.from({ length: bosluk }, () => null);
    for (let i = 1; i <= gunSayisi; i += 1) {
      liste.push(new Date(ay.getFullYear(), ay.getMonth(), i));
    }
    return liste;
  }, [ay]);

  const seciliGorevler = gunBazli.get(secili) ?? [];
  const ayBasligi = ay.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
  const bugunKey = anahtar(bugun);

  return (
    <section className="mt-2 rounded-2xl bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 px-0"
            aria-label="Önceki ay"
            onClick={() => setAy(new Date(ay.getFullYear(), ay.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-32 text-center text-sm font-semibold capitalize">{ayBasligi}</span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 px-0"
            aria-label="Sonraki ay"
            onClick={() => setAy(new Date(ay.getFullYear(), ay.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => {
              setAy(new Date(bugun.getFullYear(), bugun.getMonth(), 1));
              setSecili(bugunKey);
            }}
          >
            Bugün
          </Button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
        {GUNLER.map((g) => (
          <span key={g}>{g}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {hucreler.map((d, i) => {
          if (!d) return <span key={`bos-${i}`} />;
          const k = anahtar(d);
          const gunGorevleri = gunBazli.get(k) ?? [];
          const acil = gunGorevleri.some((g) => g.aciliyet === "acil" && g.durum !== "tamamlandi");
          return (
            <button
              key={k}
              type="button"
              onClick={() => setSecili(k)}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-1 rounded-xl border text-xs transition-colors",
                k === secili
                  ? "border-primary bg-primary/10 font-bold text-primary"
                  : "border-border bg-muted/40 hover:bg-muted",
                k === bugunKey && k !== secili && "border-primary/50",
              )}
            >
              <span>{d.getDate()}</span>
              {gunGorevleri.length > 0 ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] font-semibold",
                    acil
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-primary text-primary-foreground",
                  )}
                >
                  {gunGorevleri.length}
                </span>
              ) : (
                <span className="h-3.5" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <p className="text-xs font-semibold text-muted-foreground">
          {new Date(secili).toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "long",
            year: "numeric",
            weekday: "long",
          })}{" "}
          — {seciliGorevler.length} iş
        </p>
        {seciliGorevler.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Bu güne ait planlanmış iş bulunmuyor.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {seciliGorevler.map((g) => (
              <li
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{g.is_basligi}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {g.bloklar?.blok_adi ?? "-"} · {g.personel?.ad_soyad ?? "Atanmadı"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {g.aciliyet === "acil" && <Badge variant="destructive">Acil</Badge>}
                  <Badge className={DURUM_SINIF[g.durum]}>{DURUM_ETIKET[g.durum]}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
