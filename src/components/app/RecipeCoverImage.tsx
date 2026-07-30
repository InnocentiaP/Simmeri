import { useEffect, useState } from "react";
import { ChefHat } from "lucide-react";
import { useSignedRecipeMediaUrl } from "@/lib/media/use-signed-url";

interface RecipeCoverImageProps {
  bucket: string | null;
  path: string | null;
  alt: string;
  className?: string;
}

// Displays a recipe's cover via a short-lived signed URL, with a consistent
// fallback whenever there's no cover, the signed URL can't be generated
// (e.g. a missing Storage object), or the image itself fails to load —
// never a broken-image icon. Never exposes the raw bucket/path in the UI.
export function RecipeCoverImage({ bucket, path, alt, className = "" }: RecipeCoverImageProps) {
  const { data: signedUrl, isLoading } = useSignedRecipeMediaUrl(bucket, path);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoadError(false);
  }, [signedUrl]);

  const hasSource = Boolean(bucket && path);
  const showImage = Boolean(signedUrl) && !loadError;

  if (hasSource && isLoading) {
    return <div className={`animate-pulse bg-cream-deep/50 ${className}`} aria-hidden="true" />;
  }

  if (!showImage) {
    return (
      <div className={`flex items-center justify-center bg-cream-deep/40 ${className}`}>
        <ChefHat className="h-1/3 w-1/3 text-olive-deep/40" aria-hidden="true" />
        <span className="sr-only">No cover photo</span>
      </div>
    );
  }

  return (
    <img
      src={signedUrl as string}
      alt={alt}
      className={`object-cover ${className}`}
      onError={() => setLoadError(true)}
    />
  );
}
