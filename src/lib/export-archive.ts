import { gzipSync } from "node:zlib";

/**
 * The self-service export payload for one poet: their own account, profile
 * row, and every poem row they own — the same shape as the maintainer-run
 * `scripts/export-poet-data.mjs`, minus the admin-only `auth.users` fields
 * that script's full user object carries (this route never touches the
 * service-role key, so it only has what the caller's own token can see).
 */
export interface ExportedPoem {
  id: string;
  title: string;
  source_text: string;
  status: string;
  share_id: string | null;
  allow_remix: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface ExportedProfile {
  remix_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExportPayload {
  exported_at: string;
  account: { id: string; email: string | null; created_at: string };
  profile: ExportedProfile | null;
  poems: ExportedPoem[];
}

/**
 * `poems/NNN-<title-slug>.poem` — matches `poemFileName` in
 * `scripts/export-poet-data.mjs` exactly, so a poet's self-service export
 * and a maintainer-run one name files the same way.
 */
export function poemFileName(poem: { title: string }, index: number): string {
  const slug = poem.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  const ordinal = String(index + 1).padStart(3, "0");
  return `poems/${ordinal}${slug ? `-${slug}` : ""}.poem`;
}

// A minimal POSIX-ustar header, the same hand-rolled approach as
// `scripts/export-poet-data.mjs` and for the same reason: the inputs are
// fully under our control (short ASCII names, small files), and building the
// archive in memory means a poet's data never touches disk as an
// intermediate file — here, that also means it never leaves this server
// process before streaming to the response.
function tarHeader(name: string, size: number, mtimeSeconds: number): Buffer {
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, "utf8");
  header.write("0000600 ", 100); // mode
  header.write("0000000 ", 108); // uid
  header.write("0000000 ", 116); // gid
  header.write(`${size.toString(8).padStart(11, "0")} `, 124);
  header.write(`${mtimeSeconds.toString(8).padStart(11, "0")} `, 136);
  header.write("        ", 148); // checksum is computed with its field blank
  header.write("0", 156); // typeflag: regular file
  header.write("ustar", 257);
  header.write("00", 263);
  let sum = 0;
  for (const byte of header) sum += byte;
  header.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148);
  return header;
}

/**
 * The export as a gzipped tar: `export.json` (the whole payload,
 * machine-readable) plus one `poems/NNN-<title-slug>.poem` per poem,
 * `source_text` verbatim — so the poet can read their poems as poems
 * without parsing JSON out of the payload.
 */
export function buildExportArchive(payload: ExportPayload): Buffer {
  const mtimeSeconds = Math.floor(Date.parse(payload.exported_at) / 1000);
  const files = [
    { name: "export.json", body: JSON.stringify(payload, null, 2) },
    ...payload.poems.map((poem, index) => ({
      name: poemFileName(poem, index),
      body: poem.source_text,
    })),
  ];
  const blocks: Buffer[] = [];
  for (const { name, body } of files) {
    const data = Buffer.from(body, "utf8");
    blocks.push(tarHeader(name, data.length, mtimeSeconds), data);
    blocks.push(Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024)); // end-of-archive marker
  return gzipSync(Buffer.concat(blocks));
}
