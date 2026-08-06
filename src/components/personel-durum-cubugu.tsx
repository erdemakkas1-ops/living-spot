import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Coffee, HardHat, PowerOff, Users } from "lucide-react";
import { useState } from "react";


import { personelAnlikDurumlariGetir } from "@/lib/saha-api";
import type { AnlikDurum } from "@/lib/saha-types";

const ETIKET: Record<AnlikDurum, string> = {
  calisiyor: "Aktif Çalışıyor",
  molada: "Molada",
  cevrimdisi: "Çevrimdışı",
};

const KISA: Record<AnlikDurum, string> = {
  calisiyor: "Aktif",
  molada: "Molada",
  cevrimdisi: "Çevrimdışı",
};

const NOKTA: Record<AnlikDurum, string> = {
  calisiyor: "bg-status-tamam",
  molada: "bg-status-bekliyor",
  cevrimdisi: "bg-muted-foreground",
};

const IKON: Record<AnlikDurum, typeof Users> = {
  calisiyor: HardHat,
  molada: Coffee,
  cevrimdisi: PowerOff,
};

function gecenSure(tarih: string | null) {
  if (!tarih) return "kayıt yok";
  const dk = Math.max(0, Math.round((Date.now() - new Date(tarih).getTime()) / 60000));
  if (dk < 1) return "az önce";
  if (dk < 60) return `${dk} dk önce`;
  const saat = Math.round(dk / 60);
  if (saat < 24) return `${saat} sa önce`;
  return `${Math.round(saat / 24)} gün önce`;
}

const SIRA: AnlikDurum[] = ["calisiyor", "molada", "cevrimdisi"];

export function PersonelDurumCubugu() {
  const durumlar = useQuery({
    queryKey: ["personel-anlik-durum"],
    queryFn: personelAnlikDurumlariGetir,
    refetchInterval: 60_000,
  });

  const liste = durumlar.data ?? [];
  const sayilar = SIRA.map((d) => ({
    durum: d,
    adet: liste.filter((p) => p.durum === d).length,
  }));

  return (
    <section className="mt-4 rounded-2xl bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Users className="h-4 w-4 text-primary" />
            Personel Anlık Durum
          </h2>
          <p className="text-xs text-muted-foreground">
            {liste.length} aktif personel · 60 saniyede bir yenilenir
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {sayilar.map(({ durum, adet }) => (
            <span
              key={durum}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-bold"
            >
              <span className={`h-2 w-2 rounded-full ${NOKTA[durum]}`} />
              {KISA[durum]}
              <span className="text-muted-foreground">{adet}</span>
            </span>
          ))}
        </div>
      </div>

      {durumlar.isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Durumlar yükleniyor...</p>
      ) : liste.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Kayıtlı aktif personel bulunmuyor.
        </p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[...liste]
            .sort((a, b) => SIRA.indexOf(a.durum) - SIRA.indexOf(b.durum))
            .map((p) => {
              const Ikon = IKON[p.durum];
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2.5"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-card text-muted-foreground">
                    <Ikon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.ad_soyad}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {ETIKET[p.durum]} · {gecenSure(p.son_gorulme)}
                    </p>
                  </div>
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${NOKTA[p.durum]}`} />
                </li>
              );
            })}
        </ul>
      )}
    </section>
  );
}
