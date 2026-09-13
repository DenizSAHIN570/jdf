import JSZip from "jszip";
import {
  JDFX_DOCUMENT_PATH,
  JDFX_MANIFEST_PATH,
  JDFX_ASSET_DIR,
  isVideoMime,
  mimeOf,
  type JdfDocument,
  type JdfxManifest,
} from "@jdf/core";

/**
 * Reject manifest asset paths that try to escape the bundle's asset
 * directory. JSZip operates in-memory so this isn't a filesystem traversal
 * — but a crafted manifest can still bind an image resource to
 * `document.json` itself, or to any other zip entry, which produces
 * confusing render output (the document's own JSON loaded as an image).
 * Restrict to entries under `assets/` and reject anything with `..`.
 */
function isSafeAssetPath(p: string): boolean {
  if (!p || typeof p !== "string") return false;
  if (p.startsWith("/") || p.includes("\\")) return false;
  if (p.includes("..")) return false;
  return p.startsWith(`${JDFX_ASSET_DIR}/`);
}

function uint8ToBase64(arr: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < arr.length; i += CHUNK) {
    binary += String.fromCharCode(...arr.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Open a `.jdfx` zip bundle and return the embedded JDF document with every
 * zip asset bound into `resources.images[id].data` as base64. The image
 * renderer resolves `resource → resources.images[id]`, so no element needs
 * rewriting — and `viewer.exportJdf()` therefore emits a self-contained
 * document. (An earlier version rewrote `el.src` to `blob:` object URLs;
 * those rendered, but exports carried dead URLs and lost every image.)
 */
export async function unpackJdfxToDocument(bytes: ArrayBuffer | Uint8Array): Promise<JdfDocument> {
  const zip = await JSZip.loadAsync(bytes as ArrayBuffer);

  const docFile = zip.file(JDFX_DOCUMENT_PATH);
  if (!docFile) throw new Error(`${JDFX_DOCUMENT_PATH} missing from .jdfx bundle`);
  const doc = JSON.parse(await docFile.async("string")) as JdfDocument;

  const manifestFile = zip.file(JDFX_MANIFEST_PATH);
  let manifest: JdfxManifest | null = null;
  if (manifestFile) {
    try {
      manifest = JSON.parse(await manifestFile.async("string")) as JdfxManifest;
    } catch {
      manifest = null;
    }
  }

  if (manifest?.assets) {
    if (!doc.resources) doc.resources = { images: {} };
    if (!doc.resources.images) doc.resources.images = {};
    for (const entry of manifest.assets) {
      if (!isSafeAssetPath(entry.path)) {
        console.warn(`[jdfjs] dropping unsafe manifest asset path: ${entry.path}`);
        continue;
      }
      const file = zip.file(entry.path);
      if (!file) continue;
      const data = await file.async("uint8array");
      const mimeType = entry.mimeType || mimeOf(entry.path);
      const res = { src: "embedded" as const, mimeType, data: uint8ToBase64(data) };
      // Videos bind into resources.videos, everything else into resources.images
      // — the renderers look up `resource` ids in both.
      if (isVideoMime(mimeType)) {
        if (!doc.resources.videos) doc.resources.videos = {};
        doc.resources.videos[entry.id] = res;
      } else {
        doc.resources.images[entry.id] = res;
      }
    }
  }

  return doc;
}
