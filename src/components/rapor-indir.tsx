import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DURUM_ETIKET, type Gorev } from "@/lib/saha-types";

const BASLIKLAR = [
  "Blok",
  "İş Tanımı",
  "Açıklama",
  "Personel",
  "Aciliyet",
  "Durum",
  "Oluşturma Tarihi",
  "Tamamlanma Tarihi",
  "Fotoğraf",
];

function satirlar(gorevler: Gorev[]) {
  const tarihMetni = (deger: string) => {
    const tarih = new Date(deger);
    const parca = (n: number) => String(n).padStart(2, "0");
    // Başındaki apostrof Excel'in değeri dar tarih hücresine çevirip #### göstermesini önler.
    return `'${parca(tarih.getDate())}.${parca(tarih.getMonth() + 1)}.${tarih.getFullYear()} ${parca(tarih.getHours())}:${parca(tarih.getMinutes())}`;
  };
  return gorevler.map((g) => {
    const log = g.is_loglari[g.is_loglari.length - 1];
    return [
      g.bloklar?.blok_adi ?? "—",
      g.is_basligi,
      g.aciklama ?? "",
      g.personel?.ad_soyad ?? "Atanmadı",
      g.aciliyet === "acil" ? "ACİL" : "Normal",
      DURUM_ETIKET[g.durum],
      tarihMetni(g.olusturma_tarihi),
      log ? tarihMetni(log.tamamlanma_tarihi) : "",
      log?.foto_url ? "Var" : "Yok",
    ];
  });
}

function dosyaAdi(uzanti: string) {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `selimpasa-is-raporu-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.${uzanti}`;
}

export function RaporIndir({ gorevler }: { gorevler: Gorev[] }) {
  const bosMu = gorevler.length === 0;

  function excelIndir() {
    if (bosMu) {
      toast.error("Raporlanacak kayıt yok.");
      return;
    }
    const hucre = (deger: unknown) => {
      let metin = String(deger ?? "").replace(/\r?\n/g, " ");
      // Excel formül enjeksiyonu: kullanıcı metni formül olarak çalıştırılmasın.
      if (/^[=+\-@]/.test(metin)) metin = `'${metin}`;
      return `"${metin.replace(/"/g, '""')}"`;
    };
    const csv = [BASLIKLAR, ...satirlar(gorevler)]
      .map((satir) => satir.map(hucre).join(";"))
      .join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const baglanti = document.createElement("a");
    baglanti.href = url;
    baglanti.download = dosyaAdi("csv");
    baglanti.click();
    URL.revokeObjectURL(url);
    toast.success("Excel uyumlu CSV raporu indirildi.");
  }

  function pdfIndir() {
    if (bosMu) {
      toast.error("Raporlanacak kayıt yok.");
      return;
    }
    const tarih = new Date().toLocaleString("tr-TR");
    const govde = satirlar(gorevler)
      .map(
        (r) =>
          `<tr>${r
            .map(
              (h, i) =>
                `<td${i === 4 && h === "ACİL" ? ' class="acil"' : ""}>${String(h).replace(/[<>&]/g, "")}</td>`,
            )
            .join("")}</tr>`,
      )
      .join("");
    const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>X Sitesi — İş Raporu</title><style>
      *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
      body{margin:24px;color:#0f172a}
      h1{font-size:18px;margin:0}
      p.alt{font-size:12px;color:#64748b;margin:4px 0 16px}
      table{width:100%;border-collapse:collapse;font-size:10px}
      th,td{border:1px solid #cbd5e1;padding:5px 6px;text-align:left;vertical-align:top}
      th{background:#1e3a8a;color:#fff}
      tr:nth-child(even) td{background:#f8fafc}
      td.acil{color:#b91c1c;font-weight:bold}
      @page{size:A4 landscape;margin:12mm}
    </style></head><body>
      <h1>X Sitesi — Saha İş Raporu</h1>
      <p class="alt">Oluşturma: ${tarih} · Toplam ${gorevler.length} kayıt</p>
      <table><thead><tr>${BASLIKLAR.map((b) => `<th>${b}</th>`).join("")}</tr></thead><tbody>${govde}</tbody></table>
      <script>window.onload=function(){window.print()}</script>
    </body></html>`;
    const pencere = window.open("", "_blank");
    if (!pencere) {
      toast.error("Tarayıcı yeni sekmeyi engelledi. Pop-up izni verin.");
      return;
    }
    pencere.document.write(html);
    pencere.document.close();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full sm:w-auto">
          <Download className="mr-2 h-4 w-4" />
          Rapor İndir
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{gorevler.length} kayıt raporlanacak</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={pdfIndir}>
          <FileText className="mr-2 h-4 w-4 text-destructive" />
          PDF olarak indir
        </DropdownMenuItem>
        <DropdownMenuItem onClick={excelIndir}>
          <FileSpreadsheet className="mr-2 h-4 w-4 text-status-tamam" />
          Excel uyumlu CSV indir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
