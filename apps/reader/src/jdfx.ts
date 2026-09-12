import JSZip from "jszip";
import {
  JDFX_DOCUMENT_PATH,
  JDFX_MANIFEST_PATH,
  JDFX_MANIFEST_VERSION,
  JDFX_ASSET_DIR,
  mimeOf,
  type JdfDocument,
  type JdfxManifest,
  type JdfxAssetEntry,
} from "@jdf/core";

const GENERATOR = "JDF Reader 0.1.14";

export interface UnpackedAsset {
  mimeType: string;
  /** Raw base64 (no `data:` prefix) — drops straight into `resources.images[id].data`. */
  base64: string;
  size: number;
}

export interface UnpackedJdfx {
  document: JdfDocument;
  manifest: JdfxManifest;
  /** Asset id → bytes. The caller binds these into `resources.images` so the
   *  renderer and the re-packer (`packJdfx`) see one consistent document. */
  assets: Map<string, UnpackedAsset>;
}

function uint8ToBase64(arr: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < arr.length; i += CHUNK) {
    binary += String.fromCharCode(...arr.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function ts(): string {
  return new Date().toISOString();
}

export async function unpackJdfx(bytes: Uint8Array | ArrayBuffer): Promise<UnpackedJdfx> {
  const zip = await JSZip.loadAsync(bytes);

  const docFile = zip.file(JDFX_DOCUMENT_PATH);
  if (!docFile) throw new Error(`${JDFX_DOCUMENT_PATH} missing from .jdfx bundle`);
  const document = JSON.parse(await docFile.async("string")) as JdfDocument;
  if (!document.$jdf) throw new Error("Bundle does not contain a valid JDF document");

  const manifestFile = zip.file(JDFX_MANIFEST_PATH);
  let manifest: JdfxManifest;
  if (manifestFile) {
    manifest = JSON.parse(await manifestFile.async("string")) as JdfxManifest;
  } else {
    manifest = {
      format: "jdfx",
      version: JDFX_MANIFEST_VERSION,
      document: JDFX_DOCUMENT_PATH,
      assets: [],
    };
  }

  const assets = new Map<string, UnpackedAsset>();
  const assetPrefix = `${JDFX_ASSET_DIR}/`;
  for (const entry of manifest.assets) {
    // Path-traversal guard — manifest paths are user-controlled (a hostile
    // .jdfx could put `..` or absolute paths). Restrict to entries under
    // assets/ so a manifest can't bind a resource to document.json or
    // anything outside the bundle's asset zone.
    if (!entry.path || entry.path.startsWith("/") || entry.path.includes("..") || !entry.path.startsWith(assetPrefix)) {
      console.warn(`[jdfx] dropping unsafe manifest asset path: ${entry.path}`);
      continue;
    }
    const file = zip.file(entry.path);
    if (!file) continue;
    const bytes = await file.async("uint8array");
    assets.set(entry.id, { mimeType: entry.mimeType || mimeOf(entry.path), base64: uint8ToBase64(bytes), size: bytes.length });
  }

  return { document, manifest, assets };
}

export interface PackedJdfx {
  bytes: Uint8Array;
  manifest: JdfxManifest;
}

/**
 * Walk the document, find every base64-embedded image (`resources.images.*.data`),
 * extract them into asset bytes, and rewrite the document so each `image` element
 * uses `resource: "<id>"` and `resources.images` is empty.
 *
 * Returns the rewritten document plus a map of asset id → bytes ready to zip.
 */
function extractAssets(doc: JdfDocument): { doc: JdfDocument; assets: Array<{ id: string; bytes: Uint8Array; mimeType: string; ext: string }> } {
  const assets: Array<{ id: string; bytes: Uint8Array; mimeType: string; ext: string }> = [];
  const cloned: JdfDocument = JSON.parse(JSON.stringify(doc));
  const images = cloned.resources?.images ?? {};
  let counter = 0;

  for (const [key, res] of Object.entries(images)) {
    if (!res || typeof res !== "object" || !("data" in res) || !res.data) continue;
    const data = String(res.data);
    const m = data.match(/^data:([^;]+);base64,(.*)$/);
    const b64 = m ? m[2] : data;
    const mimeType = m ? m[1] : (res as any).mimeType || "image/png";
    const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "bin";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    counter++;
    const id = key || `asset-${counter}`;
    assets.push({ id, bytes, mimeType, ext });
  }

  // Walk every element with src="data:..." or resource="..." backed by extracted asset
  function walk(els: any[] | undefined) {
    if (!els) return;
    for (const el of els) {
      if (el?.type === "image") {
        if (el.src && typeof el.src === "string" && el.src.startsWith("data:")) {
          const m = el.src.match(/^data:([^;]+);base64,(.*)$/);
          if (m) {
            counter++;
            const id = `asset-${counter}`;
            const mimeType = m[1];
            const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "bin";
            const bin = atob(m[2]);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            assets.push({ id, bytes, mimeType, ext });
            delete el.src;
            el.resource = id;
          }
        }
      }
      if (el?.elements) walk(el.elements);
      if (el?.children) walk(el.children);
    }
  }
  for (const page of cloned.pages || []) walk(page.elements as any[]);

  if (cloned.resources?.images) cloned.resources.images = {};
  return { doc: cloned, assets };
}

export async function packJdfx(doc: JdfDocument, prevManifest?: JdfxManifest): Promise<PackedJdfx> {
  const { doc: rewritten, assets } = extractAssets(doc);

  const zip = new JSZip();
  const assetEntries: JdfxAssetEntry[] = assets.map((a) => {
    const path = `${JDFX_ASSET_DIR}/${a.id}.${a.ext}`;
    zip.file(path, a.bytes);
    return { id: a.id, path, mimeType: a.mimeType, size: a.bytes.length };
  });

  const now = ts();
  const manifest: JdfxManifest = {
    format: "jdfx",
    version: JDFX_MANIFEST_VERSION,
    document: JDFX_DOCUMENT_PATH,
    created: prevManifest?.created || now,
    modified: now,
    generator: GENERATOR,
    assets: assetEntries,
  };

  zip.file(JDFX_DOCUMENT_PATH, JSON.stringify(rewritten, null, 2));
  zip.file(JDFX_MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
  return { bytes, manifest };
}

/**
 * Decide whether a document should be saved as `.jdf` (plain JSON) or `.jdfx` (zip bundle).
 * Rule: any embedded image (data: URL or non-empty resources.images.*.data) → .jdfx.
 */
export function shouldUseJdfx(doc: JdfDocument): boolean {
  const images = doc.resources?.images ?? {};
  for (const v of Object.values(images)) {
    if (v && typeof v === "object" && "data" in v && (v as any).data) return true;
  }
  function walk(els: any[] | undefined): boolean {
    if (!els) return false;
    for (const el of els) {
      if (el?.type === "image" && typeof el.src === "string" && el.src.startsWith("data:")) return true;
      if (el?.elements && walk(el.elements)) return true;
      if (el?.children && walk(el.children)) return true;
    }
    return false;
  }
  for (const page of doc.pages || []) {
    if (walk(page.elements as any[])) return true;
  }
  return false;
}

export { mimeOf };
