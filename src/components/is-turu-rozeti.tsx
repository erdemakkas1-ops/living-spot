import { IS_TURU_ETIKET, IS_TURU_SINIF, type IsTuru } from "@/lib/saha-types";

export function IsTuruRozeti({ turu }: { turu: IsTuru | null | undefined }) {
  const t = turu ?? "genel";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${IS_TURU_SINIF[t]}`}
      title={IS_TURU_ETIKET[t]}
    >
      {IS_TURU_ETIKET[t]}
    </span>
  );
}
