import { useMemo } from "react";
import { AlertCircle, Bell, CheckCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Gorev } from "@/lib/saha-types";

export function BildirimMenusu({ gorevler }: { gorevler: Gorev[] }) {
  const bildirimler = useMemo(() => {
    const acil = gorevler
      .filter((g) => g.aciliyet === "acil" && g.durum !== "tamamlandi")
      .map((g) => ({
        id: `acil-${g.id}`,
        tur: "acil" as const,
        baslik: `ACİL: ${g.is_basligi}`,
        alt: `${g.bloklar?.blok_adi ?? "—"} · ${g.personel?.ad_soyad ?? "Atanmadı"}`,
        tarih: g.olusturma_tarihi,
      }));
    const tamam = gorevler
      .filter((g) => g.durum === "tamamlandi" && g.is_loglari.length > 0)
      .map((g) => ({
        id: `tamam-${g.id}`,
        tur: "tamam" as const,
        baslik: `Tamamlandı: ${g.is_basligi}`,
        alt: `${g.bloklar?.blok_adi ?? "—"} · ${g.personel?.ad_soyad ?? "Atanmadı"}`,
        tarih: g.is_loglari[g.is_loglari.length - 1]?.tamamlanma_tarihi ?? g.olusturma_tarihi,
      }));
    return [...acil, ...tamam]
      .sort((a, b) => new Date(b.tarih).getTime() - new Date(a.tarih).getTime())
      .slice(0, 12);
  }, [gorevler]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Bildirimler"
          className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy-foreground/10 ring-1 ring-navy-foreground/20 transition-colors hover:bg-navy-foreground/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-foreground/50"
        >
          <Bell className="h-4 w-4 text-navy-foreground" />
          {bildirimler.length > 0 && (
            <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {bildirimler.length > 9 ? "9+" : bildirimler.length}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel>Bildirimler</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {bildirimler.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            Yeni bildirim yok.
          </p>
        )}
        <div className="max-h-80 overflow-y-auto">
          {bildirimler.map((b) => (
            <DropdownMenuItem key={b.id} className="items-start gap-2">
              {b.tur === "acil" ? (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              ) : (
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-tamam" />
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{b.baslik}</span>
                <span className="block truncate text-xs text-muted-foreground">{b.alt}</span>
                <span className="block text-xs text-muted-foreground">
                  {new Date(b.tarih).toLocaleString("tr-TR")}
                </span>
              </span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
