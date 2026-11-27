import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { openEventStudio, useEvents } from "@/hooks/use-events";
import { useState, useEffect, useRef } from "react";
import { exportAllDataToCSV } from "@/lib/csv-export";
import {
  EVENT_STATUS_LABELS,
  STAFF_ROLE_LABELS,
  type EventStatus,
} from "@/lib/types";
import { EventStudioModal } from "@/components/EventStudioModal";
import { toast } from "sonner";
import {
  Buildings,
  CalendarPlus,
  CaretDown,
  ChartBar,
  Check,
  Church,
  DownloadSimple,
  House,
  Moon,
  Plus,
  QrCode,
  ShieldCheck,
  SignOut,
  Sun,
  UserPlus,
  UsersThree,
} from "@phosphor-icons/react";

const NAV_ITEMS = [
  { to: "/", label: "Overview", Icon: House },
  { to: "/register", label: "Register", Icon: UserPlus },
  { to: "/checkin", label: "Check-in", Icon: QrCode },
  { to: "/guests", label: "Directory", Icon: UsersThree },
  { to: "/manager", label: "Manager", Icon: ChartBar },
] as const;

function statusDotClass(status: EventStatus): string {
  if (status === "active") return "bg-success";
  if (status === "upcoming") return "bg-accent";
  if (status === "completed") return "bg-warm";
  return "bg-muted-foreground";
}

export function AppShell({ children }: { children?: React.ReactNode }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { events, selected, select } = useEvents();

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

          {/* Right Controls: Event Switcher + Theme + Staff Menu */}
          <div className="flex shrink-0 items-center gap-2">
            {selected && (
              <div className="flex items-center gap-1">
                <div className="relative">
                  <select
                    id="event-year-selector"
                    aria-label="Select active church event"
                    value={selected.id}
                    onChange={(e) => {
                      if (e.target.value === "__new__") {
                        setEventModalOpen(true);
                      } else {
                        select(e.target.value);
                      }
                    }}
                    className="h-9 max-w-[165px] cursor-pointer appearance-none truncate rounded-full border border-border bg-secondary pr-8 pl-3.5 text-xs font-semibold text-secondary-foreground hover:border-accent/40 sm:max-w-[220px]"
                  >
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name} ({ev.year})
                      </option>
                    ))}
                    <option value="__new__">+ New church event…</option>
                  </select>
                  <CaretDown
                    size={13}
                    className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setEventModalOpen(true)}
                  title="Create new church event"
                  aria-label="Create new church event"
                  className="hidden h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:border-accent/40 hover:text-foreground sm:inline-flex"
                >
                  <Plus size={15} weight="bold" aria-hidden="true" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={darkMode ? "Switch to light theme" : "Switch to dark theme"}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
            >
              {darkMode ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
            </button>

            {/* Staff Account Menu */}
            <div className="relative" ref={menuRef}>
              <button
                id="header-menu-btn"
                type="button"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={() => setMenuOpen(!menuOpen)}
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-border bg-card py-1 pr-2.5 pl-1 text-xs font-medium text-foreground hover:bg-secondary"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary font-mono-code text-[11px] font-semibold text-primary-foreground">
                  {initials}
                </span>
                <span className="hidden max-w-[96px] truncate sm:inline">
                  {profile?.display_name ?? "Registrar"}
                </span>
                <CaretDown size={12} className="text-muted-foreground" aria-hidden="true" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="scale-in surface-elevated absolute top-[calc(100%+8px)] right-0 z-50 w-60 overflow-hidden p-1.5"
                >
                  <div className="border-b border-border px-3 py-2.5">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {profile?.display_name ?? "Registrar"}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{profile?.email}</div>
                  </div>

                  <div className="py-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        setEventModalOpen(true);
                      }}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-secondary"
                    >
                      <CalendarPlus size={15} className="text-accent" aria-hidden="true" />
                      Create church event
                    </button>

                    <button
                      id="export-all-btn"
                      type="button"
                      role="menuitem"
                      onClick={handleExportAll}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-secondary"
                    >
                      <DownloadSimple size={15} className="text-accent" aria-hidden="true" />
                      Export full CSV archive
                    </button>

                    <Link
                      to="/admin"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-foreground no-underline hover:bg-secondary"
                    >
                      <ChartBar size={15} className="text-accent" aria-hidden="true" />
                      Ministry analytics & logs
                    </Link>
                  </div>

                  <div className="border-t border-border pt-1">
                    <button
                      id="sign-out-btn"
                      type="button"
                      role="menuitem"
                      onClick={handleSignOut}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-destructive hover:bg-destructive/10"
                    >
                      <SignOut size={15} aria-hidden="true" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Create Church Event Modal */}
      {eventModalOpen && (
        <div
          className="no-print fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
          onClick={() => setEventModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-event-title"
            className="bezel-shell scale-in w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleCreateEvent} className="bezel-core space-y-4 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="create-event-title" className="text-lg font-bold text-foreground">
                    New church event
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Configure a conference, camp, crusade, or special convocation with its own badge sequence.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEventModalOpen(false)}
                  aria-label="Close modal"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label htmlFor="ev-name" className="mb-1.5 block text-xs font-semibold text-foreground">
                    Event title
                  </label>
                  <input
                    id="ev-name"
                    required
                    value={newEventForm.name}
                    onChange={(e) => setNewEventForm({ ...newEventForm, name: e.target.value })}
                    placeholder="e.g. Easter Youth Camp"
                    className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm text-foreground"
                  />
                </div>
                <div>
                  <label htmlFor="ev-year" className="mb-1.5 block text-xs font-semibold text-foreground">
                    Year
                  </label>
                  <input
                    id="new-year-input"
                    type="number"
                    min={2020}
                    max={2100}
                    value={newEventForm.year}
                    onChange={(e) => setNewEventForm({ ...newEventForm, year: Number(e.target.value) })}
                    className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 font-mono-code text-sm text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="ev-cat" className="mb-1.5 block text-xs font-semibold text-foreground">
                    Event type
                  </label>
                  <select
                    id="ev-cat"
                    value={newEventForm.category}
                    onChange={(e) =>
                      setNewEventForm({ ...newEventForm, category: e.target.value as EventCategory })
                    }
                    className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground"
                  >
                    {Object.entries(EVENT_CATEGORY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="ev-days" className="mb-1.5 block text-xs font-semibold text-foreground">
                    Duration (days)
                  </label>
                  <input
                    id="ev-days"
                    type="number"
                    min={1}
                    max={14}
                    value={newEventForm.total_days}
                    onChange={(e) =>
                      setNewEventForm({ ...newEventForm, total_days: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 font-mono-code text-sm text-foreground"
                  />
                </div>
                <div>
                  <label htmlFor="ev-cap" className="mb-1.5 block text-xs font-semibold text-foreground">
                    Target capacity
                  </label>
                  <input
                    id="ev-cap"
                    type="number"
                    min={10}
                    max={100000}
                    value={newEventForm.capacity}
                    onChange={(e) =>
                      setNewEventForm({ ...newEventForm, capacity: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 font-mono-code text-sm text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="ev-venue" className="mb-1.5 block text-xs font-semibold text-foreground">
                    Sanctuary / Venue
                  </label>
                  <input
                    id="ev-venue"
                    value={newEventForm.venue}
                    onChange={(e) => setNewEventForm({ ...newEventForm, venue: e.target.value })}
                    placeholder="Main Sanctuary & Grounds"
                    className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm text-foreground"
                  />
                </div>
                <div>
                  <label htmlFor="ev-date" className="mb-1.5 block text-xs font-semibold text-foreground">
                    Start date (optional)
                  </label>
                  <input
                    id="ev-date"
                    type="date"
                    value={newEventForm.start_date}
                    onChange={(e) => setNewEventForm({ ...newEventForm, start_date: e.target.value })}
                    className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm text-foreground"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="ev-sub" className="mb-1.5 block text-xs font-semibold text-foreground">
                  Theme or scripture focus (optional)
                </label>
                <input
                  id="ev-sub"
                  value={newEventForm.subtitle}
                  onChange={(e) => setNewEventForm({ ...newEventForm, subtitle: e.target.value })}
                  placeholder="e.g. Isaiah 43:19 — Walking in Renewal"
                  className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm text-foreground"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-secondary/60 px-3.5 py-2.5 text-xs font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={newEventForm.camping_enabled}
                  onChange={(e) =>
                    setNewEventForm({ ...newEventForm, camping_enabled: e.target.checked })
                  }
                  className="h-4 w-4 accent-primary"
                />
                <span>Enable on-site camping & gender-segregated dormitory allocation</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  id="cancel-new-year-btn"
                  type="button"
                  onClick={() => setEventModalOpen(false)}
                  className="cursor-pointer rounded-full border border-border bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  id="create-new-year-btn"
                  type="submit"
                  disabled={creatingEvent}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:opacity-95 disabled:opacity-50"
                >
                  <ListChecks size={15} aria-hidden="true" />
                  {creatingEvent ? "Creating…" : "Create event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <main
        id="main-workspace"
        className="fade-in mx-auto max-w-[1320px] px-4 pt-6 pb-28 sm:px-6 lg:pb-16"
      >
        {children ?? <Outlet />}
      </main>

      {/* Mobile Bottom Bar */}
      <nav
        aria-label="Mobile navigation"
        className="no-print surface-glass fixed inset-x-0 bottom-0 z-40 border-t border-border pb-[env(safe-area-inset-bottom,0px)] lg:hidden"
      >
        <div className="grid h-16 grid-cols-5">
          {NAV_ITEMS.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.Icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                id={`mobile-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                className={`flex flex-col items-center justify-center gap-1 text-[11px] no-underline ${
                  active ? "font-semibold text-accent" : "font-medium text-muted-foreground"
                }`}
              >
                <span
                  className={`flex h-7 w-11 items-center justify-center rounded-full ${
                    active ? "bg-accent/14 text-accent" : "text-muted-foreground"
                  }`}
                >
                  <Icon size={19} weight={active ? "fill" : "regular"} aria-hidden="true" />
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
