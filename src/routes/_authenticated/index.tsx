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
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "guests" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "guest_edits" }, load)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [selected]);

  if (!selected) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading sanctuary overview…</div>;
  }

  const total = guests.length;
  const capacity = selected.capacity || 500;
  const capacityPct = Math.min(100, Math.round((total / Math.max(capacity, 1)) * 100));

  const maleCount = guests.filter((g) => g.gender === "male").length;
  const femaleCount = guests.filter((g) => g.gender === "female").length;
  const campers = guests.filter((g) => g.status === "camping");
  const maleCampers = campers.filter((g) => g.gender === "male").length;
  const femaleCampers = campers.filter((g) => g.gender === "female").length;

  const firstTimers = guests.filter(
    (g) => g.ministry_role === "first_timer" || g.ministry_role === "visitor",
  ).length;
  const checkedInAnyDay = guests.filter((g) => Object.keys(g.check_ins ?? {}).length > 0).length;

  const uniqueChurches = new Set(
    guests.map((g) => (g.church_name || "").trim().toLowerCase()).filter(Boolean),
  ).size;

  const totalDays = selected.total_days || 3;
  const dayBreakdown = Array.from({ length: totalDays }, (_, idx) => {
    const dayNum = idx + 1;
    const registered = guests.filter(
      (g) => g.days_registered?.includes(dayNum) || g.day === dayNum,
    ).length;
    const arrived = guests.filter((g) => isCheckedInForDay(g, dayNum)).length;
    return { dayNum, registered, arrived };
  });

  const recentGuests = guests.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Sanctuary Event Command Hero (Double-Bezel Asymmetric Split) */}
      <section className="bezel-shell slide-up">
        <div className="bezel-core grid grid-cols-1 gap-6 p-6 sm:p-8 lg:grid-cols-12 lg:items-center">
          <div className="space-y-3 lg:col-span-7">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-md bg-primary px-2.5 py-1 font-mono-code font-semibold text-primary-foreground">
                {selected.code}
              </span>
              <span className="rounded-md border border-border bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
                {EVENT_CATEGORY_LABELS[selected.category] || "Church Event"}
              </span>
              {selected.venue && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <MapPin size={13} className="text-accent" aria-hidden="true" />
                  {selected.venue}
                </span>
              )}
            </div>

            <div>
              <h1 className="text-foreground">{selected.name}</h1>
              {selected.subtitle && (
                <p className="mt-1.5 max-w-[60ch] text-sm text-muted-foreground">
                  {selected.subtitle}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <Link
                to="/register"
                id="quick-register-btn"
                className="group inline-flex items-center gap-2.5 rounded-full bg-primary py-2.5 pr-3 pl-5 text-sm font-semibold text-primary-foreground no-underline shadow-xs hover:opacity-95"
              >
                <span>Register attendee</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-foreground/15 transition-transform group-hover:translate-x-0.5">
                  <UserPlus size={15} weight="bold" aria-hidden="true" />
                </span>
              </Link>

              <Link
                to="/checkin"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-5 py-2.5 text-sm font-semibold text-secondary-foreground no-underline hover:bg-muted"
              >
                <QrCode size={17} className="text-accent" aria-hidden="true" />
                <span>Gate check-in desk</span>
              </Link>
            </div>
          </div>

          {/* Right Column: Live Sanctuary Capacity & Arrival Telemetry */}
          <div className="rounded-2xl border border-border bg-surface p-5 lg:col-span-5">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Unique registered souls</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-mono-code text-4xl font-extrabold tracking-tight text-foreground">
                    {total}
                  </span>
                  <span className="font-mono-code text-xs text-muted-foreground">
                    / {capacity} target
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2.5 py-1 font-mono-code text-xs font-semibold text-success">
                  <CheckCircle size={13} weight="fill" aria-hidden="true" />
                  {checkedInAnyDay} arrived
                </span>
              </div>
            </div>

            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-border/70">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${capacityPct}%` }}
              />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3.5 text-xs">
              <div>
                <span className="block text-muted-foreground">Gender split</span>
                <span className="font-mono-code font-semibold text-foreground">
                  {maleCount}M · {femaleCount}F
                </span>
              </div>
              <div>
                <span className="block text-muted-foreground">Parishes</span>
                <span className="font-mono-code font-semibold text-foreground">
                  {uniqueChurches || 1} represented
                </span>
              </div>
              <div>
                <span className="block text-muted-foreground">Visitors</span>
                <span className="font-mono-code font-semibold text-warm">{firstTimers} guests</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Asymmetric Bento Row: Daily Schedule Matrix + Camp & Dormitory Allocation */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Multi-Day Attendance & Check-in Schedule (7 cols) */}
        <div className="surface-card flex flex-col justify-between p-6 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-foreground">Multi-day sanctuary schedule</h2>
              <p className="text-xs text-muted-foreground">
                Registered headcount vs verified gate arrivals across {totalDays} days
              </p>
            </div>
            <Link
              to="/checkin"
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent no-underline hover:underline"
            >
              Open gate desk
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>

          <div className="space-y-3.5">
            {dayBreakdown.map(({ dayNum, registered, arrived }) => {
              const barPct = total > 0 ? Math.min(100, Math.round((registered / total) * 100)) : 0;
              const arrivedPct =
                registered > 0 ? Math.min(100, Math.round((arrived / registered) * 100)) : 0;

              return (
                <div key={dayNum} className="rounded-xl border border-border bg-secondary/40 p-3.5">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">Day {dayNum} session</span>
                    <div className="flex items-center gap-3 font-mono-code">
                      <span className="text-muted-foreground">{registered} registered</span>
                      <span className="font-semibold text-success">{arrived} checked in</span>
                    </div>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-border/60">
                    <div
                      className="h-full rounded-full bg-accent/35"
                      style={{ width: `${barPct}%` }}
                    />
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-primary"
                      style={{ width: `${(barPct * arrivedPct) / 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gender & Camp Dormitory Logistics (5 cols) */}
        <div className="surface-card flex flex-col justify-between p-6 lg:col-span-5">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-foreground">Camp & dormitory logistics</h2>
              <Campfire size={18} className="text-warm" weight="duotone" aria-hidden="true" />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Live gender-segregated lodging & hospitality breakdown
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-surface p-4">
                <span className="text-xs text-muted-foreground">Men's sanctuary dorms</span>
                <div className="mt-1 font-mono-code text-2xl font-bold text-foreground">
                  {maleCampers}
                </div>
                <span className="mt-1 block text-xs text-muted-foreground">
                  of {maleCount} male attendees
                </span>
              </div>

              <div className="rounded-xl border border-border bg-surface p-4">
                <span className="text-xs text-muted-foreground">Women's sanctuary dorms</span>
                <div className="mt-1 font-mono-code text-2xl font-bold text-foreground">
                  {femaleCampers}
                </div>
                <span className="mt-1 block text-xs text-muted-foreground">
                  of {femaleCount} female attendees
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-secondary/50 px-4 py-3 text-xs">
            <div className="flex items-center gap-2">
              <Sparkle size={15} className="text-warm" weight="fill" aria-hidden="true" />
              <span className="font-medium text-foreground">
                {campers.length} total campers · {total - campers.length} day commuters
              </span>
            </div>
            <Link to="/guests" className="font-semibold text-accent no-underline hover:underline">
              Roster
            </Link>
          </div>
        </div>
      </section>

      {/* Bottom Feed: Recent Badges Issued + Live Registrar Audit Stream */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Recent Registrations */}
        <div className="surface-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UsersThree size={18} className="text-accent" aria-hidden="true" />
              <h2 className="text-foreground">Recent badges issued</h2>
            </div>
            <Link
              to="/guests"
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent no-underline hover:underline"
            >
              Full directory
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>

          {recentGuests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-12 text-center">
              <IdentificationBadge size={28} className="mx-auto mb-2 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-semibold text-foreground">No attendees registered yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Issue your first attendee badge pass to populate live sanctuary telemetry.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recentGuests.map((g) => (
                <li key={g.id}>
                  <Link
                    to="/guests/$id"
                    params={{ id: g.id }}
                    className="flex items-center justify-between gap-3 rounded-xl px-2 py-3 text-foreground no-underline hover:bg-secondary/60"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary font-mono-code text-xs font-bold text-foreground">
                        {g.first_name[0]}
                        {g.last_name[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {formatFullName(g)}
                          </span>
                          <span className="font-mono-code text-xs font-medium text-accent">
                            {g.reg_code}
                          </span>
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
