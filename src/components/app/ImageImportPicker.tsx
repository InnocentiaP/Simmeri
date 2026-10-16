import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { MAX_AI_IMAGES } from "@/lib/import/image-payload";

export interface PickedImage {
  id: string;
  name: string;
  previewUrl: string;
}

interface ImageImportPickerProps {
  images: PickedImage[];
  busy: boolean;
  onAddFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
}

// Collects up to MAX_AI_IMAGES screenshots/photos for AI import: file
// picker, drag-and-drop, and pasting a screenshot from the clipboard
// (Ctrl/Cmd+V anywhere on the page while this picker is shown).
export function ImageImportPicker({ images, busy, onAddFiles, onRemove }: ImageImportPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const full = images.length >= MAX_AI_IMAGES;

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length === 0) return;
      e.preventDefault();
      onAddFiles(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onAddFiles]);

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onAddFiles(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/")));
        }}
        className={`flex flex-col items-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
          dragging ? "border-olive-deep bg-olive-deep/5" : "border-border bg-cream/40"
        }`}
      >
        <ImagePlus className="mb-2 h-7 w-7 text-olive-deep" aria-hidden="true" />
        <p className="text-sm text-cocoa">
          Drop screenshots here, paste one with{" "}
          <kbd className="rounded border px-1 text-xs">Ctrl</kbd>+
          <kbd className="rounded border px-1 text-xs">V</kbd>, or
        </p>
        <button
          type="button"
          disabled={full || busy}
          onClick={() => inputRef.current?.click()}
          className="mt-2 rounded-full border border-olive-deep px-4 py-1.5 text-sm font-medium text-olive-deep hover:bg-olive-deep/10 disabled:opacity-50"
        >
          Choose images
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            onAddFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <p className="mt-2 text-xs text-cocoa/60">
          Up to {MAX_AI_IMAGES} images — JPEG, PNG, or WebP. {busy ? "Preparing…" : ""}
        </p>
      </div>

      {images.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {images.map((img, i) => (
            <li key={img.id} className="relative">
              <img
                src={img.previewUrl}
                alt={`Image ${i + 1}: ${img.name}`}
                className="h-24 w-24 rounded-xl border border-border/70 object-cover"
              />
              <span className="absolute left-1 top-1 rounded-full bg-background/90 px-1.5 text-[10px] font-semibold text-cocoa">
                {i + 1}
              </span>
              <button
                type="button"
                onClick={() => onRemove(img.id)}
                aria-label={`Remove image ${i + 1}`}
                className="absolute -right-1.5 -top-1.5 rounded-full border border-border bg-background p-0.5 text-cocoa shadow-sm hover:bg-cream-deep"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
