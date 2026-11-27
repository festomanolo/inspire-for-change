import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { openEventStudio, useEvents } from "@/hooks/use-events";
import { useAuth } from "@/hooks/use-auth";
import { consolidateEventDuplicates } from "@/lib/json-storage";
import {
  AGE_GROUP_LABELS,
  EVENT_CATEGORY_LABELS,
  EVENT_STATUS_LABELS,
  MINISTRY_ROLE_LABELS,
  formatFullName,
  type AgeGroup,
  type EventCategory,
  type EventStatus,
  type Guest,
  type GuestEdit,
  type Profile,
} from "@/lib/types";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  ArrowsMerge,
  CalendarBlank,
  CalendarPlus,
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
    organizer: "",
    code: "",
    year: 2026,
    category: "conference" as EventCategory,
    status: "active" as EventStatus,
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
      organizer: selected.organizer || "",
      code: selected.code || "",
      year: selected.year,
      category: selected.category || "conference",
      status: selected.status || "active",
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
        organizer: eventConfig.organizer.trim() || null,
        code: eventConfig.code.trim().toUpperCase() || selected.code,
        year: eventConfig.year,
        category: eventConfig.category,
        status: eventConfig.status,
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
            <span>{selected.organizer || "Event operations & governance"}</span>
          </div>
          <h1 className="mt-1">{selected.name} administration</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openEventStudio({ mode: "create" })}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            <CalendarPlus size={15} weight="bold" aria-hidden="true" />
            New event
          </button>
          <Link
            to="/manager"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground no-underline hover:bg-secondary"
          >
            <ChartBar size={15} className="text-accent" aria-hidden="true" />
            Manager dashboard
          </Link>
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
                          <tr key={e.id} className="hover:bg-secondary/30">
                            <td className="px-5 py-3 font-semibold text-foreground">{who}</td>
                            <td className="px-5 py-3">
                              <span
                                className={`inline-block rounded-full px-2.5 py-0.5 font-semibold capitalize ${
                                  e.action === "create"
                                    ? "bg-success/12 text-success"
                                    : e.action === "check_in"
                                      ? "bg-accent/12 text-accent"
                                      : e.action === "delete"
                                        ? "bg-destructive/12 text-destructive"
                                        : "bg-secondary text-foreground"
                                }`}
                              >
                                {e.action.replace("_", " ")}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              {e.guest ? (
                                <Link
                                  to="/guests/$id"
                                  params={{ id: e.guest.id }}
                                  className="font-semibold text-accent no-underline hover:underline"
                                >
                                  {formatFullName(e.guest)} ({e.guest.reg_code})
                                </Link>
                              ) : (
                                <span className="text-muted-foreground">
                                  {(e.changes as any)?.deleted_guest || "—"}
                                </span>
                              )}
                            </td>
                            <td className="max-w-xs truncate px-5 py-3 font-mono-code text-muted-foreground">
                              {JSON.stringify(e.changes)}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                              {format(new Date(e.edited_at), "MMM d, HH:mm")} (
                              {formatDistanceToNow(new Date(e.edited_at), { addSuffix: true })})
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: REGISTRAR TEAM */}
          {activeTab === "team" && (
            <div className="fade-in surface-card p-6">
              <h2 className="mb-1 text-base font-bold text-foreground">Registrar & usher activity</h2>
              <p className="mb-5 text-xs text-muted-foreground">
                Registrations, gate check-ins, and record updates handled per team member.
              </p>

              {staffStats.length === 0 ? (
                <p className="text-xs text-muted-foreground">No staff actions recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {staffStats.map(([id, s], idx) => {
                    const totalActions = s.creates + s.checkIns + s.updates;
                    const topTotal =
                      staffStats[0][1].creates +
                      staffStats[0][1].checkIns +
                      staffStats[0][1].updates;
                    const pct = topTotal > 0 ? Math.round((totalActions / topTotal) * 100) : 100;

                    return (
                      <div
                        key={id}
                        className="rounded-xl border border-border bg-secondary/40 p-4"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-mono-code text-xs font-bold text-primary-foreground">
                              {s.name.slice(0, 2).toUpperCase()}
                            </span>
                            <div>
                              <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                <span>{s.name}</span>
                                {idx === 0 && (
                                  <Medal size={15} className="text-warm" weight="fill" aria-hidden="true" />
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {s.creates} registered · {s.checkIns} gate check-ins · {s.updates} edits
                              </div>
                            </div>
                          </div>
                          <span className="font-mono-code text-lg font-bold text-accent">
                            {totalActions}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-border">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
