import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useEvents } from "@/hooks/use-events";
import { useState, useEffect, useRef } from "react";
import { exportAllDataToCSV } from "@/lib/csv-export";
import { EVENT_CATEGORY_LABELS, type EventCategory } from "@/lib/types";
import { toast } from "sonner";
import {
  CalendarPlus,
  CaretDown,
  ChartBar,
  Church,
  DownloadSimple,
  House,
  ListChecks,
  Moon,
  Plus,
  QrCode,
  ShieldCheck,
  SignOut,
  Sun,
  UserPlus,
  UsersThree,
  X,
} from "@phosphor-icons/react";

const NAV_ITEMS = [
  { to: "/", label: "Overview", Icon: House },
  { to: "/register", label: "Register", Icon: UserPlus },
  { to: "/checkin", label: "Check-in", Icon: QrCode },
  { to: "/guests", label: "Directory", Icon: UsersThree },
  { to: "/admin", label: "Ministry ops", Icon: ShieldCheck },
] as const;

export function AppShell({ children }: { children?: React.ReactNode }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { events, selected, select, createEvent } = useEvents();

  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);

  const [newEventForm, setNewEventForm] = useState({
    name: "",
    year: new Date().getFullYear(),
    category: "conference" as EventCategory,
    total_days: 3,
    venue: "Main Sanctuary & Campgrounds",
    subtitle: "",
    capacity: 500,
    camping_enabled: true,
    start_date: "",
  });

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("ifc-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved ? saved === "dark" : prefersDark;
    setDarkMode(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("ifc-theme", next ? "dark" : "light");
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const handleExportAll = async () => {
    try {
      await exportAllDataToCSV();
      setMenuOpen(false);
      toast.success("Full event archive exported to CSV");
    } catch {
      toast.error("Could not export archive. Please try again.");
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventForm.name.trim()) {
      toast.error("Please enter an event name");
      return;
    }
    setCreatingEvent(true);
    try {
      const created = await createEvent({
        name: newEventForm.name,
        year: newEventForm.year,
        category: newEventForm.category,
        total_days: Math.max(1, Math.min(14, newEventForm.total_days)),
        venue: newEventForm.venue || null,
        subtitle: newEventForm.subtitle || null,
        capacity: newEventForm.capacity || null,
        camping_enabled: newEventForm.camping_enabled,
        start_date: newEventForm.start_date || null,
      });
      toast.success(`Created "${created.name}" (${created.code})`);
      setEventModalOpen(false);
      setNewEventForm((prev) => ({ ...prev, name: "", subtitle: "" }));
    } catch (err: any) {
      toast.error(err?.message || "Could not create church event");
    } finally {
      setCreatingEvent(false);
    }
  };

  const initials = profile?.display_name
    ? profile.display_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "ST";

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <a
        href="#main-workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to workspace
      </a>

      {/* Top Navigation Header */}
      <header className="no-print surface-glass sticky top-0 z-40 border-b border-border">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-3 px-4 sm:px-6">
          {/* Brand Identity */}
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2.5 text-foreground no-underline"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              <Church size={19} weight="duotone" aria-hidden="true" />
            </div>
            <div className="leading-tight">
              <span className="block text-sm font-bold tracking-tight sm:text-[15px]">
                Inspired for Change
              </span>
              <span className="hidden text-[11px] text-muted-foreground sm:block">
                Church Events & Sanctuary Registry
              </span>
            </div>
          </Link>

          {/* Desktop Single-Line Navigation */}
          <nav aria-label="Primary navigation" className="hidden lg:flex lg:items-center lg:gap-1">
            {NAV_ITEMS.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              const Icon = item.Icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium no-underline ${
                    active
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Icon size={16} weight={active ? "fill" : "regular"} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

            {/* Right side */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
              {/* Event year selector */}
              {selected && (
                <div style={{ position: "relative" }}>
                  <select
                    id="event-year-selector"
                    value={selected.id}
                    onChange={(e) => {
                      if (e.target.value === "__new__") setAdding(true);
                      else select(e.target.value);
                    }}
                    style={{
                      appearance: "none", WebkitAppearance: "none",
                      background: "var(--color-secondary)", color: "var(--color-foreground)",
                      border: "1.5px solid var(--color-border)", borderRadius: "9999px",
                      padding: "6px 32px 6px 12px", fontSize: "0.8rem", fontWeight: 500,
                      cursor: "pointer", maxWidth: "130px",
                    }}
                  >
                    {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    <option value="__new__">+ New year</option>
                  </select>
                  <div style={{
                    position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
                    pointerEvents: "none", color: "var(--color-muted-foreground)",
                  }}>
                    <ChevronIcon />
                  </div>
                </div>
              )}

              {/* Avatar + menu */}
              <div style={{ position: "relative" }} ref={menuRef}>
                <button
                  id="header-menu-btn"
                  onClick={() => setMenuOpen(!menuOpen)}
                  style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "5px 10px 5px 5px", borderRadius: "9999px",
                    background: menuOpen ? "var(--color-secondary)" : "transparent",
                    border: "1.5px solid var(--color-border)", cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{
                    width: "28px", height: "28px", borderRadius: "50%",
                    background: "linear-gradient(135deg, oklch(0.28 0.06 255), oklch(0.55 0.22 258))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white", fontSize: "0.7rem", fontWeight: 700, flexShrink: 0,
                  }}>
                    {initials}
                  </div>
                  <span className="hidden sm:inline" style={{ fontSize: "0.8rem", fontWeight: 500, maxWidth: "90px",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {profile?.display_name ?? "Account"}
                  </span>
                  <MenuIcon />
                </button>

                {menuOpen && (
                  <div className="scale-in" style={{
                    position: "absolute", right: 0, top: "calc(100% + 8px)",
                    width: "210px", background: "var(--color-card)",
                    border: "1px solid var(--color-border)", borderRadius: "16px",
                    boxShadow: "var(--shadow-float)", overflow: "hidden", zIndex: 50,
                  }}>
                    <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid var(--color-border)" }}>
                      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--color-foreground)" }}>
                        {profile?.display_name ?? "Staff member"}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--color-muted-foreground)", marginTop: "2px",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {profile?.email}
                      </div>
                    </div>
                    <button
                      id="export-all-btn"
                      onClick={handleExportAll}
                      style={{ width: "100%", textAlign: "left", padding: "11px 14px", fontSize: "0.85rem",
                        background: "none", border: "none", cursor: "pointer", color: "var(--color-foreground)",
                        transition: "background 0.1s ease" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-secondary)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                    >
                      📊 Export all data (CSV)
                    </button>
                    <div style={{ borderTop: "1px solid var(--color-border)" }}>
                      <button
                        id="sign-out-btn"
                        onClick={handleSignOut}
                        style={{ width: "100%", textAlign: "left", padding: "11px 14px", fontSize: "0.85rem",
                          background: "none", border: "none", cursor: "pointer", color: "var(--color-destructive)",
                          transition: "background 0.1s ease" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-secondary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── New event modal ─────────────────────────────────────────────────── */}
      {adding && (
        <div
          className="no-print fixed inset-0 z-50 fade-in"
          style={{ background: "oklch(0 0 0 / 0.45)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
          onClick={() => setAdding(false)}
        >
          <div
            className="surface-elevated scale-in"
            style={{ padding: "28px", width: "100%", maxWidth: "380px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "6px" }}>Create new event year</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--color-muted-foreground)", marginBottom: "20px" }}>
              Start a fresh registration set for a new year.
            </p>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "6px" }}>Year</label>
            <input
              id="new-year-input"
              type="number"
              value={newYear}
              onChange={(e) => setNewYear(Number(e.target.value))}
              style={{ width: "100%", padding: "10px 14px", borderRadius: "12px",
                background: "var(--color-input)", border: "1.5px solid var(--color-border)", fontSize: "0.9rem" }}
            />
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button
                id="cancel-new-year-btn"
                onClick={() => setAdding(false)}
                style={{ padding: "9px 18px", borderRadius: "9999px", fontSize: "0.85rem",
                  background: "var(--color-secondary)", border: "none", cursor: "pointer",
                  color: "var(--color-muted-foreground)" }}
              >
                Cancel
              </button>
              <button
                id="create-new-year-btn"
                onClick={handleAdd}
                style={{ padding: "9px 18px", borderRadius: "9999px", fontSize: "0.85rem",
                  background: "linear-gradient(135deg, oklch(0.28 0.06 255), oklch(0.55 0.22 258))",
                  border: "none", cursor: "pointer", color: "white", fontWeight: 600 }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: "1280px", margin: "0 auto", padding: "24px 16px 100px" }} className="fade-in">
        {children ?? <Outlet />}
      </main>

      {/* ── Mobile bottom navigation ─────────────────────────────────────── */}
      <nav className="md:hidden no-print fixed bottom-0 inset-x-0 z-40" style={{
        backdropFilter: "blur(20px) saturate(1.8)",
        WebkitBackdropFilter: "blur(20px) saturate(1.8)",
        background: "oklch(0.985 0.002 250 / 0.92)",
        borderTop: "1px solid var(--color-border)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}>
        <div style={{ display: "flex", height: "60px" }}>
          {NAV.map((n) => {
            const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                id={`mobile-nav-${n.label.toLowerCase()}`}
                style={{
                  flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", gap: "3px", textDecoration: "none",
                  color: active ? "var(--color-accent)" : "var(--color-muted-foreground)",
                  transition: "color 0.15s ease", fontSize: "0.62rem", fontWeight: active ? 600 : 400,
                  paddingBottom: "2px",
                }}
              >
                <div style={{
                  padding: "5px 14px", borderRadius: "10px",
                  background: active ? "oklch(0.55 0.22 258 / 0.1)" : "transparent",
                  transition: "background 0.15s ease",
                }}>
                  <n.Icon active={active} />
                </div>
                <span>{n.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
