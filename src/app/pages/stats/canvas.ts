/** Sizes the canvas for the screen's pixel density and returns a cleared context drawing in CSS pixels. */
export function prepareCanvas(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D | null {
  const ratio = window.devicePixelRatio || 1;
  const pixelWidth = Math.max(1, Math.round(width * ratio));
  const pixelHeight = Math.max(1, Math.round(height * ratio));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    console.error("This browser gave no 2D canvas for the stats dots");
    return null;
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  return context;
}

/** A theme colour from the page's CSS variables, so the dots follow styles.css. */
export function cssColor(element: Element, variable: string, fallback: string): string {
  return getComputedStyle(element).getPropertyValue(variable).trim() || fallback;
}

export type DotStyle = { radius: number; alpha: number; color: string };

/**
 * One translucent dot, drawn once and stamped for every solve. Each stamp blends on its own, so crowded stretches
 * darken the way overlapping ink does (a single filled path would flatten them to one tone), and stamping an image
 * is much cheaper than building thousands of arcs.
 */
export function dotSprite({ radius, alpha, color }: DotStyle): HTMLCanvasElement {
  const ratio = window.devicePixelRatio || 1;
  const size = Math.ceil((radius * 2 + 2) * ratio);
  const sprite = document.createElement("canvas");
  sprite.width = size;
  sprite.height = size;
  const context = sprite.getContext("2d");
  if (!context) return sprite;
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.beginPath();
  context.arc(size / 2, size / 2, radius * ratio, 0, Math.PI * 2);
  context.fill();
  return sprite;
}

export function stamp(context: CanvasRenderingContext2D, sprite: HTMLCanvasElement, x: number, y: number): void {
  const ratio = window.devicePixelRatio || 1;
  const size = sprite.width / ratio;
  context.drawImage(sprite, x - size / 2, y - size / 2, size, size);
}
