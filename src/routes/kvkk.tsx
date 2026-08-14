import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Database, Eye, MapPin, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/kvkk")({
  ssr: false,
  head: () => ({ meta: [{ title: "KVKK Aydınlatma Metni | Saha Takip" }] }),
  component: KvkkSayfasi,
});

function KvkkSayfasi() {
  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:py-12">
      <article className="mx-auto max-w-3xl rounded-2xl border bg-card p-5 shadow-card sm:p-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
          <ArrowLeft className="h-4 w-4" /> Giriş ekranına dön
        </Link>
        <div className="mt-6 flex items-start gap-3">
          <ShieldCheck className="mt-1 h-7 w-7 shrink-0 text-primary" />
          <div><h1 className="text-2xl font-bold">Çalışan Aydınlatma Metni</h1><p className="mt-1 text-sm text-muted-foreground">Saha İş Takip Sistemi · Son güncelleme: 13 Ağustos 2026</p></div>
        </div>

        <div className="mt-8 space-y-7 text-sm leading-6">
          <section><h2 className="font-bold">1. Veri sorumlusu</h2><p className="mt-2">Bu sistem kapsamında kişisel verilerin veri sorumlusu, personelin bağlı bulunduğu site yönetimi/işverendir. KVKK kapsamındaki talepler yönetim birimine yazılı olarak veya kurumun personele bildirdiği iletişim kanalı üzerinden iletilebilir.</p></section>
          <section><h2 className="font-bold">2. İşlenen kişisel veriler</h2><ul className="mt-2 list-disc space-y-1 pl-5"><li>Ad-soyad, görev/rol ve telefon numarası</li><li>Görev atamaları, durum bilgileri, personel notları ve işlem tarihleri</li><li>Görev tamamlamayı kanıtlayan iş fotoğrafları</li><li>Çalışma süresince iletilen konum, doğruluk ve son görülme bilgileri</li><li>Hesap ve güvenlik işlem kayıtları; PIN kodunun yalnız geri döndürülemez özeti</li></ul></section>
          <section><h2 className="font-bold">3. İşleme amaçları ve hukuki sebepler</h2><p className="mt-2">Veriler; işin planlanması, görevin doğru personele atanması, iş sağlığı ve operasyon güvenliği, tamamlanan işlerin belgelenmesi, yetkisiz erişimin önlenmesi ve hukuki yükümlülüklerin yerine getirilmesi amaçlarıyla; KVKK m.5/2 kapsamındaki sözleşmenin ifası, hukuki yükümlülük ve meşru menfaat sebeplerine dayanılarak işlenir. Açık rıza gerektiren ayrı bir faaliyet olursa ayrıca ve özgür iradeyle onay alınır.</p></section>
          <section className="grid gap-3 sm:grid-cols-2"><BilgiKarti icon={MapPin} baslik="Konum saklama süresi">Konum yalnız yönetimin personel bazında belirlediği çalışma ve ek çalışma saatlerinde alınır. Kayıtlar en fazla 30 gün tutulur.</BilgiKarti><BilgiKarti icon={Database} baslik="Görev ve fotoğraflar">Görev fotoğrafları 180 gün; tamamlanmış görev kayıtları ve denetim kayıtları 2 yıl saklanır. Süresi dolan kayıtlar otomatik temizlenir. Aktif görevler bu işlemden etkilenmez.</BilgiKarti><BilgiKarti icon={Eye} baslik="Erişim">Personel yalnız kendi görevlerini görür. Personel listesi, konumlar ve yönetim kayıtları yalnız yetkili yönetici/İK tarafından görüntülenir.</BilgiKarti><BilgiKarti icon={ShieldCheck} baslik="Güvenlik">Oturumlar güvenli çerezle korunur; PIN’ler açık biçimde saklanmaz; fotoğraf metadata’sı yüklemede temizlenir.</BilgiKarti></section>
          <section><h2 className="font-bold">4. Veri aktarımı ve toplama yöntemi</h2><p className="mt-2">Veriler uygulamadaki formlar, görev işlemleri, cihaz kamerası/dosya seçimi ve izin verildiğinde cihaz konum hizmeti üzerinden elektronik ortamda toplanır. Hizmetin çalışması için kullanılan barındırma ve veritabanı sağlayıcılarıyla yalnız gerekli ölçüde ve uygun güvenlik tedbirleriyle paylaşılabilir; yetkisiz üçüncü kişilere açıklanmaz.</p></section>
          <section><h2 className="font-bold">5. KVKK kapsamındaki haklarınız</h2><p className="mt-2">KVKK m.11 uyarınca verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, amacına uygun kullanılıp kullanılmadığını öğrenme, aktarılan kişileri bilme, düzeltme, şartları oluştuğunda silme/yok etme, yapılan işlemlerin aktarılan kişilere bildirilmesini isteme, otomatik analiz sonucuna itiraz etme ve zararın giderilmesini talep etme haklarına sahipsiniz.</p></section>
          <p className="rounded-xl bg-muted p-4 text-xs text-muted-foreground">Bu ekran aydınlatma amacı taşır; “okudum” düğmesi veya sisteme giriş, açık rıza yerine geçmez.</p>
        </div>
      </article>
    </main>
  );
}

function BilgiKarti({ icon: Icon, baslik, children }: { icon: typeof MapPin; baslik: string; children: React.ReactNode }) {
  return <div className="rounded-xl border p-4"><Icon className="h-5 w-5 text-primary" /><h3 className="mt-2 font-bold">{baslik}</h3><p className="mt-1 text-muted-foreground">{children}</p></div>;
}
