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
      { title: "İK Yönetim Paneli | Saha İş Takip" },
      {
        name: "description",
        content:
          "Görev atama, blok bazlı canlı takip tablosu ve saha fotoğraf onay akışı için site yönetimi paneli.",
      },
      { property: "og:title", content: "İK Yönetim Paneli | Saha İş Takip" },
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
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-5 sm:flex sm:flex-wrap sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-navy-foreground/10 ring-1 ring-navy-foreground/20">
              <Building className="h-5 w-5 text-navy-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-navy-foreground sm:text-xl">
                Site Yönetim Paneli
              </h1>
              <p className="truncate text-xs text-navy-foreground/70">
                842 Daire · 55 Blok · {personeller.data?.length ?? 0} Saha Personeli
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <BaglantiRozeti className="bg-navy-foreground/10 text-navy-foreground" />
            <span className="hidden text-sm font-medium text-navy-foreground/80 md:inline">
              {kullanici?.ad_soyad}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                oturumSil();
                navigate({ to: "/" });
              }}
            >
              <LogOut className="h-4 w-4" />
              Çıkış
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <OzetKart
            baslik="Toplam Görev"
            deger={istatistik.toplam}
            ikon={<ClipboardList className="h-5 w-5" />}
          />
          <OzetKart
            baslik="Bekleyen İşler"
            deger={istatistik.bekleyen}
            ikon={<Clock className="h-5 w-5" />}
            renk="text-status-bekliyor"
          />
          <OzetKart
            baslik="Tamamlanan"
            deger={istatistik.tamam}
            ikon={<CheckCircle className="h-5 w-5" />}
            renk="text-status-tamam"
          />
          <OzetKart
            baslik="Sahada Aktif Personel"
            deger={istatistik.aktifPersonel}
            ikon={<Users className="h-5 w-5" />}
            renk="text-status-devam"
          />
        </section>

        <section className="mt-6 rounded-2xl bg-card p-4 shadow-card sm:p-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
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

          <div className="mt-4 overflow-x-auto">
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
  deger,
  ikon,
  renk = "text-primary",
}: {
  baslik: string;
  deger: number;
  ikon: React.ReactNode;
  renk?: string;
}) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-medium text-muted-foreground">{baslik}</p>
        <span className={`shrink-0 ${renk}`}>{ikon}</span>
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight">{deger}</p>
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
        <Button className="shrink-0">
          <Plus className="h-4 w-4" />
          Yeni Görev Ata
        </Button>
      </DialogTrigger>
      <DialogContent>
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