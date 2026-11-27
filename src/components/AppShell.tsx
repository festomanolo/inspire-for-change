import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { openEventStudio, useEvents } from "@/hooks/use-events";
import { useState, useEffect, useRef } from "react";
import { exportAllDataToCSV } from "@/lib/csv-export";
import { EVENT_STATUS_LABELS, STAFF_ROLE_LABELS, type EventStatus } from "@/lib/types";
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

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const switcherRef = useRef<HTMLDivElement>(null);
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
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
      if (switcherRef.current && !switcherRef.current.contains(target)) {
        setSwitcherOpen(false);
      }
    }
    if (menuOpen || switcherOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen, switcherOpen]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const handleExportAll = async () => {
    try {
      await exportAllDataToCSV();
      setMenuOpen(false);
      toast.success("Full multi-event archive exported to CSV");
    } catch {
      toast.error("Could not export archive. Please try again.");
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

  const activeBrandTitle = selected?.organizer?.trim() || "Inspired for Change";
  const hasCustomOrganizer = Boolean(
    selected?.organizer?.trim() &&
    selected.organizer.trim().toLowerCase() !== "inspired for change",
  );

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
          {/* Dynamic Brand / Active Host Identity */}
          <Link
            to="/"
            className="flex min-w-0 shrink items-center gap-2.5 text-foreground no-underline"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              {hasCustomOrganizer ? (
                <Buildings size={19} weight="duotone" aria-hidden="true" />
              ) : (
                <Church size={19} weight="duotone" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0 leading-tight">
              <span className="block max-w-[160px] truncate text-sm font-bold tracking-tight sm:max-w-[220px] sm:text-[15px]">
                {activeBrandTitle}
              </span>
              <span className="hidden truncate text-[11px] text-muted-foreground sm:block">
                Multi-Event & Sanctuary Hub
              </span>
            </div>
          </Link>

          {/* Desktop Single-Line Navigation */}
          <nav aria-label="Primary navigation" className="hidden lg:flex lg:items-center lg:gap-1">
            {NAV_ITEMS.map((item) => {
              const active =
                item.to === "/"
                  ? pathname === "/"
                  : item.to === "/manager"
                    ? pathname.startsWith("/manager") || pathname.startsWith("/admin")
                    : pathname.startsWith(item.to);
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

          {/* Right Controls: Multi-Event Switcher + Quick Add + Theme + Staff Menu */}
          <div className="flex shrink-0 items-center gap-2">
            {selected && (
              <div className="flex items-center gap-1" ref={switcherRef}>
                <div className="relative">
                  <button
                    id="event-year-selector"
                    type="button"
                    aria-expanded={switcherOpen}
                    aria-haspopup="listbox"
                    onClick={() => setSwitcherOpen(!switcherOpen)}
                    className="inline-flex h-9 max-w-[175px] cursor-pointer items-center gap-2 rounded-full border border-border bg-secondary px-3 text-xs font-semibold text-secondary-foreground hover:border-accent/40 sm:max-w-[240px]"
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass(selected.status || "active")}`}
                      aria-hidden="true"
                    />
                    <span className="font-mono-code text-[11px] text-accent">{selected.code}</span>
                    <span className="truncate">{selected.name}</span>
                    <CaretDown
                      size={12}
                      className="shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </button>

                  {switcherOpen && (
                    <div
                      role="listbox"
                      aria-label="Switch active event"
                      className="scale-in surface-elevated absolute top-[calc(100%+8px)] right-0 z-50 w-80 overflow-hidden p-1.5"
                    >
                      <div className="flex items-center justify-between border-b border-border px-3 py-2">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          Switch event workspace ({events.length})
                        </span>
                        <Link
                          to="/manager"
                          onClick={() => setSwitcherOpen(false)}
                          className="text-[11px] font-semibold text-accent no-underline hover:underline"
                        >
                          Manage all
                        </Link>
                      </div>

                      <div className="max-h-64 overflow-y-auto py-1">
                        {events.map((ev) => {
                          const isCurrent = ev.id === selected.id;
                          return (
                            <button
                              key={ev.id}
                              type="button"
                              role="option"
                              aria-selected={isCurrent}
                              onClick={() => {
                                select(ev.id);
                                setSwitcherOpen(false);
                              }}
                              className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs ${
                                isCurrent
                                  ? "bg-primary/10 font-semibold text-foreground"
                                  : "text-foreground hover:bg-secondary"
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClass(ev.status || "active")}`}
                                    aria-hidden="true"
                                  />
                                  <span className="truncate font-semibold">{ev.name}</span>
                                </div>
                                <div className="mt-0.5 truncate pl-3 text-[11px] text-muted-foreground">
                                  {ev.organizer ? `${ev.organizer} · ` : ""}
                                  {EVENT_STATUS_LABELS[ev.status || "active"]} · {ev.year}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5">
                                <span className="font-mono-code text-[11px] font-semibold text-accent">
                                  {ev.code}
                                </span>
                                {isCurrent && (
                                  <Check
                                    size={13}
                                    className="text-primary"
                                    weight="bold"
                                    aria-hidden="true"
                                  />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="border-t border-border pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSwitcherOpen(false);
                            openEventStudio({ mode: "create" });
                          }}
                          className="flex w-full cursor-pointer items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-left text-xs font-semibold text-primary hover:bg-primary/15"
                        >
                          <CalendarPlus size={15} weight="bold" aria-hidden="true" />
                          <span>Create new event (any program/host)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => openEventStudio({ mode: "create" })}
                  title="Create new event"
                  aria-label="Create new event"
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
              {darkMode ? (
                <Sun size={16} aria-hidden="true" />
              ) : (
                <Moon size={16} aria-hidden="true" />
              )}
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
                  {profile?.display_name ?? "Staff"}
                </span>
                <CaretDown size={12} className="text-muted-foreground" aria-hidden="true" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="scale-in surface-elevated absolute top-[calc(100%+8px)] right-0 z-50 w-64 overflow-hidden p-1.5"
                >
                  <div className="border-b border-border px-3 py-2.5">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {profile?.display_name ?? "Registrar"}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{profile?.email}</div>
                    <span className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-foreground">
                      {STAFF_ROLE_LABELS[profile?.role || "registrar"]}
                    </span>
                  </div>

                  <div className="py-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        openEventStudio({ mode: "create" });
                      }}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-secondary"
                    >
                      <CalendarPlus size={15} className="text-accent" aria-hidden="true" />
                      Create new event
                    </button>

                    <Link
                      to="/manager"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-foreground no-underline hover:bg-secondary"
                    >
                      <ChartBar size={15} className="text-accent" aria-hidden="true" />
                      Manager dashboard
                    </Link>

                    <Link
                      to="/admin"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-foreground no-underline hover:bg-secondary"
                    >
                      <ShieldCheck size={15} className="text-accent" aria-hidden="true" />
                      Event settings & audit logs
                    </Link>

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

      {/* Global Multi-Program Event Studio Modal */}
      <EventStudioModal />

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
            const active =
              item.to === "/"
                ? pathname === "/"
                : item.to === "/manager"
                  ? pathname.startsWith("/manager") || pathname.startsWith("/admin")
                  : pathname.startsWith(item.to);
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
