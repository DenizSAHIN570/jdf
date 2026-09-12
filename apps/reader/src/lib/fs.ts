// File IO for the desktop reader.
//
// All reads/writes go through our own Rust commands instead of
// `@tauri-apps/plugin-fs`. The fs plugin enforces the capability scope in
// `src-tauri/capabilities/default.json`, which only covers Downloads /
// Documents / Desktop / tmp. Anything the user opened from elsewhere worked
// once (the Open dialog widens the scope for that session) but failed from
// Recent Files, Finder double-click, drag-drop or a CLI argument after a
// restart with "forbidden path". The Rust commands honour any path the user
// explicitly pointed at.
import { invoke } from "@tauri-apps/api/core";

export async function readTextFile(path: string): Promise<string> {
  return invoke<string>("read_text_file", { path });
}

export async function readBinaryFile(path: string): Promise<Uint8Array> {
  const buf = await invoke<ArrayBuffer>("read_binary_file", { path });
  return new Uint8Array(buf);
}

export async function writeBinaryFile(path: string, bytes: Uint8Array): Promise<void> {
  // Raw body + header keeps multi-MB .jdfx bundles off the JSON encoder.
  // Header values must be ASCII, hence the percent-encoding (decoded in Rust).
  await invoke("write_binary_file", bytes, { headers: { "x-jdf-path": encodeURIComponent(path) } });
}
