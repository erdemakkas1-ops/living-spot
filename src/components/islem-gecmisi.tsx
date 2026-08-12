import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";

import { auditLoglariGetir } from "@/lib/saha-api";

const ISLEM_ETIKET: Record<string, string> = {
  personel_ekle: "Personel eklendi",
  personel_duzenle: "Personel düzenlendi",
  personel_pin_degistir: "PIN değiştirildi",
  personel_aktiflik: "Aktiflik değişti",
  personel_sil: "Personel silindi",
};

/** İK'ya özel denetim kaydı listesi; PIN, hash veya token bilgisi göstermez. */
export function IslemGecmisi({ etkin }: { etkin: boolean }) {
  const kayitlar = useQuery({
    queryKey: ["audit-loglari"],
    queryFn: auditLoglariGetir,
    enabled: etkin,
  });

  if (kayitlar.isLoading) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Yükleniyor…</p>;
  }
  if (kayitlar.isError) {
    return (
      <p className="py-6 text-center text-sm text-destructive">
        İşlem kayıtları alınamadı. Lütfen tekrar deneyin.
      </p>
    );
  }
  const liste = kayitlar.data ?? [];
  if (!liste.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <History className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Henüz işlem kaydı bulunmuyor</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {liste.map((k) => (
        <li key={k.id} className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold">
              {ISLEM_ETIKET[k.islem_turu] ?? k.islem_turu}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(k.created_at).toLocaleString("tr-TR")}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{k.aciklama}</p>
          <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
            <span>
              <span className="text-muted-foreground">Hedef personel: </span>
              {k.hedef_adi}
            </span>
            <span>
              <span className="text-muted-foreground">İşlemi yapan: </span>
              {k.yonetici_adi}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
