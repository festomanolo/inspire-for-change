import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useEvents } from "@/hooks/use-events";
import { useState, useEffect, useRef } from "react";
import { exportAllDataToCSV } from "@/lib/csv-export";

// ── Icons ─────────────────────────────────────────────────────────────────────
function HomeIcon({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth={active ? "0" : "1.8"} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
      <path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="1.8" fill="none"/>
    </svg>
  );
}
function EditIcon({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      {active && <circle cx="19" cy="5" r="3" fill="currentColor" stroke="none"/>}
    </svg>
  );
}
function UsersIcon({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4" fill={active ? "currentColor" : "none"}/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function ShieldIcon({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth={active ? "0" : "1.8"} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}
function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
    </svg>
  );
}
function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────
const NAV = [
  { to: "/", label: "Dashboard", Icon: HomeIcon },
  { to: "/register", label: "Register", Icon: EditIcon },
  { to: "/guests", label: "Guests", Icon: UsersIcon },
  { to: "/admin", label: "Admin", Icon: ShieldIcon },
];

// ── Component ─────────────────────────────────────────────────────────────────
export function AppShell({ children }: { children?: React.ReactNode }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { events, selected, select, createYear } = useEvents();
  const [adding, setAdding] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear() + 1);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    } catch {
      alert("Failed to export data. Please try again.");
    }
  };

  const handleAdd = async () => {
    try {
      await createYear(newYear, `Event ${newYear}`);
      setAdding(false);
    } catch {
      alert("Could not create event year. It may already exist.");
    }
  };

  const initials = profile?.display_name
    ? profile.display_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top header ─────────────────────────────────────────────────────── */}
      <header className="no-print sticky top-0 z-40" style={{
        backdropFilter: "blur(20px) saturate(1.8)",
        WebkitBackdropFilter: "blur(20px) saturate(1.8)",
        background: "oklch(0.985 0.002 250 / 0.85)",
        borderBottom: "1px solid var(--color-border)",
      }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 16px" }}>
          <div style={{ height: "58px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>

            {/* Logo */}
            <Link to="/" style={{
              fontWeight: 700, fontSize: "1.05rem", letterSpacing: "-0.025em",
              textDecoration: "none", color: "var(--color-foreground)", display: "flex",
              alignItems: "center", gap: "8px", flexShrink: 0,
            }}>
              <div style={{
                width: "30px", height: "30px", borderRadius: "8px",
                background: "linear-gradient(135deg, oklch(0.28 0.06 255), oklch(0.55 0.22 258))",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
                </svg>
              </div>
              <span className="hidden sm:inline">Inspired for Change</span>
              <span className="sm:hidden">IFC</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {NAV.map((n) => {
                const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    style={{
                      padding: "7px 14px", borderRadius: "9999px", fontSize: "0.85rem",
                      fontWeight: active ? 600 : 500, textDecoration: "none",
                      background: active ? "var(--color-primary)" : "transparent",
                      color: active ? "var(--color-primary-foreground)" : "var(--color-muted-foreground)",
                      transition: "all 0.15s ease",
                      display: "flex", alignItems: "center", gap: "6px",
                    }}
                  >
                    {n.label}
                    {n.label === "Admin" && (
                      <span style={{
                        fontSize: "0.65rem", padding: "1px 5px", borderRadius: "9999px",
                        background: active ? "oklch(1 0 0 / 0.2)" : "var(--color-accent)",
                        color: "white", fontWeight: 700, lineHeight: "1.4",
                      }}>
                        ADMIN
                      </span>
                    )}
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
