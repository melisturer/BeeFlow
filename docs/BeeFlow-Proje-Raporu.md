# BeeFlow — Proje Raporu

**Proje adı:** BeeFlow  
**Konu:** Dijital pazarlama ajansları için web tabanlı operasyon ve sosyal medya yönetim platformu (MVP)  
**Tarih:** Ağustos 2026  

---

## 1. Özet

BeeFlow, tek bir dijital pazarlama ajansının günlük operasyonlarını tek panelden yönetmesi için geliştirilmiş bir web uygulamasıdır. Firmalar, sosyal medya hesapları, içerik onay süreçleri, görevler, takvim, bildirimler, toplantılar ve raporlar aynı sistem içinde toplanır.

Proje, **Next.js**, **MySQL** ve **HeroUI** kullanılarak geliştirilmiştir. Veri erişimi **Prisma** ORM ile sağlanır; kimlik doğrulama **Auth.js (NextAuth)** ile yapılır.

---

## 2. Problem ve Amaç

### 2.1 Problem
Ajans ekipleri firma takibi, içerik planı, onay süreci ve görev yönetimini çoğu zaman dağınık araçlarla yürütür. Bu durum:

- işlerin kaçırılmasına,
- onay durumunun belirsiz kalmasına,
- ekip içi iletişimin kopmasına

yol açabilir.

### 2.2 Amaç
Tek bir web uygulamasında:

- firma ve sosyal hesap yönetimi,
- içerik üretim / onay / planlama akışı,
- görev ve takvim takibi,
- rol bazlı erişim (Admin / Çalışan),
- aktivite ve bildirim geçmişi

sağlamak.

### 2.3 Kapsam (MVP)
Bu sürümde sosyal medya platformlarına otomatik yayın API’si yoktur. Yayın işlemi manueldir; sistem planlama, onay ve operasyon takibine odaklanır.

---

## 3. Kullanılan Teknolojiler

| Katman | Teknoloji | Rolü |
|--------|-----------|------|
| Frontend / Framework | Next.js 16 (App Router) | Sayfalar, routing, sunucu tarafı işlemler |
| UI | React 19 + TypeScript | Bileşen tabanlı arayüz, tip güvenliği |
| Tasarım sistemi | HeroUI + Tailwind CSS 4 | Arayüz bileşenleri ve stil |
| Veritabanı | MySQL 8 | Kalıcı veri saklama |
| ORM | Prisma 7 | Şema yönetimi ve tip güvenli sorgular |
| Kimlik doğrulama | Auth.js (NextAuth v5) | Oturum, Credentials login |
| Validasyon | Zod | Form / veri doğrulama |
| Etkileşim | dnd-kit | Takvimde sürükle-bırak |
| Yardımcı | date-fns, bcryptjs | Tarih işlemleri, şifre hash |

### Neden bu stack?
- **Next.js:** Modern React uygulaması; sunucu ve istemci kodunu aynı projede yönetir.
- **MySQL:** İlişkisel veri (firmalar, içerikler, görevler, kullanıcılar) için uygun ve yaygın bir veritabanıdır.
- **HeroUI:** Hazır, tutarlı UI bileşenleri ile hızlı arayüz geliştirmeyi sağlar.
- **Prisma:** SQL’i doğrudan yazmadan tip güvenli veri erişimi sunar.

Bu üç ana teknoloji (Next.js, MySQL, HeroUI) birbiriyle uyumludur; aralarında teknik çakışma yoktur.

---

## 4. Sistem Mimarisi

```
Tarayıcı (HeroUI arayüz)
        │
        ▼
Next.js App Router
  ├── Sayfalar (dashboard / auth)
  ├── Server Actions (iş kuralları)
  └── Auth.js (oturum)
        │
        ▼
Prisma Client
        │
        ▼
MySQL (beeflow veritabanı)
```

### 4.1 Katmanlar
1. **Sunum katmanı:** React sayfaları ve HeroUI bileşenleri  
2. **İş mantığı:** `src/actions/` altındaki Server Actions  
3. **Kimlik / yetki:** Auth.js + middleware; Admin ve Çalışan rolleri  
4. **Veri katmanı:** Prisma şeması (`prisma/schema.prisma`) → MySQL  

### 4.2 Roller
- **Admin:** Firma, çalışan, iş, rapor ve aktivite yönetimi  
- **Çalışan:** Dashboard, takvim, bildirimler ve kendisine düşen işler  

---

## 5. Modüller ve Özellikler

| Modül | Açıklama |
|-------|----------|
| Dashboard | Özet görünüm, günlük operasyon girişi |
| Firmalar | Müşteri firmaların kaydı, durumu, atanan çalışan |
| Sosyal hesaplar | Instagram, Facebook, LinkedIn, TikTok, X, YouTube hesapları |
| İçerikler | Post / Story / Reel / Video; taslak → onay → planlı → yayınlandı akışı |
| Takvim | Planlanan içeriklerin takvimi; sürükle-bırak |
| Görevler | Öncelik, durum, tekrar, yorumlar |
| Bildirimler | Görev ve içerik olayları için uyarılar |
| Toplantılar | Toplantı kayıtları ve katılımcılar |
| Notlar | Ajans notları (genel, toplantı, sabitlenmiş vb.) |
| Raporlar | Operasyon özetleri (admin) |
| Aktiviteler | Sistemdeki işlem geçmişi |
| Arama | Kayıtlar arasında arama |
| Çalışanlar | Kullanıcı / rol yönetimi (admin) |

### İçerik durum akışı (özet)
`DRAFT` → `PREPARING` → `TEAM_REVIEW` → `APPROVED` → `SCHEDULED` → `PUBLISHED`

---

## 6. Veri Modeli (Özet)

Ana varlıklar:

- **User** — kullanıcı, rol, şifre hash  
- **Company** — firma bilgisi ve durum  
- **SocialAccount** — platform hesabı  
- **Content** + **ContentRevision** — içerik ve revizyon  
- **Task** + **TaskComment** — görev ve yorum  
- **Meeting** + **MeetingParticipant** — toplantı  
- **Notification**, **ActivityLog**, **AgencyNote** — bildirim, log, not  

İlişkiler Prisma şemasında tanımlanır; MySQL tabloları bu şemadan üretilir / senkronize edilir.

---

## 7. Kurulum ve Çalıştırma

### Gereksinimler
- Node.js / npm  
- MySQL (Docker veya projedeki portable MySQL: `npm run mysql:start`)  

### Adımlar
```bash
npm install
cp .env.example .env
npm run mysql:start    # veya: docker compose up -d
npm run db:setup       # şema + örnek veri
npm run dev
```

Uygulama: `http://localhost:3000`

### Demo hesaplar
| Rol | E-posta | Şifre |
|-----|---------|-------|
| Admin | admin@beeflow.local | password123 |
| Çalışan | calisan@beeflow.local | password123 |

---

## 8. Geliştirme Süreci

1. Gereksinimlerin ve MVP kapsamının belirlenmesi  
2. Veritabanı şemasının Prisma ile modellenmesi  
3. Auth ve rol bazlı erişimin kurulması  
4. Modüllerin sayfa + Server Action olarak geliştirilmesi  
5. HeroUI / Tailwind ile arayüzün tamamlanması  
6. Seed verisi ile demo senaryolarının hazırlanması  
7. Yerel ortamda test (MySQL + `npm run dev`)  

---

## 9. Test Senaryoları (Örnek)

1. Admin ile giriş yapılabiliyor mu?  
2. Firma oluşturulup listeleniyor mu?  
3. İçerik oluşturma ve durum değiştirme çalışıyor mu?  
4. Takvimde içerik görünüyor / taşınabiliyor mu?  
5. Çalışan rolü ile yönetim sayfalarına erişim engelleniyor mu?  
6. Bildirimler oluşuyor mu?  

---

## 10. Sonuç ve Gelecek Çalışmalar

### Sonuç
BeeFlow, ajans operasyonunu tek panelde toplayan çalışan bir MVP sunar. Next.js + MySQL + HeroUI yığını hedeflenen gereksinimlerle uyumludur; Prisma veri erişimini güvenli ve yönetilebilir kılar.

### Bilinen sınırlar
- Sosyal platformlara otomatik yayın yok (manuel süreç)  
- MVP odaklı; gelişmiş analitik / entegrasyonlar sonraki aşamada  

### Olası geliştirmeler
- Instagram / Meta vb. API entegrasyonları  
- Daha zengin raporlama ve dışa aktarım (PDF/Excel)  
- Dosya / medya depolama entegrasyonu  
- Bildirim kanallarının genişletilmesi (e-posta vb.)  

---

## 11. Kaynaklar

- Next.js: https://nextjs.org/docs  
- Prisma: https://www.prisma.io/docs  
- HeroUI: https://www.heroui.com  
- Auth.js: https://authjs.dev  
- MySQL: https://dev.mysql.com/doc  

---

*Bu rapor BeeFlow kod tabanı ve README bilgilerine dayanarak hazırlanmıştır.*
