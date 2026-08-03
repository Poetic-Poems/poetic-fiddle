import {
  HighlightStyle,
  StreamLanguage,
  syntaxHighlighting,
  type StringStream,
} from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

interface PoemParserState {
  inComment: boolean;
  inLiteralBlock: boolean;
}

/**
 * v1 `.poem` mode: a StreamLanguage covering structural highlighting only
 * (sections, version labels, emphasis, variables, spans, comments,
 * hashtags). Not a full grammar for the format — see
 * poetic's docs/POEM-SYNTAX.md for the authoritative spec.
 */
const poemStreamParser = {
  startState(): PoemParserState {
    return { inComment: false, inLiteralBlock: false };
  },

  token(stream: StringStream, state: PoemParserState): string | null {
    if (state.inComment) {
      if (stream.match(/^#>>/)) {
        state.inComment = false;
        return "comment";
      }
      stream.skipToEnd();
      return "comment";
    }

    if (state.inLiteralBlock) {
      if (stream.match(/^>>>/)) {
        state.inLiteralBlock = false;
        return "meta";
      }
      stream.skipToEnd();
      return "string";
    }

    if (stream.sol()) {
      if (stream.match(/^<<#/)) {
        state.inComment = true;
        return "comment";
      }
      if (stream.match(/^<<<[\w-]*/)) {
        state.inLiteralBlock = true;
        return "meta";
      }
      if (stream.match(/^(----|====)/)) {
        stream.skipToEnd();
        return "meta";
      }
      if (stream.match(/^\{\{.*?\}\}/)) {
        return "heading";
      }
      if (stream.match(/^\{.*?\}/)) {
        return "heading2";
      }
      if (stream.match(/^%[\w.-]+/)) {
        return "keyword";
      }
      if (stream.match(/^#\S+/)) {
        return "labelName";
      }
      if (stream.match(/^={[^{}]+}(?:<<=|=)/)) {
        return "def";
      }
      if (stream.match(/^=>>/)) {
        return "def";
      }
    }

    if (stream.match(/^\$\{[^}]*\}/)) {
      return "variableName";
    }
    if (stream.match(/^\/\.[\w.-]*\{/)) {
      return "className";
    }
    if (stream.match(/^\*\*[^*\n]+\*\*/) || stream.match(/^__[^_\n]+__/)) {
      return "strong";
    }
    if (stream.match(/^\*[^*\n]+\*/) || stream.match(/^_[^_\n]+_/)) {
      return "emphasis";
    }
    if (stream.match(/^\[[^\]]*\|[^\]]*\]/)) {
      return "link";
    }

    stream.next();
    return null;
  },
};

export const poemLanguage = StreamLanguage.define(poemStreamParser);

/**
 * Two colour sets, not one: the editor's "light" preset renders on a white
 * (`#fff`) background and "dark" on one-dark's `#282c34`
 * (`@codemirror/theme-one-dark`) — see Editor.tsx's `theme={prefersDark ?
 * oneDarkTheme : "light"}`. No single hex clears WCAG AA 4.5:1 against both a
 * near-white and a near-black background at once, so each tag needs a light
 * value and a dark value (verified in contrast.test.ts).
 */
export const poemHighlightStyleLight = HighlightStyle.define([
  { tag: t.comment, color: "#5c5c5c", fontStyle: "italic" },
  { tag: t.meta, color: "#8a5a12", fontWeight: "600" },
  { tag: t.heading, color: "#534ab7", fontWeight: "700" },
  { tag: t.heading2, color: "#534ab7", fontWeight: "600" },
  { tag: t.keyword, color: "#0b6e99" },
  { tag: t.labelName, color: "#1d824c" },
  { tag: t.definition(t.variableName), color: "#a6390f" },
  { tag: t.variableName, color: "#a6390f" },
  { tag: t.className, color: "#0b6e99" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.link, color: "#0b6e99", textDecoration: "underline" },
  { tag: t.string, color: "#5f6368" },
]);

export const poemHighlightStyleDark = HighlightStyle.define([
  { tag: t.comment, color: "#929cad", fontStyle: "italic" },
  { tag: t.meta, color: "#e5c07b", fontWeight: "600" },
  { tag: t.heading, color: "#d38ee6", fontWeight: "700" },
  { tag: t.heading2, color: "#d38ee6", fontWeight: "600" },
  { tag: t.keyword, color: "#61afef" },
  { tag: t.labelName, color: "#98c379" },
  { tag: t.definition(t.variableName), color: "#d19a66" },
  { tag: t.variableName, color: "#d19a66" },
  { tag: t.className, color: "#61afef" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.link, color: "#61afef", textDecoration: "underline" },
  { tag: t.string, color: "#7ec6d6" },
]);

const poemSyntaxHighlightingLight = syntaxHighlighting(poemHighlightStyleLight);
const poemSyntaxHighlightingDark = syntaxHighlighting(poemHighlightStyleDark);

export function poemSyntaxHighlighting(prefersDark: boolean) {
  return prefersDark ? poemSyntaxHighlightingDark : poemSyntaxHighlightingLight;
}
