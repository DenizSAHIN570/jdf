// Copies the shipped example into src/ as JSON so the composition can import it (webpack knows .json, not .jdf).
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
fs.copyFileSync(path.resolve(here, "../../../docs/examples/video.jdf"), path.resolve(here, "../src/example.json"));
console.log("example.json refreshed from docs/examples/video.jdf");
