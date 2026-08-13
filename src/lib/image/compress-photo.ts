// Sized for the biggest real consumer, not the smallest: any uploaded photo
// can end up picked as the hero via the existing-photo picker regardless of
// which flow it was first uploaded through, so there's no "small" purpose to
// compress tighter for — every photo has to be hero-quality. Next's image
// optimizer already serves smaller/reformatted variants of this master for
// every other context, so nothing downstream gets bigger, only this master.
const MAX_DIMENSION = 3200;

// Tried in order until one fits maxBytes — most photos fit at the first,
// highest-quality pass, this only steps down for unusually large/busy ones.
const QUALITY_STEPS = [0.82, 0.75, 0.68];

export async function compressPhoto(file: File, maxBytes: number): Promise<File> {
  if (file.type === "image/gif") {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = objectUrl;
    await img.decode();

    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    let blob: Blob | null = null;
    for (const quality of QUALITY_STEPS) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (blob && blob.size <= maxBytes) break;
    }
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
