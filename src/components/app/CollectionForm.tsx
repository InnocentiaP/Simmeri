import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const collectionNameSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Keep it under 80 characters"),
});
type CollectionNameValues = z.infer<typeof collectionNameSchema>;

interface CollectionFormProps {
  title: string;
  submitLabel: string;
  defaultName?: string;
  isPending: boolean;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

// Used for both create and rename — the only difference is defaultName and
// the caller-supplied submit handler/label.
export function CollectionForm({
  title,
  submitLabel,
  defaultName = "",
  isPending,
  onSubmit,
  onClose,
}: CollectionFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CollectionNameValues>({
    resolver: zodResolver(collectionNameSchema),
    defaultValues: { name: defaultName },
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-sm rounded-3xl bg-background p-6 shadow-[var(--shadow-paper)]">
        <h3 className="font-display text-lg font-semibold text-cocoa">{title}</h3>
        <form onSubmit={handleSubmit((v) => onSubmit(v.name.trim()))} className="mt-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-cocoa">Name</span>
            <input
              {...register("name")}
              autoFocus
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            {errors.name && <span className="text-xs text-terracotta">{errors.name.message}</span>}
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border px-4 py-2 text-sm text-cocoa"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full bg-olive-deep px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-olive disabled:opacity-60"
            >
              {isPending ? "Saving…" : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
