/**
 * DataTable (from Cue, adapted): search, filters, sorting, inline editing, bulk actions, column resize and reorder,
 * rows that open, keyboard moves, pages. React only, no deps. CSS is scoped under .dtb.
 * PropBot changes: colours come from the app's theme tokens (--surface, --text, --border, --accent), money is ₹,
 * Archive/Delete show only when their handler is passed, and `bulkActions` adds buttons to the selection bar.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode } from "react";

export type DTType = "person" | "text" | "number" | "money" | "select" | "status" | "date" | "ago";
export type DTColumn = {
  key: string;
  label: string;
  type?: DTType;
  width?: number;
  editable?: boolean;
  options?: string[];
  subKey?: string;
  filter?: boolean;
  hidden?: boolean;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DTRow = { id: string | number; [key: string]: any };
export type DTLabels = Partial<{
  search: string; filter: string; columns: string; export: string; rows: string; selected: string; archive: string;
  delete: string; undo: string; emptyTitle: string; emptyText: string; clear: string; notes: string; trend: string; account: string;
}>;
type Sort = { key: string; dir: 1 | -1 };

type DataTableProps = {
  title?: string;
  rows?: DTRow[];
  columns?: DTColumn[];
  pageSize?: number;
  pageSizes?: number[];
  density?: "comfortable" | "compact";
  defaultSort?: Sort[];
  statusColors?: Record<string, string>;
  detail?: (row: DTRow) => ReactNode;
  loading?: boolean;
  labels?: DTLabels;
  bulkActions?: (ids: (string | number)[], clear: () => void) => ReactNode;
  toolbarEnd?: ReactNode;                  // extra buttons at the end of the toolbar (use the .dtb-tb / .dtb-tb.pri classes)
  hideTitle?: boolean;                     // the page already has a heading
  onEdit?: (row: DTRow, key: string, value: unknown) => void;
  onSort?: (sort: Sort[]) => void;
  onSelect?: (ids: (string | number)[]) => void;
  onDelete?: (rows: DTRow[]) => void;
  onArchive?: (rows: DTRow[]) => void;
  onExport?: (rows: DTRow[], csv: string) => void;
  onRowOpen?: (row: DTRow | null) => void;
  onChange?: (rows: DTRow[]) => void;
  theme?: "light" | "dark";
  loadFont?: boolean;
  background?: string;
  backdrop?: boolean;
  autoplay?: boolean;
  className?: string;
  style?: CSSProperties;
};

const LABELS = {
  search: "Search customers", filter: "Filter", columns: "Columns", export: "Export", rows: "Rows", selected: "selected",
  archive: "Archive", delete: "Delete", undo: "Undo", emptyTitle: "No customers match", emptyText: "Try fewer words or clear the filters.",
  clear: "Clear search and filters", notes: "Notes", trend: "MRR, last 12 months", account: "Account",
};
const STATUS_COLORS: Record<string, string> = { Active: "#22a861", Trial: "#3d50e8", "Past due": "#e0892b", Churned: "#a3a29c" };
const AV = ["#6d5dfc", "#e0612b", "#1e9e8a", "#d6457a", "#3d7be0", "#b0782b", "#5a6b7a", "#8a4fd1"];

// ---------------- the sample: forty customers of a small SaaS (all made up) ----------------
const PLANS = ["Free", "Starter", "Pro", "Team"], PRICE: Record<string, number> = { Free: 0, Starter: 19, Pro: 49, Team: 99 };
const OWNERS = ["Alex Kim", "Sam Ortiz", "Jo Park"];
const SAMPLE_COLUMNS: DTColumn[] = [
  { key: "name", label: "Customer", type: "person", subKey: "email", width: 240, editable: true },
  { key: "company", label: "Company", type: "text", width: 150, editable: true },
  { key: "plan", label: "Plan", type: "select", options: PLANS, width: 110, editable: true },
  { key: "mrr", label: "MRR", type: "money", width: 110, editable: true },
  { key: "status", label: "Status", type: "status", options: Object.keys(STATUS_COLORS), width: 130, editable: true },
  { key: "seats", label: "Seats", type: "number", width: 80, editable: true },
  { key: "last", label: "Last active", type: "ago", width: 130 },
  { key: "owner", label: "Owner", type: "select", options: OWNERS, width: 140, editable: true },
  { key: "created", label: "Customer since", type: "date", width: 140, hidden: true },
];
function sample(): DTRow[] {
  const FIRST = ["Maya", "Arjun", "Lena", "Theo", "Priya", "Noah", "Ines", "Kenji", "Sara", "Omar", "Clara", "Ravi", "Elif", "Jonas", "Aisha", "Leo", "Mira", "Dev", "Nora", "Felix"];
  const LAST = ["Rao", "Mehta", "Fischer", "Okafor", "Lindqvist", "Haddad", "Moreau", "Sato", "Novak", "Kapoor", "Silva", "Brandt", "Yilmaz", "Costa", "Nair", "Weber"];
  const CO = ["Northwind", "Lumen Labs", "Paperline", "Orbitly", "Fernway", "Quartz & Co", "Tidewater", "Helio", "Brightpath", "Mosaic", "Kitepoint", "Riverstone", "Cobalt", "Saltbox"];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]!;
  const now = Date.UTC(2026, 9, 30, 12);
  return Array.from({ length: 40 }, (_, i) => {
    const f = FIRST[i % FIRST.length]!, l = pick(LAST), plan = pick(["Free", "Starter", "Starter", "Pro", "Pro", "Pro", "Team", "Team"]);
    const seats = plan === "Team" ? 5 + Math.floor(rnd() * 30) : plan === "Free" ? 1 : 1 + Math.floor(rnd() * 4);
    const status = plan === "Free" ? pick(["Active", "Active", "Churned"]) : pick(["Active", "Active", "Active", "Trial", "Past due", "Churned"]);
    const co = pick(CO), mrr = status === "Churned" ? 0 : PRICE[plan]! * (plan === "Team" ? seats : 1);
    let v = Math.max(8, mrr * (0.4 + rnd() * 0.4));
    const trend = Array.from({ length: 12 }, (_, k) => (v = Math.max(0, v * (1 + (rnd() - 0.35) * 0.25)), k === 11 ? mrr : Math.round(v)));
    return {
      id: i + 1, name: `${f} ${l}`, email: `${f.toLowerCase()}@${co.toLowerCase().replace(/[^a-z]/g, "")}.com`, company: co, plan, status, seats, mrr,
      last: now - rnd() * 40 * 864e5, owner: pick(OWNERS), created: now - (40 + rnd() * 500) * 864e5, trend, notes: "",
    };
  });
}

const fmtDate = (t: number) => new Date(t).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
function ago(t: number, now: number) {
  const s = (now - t) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? "Yesterday" : d < 30 ? `${d} days ago` : fmtDate(t);
}
const money = (n: number) => (n ? "₹" + Number(n).toLocaleString("en-IN") : "—");
const initials = (n: string) => String(n || "").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const colorOf = (s: string) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return AV[Math.abs(h) % AV.length]; };
const textOf = (row: DTRow, c: DTColumn, now: number) => {
  const v = row[c.key];
  if (c.type === "person") return `${v ?? ""} ${c.subKey ? row[c.subKey] ?? "" : ""}`;
  if (c.type === "money") return String(v ?? "");
  if (c.type === "date") return v ? fmtDate(v) : "";
  if (c.type === "ago") return v ? ago(v, now) : "";
  return String(v ?? "");
};
const isNum = (c: DTColumn) => c.type === "number" || c.type === "money";

// ---------------- the styles (scoped under .dtb) ----------------
// Colours read the app's theme tokens, so light/dark follow the app's [data-theme] switch on <html>.
const CSS = `/* kit-shield: undo Tailwind preflight inside the component (Kit) */
:where(.dtb) { line-height: normal; color: CanvasText; tab-size: 8; font-feature-settings: normal; font-variation-settings: normal; -webkit-text-size-adjust: auto; -webkit-tap-highlight-color: initial; }
:where(.dtb) :where(*), :where(.dtb) :where(*)::before, :where(.dtb) :where(*)::after { box-sizing: revert; margin: revert; padding: revert; border-width: revert; border-style: revert; border-color: revert; outline-color: revert; }
:where(.dtb) :where(h1, h2, h3, h4, h5, h6) { font-size: revert; font-weight: revert; }
:where(.dtb) :where(img, svg, video, canvas) { display: revert; vertical-align: revert; }
:where(.dtb) :where(button, input, select, textarea) { font: revert; letter-spacing: revert; color: revert; border-radius: revert; background-color: revert; opacity: revert; }
:where(.dtb) :where(button) { appearance: revert; }
:where(.dtb) :where(table) { text-indent: revert; border-color: revert; border-collapse: revert; }
:where(.dtb) ::placeholder { color: revert; opacity: revert; }
.dtb { --card: var(--surface, #ffffff); --ink: var(--text, #17181a); --sub: var(--text-muted, #6f6e69); --mute: var(--text-faint, #a3a29c); --line: var(--border-subtle, #efefec); --line2: var(--border, #e3e2dd); --hover: var(--surface-2, #fafaf8); --chip: var(--surface-2, #f4f4f2); --sel: color-mix(in srgb, var(--accent, #3d50e8) 9%, var(--card)); --mark: #fff1a8;
  position: relative; font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: var(--ink); -webkit-font-smoothing: antialiased; width: 100%; box-sizing: border-box; }
.dtb.dark { --mark: #5a4a10; --sel: color-mix(in srgb, var(--accent, #7d8cff) 16%, var(--card)); }
.dtb.bd { min-height: 100vh; padding: 40px 16px 120px; display: flex; justify-content: center; align-items: flex-start; }
.dtb *, .dtb *::before, .dtb *::after { box-sizing: border-box; }
:where(.dtb) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; }
.dtb :focus-visible { outline: 1.5px solid var(--accent); outline-offset: 2px; }
.dtb-card { position: relative; width: 100%; background: var(--card); border: 1px solid var(--line2); border-radius: 20px; padding-top: 22px; }
.dtb.bd .dtb-card { max-width: 1120px; }
.dtb-hd { display: flex; align-items: baseline; gap: 10px; padding: 0 24px; }
.dtb-hd h2 { margin: 0; font: 500 22px/1.2 Inter, sans-serif; letter-spacing: -.03em; }
.dtb-count { color: var(--mute); font-size: 13px; font-variant-numeric: tabular-nums; }
.dtb-tools { display: flex; align-items: center; gap: 8px; padding: 16px 24px 14px; flex-wrap: wrap; }
.dtb-search { position: relative; flex: 0 1 260px; min-width: 180px; display: block; margin: 0; }
.dtb-search input { width: 100%; height: 34px; border-radius: 10px; border: 1px solid var(--line2); background: var(--card); color: var(--ink); padding: 0 30px 0 32px; margin: 0; font: 400 13px Inter, sans-serif; outline: none; transition: border-color .15s; }
.dtb-search input:focus { border-color: var(--ink); }
.dtb-search > svg { position: absolute; left: 11px; top: 10px; color: var(--mute); }
.dtb-search kbd { position: absolute; right: 8px; top: 8px; font: 500 10.5px Inter, sans-serif; color: var(--mute); border: 1px solid var(--line2); border-radius: 5px; padding: 1px 5px; }
.dtb-tb { height: 34px; padding: 0 11px; border-radius: 10px; border: 1px solid var(--line2) !important; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--sub) !important; transition: background .15s, color .15s; white-space: nowrap; }
.dtb-tb:hover { background: var(--hover) !important; color: var(--ink) !important; }
.dtb-tb.on { color: var(--ink) !important; border-color: var(--ink) !important; }
.dtb-tb b { font-weight: 500; color: var(--ink); }
.dtb-tb.pri { background: var(--accent) !important; border-color: var(--accent) !important; color: var(--on-accent, #fff) !important; font-weight: 500; }
.dtb-tb.pri:hover { filter: brightness(1.08); }
.dtb-tb.sm { height: 30px; font-size: 12.5px; }
.dtb.no-hd .dtb-card { padding-top: 6px; }
.dtb-cnt { color: var(--mute); font-size: 12.5px; font-variant-numeric: tabular-nums; }
.dtb-facts { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 32px; padding: 14px 24px 16px 64px; animation: dtbOpen .35s cubic-bezier(.22,1,.36,1); }
.dtb-facts dl { display: flex; flex-direction: column; gap: 3px; margin: 0; font-size: 12.5px; }
.dtb-facts dt { color: var(--mute); font-size: 11.5px; }
.dtb-facts dd { margin: 0; color: var(--ink); font-weight: 500; }
.dtb-facts .acts { display: flex; gap: 8px; }
.dtb-x { margin-left: 2px; color: var(--mute); display: grid; place-items: center; width: 16px; height: 16px; border-radius: 4px; }
.dtb-x:hover { background: var(--chip); color: var(--ink); }
.dtb-grow { flex: 1; }
.dtb-seg { display: inline-flex; padding: 3px; border-radius: 10px; background: var(--chip); }
.dtb-seg button { height: 28px; width: 30px; border-radius: 7px; display: grid; place-items: center; color: var(--mute); }
.dtb-seg button.on { background: var(--card); color: var(--ink); box-shadow: inset 0 0 0 1px var(--line2); }
.dtb-scroll { position: relative; overflow-x: auto; scrollbar-width: none; border-top: 1px solid var(--line); outline: none; }
.dtb-scroll::-webkit-scrollbar { display: none; }
.dtb-scroll:focus-visible { outline: none; }
.dtb tbody { user-select: none; -webkit-user-select: none; }
.dtb tbody :where(input, textarea) { user-select: text; -webkit-user-select: text; }
.dtb table { border-collapse: separate; border-spacing: 0; table-layout: fixed; min-width: 100%; font-size: 13px; margin: 0; }
.dtb th, .dtb td { padding: 0 14px; height: var(--rh, 52px); border-bottom: 1px solid var(--line); text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; background: var(--card); transition: background .12s; }
.dtb.compact { --rh: 38px; }
.dtb th { height: 40px; font-weight: 500; color: var(--sub); font-size: 12.5px; position: relative; user-select: none; cursor: grab; }
.dtb th.num, .dtb td.num { text-align: right; font-variant-numeric: tabular-nums; }
.dtb-lbl { display: inline-flex; align-items: center; gap: 5px; }
.dtb-ar { width: 10px; height: 10px; opacity: 0; transition: opacity .15s, transform .2s; color: var(--ink); }
.dtb th:hover .dtb-ar { opacity: .35; }
.dtb th.sorted { color: var(--ink); } .dtb th.sorted .dtb-ar { opacity: 1; }
.dtb th.desc .dtb-ar { transform: rotate(180deg); }
.dtb-pri { font-size: 9.5px; color: var(--mute); margin-left: -2px; }
.dtb th.drag-from { opacity: .35; }
.dtb-rz { position: absolute; right: 0; top: 8px; bottom: 8px; width: 9px; cursor: col-resize; display: grid; place-items: center; }
.dtb-rz::after { content: ''; width: 1px; height: 100%; background: var(--line2); transition: background .15s, width .15s; }
.dtb-rz:hover::after, .dtb-rz.on::after { background: var(--accent); width: 2px; }
.dtb-drop { position: absolute; top: 0; width: 2px; background: var(--accent); z-index: 6; pointer-events: none; border-radius: 2px; }
.dtb .pin { position: sticky; z-index: 2; }
.dtb .p0 { left: 0; } .dtb .p1 { left: 44px; }
.dtb .p1::after { content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 1px; background: var(--line); opacity: 0; transition: opacity .2s; }
.dtb-scroll.scrolled .p1::after { opacity: 1; }
.dtb .cb { width: 44px; padding: 0 0 0 20px; cursor: default; }
.dtb tbody tr { cursor: pointer; }
.dtb tbody tr:hover td { background: var(--hover); }
.dtb tbody tr.sel td { background: var(--sel); }
.dtb tbody tr.gone td { opacity: 0; transition: opacity .25s; }
.dtb td.f { box-shadow: inset 0 0 0 1.5px var(--accent); border-radius: 4px; }
.dtb mark { background: var(--mark); color: inherit; border-radius: 3px; padding: 0 1px; }
.dtb-ck { width: 16px; height: 16px; border-radius: 5px; border: 1.5px solid var(--line2); display: grid; place-items: center; transition: background .15s, border-color .15s; background: var(--card); flex: none; }
.dtb-ck svg { opacity: 0; transform: scale(.6); transition: opacity .15s, transform .2s cubic-bezier(.3,1.6,.5,1); }
.dtb-ck.on, .dtb-ck.half { background: var(--ink); border-color: var(--ink); }
.dtb-ck.on svg { opacity: 1; transform: none; }
.dtb-ck.half::after { content: ''; width: 8px; height: 1.6px; border-radius: 1px; background: var(--card); }
.dtb-who { display: flex; align-items: center; gap: 10px; min-width: 0; }
.dtb-av { flex: none; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font: 600 10px Inter, sans-serif; color: #fff; }
.dtb-who > span:last-child { min-width: 0; display: grid; }
.dtb-nm { font-weight: 500; overflow: hidden; text-overflow: ellipsis; }
.dtb-em { color: var(--mute); font-size: 12px; overflow: hidden; text-overflow: ellipsis; }
.dtb.compact .dtb-em { display: none; }
.dtb.compact .dtb-av { width: 22px; height: 22px; font-size: 9px; }
.dtb-st { display: inline-flex; align-items: center; gap: 7px; }
.dtb-st i { width: 6px; height: 6px; border-radius: 50%; flex: none; }
.dtb-sub { color: var(--sub); }
.dtb-own { display: inline-flex; align-items: center; gap: 7px; color: var(--sub); }
.dtb-own .dtb-av { width: 20px; height: 20px; font-size: 8.5px; }
.dtb-edit { width: 100%; height: 30px; border-radius: 7px; border: 1.5px solid var(--accent); background: var(--card); color: var(--ink); padding: 0 8px; margin: 0; font: inherit; outline: none; }
.dtb td.num .dtb-edit { text-align: right; }
.dtb tr.det td { height: auto; padding: 0; white-space: normal; background: var(--hover) !important; cursor: default; }
.dtb-det { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 28px; padding: 18px 24px 22px 78px; animation: dtbOpen .35s cubic-bezier(.22,1,.36,1); }
@keyframes dtbOpen { from { opacity: 0; transform: translateY(-6px); } }
.dtb-det h4 { margin: 0 0 8px; font: 500 11.5px Inter, sans-serif; color: var(--mute); }
.dtb-big { font: 500 20px Inter, sans-serif; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.dtb-delta { font-size: 12px; margin-left: 6px; }
.dtb-det dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; font-size: 12.5px; }
.dtb-det dt { color: var(--mute); } .dtb-det dd { margin: 0; }
.dtb-det textarea { width: 100%; height: 72px; resize: none; border-radius: 10px; border: 1px solid var(--line2); background: var(--card); color: var(--ink); padding: 9px 10px; margin: 0; font: 400 12.5px/1.45 Inter, sans-serif; outline: none; }
.dtb-det textarea:focus { border-color: var(--ink); }
.dtb-sk td div { height: 10px; border-radius: 5px; background: linear-gradient(90deg, var(--chip) 30%, var(--line) 50%, var(--chip) 70%) 0 0 / 300% 100%; animation: dtbSk 1.3s linear infinite; }
@keyframes dtbSk { from { background-position: 100% 0; } to { background-position: -50% 0; } }
.dtb-empty { padding: 64px 24px 72px; text-align: center; }
.dtb-empty h3 { margin: 14px 0 6px; font: 500 16px Inter, sans-serif; letter-spacing: -.01em; }
.dtb-empty p { margin: 0 0 18px; color: var(--sub); font-size: 13px; }
.dtb-ft { display: flex; align-items: center; gap: 14px; padding: 12px 24px 16px; font-size: 12.5px; color: var(--sub); font-variant-numeric: tabular-nums; }
.dtb-keys { display: flex; gap: 14px; color: var(--mute); font-size: 11.5px; }
.dtb-keys kbd { font: 500 10.5px Inter, sans-serif; border: 1px solid var(--line2); border-radius: 5px; padding: 0 4px; margin-right: 4px; }
.dtb-pg { display: inline-flex; gap: 4px; }
.dtb-pg button { min-width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; color: var(--sub); padding: 0 6px; }
.dtb-pg button:hover:not(:disabled) { background: var(--chip); color: var(--ink); }
.dtb-pg button.on { background: var(--chip); color: var(--ink); font-weight: 500; }
.dtb-pg button:disabled { opacity: .35; cursor: default; }
.dtb-pop { position: absolute; z-index: 50; min-width: 180px; padding: 5px; border-radius: 12px; background: var(--card); border: 1px solid var(--line2); animation: dtbPop .18s cubic-bezier(.22,1,.36,1); }
@keyframes dtbPop { from { opacity: 0; transform: translateY(-4px) scale(.98); } }
.dtb-it { display: flex; align-items: center; gap: 9px; height: 32px; padding: 0 9px; border-radius: 8px; font-size: 13px; width: 100%; text-align: left; }
.dtb-it:hover { background: var(--chip); }
.dtb-it:disabled { opacity: .5; cursor: default; }
.dtb-it .n { margin-left: auto; color: var(--mute); font-size: 12px; font-variant-numeric: tabular-nums; }
.dtb-sep { height: 1px; background: var(--line); margin: 4px 2px; }
.dtb-ttl { font-size: 11.5px; color: var(--mute); padding: 6px 9px 4px; }
.dtb-bulk { position: absolute; left: 50%; bottom: 24px; z-index: 40; display: flex; align-items: center; gap: 4px; padding: 6px 6px 6px 14px; border-radius: 14px; background: var(--ink); color: var(--card); font-size: 13px; transform: translate(-50%, 90px); opacity: 0; pointer-events: none; transition: transform .35s cubic-bezier(.22,1,.36,1), opacity .2s; white-space: nowrap; }
.dtb-bulk.on { transform: translate(-50%, 0); opacity: 1; pointer-events: auto; }
.dtb-bulk .n { font-variant-numeric: tabular-nums; margin-right: 8px; }
.dtb-bulk button, .dtb-bulk select { height: 30px; padding: 0 11px; border-radius: 9px; color: inherit; opacity: .8; background: transparent; border: 0; font: inherit; }
.dtb-bulk select option { color: var(--ink); background: var(--card); }
.dtb-bulk button:hover, .dtb-bulk select:hover { background: rgba(127,127,127,.22); opacity: 1; }
.dtb-bulk .danger { color: #ff8a8a; }
.dtb-toast { position: absolute; left: 50%; bottom: 76px; z-index: 45; display: flex; align-items: center; gap: 12px; padding: 9px 10px 9px 14px; border-radius: 12px; background: var(--ink); color: var(--card); font-size: 12.5px; transform: translate(-50%, 10px); opacity: 0; transition: all .25s cubic-bezier(.22,1,.36,1); pointer-events: none; white-space: nowrap; }
.dtb-toast.on { transform: translate(-50%, 0); opacity: 1; pointer-events: auto; }
.dtb-toast button { height: 26px; padding: 0 10px; border-radius: 8px; background: rgba(127,127,127,.25); color: inherit; font-weight: 500; }
.dtb-toast.plain { padding: 9px 14px; }
.dtb-cur { position: absolute; left: 0; top: 0; z-index: 90; pointer-events: none; transition: opacity .25s; will-change: transform; }
.dtb-cur svg { display: block; transition: transform .12s; transform-origin: 4px 3px; }
.dtb-cur.down svg { transform: scale(.84); }
.dtb-ring { position: absolute; z-index: 89; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%; border: 2px solid #3b6cf6; pointer-events: none; animation: dtbRing .5s ease-out forwards; }
@keyframes dtbRing { from { opacity: .8; transform: scale(.3); } to { opacity: 0; transform: scale(1.4); } }
@media (max-width: 700px) { .dtb-keys { display: none; } .dtb-det { grid-template-columns: 1fr; padding-left: 24px; } .dtb-tools { padding: 14px 16px; } .dtb-hd { padding: 0 16px; } .dtb-ft { padding: 12px 16px; flex-wrap: wrap; } .dtb.bd { padding: 16px 8px 100px; } }
`;

const CK = <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 5.2l2 2 4-4.4" fill="none" stroke="var(--card)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const Arrow = () => <svg className="dtb-ar" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 8V2M2.5 4.5L5 2l2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
type Pop = { kind: "filterBy" | "filter" | "columns" | "per" | "pick"; rect: DOMRect; key?: string; rowId?: string | number; align?: "left" | "right" } | null;
type Edit = { id: string | number; key: string; value: string } | null;

export default function DataTable({
  title = "Customers", rows: rowsProp, columns: columnsProp, pageSize = 10, pageSizes = [10, 20, 40], density: densityProp = "comfortable",
  defaultSort = [{ key: "mrr", dir: -1 }], statusColors = STATUS_COLORS, detail, loading = false, labels, bulkActions, toolbarEnd, hideTitle = false,
  onEdit, onSort, onSelect, onDelete, onArchive, onExport, onRowOpen, onChange,
  theme = "light", loadFont = true, background, backdrop = true, autoplay = false, className, style,
}: DataTableProps) {
  const L = { ...LABELS, ...labels };
  const COLS = useMemo(() => columnsProp ?? SAMPLE_COLUMNS, [columnsProp]);
  const byKey = useMemo(() => Object.fromEntries(COLS.map((c) => [c.key, c])) as Record<string, DTColumn>, [COLS]);
  const firstKey = COLS[0]?.key ?? "";
  const [rows, setRowsState] = useState<DTRow[]>(() => rowsProp ?? sample());
  useEffect(() => { if (rowsProp) setRowsState(rowsProp); }, [rowsProp]);
  const setRows = (next: DTRow[]) => { setRowsState(next); onChange?.(next); };
  const now = useMemo(() => Date.now(), []);
  const NOW = rowsProp ? now : Date.UTC(2026, 9, 30, 12);

  const [order, setOrder] = useState(() => COLS.map((c) => c.key));
  const [hidden, setHidden] = useState(() => new Set(COLS.filter((c) => c.hidden).map((c) => c.key)));
  const [widths, setWidths] = useState<Record<string, number>>(() => Object.fromEntries(COLS.map((c) => [c.key, c.width ?? 140])));
  const [sort, setSortState] = useState<Sort[]>(defaultSort);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, Set<string>>>({});
  const [selected, setSelectedState] = useState<Set<string | number>>(new Set());
  const [page, setPage] = useState(0);
  const [per, setPer] = useState(pageSize);
  const [density, setDensity] = useState(densityProp);
  const [open, setOpen] = useState<string | number | null>(null);
  const [editing, setEditing] = useState<Edit>(null);
  const [focus, setFocus] = useState<{ r: number; c: number } | null>(null);
  const [pop, setPop] = useState<Pop>(null);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const [goneIds, setGoneIds] = useState<Set<string | number>>(new Set());
  const [scrolled, setScrolled] = useState(false);
  const [drop, setDrop] = useState<{ x: number; h: number } | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const anchor = useRef<string | number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null), scrollRef = useRef<HTMLDivElement>(null), tbodyRef = useRef<HTMLTableSectionElement>(null), searchRef = useRef<HTMLInputElement>(null);
  const flipFrom = useRef<Record<string, number> | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragMoved = useRef(false);

  const setSelected = (s: Set<string | number>) => { setSelectedState(s); onSelect?.([...s]); };
  const cols = order.filter((k) => !hidden.has(k) && byKey[k]);
  const filterable = COLS.filter((c) => c.filter ?? (c.type === "select" || c.type === "status"));
  const optionsOf = (c: DTColumn) => c.options ?? [...new Set(rows.map((r) => String(r[c.key])))];

  const view = useMemo(() => {
    const q = query.trim().toLowerCase();
    let v = rows.filter((r) => Object.entries(filters).every(([k, set]) => !set.size || set.has(String(r[k]))));
    if (q) v = v.filter((r) => cols.some((k) => textOf(r, byKey[k]!, NOW).toLowerCase().includes(q)));
    const val = (r: DTRow, k: string) => { const c = byKey[k], x = r[k]; return c?.type === "select" || c?.type === "status" ? (c.options?.indexOf(x) ?? 0) : c?.type === "ago" ? -x : typeof x === "string" ? x.toLowerCase() : x; };
    return [...v].sort((a, b) => { for (const s of sort) { const x = val(a, s.key), y = val(b, s.key); if (x < y) return -s.dir; if (x > y) return s.dir; } return String(a.id).localeCompare(String(b.id), undefined, { numeric: true }); });
  }, [rows, filters, query, sort, cols.join(), byKey, NOW]);
  const pages = Math.max(1, Math.ceil(view.length / per));
  const pg = Math.min(page, pages - 1);
  const shown = view.slice(pg * per, pg * per + per);

  // rows glide to their new places after a sort (FLIP)
  const snap = () => { const m: Record<string, number> = {}; tbodyRef.current?.querySelectorAll<HTMLTableRowElement>("tr[data-id]").forEach((tr) => { m[tr.dataset.id!] = tr.getBoundingClientRect().top; }); flipFrom.current = m; };
  useLayoutEffect(() => {
    const before = flipFrom.current; flipFrom.current = null;
    if (!before) return;
    tbodyRef.current?.querySelectorAll<HTMLTableRowElement>("tr[data-id]").forEach((tr) => {
      const b0 = before[tr.dataset.id!];
      if (b0 == null) { tr.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 220 }); return; }
      const d = b0 - tr.getBoundingClientRect().top;
      if (Math.abs(d) > 1) tr.animate?.([{ transform: `translateY(${d}px)` }, { transform: "none" }], { duration: 380, easing: "cubic-bezier(.22,1,.36,1)" });
    });
  });

  const say = (text: string, undo?: () => void) => { setToast({ text, undo }); if (toastT.current) clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), undo ? 5000 : 1800); };
  const setSort = (s: Sort[]) => { snap(); setSortState(s); onSort?.(s); };
  const clickHeading = (k: string, shift: boolean) => {
    const c = byKey[k]!, first: 1 | -1 = isNum(c) ? -1 : 1, i = sort.findIndex((s) => s.key === k);
    if (shift) { const n = [...sort]; if (i >= 0) n[i] = { key: k, dir: (n[i]!.dir * -1) as 1 | -1 }; else n.push({ key: k, dir: first }); setSort(n); return; }
    if (i >= 0 && sort.length === 1) setSort(sort[0]!.dir === first ? [{ key: k, dir: (-first) as 1 | -1 }] : defaultSort);
    else setSort([{ key: k, dir: first }]);
  };
  const toggleSel = (id: string | number, range: boolean) => {
    const ids = shown.map((r) => r.id), s = new Set(selected);
    if (range && anchor.current != null && ids.includes(anchor.current)) {
      const [a, b] = [ids.indexOf(anchor.current), ids.indexOf(id)].sort((x, y) => x - y) as [number, number], on = !s.has(id);
      ids.slice(a, b + 1).forEach((x) => (on ? s.add(x) : s.delete(x)));
    } else { if (s.has(id)) s.delete(id); else s.add(id); anchor.current = id; }
    setSelected(s);
  };
  const toggleAll = () => { const s = new Set(selected), all = shown.length > 0 && shown.every((r) => s.has(r.id)); shown.forEach((r) => (all ? s.delete(r.id) : s.add(r.id))); setSelected(s); };
  const openRow = (id: string | number) => { const next = open === id ? null : id; setOpen(next); onRowOpen?.(next == null ? null : rows.find((r) => r.id === next) ?? null); };
  const update = (id: string | number, key: string, value: unknown) => {
    const next = rows.map((r) => {
      if (r.id !== id) return r;
      const n = { ...r, [key]: value };
      // the sample keeps MRR in step with plan, status and seats
      if (!rowsProp && (key === "plan" || key === "status" || key === "seats")) n.mrr = n.status === "Churned" ? 0 : PRICE[n.plan]! * (n.plan === "Team" ? n.seats : 1);
      return n;
    });
    setRows(next); const row = next.find((r) => r.id === id)!; onEdit?.(row, key, value);
    requestAnimationFrame(() => tbodyRef.current?.querySelector(`tr[data-id="${id}"] td[data-k="${key}"]`)?.animate?.([{ background: "var(--sel)" }, { background: "transparent" }], { duration: 900 }));
  };
  const startEdit = (id: string | number, key: string, rect?: DOMRect) => {
    const c = byKey[key]; if (!c?.editable) return;
    if (c.type === "select" || c.type === "status") { if (rect) setPop({ kind: "pick", rect, key, rowId: id }); return; }
    const r = rows.find((x) => x.id === id); if (!r) return;
    setEditing({ id, key, value: String(r[key] ?? "") });
  };
  const commit = (save: boolean) => {
    if (!editing) return; const { id, key, value } = editing, c = byKey[key]!;
    setEditing(null);
    if (!save) return;
    let v: unknown = value.trim();
    if (isNum(c)) v = Math.max(0, Math.round(Number(String(v).replace(/[^0-9.]/g, "")) || 0));
    else if (!v && c.type === "person") return;
    update(id, key, v);
  };
  const csvOf = (list: DTRow[]) => {
    const head = cols.map((k) => byKey[k]!.label), cell = (r: DTRow, k: string) => { const c = byKey[k]!, v = r[k]; return c.type === "date" || c.type === "ago" ? (v ? new Date(v).toISOString().slice(0, 10) : "") : v ?? ""; };
    return [head, ...list.map((r) => cols.map((k) => cell(r, k)))].map((line) => line.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
  };
  const exportRows = (list: DTRow[]) => {
    const csv = csvOf(list);
    if (onExport) onExport(list, csv);
    else { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "rows"}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
    say(`Exported ${list.length} ${list.length === 1 ? "row" : "rows"}`);
  };
  const removeSelected = (verb: "Deleted" | "Archived") => {
    const ids = new Set(selected), gone = rows.filter((r) => ids.has(r.id)), keep = rows;
    setGoneIds(ids);
    setTimeout(() => { snap(); setGoneIds(new Set()); setRows(keep.filter((r) => !ids.has(r.id))); setSelected(new Set()); }, 220);
    let undone = false;
    say(`${verb} ${gone.length} ${gone.length === 1 ? "row" : "rows"}`, () => { undone = true; snap(); setRows(keep); setToast(null); });
    setTimeout(() => { if (!undone) (verb === "Deleted" ? onDelete : onArchive)?.(gone); }, 5100);
  };

  // the popover closes on a press anywhere else, or Esc
  useEffect(() => {
    if (!pop) return;
    const off = (e: PointerEvent) => { const t = e.target as HTMLElement; if (!t.closest?.(".dtb-pop") && !t.closest?.("[data-popper]")) setPop(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setPop(null); };
    document.addEventListener("pointerdown", off, true); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", off, true); document.removeEventListener("keydown", esc); };
  }, [pop]);
  // "/" jumps to the search
  useEffect(() => {
    const k = (e: KeyboardEvent) => { const t = document.activeElement as HTMLElement | null; if (e.key === "/" && t?.tagName !== "INPUT" && t?.tagName !== "TEXTAREA" && rootRef.current?.offsetParent !== null) { e.preventDefault(); searchRef.current?.focus(); } };
    document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k);
  }, []);

  // column resize (its edge) and reorder (drag the heading)
  const onHeadDown = (e: RPointerEvent, k: string) => {
    const t = e.target as HTMLElement;
    if (t.closest(".dtb-rz")) {
      e.preventDefault(); const x0 = e.clientX, w0 = widths[k]!; const rz = t.closest(".dtb-rz")!; rz.classList.add("on");
      const mv = (ev: PointerEvent) => setWidths((w) => ({ ...w, [k]: Math.max(70, Math.min(420, w0 + ev.clientX - x0)) }));
      const up = () => { rz.classList.remove("on"); removeEventListener("pointermove", mv); removeEventListener("pointerup", up); };
      addEventListener("pointermove", mv); addEventListener("pointerup", up); return;
    }
    if (k === firstKey || t.closest(".dtb-ck")) return;
    const x0 = e.clientX; dragMoved.current = false; let to: { k: string; after: boolean } | null = null;
    const mv = (ev: PointerEvent) => {
      if (!dragMoved.current && Math.abs(ev.clientX - x0) < 6) return;
      if (!dragMoved.current) { dragMoved.current = true; setDragKey(k); }
      const sc = scrollRef.current!, sr = sc.getBoundingClientRect();
      let best: { d: number; px: number; k: string; after: boolean } | null = null;
      sc.querySelectorAll<HTMLElement>("th[data-k]").forEach((th) => {
        if (th.dataset.k === firstKey) return; const r = th.getBoundingClientRect();
        for (const [px, after] of [[r.left, false], [r.right, true]] as [number, boolean][]) { const d = Math.abs(ev.clientX - px); if (!best || d < best.d) best = { d, px, k: th.dataset.k!, after }; }
      });
      if (best) { const b = best as { px: number; k: string; after: boolean }; to = { k: b.k, after: b.after }; setDrop({ x: b.px - sr.left + sc.scrollLeft - 1, h: sc.querySelector("table")!.offsetHeight }); }
    };
    const up = () => {
      removeEventListener("pointermove", mv); removeEventListener("pointerup", up); setDrop(null); setDragKey(null);
      const target = to as { k: string; after: boolean } | null;
      if (dragMoved.current && target && target.k !== k) { const o = order.filter((x) => x !== k); o.splice(o.indexOf(target.k) + (target.after ? 1 : 0), 0, k); setOrder(o); }
      setTimeout(() => { dragMoved.current = false; }, 0);
    };
    addEventListener("pointermove", mv); addEventListener("pointerup", up);
  };

  // keyboard: arrows move between cells, Enter edits, Space ticks, Esc lets go
  const onKey = (e: RKeyboardEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;
    const mv = ({ ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] } as Record<string, [number, number]>)[e.key];
    if (!focus) { if (mv) { e.preventDefault(); setFocus({ r: 0, c: 0 }); } return; }
    if (mv) { e.preventDefault(); setFocus({ r: Math.max(0, Math.min(shown.length - 1, focus.r + mv[0])), c: Math.max(0, Math.min(cols.length - 1, focus.c + mv[1])) }); }
    else if (e.key === "Enter") { e.preventDefault(); const r = shown[focus.r]; const td = scrollRef.current?.querySelector("td.f") as HTMLElement | null; if (r) startEdit(r.id, cols[focus.c]!, td?.getBoundingClientRect()); }
    else if (e.key === " ") { e.preventDefault(); const r = shown[focus.r]; if (r) toggleSel(r.id, e.shiftKey); }
    else if (e.key === "Escape") setFocus(null);
  };
  useEffect(() => { scrollRef.current?.querySelector("td.f")?.scrollIntoView?.({ block: "nearest", inline: "nearest" }); }, [focus]);

  // ---------------- autoplay (demo only): the blue pointer walks through every feature ----------------
  const curRef = useRef<HTMLDivElement>(null);
  const [rings, setRings] = useState<{ id: number; x: number; y: number }[]>([]);
  const api = useRef({ clickHeading, setQuery, setPop, setFilters, startEdit, setEditing, commit, toggleSel, removeSelected, openRow, setDensity, setPage, say });
  api.current = { clickHeading, setQuery, setPop, setFilters, startEdit, setEditing, commit, toggleSel, removeSelected, openRow, setDensity, setPage, say };
  const [touring, setTouring] = useState(false);
  useEffect(() => {
    if (!autoplay) return;
    let alive = true, cx = 0, cy = 0;
    const root = rootRef.current!, cur = curRef.current!;
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const stop = (e: PointerEvent) => { if (e.isTrusted) { alive = false; setTouring(false); } };
    root.addEventListener("pointerdown", stop, true);
    const rel = (el: Element | null) => { if (!el) return null; const r = el.getBoundingClientRect(), o = root.getBoundingClientRect(); return { x: r.left - o.left + r.width / 2, y: r.top - o.top + r.height / 2, rect: r }; };
    const place = () => { cur.style.transform = `translate(${cx - 4}px, ${cy - 3}px)`; };
    const glide = (x: number, y: number, ms = 560) => new Promise<void>((res) => {
      const sx = cx, sy = cy, t0 = performance.now();
      const f = (n: number) => { if (!alive) return res(); const p = Math.min(1, (n - t0) / ms), e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; cx = sx + (x - sx) * e; cy = sy + (y - sy) * e; place(); if (p < 1) requestAnimationFrame(f); else res(); };
      requestAnimationFrame(f);
    });
    const press = async () => { cur.classList.add("down"); setRings((r) => [...r.slice(-3), { id: Math.random(), x: cx, y: cy }]); await wait(120); cur.classList.remove("down"); await wait(60); };
    const to = async (sel: string | (() => Element | null), ms?: number) => { const el = typeof sel === "string" ? root.querySelector(sel) : sel(); const p = rel(el); if (!p || !alive) return null; await glide(p.x, p.y, ms); return p; };
    const A = () => api.current;
    const run = async () => {
      setTouring(true);
      const o = root.getBoundingClientRect(); cx = o.width * 0.7; cy = 160; place();
      while (alive) {
        await wait(900);
        if (!await to(`th[data-k="${firstKey}"]`)) return; await press(); A().clickHeading(firstKey, false); await wait(1300);
        if (!alive) return; await press(); A().clickHeading(firstKey, false); await wait(1300);
        if (!await to(".dtb-search input")) return; await press();
        for (const ch of "lu") { if (!alive) return; A().setQuery((q: string) => q + ch); await wait(220); }
        await wait(1500); if (!alive) return; A().setQuery(""); await wait(500);
        const fb = await to("[data-filterby]"); if (!fb) return; await press(); A().setPop({ kind: "filterBy", rect: fb.rect }); await wait(600);
        if (!await to('[data-fk="plan"]', 380)) return; await press(); A().setPop({ kind: "filter", rect: fb.rect, key: "plan" }); await wait(500);
        if (!await to('[data-fv="Pro"]', 380)) return; await press(); A().setFilters((f: Record<string, Set<string>>) => ({ ...f, plan: new Set(["Pro"]) })); await wait(500);
        A().setPop(null); await wait(1400);
        if (!await to('[data-unchip="plan"]')) return; await press(); A().setFilters({}); await wait(700);
        const cell = await to(`tbody tr[data-id]:first-child td[data-k="company"]`); if (!cell) return; await press(); await wait(90); await press();
        const id0 = (root.querySelector("tbody tr[data-id]") as HTMLElement | null)?.dataset.id;
        const row0 = rows.find((r) => String(r.id) === id0); if (!row0) return;
        A().startEdit(row0.id, "company"); await wait(300);
        for (const ch of " Studio") { if (!alive) return; A().setEditing((e: Edit) => (e ? { ...e, value: e.value + ch } : e)); await wait(110); }
        await wait(400); A().commit(true); await wait(1000);
        if (!await to("tbody tr[data-id]:nth-child(1) .dtb-ck")) return; await press(); A().toggleSel(row0.id, false); await wait(400);
        const id2 = (root.querySelector("tbody tr[data-id]:nth-child(3)") as HTMLElement | null)?.dataset.id;
        if (!await to("tbody tr[data-id]:nth-child(3) .dtb-ck")) return; await press(); A().toggleSel(rows.find((r) => String(r.id) === id2)?.id ?? row0.id, true); await wait(900);
        if (!await to(".dtb-bulk .danger")) return; await press(); A().removeSelected("Deleted"); await wait(900);
        if (!await to(".dtb-toast button")) return; await press(); (root.querySelector(".dtb-toast button") as HTMLButtonElement | null)?.click(); await wait(1000);
        if (!await to(`tbody tr[data-id]:nth-child(2) td[data-k="plan"]`)) return; await press();
        const id1 = (root.querySelector("tbody tr[data-id]:nth-child(2)") as HTMLElement | null)?.dataset.id; const r1 = rows.find((r) => String(r.id) === id1);
        if (r1) A().openRow(r1.id); await wait(2200); if (!alive) return; await press(); if (r1) A().openRow(r1.id); await wait(700);
        if (!await to(".dtb-seg button:last-child")) return; await press(); A().setDensity("compact"); await wait(1300);
        if (!await to(".dtb-seg button:first-child", 300)) return; await press(); A().setDensity("comfortable"); await wait(800);
        await glide(o.width * 0.7, 160, 700);
      }
    };
    void run();
    return () => { alive = false; setTouring(false); root.removeEventListener("pointerdown", stop, true); };
  }, [autoplay]);

  // ---------------- drawing ----------------
  const hl = (s: string) => {
    const q = query.trim(); if (!q) return s;
    const i = s.toLowerCase().indexOf(q.toLowerCase());
    return i < 0 ? s : <>{s.slice(0, i)}<mark>{s.slice(i, i + q.length)}</mark>{s.slice(i + q.length)}</>;
  };
  const cell = (r: DTRow, c: DTColumn): ReactNode => {
    if (editing && editing.id === r.id && editing.key === c.key)
      return <input className="dtb-edit" autoFocus value={editing.value} inputMode={isNum(c) ? "numeric" : undefined}
        onChange={(e) => setEditing({ ...editing, value: e.target.value })} onBlur={() => commit(true)}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); commit(true); requestAnimationFrame(() => scrollRef.current?.focus()); } if (e.key === "Escape") { commit(false); requestAnimationFrame(() => scrollRef.current?.focus()); } }}
        onFocus={(e) => e.currentTarget.select()} onClick={(e) => e.stopPropagation()} aria-label={`Edit ${c.label}`} />;
    const v = r[c.key];
    switch (c.type) {
      case "person": return <span className="dtb-who"><span className="dtb-av" style={{ background: r.color ?? colorOf(String(v)) }}>{initials(String(v))}</span><span><span className="dtb-nm">{hl(String(v ?? ""))}</span>{c.subKey && <span className="dtb-em">{hl(String(r[c.subKey] ?? ""))}</span>}</span></span>;
      case "money": return money(Number(v) || 0);
      case "number": return v ?? "—";
      case "status": return <span className="dtb-st"><i style={{ background: statusColors[v] ?? "var(--mute)" }} />{hl(String(v ?? ""))}</span>;
      case "date": return <span className="dtb-sub">{v ? fmtDate(v) : "—"}</span>;
      case "ago": return <span className="dtb-sub">{v ? ago(v, NOW) : "—"}</span>;
      case "select": return c.key === "owner" ? <span className="dtb-own"><span className="dtb-av" style={{ background: colorOf(String(v)) }}>{initials(String(v))}</span>{hl(String(v ?? ""))}</span> : hl(String(v ?? ""));
      default: return <span className={c.key === firstKey ? undefined : "dtb-sub"}>{hl(String(v ?? ""))}</span>;
    }
  };
  const defaultDetail = (r: DTRow) => {
    const t: number[] = Array.isArray(r.trend) ? r.trend : [], mx = Math.max(...t, 1), first = t[0] || 1, d = r.mrr ? Math.round(((r.mrr - first) / first) * 100) : -100;
    const pts = t.map((v, i) => `${(i / Math.max(1, t.length - 1)) * 220},${46 - (v / mx) * 40}`).join(" ");
    const facts = cols.filter((k) => k !== firstKey && k !== "mrr").slice(0, 4);
    return (
      <div className="dtb-det">
        <div>
          <h4>{L.trend}</h4>
          <div><span className="dtb-big">{money(Number(r.mrr) || 0)}</span>{t.length > 1 && <span className="dtb-delta" style={{ color: d >= 0 ? "#22a861" : "#e0612b" }}>{d >= 0 ? "▲" : "▼"} {Math.abs(d)}%</span>}</div>
          {t.length > 1 && <svg width="220" height="50" viewBox="0 0 220 50" style={{ marginTop: 10, overflow: "visible" }} aria-hidden="true"><polyline points={pts} fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /><circle cx="220" cy={46 - (t[t.length - 1]! / mx) * 40} r="3" fill="var(--ink)" /></svg>}
        </div>
        <div><h4>{L.account}</h4><dl>{facts.map((k) => <FactRow key={k} label={byKey[k]!.label} value={textOf(r, byKey[k]!, NOW)} />)}</dl></div>
        <div><h4>{L.notes}</h4><textarea defaultValue={r.notes ?? ""} placeholder="Add a note for the team" onClick={(e) => e.stopPropagation()} onBlur={(e) => { if (e.target.value !== (r.notes ?? "")) update(r.id, "notes", e.target.value); }} /></div>
      </div>
    );
  };

  const allOn = shown.length > 0 && shown.every((r) => selected.has(r.id)), someOn = shown.some((r) => selected.has(r.id));
  const dark = theme === "dark";
  const popStyle = (align: "left" | "right" = "left"): CSSProperties => {
    if (!pop) return {};
    // placed inside the root (not fixed): a transformed ancestor, like a page transition, would shift a fixed popover
    const r = pop.rect, o = rootRef.current!.getBoundingClientRect(), top = r.bottom - o.top + 6;
    return align === "right" ? { top, right: Math.max(8, o.right - r.right) } : { top, left: Math.max(8, Math.min(o.width - 200, r.left - o.left)) };
  };
  const chips = Object.entries(filters).filter(([, s]) => s.size);
  const a = view.length ? pg * per + 1 : 0, b = Math.min(view.length, pg * per + per);

  return (
    <div ref={rootRef} className={`dtb${dark ? " dark" : ""}${density === "compact" ? " compact" : ""}${backdrop ? " bd" : ""}${hideTitle ? " no-hd" : ""}${className ? ` ${className}` : ""}`}
      style={{ ...(backdrop ? { background: background ?? (dark ? "#0a0a0b" : "#ececea") } : {}), ...style }}>
      {loadFont && <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" />}
      <style>{CSS}</style>
      <section className="dtb-card" aria-label={title}>
        {!hideTitle && <div className="dtb-hd"><h2>{title}</h2><span className="dtb-count">{rows.length}</span></div>}
        <div className="dtb-tools">
          <label className="dtb-search">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" /></svg>
            <input ref={searchRef} value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder={L.search} aria-label={L.search} autoComplete="off" />
            <kbd>/</kbd>
          </label>
          {chips.map(([k, s]) => (
            <button key={k} type="button" className="dtb-tb on" data-popper data-chip={k} onClick={(e) => setPop({ kind: "filter", rect: e.currentTarget.getBoundingClientRect(), key: k })}>
              {byKey[k]?.label}: <b>{[...s].slice(0, 2).join(", ")}{s.size > 2 ? ` +${s.size - 2}` : ""}</b>
              <span className="dtb-x" data-unchip={k} role="button" aria-label={`Remove the ${byKey[k]?.label} filter`} onClick={(e) => { e.stopPropagation(); const f = { ...filters }; delete f[k]; setFilters(f); setPage(0); }}>✕</span>
            </button>
          ))}
          {filterable.length > 0 && (
            <button type="button" className="dtb-tb" data-popper data-filterby onClick={(e) => setPop({ kind: "filterBy", rect: e.currentTarget.getBoundingClientRect() })}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M2 4h12M4.5 8h7M7 12h2" /></svg>{L.filter}
            </button>
          )}
          <span className="dtb-grow" />
          <span className="dtb-seg" role="group" aria-label="Row height">
            <button type="button" className={density === "comfortable" ? "on" : undefined} aria-label="Comfortable rows" aria-pressed={density === "comfortable"} onClick={() => setDensity("comfortable")}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M2 3.5h12M2 8h12M2 12.5h12" /></svg></button>
            <button type="button" className={density === "compact" ? "on" : undefined} aria-label="Compact rows" aria-pressed={density === "compact"} onClick={() => setDensity("compact")}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M2 2.5h12M2 6h12M2 9.5h12M2 13h12" /></svg></button>
          </span>
          <button type="button" className="dtb-tb" data-popper onClick={(e) => setPop({ kind: "columns", rect: e.currentTarget.getBoundingClientRect(), align: "right" })}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="2" y="2.5" width="12" height="11" rx="2" /><path d="M6.5 2.5v11M10 2.5v11" /></svg>{L.columns}
          </button>
          <button type="button" className="dtb-tb" onClick={() => exportRows(view)}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M2.5 13.5h11" /></svg>{L.export}
          </button>
          {toolbarEnd}
        </div>

        <div ref={scrollRef} className={`dtb-scroll${scrolled ? " scrolled" : ""}`} tabIndex={0} onKeyDown={onKey} onScroll={(e) => setScrolled(e.currentTarget.scrollLeft > 2)}
          onBlur={() => setTimeout(() => { if (!scrollRef.current?.contains(document.activeElement)) setFocus(null); }, 0)} role="grid" aria-label={`${title} table`}>
          <table style={{ width: 44 + cols.reduce((n, k) => n + (widths[k] ?? 140), 0), minWidth: "100%" }}>
            <colgroup><col style={{ width: 44 }} />{cols.map((k) => <col key={k} style={{ width: widths[k] }} />)}</colgroup>
            <thead>
              <tr>
                <th className="cb pin p0"><span className={`dtb-ck${allOn ? " on" : someOn ? " half" : ""}`} role="checkbox" aria-checked={allOn ? true : someOn ? "mixed" : false} aria-label="Select this page" tabIndex={0} onClick={toggleAll} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleAll(); } }}>{CK}</span></th>
                {cols.map((k, i) => {
                  const c = byKey[k]!, s = sort.findIndex((x) => x.key === k);
                  return (
                    <th key={k} data-k={k} className={`${isNum(c) ? "num" : ""}${s >= 0 ? " sorted" + (sort[s]!.dir < 0 ? " desc" : "") : ""}${i === 0 ? " pin p1" : ""}${dragKey === k ? " drag-from" : ""}`}
                      aria-sort={s >= 0 ? (sort[s]!.dir > 0 ? "ascending" : "descending") : "none"} onPointerDown={(e) => onHeadDown(e, k)}
                      onClick={(e) => { if ((e.target as HTMLElement).closest(".dtb-rz") || dragMoved.current) return; clickHeading(k, e.shiftKey); }}>
                      <span className="dtb-lbl">{isNum(c) && <Arrow />}{c.label}{!isNum(c) && <Arrow />}{sort.length > 1 && s >= 0 && <span className="dtb-pri">{s + 1}</span>}</span>
                      <span className="dtb-rz" aria-hidden="true" />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody ref={tbodyRef}>
              {loading ? Array.from({ length: per }, (_, i) => (
                <tr key={i} className="dtb-sk"><td className="cb pin p0" />{cols.map((k) => <td key={k}><div style={{ width: `${40 + ((i * 37 + k.length * 13) % 50)}%` }} /></td>)}</tr>
              )) : shown.map((r, ri) => (
                <FragmentRow key={r.id}>
                  <tr data-id={r.id} className={`${selected.has(r.id) ? "sel" : ""}${goneIds.has(r.id) ? " gone" : ""}`} aria-selected={selected.has(r.id)}
                    onClick={(e) => {
                      const t = e.target as HTMLElement; if (t.closest(".dtb-edit")) return;
                      if (t.closest(".dtb-ck") || e.shiftKey || e.metaKey || e.ctrlKey) { toggleSel(r.id, e.shiftKey); return; }
                      // a single click opens the row, but waits a beat so a double click (edit) can claim it
                      if (clickT.current) clearTimeout(clickT.current); clickT.current = setTimeout(() => openRow(r.id), 220);
                    }}
                    onDoubleClick={(e) => { if (clickT.current) clearTimeout(clickT.current); const td = (e.target as HTMLElement).closest("td[data-k]") as HTMLElement | null; if (td) startEdit(r.id, td.dataset.k!, td.getBoundingClientRect()); }}>
                    <td className="cb pin p0"><span className={`dtb-ck${selected.has(r.id) ? " on" : ""}`} role="checkbox" aria-checked={selected.has(r.id)} aria-label={`Select ${r[firstKey] ?? "row"}`}>{CK}</span></td>
                    {cols.map((k, ci) => <td key={k} data-k={k} className={`${isNum(byKey[k]!) ? "num" : ""}${ci === 0 ? " pin p1" : ""}${focus && focus.r === ri && focus.c === ci ? " f" : ""}`}>{cell(r, byKey[k]!)}</td>)}
                  </tr>
                  {open === r.id && <tr className="det"><td colSpan={cols.length + 1}>{detail ? detail(r) : defaultDetail(r)}</td></tr>}
                </FragmentRow>
              ))}
            </tbody>
          </table>
          {drop && <div className="dtb-drop" style={{ left: drop.x, height: drop.h }} />}
        </div>

        {!loading && view.length === 0 && (
          <div className="dtb-empty">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--mute)" strokeWidth="1.6" aria-hidden="true"><rect x="6" y="9" width="28" height="22" rx="5" /><path d="M6 16h28M14 9v22" /><circle cx="27" cy="25" r="5" fill="var(--card)" /><path d="M30.5 28.5l3 3" strokeLinecap="round" /></svg>
            <h3>{L.emptyTitle}</h3>
            <p>{query ? `Nothing for “${query}”. ` : ""}{L.emptyText}</p>
            {(query || chips.length > 0) && <button type="button" className="dtb-tb" onClick={() => { setQuery(""); setFilters({}); }}>{L.clear}</button>}
          </div>
        )}

        <div className="dtb-ft">
          <span>{loading ? "" : `${a}–${b} of ${view.length}`}</span>
          <span className="dtb-keys"><span><kbd>↑↓←→</kbd>Move</span><span><kbd>Enter</kbd>Edit</span><span><kbd>Space</kbd>Select</span></span>
          <span className="dtb-grow" />
          <button type="button" className="dtb-tb" style={{ height: 28 }} data-popper onClick={(e) => setPop({ kind: "per", rect: e.currentTarget.getBoundingClientRect(), align: "right" })}>{L.rows} <b>{per}</b></button>
          <span className="dtb-pg">
            <button type="button" disabled={pg === 0} onClick={() => setPage(pg - 1)} aria-label="Previous page">‹</button>
            {Array.from({ length: pages }, (_, i) => <button key={i} type="button" className={i === pg ? "on" : undefined} aria-current={i === pg ? "page" : undefined} onClick={() => setPage(i)}>{i + 1}</button>)}
            <button type="button" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)} aria-label="Next page">›</button>
          </span>
        </div>

        <div className={`dtb-bulk${selected.size ? " on" : ""}`} role="toolbar" aria-label="Selected rows">
          <span className="n">{selected.size} {L.selected}</span>
          {bulkActions?.([...selected], () => setSelected(new Set()))}
          <button type="button" onClick={() => exportRows(rows.filter((r) => selected.has(r.id)))}>{L.export}</button>
          {onArchive && <button type="button" onClick={() => removeSelected("Archived")}>{L.archive}</button>}
          {(onDelete || autoplay) && <button type="button" className="danger" onClick={() => removeSelected("Deleted")}>{L.delete}</button>}
          <button type="button" aria-label="Clear the selection" onClick={() => setSelected(new Set())}>✕</button>
        </div>
        <div className={`dtb-toast${toast ? " on" : ""}${toast && !toast.undo ? " plain" : ""}`} role="status">
          <span>{toast?.text}</span>{toast?.undo && <button type="button" onClick={toast.undo}>{L.undo}</button>}
        </div>
      </section>

      {pop && (
        <div className="dtb-pop" style={popStyle(pop.align)} role="menu">
          {pop.kind === "filterBy" && <><div className="dtb-ttl">Filter by</div>{filterable.map((c) => <button key={c.key} type="button" className="dtb-it" data-fk={c.key} onClick={() => setPop({ ...pop, kind: "filter", key: c.key })}>{c.label}</button>)}</>}
          {pop.kind === "filter" && pop.key && (() => {
            const c = byKey[pop.key]!, cur = filters[pop.key] ?? new Set<string>();
            return <><div className="dtb-ttl">{c.label}</div>{optionsOf(c).map((o) => (
              <button key={o} type="button" className="dtb-it" data-fv={o} role="menuitemcheckbox" aria-checked={cur.has(o)}
                onClick={() => { const s = new Set(cur); if (s.has(o)) s.delete(o); else s.add(o); setFilters({ ...filters, [pop.key!]: s }); setPage(0); }}>
                <span className={`dtb-ck${cur.has(o) ? " on" : ""}`}>{CK}</span>{c.type === "status" ? <span className="dtb-st"><i style={{ background: statusColors[o] ?? "var(--mute)" }} />{o}</span> : o}
                <span className="n">{rows.filter((r) => String(r[c.key]) === o).length}</span>
              </button>))}</>;
          })()}
          {pop.kind === "columns" && <><div className="dtb-ttl">Show columns</div>
            {order.map((k) => <button key={k} type="button" className="dtb-it" disabled={k === firstKey} role="menuitemcheckbox" aria-checked={!hidden.has(k)}
              onClick={() => { const h = new Set(hidden); if (h.has(k)) h.delete(k); else h.add(k); setHidden(h); }}><span className={`dtb-ck${hidden.has(k) ? "" : " on"}`}>{CK}</span>{byKey[k]!.label}</button>)}
            <div className="dtb-sep" />
            <button type="button" className="dtb-it" onClick={() => { setOrder(COLS.map((c) => c.key)); setHidden(new Set(COLS.filter((c) => c.hidden).map((c) => c.key))); setWidths(Object.fromEntries(COLS.map((c) => [c.key, c.width ?? 140]))); }}>Reset columns</button></>}
          {pop.kind === "per" && <><div className="dtb-ttl">Rows per page</div>{pageSizes.map((n) => <button key={n} type="button" className="dtb-it" role="menuitemradio" aria-checked={per === n} onClick={() => { setPer(n); setPage(0); setPop(null); }}><span className={`dtb-ck${per === n ? " on" : ""}`}>{CK}</span>{n}</button>)}</>}
          {pop.kind === "pick" && pop.key && pop.rowId != null && (() => {
            const c = byKey[pop.key]!, r = rows.find((x) => x.id === pop.rowId);
            return optionsOf(c).map((o) => (
              <button key={o} type="button" className="dtb-it" role="menuitemradio" aria-checked={r?.[c.key] === o} onClick={() => { setPop(null); if (r?.[c.key] === o) return; update(pop.rowId!, c.key, o); say(`${c.label} set to ${o}`); }}>
                <span className={`dtb-ck${r?.[c.key] === o ? " on" : ""}`}>{CK}</span>{c.type === "status" ? <span className="dtb-st"><i style={{ background: statusColors[o] ?? "var(--mute)" }} />{o}</span> : o}
              </button>));
          })()}
        </div>
      )}

      {autoplay && (
        <>
          <div ref={curRef} className="dtb-cur" style={{ opacity: touring ? 1 : 0 }} aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 29.5 29.5"><path d="M4.6 3.1c-.6-.3-1.3.3-1 1l6 16.4c.3.7 1.3.7 1.5 0l2.2-6.2c.1-.3.4-.6.7-.7l6.2-2.2c.7-.2.7-1.2 0-1.5z" fill="#3b6cf6" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" /></svg>
          </div>
          {rings.map((g) => <span key={g.id} className="dtb-ring" style={{ left: g.x, top: g.y }} onAnimationEnd={() => setRings((r) => r.filter((x) => x.id !== g.id))} aria-hidden="true" />)}
        </>
      )}
    </div>
  );
}

function FragmentRow({ children }: { children: ReactNode }) { return <>{children}</>; }
function FactRow({ label, value }: { label: string; value: string }) { return <><dt>{label}</dt><dd>{value}</dd></>; }
