import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, KeyRound, LogIn, Phone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BaglantiRozeti } from "@/components/baglanti-rozeti";
import { girisYap } from "@/lib/saha-api";
import { oturumYaz, useOturum } from "@/lib/saha-session";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Saha Takip | Site Yönetimi Giriş" },
      {
        name: "description",
        content:
          "842 daire ve 55 bloklu konut sitesi için saha iş ve personel takip sistemi. Telefon ve PIN ile hızlı giriş.",
      },
      { property: "og:title", content: "Saha Takip | Site Yönetimi Giriş" },
      {
        property: "og:description",
        content: "Site yönetimi ve saha personeli için iş takip sistemi girişi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GirisSayfasi,
});

function GirisSayfasi() {
  const navigate = useNavigate();
  const { kullanici } = useOturum();
  const [telefon, setTelefon] = useState("");
  const [pin, setPin] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);

  useEffect(() => {
    if (kullanici) {
      navigate({ to: kullanici.rol === "ik" ? "/panel" : "/saha" });
    }
  }, [kullanici, navigate]);

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    setYukleniyor(true);
    try {
      const p = await girisYap(telefon, pin);
      oturumYaz(p);
      toast.success(`Hoş geldin, ${p.ad_soyad}`);
      navigate({ to: p.rol === "ik" ? "/panel" : "/saha" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Giriş başarısız.");
    } finally {
      setYukleniyor(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-gradient-navy px-5 py-10">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-navy-foreground/10 ring-1 ring-navy-foreground/20">
            <Building2 className="h-8 w-8 text-navy-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-foreground">
            Saha İş Takip
          </h1>
          <p className="mt-1.5 text-sm text-navy-foreground/70">
            842 Daire · 55 Blok · Site Yönetimi
          </p>
        </div>

        <form
          onSubmit={gonder}
          className="rounded-2xl bg-card p-6 shadow-card"
        >
          <div className="space-y-2">
            <Label htmlFor="telefon" className="text-sm font-semibold">
              Telefon Numarası
            </Label>
            <div className="relative">
              <Phone className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="telefon"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="05310000001"
                value={telefon}
                onChange={(e) => setTelefon(e.target.value)}
                required
                maxLength={15}
                className="h-14 pl-10 text-base"
              />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="pin" className="text-sm font-semibold">
              PIN Kodu
            </Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
                maxLength={8}
                className="h-14 pl-10 text-base tracking-[0.4em]"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={yukleniyor}
            className="mt-6 h-14 w-full text-base font-semibold"
          >
            <LogIn className="h-5 w-5" />
            {yukleniyor ? "Giriş yapılıyor..." : "Giriş Yap"}
          </Button>

          <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Yerel sunucu bağlantısı
            </span>
            <BaglantiRozeti />
          </div>
        </form>

        <p className="mt-6 text-center text-xs leading-relaxed text-navy-foreground/60">
          Demo giriş — Yönetim: 05335335353 / 1234
          <br />
          Saha personeli: 05445445454 / 1111
        </p>
      </div>
    </main>
  );
}
