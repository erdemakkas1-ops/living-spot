import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Phone, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  personelAktiflikGuncelle,
  personelEkle,
  personelGetir,
  personelSil,
} from "@/lib/saha-api";

/** İK panelinde saha personelini manuel ekleme / çıkarma modülü. */
export function PersonelYonetimi({
  etkin = true,
  sade = false,
}: {
  etkin?: boolean;
  sade?: boolean;
}) {
  const qc = useQueryClient();
  const personeller = useQuery({
    queryKey: ["personel"],
    queryFn: personelGetir,
    enabled: etkin,
  });

  const [acik, setAcik] = useState(false);
  const [adSoyad, setAdSoyad] = useState("");
  const [telefon, setTelefon] = useState("");
  const [pin, setPin] = useState("");

  const yenile = () => {
    void qc.invalidateQueries({ queryKey: ["personel"] });
    void qc.invalidateQueries({ queryKey: ["gorevler"] });
  };

  const ekle = useMutation({
    mutationFn: () =>
      personelEkle({ ad_soyad: adSoyad, telefon, pin_kodu: pin }),
    onSuccess: () => {
      toast.success("Personel eklendi.");
      setAcik(false);
      setAdSoyad("");
      setTelefon("");
      setPin("");
      yenile();
    },
    onError: (h: unknown) =>
      toast.error(h instanceof Error ? h.message : "Personel eklenemedi."),
  });

  const sil = useMutation({
    mutationFn: (id: string) => personelSil(id),
    onSuccess: () => {
      toast.success("Personel listeden çıkarıldı.");
      yenile();
    },
    onError: (h: unknown) =>
      toast.error(h instanceof Error ? h.message : "Personel çıkarılamadı."),
  });

  const aktiflik = useMutation({
    mutationFn: (v: { id: string; aktif: boolean }) =>
      personelAktiflikGuncelle(v.id, v.aktif),
    onSuccess: () => {
      toast.success("Personel durumu güncellendi.");
      yenile();
    },
    onError: (h: unknown) =>
      toast.error(h instanceof Error ? h.message : "Durum güncellenemedi."),
  });

  const liste = personeller.data ?? [];

  return (
    <section
      className={
        sade ? "" : "mt-4 rounded-2xl bg-card p-4 shadow-card sm:mt-6 sm:p-5"
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Users className="h-4 w-4 text-primary" />
            Personel Listesi
          </h2>
          <p className="text-xs text-muted-foreground">
            {liste.filter((p) => p.aktif).length} aktif / {liste.length} kayıtlı personel
          </p>
        </div>
        <Dialog open={acik} onOpenChange={setAcik}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full sm:w-auto">
              <UserPlus className="h-4 w-4" />
              Personel Ekle
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Yeni Personel</DialogTitle>
              <DialogDescription>
                Saha personelini manuel olarak kadroya ekleyin. PIN, personelin
                mobil girişte kullanacağı 4 haneli koddur.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="py-ad">Ad Soyad</Label>
                <Input
                  id="py-ad"
                  value={adSoyad}
                  onChange={(e) => setAdSoyad(e.target.value)}
                  placeholder="Örn. Ahmet Kara"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="py-tel">Telefon</Label>
                <Input
                  id="py-tel"
                  inputMode="numeric"
                  value={telefon}
                  onChange={(e) => setTelefon(e.target.value)}
                  placeholder="05XX XXX XX XX"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="py-pin">PIN (4 hane)</Label>
                <Input
                  id="py-pin"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="1111"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => ekle.mutate()}
                disabled={
                  ekle.isPending ||
                  adSoyad.trim().length < 2 ||
                  telefon.replace(/\D/g, "").length < 10 ||
                  pin.length !== 4
                }
              >
                {ekle.isPending ? "Ekleniyor..." : "Kadroya Ekle"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div
        className={`mt-4 grid gap-2 ${sade ? "" : "sm:grid-cols-2 lg:grid-cols-3"}`}
      >
        {personeller.isLoading && (
          <p className="py-6 text-sm text-muted-foreground">Personel yükleniyor...</p>
        )}
        {!personeller.isLoading && liste.length === 0 && (
          <p className="py-6 text-sm text-muted-foreground">
            Kayıtlı personel yok. "Personel Ekle" ile kadro oluşturun.
          </p>
        )}
        {liste.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold">{p.ad_soyad}</p>
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                {p.telefon}
              </p>
              <span
                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                  p.aktif
                    ? "bg-status-tamam text-status-tamam-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {p.aktif ? "Aktif" : "Pasif"}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={aktiflik.isPending}
                onClick={() => aktiflik.mutate({ id: p.id, aktif: !p.aktif })}
              >
                {p.aktif ? "Pasife Al" : "Aktif Et"}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-2 text-destructive hover:bg-destructive/10"
                    aria-label={`${p.ad_soyad} kaydını sil`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Personeli çıkar?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {p.ad_soyad} kadrodan tamamen silinecek. Bu personele atanmış
                      görevlerin ataması boşa çıkar. Bu işlem geri alınamaz.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                    <AlertDialogAction onClick={() => sil.mutate(p.id)}>
                      Sil
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
