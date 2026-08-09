import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// TODO: Site yönetiminin gerçek WhatsApp destek numarasını buraya yazın.
// Ülke kodu olmadan numara girilmeyecek (örnek: 905331234567).
const WHATSAPP_DESTEK_NUMARASI = "905332222222";
const WHATSAPP_MESAJ =
  "Merhaba, Selimpaşa Emlak Konutları Saha Takip sistemi hakkında destek almak istiyorum.";

export function YardimButonu() {
  const url = `https://wa.me/${WHATSAPP_DESTEK_NUMARASI}?text=${encodeURIComponent(
    WHATSAPP_MESAJ,
  )}`;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            size="icon"
            className="fixed bottom-4 right-4 z-40 h-12 w-12 rounded-full shadow-card sm:bottom-6 sm:right-6 sm:h-14 sm:w-14"
            aria-label="WhatsApp Destek Hattı"
          >
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title="WhatsApp Destek Hattı"
            >
              <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">WhatsApp Destek Hattı</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
