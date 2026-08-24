"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@heroui/react";
import {
  FormField,
  SelectInput,
  TextAreaInput,
  TextInput,
} from "@/components/ui/form-field";
import { ContentPlanSummary } from "@/components/contents/content-plan-summary";
import type { ContentPlanItem } from "@/lib/content-plan-types";
import {
  contentTypeLabels,
  platformLabels,
} from "@/lib/labels";

type CompanyOption = {
  id: string;
  name: string;
  periodLabel: string;
  items: ContentPlanItem[];
};

export function NewContentForm({
  companies,
  action,
  cancelHref = "/",
}: {
  companies: CompanyOption[];
  action: (formData: FormData) => Promise<void>;
  cancelHref?: string;
}) {
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");

  const selected = useMemo(
    () => companies.find((c) => c.id === companyId) ?? null,
    [companies, companyId],
  );

  return (
    <div className="space-y-4">
      {selected ? (
        <ContentPlanSummary
          title={`${selected.name} · ${selected.periodLabel.toLowerCase()}`}
          subtitle="Kaç post / story / reel / video girilecek"
          items={selected.items}
        />
      ) : null}

      <form action={action} className="bf-panel grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <FormField label="Başlık" htmlFor="title">
            <TextInput id="title" name="title" required />
          </FormField>
        </div>
        <FormField label="Firma" htmlFor="companyId">
          <SelectInput
            id="companyId"
            name="companyId"
            required
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            <option value="" disabled>
              Seçin
            </option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectInput>
        </FormField>
        <div className="md:col-span-2">
          <FormField label="Platformlar">
            <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl border border-black/10 bg-white/60 px-3 py-3">
              {Object.entries(platformLabels).map(([value, label], index) => (
                <label
                  key={value}
                  className="inline-flex items-center gap-2 text-sm text-black/80"
                >
                  <input
                    type="checkbox"
                    name="platform"
                    value={value}
                    defaultChecked={index === 0}
                    className="size-4 accent-[var(--bf-accent-deep)]"
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-black/45">
              Birden fazla seçersen her kombinasyon için ayrı içerik oluşur.
            </p>
          </FormField>
        </div>
        <div className="md:col-span-2">
          <FormField label="Türler">
            <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl border border-black/10 bg-white/60 px-3 py-3">
              {Object.entries(contentTypeLabels).map(([value, label], index) => (
                <label
                  key={value}
                  className="inline-flex items-center gap-2 text-sm text-black/80"
                >
                  <input
                    type="checkbox"
                    name="type"
                    value={value}
                    defaultChecked={index === 0}
                    className="size-4 accent-[var(--bf-accent-deep)]"
                  />
                  {label}
                </label>
              ))}
            </div>
          </FormField>
        </div>
        <FormField label="Yayın zamanı" htmlFor="publishAt">
          <TextInput id="publishAt" name="publishAt" type="datetime-local" />
        </FormField>
        <div className="md:col-span-2">
          <FormField label="İçerik metni" htmlFor="body">
            <TextAreaInput id="body" name="body" required />
          </FormField>
        </div>
        <div className="md:col-span-2">
          <FormField label="Notlar" htmlFor="notes">
            <TextAreaInput id="notes" name="notes" />
          </FormField>
        </div>
        <div className="md:col-span-2 flex gap-3">
          <Button type="submit">Oluştur</Button>
          <Link
            href={cancelHref}
            className="inline-flex items-center rounded-xl px-4 text-sm text-black/60 hover:text-black"
          >
            İptal
          </Link>
        </div>
      </form>
    </div>
  );
}
