# Block Manager

Bu proje; 842 daire, 55 blok ve 20 aktif saha personelinden oluşan dev bir konut sitesi için hazırlanacak "Yerel Sunucu (On-Premise / Supabase) Tabanlı Saha İş ve Personel Takip Yazılımı"dır.

Lütfen bu uygulamayı responsive (hem Mobil İşçi Ekranı hem de Masaüstü İK Yönetim Paneli) olacak şekilde tasarla.

### 🏗️ 1. MİMARİ VE VERİTABANI (Supabase Integration)

Aşağıdaki tabloları ve ilişkilerini içerecek şekilde Supabase veritabanı şemasını ve UI bileşenlerini oluştur:

- `bloklar`: id, blok_adi (Örn: A1, B12, Sosyal Tesis)

- `personel`: id, ad_soyad, rol ('ik', 'personel'), telefon, pin_kodu

- `gorevler`: id, blok_id, personel_id, is_basligi, aciklama, durum ('bekliyor', 'devam_ediyor', 'tamamlandi'), aciliyet ('normal', 'acil'), olusturma_tarihi

- `is_loglari`: id, gorev_id, foto_url, personel_notu, tamamlanma_tarihi

---

### 🖥️ 2. İK VE YÖNETİM WEB PANELİ (Masaüstü Görünümü)

Yönetim odasındaki İK personelinin kullanacağı dashboard:

- **Üst Özet Kartları (Stats):** Toplam Görev Sayısı, Bekleyen İşler, Tamamlanan İşler, Sahadaki Aktif Personel Sayısı.

- **Görev Atama Modülü:** 55 blok listesinden seçim yapıp, görevi tanımlayıp 20 personelden birine atayabileceği modal/form.

- **Canlı Takip Tablosu:** Blok bazlı filtrelenebilir (Örn: Sadece B5 Bloğundaki İşler), durum rengine göre ayrışmış (Sarı: Bekliyor, Yeşil: Tamamlandı) dinamik tablo.

- **Fotoğraf & Onay Akışı:** İşçilerin sahadan çekip yüklediği fotoğrafları ve tuttukları notları büyüteç/modal ile inceleme alanı.

---

### 📱 3. PERSONEL MOBİL UYGULAMASI (Mobil Uygun Görünüm)

20 saha personelinin telefonda kullanacağı sade arayüz:

- **Basit PIN Girişi:** Kullanıcının telefon ve PIN ile hızlı giriş yapabileceği sade ekran.

- **Günlük To-Do Listesi:** Personelin üzerine atanan işlerin kartlar halinde listelenmesi (Blok Adı, İş Tanımı, Aciliyet Etiketi).

- **Görev Detay & İş Kapama Ekranı:** * "İşe Başla" butonu.

  * "Kameradan Fotoğraf Yükle" alanı (Fotoğraf yüklenmeden görev kapatılamasın).

  * Personel notu yazma alanı.

  * "Görevi Tamamla" butonu.

- **Offline / Sync İndikatörü:** "İnternet Bağlantısı Var/Yok" durumunu belirten küçük bir durum rozeti (Badge).

---

### 🎨 4. TASARIM VE KULLANICI DENEYİMİ (UI/UX)

- Modern, temiz ve kurumsal site yönetimi teması (Koyu lacivert, mavi ve açık gri tonları).

- Mobil cihazlarda tek elle rahat kullanılabilecek büyük butonlar ve yüksek okunabilirlik.

- Lucide-react ikonları kullanılsın (CheckCircle, Camera, Building, User, AlertCircle).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://living-spot.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bdebcb61-a57a-4645-ba36-0f8382ffe0e1).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
