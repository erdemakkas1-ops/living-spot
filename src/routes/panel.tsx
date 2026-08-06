import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  AlertCircle,
  Building,
  Camera,
  CheckCircle,
  Clock,
  ClipboardList,
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
import { FotoGoruntuleyici } from "@/components/foto-goruntuleyici";
import {
  bloklariGetir,
  gorevOlustur,
  personelGetir,
  tumGorevleriGetir,
} from "@/lib/saha-api";
import { oturumSil, useOturum } from "@/lib/saha-session";
import { DURUM_ETIKET, DURUM_SINIF, type Gorev } from "@/lib/saha-types";

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
    ],
  }),
  component: PanelSayfasi,
});

function PanelSayfasi() {
  const navigate = useNavigate();
  const { kullanici, hazir } = useOturum();

  useEffect(() => {
    if (hazir && !kullanici) navigate({ to: "/" });
    if (hazir && kullanici && kullanici.rol !== "ik") navigate({ to: "/saha" });
  }, [hazir, kullanici, navigate]);

  const gorevler = useQuery({ queryKey: ["gorevler"], queryFn: tumGorevleriGetir });
  const bloklar = useQuery({ queryKey: ["bloklar"], queryFn: bloklariGetir });
  const personeller = useQuery({ queryKey: ["personel"], queryFn: personelGetir });

  const [blokFiltre, setBlokFiltre] = useState("hepsi");
  const [durumFiltre, setDurumFiltre] = useState("hepsi");
  const [arama, setArama] = useState("");
  const [detay, setDetay] = useState<Gorev | null>(null);

  const liste = gorevler.data ?? [];

  const istatistik = useMemo(() => {
    const bekleyen = liste.filter((g) => g.durum === "bekliyor").length;
    const devam = liste.filter((g) => g.durum === "devam_ediyor").length;
    const tamam = liste.filter((g) => g.durum === "tamamlandi").length;
    const aktifPersonel = new Set(
      liste.filter((g) => g.durum === "devam_ediyor" && g.personel_id).map((g) => g.personel_id),
    ).size;
    return { toplam: liste.length, bekleyen, devam, tamam, aktifPersonel };
  }, [liste]);

  const filtreli = liste.filter((g) => {
    if (blokFiltre !== "hepsi" && g.blok_id !== blokFiltre) return false;
    if (durumFiltre !== "hepsi" && g.durum !== durumFiltre) return false;
    if (arama.trim()) {
      const q = arama.toLowerCase();
      const alan = `${g.is_basligi} ${g.personel?.ad_soyad ?? ""} ${g.bloklar?.blok_adi ?? ""}`;
      if (!alan.toLowerCase().includes(q)) return false;
    }
    return true;
  });

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
                <DropdownMenuItem onClick={() => navigate({ to: "/saha" })}>
                  <Users className="mr-2 h-4 w-4" />
                  Saha Ekranı
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    oturumSil();
                    navigate({ to: "/" });
                  }}
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
              <p className="truncate text-xs text-navy-foreground/70">
                Yönetim Paneli
              </p>
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
              className="h-9 w-9 px-0 sm:w-auto sm:px-3"
              onClick={() => {
                oturumSil();
                navigate({ to: "/" });
              }}
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
            uzunBaslik="Sahada Aktif Personel"
            deger={istatistik.aktifPersonel}
            ikon={<Users className="h-5 w-5" />}
            renk="text-status-devam"
          />
        </section>

        <section className="mt-4 rounded-2xl bg-card p-4 shadow-card sm:mt-6 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold">Canlı İş Takibi</h2>
              <p className="truncate text-xs text-muted-foreground">
                {filtreli.length} kayıt görüntüleniyor
              </p>
            </div>
            <GorevAtamaModali
              bloklar={bloklar.data ?? []}
              personeller={personeller.data ?? []}
            />
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
                    <TableCell className="max-w-[280px]">
                      <p className="truncate font-medium">{g.is_basligi}</p>
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
              <p className="py-8 text-center text-sm text-muted-foreground">Görevler yükleniyor...</p>
            )}
            {!gorevler.isLoading && filtreli.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Bu filtreye uygun görev bulunmuyor.
              </p>
            )}
            {filtreli.map((g) => (
              <div
                key={g.id}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">
                        {g.bloklar?.blok_adi ?? "—"}
                      </span>
                      {g.aciliyet === "acil" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/12 px-2 py-0.5 text-xs font-bold text-destructive">
                          <AlertCircle className="h-3 w-3" /> Acil
                        </span>
                      )}
                    </div>
                    <p className="mt-2 font-semibold leading-snug">{g.is_basligi}</p>
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
                    <span className="truncate max-w-[140px]">{g.personel?.ad_soyad ?? "Atanmadı"}</span>
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
    </div>
  );
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
        <p className="min-w-0 truncate text-xs font-medium text-muted-foreground sm:hidden" title={uzunBaslik}>
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
  const [baslik, setBaslik] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [aciliyet, setAciliyet] = useState("normal");

  const mut = useMutation({
    mutationFn: gorevOlustur,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gorevler"] });
      toast.success("Görev başarıyla atandı.");
      setAcik(false);
      setBlokId("");
      setPersonelId("");
      setBaslik("");
      setAciklama("");
      setAciliyet("normal");
    },
    onError: () => toast.error("Görev atanamadı, tekrar deneyin."),
  });

  return (
    <Dialog open={acik} onOpenChange={setAcik}>
      <DialogTrigger asChild>
        <Button className="w-full shrink-0 sm:w-auto">
          <Plus className="h-4 w-4" />
          Yeni Görev Ata
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Görev Atama</DialogTitle>
          <DialogDescription>
            Blok ve personel seçerek saha görevini oluşturun.
          </DialogDescription>
        </DialogHeader>
        <form
          id="gorev-atama"
          onSubmit={(e) => {
            e.preventDefault();
            if (!blokId || !personelId) {
              toast.error("Blok ve personel seçimi zorunludur.");
              return;
            }
            mut.mutate({
              blok_id: blokId,
              personel_id: personelId,
              is_basligi: baslik.trim().slice(0, 120),
              aciklama: aciklama.trim().slice(0, 1000),
              aciliyet,
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
            <Label htmlFor="baslik">İş Başlığı</Label>
            <Input
              id="baslik"
              value={baslik}
              onChange={(e) => setBaslik(e.target.value)}
              required
              maxLength={120}
              placeholder="Örn: Asansör arıza kontrolü"
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
            <Select value={aciliyet} onValueChange={setAciliyet}>
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
