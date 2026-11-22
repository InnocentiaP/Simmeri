import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  Link as LinkIcon,
  FileText,
  Sparkles,
  Database,
  Image as ImageIcon,
  Film,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { attachImportedCover } from "@/lib/media/import-cover";
import { saveImportedRecipe, type RecipeFormValues } from "@/lib/api";
import {
  RecipeFormFields,
  useRecipeForm,
  type RecipeFormSchema,
} from "@/components/app/RecipeForm";
import { extractDraftFromPlainText } from "@/lib/import/plaintext-extract";
import { extractRecipeFromUrl } from "@/lib/import/recipe-import.functions";
import { improveRecipeDraftWithAI } from "@/lib/import/recipe-ai-import.functions";
import { extractRecipeFromImages } from "@/lib/import/recipe-image-import.functions";
import { fileToAiImagePayload } from "@/lib/import/image-to-payload";
import { MAX_AI_IMAGES, type AiImagePayload } from "@/lib/import/image-payload";
import { ImageImportPicker, type PickedImage } from "@/components/app/ImageImportPicker";
import { SaveVideoHelp } from "@/components/app/SaveVideoHelp";
import {
  importRecipeFromVideoFile,
  importRecipeFromYouTube,
  type VideoImportPhase,
} from "@/lib/import/video-upload";
import { detectSocialPlatform, parseYouTubeUrl } from "@/lib/import/video-source";
import { extractFirstUrl, parseSocialPostUrl } from "@/lib/import/social-link";
import { takeSharedPayload } from "@/lib/import/share-target";
import { extractRecipeFromSocialLink } from "@/lib/import/recipe-social-import.functions";
import type { ImportResult } from "@/lib/import/types";

const MAX_PASTE_CHARS = 20_000;

export const Route = createFileRoute("/_authenticated/app/recipes/import")({
  head: () => ({ meta: [{ title: "Import Recipe — Simmeri" }] }),
  component: ImportRecipe,
});

type SourceMode = "paste" | "url" | "images" | "video";

type PreparedImage = PickedImage & { payload: AiImagePayload };

// Most common sources first; typing a recipe out by hand is the fallback.
const SOURCE_TABS = [
  { mode: "url", label: "From a URL", icon: LinkIcon },
  { mode: "images", label: "Photo / screenshot", icon: ImageIcon },
  { mode: "video", label: "Video", icon: Film },
  { mode: "paste", label: "Paste text", icon: FileText },
] as const satisfies readonly { mode: SourceMode; label: string; icon: unknown }[];
type Step =
  | { kind: "input" }
  | { kind: "extracting" }
  | { kind: "review"; result: ImportResult }
  | { kind: "error"; message: string };

function ImportRecipe() {
  const [mode, setMode] = useState<SourceMode>("url");
  const [pasteText, setPasteText] = useState("");
  const [url, setUrl] = useState("");
  const [step, setStep] = useState<Step>({ kind: "input" });
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [preparingImages, setPreparingImages] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  // Optional description/caption combined with the video for exact amounts.
  const [videoWrittenText, setVideoWrittenText] = useState("");
  const [videoPhase, setVideoPhase] = useState<VideoImportPhase | null>(null);
  const imagesRef = useRef(images);
  imagesRef.current = images;

  // Release preview object URLs when leaving the page.
  useEffect(
    () => () => imagesRef.current.forEach((img) => URL.revokeObjectURL(img.previewUrl)),
    [],
  );

  const addImageFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const room = MAX_AI_IMAGES - imagesRef.current.length;
    if (room <= 0) {
      toast.warning(`You can add up to ${MAX_AI_IMAGES} images.`);
      return;
    }
    if (files.length > room) toast.warning(`Only the first ${room} image(s) were added.`);
    setPreparingImages(true);
    const prepared: PreparedImage[] = [];
    for (const file of files.slice(0, room)) {
      try {
        const payload = await fileToAiImagePayload(file);
        prepared.push({
          id: crypto.randomUUID(),
          name: file.name || "Pasted image",
          previewUrl: URL.createObjectURL(file),
          payload,
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "That image couldn't be used.");
      }
    }
    setImages((prev) => [...prev, ...prepared].slice(0, MAX_AI_IMAGES));
    setPreparingImages(false);
  }, []);

  // Something shared to Simmeri from the phone's Share menu (installed app,
  // Android): pre-fill the matching tab. Nothing runs until Extract is pressed.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("shared") !== "1") return;
    window.history.replaceState(null, "", window.location.pathname);
    void takeSharedPayload().then((shared) => {
      if (!shared) {
        toast.info("Nothing came through from that share — try sharing it again.");
        return;
      }
      const video = shared.files.find((f) => f.type.startsWith("video/"));
      const pictures = shared.files.filter((f) => f.type.startsWith("image/"));
      const link = shared.url || extractFirstUrl(shared.text) || "";

      if (video) {
        setMode("video");
        setVideoFile(video);
        if (detectSocialPlatform(link)) setVideoUrl(link);
      } else if (pictures.length > 0) {
        setMode("images");
        void addImageFiles(pictures);
      } else if (link && parseYouTubeUrl(link)) {
        setMode("video");
        setVideoUrl(link);
      } else if (link && detectSocialPlatform(link) && !parseSocialPostUrl(link)) {
        // Instagram, Facebook, Threads: show how to save the video, keep the link for credit.
        setMode("video");
        setVideoUrl(link);
      } else if (link) {
        setMode("url");
        setUrl(link);
      } else {
        const text = [shared.title, shared.text].filter(Boolean).join("\n\n").trim();
        if (!text) {
          toast.info("Nothing came through from that share — try sharing it again.");
          return;
        }
        setMode("paste");
        setPasteText(text);
      }
      toast.success("Shared to Simmeri — check it, then press Extract recipe.");
    });
  }, [addImageFiles]);

  function removeImage(id: string) {
    setImages((prev) => {
      const gone = prev.find((img) => img.id === id);
      if (gone) URL.revokeObjectURL(gone.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
  }

  const imagesMutation = useMutation({
    mutationFn: (payloads: AiImagePayload[]) =>
      extractRecipeFromImages({ data: { images: payloads } }),
    onSuccess: (result) => setStep({ kind: "review", result }),
    onError: (e: Error) =>
      setStep({
        kind: "error",
        message:
          e.message || "Meri couldn't read those images. Try again or paste the text instead.",
      }),
  });

  const videoMutation = useMutation({
    mutationFn: async (source: { file: File; creditUrl: string | null } | { url: string }) => {
      if (!("file" in source)) return importRecipeFromYouTube(source.url, videoWrittenText);
      const result = await importRecipeFromVideoFile(source.file, setVideoPhase, videoWrittenText);
      // Credit the original post (e.g. the TikTok link) as the recipe source.
      return source.creditUrl
        ? { ...result, source: { url: source.creditUrl, title: null } }
        : result;
    },
    onSuccess: (result) => {
      setVideoPhase(null);
      setStep({ kind: "review", result });
    },
    onError: (e: Error) => {
      setVideoPhase(null);
      setStep({
        kind: "error",
        message: e.message || "Meri couldn't watch that video. Try again or use a screenshot.",
      });
    },
  });

  const socialMutation = useMutation({
    mutationFn: (link: string) => extractRecipeFromSocialLink({ data: { url: link } }),
    onSuccess: (result) => setStep({ kind: "review", result }),
    onError: (e: Error) =>
      setStep({
        kind: "error",
        message:
          e.message || "Meri couldn't read that post. Try the Video or Photo / screenshot tab.",
      }),
  });

  const urlMutation = useMutation({
    mutationFn: (u: string) => extractRecipeFromUrl({ data: { url: u } }),
    onSuccess: (result) => setStep({ kind: "review", result }),
    onError: (e: Error) =>
      setStep({
        kind: "error",
        message: e.message || "We couldn't reach that page. Double-check the URL and try again.",
      }),
  });

  function switchMode(next: SourceMode) {
    setMode(next);
    if (step.kind === "error") setStep({ kind: "input" });
  }

  function handleExtract() {
    if (mode === "paste") {
      const { draft, warnings } = extractDraftFromPlainText(pasteText);
      setStep({
        kind: "review",
        result: { draft, warnings, source: { url: null, title: null }, method: "text" },
      });
    } else if (mode === "images") {
      setStep({ kind: "extracting" });
      imagesMutation.mutate(images.map((img) => img.payload));
    } else if (mode === "video") {
      setStep({ kind: "extracting" });
      videoMutation.mutate(
        videoFile
          ? { file: videoFile, creditUrl: detectSocialPlatform(videoUrl) ? videoUrl.trim() : null }
          : { url: videoUrl },
      );
    } else if (parseYouTubeUrl(url)) {
      // A YouTube link pasted in the URL tab goes straight to video import.
      setStep({ kind: "extracting" });
      videoMutation.mutate({ url });
    } else if (parseSocialPostUrl(url)) {
      // X and TikTok posts: read the caption through the official oEmbed.
      setStep({ kind: "extracting" });
      socialMutation.mutate(url);
    } else {
      const platform = detectSocialPlatform(url);
      if (platform) {
        setStep({
          kind: "error",
          message: `${platform} doesn't let apps read its posts. Save the video and use the “Video” tab, or screenshot the caption and use “Photo / screenshot”.`,
        });
        return;
      }
      setStep({ kind: "extracting" });
      urlMutation.mutate(url);
    }
  }

  if (step.kind === "review") {
    return (
      <ReviewStep
        result={step.result}
        pasteText={mode === "paste" ? pasteText : null}
        images={mode === "images" ? images.map((img) => img.payload) : null}
        videoWrittenText={videoWrittenText}
        onBack={() => setStep({ kind: "input" })}
      />
    );
  }

  const videoSocialPlatform = detectSocialPlatform(videoUrl);

  const extractDisabled =
    step.kind === "extracting" ||
    (mode === "paste"
      ? !pasteText.trim()
      : mode === "images"
        ? images.length === 0 || preparingImages
        : mode === "video"
          ? !videoFile && !parseYouTubeUrl(videoUrl)
          : !url.trim());

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
        {mode === "url"
          ? "Import from a public recipe webpage — paste the link below. You'll review and edit everything before it's saved."
          : mode === "images"
            ? "Add screenshots of a recipe — an Instagram or TikTok caption, a cookbook page, or a handwritten card. Meri reads the text and you review everything before it's saved."
            : mode === "video"
              ? "Paste a YouTube link or upload a recipe video you've saved. Meri watches it and drafts the recipe — you review everything before it's saved."
              : "Paste the recipe's text below. You'll review and edit everything before it's saved."}
      </p>

      <div className="mb-4 inline-flex flex-wrap rounded-3xl border border-border bg-background p-1">
        {SOURCE_TABS.map(({ mode: tab, label, icon: Icon }) => (
          <button
            key={tab}
            type="button"
            onClick={() => switchMode(tab)}
            aria-pressed={mode === tab}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm ${
              mode === tab ? "bg-olive-deep text-primary-foreground" : "text-cocoa"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {mode === "video" ? (
        <div className="flex flex-col gap-3">
          <input
            value={videoUrl}
            onChange={(e) => {
              setVideoUrl(e.target.value);
              // A YouTube link replaces an upload; a social link is kept
              // alongside the uploaded file as its source credit.
              if (parseYouTubeUrl(e.target.value)) setVideoFile(null);
            }}
            type="url"
            placeholder="YouTube link — or the TikTok/Instagram post link, for credit"
            aria-label="Video link"
            disabled={step.kind === "extracting"}
            className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
          />
          {videoSocialPlatform && (
            <p className="rounded-2xl border border-caramel/40 bg-caramel/10 p-3 text-sm text-cocoa">
              {videoSocialPlatform} videos can't be watched straight from the link. Save the video,
              then choose it below — this link will be kept as the recipe's source.
            </p>
          )}
          <SaveVideoHelp platform={videoSocialPlatform} />
          <p className="text-center text-xs uppercase tracking-wide text-cocoa/50">
            {videoSocialPlatform ? "then" : "or"}
          </p>
          <label className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-border bg-cream/40 p-5 text-center text-sm text-cocoa hover:bg-cream-deep/40">
            <Film className="mb-1.5 h-6 w-6 text-olive-deep" aria-hidden="true" />
            {videoFile ? (
              <span>
                <span className="font-medium">{videoFile.name}</span> ·{" "}
                {(videoFile.size / (1024 * 1024)).toFixed(1)} MB — choose another
              </span>
            ) : (
              <span>Choose a video file</span>
            )}
            <span className="mt-1 text-xs text-cocoa/60">
              MP4, MOV, or WebM · up to 200 MB and 15 minutes
            </span>
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/3gpp,video/mpeg,.mov,.m4v"
              className="sr-only"
              disabled={step.kind === "extracting"}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setVideoFile(file);
                if (file && parseYouTubeUrl(videoUrl)) setVideoUrl("");
                e.target.value = "";
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-cocoa">
              Description or caption <span className="font-normal text-cocoa/60">(optional)</span>
            </span>
            <textarea
              value={videoWrittenText}
              onChange={(e) => setVideoWrittenText(e.target.value)}
              rows={4}
              disabled={step.kind === "extracting"}
              placeholder="Paste the video's description or caption if it lists ingredients or amounts…"
              className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
            />
            <span className="text-xs text-cocoa/60">
              Meri combines it with the video: amounts written here are used first, and the video
              fills in the rest. For YouTube links the description is read automatically when
              available.
            </span>
          </label>
          {videoPhase?.kind === "uploading" && (
            <div
              role="progressbar"
              aria-label="Uploading video"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(videoPhase.fraction * 100)}
              className="h-2 overflow-hidden rounded-full bg-cream-deep"
            >
              <div
                className="h-full bg-olive-deep transition-[width]"
                style={{ width: `${Math.round(videoPhase.fraction * 100)}%` }}
              />
            </div>
          )}
          <p className="text-xs text-cocoa/60">
            Your video is only used to read the recipe and is deleted right after. Private or
            unlisted YouTube videos can't be read.
          </p>
        </div>
      ) : mode === "images" ? (
        <ImageImportPicker
          images={images}
          busy={preparingImages}
          onAddFiles={addImageFiles}
          onRemove={removeImage}
        />
      ) : mode === "paste" ? (
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
        <div>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            type="url"
            placeholder="https://example.com/a-recipe"
            className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
          />
          <p className="mt-1.5 text-xs text-cocoa/60">
            Works with recipe blogs and websites, YouTube links, and X or TikTok posts whose caption
            has the recipe. For Instagram, Facebook, or Threads, use “Video” or “Photo /
            screenshot”.
          </p>
        </div>
      )}

      {step.kind === "error" && <p className="mt-3 text-sm text-terracotta">{step.message}</p>}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleExtract}
          disabled={extractDisabled}
          className="rounded-full bg-olive-deep px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-olive disabled:opacity-60"
        >
          {step.kind === "extracting"
            ? videoPhase?.kind === "uploading"
              ? `Uploading video… ${Math.round(videoPhase.fraction * 100)}%`
              : videoPhase?.kind === "watching" || mode === "video" || parseYouTubeUrl(url)
                ? "Meri is watching the video… (up to a minute)"
                : mode === "images"
                  ? "Meri is reading your images…"
                  : parseSocialPostUrl(url)
                    ? "Meri is reading the post's caption…"
                    : "Reading that page… (a few seconds if Meri needs AI)"
            : "Extract recipe"}
        </button>
      </div>
    </div>
  );
}

function ReviewStep({
  result,
  pasteText,
  images,
  videoWrittenText,
  onBack,
}: {
  result: ImportResult;
  pasteText: string | null;
  images: AiImagePayload[] | null;
  videoWrittenText: string;
  onBack: () => void;
}) {
  const form = useRecipeForm(result.draft);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  // The automatic URL import and image import have already used AI.
  const [aiApplied, setAiApplied] = useState(
    result.method === "ai" ||
      result.method === "images" ||
      result.method === "video" ||
      result.method === "social",
  );
  // An uploaded video is deleted right after reading, so it can't be re-read;
  // a YouTube video (kept as the source URL) can.
  const youTubeSource =
    result.method === "video" && result.source.url ? parseYouTubeUrl(result.source.url) : null;
  const canAskAi = result.method !== "video" || youTubeSource !== null;
  const [useSourcePhoto, setUseSourcePhoto] = useState(Boolean(result.imageUrl));
  const [photoFailedToLoad, setPhotoFailedToLoad] = useState(false);
  const [aiWarnings, setAiWarnings] = useState<string[]>([]);
  const [preAiSnapshot, setPreAiSnapshot] = useState<RecipeFormSchema | null>(null);
  const [aiConfigMissing, setAiConfigMissing] = useState(false);

  const saveMut = useMutation({
    mutationFn: async (values: RecipeFormValues) => {
      const id = await saveImportedRecipe(values, result.source);
      let coverFailed = false;
      // The recipe is already saved; a photo failure never undoes that.
      if (id && user && useSourcePhoto && result.imageUrl && !photoFailedToLoad) {
        try {
          await attachImportedCover(user.id, id, result.imageUrl);
        } catch {
          coverFailed = true;
        }
      }
      return { id, coverFailed };
    },
    onSuccess: ({ id, coverFailed }) => {
      toast.success("Recipe saved");
      if (coverFailed) {
        toast.warning(
          "We couldn't add the photo from that page. You can upload one on the recipe page.",
        );
      }
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
      if (youTubeSource) {
        const r = await importRecipeFromYouTube(youTubeSource, videoWrittenText);
        return { draft: r.draft, warnings: r.warnings };
      }
      if (result.method === "social" && result.source.url) {
        const r = await extractRecipeFromSocialLink({ data: { url: result.source.url } });
        return { draft: r.draft, warnings: r.warnings };
      }
      // Image imports retry by re-reading the same images.
      if (images && images.length > 0) {
        const r = await extractRecipeFromImages({ data: { images } });
        return { draft: r.draft, warnings: r.warnings };
      }
      const source = result.source.url
        ? { kind: "url" as const, url: result.source.url }
        : { kind: "text" as const, text: pasteText ?? "" };
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
      {result.method && result.method !== "text" && <MethodBadge method={result.method} />}
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
                ? "AI drafts can vary. Review every field before saving. Trying again will replace your current AI draft with a new attempt."
                : "AI drafts can vary. Review every field before saving. Improving with AI will replace the fields below with an AI-extracted draft."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {aiApplied && preAiSnapshot && (
              <button
                type="button"
                onClick={handleResetToDeterministic}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-cocoa hover:bg-cream-deep/40"
              >
                Reset to original draft
              </button>
            )}
            {canAskAi && (
              <button
                type="button"
                onClick={() => aiMut.mutate()}
                disabled={aiMut.isPending || aiConfigMissing}
                className="inline-flex items-center gap-1.5 rounded-full border border-olive-deep px-4 py-1.5 text-sm font-medium text-olive-deep hover:bg-olive-deep/10 disabled:opacity-60"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {aiMut.isPending ? "Asking AI…" : aiApplied ? "Try AI again" : "Improve with AI"}
              </button>
            )}
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

      {result.imageUrl && !photoFailedToLoad && (
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-border/70 bg-background p-4">
          {/* Shown straight from the source site for preview only; the saved
              cover is a resized copy in your private storage. */}
          <img
            src={result.imageUrl}
            alt="Photo from the recipe page"
            referrerPolicy="no-referrer"
            onError={() => setPhotoFailedToLoad(true)}
            className="h-24 w-32 rounded-xl object-cover"
          />
          <label className="flex flex-1 items-start gap-2 text-sm text-cocoa">
            <input
              type="checkbox"
              checked={useSourcePhoto}
              onChange={(e) => setUseSourcePhoto(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Use this photo as the recipe cover
              <span className="block text-xs text-cocoa/60">
                A copy is saved privately to your library. You can change it later.
              </span>
            </span>
          </label>
        </div>
      )}

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

function MethodBadge({ method }: { method: NonNullable<ImportResult["method"]> }) {
  const content =
    method === "social"
      ? {
          icon: Sparkles,
          label: "Read by Meri from the post's caption — double-check before saving",
        }
      : method === "video"
        ? { icon: Film, label: "Watched by Meri — fill in any amounts the video didn't say" }
        : method === "images"
          ? { icon: Sparkles, label: "Read by Meri from your images — double-check before saving" }
          : method === "ai"
            ? { icon: Sparkles, label: "Read by Meri with AI — double-check before saving" }
            : method === "partial"
              ? { icon: Database, label: "Only part of the recipe could be read" }
              : { icon: Database, label: "Read from the page's recipe data" };
  const Icon = content.icon;
  return (
    <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-olive-deep/10 px-3 py-1 text-xs font-medium text-olive-deep">
      <Icon className="h-3.5 w-3.5" /> {content.label}
    </p>
  );
}
