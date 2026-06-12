import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useEvents } from "@/hooks/use-events";
import { useState, useEffect, useRef } from "react";
import { exportAllDataToCSV } from "@/lib/csv-export";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/register", label: "Register" },
  { to: "/guests", label: "Guests" },
];

export function AppShell({ children }: { children?: React.ReactNode }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { events, selected, select, createYear } = useEvents();
  const [adding, setAdding] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear() + 1);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
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
    } catch (error) {
      console.error("Error exporting data:", error);
      alert("Failed to export data. Please try again.");
    }
  };

  const handleAdd = async () => {
    try {
      await createYear(newYear, `Event ${newYear}`);
      setAdding(false);
    } catch (e) {
      alert("Could not create event year. It may already exist.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="no-print sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
          <Link to="/" className="font-display font-semibold text-lg tracking-tight">
            Inspired for Change
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((n) => {
              const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-4 py-2 rounded-full text-sm transition-all ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            {selected && (
              <div className="relative">
                <select
                  value={selected.id}
                  onChange={(e) => {
                    if (e.target.value === "__new__") {
                      setAdding(true);
                    } else {
                      select(e.target.value);
                    }
                  }}
                  className="appearance-none bg-secondary text-foreground rounded-full pl-4 pr-9 py-2 text-sm border border-border hover:bg-muted transition-colors cursor-pointer"
                >
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                  <option value="__new__">+ New year</option>
                </select>
              </div>
            )}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="px-4 py-2 rounded-full text-sm bg-secondary text-foreground hover:bg-muted transition-colors"
              >
                ⋯
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50">
                  <button
                    onClick={handleExportAll}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-secondary transition-colors"
                  >
                    Export All Data (CSV)
                  </button>
                  <div className="border-t border-border"></div>
                  <div className="px-4 py-2 text-xs text-muted-foreground">
                    {profile?.display_name}
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-3 text-sm text-destructive hover:bg-secondary transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <nav className="md:hidden flex items-center gap-1 px-6 pb-3 overflow-x-auto">
          {NAV.map((n) => {
            const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {adding && (
        <div
          className="no-print fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 fade-in"
          onClick={() => setAdding(false)}
        >
          <div
            className="surface-elevated p-8 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl mb-1">Create new event year</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Start a fresh registration set for a new year.
            </p>
            <label className="block text-sm font-medium mb-2">Year</label>
            <input
              type="number"
              value={newYear}
              onChange={(e) => setNewYear(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={() => setAdding(false)}
                className="px-5 py-2.5 rounded-full text-sm text-muted-foreground hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                className="px-5 py-2.5 rounded-full text-sm bg-primary text-primary-foreground hover:opacity-90"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-10 fade-in">
        {children ?? <Outlet />}
      </main>
    </div>
  );
}
