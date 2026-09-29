import { renderPoem } from "poetic/browser";
import { errorMessage } from "@/lib/errors";

export function tryRenderPoem(
  text: string,
  previousHtml: string = "",
): { html: string; error: string | null } {
  try {
    return { html: renderPoem(text), error: null };
  } catch (err) {
    return {
      html: previousHtml,
      error: errorMessage(err),
    };
  }
}
