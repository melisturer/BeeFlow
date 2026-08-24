"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { deleteTasksByIds } from "@/actions/tasks";

const BulkSelectionContext = createContext<{
  selected: Set<string>;
  toggle: (id: string, checked: boolean) => void;
} | null>(null);

export function WorkBulkList({
  children,
  totalCount,
  taskIds,
  allowDelete = false,
}: {
  children: ReactNode;
  totalCount: number;
  taskIds: string[];
  /** Yalnızca admin */
  allowDelete?: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback((id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const ids = taskIds ?? [];
  const allSelected =
    totalCount > 0 && ids.length > 0 && ids.every((id) => selected.has(id));
  const selectedCount = selected.size;

  const ctx = useMemo(() => ({ selected, toggle }), [selected, toggle]);

  function setAll(checked: boolean) {
    setSelected(checked ? new Set(ids) : new Set());
  }

  function onDelete() {
    if (!allowDelete || selectedCount === 0) return;
    if (
      !window.confirm(`${selectedCount} iş silinecek. Emin misiniz?`)
    ) {
      return;
    }
    setError(null);
    const toDelete = [...selected];
    startTransition(async () => {
      try {
        await deleteTasksByIds(toDelete);
        setSelected(new Set());
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Silinemedi");
      }
    });
  }

  if (!allowDelete) {
    return <div className="space-y-4">{children}</div>;
  }

  return (
    <BulkSelectionContext.Provider value={ctx}>
      <div className="space-y-4">
        <div className="bf-panel sticky top-3 z-10 flex flex-wrap items-center justify-between gap-3 border border-[var(--da-line)] bg-white/95 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="size-4 accent-[var(--da-ink)]"
                checked={allSelected}
                ref={(el) => {
                  if (el) {
                    el.indeterminate =
                      selectedCount > 0 && selectedCount < totalCount;
                  }
                }}
                onChange={(e) => setAll(e.target.checked)}
              />
              Tümünü seç
            </label>
            <span className="text-sm text-black/50">
              {selectedCount > 0
                ? `${selectedCount} iş seçili`
                : `${totalCount} iş`}
            </span>
            {error ? (
              <span className="text-sm text-[var(--da-danger)]">{error}</span>
            ) : null}
          </div>
          <button
            type="button"
            className="bf-btn text-sm text-white disabled:opacity-40"
            style={{ background: "var(--da-danger, #c23b3b)" }}
            disabled={selectedCount === 0 || pending}
            onClick={onDelete}
          >
            {pending ? "Siliniyor…" : "Seçilenleri sil"}
          </button>
        </div>
        {children}
      </div>
    </BulkSelectionContext.Provider>
  );
}

export function WorkBulkItem({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const ctx = useContext(BulkSelectionContext);
  if (!ctx) return <>{children}</>;

  return (
    <div className="flex items-start gap-3">
      <label className="mt-5 shrink-0 cursor-pointer pl-1">
        <span className="sr-only">Seç</span>
        <input
          type="checkbox"
          className="size-4 accent-[var(--da-ink)]"
          checked={ctx.selected.has(id)}
          onChange={(e) => ctx.toggle(id, e.target.checked)}
        />
      </label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
