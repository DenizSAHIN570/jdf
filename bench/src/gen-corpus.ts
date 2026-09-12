/**
 * Corpus generator — 24 multi-page "Quarterly Operations Report" documents,
 * authored natively as JDF, plus a question set with ground truth.
 *
 * Everything is derived from a fixed seed, so `pnpm --filter @jdf/bench corpus`
 * regenerates byte-identical files. The PDFs in the same folder are printed
 * from these JDFs by a real browser (see print-pdf.mjs) — the PDF pipeline is
 * therefore fed exactly the same content a human would see on paper.
 *
 * Why synthetic? A retrieval benchmark needs ground truth: for each question,
 * which document and which cell/sentence answers it. Public PDF corpora don't
 * ship that. Generating the data lets us know the answer's location exactly,
 * and lets anyone inspect every document + question in `bench/corpus/`.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Rng } from "./lib/rng.ts";
import { DOCS_DIR, QUESTIONS_FILE, MANIFEST_FILE } from "./lib/paths.ts";

export const SEED = 20260912;

// ── vocabulary ──────────────────────────────────────────────────────────────
const COMPANIES = [
  ["Acme Logistics", "freight and last-mile delivery"],
  ["Borealis Energy", "distributed solar and storage"],
  ["Cobalt Health", "clinic scheduling and telehealth"],
  ["Delta Foods", "cold-chain grocery distribution"],
  ["Evergreen Retail", "omnichannel home goods"],
  ["Fjord Analytics", "supply-chain forecasting"],
  ["Granite Insurance", "small-business commercial insurance"],
  ["Helix Biotech", "laboratory automation"],
  ["Ironwood Media", "regional streaming and publishing"],
  ["Juniper Telecom", "fixed wireless broadband"],
  ["Kestrel Aviation", "charter operations and MRO"],
  ["Lumen Education", "vocational learning platforms"],
] as const;
const QUARTERS = ["Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025"];
const NEXT_Q: Record<string, string> = { "Q1 2025": "Q2 2025", "Q2 2025": "Q3 2025", "Q3 2025": "Q4 2025", "Q4 2025": "Q1 2026" };
const REGIONS = ["EMEA", "APAC", "North America", "LATAM", "Nordics", "Middle East", "ANZ", "DACH", "Benelux", "Iberia", "UK & Ireland", "Japan"];
const DEPARTMENTS = ["Engineering", "Sales", "Customer Success", "Marketing", "Finance", "Operations", "Legal", "People", "Product", "Data", "Security", "Support"];
const PLANS = ["Starter", "Team", "Business", "Enterprise", "Scale", "Lite", "Pro", "Growth"];
const SERVICES = ["API Gateway", "Billing", "Identity", "Search", "Notifications", "Reporting", "Storage", "Checkout", "Ingest", "Scheduler", "Payments", "Catalog"];
const VENDORS = ["Northwind Cloud", "Zephyr Networks", "Halcyon Security", "Obsidian Data", "Quill Payroll", "Meridian Legal", "Solstice CRM", "Atlas Freight", "Pinnacle Staffing", "Vega Observability", "Corvid Analytics", "Tundra Hosting", "Marlowe Consulting", "Saffron Design", "Basalt Storage", "Lyric Telephony", "Orchid Benefits", "Redwood Facilities", "Cinder Marketing", "Willow Travel"];
const CATEGORIES = ["Cloud infrastructure", "Security", "Professional services", "SaaS", "Facilities", "HR & benefits", "Marketing", "Telecom"];
const TEAMS = ["Platform", "Core Services", "Payments", "Growth", "Infrastructure", "Trust & Safety", "Data Platform", "Developer Experience"];
const PEOPLE = ["Mara Lindqvist", "Tomasz Wierzbicki", "Aiko Tanaka", "Samuel Adeyemi", "Priya Raghavan", "Luca Ferretti", "Ingrid Solberg", "Diego Álvarez", "Nadia Haddad", "Owen Gallagher", "Yara Mansour", "Felix Brandt", "Hana Kovač", "Rafael Moreira", "Sena Yıldız", "Kwame Mensah", "Elena Petrova", "Jonas Meyer", "Amara Okafor", "Noor Rahman", "Mateo Rossi", "Ayşe Demir", "Liam O'Connor", "Zoe Papadakis", "Ravi Menon", "Sofia Lindgren", "Ibrahim Sow", "Chloé Martin", "Ken Watanabe", "Leila Farahani"];
const RISKS = ["Vendor concentration", "Key-person dependency", "Data residency", "Regulatory change", "Currency exposure", "Capacity shortfall", "Migration slippage", "Security posture", "Hiring velocity", "Customer concentration"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── prose templates ─────────────────────────────────────────────────────────
const P = {
  summary: [
    "This report summarises {company}'s operating performance for {quarter}. The business operates in {industry}, and the quarter was shaped by {theme}. Figures are unaudited and reflect management accounts as of quarter close.",
    "{company} closed {quarter} with {theme}. As a company focused on {industry}, the leadership team tracked regional performance, headcount, pricing, service levels and vendor spend against the annual plan, all of which are detailed in the sections that follow.",
    "The following pages present {company}'s {quarter} operating review. The period was characterised by {theme}; management attention centred on {industry} fundamentals, cost discipline and platform reliability.",
  ],
  theme: ["steady demand and margin pressure from freight costs", "strong new-logo growth offset by elevated churn in one region", "a disciplined cost programme and a pricing reset", "two platform migrations and a reorganisation of the support function", "record retention and slower hiring", "heavy investment in reliability after an incident-heavy prior quarter"],
  owner: "The {system} platform is owned by the {team} team; its on-call lead for the quarter is {person}, who also chairs the weekly reliability review.",
  regional: [
    "Regional results are reported in constant currency. Revenue reflects recognised subscription and services revenue; growth is quarter-over-quarter; churn is logo churn measured at renewal; NPS is the trailing 90-day relationship score.",
    "The table below breaks down performance by sales region. Growth is measured against the prior quarter in constant currency, and churn counts customers who did not renew during the period.",
  ],
  headcount: [
    "Headcount reflects full-time employees at quarter end. Open roles are approved requisitions not yet filled. Attrition is annualised voluntary attrition for the department.",
    "The people plan tracks each department against its approved headcount. The attrition column is annualised and covers voluntary departures only.",
  ],
  pricing: [
    "The following list-price changes were approved by the pricing committee and communicated to customers at least 30 days ahead of their effective date. Existing contracts move to the new price at renewal.",
    "Pricing adjustments this quarter apply to new business from the effective date shown. Renewals honour the old price until the anniversary of the contract.",
  ],
  sla: [
    "Service levels are measured against the published SLA. Uptime excludes scheduled maintenance windows. P95 latency is measured at the edge over the whole quarter. Incidents count customer-impacting events of severity 2 or higher.",
    "Reliability metrics for customer-facing services are shown below. Latency figures are 95th-percentile end-to-end measurements; incident counts include only events that triggered a customer notification.",
  ],
  risks: [
    "The risk register was reviewed by the executive team in the final month of the quarter. Each item has a named owner responsible for the mitigation plan and its monthly status update.",
    "Top risks for the coming quarter, with the executive owner accountable for mitigation, are listed below. Items are ordered by residual exposure.",
  ],
  vendors: [
    "Vendor spend covers contracted annual commitments above the procurement threshold. Renewal dates are contract anniversaries at which terms can be renegotiated or the contract terminated.",
    "The vendor table lists strategic suppliers by annual spend. Procurement reviews each contract 90 days before its renewal date.",
  ],
  outlook: [
    "Looking ahead to {nextq}, management expects {outlook}. Capital expenditure for {nextq} is budgeted at {capex}, the majority allocated to {capexuse}.",
    "For {nextq} the plan assumes {outlook}. The board approved a capital expenditure budget of {capex} for {nextq}, weighted towards {capexuse}.",
  ],
  outlookTheme: ["modest sequential growth with flat headcount", "continued margin expansion as the pricing changes flow through renewals", "a return to hiring in engineering and customer success", "stable churn and a step-up in enterprise pipeline"],
  capexUse: ["data-centre capacity and network hardware", "warehouse automation", "laboratory equipment", "fleet renewal", "office consolidation", "edge infrastructure"],
  filler: [
    "Management notes that comparisons to the prior year are affected by the change in revenue recognition adopted at the start of the fiscal year.",
    "Detailed departmental commentary is available in the appendix distributed to budget owners.",
    "All figures in this section are rounded; totals may not sum exactly.",
    "The finance team will publish a reconciliation to the statutory accounts after the audit.",
    "Where a metric definition changed during the quarter, the prior quarter has been restated on the new basis.",
    "Operational KPIs are refreshed weekly on the internal dashboard; this document is the quarterly point-in-time snapshot.",
  ],
};

// ── formatting helpers ──────────────────────────────────────────────────────
const money = (n: number) => `$${n.toLocaleString("en-US")}`;
const millions = (rng: Rng, lo: number, hi: number) => `$${(rng.int(lo * 10, hi * 10) / 10).toFixed(1)}M`;
const pct = (rng: Rng, lo: number, hi: number, dp = 1) => `${(rng.int(lo * 10, hi * 10) / 10).toFixed(dp)}%`;
const signedPct = (rng: Rng) => { const v = rng.int(-45, 180) / 10; return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`; };
const fill = (t: string, vars: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);

// ── layout: assigns absolute positions and paginates ───────────────────────
const PAGE = { width: 210, height: 297, margin: 22, headerH: 10, footerH: 10 };
const CONTENT_W = PAGE.width - 2 * PAGE.margin; // 166 mm
const CONTENT_H = PAGE.height - 2 * PAGE.margin - PAGE.headerH - PAGE.footerH; // 233 mm
const PT_MM = 0.3528;

function textHeight(text: string, fontSize: number, lineHeight = 1.6, widthMm = CONTENT_W): number {
  // Conservative: Helvetica averages ~0.5em per glyph; bold headings are wider.
  const charW = fontSize * (fontSize > 14 ? 0.58 : 0.5) * PT_MM;
  const perLine = Math.max(10, Math.floor((widthMm / charW) * 0.9));
  const lines = Math.max(1, Math.ceil(text.length / perLine));
  return lines * fontSize * lineHeight * PT_MM + 1.5;
}

interface Placed { el: Record<string, unknown>; h: number; keepWithNext?: boolean; }

class Layout {
  pages: Record<string, unknown>[][] = [[]];
  y = 0;
  private pending: Placed | null = null;
  private place(p: Placed) {
    const gap = 4;
    if (this.y + p.h > CONTENT_H && this.pages[this.pages.length - 1].length > 0) { this.pages.push([]); this.y = 0; }
    this.pages[this.pages.length - 1].push({ ...p.el, position: { x: 0, y: Math.round(this.y * 10) / 10 }, width: CONTENT_W });
    this.y += p.h + gap;
  }
  add(el: Record<string, unknown>, h: number, keepWithNext = false) {
    const p: Placed = { el, h, keepWithNext };
    if (this.pending) {
      // Heading + first body element move together so no heading is orphaned.
      if (this.y + this.pending.h + 4 + p.h > CONTENT_H) { this.pages.push([]); this.y = 0; }
      this.place(this.pending); this.pending = null;
    }
    if (keepWithNext) this.pending = p; else this.place(p);
  }
  finish() { if (this.pending) { this.place(this.pending); this.pending = null; } return this.pages; }
}

// ── document model ──────────────────────────────────────────────────────────
export interface Question {
  id: string;
  doc: string;
  type: "table" | "prose" | "list";
  question: string;
  /** Exact answer string as it appears in the document. */
  answer: string;
  /** Row / subject key that must co-occur with the answer in a retrieved chunk. */
  key: string;
  /** Id of the JDF element that holds the answer (for auditing). */
  element: string;
  section: string;
}

interface TableSpec { id: string; section: string; headers: string[]; rows: string[][]; widths: number[]; aligns: ("left" | "right")[]; }

function buildDoc(rng: Rng, docId: string, company: string, industry: string, quarter: string) {
  const title = `${company} — ${quarter} Operations Report`;
  const questions: Question[] = [];
  const L = new Layout();
  let n = 0;
  const id = (s: string) => `${docId}-${s}`;
  const heading = (text: string, level: 1 | 2, key: string) =>
    L.add({ id: id(key), type: "text", content: text, heading: level, style: level === 1 ? "h1" : "h2", tocEntry: text, tocLevel: level }, textHeight(text, level === 1 ? 24 : 15, 1.3) + 2, true);
  const para = (text: string, key: string) => L.add({ id: id(key), type: "text", content: text, style: "body" }, textHeight(text, 11));
  const table = (t: TableSpec) => {
    const rowH = 11;
    L.add({
      id: t.id, type: "table", headers: t.headers, rows: t.rows, borders: true,
      columns: t.widths.map((w, i) => ({ width: w, align: t.aligns[i] })),
      headerStyle: { backgroundColor: "#f1f5f9", fontWeight: "bold", color: "#0f172a" },
      alternatingRowColor: "#f8fafc",
    }, rowH * (t.rows.length + 1) + 2);
  };
  const vars: Record<string, string> = { company, industry, quarter, nextq: NEXT_Q[quarter], theme: rng.pick(P.theme) };

  // 1 · title + executive summary (prose fact: on-call lead)
  heading(title, 1, "title");
  heading("1. Executive Summary", 2, "s1");
  para(fill(rng.pick(P.summary), vars), `s1-p${n++}`);
  const system = rng.pick(SERVICES), team = rng.pick(TEAMS), lead = rng.pick(PEOPLE);
  para(fill(P.owner, { system, team, person: lead }), `s1-owner`);
  questions.push({ id: "", doc: docId, type: "prose", section: "Executive Summary", element: id("s1-owner"), key: system, answer: lead,
    question: rng.pick([`Who is the on-call lead for the ${system} platform at ${company} in ${quarter}?`, `${company}, ${quarter}: who was on-call lead for ${system}?`, `Which person leads on-call for ${company}'s ${system} platform in ${quarter}?`]) });
  para(rng.pick(P.filler), `s1-p${n++}`);

  // 2 · regional performance table
  heading("2. Regional Performance", 2, "s2");
  para(rng.pick(P.regional), `s2-p${n++}`);
  const regions = rng.sample(REGIONS, 6);
  const tRegional: TableSpec = { id: id("s2-table"), section: "Regional Performance", headers: ["Region", "Revenue", "Growth", "Churn rate", "NPS"], widths: [46, 30, 30, 30, 30], aligns: ["left", "right", "right", "right", "right"],
    rows: regions.map((r) => [r, millions(rng, 2, 48), signedPct(rng), pct(rng, 0.5, 9), String(rng.int(-5, 72))]) };
  table(tRegional);
  para(rng.pick(P.filler), `s2-p${n++}`);

  // 3 · headcount table
  heading("3. Headcount", 2, "s3");
  para(rng.pick(P.headcount), `s3-p${n++}`);
  const depts = rng.sample(DEPARTMENTS, 6);
  const tHead: TableSpec = { id: id("s3-table"), section: "Headcount", headers: ["Department", "Headcount", "Open roles", "Attrition"], widths: [61, 35, 35, 35], aligns: ["left", "right", "right", "right"],
    rows: depts.map((d) => [d, String(rng.int(8, 340)), String(rng.int(0, 24)), pct(rng, 2, 19)]) };
  table(tHead);

  // 4 · pricing table
  heading("4. Pricing Changes", 2, "s4");
  para(rng.pick(P.pricing), `s4-p${n++}`);
  const plans = rng.sample(PLANS, 5);
  const tPrice: TableSpec = { id: id("s4-table"), section: "Pricing Changes", headers: ["Plan", "Old price", "New price", "Effective date"], widths: [46, 40, 40, 40], aligns: ["left", "right", "right", "left"],
    rows: plans.map((p) => { const old = rng.int(9, 240); return [p, `${money(old)}/mo`, `${money(old + rng.int(2, 60))}/mo`, `${rng.int(1, 28)} ${rng.pick(MONTHS)} 2025`]; }) };
  table(tPrice);
  para(rng.pick(P.filler), `s4-p${n++}`);

  // 5 · service levels table
  heading("5. Service Levels", 2, "s5");
  para(rng.pick(P.sla), `s5-p${n++}`);
  const services = rng.sample(SERVICES, 6);
  const tSla: TableSpec = { id: id("s5-table"), section: "Service Levels", headers: ["Service", "Uptime", "P95 latency", "Incidents"], widths: [61, 35, 35, 35], aligns: ["left", "right", "right", "right"],
    rows: services.map((s) => [s, `${(99 + rng.int(500, 999) / 1000).toFixed(3)}%`, `${rng.int(40, 900)} ms`, String(rng.int(0, 9))]) };
  table(tSla);

  // 6 · risks list (list fact: risk owner)
  heading("6. Risks and Mitigations", 2, "s6");
  para(rng.pick(P.risks), `s6-p${n++}`);
  const risks = rng.sample(RISKS, 4).map((r) => ({ risk: r, owner: rng.pick(PEOPLE) }));
  const riskItems = risks.map((r) => ({ content: `${r.risk} — owner: ${r.owner}. Mitigation reviewed monthly; residual exposure rated ${rng.pick(["low", "medium", "high"])}.` }));
  L.add({ id: id("s6-list"), type: "list", listType: "unordered", style: "body",
    items: riskItems }, riskItems.reduce((h, it) => h + textHeight(it.content, 10.5, 1.6, CONTENT_W - 6), 0) + 4);
  const rq = rng.pick(risks);
  questions.push({ id: "", doc: docId, type: "list", section: "Risks and Mitigations", element: id("s6-list"), key: rq.risk, answer: rq.owner,
    question: rng.pick([`Who owns the "${rq.risk}" risk at ${company} for ${quarter}?`, `In ${company}'s ${quarter} report, which executive is the owner of the ${rq.risk} risk?`]) });
  para(rng.pick(P.filler), `s6-p${n++}`);

  // 7 · vendor spend table
  heading("7. Vendor Spend", 2, "s7");
  para(rng.pick(P.vendors), `s7-p${n++}`);
  const vendors = rng.sample(VENDORS, 6);
  const tVend: TableSpec = { id: id("s7-table"), section: "Vendor Spend", headers: ["Vendor", "Category", "Annual spend", "Renewal"], widths: [50, 46, 36, 34], aligns: ["left", "left", "right", "left"],
    rows: vendors.map((v) => [v, rng.pick(CATEGORIES), money(rng.int(24, 1900) * 1000), `${rng.pick(MONTHS)} 2026`]) };
  table(tVend);

  // 8 · outlook (prose fact: capex)
  heading("8. Outlook", 2, "s8");
  const capex = millions(rng, 1, 24);
  para(fill(rng.pick(P.outlook), { ...vars, outlook: rng.pick(P.outlookTheme), capex, capexuse: rng.pick(P.capexUse) }), `s8-outlook`);
  questions.push({ id: "", doc: docId, type: "prose", section: "Outlook", element: id("s8-outlook"), key: "capital expenditure", answer: capex,
    question: rng.pick([`What capital expenditure did ${company} budget for ${NEXT_Q[quarter]}?`, `How much capex did ${company} plan for ${NEXT_Q[quarter]} according to its ${quarter} report?`]) });
  para(rng.pick(P.filler), `s8-p${n++}`);

  // table questions — one cell from each of the five tables
  const tq = (t: TableSpec, colIdx: number, phr: (row: string, col: string) => string[]) => {
    const row = rng.pick(t.rows);
    const col = t.headers[colIdx];
    questions.push({ id: "", doc: docId, type: "table", section: t.section, element: t.id, key: row[0], answer: row[colIdx], question: rng.pick(phr(row[0], col)) });
  };
  tq(tRegional, rng.int(1, 4), (r, c) => [`What was ${company}'s ${c.toLowerCase()} in ${r} for ${quarter}?`, `${company} ${quarter}: ${c.toLowerCase()} for the ${r} region?`]);
  tq(tHead, rng.int(1, 3), (r, c) => [`How many ${c.toLowerCase()} did ${company}'s ${r} department report in ${quarter}?`.replace("How many attrition", "What attrition"), `${company} ${quarter} headcount report — ${c.toLowerCase()} for ${r}?`]);
  tq(tPrice, rng.int(1, 3), (r, c) => [`What is the ${c.toLowerCase()} of the ${r} plan in ${company}'s ${quarter} pricing changes?`, `${company}, ${quarter}: ${r} plan ${c.toLowerCase()}?`]);
  tq(tSla, rng.int(1, 3), (r, c) => [`What ${c.toLowerCase()} did ${company}'s ${r} service achieve in ${quarter}?`, `${company} ${quarter} service levels: ${c.toLowerCase()} for ${r}?`]);
  tq(tVend, rng.int(1, 3), (r, c) => [`What is the ${c.toLowerCase()} for ${r} in ${company}'s ${quarter} vendor list?`, `${company} ${quarter}: ${r} ${c.toLowerCase()}?`]);

  const pages = L.finish().map((elements, i) => ({ id: `${docId}-page-${i + 1}`, elements }));
  const doc = {
    $jdf: "1.0.0",
    meta: { title, author: `${company} Finance`, pageSize: "A4", unit: "mm", language: "en", margins: { top: PAGE.margin, right: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin } },
    styles: {
      h1: { fontFamily: "Helvetica, Arial, sans-serif", fontSize: 24, fontWeight: "bold", color: "#0f172a" },
      h2: { fontFamily: "Helvetica, Arial, sans-serif", fontSize: 15, fontWeight: "bold", color: "#1d4ed8" },
      body: { fontFamily: "Helvetica, Arial, sans-serif", fontSize: 11, lineHeight: 1.6, color: "#334155" },
    },
    header: { height: PAGE.headerH, content: "{{title}}" },
    footer: { height: PAGE.footerH, content: "Confidential — {{author}} · Page {{pageNumber}} of {{totalPages}}" },
    pages,
  };
  return { doc, questions };
}

export function generateCorpus() {
  const rng = new Rng(SEED);
  const docs: { id: string; file: string; title: string; pages: number }[] = [];
  const questions: Question[] = [];
  let d = 0;
  for (const [company, industry] of COMPANIES) {
    for (const quarter of rng.sample(QUARTERS, 2)) {
      d++;
      const docId = `d${String(d).padStart(2, "0")}`;
      const { doc, questions: qs } = buildDoc(rng, docId, company, industry, quarter);
      docs.push({ id: docId, file: `docs/${docId}.jdf`, title: doc.meta.title, pages: doc.pages.length });
      questions.push(...qs);
      fs.mkdirSync(DOCS_DIR, { recursive: true });
      fs.writeFileSync(path.join(DOCS_DIR, `${docId}.jdf`), JSON.stringify(doc, null, 2) + "\n");
    }
  }
  questions.forEach((q, i) => (q.id = `q${String(i + 1).padStart(3, "0")}`));
  fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(questions, null, 2) + "\n");
  const sha = (f: string) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
  const manifest = {
    seed: SEED,
    documents: docs.map((x) => ({ ...x, sha256_jdf: sha(path.join(DOCS_DIR, `${x.id}.jdf`)) })),
    questions: { count: questions.length, sha256: sha(QUESTIONS_FILE), byType: { table: questions.filter((q) => q.type === "table").length, prose: questions.filter((q) => q.type === "prose").length, list: questions.filter((q) => q.type === "list").length } },
  };
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

if (process.argv[1] && /gen-corpus\.ts$/.test(process.argv[1])) {
  const m = generateCorpus();
  const pages = m.documents.reduce((a, x) => a + x.pages, 0);
  console.log(`corpus: ${m.documents.length} documents, ${pages} pages, ${m.questions.count} questions (${JSON.stringify(m.questions.byType)}) → bench/corpus/`);
}
