# BeeFlow

Dijital pazarlama ajansları için tek-ajans, web tabanlı operasyon ve sosyal medya yönetim platformu (MVP).

## Stack

- Next.js (App Router) + TypeScript
- MySQL + Prisma
- HeroUI + Tailwind CSS
- Auth.js (Credentials)

## Kurulum

1. Bağımlılıklar:

```bash
npm install
```

2. MySQL:

- Docker: `docker compose up -d`
- veya yerel portable: `npm run mysql:start` (macOS arm64 `.tools` içinde)

3. Ortam:

```bash
cp .env.example .env
```

4. Şema + seed:

```bash
npm run db:setup
```

5. Geliştirme:

```bash
npm run dev
```

## Demo hesaplar

| Rol | E-posta | Şifre |
|-----|---------|-------|
| Admin | admin@beeflow.local | password123 |
| Çalışan | calisan@beeflow.local | password123 |

## Modüller

Dashboard, Firmalar, Sosyal hesaplar, İçerik + onay, Takvim (sürükle-bırak), Görevler, Bildirimler, Toplantılar, Raporlar, Aktivite geçmişi, Ajans notları, Arama.

Yayınlama manueldir (sosyal API yok).
