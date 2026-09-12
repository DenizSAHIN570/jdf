import type { JdfDocument } from "@jdf/core";

/**
 * Bring a parsed JSON value into a shape the renderers can safely walk.
 *
 * Every viewer component iterates `doc.pages[*].elements` and reads
 * `doc.meta.*`; a document with `pages: 5`, a page without `elements`, or no
 * `meta` used to throw deep inside SolidJS, and — because the JSON view
 * autosaves 150 ms after a commit — the broken document was written to disk
 * so the next open crashed too. Recoverable gaps are filled in (missing
 * `elements` → `[]`, missing `meta` → `{ title }`); structurally hopeless
 * input throws with a message the UI can show.
 */
export function normalizeDoc(input: unknown, fallbackTitle = "Untitled"): JdfDocument {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Not a JDF document (expected a JSON object)");
  }
  const d = input as any;
  if (typeof d.$jdf !== "string") throw new Error("Not a JDF document (missing $jdf)");
  if (!Array.isArray(d.pages)) throw new Error("Invalid JDF: `pages` must be an array");
  for (let i = 0; i < d.pages.length; i++) {
    const p = d.pages[i];
    if (!p || typeof p !== "object" || Array.isArray(p)) {
      throw new Error(`Invalid JDF: pages[${i}] must be an object`);
    }
    if (!Array.isArray(p.elements)) p.elements = [];
  }
  if (!d.meta || typeof d.meta !== "object") d.meta = { title: fallbackTitle };
  if (typeof d.meta.title !== "string") d.meta.title = fallbackTitle;
  return d as JdfDocument;
}
