export const roleLabels = {
  ADMIN: "Admin",
  EMPLOYEE: "Çalışan",
} as const;

export const companyStatusLabels = {
  ACTIVE: "Aktif",
  PASSIVE: "Pasif",
  ARCHIVED: "Arşiv",
} as const;

export const planPeriodLabels = {
  DAILY: "Günlük",
  WEEKLY: "Haftalık",
  MONTHLY: "Aylık",
} as const;

export const platformLabels = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  LINKEDIN: "LinkedIn",
  TIKTOK: "TikTok",
  X: "X",
  YOUTUBE: "YouTube",
} as const;

export const contentTypeLabels = {
  POST: "Post",
  STORY: "Story",
  REEL: "Reel",
  VIDEO: "Video",
} as const;

export const contentStatusLabels = {
  DRAFT: "Taslak",
  PREPARING: "Hazırlanıyor",
  TEAM_REVIEW: "Ekip Kontrolü",
  APPROVED: "Onaylandı",
  SCHEDULED: "Planlandı",
  PUBLISHED: "Yayınlandı",
} as const;

export const taskStatusLabels = {
  WAITING: "Bekliyor",
  IN_PROGRESS: "Yapılıyor",
  IN_REVIEW: "Kontrolde",
  DONE: "Tamamlandı",
} as const;

export const taskPriorityLabels = {
  LOW: "Düşük",
  NORMAL: "Normal",
  HIGH: "Yüksek",
  URGENT: "Acil",
} as const;

export const taskRecurrenceLabels = {
  NONE: "Yok (tek seferlik)",
  DAILY: "Her gün",
  WEEKLY: "Her hafta",
  MONTHLY: "Her ay",
} as const;

export const noteTypeLabels = {
  GENERAL: "Genel Not",
  QUICK: "Hızlı Not",
  MEETING: "Toplantı Notu",
  PINNED: "Sabit Not",
} as const;

export const noteCategoryLabels = {
  GENERAL: "Genel",
  DESIGN: "Tasarım",
  CONTENT: "İçerik",
  ADS: "Reklam",
  MEETING: "Toplantı",
  REMINDER: "Hatırlatma",
  OTHER: "Diğer",
} as const;
