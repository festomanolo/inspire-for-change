import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEvents } from "@/hooks/use-events";
import type { Guest, GuestEdit, Profile } from "@/lib/types";
import { formatDistanceToNow, format } from "date-fns";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Inspired for Change" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { selected, events } = useEvents();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [edits, setEdits] = useState<(GuestEdit & { guest?: Guest | null })[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "activity" | "staff">("overview");

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      const { data: gs } = await supabase
        .from("guests")
        .select("*")
        .eq("event_id", selected.id)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      setGuests((gs as Guest[]) ?? []);

      const { data: es } = await supabase
        .from("guest_edits")
        .select("*, guest:guests(*)")
        .order("edited_at", { ascending: false })
        .limit(100);

      if (cancelled) return;
      const filtered = ((es as (GuestEdit & { guest?: Guest })[]) ?? []).filter(
        (e) => e.guest?.event_id === selected.id,
      );
      setEdits(filtered);

      const { data: ps } = await supabase.from("profiles").select("*");
      if (cancelled) return;
      const map: Record<string, Profile> = {};
      ((ps as Profile[]) ?? []).forEach((p) => (map[p.id] = p));
      setProfiles(map);
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel("admin-" + selected.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "guests" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "guest_edits" }, load)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [selected]);

  const totalGuests = guests.length;
  const campers = guests.filter((g) => g.status === "camping").length;
  const notCampers = totalGuests - campers;
  const day1 = guests.filter((g) => g.day === 1).length;
  const day2 = guests.filter((g) => g.day === 2).length;
  const day3 = guests.filter((g) => g.day === 3).length;
  const totalEdits = edits.length;
  const creates = edits.filter((e) => e.action === "create").length;
  const updates = edits.filter((e) => e.action === "update").length;

  // Staff activity stats
  const staffStats: Record<string, { name: string; creates: number; updates: number }> = {};
  edits.forEach((e) => {
    const id = e.edited_by ?? "unknown";
    const name = e.edited_by ? (profiles[e.edited_by]?.display_name ?? "Unknown") : "Unknown";
    if (!staffStats[id]) staffStats[id] = { name, creates: 0, updates: 0 };
    if (e.action === "create") staffStats[id].creates++;
    else staffStats[id].updates++;
  });
  const staffList = Object.entries(staffStats).sort(
    (a, b) => (b[1].creates + b[1].updates) - (a[1].creates + a[1].updates),
  );

  if (!selected) return <div style={{ color: "var(--color-muted-foreground)" }}>Loading…</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="slide-up" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "5px",
            padding: "3px 10px", borderRadius: "9999px", fontSize: "0.72rem", fontWeight: 700,
            background: "oklch(0.55 0.22 258 / 0.1)", color: "var(--color-accent)",
            border: "1px solid oklch(0.55 0.22 258 / 0.2)",
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            ADMIN PANEL
          </span>
          <h1 style={{ margin: 0, lineHeight: 1 }}>Activity Dashboard</h1>
        </div>
        <p style={{ fontSize: "0.85rem", color: "var(--color-muted-foreground)", marginTop: "2px" }}>
          Full visibility into all guest registrations and staff actions for <strong>{selected.name}</strong>
        </p>
      </div>

      {/* Event selector note */}
      <div style={{
        padding: "12px 16px", borderRadius: "12px", fontSize: "0.82rem",
        background: "oklch(0.55 0.22 258 / 0.06)", border: "1px solid oklch(0.55 0.22 258 / 0.15)",
        color: "var(--color-accent)", display: "flex", alignItems: "center", gap: "8px",
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Viewing data for <strong style={{ marginLeft: "4px" }}>{selected.name}</strong>. Use the event selector in the header to switch years.
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "4px", background: "var(--color-secondary)", borderRadius: "12px", padding: "4px", width: "fit-content" }}>
        {(["overview", "activity", "staff"] as const).map((tab) => (
          <button
            key={tab}
            id={`admin-tab-${tab}`}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 18px", borderRadius: "9px", fontSize: "0.82rem", fontWeight: 500,
              border: "none", cursor: "pointer", transition: "all 0.15s ease",
              background: activeTab === tab ? "var(--color-card)" : "transparent",
              color: activeTab === tab ? "var(--color-foreground)" : "var(--color-muted-foreground)",
              boxShadow: activeTab === tab ? "var(--shadow-soft)" : "none",
              textTransform: "capitalize",
            }}
          >
            {tab === "overview" ? "📊 Overview" : tab === "activity" ? "📋 Activity Log" : "👥 Staff"}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "var(--color-muted-foreground)" }}>
          Loading admin data…
        </div>
      ) : (
        <>
          {/* Overview tab */}
          {activeTab === "overview" && (
            <div className="fade-in space-y-6">
              {/* Stat grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "12px" }}>
                {[
                  { label: "Total Guests", value: totalGuests, color: "oklch(0.55 0.22 258)", bg: "oklch(0.55 0.22 258 / 0.08)" },
                  { label: "Camping", value: campers, color: "oklch(0.52 0.19 150)", bg: "oklch(0.52 0.19 150 / 0.08)" },
                  { label: "Not Camping", value: notCampers, color: "oklch(0.6 0.01 250)", bg: "transparent" },
                  { label: "Day 1", value: day1, color: "oklch(0.65 0.2 290)", bg: "oklch(0.65 0.2 290 / 0.08)" },
                  { label: "Day 2", value: day2, color: "oklch(0.6 0.2 320)", bg: "oklch(0.6 0.2 320 / 0.08)" },
                  { label: "Day 3", value: day3, color: "oklch(0.58 0.22 27)", bg: "oklch(0.58 0.22 27 / 0.08)" },
                  { label: "Total Actions", value: totalEdits, color: "oklch(0.55 0.18 220)", bg: "oklch(0.55 0.18 220 / 0.08)" },
                  { label: "Registrations", value: creates, color: "oklch(0.52 0.19 150)", bg: "oklch(0.52 0.19 150 / 0.08)" },
                  { label: "Updates", value: updates, color: "oklch(0.65 0.18 60)", bg: "oklch(0.65 0.18 60 / 0.08)" },
                ].map((s, i) => (
                  <div key={i} className={`surface-card stagger-${Math.min(i + 1, 6)}`} style={{ padding: "18px", background: s.bg, borderColor: `${s.color}30` }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--color-muted-foreground)", marginBottom: "6px" }}>{s.label}</div>
                    <div style={{ fontSize: "2rem", fontWeight: 700, color: s.color, letterSpacing: "-0.04em", lineHeight: 1 }}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* All events summary */}
              <div className="surface-card" style={{ padding: "20px" }}>
                <h2 style={{ marginBottom: "14px" }}>All Event Years</h2>
                {events.length === 0 ? (
                  <p style={{ color: "var(--color-muted-foreground)", fontSize: "0.85rem" }}>No events found.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {events.map((ev) => (
                      <div key={ev.id} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 14px", borderRadius: "10px", background: "var(--color-secondary)",
                        ...(ev.id === selected.id ? { border: "1.5px solid oklch(0.55 0.22 258 / 0.3)" } : {}),
                      }}>
                        <span style={{ fontSize: "0.88rem", fontWeight: ev.id === selected.id ? 600 : 400 }}>
                          {ev.name}
                          {ev.id === selected.id && <span style={{ fontSize: "0.7rem", color: "var(--color-accent)", marginLeft: "8px" }}>● current</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Activity Log tab */}
          {activeTab === "activity" && (
            <div className="fade-in surface-card" style={{ overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={{ margin: 0 }}>Full Activity Log</h2>
                <span style={{ fontSize: "0.78rem", color: "var(--color-muted-foreground)" }}>
                  {edits.length} action{edits.length !== 1 ? "s" : ""}
                </span>
              </div>

              {edits.length === 0 ? (
                <div style={{ padding: "48px", textAlign: "center", color: "var(--color-muted-foreground)", fontSize: "0.88rem" }}>
                  No activity recorded yet.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  {/* Desktop table */}
                  <table className="hidden md:table" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "var(--color-secondary)" }}>
                        {["Staff member", "Action", "Guest", "Origin", "Day", "Time"].map((h) => (
                          <th key={h} style={{ padding: "10px 16px", fontSize: "0.72rem", fontWeight: 700,
                            textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-muted-foreground)",
                            textAlign: "left", borderBottom: "1px solid var(--color-border)" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {edits.map((e, i) => {
                        const who = e.edited_by ? (profiles[e.edited_by]?.display_name ?? "Unknown") : "Unknown";
                        const isCreate = e.action === "create";
                        return (
                          <tr key={e.id} style={{
                            borderBottom: "1px solid var(--color-border)",
                            background: i % 2 === 0 ? "transparent" : "var(--color-secondary)/40",
                            transition: "background 0.1s",
                          }}>
                            <td style={{ padding: "11px 16px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div style={{
                                  width: "24px", height: "24px", borderRadius: "50%",
                                  background: "linear-gradient(135deg, oklch(0.28 0.06 255), oklch(0.55 0.22 258))",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  color: "white", fontSize: "0.6rem", fontWeight: 700, flexShrink: 0,
                                }}>
                                  {who.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                                </div>
                                <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>{who}</span>
                              </div>
                            </td>
                            <td style={{ padding: "11px 16px" }}>
                              <span style={{
                                padding: "3px 10px", borderRadius: "9999px", fontSize: "0.72rem", fontWeight: 600,
                                background: isCreate ? "oklch(0.52 0.19 150 / 0.1)" : "oklch(0.65 0.18 60 / 0.1)",
                                color: isCreate ? "var(--color-success)" : "oklch(0.55 0.18 60)",
                                border: `1px solid ${isCreate ? "oklch(0.52 0.19 150 / 0.2)" : "oklch(0.65 0.18 60 / 0.2)"}`,
                              }}>
                                {isCreate ? "✚ Registered" : "✎ Updated"}
                              </span>
                            </td>
                            <td style={{ padding: "11px 16px" }}>
                              {e.guest ? (
                                <Link to="/guests/$id" params={{ id: e.guest.id }}
                                  style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--color-accent)",
                                    textDecoration: "none" }}
                                  onMouseEnter={(el) => (el.currentTarget.style.textDecoration = "underline")}
                                  onMouseLeave={(el) => (el.currentTarget.style.textDecoration = "none")}>
                                  {e.guest.first_name} {e.guest.last_name}
                                </Link>
                              ) : (
                                <span style={{ fontSize: "0.85rem", color: "var(--color-muted-foreground)" }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: "11px 16px", fontSize: "0.82rem", color: "var(--color-muted-foreground)" }}>
                              {e.guest?.origin ?? "—"}
                            </td>
                            <td style={{ padding: "11px 16px" }}>
                              {e.guest?.day ? (
                                <span style={{
                                  width: "22px", height: "22px", borderRadius: "6px", display: "inline-flex",
                                  alignItems: "center", justifyContent: "center",
                                  background: "oklch(0.55 0.22 258 / 0.1)", color: "var(--color-accent)",
                                  fontSize: "0.75rem", fontWeight: 700,
                                }}>
                                  {e.guest.day}
                                </span>
                              ) : (
                                <span style={{ color: "var(--color-muted-foreground)", fontSize: "0.82rem" }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: "11px 16px" }}>
                              <div style={{ fontSize: "0.78rem", color: "var(--color-muted-foreground)" }}>
                                {formatDistanceToNow(new Date(e.edited_at), { addSuffix: true })}
                              </div>
                              <div style={{ fontSize: "0.7rem", color: "var(--color-muted-foreground)", opacity: 0.7 }}>
                                {format(new Date(e.edited_at), "MMM d, HH:mm")}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Mobile list */}
                  <div className="md:hidden" style={{ display: "flex", flexDirection: "column" }}>
                    {edits.map((e) => {
                      const who = e.edited_by ? (profiles[e.edited_by]?.display_name ?? "Unknown") : "Unknown";
                      const isCreate = e.action === "create";
                      return (
                        <div key={e.id} style={{ padding: "14px 16px", borderBottom: "1px solid var(--color-border)" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{
                                width: "26px", height: "26px", borderRadius: "50%",
                                background: "linear-gradient(135deg, oklch(0.28 0.06 255), oklch(0.55 0.22 258))",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: "white", fontSize: "0.62rem", fontWeight: 700, flexShrink: 0,
                              }}>
                                {who.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                              </div>
                              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{who}</span>
                            </div>
                            <span style={{ fontSize: "0.72rem", color: "var(--color-muted-foreground)" }}>
                              {formatDistanceToNow(new Date(e.edited_at), { addSuffix: true })}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingLeft: "34px" }}>
                            <span style={{
                              padding: "2px 8px", borderRadius: "9999px", fontSize: "0.7rem", fontWeight: 600,
                              background: isCreate ? "oklch(0.52 0.19 150 / 0.1)" : "oklch(0.65 0.18 60 / 0.1)",
                              color: isCreate ? "var(--color-success)" : "oklch(0.55 0.18 60)",
                            }}>
                              {isCreate ? "Registered" : "Updated"}
                            </span>
                            {e.guest && (
                              <Link to="/guests/$id" params={{ id: e.guest.id }}
                                style={{ fontSize: "0.82rem", color: "var(--color-accent)", textDecoration: "none", fontWeight: 500 }}>
                                {e.guest.first_name} {e.guest.last_name}
                              </Link>
                            )}
                            {e.guest?.day && (
                              <span style={{ fontSize: "0.75rem", color: "var(--color-muted-foreground)" }}>· Day {e.guest.day}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Staff tab */}
          {activeTab === "staff" && (
            <div className="fade-in space-y-4">
              <div className="surface-card" style={{ padding: "20px" }}>
                <h2 style={{ marginBottom: "4px" }}>Staff Leaderboard</h2>
                <p style={{ fontSize: "0.82rem", color: "var(--color-muted-foreground)", marginBottom: "20px" }}>
                  Guest registrations and updates per staff member
                </p>

                {staffList.length === 0 ? (
                  <p style={{ color: "var(--color-muted-foreground)", fontSize: "0.85rem" }}>No staff activity yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {staffList.map(([id, s], i) => {
                      const total = s.creates + s.updates;
                      const pct = staffList[0] ? (total / (staffList[0][1].creates + staffList[0][1].updates)) * 100 : 100;
                      return (
                        <div key={id} style={{ padding: "14px 16px", borderRadius: "12px", background: "var(--color-secondary)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                            <div style={{
                              width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
                              background: i === 0
                                ? "linear-gradient(135deg, oklch(0.7 0.15 60), oklch(0.65 0.18 40))"
                                : "linear-gradient(135deg, oklch(0.28 0.06 255), oklch(0.55 0.22 258))",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              color: "white", fontSize: "0.75rem", fontWeight: 700,
                            }}>
                              {s.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "1px",
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {s.name}
                                {i === 0 && <span style={{ marginLeft: "6px", fontSize: "0.7rem" }}>🏆</span>}
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "var(--color-muted-foreground)" }}>
                                {s.creates} registered · {s.updates} updated · {total} total
                              </div>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--color-accent)", flexShrink: 0 }}>
                              {total}
                            </div>
                          </div>
                          {/* Progress bar */}
                          <div style={{ height: "4px", borderRadius: "9999px", background: "var(--color-border)", overflow: "hidden" }}>
                            <div style={{
                              height: "100%", width: `${pct}%`, borderRadius: "9999px",
                              background: i === 0
                                ? "linear-gradient(90deg, oklch(0.7 0.15 60), oklch(0.65 0.18 40))"
                                : "linear-gradient(90deg, oklch(0.28 0.06 255), oklch(0.55 0.22 258))",
                              transition: "width 0.5s ease",
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Login credentials card */}
              <div className="surface-card" style={{
                padding: "20px",
                borderColor: "oklch(0.55 0.22 258 / 0.25)",
                background: "oklch(0.55 0.22 258 / 0.03)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <h2 style={{ margin: 0 }}>Admin Access</h2>
                </div>
                <p style={{ fontSize: "0.82rem", color: "var(--color-muted-foreground)", lineHeight: 1.6, marginBottom: "14px" }}>
                  The admin panel is visible to <strong>all authenticated staff members</strong>. Access is granted upon sign-up — no separate credentials needed.
                </p>
                <div style={{
                  padding: "12px 14px", borderRadius: "10px",
                  background: "var(--color-secondary)", fontSize: "0.82rem", lineHeight: 1.7,
                }}>
                  <strong>How to access this panel:</strong><br/>
                  1. Go to <code style={{ background: "var(--color-muted)", padding: "1px 5px", borderRadius: "4px" }}>/auth</code> on any device<br/>
                  2. Click <strong>"Create account"</strong> and fill in your details<br/>
                  3. Sign in with your credentials<br/>
                  4. Tap <strong>Admin</strong> in the navigation
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
