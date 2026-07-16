import { parseAndAugment } from "poetic/browser";

/**
 * Derives a saved poem's title from its `.poem` header (AC23), using the same
 * `poetic` parser the preview renders through — the title is a cache of the
 * source, never separately editable.
 *
 * Source that doesn't parse still saves: `source_text` is canonical (D15,
 * AC16) and a half-written poem must never be refused. The parser throws on
 * such source, so an underivable title is stored empty (the column's default)
 * and labelled at display time rather than guessed at here.
 */
export function derivePoemTitle(source: string): string {
  try {
    const { title } = parseAndAugment(source, {});
    return typeof title === "string" ? title.trim() : "";
  } catch {
    return "";
  }
}
