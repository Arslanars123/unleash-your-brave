/**
 * Instagram-style prep: accept large camera-roll photos, downscale + compress
 * in the browser, then upload a small JPEG (or keep animated GIFs as-is).
 */

const DEFAULT_MAX_EDGE = 1440;
const DEFAULT_QUALITY = 0.82;
const DEFAULT_MAX_INPUT_BYTES = 40 * 1024 * 1024;
const DEFAULT_MAX_OUTPUT_BYTES = 4.5 * 1024 * 1024;

export interface PrepareImageOptions {
  /** Longest side in px (Instagram feed ~1080; we use 1440 for sharper admin previews). */
  maxEdge?: number;
  quality?: number;
  maxInputBytes?: number;
  maxOutputBytes?: number;
}

export async function prepareImageForUpload(
  file: File,
  options: PrepareImageOptions = {},
): Promise<File> {
  const maxEdge = options.maxEdge ?? DEFAULT_MAX_EDGE;
  const quality = options.quality ?? DEFAULT_QUALITY;
  const maxInputBytes = options.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES;
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;

  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file');
  }
  if (file.size > maxInputBytes) {
    throw new Error('Image is too large to process (max 40MB)');
  }

  // Preserve animated GIFs — canvas would flatten them to a single frame.
  if (file.type === 'image/gif') {
    if (file.size > maxOutputBytes) {
      throw new Error('GIF must be under ~5MB (animated GIFs are not recompressed)');
    }
    return file;
  }

  // Already small enough and within dimensions? Still normalize to JPEG for
  // consistent uploads, unless WebP/PNG is tiny — recompress anyway for size.
  const bitmap = await loadBitmap(file);
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to process image in this browser');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    let q = quality;
    let blob = await canvasToJpeg(canvas, q);
    while (blob.size > maxOutputBytes && q > 0.45) {
      q -= 0.08;
      blob = await canvasToJpeg(canvas, q);
    }

    if (blob.size > maxOutputBytes) {
      throw new Error('Could not compress image enough — try a simpler photo');
    }

    const base = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${base}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}

function fitWithin(width: number, height: number, maxEdge: number): {
  width: number;
  height: number;
} {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width, height };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    // Fallback for older Safari / odd formats
    const url = URL.createObjectURL(file);
    try {
      const img = await loadHtmlImage(url);
      return await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unable to read this image'));
    img.src = url;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Unable to compress image'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality,
    );
  });
}
