"use client";

import { useState } from "react";
import {
  FormField,
  TextInput,
} from "@/components/ui/form-field";
import { contentTypeLabels } from "@/lib/labels";
import type { ContentType } from "@/generated/prisma/enums";
import type { PlanTimes } from "@/lib/plan-times";

type Counts = {
  planPosts: number;
  planStories: number;
  planReels: number;
  planVideos: number;
};

const SPECS: Array<{
  type: ContentType;
  countKey: keyof Counts;
  label: string;
  inputId: string;
  inputName: string;
}> = [
  {
    type: "POST",
    countKey: "planPosts",
    label: "Post hedefi",
    inputId: "planPosts",
    inputName: "planPosts",
  },
  {
    type: "STORY",
    countKey: "planStories",
    label: "Story hedefi",
    inputId: "planStories",
    inputName: "planStories",
  },
  {
    type: "REEL",
    countKey: "planReels",
    label: "Reel hedefi",
    inputId: "planReels",
    inputName: "planReels",
  },
  {
    type: "VIDEO",
    countKey: "planVideos",
    label: "Video hedefi",
    inputId: "planVideos",
    inputName: "planVideos",
  },
];

function clampCount(n: number) {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), 24);
}

export function PlanScheduleFields({
  initialCounts,
  initialTimes,
}: {
  initialCounts?: Partial<Counts>;
  initialTimes?: PlanTimes;
}) {
  const [counts, setCounts] = useState<Counts>({
    planPosts: initialCounts?.planPosts ?? 0,
    planStories: initialCounts?.planStories ?? 0,
    planReels: initialCounts?.planReels ?? 0,
    planVideos: initialCounts?.planVideos ?? 0,
  });
  const [times, setTimes] = useState<PlanTimes>(() => {
    const base: PlanTimes = { ...initialTimes };
    for (const { type, countKey } of SPECS) {
      const count = clampCount(initialCounts?.[countKey] ?? 0);
      const existing = base[type] ?? [];
      base[type] = Array.from({ length: count }, (_, i) => existing[i] ?? "12:00");
    }
    return base;
  });

  function setCount(key: keyof Counts, type: ContentType, raw: string) {
    const next = clampCount(Number(raw));
    setCounts((c) => ({ ...c, [key]: next }));
    setTimes((prev) => {
      const current = prev[type] ?? [];
      const list = Array.from(
        { length: next },
        (_, i) => current[i] ?? "12:00",
      );
      return { ...prev, [type]: list };
    });
  }

  function setTime(type: ContentType, index: number, value: string) {
    setTimes((prev) => {
      const list = [...(prev[type] ?? [])];
      list[index] = value || "12:00";
      return { ...prev, [type]: list };
    });
  }

  const hasAny =
    counts.planPosts +
      counts.planStories +
      counts.planReels +
      counts.planVideos >
    0;

  return (
    <div className="contents">
      {SPECS.map((spec) => (
        <FormField
          key={spec.inputId}
          label={spec.label}
          htmlFor={spec.inputId}
        >
          <TextInput
            id={spec.inputId}
            name={spec.inputName}
            type="number"
            min={0}
            max={24}
            value={counts[spec.countKey]}
            onChange={(e) =>
              setCount(spec.countKey, spec.type, e.target.value)
            }
          />
        </FormField>
      ))}

      {hasAny ? (
        <div className="md:col-span-2 space-y-3 rounded-[10px] border border-[var(--da-line)] bg-white/60 p-3">
          <div>
            <p className="text-sm font-semibold text-[var(--da-ink)]">
              Yayın saatleri
            </p>
            <p className="mt-0.5 text-xs text-[var(--da-muted)]">
              Her paylaşım için saat gir — takvim ve Dashboard’da bu saatte
              görünür.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {SPECS.map((spec) => {
              const count = counts[spec.countKey];
              if (count <= 0) return null;
              const list = times[spec.type] ?? [];
              return (
                <div key={spec.type} className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--da-muted)]">
                    {contentTypeLabels[spec.type]}
                  </p>
                  {Array.from({ length: count }, (_, i) => (
                    <label
                      key={`${spec.type}-${i}`}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="text-[var(--da-ink)]">
                        {contentTypeLabels[spec.type]} {i + 1}
                      </span>
                      <input
                        type="time"
                        name={`planTime_${spec.type}_${i}`}
                        value={list[i] ?? "12:00"}
                        onChange={(e) =>
                          setTime(spec.type, i, e.target.value)
                        }
                        className="rounded-lg border border-[var(--da-line)] bg-white px-2 py-1.5 text-sm"
                        required
                      />
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
