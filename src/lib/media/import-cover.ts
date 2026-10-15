import { setRecipeCover } from "@/lib/api";
import { fetchImportImage } from "@/lib/import/recipe-import.functions";
import { prepareImageForUpload } from "@/lib/media/image-compress";
import {
  RECIPE_MEDIA_BUCKET,
  buildRecipeCoverPath,
  removeRecipeMedia,
  uploadRecipeMedia,
} from "@/lib/media/storage";

// Turns an imported page's recipe photo into the recipe's cover, through the
// same steps as a manual upload (CoverPhotoUploader): resize + re-encode in
// the browser (which also drops EXIF metadata), upload to the private
// bucket, then point the recipe at it. The server only downloads the image
// via the SSRF-safe fetcher; it never writes to Storage itself.
export async function attachImportedCover(
  userId: string,
  recipeId: string,
  imageUrl: string,
): Promise<void> {
  const { base64, mimeType } = await fetchImportImage({ data: { url: imageUrl } });
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const file = new File([bytes], "imported-cover", { type: mimeType });

  const prepared = await prepareImageForUpload(file);
  const path = buildRecipeCoverPath(userId, recipeId, crypto.randomUUID(), prepared.mimeType);
  await uploadRecipeMedia(path, prepared.blob, prepared.mimeType);

  try {
    await setRecipeCover(recipeId, { bucket: RECIPE_MEDIA_BUCKET, path, source: "direct_upload" });
  } catch (error) {
    removeRecipeMedia(RECIPE_MEDIA_BUCKET, [path]).catch(() => {});
    throw error;
  }
}
