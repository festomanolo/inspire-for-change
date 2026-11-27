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

        {duplicateRowCount > 0 && (
          <button
            type="button"
            disabled={merging}
            onClick={handleConsolidateDuplicates}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-warm/40 bg-warm/12 px-4 py-2 text-xs font-semibold text-warm hover:bg-warm/18"
          >
            <ArrowsMerge size={15} weight="bold" aria-hidden="true" />
            {merging
              ? "Consolidating…"
              : `Merge ${duplicateRowCount} legacy duplicate row${duplicateRowCount > 1 ? "s" : ""}`}
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-border bg-card p-1.5 w-fit">
        {(
          [
            { id: "analytics", label: "Ministry intelligence", Icon: ChartBar },
            { id: "events", label: "Events & settings", Icon: CalendarBlank },
            { id: "audit", label: `Audit trail (${edits.length})`, Icon: ClockCounterClockwise },
            { id: "team", label: "Registrar team", Icon: UsersThree },
          ] as const
        ).map((tab) => {
          const Icon = tab.Icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`admin-tab-${tab.id}`}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold ${
                active
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon size={15} weight={active ? "fill" : "regular"} aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-44 animate-pulse rounded-2xl bg-secondary" />
          ))}
        </div>
      ) : (
        <>
          {/* TAB 1: MINISTRY INTELLIGENCE */}
          {activeTab === "analytics" && (
            <div className="fade-in space-y-6">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {/* Gender & Demographics Card */}
                <div className="surface-card space-y-4 p-6">
                  <h2 className="text-base font-bold text-foreground">Gender & demographics</h2>
                  <div className="space-y-3 text-xs">
                    {[
                      { label: "Male attendees", count: maleCount },
                      { label: "Female attendees", count: femaleCount },
                      ...(unspecifiedGenderCount > 0
                        ? [{ label: "Legacy (gender unrecorded)", count: unspecifiedGenderCount }]
                        : []),
                    ].map((item) => {
                      const pct = guests.length ? Math.round((item.count / guests.length) * 100) : 0;
                      return (
                        <div key={item.label} className="space-y-1">
                          <div className="flex justify-between">
                            <span className="font-medium text-foreground">{item.label}</span>
                            <span className="font-mono-code text-muted-foreground">
                              {item.count} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-border pt-4">
                    <h3 className="mb-2.5 text-xs font-semibold text-muted-foreground">
                      Age group distribution
                    </h3>
                    <div className="space-y-2 text-xs">
                      {(Object.keys(AGE_GROUP_LABELS) as AgeGroup[]).map((ag) => (
                        <div key={ag} className="flex items-center justify-between">
                          <span className="text-foreground">{AGE_GROUP_LABELS[ag]}</span>
                          <span className="rounded bg-secondary px-2 py-0.5 font-mono-code font-semibold">
                            {ageStats[ag]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Parishes & Delegations Represented */}
                <div className="surface-card space-y-4 p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-foreground">Parishes & origins</h2>
                    <Church size={18} className="text-accent" aria-hidden="true" />
                  </div>
                  {churchRankings.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No parish data yet.</p>
                  ) : (
                    <ul className="divide-y divide-border text-xs">
                      {churchRankings.map(([label, count]) => (
                        <li key={label} className="flex items-center justify-between py-2.5">
                          <span className="truncate pr-3 font-medium text-foreground">{label}</span>
                          <span className="shrink-0 rounded-full bg-accent/12 px-2.5 py-0.5 font-mono-code font-semibold text-accent">
                            {count}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Pastoral Follow-up & Special Welfare */}
                <div className="surface-card space-y-4 p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-foreground">Pastoral & welfare care</h2>
                    <Sparkle size={18} className="text-warm" weight="fill" aria-hidden="true" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    First-time visitors, visiting guests, and attendees with medical or dietary notes.
                  </p>

                  {pastoralFollowUps.length === 0 ? (
                    <div className="rounded-xl bg-secondary/50 p-4 text-xs text-muted-foreground">
                      No visitors or special welfare notes recorded yet.
                    </div>
                  ) : (
                    <ul className="divide-y divide-border text-xs">
                      {pastoralFollowUps.slice(0, 6).map((g) => (
                        <li key={g.id} className="py-2.5">
                          <Link
                            to="/guests/$id"
                            params={{ id: g.id }}
                            className="font-semibold text-foreground no-underline hover:text-accent"
                          >
                            {formatFullName(g)} ({g.reg_code})
                          </Link>
                          <div className="mt-0.5 text-muted-foreground">
                            {MINISTRY_ROLE_LABELS[g.ministry_role]}
                            {g.dietary_medical ? ` · Note: ${g.dietary_medical}` : ""}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EVENTS & SANCTUARY SETTINGS */}
          {activeTab === "events" && (
            <div className="fade-in grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="surface-card p-6 lg:col-span-7">
                <h2 className="mb-1 text-base font-bold text-foreground">
                  Configure "{selected.name}" ({selected.code})
                </h2>
                <p className="mb-5 text-xs text-muted-foreground">
                  Update total days, sanctuary venue, capacity target, or dormitory settings.
                </p>

                <form onSubmit={handleSaveEventConfig} className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Event name
                      </label>
                      <input
                        required
                        value={eventConfig.name}
                        onChange={(e) => setEventConfig({ ...eventConfig, name: e.target.value })}
                        className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">Year</label>
                      <input
                        type="number"
                        value={eventConfig.year}
                        onChange={(e) =>
                          setEventConfig({ ...eventConfig, year: Number(e.target.value) })
                        }
                        className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 font-mono-code text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Category
                      </label>
                      <select
                        value={eventConfig.category}
                        onChange={(e) =>
                          setEventConfig({
                            ...eventConfig,
                            category: e.target.value as EventCategory,
                          })
                        }
                        className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm"
                      >
                        {Object.entries(EVENT_CATEGORY_LABELS).map(([k, lbl]) => (
                          <option key={k} value={k}>
                            {lbl}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Total days
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={14}
                        value={eventConfig.total_days}
                        onChange={(e) =>
                          setEventConfig({ ...eventConfig, total_days: Number(e.target.value) })
                        }
                        className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 font-mono-code text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-foreground">
                        Target capacity
                      </label>
                      <input
                        type="number"
                        min={10}
                        value={eventConfig.capacity}
                        onChange={(e) =>
                          setEventConfig({ ...eventConfig, capacity: Number(e.target.value) })
                        }
                        className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 font-mono-code text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-foreground">
                      Venue / Sanctuary location
                    </label>
                    <input
                      value={eventConfig.venue}
                      onChange={(e) => setEventConfig({ ...eventConfig, venue: e.target.value })}
                      className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-foreground">
                      Theme / Scripture subtitle
                    </label>
                    <input
                      value={eventConfig.subtitle}
                      onChange={(e) => setEventConfig({ ...eventConfig, subtitle: e.target.value })}
                      className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm"
                    />
                  </div>

                  <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-secondary/50 px-3.5 py-2.5 text-xs font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={eventConfig.camping_enabled}
                      onChange={(e) =>
                        setEventConfig({ ...eventConfig, camping_enabled: e.target.checked })
                      }
                      className="h-4 w-4 accent-primary"
                    />
                    <span>Enable camping & dormitory assignments</span>
                  </label>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={savingEvent}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-95 disabled:opacity-50"
                    >
                      <FloppyDisk size={15} aria-hidden="true" />
                      {savingEvent ? "Saving…" : "Save event settings"}
                    </button>
                  </div>
                </form>
              </div>

              {/* All Church Events List + Data Hygiene */}
              <div className="space-y-5 lg:col-span-5">
                <div className="surface-card p-6">
                  <h2 className="mb-3 text-base font-bold text-foreground">All church events</h2>
                  <div className="space-y-2">
                    {events.map((ev) => {
                      const isCurrent = ev.id === selected.id;
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => select(ev.id)}
                          className={`flex w-full cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-left text-xs ${
                            isCurrent
                              ? "border-primary bg-primary/8 font-semibold text-foreground"
                              : "border-border bg-secondary/40 text-foreground hover:bg-secondary"
                          }`}
                        >
                          <div>
                            <span className="block text-sm font-semibold">{ev.name}</span>
                            <span className="text-muted-foreground">
                              {EVENT_CATEGORY_LABELS[ev.category] || "Event"} · {ev.total_days || 3} days
                            </span>
                          </div>
                          <span className="font-mono-code font-semibold text-accent">{ev.code}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="surface-card space-y-3 p-6">
                  <h2 className="text-base font-bold text-foreground">UUID & data integrity</h2>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Earlier versions created multiple rows when one person attended multiple days. Run consolidation to merge identical attendees into a single canonical UUID record with combined <code className="font-mono-code">days_registered</code>.
                  </p>
                  <button
                    type="button"
                    disabled={merging}
                    onClick={handleConsolidateDuplicates}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-secondary px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                  >
                    <ArrowsMerge size={15} className="text-accent" aria-hidden="true" />
                    {merging ? "Scanning…" : "Verify & merge duplicate multi-day rows"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT LOG */}
          {activeTab === "audit" && (
            <div className="fade-in surface-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="text-base font-bold text-foreground">Complete audit trail</h2>
                <span className="font-mono-code text-xs text-muted-foreground">
                  {edits.length} actions
                </span>
              </div>

              {edits.length === 0 ? (
                <div className="p-12 text-center text-xs text-muted-foreground">
                  No audit events logged yet for this church event.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-secondary/60 text-muted-foreground">
                        <th className="px-5 py-3 font-semibold">Registrar</th>
                        <th className="px-5 py-3 font-semibold">Action</th>
                        <th className="px-5 py-3 font-semibold">Attendee</th>
                        <th className="px-5 py-3 font-semibold">Summary</th>
                        <th className="px-5 py-3 font-semibold">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {edits.map((e) => {
                        const who = e.edited_by
                          ? profiles[e.edited_by]?.display_name ?? "Registrar"
                          : "System";
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
