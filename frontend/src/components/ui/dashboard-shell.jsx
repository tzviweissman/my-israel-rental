/**
 * DashboardShell — a collapsible sidebar with grouped items and count
 * badges, and a content area beside it.
 *
 * Ported from a TypeScript source ("dashboard-with-collapsible-sidebar").
 * This project is CRA + JavaScript (`components.json` has `tsx: false`).
 * The sidebar's shape, its collapse-to-rail behaviour and the badge pill
 * are the author's. What changed, and why:
 *
 * 1. IT IS A SHELL, NOT A DEMO. The source renders its own hardcoded menu
 *    and a page of invented figures ("$24,567", "+12% from last month",
 *    `Math.random()` prices). The menu here is whatever the caller passes
 *    — the dashboard's real role-gated groups, with the real counts — and
 *    the content is the caller's children. Nothing in this file knows what
 *    a sale is.
 *
 * 2. NO DARK-MODE TOGGLE. The source flips `document.documentElement` to
 *    `.dark`. This site has no dark theme: every other page would keep its
 *    light palette while the dashboard alone went dark, and the toggle
 *    would be a promise to the whole site that only one page keeps.
 *
 * 3. TOKENS, NOT `gray-*`/`blue-*`. The dashboard used to be the one grey
 *    admin panel on a site that is not grey (docs/dashboard-ux-spec.md, D8).
 *
 * 4. IT WORKS IN HEBREW. The sidebar sits on the reading-start edge, the
 *    selected item's accent bar sits on that same edge, and the collapse
 *    chevron points the way the panel will move. All through logical
 *    properties, so `[dir="rtl"]` flips the lot.
 *
 * 5. THE COLLAPSED STATE IS REMEMBERED per browser, because someone who
 *    folds the sidebar to get room for a table does not want to fold it
 *    again on every visit. Guarded: storage can be absent or throw.
 *
 * On narrow screens the caller should render its own navigation instead
 * (the dashboard keeps its tab strip there); a 256px rail is a third of a
 * phone.
 */
import React from "react";
import { ChevronsRight } from "lucide-react";

import { cn } from "@/lib/utils";

const STORAGE_KEY = "dashboard-sidebar-open";

function readOpen() {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

function Item({ item, open, selected, onSelect }) {
  const Icon = item.Icon;
  const isSelected = selected === item.id;
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      title={open ? undefined : item.label}
      aria-current={isSelected ? "page" : undefined}
      className={cn(
        "relative flex h-11 w-full items-center rounded-md transition-colors duration-200 text-start",
        isSelected
          ? "font-semibold"
          : "hover:bg-[var(--surface-muted,#f9fafb)]",
      )}
      style={
        isSelected
          ? {
              background: "rgb(var(--brand-primary-rgb) / 0.10)",
              color: "var(--brand-primary)",
              boxShadow: "inset 3px 0 0 var(--brand-primary)",
            }
          : { color: "var(--brand-muted)" }
      }
      data-testid={`sidebar-item-${item.id}`}
    >
      <span className="grid h-full w-12 shrink-0 place-content-center">
        {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : <span className="h-4 w-4" />}
      </span>
      {open && <span className="text-sm truncate pe-8">{item.label}</span>}
      {item.badge > 0 && (
        <span
          className={cn(
            "absolute flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white",
            open ? "end-3" : "end-1 top-1 h-4 min-w-4 text-[10px]",
          )}
          style={{ background: item.urgent ? "var(--destructive-solid, #DC2626)" : "var(--brand-primary)" }}
          data-testid={`sidebar-badge-${item.id}`}
        >
          {item.badge > 9 ? "9+" : item.badge}
        </span>
      )}
    </button>
  );
}

/**
 * @param {Object} props
 * @param {{key: string, label?: string, tabs: {id: string, label: string, Icon?: any, badge?: number, urgent?: boolean}[]}[]} props.groups
 * @param {string} props.selected
 * @param {(id: string) => void} props.onSelect
 * @param {React.ReactNode} [props.brand] Rendered at the top of the sidebar.
 * @param {React.ReactNode} [props.header] Rendered above the content.
 * @param {string} [props.hideLabel] The collapse button's label.
 * @param {string} [props.className]
 */
export function DashboardShell({ groups, selected, onSelect, brand, header, hideLabel = "Hide", className, children }) {
  const [open, setOpen] = React.useState(true);

  React.useEffect(() => {
    setOpen(readOpen());
  }, []);

  const toggle = () => {
    setOpen((v) => {
      try { window.localStorage.setItem(STORAGE_KEY, v ? "0" : "1"); } catch { /* fine */ }
      return !v;
    });
  };

  // No groups means the caller is rendering its own navigation (the
  // dashboard keeps its tab strip on phones). Then there is no sidebar at
  // all - not an empty rail with a brand card and a Hide button beside a
  // tab strip squeezed into the remaining third of a phone, which is what
  // rendering the column regardless produced.
  if (!groups || groups.length === 0) {
    return (
      <div className={cn("w-full", className)} data-testid="dashboard-shell" data-sidebar="none">
        {header}
        {children}
      </div>
    );
  }

  return (
    <div className={cn("flex w-full items-start gap-6", className)} data-testid="dashboard-shell">
      <nav
        aria-label="Dashboard"
        className={cn(
          "sticky shrink-0 self-start rounded-xl border p-2 transition-[width] duration-300 ease-in-out",
          open ? "w-64" : "w-16",
        )}
        style={{
          top: "calc(var(--nav-h, 68px) + 16px)",
          maxHeight: "calc(100vh - var(--nav-h, 68px) - 32px)",
          background: "var(--surface, #fff)",
          borderColor: "var(--brand-border)",
          boxShadow: "var(--shadow-sm)",
          display: "flex",
          flexDirection: "column",
        }}
        data-testid="dashboard-sidebar"
        data-open={open ? "1" : "0"}
      >
        {brand && (
          <div className="mb-3 border-b pb-3" style={{ borderColor: "var(--brand-border)" }}>
            {typeof brand === "function" ? brand(open) : brand}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {groups.map((group, gi) => (
            <div key={group.key} className={cn("space-y-1", gi > 0 && "mt-4 border-t pt-4")} style={gi > 0 ? { borderColor: "var(--brand-border)" } : undefined}>
              {open && group.label && (
                <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--brand-muted)" }}>
                  {group.label}
                </div>
              )}
              {group.tabs.map((item) => (
                <Item key={item.id} item={item} open={open} selected={selected} onSelect={onSelect} />
              ))}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="mt-3 flex w-full items-center rounded-md border-t pt-2 transition-colors hover:bg-[var(--surface-muted,#f9fafb)]"
          style={{ borderColor: "var(--brand-border)", color: "var(--brand-muted)" }}
          data-testid="dashboard-sidebar-toggle"
        >
          <span className="grid h-10 w-12 place-content-center">
            <ChevronsRight
              className={cn(
                "h-4 w-4 transition-transform duration-300",
                // Points the way the panel will move: inward when open, outward when folded.
                open ? "rotate-180 rtl:rotate-0" : "rtl:rotate-180",
              )}
              aria-hidden="true"
            />
          </span>
          {open && <span className="text-sm">{hideLabel}</span>}
        </button>
      </nav>

      <div className="min-w-0 flex-1" data-testid="dashboard-shell-content">
        {header}
        {children}
      </div>
    </div>
  );
}

export default DashboardShell;
