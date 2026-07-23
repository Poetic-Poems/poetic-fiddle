/**
 * WCAG 2.x relative-luminance contrast ratio between two sRGB hex colours.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Composites a translucent foreground colour over an opaque background. */
export function blendOver(
  hex: string,
  alpha: number,
  backgroundHex: string,
): string {
  const [r1, g1, b1] = parseHex(hex);
  const [r2, g2, b2] = parseHex(backgroundHex);
  const blend = (a: number, b: number) =>
    Math.round(alpha * a + (1 - alpha) * b);
  return toHex(blend(r1, r2), blend(g1, g2), blend(b1, b2));
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(channelLuminance);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function channelLuminance(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
