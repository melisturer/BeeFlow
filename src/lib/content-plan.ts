import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { PlanPeriod } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { contentTypeLabels, planPeriodLabels } from "@/lib/labels";
import type {
  CompanyContentPlan,
  ContentPlanItem,
  ContentPlanType,
} from "@/lib/content-plan-types";

export type { CompanyContentPlan, ContentPlanItem, ContentPlanType };
export type ContentPlanTargets = {
  planPeriod: PlanPeriod;
  planPosts: number;
  planStories: number;
  planReels: number;
  planVideos: number;
};

export function planPeriodRange(period: PlanPeriod, when: Date = new Date()) {
  if (period === "DAILY") {
    return { start: startOfDay(when), end: endOfDay(when) };
  }
  if (period === "WEEKLY") {
    return {
      start: startOfWeek(when, { weekStartsOn: 1 }),
      end: endOfWeek(when, { weekStartsOn: 1 }),
    };
  }
  return { start: startOfMonth(when), end: endOfMonth(when) };
}

export function planPeriodLabel(period: PlanPeriod) {
  return planPeriodLabels[period];
}

function emptyCounts(): Record<ContentPlanType, number> {
  return {
    POST: 0,
    STORY: 0,
    REEL: 0,
    VIDEO: 0,
  };
}

function toItems(
  targets: ContentPlanTargets,
  counts: Record<ContentPlanType, number>,
): ContentPlanItem[] {
  return [
    {
      type: "POST",
      label: contentTypeLabels.POST,
      done: counts.POST,
      target: targets.planPosts,
    },
    {
      type: "STORY",
      label: contentTypeLabels.STORY,
      done: counts.STORY,
      target: targets.planStories,
    },
    {
      type: "REEL",
      label: contentTypeLabels.REEL,
      done: counts.REEL,
      target: targets.planReels,
    },
    {
      type: "VIDEO",
      label: contentTypeLabels.VIDEO,
      done: counts.VIDEO,
      target: targets.planVideos,
    },
  ];
}

function contentDateFilter(start: Date, end: Date) {
  return {
    OR: [
      { publishAt: { gte: start, lte: end } },
      {
        publishAt: null,
        createdAt: { gte: start, lte: end },
      },
    ],
  };
}

/** Açık görevlerdeki hedefleri topla; dönem en kısa olanı kullan. */
export async function targetsFromOpenTasks(
  companyId: string,
  opts?: { dailyOnly?: boolean; taskId?: string },
): Promise<ContentPlanTargets> {
  const tasks = await prisma.task.findMany({
    where: {
      companyId,
      status: { not: "DONE" },
      ...(opts?.taskId ? { id: opts.taskId } : {}),
      ...(opts?.dailyOnly ? { planPeriod: "DAILY" } : {}),
      OR: [
        { planPosts: { gt: 0 } },
        { planStories: { gt: 0 } },
        { planReels: { gt: 0 } },
        { planVideos: { gt: 0 } },
      ],
    },
    select: {
      planPeriod: true,
      planPosts: true,
      planStories: true,
      planReels: true,
      planVideos: true,
    },
  });

  const targets: ContentPlanTargets = {
    planPeriod: "WEEKLY",
    planPosts: 0,
    planStories: 0,
    planReels: 0,
    planVideos: 0,
  };

  if (tasks.length === 0) return targets;

  const rank = { DAILY: 0, WEEKLY: 1, MONTHLY: 2 } as const;
  let bestPeriod: PlanPeriod = "MONTHLY";
  let bestRank = 3;

  for (const task of tasks) {
    targets.planPosts += task.planPosts;
    targets.planStories += task.planStories;
    targets.planReels += task.planReels;
    targets.planVideos += task.planVideos;
    const r = rank[task.planPeriod];
    if (r < bestRank) {
      bestRank = r;
      bestPeriod = task.planPeriod;
    }
  }
  targets.planPeriod = bestPeriod;
  return targets;
}

export function targetsToTypeCounts(
  targets: ContentPlanTargets,
): Array<{ type: ContentPlanType; count: number }> {
  return [
    { type: "POST" as const, count: targets.planPosts },
    { type: "STORY" as const, count: targets.planStories },
    { type: "REEL" as const, count: targets.planReels },
    { type: "VIDEO" as const, count: targets.planVideos },
  ].filter((row) => row.count > 0);
}

/** Firma için açık görev hedeflerine göre içerik planı. */
export async function getCompanyContentPlan(
  companyId: string,
  when: Date = new Date(),
): Promise<CompanyContentPlan | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) return null;

  const targets = await targetsFromOpenTasks(companyId);
  const { start, end } = planPeriodRange(targets.planPeriod, when);
  const contents = await prisma.content.findMany({
    where: {
      companyId,
      ...contentDateFilter(start, end),
    },
    select: { type: true },
  });

  const counts = emptyCounts();
  for (const c of contents) counts[c.type] += 1;

  return {
    companyId: company.id,
    companyName: company.name,
    period: targets.planPeriod,
    periodLabel: planPeriodLabel(targets.planPeriod),
    items: toItems(targets, counts),
  };
}

export async function getCompaniesContentPlans(
  when: Date = new Date(),
): Promise<
  Array<{
    id: string;
    name: string;
    planPeriod: PlanPeriod;
    periodLabel: string;
    planPosts: number;
    planStories: number;
    planReels: number;
    planVideos: number;
    items: ContentPlanItem[];
  }>
> {
  const companies = await prisma.company.findMany({
    where: { status: { not: "ARCHIVED" } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const results = await Promise.all(
    companies.map(async (company) => {
      const targets = await targetsFromOpenTasks(company.id);
      const { start, end } = planPeriodRange(targets.planPeriod, when);
      const contents = await prisma.content.findMany({
        where: {
          companyId: company.id,
          ...contentDateFilter(start, end),
        },
        select: { type: true },
      });
      const counts = emptyCounts();
      for (const c of contents) counts[c.type] += 1;
      return {
        id: company.id,
        name: company.name,
        ...targets,
        periodLabel: planPeriodLabel(targets.planPeriod),
        items: toItems(targets, counts),
      };
    }),
  );

  return results;
}

export function parsePlanInt(formData: FormData, key: string) {
  const raw = formData.get(key);
  if (raw == null || String(raw).trim() === "") return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), 999);
}
