import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  buildExportArchive,
  poemFileName,
  type ExportPayload,
} from "./export-archive";

describe("poemFileName", () => {
  it("slugs the title into an ordered ascii filename", () => {
    expect(poemFileName({ title: "The Autumn Wind!" }, 0)).toBe(
      "poems/001-the-autumn-wind.poem",
    );
  });

  it("falls back to the ordinal alone when the title has nothing sluggable", () => {
    expect(poemFileName({ title: "" }, 1)).toBe("poems/002.poem");
    expect(poemFileName({ title: "★☆" }, 2)).toBe("poems/003.poem");
  });

  it("keeps identically-titled poems distinct via the ordinal", () => {
    const a = poemFileName({ title: "Untitled" }, 0);
    const b = poemFileName({ title: "Untitled" }, 1);
    expect(a).not.toBe(b);
  });
});

// Walks the decompressed tar: reads each 512-byte ustar header, checks its
// magic and checksum, and collects {name, body} until the zero-block marker.
function listTarEntries(tarBuffer: Buffer) {
  const entries: { name: string; body: string }[] = [];
  let offset = 0;
  while (offset < tarBuffer.length) {
    const header = tarBuffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    expect(header.toString("utf8", 257, 262)).toBe("ustar");
    const stored = parseInt(header.toString("utf8", 148, 156), 8);
    const blanked = Buffer.from(header);
    blanked.fill(0x20, 148, 156);
    let sum = 0;
    for (const byte of blanked) sum += byte;
    expect(sum).toBe(stored);
    const name = header.toString("utf8", 0, 100).replace(/\0.*$/, "");
    const size = parseInt(header.toString("utf8", 124, 136), 8);
    const body = tarBuffer
      .subarray(offset + 512, offset + 512 + size)
      .toString("utf8");
    entries.push({ name, body });
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

describe("buildExportArchive", () => {
  const payload: ExportPayload = {
    exported_at: "2026-08-03T00:00:00.000Z",
    account: {
      id: "user-1",
      email: "poet@example.com",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    profile: {
      remix_default: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    },
    poems: [
      {
        id: "poem-1",
        title: "The Autumn Wind",
        source_text: "# The Autumn Wind\n\nLeaves fall.\nSo do I.\n",
        status: "draft",
        share_id: null,
        allow_remix: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "poem-2",
        title: "",
        source_text: "untitled lines\n",
        status: "unlisted",
        share_id: "abc123",
        allow_remix: true,
        created_at: "2026-01-02T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
      },
    ],
  };

  it("contains export.json with the whole payload, plus each poem verbatim", () => {
    const entries = listTarEntries(gunzipSync(buildExportArchive(payload)));

    expect(entries.map((e) => e.name)).toEqual([
      "export.json",
      "poems/001-the-autumn-wind.poem",
      "poems/002.poem",
    ]);
    expect(JSON.parse(entries[0].body)).toEqual(payload);
    expect(entries[1].body).toBe(
      "# The Autumn Wind\n\nLeaves fall.\nSo do I.\n",
    );
    expect(entries[2].body).toBe("untitled lines\n");
  });

  it("survives a poet with no poems", () => {
    const entries = listTarEntries(
      gunzipSync(buildExportArchive({ ...payload, poems: [] })),
    );
    expect(entries.map((e) => e.name)).toEqual(["export.json"]);
  });

  it("survives a poet with no profile row", () => {
    const entries = listTarEntries(
      gunzipSync(buildExportArchive({ ...payload, profile: null })),
    );
    expect(JSON.parse(entries[0].body).profile).toBeNull();
  });
});
