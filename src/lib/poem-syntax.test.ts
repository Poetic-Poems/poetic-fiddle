import { describe, expect, it } from "vitest";
import { poemLanguage } from "./poem-syntax";

/**
 * Parses through the real CodeMirror/Lezer pipeline (poemLanguage.parser),
 * not a hand-rolled StringStream fixture, so this exercises the tokenizer
 * the same way Editor.tsx does.
 */
function tokens(doc: string) {
  const tree = poemLanguage.parser.parse(doc);
  const result: { name: string; text: string }[] = [];
  tree.iterate({
    enter: (node) => {
      if (node.name === "Document") return;
      result.push({
        name: node.type.name,
        text: doc.slice(node.from, node.to),
      });
    },
  });
  return result;
}

describe("poemLanguage", () => {
  it("tags start-of-line structural markers", () => {
    expect(tokens("{{Title}}")).toEqual([
      { name: "heading", text: "{{Title}}" },
    ]);
    expect(tokens("{single}")).toEqual([
      { name: "heading2", text: "{single}" },
    ]);
    expect(tokens("%version 1")).toEqual([
      { name: "keyword", text: "%version" },
    ]);
    expect(tokens("#tag1\n#tag2")).toEqual([
      { name: "labelName", text: "#tag1" },
      { name: "labelName", text: "#tag2" },
    ]);
    expect(tokens("----\n====")).toEqual([
      { name: "meta", text: "----" },
      { name: "meta", text: "====" },
    ]);
  });

  it("tags variable definitions", () => {
    expect(tokens("={name}<<=")).toEqual([
      { name: "variableName.definition", text: "={name}<<=" },
    ]);
    expect(tokens("=>>")).toEqual([
      { name: "variableName.definition", text: "=>>" },
    ]);
  });

  it("tags inline spans anywhere in a line", () => {
    expect(tokens("${variable}")).toEqual([
      { name: "variableName", text: "${variable}" },
    ]);
    expect(tokens("/.class{")).toEqual([
      { name: "className", text: "/.class{" },
    ]);
    expect(tokens("**strong** and __also strong__")).toEqual([
      { name: "strong", text: "**strong**" },
      { name: "strong", text: "__also strong__" },
    ]);
    expect(tokens("*em* and _also em_")).toEqual([
      { name: "emphasis", text: "*em*" },
      { name: "emphasis", text: "_also em_" },
    ]);
    expect(tokens("[label|link]")).toEqual([
      { name: "link", text: "[label|link]" },
    ]);
  });

  it("holds comment state open across lines until the closing marker", () => {
    expect(tokens("<<#\nnot a real #tag\n#>>\nafter")).toEqual([
      { name: "comment", text: "<<#" },
      { name: "comment", text: "not a real #tag" },
      { name: "comment", text: "#>>" },
    ]);
  });

  it("holds literal-block state open across lines until the closing marker", () => {
    expect(tokens("<<<lang\nnot *emphasis*\nraw\n>>>\nafter")).toEqual([
      { name: "meta", text: "<<<lang" },
      { name: "string", text: "not *emphasis*" },
      { name: "string", text: "raw" },
      { name: "meta", text: ">>>" },
    ]);
  });

  it("leaves unmatched plain text untagged", () => {
    expect(tokens("just plain words with no markers")).toEqual([]);
  });
});
