import path from "node:path";
import { fileURLToPath } from "node:url";

export const BENCH_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const REPO_ROOT = path.resolve(BENCH_ROOT, "..");
/** Env overrides let `verify` regenerate into a scratch dir without touching the committed corpus/results. */
export const CORPUS_DIR = process.env.JDF_BENCH_CORPUS_DIR ?? path.join(BENCH_ROOT, "corpus");
export const DOCS_DIR = path.join(CORPUS_DIR, "docs");
export const QUESTIONS_FILE = path.join(CORPUS_DIR, "questions.json");
export const MANIFEST_FILE = path.join(CORPUS_DIR, "manifest.json");
export const RESULTS_DIR = path.join(BENCH_ROOT, "results");
export const RESULTS_FILE = process.env.JDF_BENCH_RESULTS ?? path.join(RESULTS_DIR, "latest.json");
export const REPORT_FILE = process.env.JDF_BENCH_REPORT ?? path.join(RESULTS_DIR, "report.md");
export const CACHE_DIR = path.join(BENCH_ROOT, ".cache");
