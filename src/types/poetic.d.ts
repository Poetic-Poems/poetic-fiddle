// Ambient shim for `poetic/browser` (see TECH-DEBT.md TD26071301). poetic
// ships no `.d.ts` for its browser entry point; remove this file if/when
// poetic starts publishing its own declarations.
declare module "poetic/browser" {
  export interface PoeticRenderConfig {
    [key: string]: unknown;
  }

  export interface PoeticRenderOptions {
    config?: PoeticRenderConfig;
  }

  export interface PoemData {
    title?: string;
    author?: string;
    date?: string;
    slug?: string;
    [key: string]: unknown;
  }

  /**
   * Parses `.poem` source into a poem-data object, throwing on source that
   * isn't a complete poem (a missing title or date, for instance).
   */
  export function parseAndAugment(
    text: string,
    opts?: PoeticRenderOptions & { slug?: string },
  ): PoemData;

  export function renderPoem(text: string, opts?: PoeticRenderOptions): string;

  export function renderPoemPage(
    text: string,
    opts?: PoeticRenderOptions,
  ): string;
}
