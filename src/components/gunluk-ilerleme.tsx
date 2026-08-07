import { TrendingUp } from "lucide-react";

import { Progress } from "@/components/ui/progress";

type Props = {
  toplam: number;
  tamam: number;
  devam: number;
  bekleyen: number;
};

export function GunlukIlerleme({ toplam, tamam, devam, bekleyen }: Props) {
  const yuzde = toplam > 0 ? Math.round((tamam / toplam) * 100) : 0;
  const devamYuzde = toplam > 0 ? Math.round((devam / toplam) * 100) : 0;
  const bekleyenYuzde = Math.max(0, 100 - yuzde - devamYuzde);

  return (
    <section className="mt-4 rounded-2xl bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <TrendingUp className="h-4 w-4 text-primary" />
          Günlük İlerleme
        </h2>
        <span className="text-2xl leading-none font-bold text-status-tamam">%{yuzde}</span>
      </div>

      <Progress value={yuzde} className="mt-3 h-3" />

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl bg-muted/60 p-2.5">
          <p className="text-muted-foreground">Tamamlanan</p>
          <p className="mt-0.5 text-sm font-bold text-status-tamam">
            %{yuzde} <span className="font-medium text-muted-foreground">({tamam})</span>
          </p>
        </div>
        <div className="rounded-xl bg-muted/60 p-2.5">
          <p className="text-muted-foreground">Devam Eden</p>
          <p className="mt-0.5 text-sm font-bold text-status-devam">
            %{devamYuzde} <span className="font-medium text-muted-foreground">({devam})</span>
          </p>
        </div>
        <div className="rounded-xl bg-muted/60 p-2.5">
          <p className="text-muted-foreground">Bekleyen</p>
          <p className="mt-0.5 text-sm font-bold text-status-bekliyor">
            %{bekleyenYuzde} <span className="font-medium text-muted-foreground">({bekleyen})</span>
          </p>
        </div>
      </div>
    </section>
  );
}
