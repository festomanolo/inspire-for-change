import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEvents } from "@/hooks/use-events";
import { useAuth } from "@/hooks/use-auth";
import { consolidateEventDuplicates } from "@/lib/json-storage";
import {
  AGE_GROUP_LABELS,
  EVENT_CATEGORY_LABELS,
  GENDER_LABELS,
  MINISTRY_ROLE_LABELS,
  formatFullName,
  type AgeGroup,
  type EventCategory,
  type Guest,
  type GuestEdit,
  type Profile,
} from "@/lib/types";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  ArrowsMerge,
  CalendarBlank,
  ChartBar,
  Church,
  ClockCounterClockwise,
  FloppyDisk,
  Medal,
  ShieldCheck,
  Sparkle,
  UsersThree,
} from "@phosphor-icons/react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Ministry Operations — Inspired for Change" }] }),
  component: MinistryAdminPage,
});

type AdminTab = "analytics" | "events" | "audit" | "team";

function MinistryAdminPage() {
  const { selected, events, select, updateEvent, refresh: refreshEvents } = useEvents();
  const { user } = useAuth();

  const [guests, setGuests] = useState<Guest[]>([]);
  const [edits, setEdits] = useState<(GuestEdit & { guest?: Guest | null })[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>("analytics");
  const [merging, setMerging] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);

  const [eventConfig, setEventConfig] = useState({
    name: "",
    year: 2026,
    category: "conference" as EventCategory,
    total_days: 3,
    capacity: 500,
    venue: "",
    subtitle: "",
    camping_enabled: true,
  });

  const loadData = async () => {
    if (!selected) return;
    setLoading(true);

    const { data: gs } = await supabase
      .from("guests")
      .select("*")
      .eq("event_id", selected.id)
      .order("created_at", { ascending: false });
    setGuests((gs as unknown as Guest[]) ?? []);

    const { data: es } = await supabase
      .from("guest_edits")
      .select("*, guest:guests(*)")
      .order("edited_at", { ascending: false })
      .limit(120);
    const filteredEdits = ((es as unknown as (GuestEdit & { guest?: Guest })[]) ?? []).filter(
      (e) => e.event_id === selected.id || e.guest?.event_id === selected.id,
    );
    setEdits(filteredEdits);

    const { data: ps } = await supabase.from("profiles").select("*");
    const map: Record<string, Profile> = {};
    ((ps as unknown as Profile[]) ?? []).forEach((p) => {
      map[p.id] = p;
    });
    setProfiles(map);
    setLoading(false);
  };

  useEffect(() => {
    if (!selected) return;
    setEventConfig({
      name: selected.name,
      year: selected.year,
      category: selected.category || "conference",
      total_days: selected.total_days || 3,
      capacity: selected.capacity || 500,
      venue: selected.venue || "",
      subtitle: selected.subtitle || "",
      camping_enabled: selected.camping_enabled !== false,
    });
    loadData();

    const channel = supabase
      .channel("admin-" + selected.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "guests" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "guest_edits" }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // Detect potential legacy multi-row same-person duplicates
  const duplicateRowCount = useMemo(() => {
    const seen = new Set<string>();
    let extra = 0;
    for (const g of guests) {
      const key = [
        g.first_name.trim().toLowerCase(),
        (g.middle_name ?? "").trim().toLowerCase(),
        g.last_name.trim().toLowerCase(),
        g.phone.trim().toLowerCase(),
      ].join("|");
      if (seen.has(key)) extra++;
      else seen.add(key);
    }
    return extra;
  }, [guests]);

  const handleConsolidateDuplicates = async () => {
    if (!selected) return;
    setMerging(true);
    try {
      const res = await consolidateEventDuplicates(selected.id, user?.id);
      if (res.mergedCount > 0) {
        toast.success(
          `Consolidated ${res.mergedCount} duplicate multi-day row(s) into canonical UUID records`,
        );
      } else {
        toast.info("All records are already unique canonical UUID profiles");
      }
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Consolidation failed");
    } finally {
      setMerging(false);
    }
  };

  const handleSaveEventConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSavingEvent(true);
    try {
      await updateEvent(selected.id, {
        name: eventConfig.name,
        year: eventConfig.year,
        category: eventConfig.category,
        total_days: Math.max(1, Math.min(14, eventConfig.total_days)),
        capacity: eventConfig.capacity,
        venue: eventConfig.venue || null,
        subtitle: eventConfig.subtitle || null,
        camping_enabled: eventConfig.camping_enabled,
      });
      await refreshEvents();
      toast.success("Event configuration saved");
    } catch (err: any) {
      toast.error(err?.message || "Could not update event");
    } finally {
      setSavingEvent(false);
    }
  };

  // Ministry Intelligence Computations
  const maleCount = guests.filter((g) => g.gender === "male").length;
  const femaleCount = guests.filter((g) => g.gender === "female").length;
  const unspecifiedGenderCount = guests.filter((g) => g.gender === "unspecified").length;

  const ageStats = useMemo(() => {
    const counts: Record<AgeGroup, number> = {
      child: 0,
      youth: 0,
      young_adult: 0,
      adult: 0,
      elder: 0,
    };
    guests.forEach((g) => {
      const ag = g.age_group || "adult";
      if (counts[ag] !== undefined) counts[ag]++;
    });
    return counts;
  }, [guests]);

  const churchRankings = useMemo(() => {
    const counts = new Map<string, number>();
    guests.forEach((g) => {
      const label = (g.church_name || g.origin || "Unspecified").trim();
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [guests]);

  const pastoralFollowUps = useMemo(
    () =>
      guests.filter(
        (g) =>
          g.ministry_role === "first_timer" ||
          g.ministry_role === "visitor" ||
          Boolean(g.dietary_medical),
      ),
    [guests],
  );

  const staffStats = useMemo(() => {
    const map: Record<string, { name: string; creates: number; checkIns: number; updates: number }> = {};
    edits.forEach((e) => {
      const id = e.edited_by ?? "system";
      const name = e.edited_by ? profiles[e.edited_by]?.display_name ?? "Registrar" : "System";
      if (!map[id]) map[id] = { name, creates: 0, checkIns: 0, updates: 0 };
      if (e.action === "create") map[id].creates++;
      else if (e.action === "check_in") map[id].checkIns++;
      else map[id].updates++;
    });
    return Object.entries(map).sort(
      (a, b) =>
        b[1].creates + b[1].checkIns + b[1].updates - (a[1].creates + a[1].checkIns + a[1].updates),
    );
  }, [edits, profiles]);

  if (!selected) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading ministry operations…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-accent">
            <ShieldCheck size={15} weight="fill" aria-hidden="true" />
            <span>Ministry operations & governance</span>
          </div>
          <h1 className="mt-1">{selected.name} administration</h1>
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
