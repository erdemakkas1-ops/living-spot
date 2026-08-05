import { Wifi, WifiOff } from "lucide-react";
import { useCevrimici } from "@/lib/saha-session";
import { cn } from "@/lib/utils";

export function BaglantiRozeti({ className }: { className?: string }) {
  const cevrimici = useCevrimici();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        cevrimici
          ? "bg-status-tamam/15 text-status-tamam"
          : "bg-destructive/15 text-destructive",
        className,
      )}
    >
      {cevrimici ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      {cevrimici ? "Bağlantı Var" : "Bağlantı Yok"}
    </span>
  );
}