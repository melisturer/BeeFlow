import type { PlanPeriod } from "@/generated/prisma/enums";

export type ContentPlanType = "POST" | "STORY" | "REEL" | "VIDEO";

export type ContentPlanItem = {
  type: ContentPlanType;
  label: string;
  done: number;
  target: number;
};

export type CompanyContentPlan = {
  companyId: string;
  companyName: string;
  period: PlanPeriod;
  periodLabel: string;
  items: ContentPlanItem[];
};
