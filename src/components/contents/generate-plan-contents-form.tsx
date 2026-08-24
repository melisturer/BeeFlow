import { format } from "date-fns";
import { Button } from "@heroui/react";
import { generatePlanContents } from "@/actions/contents";
import {
  FormField,
  SelectInput,
  TextInput,
} from "@/components/ui/form-field";
import { platformLabels } from "@/lib/labels";

export function GeneratePlanContentsForm({
  companyId,
  taskId,
  platforms,
  defaultDays = 7,
}: {
  companyId: string;
  taskId?: string;
  platforms: string[];
  defaultDays?: number;
}) {
  const options =
    platforms.length > 0 ? platforms : Object.keys(platformLabels);

  async function submit(formData: FormData) {
    "use server";
    await generatePlanContents(companyId, formData, { taskId });
  }

  return (
    <form
      action={submit}
      className="mt-4 grid gap-3 rounded-[10px] border border-dashed border-[var(--da-line)] bg-white/50 p-4 sm:grid-cols-4"
    >
      <div className="sm:col-span-4">
        <p className="text-sm font-semibold text-[var(--da-ink)]">
          Hedefleri günlere dağıt
        </p>
        <p className="mt-0.5 text-xs text-[var(--da-muted)]">
          Her gün için eksik post / story / reel / video taslaklarını oluşturur.
          Dolu günler atlanır.
        </p>
      </div>
      <FormField label="Başlangıç" htmlFor={`startDate-${taskId ?? companyId}`}>
        <TextInput
          id={`startDate-${taskId ?? companyId}`}
          name="startDate"
          type="date"
          required
          defaultValue={format(new Date(), "yyyy-MM-dd")}
        />
      </FormField>
      <FormField label="Kaç gün" htmlFor={`days-${taskId ?? companyId}`}>
        <TextInput
          id={`days-${taskId ?? companyId}`}
          name="days"
          type="number"
          min={1}
          max={31}
          defaultValue={defaultDays}
          required
        />
      </FormField>
      <FormField label="Platform" htmlFor={`platform-${taskId ?? companyId}`}>
        <SelectInput
          id={`platform-${taskId ?? companyId}`}
          name="platform"
          defaultValue={options[0]}
        >
          {options.map((value) => (
            <option key={value} value={value}>
              {platformLabels[value as keyof typeof platformLabels] ?? value}
            </option>
          ))}
        </SelectInput>
      </FormField>
      <div className="flex items-end">
        <Button type="submit" className="w-full">
          Otomatik oluştur
        </Button>
      </div>
    </form>
  );
}
