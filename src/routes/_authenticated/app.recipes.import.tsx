import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Link as LinkIcon, FileText, Sparkles } from "lucide-react";
import { saveImportedRecipe, type RecipeFormValues } from "@/lib/api";
import { RecipeFormFields, useRecipeForm, type RecipeFormSchema } from "@/components/app/RecipeForm";
import { extractDraftFromPlainText } from "@/lib/import/plaintext-extract";
import { extractRecipeFromUrl } from "@/lib/import/recipe-import.functions";
import { improveRecipeDraftWithAI } from "@/lib/import/recipe-ai-import.functions";
import type { ImportResult } from "@/lib/import/types";

const MAX_PASTE_CHARS = 20_000;

export const Route = createFileRoute("/_authenticated/app/recipes/import")({
  head: () => ({ meta: [{ title: "Import Recipe — Simmeri" }] }),
  component: ImportRecipe,
});

type SourceMode = "paste" | "url";
type Step =
  | { kind: "input" }
  | { kind: "extracting" }
  | { kind: "review"; result: ImportResult }
  | { kind: "error"; message: string };

function ImportRecipe() {
  const [mode, setMode] = useState<SourceMode>("paste");
  const [pasteText, setPasteText] = useState("");
  const [url, setUrl] = useState("");
  const [step, setStep] = useState<Step>({ kind: "input" });

  const urlMutation = useMutation({
    mutationFn: (u: string) => extractRecipeFromUrl({ data: { url: u } }),
    onSuccess: (result) => setStep({ kind: "review", result }),
    onError: (e: Error) =>
      setStep({
        kind: "error",
        message: e.message || "We couldn't reach that page. Double-check the URL and try again.",
      }),
  });

  function handleExtract() {
    if (mode === "paste") {
      const { draft, warnings } = extractDraftFromPlainText(pasteText);
      setStep({ kind: "review", result: { draft, warnings, source: { url: null, title: null } } });
    } else {
      setStep({ kind: "extracting" });
      urlMutation.mutate(url);
    }
  }

  if (step.kind === "review") {
    return (
      <ReviewStep
        result={step.result}
        pasteText={mode === "paste" ? pasteText : null}
        onBack={() => setStep({ kind: "input" })}
      />
    );
  }

  const extractDisabled =
    step.kind === "extracting" || (mode === "paste" ? !pasteText.trim() : !url.trim());

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/app/recipes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-cocoa hover:underline"
      >
        <ChevronLeft className="h-4 w-4" /> Back to recipes
      </Link>
      <h1 className="mb-2 font-display text-3xl font-semibold text-olive-deep">Import a recipe</h1>
      <p className="mb-6 text-sm text-cocoa/70">
        Paste recipe text, or link to a public recipe page. You'll review and edit everything
        before it's saved.
      </p>

      <div className="mb-4 inline-flex rounded-full border border-border bg-background p-1">
        <button
          type="button"
          onClick={() => setMode("paste")}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm ${
            mode === "paste" ? "bg-olive-deep text-primary-foreground" : "text-cocoa"
          }`}
        >
          <FileText className="h-3.5 w-3.5" /> Paste text
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm ${
            mode === "url" ? "bg-olive-deep text-primary-foreground" : "text-cocoa"
          }`}
        >
          <LinkIcon className="h-3.5 w-3.5" /> From a URL
        </button>
      </div>

      {mode === "paste" ? (
        <div>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={12}
            placeholder="Paste the recipe's title, ingredients, and steps here…"
            className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
          />
          <p
            className={`mt-1 text-right text-xs ${
              pasteText.length > MAX_PASTE_CHARS ? "text-terracotta" : "text-cocoa/50"
            }`}
          >
            {pasteText.length.toLocaleString()} / {MAX_PASTE_CHARS.toLocaleString()} characters
            {pasteText.length > MAX_PASTE_CHARS ? " — AI extraction needs shorter text" : ""}
          </p>
        </div>
      ) : (
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          type="url"
          placeholder="https://example.com/a-recipe"
          className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
        />
      )}

      {step.kind === "error" && <p className="mt-3 text-sm text-terracotta">{step.message}</p>}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleExtract}
          disabled={extractDisabled}
          className="rounded-full bg-olive-deep px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-olive disabled:opacity-60"
        >
          {step.kind === "extracting" ? "Fetching and reading that page…" : "Extract recipe"}
        </button>
      </div>
    </div>
  );
}

function ReviewStep({
  result,
  pasteText,
  onBack,
}: {
  result: ImportResult;
  pasteText: string | null;
  onBack: () => void;
}) {
  const form = useRecipeForm(result.draft);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [aiApplied, setAiApplied] = useState(false);
  const [aiWarnings, setAiWarnings] = useState<string[]>([]);
  const [preAiSnapshot, setPreAiSnapshot] = useState<RecipeFormSchema | null>(null);
  const [aiConfigMissing, setAiConfigMissing] = useState(false);

  const saveMut = useMutation({
    mutationFn: async (values: RecipeFormValues) => saveImportedRecipe(values, result.source),
    onSuccess: (id) => {
      toast.success("Recipe saved");
      qc.invalidateQueries();
      navigate({ to: "/app/recipes/$recipeId", params: { recipeId: id! } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Re-extracts independently from the original source (the original pasted
  // text, or the original URL re-fetched server-side) rather than the
  // possibly-already-edited form values, so only "the required recipe
  // content" ever crosses the wire — see the AI integration plan, section B.
  const aiMut = useMutation({
    mutationFn: async () => {
      const source = result.source.url
        ? ({ kind: "url" as const, url: result.source.url })
        : ({ kind: "text" as const, text: pasteText ?? "" });
      return improveRecipeDraftWithAI({ data: source });
    },
    onMutate: () => {
      setPreAiSnapshot(form.getValues());
    },
    onSuccess: (res) => {
      form.reset(res.draft as RecipeFormSchema);
      setAiApplied(true);
      setAiWarnings(res.warnings);
      toast.success("AI draft ready — review before saving");
    },
    onError: (e: Error) => {
      if (e.message === "AI recipe assistance isn't configured yet.") {
        setAiConfigMissing(true);
      }
      toast.error(e.message);
    },
  });

  function handleResetToDeterministic() {
    if (preAiSnapshot) form.reset(preAiSnapshot);
    setAiApplied(false);
    setAiWarnings([]);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-sm text-cocoa hover:underline"
      >
        <ChevronLeft className="h-4 w-4" /> Start over
      </button>
      <h1 className="mb-2 font-display text-3xl font-semibold text-olive-deep">Review import</h1>
      {result.source.url && (
        <p className="mb-4 text-xs text-cocoa/60">
          Imported from{" "}
          <a href={result.source.url} target="_blank" rel="noreferrer" className="underline">
            {result.source.title ?? result.source.url}
          </a>
        </p>
      )}
      {result.warnings.length > 0 && (
        <div className="mb-6 rounded-2xl border border-caramel/40 bg-caramel/10 p-4 text-sm text-cocoa">
          <ul className="list-disc pl-4">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-border/70 bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {aiApplied && (
              <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-olive-deep/10 px-2.5 py-1 text-xs font-medium text-olive-deep">
                <Sparkles className="h-3 w-3" /> AI-generated draft
              </span>
            )}
            <p className="mt-1 text-xs text-cocoa/70">
              {aiApplied
                ? "Review every field before saving — nothing is saved yet."
                : "Improving with AI will replace the fields below with an AI-extracted draft — review before saving."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {aiApplied && (
              <button
                type="button"
                onClick={handleResetToDeterministic}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-cocoa hover:bg-cream-deep/40"
              >
                Reset to original draft
              </button>
            )}
            <button
              type="button"
              onClick={() => aiMut.mutate()}
              disabled={aiMut.isPending || aiConfigMissing}
              className="inline-flex items-center gap-1.5 rounded-full border border-olive-deep px-4 py-1.5 text-sm font-medium text-olive-deep hover:bg-olive-deep/10 disabled:opacity-60"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {aiMut.isPending ? "Asking AI…" : "Improve with AI"}
            </button>
          </div>
        </div>
        {aiWarnings.length > 0 && (
          <ul className="mt-3 list-disc pl-4 text-xs text-cocoa/70">
            {aiWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
        <p role="status" aria-live="polite" className="sr-only">
          {aiMut.isPending
            ? "Asking AI to improve this draft…"
            : aiApplied
              ? "AI draft ready — review before saving."
              : ""}
        </p>
      </div>

      <form
        onSubmit={form.handleSubmit((v) => saveMut.mutate(v as RecipeFormValues))}
        className="flex flex-col gap-6"
      >
        <RecipeFormFields form={form} />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-border px-4 py-2 text-sm text-cocoa hover:bg-cream-deep/40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saveMut.isPending}
            className="rounded-full bg-olive-deep px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-olive disabled:opacity-60"
          >
            {saveMut.isPending ? "Saving…" : "Save recipe"}
          </button>
        </div>
      </form>
    </div>
  );
}
