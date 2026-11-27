import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEvents } from "@/hooks/use-events";
import {
  EVENT_CATEGORY_LABELS,
  GENDER_LABELS,
  formatFullName,
  isCheckedInForDay,
  type Guest,
  type GuestEdit,
  type Profile,
} from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  ArrowRight,
  Campfire,
  CheckCircle,
  Church,
  Clock,
  IdentificationBadge,
  MapPin,
  QrCode,
  Sparkle,
  UserPlus,
  UsersThree,
} from "@phosphor-icons/react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Sanctuary Overview — Inspired for Change" }] }),
  component: DashboardOverview,
});

function DashboardOverview() {
  const { selected } = useEvents();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [edits, setEdits] = useState<(GuestEdit & { guest?: Guest | null })[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;

    const load = async () => {
      const { data: gs } = await supabase
        .from("guests")
        .select("*")
        .eq("event_id", selected.id)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setGuests((gs as unknown as Guest[]) ?? []);

      const { data: es } = await supabase
        .from("guest_edits")
        .select("*, guest:guests(*)")
        .order("edited_at", { ascending: false })
        .limit(12);
      if (cancelled) return;
      const filteredEdits = ((es as unknown as (GuestEdit & { guest?: Guest })[]) ?? []).filter(
        (e) => e.event_id === selected.id || e.guest?.event_id === selected.id,
      );
      setEdits(filteredEdits.slice(0, 7));

      const { data: ps } = await supabase.from("profiles").select("*");
      if (cancelled) return;
      const map: Record<string, Profile> = {};
      ((ps as unknown as Profile[]) ?? []).forEach((p) => {
        map[p.id] = p;
      });
      setProfiles(map);
    };

    load();

    const channel = supabase
      .channel("dashboard-" + selected.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "guests" }, (payload) => {
        const newGuest = payload.new as Guest;
        if (newGuest?.event_id === selected.id) {
          toast.success(`Registered ${formatFullName(newGuest)} (${newGuest.reg_code})`);
          load();
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "guests" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "guest_edits" }, load)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [selected]);

  if (!selected) return <div style={{ color: "var(--color-muted-foreground)" }}>Loading…</div>;

  const total = guests.length;
  const campers = guests.filter((g) => g.status === "camping").length;
  const notCampers = total - campers;
  const day1 = guests.filter((g) => g.day === 1).length;
  const day2 = guests.filter((g) => g.day === 2).length;
  const day3 = guests.filter((g) => g.day === 3).length;
  const recent = guests.slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div className="slide-up">
        <p style={{ fontSize: "0.8rem", color: "var(--color-muted-foreground)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {selected.name}
        </p>
        <h1 style={{ marginTop: "2px" }}>Overview</h1>
      </div>

      {/* Quick action */}
      <Link
        to="/register"
        id="quick-register-btn"
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderRadius: "16px", textDecoration: "none",
          background: "linear-gradient(135deg, oklch(0.28 0.06 255) 0%, oklch(0.55 0.22 258) 100%)",
          color: "white", boxShadow: "0 4px 20px oklch(0.45 0.2 268 / 0.3)",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 24px oklch(0.45 0.2 268 / 0.35)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 20px oklch(0.45 0.2 268 / 0.3)"; }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "2px" }}>Register a new guest</div>
          <div style={{ fontSize: "0.8rem", opacity: 0.8 }}>Quickly add guests to {selected.name}</div>
        </div>
        <div style={{ fontSize: "1.4rem", opacity: 0.9 }}>→</div>
      </Link>

      {/* Stats row 1 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
        <StatCard label="Total guests" value={total} emoji="👥" accentColor="oklch(0.55 0.22 258)" />
        <StatCard label="Camping" value={campers} emoji="⛺" accentColor="oklch(0.52 0.19 150)" accent />
        <StatCard label="Day visitors" value={notCampers} emoji="☀️" accentColor="oklch(0.6 0.01 250)" />
      </div>

      {/* Stats row 2 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
        <StatCard label="Day 1" value={day1} emoji="1️⃣" accentColor="oklch(0.65 0.2 290)" />
        <StatCard label="Day 2" value={day2} emoji="2️⃣" accentColor="oklch(0.6 0.2 320)" />
        <StatCard label="Day 3" value={day3} emoji="3️⃣" accentColor="oklch(0.58 0.22 27)" />
      </div>

      {/* Recent registrations + edits */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
        {/* Recent registrations */}
        <div className="surface-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <h2 style={{ margin: 0 }}>Recent registrations</h2>
            <Link to="/guests" style={{ fontSize: "0.8rem", color: "var(--color-accent)", textDecoration: "none", fontWeight: 500 }}>
              View all →
            </Link>
          </div>
          {recent.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "var(--color-muted-foreground)", fontSize: "0.85rem" }}>
              <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🎉</div>
              No guests yet — be the first to register!
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
              {recent.map((g) => (
                <li key={g.id}>
                  <Link
                    to="/guests/$id"
                    params={{ id: g.id }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 12px", margin: "0 -12px", borderRadius: "12px",
                      textDecoration: "none", color: "inherit", transition: "background 0.12s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-secondary)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <div style={{
                        width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
                        background: "linear-gradient(135deg, oklch(0.55 0.22 258 / 0.15), oklch(0.65 0.2 290 / 0.15))",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.7rem", fontWeight: 700, color: "var(--color-accent)",
                      }}>
                        {g.first_name[0]}{g.last_name[0]}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {[g.first_name, g.middle_name, g.last_name].filter(Boolean).join(" ")}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--color-muted-foreground)" }}>{g.origin}</div>
                      </div>
                    </div>
                    <StatusPill status={g.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent edits */}
        <div className="surface-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <h2 style={{ margin: 0 }}>Recent activity</h2>
            <Link to="/admin" style={{ fontSize: "0.8rem", color: "var(--color-accent)", textDecoration: "none", fontWeight: 500 }}>
              Full log →
            </Link>
          </div>
          {edits.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "var(--color-muted-foreground)", fontSize: "0.85rem" }}>
              <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📋</div>
              No activity recorded yet.
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
              {edits.map((e) => {
                const who = e.edited_by ? profiles[e.edited_by]?.display_name : "Unknown";
                const isCreate = e.action === "create";
                return (
                  <li key={e.id} style={{ fontSize: "0.83rem" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
                      <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", minWidth: 0 }}>
                        <span style={{
                          marginTop: "1px", flexShrink: 0, width: "18px", height: "18px",
                          borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center",
                          background: isCreate ? "oklch(0.52 0.19 150 / 0.12)" : "oklch(0.65 0.18 60 / 0.12)",
                          color: isCreate ? "var(--color-success)" : "oklch(0.55 0.18 60)",
                          fontSize: "0.6rem",
                        }}>
                          {isCreate ? "✚" : "✎"}
                        </span>
                        <span style={{ lineHeight: 1.4 }}>
                          <span style={{ fontWeight: 600 }}>{who}</span>{" "}
                          <span style={{ color: "var(--color-muted-foreground)" }}>
                            {isCreate ? "registered" : "updated"}
                          </span>{" "}
                          {e.guest && (
                            <Link
                              to="/guests/$id"
                              params={{ id: e.guest.id }}
                              style={{ fontWeight: 600, color: "var(--color-accent)", textDecoration: "none" }}
                            >
                              {e.guest.first_name} {e.guest.last_name}
                            </Link>
                          )}
                        </span>
                      </div>
                      <span style={{ fontSize: "0.72rem", color: "var(--color-muted-foreground)", whiteSpace: "nowrap", flexShrink: 0 }}>
                        {formatDistanceToNow(new Date(e.edited_at), { addSuffix: true })}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label, value, emoji, accentColor, accent,
}: {
  label: string; value: number; emoji: string; accentColor: string; accent?: boolean;
}) {
  return (
    <div
      className="surface-card"
      style={{
        padding: "14px 14px 12px",
        ...(accent ? {
          background: `${accentColor}08`,
          borderColor: `${accentColor}25`,
        } : {}),
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        cursor: "default",
      }}
    >
      <div style={{ fontSize: "1.1rem", marginBottom: "6px" }}>{emoji}</div>
      <div style={{
        fontSize: "clamp(1.5rem, 5vw, 2rem)", fontWeight: 700, letterSpacing: "-0.04em",
        lineHeight: 1, color: accentColor, marginBottom: "4px",
      }}>
        {value}
      </div>
      <div style={{ fontSize: "0.72rem", color: "var(--color-muted-foreground)", fontWeight: 500, lineHeight: 1.2 }}>
        {label}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: "camping" | "not_camping" }) {
  return (
    <span style={{
      fontSize: "0.68rem", padding: "3px 8px", borderRadius: "9999px", flexShrink: 0,
      fontWeight: 600,
      background: status === "camping" ? "oklch(0.55 0.22 258 / 0.1)" : "var(--color-muted)",
      color: status === "camping" ? "var(--color-accent)" : "var(--color-muted-foreground)",
      border: `1px solid ${status === "camping" ? "oklch(0.55 0.22 258 / 0.2)" : "var(--color-border)"}`,
    }}>
      {status === "camping" ? "⛺ Camping" : "☀️ Day"}
    </span>
  );
}
