import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { fotoUrlAl } from "@/lib/saha-api";
import { cn } from "@/lib/utils";

export function FotoGoruntuleyici({
  yol,
  className,
  alt,
}: {
  yol: string | null;
  className?: string;
  alt: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let iptal = false;
    if (!yol) {
      setUrl(null);
      return;
    }
    fotoUrlAl(yol).then((u) => {
      if (!iptal) setUrl(u);
    });
    return () => {
      iptal = true;
    };
  }, [yol]);

  if (!yol || !url) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg bg-muted text-muted-foreground",
          className,
        )}
      >
        <ImageOff className="h-5 w-5" />
      </div>
    );
  }

  return <img src={url} alt={alt} loading="lazy" className={cn("object-cover", className)} />;
}