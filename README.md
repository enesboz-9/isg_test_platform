# İSG Test Platformu (YEDAŞ)

İş Sağlığı ve Güvenliği konulu değerlendirme testi. Katılımcılar isim,
departman ve il bilgisiyle giriş yapar; soru havuzundan rastgele seçilen
20 soruyu 30 dakika içinde yanıtlar. Yönetici panelinden tüm sonuçlar,
yanlış yapılan sorular ve soru bazlı analitik izlenebilir.

## Teknolojiler

- **Next.js 14** (App Router) + React
- **Supabase** (Postgres + Auth + RLS)

## Kurulum

### 1. Supabase projesi oluşturun

1. [supabase.com](https://supabase.com) üzerinden yeni bir proje açın.
2. Sol menüden **SQL Editor**'e girin, `supabase/schema.sql` dosyasının
   tüm içeriğini yapıştırıp **Run** ile çalıştırın. Bu adım:
   - Tabloları (`provinces`, `departments`, `questions`, `test_sessions`,
     `test_session_questions`)
   - 5 sabit il (Samsun, Ordu, Çorum, Amasya, Sinop) ve örnek departmanları
   - Rastgele soru seçme, cevap kaydetme, test bitirme fonksiyonlarını
   - RLS (satır güvenliği) politikalarını
   - Soru analitiği görünümünü (`question_analytics`)
   oluşturur.
3. **Project Settings → API** sayfasından `Project URL` ve `anon public`
   anahtarını kopyalayın.
4. **Authentication → Users** sayfasından yönetici için bir kullanıcı
   oluşturun (email + şifre). Bu hesap yönetici paneline giriş için
   kullanılacak. *Not: Bu projede "authenticated" olan her kullanıcı admin
   kabul edilir, bu yüzden bu bölümden sadece güvendiğiniz kişilere hesap
   açın.*

### 2. Soru havuzunu doldurun

Yönetici paneline giriş yaptıktan sonra **Soru Havuzu** sayfasından
ISG sorularınızı tek tek ekleyebilirsiniz (soru metni, 4 seçenek, doğru
cevap). Testin anlamlı olması için en az 20-30 aktif soru eklemeniz önerilir
(havuzda kaç aktif soru varsa, her testte bunların arasından 20 tanesi
rastgele seçilir; havuzda 20'den az aktif soru varsa test yine çalışır
ama aynı sorular tekrar tekrar çıkabilir).

### 3. Projeyi çalıştırın

```bash
npm install
cp .env.local.example .env.local
# .env.local içine kendi Supabase URL ve anon key'inizi yazın
npm run dev
```

Tarayıcıda `http://localhost:3000` katılımcı giriş ekranı,
`http://localhost:3000/admin/login` yönetici giriş ekranıdır.

### 4. Yayına alma (deploy)

En kolay yol [Vercel](https://vercel.com) üzerinden bu klasörü bir GitHub
reposuna push edip Vercel'e bağlamaktır. Vercel proje ayarlarında
`NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` ortam
değişkenlerini eklemeyi unutmayın.

## Nasıl Çalışır

- **Katılımcı akışı:** `/` sayfasında isim + departman + il seçilir →
  `start_test_session` fonksiyonu 20 rastgele soru seçip bir oturum açar →
  `/test` sayfasında 30 dakikalık geri sayım başlar, her cevap anında
  `submit_answer` ile kaydedilir → süre dolunca veya "Testi Bitir"
  tıklanınca `finish_test_session` çağrılır ve skor hesaplanır.
- **Güvenlik:** Sorular ve doğru cevaplar, katılımcı tarafına asla
  doğrudan tablo sorgusuyla değil, sunucu tarafı (`security definer`)
  fonksiyonlarla verilir. Böylece bir katılımcı tarayıcı geliştirici
  araçlarını kullansa bile doğru cevapları veya başka katılımcıların
  sonuçlarını göremez.
- **Yönetici paneli:** `/admin` altındaki tüm sayfalar giriş kontrolü
  yapar (`useAdminGuard`). İl ve departman filtreleriyle sonuç listesi,
  her katılımcının yanlış yaptığı sorular, ve `/admin/analitik` sayfasında
  tüm katılımcılar bazında soru başına doğruluk oranı ve en çok yanlış
  yapılan sorular listelenir.

## Klasör Yapısı

```
app/
  page.js                 → katılımcı giriş formu
  test/page.js            → soru ekranı + 30dk sayaç
  sonuc/page.js           → katılımcının kendi sonuç ekranı
  admin/login/page.js     → yönetici girişi
  admin/page.js           → sonuç listesi + il/departman filtresi
  admin/sonuc/[id]/page.js→ tekil sonuç + yanlış sorular
  admin/analitik/page.js  → soru bazlı doğruluk analitiği
  admin/sorular/page.js   → soru havuzu yönetimi (ekle/pasifleştir/sil)
lib/
  supabaseClient.js       → Supabase bağlantısı
  useAdminGuard.js        → admin sayfaları için oturum kontrolü
supabase/
  schema.sql              → tüm veritabanı şeması (Supabase'e yapıştırılacak)
```

## Genişletme Fikirleri

- Departman listesini kendi organizasyon yapınıza göre `departments`
  tablosunda düzenleyin (varsayılan örnek departmanlar eklendi).
- Sonuçları Excel'e aktarma (CSV export) eklenebilir.
- Testi tamamlayanlara PDF sertifika üretilebilir.
- Soru başına konu/kategori etiketi eklenip analitik buna göre kırılabilir.
