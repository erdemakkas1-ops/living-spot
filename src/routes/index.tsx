import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, KeyRound, LogIn, Phone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BaglantiRozeti } from "@/components/baglanti-rozeti";
import { girisYap, mfaDogrula } from "@/lib/saha-api";
import { oturumSebebiAl, oturumYaz, useOturum } from "@/lib/saha-session";

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
  const [mfa, setMfa] = useState<{ kurulum?: { anahtar: string; uri: string } | undefined } | null>(null);
  const [mfaKodu, setMfaKodu] = useState("");
  const [kurtarma, setKurtarma] = useState<{ kodlar: string[]; personel: Awaited<ReturnType<typeof mfaDogrula>>["personel"] } | null>(null);

  useEffect(() => {
    if (kullanici) {
      navigate({ to: kullanici.rol === "ik" ? "/panel" : "/saha" });
    }
  }, [kullanici, navigate]);

  // Oturum süresi dolduğu için yönlendirildiyse kullanıcıya bildirim gösterilir.
  useEffect(() => {
    const sebep = oturumSebebiAl();
    if (sebep) toast.error(sebep);
  }, []);

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    setYukleniyor(true);
    try {
      const sonuc = await girisYap(telefon, pin);
      if (sonuc.mfaGerekli) {
        setMfa({ kurulum: sonuc.kurulum });
        setPin("");
        toast.success(sonuc.kurulum ? "Authenticator kurulumunu tamamlayın." : "Authenticator kodunu girin.");
        return;
      }
      const p = sonuc.personel;
      oturumYaz(p);
      toast.success(`Hoş geldin, ${p.ad_soyad}`);
      navigate({ to: p.rol === "ik" ? "/panel" : "/saha" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Giriş başarısız.");
    } finally {
      setYukleniyor(false);
    }
  };

  const mfaGonder = async (e: React.FormEvent) => {
    e.preventDefault();
    setYukleniyor(true);
    try {
      const sonuc = await mfaDogrula(mfaKodu);
      const p = sonuc.personel;
      if (sonuc.kurtarmaKodlari?.length) {
        setKurtarma({ kodlar: sonuc.kurtarmaKodlari, personel: p });
        return;
      }
      oturumYaz(p);
      toast.success(`Hoş geldin, ${p.ad_soyad}`);
      navigate({ to: "/panel" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kod doğrulanamadı.");
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
          onSubmit={mfa ? mfaGonder : gonder}
          className="rounded-2xl bg-card p-6 shadow-card"
        >
          {kurtarma ? (
            <div>
              <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
              <h2 className="mt-3 text-center text-lg font-bold">Kurtarma kodlarınız</h2>
              <p className="mt-1 text-center text-sm text-muted-foreground">
                Telefonunuza erişemezseniz bu tek kullanımlık kodlardan biriyle giriş yapabilirsiniz.
                Kodlar tekrar gösterilmeyecek; güvenli bir yerde saklayın.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border bg-muted p-3">
                {kurtarma.kodlar.map((kod) => <code key={kod} className="text-center font-bold">{kod}</code>)}
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full"
                onClick={async () => {
                  await navigator.clipboard.writeText(kurtarma.kodlar.join("\n"));
                  toast.success("Kurtarma kodları kopyalandı.");
                }}
              >
                Tüm Kodları Kopyala
              </Button>
              <Button
                type="button"
                className="mt-3 w-full"
                onClick={() => {
                  oturumYaz(kurtarma.personel);
                  navigate({ to: "/panel" });
                }}
              >
                Kodları Sakladım, Panele Geç
              </Button>
            </div>
          ) : mfa ? (
            <>
              <div className="text-center">
                <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
                <h2 className="mt-3 text-lg font-bold">İki aşamalı doğrulama</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mfa.kurulum
                    ? "Google veya Microsoft Authenticator uygulamasında Kurulum anahtarı ekle seçeneğini açın."
                    : "Authenticator uygulamanızdaki 6 haneli kodu girin."}
                </p>
              </div>
              {mfa.kurulum && (
                <div className="mt-4 rounded-lg border bg-muted p-3">
                  <p className="text-xs font-semibold text-muted-foreground">Hesap: Saha İş Takip</p>
                  <code className="mt-2 block break-all text-center text-sm font-bold tracking-wider">
                    {mfa.kurulum.anahtar}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={async () => {
                      await navigator.clipboard.writeText(mfa.kurulum!.anahtar);
                      toast.success("Kurulum anahtarı kopyalandı.");
                    }}
                  >
                    Anahtarı Kopyala
                  </Button>
                </div>
              )}
              <div className="mt-4 space-y-2">
                <Label htmlFor="mfa-kodu" className="text-sm font-semibold">Authenticator veya Kurtarma Kodu</Label>
                <Input
                  id="mfa-kodu"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000 veya ABCD-EFGH"
                  value={mfaKodu}
                  onChange={(e) => setMfaKodu(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                  required
                  minLength={6}
                  maxLength={9}
                  className="h-14 text-center text-xl tracking-[0.4em]"
                  autoFocus
                />
              </div>
              <Button type="submit" disabled={yukleniyor || !/^(?:\d{6}|[A-Z0-9]{4}-?[A-Z0-9]{4})$/.test(mfaKodu)} className="mt-6 h-14 w-full text-base font-semibold">
                <ShieldCheck className="h-5 w-5" />
                {yukleniyor ? "Doğrulanıyor..." : "Kodu Doğrula"}
              </Button>
              <Button type="button" variant="ghost" className="mt-2 w-full" onClick={() => { setMfa(null); setMfaKodu(""); }}>
                Giriş ekranına dön
              </Button>
            </>
          ) : (
          <>
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
          </>
          )}
        </form>
        <p className="mt-5 text-center text-xs text-navy-foreground/70">
          Kişisel verilerinizin işlenmesi hakkında{" "}
          <Link to="/kvkk" className="font-semibold underline underline-offset-4">
            KVKK Aydınlatma Metni
          </Link>
        </p>
      </div>
    </main>
  );
}
