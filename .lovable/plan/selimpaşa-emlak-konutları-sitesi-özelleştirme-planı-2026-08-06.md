# Selimpaşa Emlak Konutları Sitesi — Özelleştirme Planı

## Hedef
Mevcut "Saha İş Takip" yazılımını, kullanıcının gerçek sitesine özel veri, marka ve güvenlik ayarlarıyla yapılandırmak.

## Site Özeti
- **Site adı:** Selimpaşa Emlak Konutları Sitesi
- **Bloklar:** A Blok 12 adet, B Blok 15 adet, C Blok 28 adet (toplam 55 blok)
- **Yönetim Binası:** 1 adet; içinde muhasebe, halka ilişkiler, kafeterya, spor salonu ve havuz
- **Personel:** 20 aktif saha personeli
- **Kullanıcı kapsamı:** Yönetim + Personel (daire sakinleri katılmayacak)

## Yapılacak Adımlar

### 1. Veritabanı verilerini güncelle
- Mevcut demo bloklar (55 adet) ve personel (20 adet) kayıtlarını sil.
- Yeni blok listesini yükle: A1-A12, B1-B15, C1-C28, Yönetim Binası.
- Yönetim binasının departmanlarını (muhasebe, halka ilişkiler, kafeterya, spor salonu, havuz) ayrı alt alanlar veya görev kategorileri olarak ekleyeceğim.
- Kullanıcıdan alınacak 20 personel ve yönetim kullanıcısı bilgilerini yükleyeceğim.

### 2. Personel ve yönetim kadrosu bilgilerini topla
- Her personel için: ad soyad, telefon, rol/pozisyon (örn. temizlik, güvenlik, teknik, bahçıvan), PIN kodu.
- Yönetim/İK paneline erişecek kullanıcı(lar) için ayrı telefon ve PIN.
- Veriler CSV, Excel veya düz metin olarak paylaşılabilir.

### 3. Markalaşma (beyaz etiket)
- Giriş ekranı, panel ve saha ekranındaki "842 daire / 55 blok" metinleri güncellenecek.
- Uygulama başlığı "Selimpaşa Emlak Konutları Sitesi — Saha İş Takip" olacak.
- Meta başlıkları ve açıklamaları site adına göre düzenlenecek.
- Kullanıcı logo sağlarsa veya site adına özel logo isterse favicon ve login ikonu/logo güncellenecek.

### 4. Güvenlik ve erişim
- Mevcut demo giriş bilgileri (05001112233 / 1234) devre dışı bırakılacak.
- PIN'ler veritabanında düz metin yerine hash'li saklanacak (sistem dışarı açılacaksa zorunlu).
- Yönetim paneline erişim sadece "ik" / yönetim rolüne verilecek.
- İstenirse ayrı muhasebe ve halka ilişkiler yönetim rolleri eklenecek.

### 5. Yönetim binası departmanları
- Görev atama ekranında yönetim binası seçildiğinde alt alanlar (muhasebe, halka ilişkiler, kafeterya, spor salonu, havuz) görünecek.
- Bu alanlar hem görev filtresinde hem de personel mobil ekranında okunaklı gösterilecek.

### 6. Test ve yayınlama
- Önce yerel önizlemede giriş, görev atama, fotoğraf yükleme ve iş kapatma akışları test edilecek.
- Kullanıcı onayı sonrası uygulama yayınlanacak ve public URL paylaşılacak.

## Kullanıcıdan İstenen Bilgiler
1. Site adının doğru yazılışı: "Selimpaşa Emlak Konutları Sitesi" mi yoksa farklı mı?
2. Yönetim binası departmanları ayrı "blok" olarak mı eklensin, yoksa tek "Yönetim Binası" altında alt alanlar olarak mı?
3. 20 personel ve yönetim kullanıcısı için: ad soyad, telefon, görev/rol, PIN kodu (güvenli paylaşım).
4. Mevcut yönetim paneline ek olarak muhasebe ve halka ilişkiler için ayrı yönetim hesapları isteniyor mu?
5. Logo ve renk tercihi var mı? (Varsayılan kurumsal lacivert tema kalabilir.)
