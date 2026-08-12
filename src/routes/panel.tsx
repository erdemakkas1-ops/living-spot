import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  AlertCircle,
  Building,
  CalendarDays,
  Camera,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  ClipboardList,
  History,
  LogOut,
  Plus,
  Search,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BaglantiRozeti } from "@/components/baglanti-rozeti";
import { GunlukIlerleme } from "@/components/gunluk-ilerleme";
import { IsTakvimi } from "@/components/is-takvimi";
import { BildirimMenusu } from "@/components/bildirim-menusu";
import { FotoMenusu } from "@/components/foto-menusu";
import { KonumTakibi } from "@/components/konum-takibi";
import { IslemGecmisi } from "@/components/islem-gecmisi";
import { PersonelYonetimi } from "@/components/personel-yonetimi";
import { RaporIndir } from "@/components/rapor-indir";
import { IsTuruRozeti } from "@/components/is-turu-rozeti";
import { FotoGoruntuleyici } from "@/components/foto-goruntuleyici";
import { YardimButonu } from "@/components/yardim-butonu";
import { bloklariGetir, gorevOlustur, personelGetir, tumGorevleriGetir } from "@/lib/saha-api";
import { oturumSil, useOturum } from "@/lib/saha-session";
import {
  DURUM_ETIKET,
  DURUM_SINIF,
  IS_BASLIKLARI,
  type Gorev,
  type IsTuru,
} from "@/lib/saha-types";

export const Route = createFileRoute("/panel")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Yönetim Paneli | Selimpaşa Emlak Konutları" },
      {
        name: "description",
        content:
          "Selimpaşa Emlak Konutları görev atama, blok bazlı canlı takip tablosu ve saha fotoğraf onay akışı için yönetim paneli.",
      },
      { property: "og:title", content: "Yönetim Paneli | Selimpaşa Emlak Konutları" },
      {
        property: "og:description",
        content: "Blok bazlı canlı iş takibi, görev atama ve fotoğraf onay akışı.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PanelSayfasi,
});

function PanelSayfasi() {
  const navigate = useNavigate();
  const { kullanici, hazir } = useOturum();
  const panelQc = useQueryClient();

  // Çıkışta önbellekteki tüm sorgu verileri de temizlenir.
  const cikisYap = () => {
    oturumSil();
    panelQc.clear();
    navigate({ to: "/" });
  };

  useEffect(() => {
    if (hazir && !kullanici) navigate({ to: "/" });
    if (hazir && kullanici && kullanici.rol !== "ik") navigate({ to: "/saha" });
  }, [hazir, kullanici, navigate]);

  const yetkili = hazir && kullanici?.rol === "ik";
  const gorevler = useQuery({
    queryKey: ["gorevler"],
    queryFn: tumGorevleriGetir,
    enabled: yetkili,
  });
  const bloklar = useQuery({ queryKey: ["bloklar"], queryFn: bloklariGetir, enabled: yetkili });
  const personeller = useQuery({
    queryKey: ["personel"],
    queryFn: personelGetir,
    enabled: yetkili,
  });

  const [blokFiltre, setBlokFiltre] = useState("hepsi");
  const [durumFiltre, setDurumFiltre] = useState("hepsi");
  const [arama, setArama] = useState("");
  const [detay, setDetay] = useState<Gorev | null>(null);
  const [personelAcik, setPersonelAcik] = useState(false);
  const [gecmisAcik, setGecmisAcik] = useState(false);
  const [takvimAcik, setTakvimAcik] = useState(true);

  const liste = useMemo(() => gorevler.data ?? [], [gorevler.data]);
  const filtreli = useMemo(
    () =>
      liste.filter((g) => {
        if (blokFiltre !== "hepsi" && g.blok_id !== blokFiltre) return false;
        if (durumFiltre !== "hepsi" && g.durum !== durumFiltre) return false;
        if (arama.trim()) {
          const q = arama.toLowerCase();
          const alan = `${g.is_basligi} ${g.personel?.ad_soyad ?? ""} ${g.bloklar?.blok_adi ?? ""}`;
          if (!alan.toLowerCase().includes(q)) return false;
        }
        return true;
      }),
    [liste, blokFiltre, durumFiltre, arama],
  );

  const istatistik = useMemo(() => durumOzeti(liste), [liste]);
  const gunlukIstatistik = useMemo(() => {
    const bugun = new Date().toLocaleDateString("en-CA");
    return durumOzeti(liste.filter((g) => g.planlanan_tarih === bugun));
  }, [liste]);

  const aktifSahaPersoneli = useMemo(() => {
    const acikIsler = liste.filter((g) => g.durum !== "tamamlandi" && g.personel_id);
    return new Set(acikIsler.map((g) => g.personel_id)).size;
  }, [liste]);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-navy">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Menü"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-foreground/10 ring-1 ring-navy-foreground/20 transition-colors hover:bg-navy-foreground/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-foreground/50 sm:h-11 sm:w-11"
                >
                  <Building className="h-5 w-5 text-navy-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="truncate">
                  {kullanici?.ad_soyad ?? "Yönetim"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/panel" })}>
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Görev Yönetimi
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPersonelAcik(true)}>
                  <Users className="mr-2 h-4 w-4" />
                  Personel Listesi
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setGecmisAcik(true)}>
                  <History className="mr-2 h-4 w-4" />
                  İşlem Geçmişi
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Saha
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate({ to: "/saha" })}>
                  <Users className="mr-2 h-4 w-4" />
                  Saha Ekranı
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={cikisYap}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Çıkış Yap
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-navy-foreground sm:text-lg">
                Selimpaşa Emlak Konutları
              </h1>
              <p className="truncate text-xs text-navy-foreground/70">Yönetim Paneli</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <BaglantiRozeti className="hidden bg-navy-foreground/10 text-navy-foreground sm:inline-flex" />
            <span className="hidden text-sm font-medium text-navy-foreground/80 md:inline">
              {kullanici?.ad_soyad}
            </span>
            <Button
              variant="secondary"
              size="sm"
              aria-label="İşlem Geçmişi"
              title="İşlem Geçmişi"
              className="h-9 w-9 px-0"
              onClick={() => setGecmisAcik(true)}
            >
              <History className="h-4 w-4" />
            </Button>
            <BildirimMenusu gorevler={liste} />
            <FotoMenusu gorevler={liste} />
            <KonumTakibi />
            <Button
              variant="secondary"
              size="sm"
              className="h-9 w-9 px-0 sm:w-auto sm:px-3"
              onClick={cikisYap}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Çıkış</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <OzetKart
            baslik="Toplam"
            uzunBaslik="Toplam Görev"
            deger={istatistik.toplam}
            ikon={<ClipboardList className="h-5 w-5" />}
          />
          <OzetKart
            baslik="Bekleyen"
            uzunBaslik="Bekleyen İşler"
            deger={istatistik.bekleyen}
            ikon={<Clock className="h-5 w-5" />}
            renk="text-status-bekliyor"
          />
          <OzetKart
            baslik="Tamamlanan"
            uzunBaslik="Tamamlanan"
            deger={istatistik.tamam}
            ikon={<CheckCircle className="h-5 w-5" />}
            renk="text-status-tamam"
          />
          <OzetKart
            baslik="Aktif Pers."
            uzunBaslik="Aktif Saha Personeli"
            deger={aktifSahaPersoneli}
            ikon={<Users className="h-5 w-5" />}
            renk="text-status-devam"
          />
        </section>

        <GunlukIlerleme
          toplam={gunlukIstatistik.toplam}
          tamam={gunlukIstatistik.tamam}
          devam={gunlukIstatistik.devam}
          bekleyen={gunlukIstatistik.bekleyen}
        />

        <Collapsible open={takvimAcik} onOpenChange={setTakvimAcik}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group flex w-full items-center justify-between rounded-2xl bg-card p-4 text-left shadow-card outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:p-5"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <CalendarDays className="h-4 w-4 text-primary" />
                İş Takvimi
              </span>
              {takvimAcik ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground transition-transform group-hover:text-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-hover:text-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <IsTakvimi gorevler={liste} />
          </CollapsibleContent>
        </Collapsible>

        <section className="mt-4 rounded-2xl bg-card p-4 shadow-card sm:mt-6 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold">Canlı İş Takibi</h2>
              <p className="truncate text-xs text-muted-foreground">
                {filtreli.length} kayıt görüntüleniyor
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <RaporIndir gorevler={filtreli} />
              <GorevAtamaModali
                bloklar={bloklar.data ?? []}
                personeller={(personeller.data ?? []).filter((p) => p.aktif && p.rol === "personel")}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="İş, personel veya blok ara..."
                value={arama}
                onChange={(e) => setArama(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={blokFiltre} onValueChange={setBlokFiltre}>
              <SelectTrigger>
                <SelectValue placeholder="Blok seç" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hepsi">Tüm Bloklar</SelectItem>
                {(bloklar.data ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.blok_adi}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={durumFiltre} onValueChange={setDurumFiltre}>
              <SelectTrigger>
                <SelectValue placeholder="Durum seç" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hepsi">Tüm Durumlar</SelectItem>
                <SelectItem value="bekliyor">Bekliyor</SelectItem>
                <SelectItem value="devam_ediyor">Devam Ediyor</SelectItem>
                <SelectItem value="tamamlandi">Tamamlandı</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Desktop table */}
          <div className="mt-4 hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Blok</TableHead>
                  <TableHead>İş Türü</TableHead>
                  <TableHead>İş Tanımı</TableHead>
                  <TableHead>Personel</TableHead>
                  <TableHead>Aciliyet</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">Kanıt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gorevler.isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      Görevler yükleniyor...
                    </TableCell>
                  </TableRow>
                )}
                {!gorevler.isLoading && filtreli.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      Bu filtreye uygun görev bulunmuyor.
                    </TableCell>
                  </TableRow>
                )}
                {filtreli.map((g) => (
                  <TableRow key={g.id} className="align-middle">
                    <TableCell className="font-semibold">{g.bloklar?.blok_adi}</TableCell>
                    <TableCell>
                      <IsTuruRozeti turu={g.is_turu} />
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{g.is_basligi}</p>
                        {g.is_loglari.length > 0 && (
                          <button
                            type="button"
                            title="Saha fotoğrafını görüntüle"
                            aria-label="Saha fotoğrafını görüntüle"
                            onClick={() => setDetay(g)}
                            className="shrink-0 cursor-pointer rounded-md p-1 text-primary transition-colors hover:bg-accent"
                          >
                            <Camera className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {new Date(g.olusturma_tarihi).toLocaleString("tr-TR")}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        {g.personel?.ad_soyad ?? "Atanmadı"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {g.aciliyet === "acil" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/12 px-2 py-1 text-xs font-bold text-destructive">
                          <AlertCircle className="h-3.5 w-3.5" /> ACİL
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Normal</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${DURUM_SINIF[g.durum]}`}
                      >
                        {DURUM_ETIKET[g.durum]}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={g.is_loglari.length === 0}
                        onClick={() => setDetay(g)}
                      >
                        <Camera className="h-4 w-4" />
                        {g.is_loglari.length > 0 ? "İncele" : "Yok"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="mt-4 grid gap-3 md:hidden">
            {gorevler.isLoading && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Görevler yükleniyor...
              </p>
            )}
            {!gorevler.isLoading && filtreli.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Bu filtreye uygun görev bulunmuyor.
              </p>
            )}
            {filtreli.map((g) => (
              <div key={g.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
                        {g.bloklar?.blok_adi ?? "—"}
                      </span>
                      <IsTuruRozeti turu={g.is_turu} />
                      {g.aciliyet === "acil" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/12 px-2 py-0.5 text-xs font-bold text-destructive">
                          <AlertCircle className="h-3 w-3" /> Acil
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-start gap-2">
                      <p className="font-semibold leading-snug">{g.is_basligi}</p>
                      {g.is_loglari.length > 0 && (
                        <button
                          type="button"
                          title="Saha fotoğrafını görüntüle"
                          aria-label="Saha fotoğrafını görüntüle"
                          onClick={() => setDetay(g)}
                          className="shrink-0 cursor-pointer rounded-md p-1 text-primary transition-colors hover:bg-accent"
                        >
                          <Camera className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(g.olusturma_tarihi).toLocaleString("tr-TR")}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${DURUM_SINIF[g.durum]}`}
                  >
                    {DURUM_ETIKET[g.durum]}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    <span className="truncate max-w-[140px]">
                      {g.personel?.ad_soyad ?? "Atanmadı"}
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={g.is_loglari.length === 0}
                    onClick={() => setDetay(g)}
                  >
                    <Camera className="h-4 w-4" />
                    {g.is_loglari.length > 0 ? "İncele" : "Yok"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Dialog open={!!detay} onOpenChange={(o) => !o && setDetay(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detay?.is_basligi}</DialogTitle>
            <DialogDescription>
              {detay?.bloklar?.blok_adi} · {detay?.personel?.ad_soyad ?? "Atanmadı"}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] space-y-4 overflow-y-auto">
            {detay?.is_loglari.map((log) => (
              <div key={log.id} className="rounded-xl border border-border p-3">
                <FotoGoruntuleyici
                  yol={log.foto_url}
                  alt={`${detay.is_basligi} saha fotoğrafı`}
                  className="h-64 w-full rounded-lg"
                />
                <p className="mt-3 text-sm">{log.personel_notu || "Not girilmedi."}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(log.tamamlanma_tarihi).toLocaleString("tr-TR")}
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={personelAcik} onOpenChange={setPersonelAcik}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Personel Listesi</DialogTitle>
            <DialogDescription>
              Saha personelini ekleyin, pasife alın veya kadrodan çıkarın.
            </DialogDescription>
          </DialogHeader>
          <PersonelYonetimi etkin={yetkili && personelAcik} sade />
        </DialogContent>
      </Dialog>
      <Dialog open={gecmisAcik} onOpenChange={setGecmisAcik}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>İşlem Geçmişi</DialogTitle>
            <DialogDescription>
              Personel yönetimi işlemlerinin denetim kaydı (en yeniden eskiye).
            </DialogDescription>
          </DialogHeader>
          <IslemGecmisi etkin={yetkili && gecmisAcik} />
        </DialogContent>
      </Dialog>
      <YardimButonu />
    </div>
  );
}

function durumOzeti(gorevler: Gorev[]) {
  const bekleyen = gorevler.filter((g) => g.durum === "bekliyor").length;
  const devam = gorevler.filter((g) => g.durum === "devam_ediyor").length;
  const tamam = gorevler.filter((g) => g.durum === "tamamlandi").length;
  return { toplam: gorevler.length, bekleyen, devam, tamam };
}

function OzetKart({
  baslik,
  uzunBaslik,
  deger,
  ikon,
  renk = "text-primary",
}: {
  baslik: string;
  uzunBaslik: string;
  deger: number;
  ikon: React.ReactNode;
  renk?: string;
}) {
  return (
    <div className="rounded-2xl bg-card p-3 shadow-card sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p
          className="min-w-0 truncate text-xs font-medium text-muted-foreground sm:hidden"
          title={uzunBaslik}
        >
          {baslik}
        </p>
        <p className="hidden min-w-0 truncate text-xs font-medium text-muted-foreground sm:block">
          {uzunBaslik}
        </p>
        <span className={`shrink-0 ${renk}`}>{ikon}</span>
      </div>
      <p className="mt-1 text-2xl font-bold tracking-tight sm:mt-2 sm:text-3xl">{deger}</p>
    </div>
  );
}

function GorevAtamaModali({
  bloklar,
  personeller,
}: {
  bloklar: { id: string; blok_adi: string }[];
  personeller: { id: string; ad_soyad: string }[];
}) {
  const qc = useQueryClient();
  const [acik, setAcik] = useState(false);
  const [blokId, setBlokId] = useState("");
  const [personelId, setPersonelId] = useState("");
  const [isTuru, setIsTuru] = useState<IsTuru | "">("");
  const [baslik, setBaslik] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [aciliyet, setAciliyet] = useState<"normal" | "acil">("normal");
  const [planlananTarih, setPlanlananTarih] = useState(() =>
    new Date().toLocaleDateString("en-CA"),
  );

  const mut = useMutation({
    mutationFn: gorevOlustur,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gorevler"] });
      toast.success("Görev başarıyla atandı.");
      setAcik(false);
      setBlokId("");
      setPersonelId("");
      setIsTuru("");
      setBaslik("");
      setAciklama("");
      setAciliyet("normal");
      setPlanlananTarih(new Date().toLocaleDateString("en-CA"));
    },
    onError: (e: unknown) => {
      // Server function errors cross the RPC boundary as plain objects, so they
      // are not always `instanceof Error` in the browser.
      const mesaj =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null && "message" in e && typeof e.message === "string"
            ? e.message
            : "Görev atanamadı, tekrar deneyin.";
      toast.error(`Görev atanamadı: ${mesaj}`);
    },
  });

  return (
    <Dialog open={acik} onOpenChange={setAcik}>
      <DialogTrigger asChild>
        <Button className="w-full shrink-0 sm:w-auto">
          <Plus className="h-4 w-4" />
          Yeni Görev Ata
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Görev Atama</DialogTitle>
          <DialogDescription>Blok ve personel seçerek saha görevini oluşturun.</DialogDescription>
        </DialogHeader>
        <form
          id="gorev-atama"
          onSubmit={(e) => {
            e.preventDefault();
            if (!blokId || !personelId || !isTuru || !baslik || !planlananTarih) {
              toast.error("Blok, personel, iş türü ve iş başlığı seçimi zorunludur.");
              return;
            }
            mut.mutate({
              blok_id: blokId,
              personel_id: personelId,
              is_basligi: baslik,
              aciklama: aciklama.trim().slice(0, 1000),
              aciliyet,
              is_turu: isTuru,
              planlanan_tarih: planlananTarih,
            });
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Blok</Label>
              <Select value={blokId} onValueChange={setBlokId}>
                <SelectTrigger>
                  <SelectValue placeholder="Blok seçin" />
                </SelectTrigger>
                <SelectContent>
                  {bloklar.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.blok_adi}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Personel</Label>
              <Select value={personelId} onValueChange={setPersonelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Personel seçin" />
                </SelectTrigger>
                <SelectContent>
                  {personeller.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.ad_soyad}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>İş Türü</Label>
            <Select
              value={isTuru}
              onValueChange={(v) => {
                setIsTuru(v as IsTuru);
                setBaslik("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="İş türü seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="peyzaj">Peyzaj</SelectItem>
                <SelectItem value="bakim">Bakım</SelectItem>
                <SelectItem value="temizlik">Temizlik</SelectItem>
                <SelectItem value="guvenlik">Güvenlik</SelectItem>
                <SelectItem value="elektrik">Elektrik</SelectItem>
                <SelectItem value="sihhi_tesisat">Sıhhi Tesisat</SelectItem>
                <SelectItem value="tadilat">Tadilat</SelectItem>
                <SelectItem value="genel">Genel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="baslik">İş Başlığı</Label>
            <Select value={baslik} onValueChange={setBaslik} disabled={!isTuru}>
              <SelectTrigger id="baslik">
                <SelectValue placeholder={isTuru ? "İş başlığı seçin" : "Önce iş türü seçin"} />
              </SelectTrigger>
              <SelectContent>
                {isTuru &&
                  IS_BASLIKLARI[isTuru].map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="planlanan-tarih">Planlanan Tarih</Label>
            <Input
              id="planlanan-tarih"
              type="date"
              value={planlananTarih}
              onChange={(e) => setPlanlananTarih(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="aciklama">Açıklama</Label>
            <Textarea
              id="aciklama"
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="İşin detayları, kat bilgisi, gerekli malzeme..."
            />
          </div>
          <div className="space-y-2">
            <Label>Aciliyet</Label>
            <Select
              value={aciliyet}
              onValueChange={(deger) => setAciliyet(deger === "acil" ? "acil" : "normal")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="acil">Acil</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </form>
        <DialogFooter>
          <Button type="submit" form="gorev-atama" disabled={mut.isPending}>
            {mut.isPending ? "Atanıyor..." : "Görevi Ata"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
