/**
 * Yönetim işlemleri için denetim kaydı (audit log).
 * Buraya asla PIN, PIN hash'i, oturum tokenı veya gizli anahtar yazılmaz;
 * telefon numaraları yalnızca maskeli biçimde saklanır.
 */
export type AuditIslem =
  | "personel_ekle"
  | "personel_duzenle"
  | "personel_pin_degistir"
  | "personel_aktiflik"
  | "personel_sil";

/** "05335335353" -> "0533***53" biçiminde maskeler. */
export function telefonMaskele(telefon: string | null | undefined): string {
  const t = (telefon ?? "").replace(/\D/g, "");
  if (!t) return "-";
  if (t.length <= 6) return `${t.slice(0, 2)}***`;
  return `${t.slice(0, 4)}***${t.slice(-2)}`;
}

type Sb = { from: (t: string) => { insert: (v: unknown) => Promise<{ error: unknown }> } };

/** Denetim kaydını yazar; log hatası ana işlemi bozmaz. */
export async function auditYaz(
  sb: Sb,
  kayit: {
    yonetici_id: string;
    islem_turu: AuditIslem;
    hedef_personel_id?: string | null;
    aciklama?: string;
  },
) {
  try {
    await sb.from("audit_loglari").insert({
      yonetici_id: kayit.yonetici_id,
      islem_turu: kayit.islem_turu,
      hedef_personel_id: kayit.hedef_personel_id ?? null,
      aciklama: (kayit.aciklama ?? "").slice(0, 500),
    });
  } catch {
    /* denetim kaydı yazılamazsa işlem devam eder */
  }
}
