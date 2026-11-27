import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { openEventStudio, useEvents } from "@/hooks/use-events";
import { useAuth } from "@/hooks/use-auth";
import { consolidateEventDuplicates } from "@/lib/json-storage";
import { exportAllDataToCSV, exportGuestsToCSV } from "@/lib/csv-export";
import {
  AGE_GROUP_LABELS,
  EVENT_CATEGORY_LABELS,
  EVENT_STATUS_LABELS,
  GENDER_LABELS,
  MINISTRY_ROLE_LABELS,
  STAFF_ROLE_LABELS,
  formatFullName,
  isCheckedInForDay,
  type AgeGroup,
  type EventCategory,
  type EventRow,
  type EventStatus,
  type Guest,
  type GuestEdit,
  type MinistryRole,
  type Profile,
  type StaffRole,
} from "@/lib/types";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowsMerge,
  ArrowUpRight,
  Buildings,
  CalendarBlank,
  CalendarPlus,
  Campfire,
  ChartBar,
  CheckCircle,
  Church,
  ClockCounterClockwise,
  Copy,
  DownloadSimple,
  MagnifyingGlass,
  MapPin,
  Medal,
  PencilSimple,
  Plus,
  QrCode,
  ShieldCheck,
  Sparkle,
  Trash,
  TrendUp,
  UserPlus,
  UsersThree,
} from "@phosphor-icons/react";

export const Route = createFileRoute("/_authenticated/manager")({
  head: () => ({ meta: [{ title: "Manager Dashboard — Multi-Event Operations" }] }),
  component: ManagerDashboardPage,
});

type ManagerTab = "portfolio" | "events" | "analytics" | "governance";

const QUICK_LAUNCH_CATEGORIES: { label: string; category: EventCategory }[] = [
  { label: "+ Conference", category: "conference" },
  { label: "+ Youth Camp", category: "camp" },
  { label: "+ Seminar / Workshop", category: "seminar_workshop" },
  { label: "+ Outreach / Crusade", category: "crusade" },
  { label: "+ Community / Gala", category: "community_gala" },
];

function statusBadgeClass(status: EventStatus): string {
  if (status === "active") return "bg-success/12 text-success border-success/25";
  if (status === "upcoming") return "bg-accent/12 text-accent border-accent/25";
  if (status === "completed") return "bg-warm/12 text-warm border-warm/25";
  return "bg-secondary text-muted-foreground border-border";
}

function ManagerDashboardPage() {
  const { events, selected, select, updateEvent, duplicateEvent, deleteEvent } = useEvents();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [allGuests, setAllGuests] = useState<Guest[]>([]);
  const [allEdits, setAllEdits] = useState<(GuestEdit & { guest?: Guest | null })[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<ManagerTab>("portfolio");
  const [eventSearch, setEventSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EventStatus | "all">("all");
  const [auditActionFilter, setAuditActionFilter] = useState<string>("all");
  const [auditEventFilter, setAuditEventFilter] = useState<string>("all");
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<EventRow | null>(null);
  const [merging, setMerging] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  const loadPortfolioData = async () => {
    const [guestsRes, editsRes, profilesRes] = await Promise.all([
      supabase.from("guests").select("*"),
      supabase
        .from("guest_edits")
        .select("*, guest:guests(*)")
        .order("edited_at", { ascending: false })
        .limit(200),
      supabase.from("profiles").select("*"),
    ]);

    setAllGuests((guestsRes.data as unknown as Guest[]) ?? []);
    setAllEdits((editsRes.data as unknown as (GuestEdit & { guest?: Guest | null })[]) ?? []);
    setProfiles((profilesRes.data as unknown as Profile[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadPortfolioData();

    const ch = supabase
      .channel("manager-portfolio-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, loadPortfolioData)
      .on("postgres_changes", { event: "*", schema: "public", table: "guests" }, loadPortfolioData)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "guest_edits" },
        loadPortfolioData,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        loadPortfolioData,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const profileMap = useMemo(() => {
    const map: Record<string, Profile> = {};
    profiles.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [profiles]);

  const eventMap = useMemo(() => {
    const map: Record<string, EventRow> = {};
    events.forEach((e) => {
      map[e.id] = e;
    });
    return map;
  }, [events]);

  // Per-event aggregated metrics across the whole portfolio
  const eventMetrics = useMemo(() => {
    const byEvent = new Map<
      string,
      {
        registered: number;
        arrived: number;
        campers: number;
        visitors: number;
        male: number;
        female: number;
      }
    >();

    events.forEach((ev) => {
      byEvent.set(ev.id, {
        registered: 0,
        arrived: 0,
        campers: 0,
        visitors: 0,
        male: 0,
        female: 0,
      });
    });

    allGuests.forEach((g) => {
      const m = byEvent.get(g.event_id) ?? {
        registered: 0,
        arrived: 0,
        campers: 0,
        visitors: 0,
        male: 0,
        female: 0,
      };
      m.registered += 1;
      if (Object.keys(g.check_ins ?? {}).length > 0) m.arrived += 1;
      if (g.status === "camping") m.campers += 1;
      if (g.ministry_role === "first_timer" || g.ministry_role === "visitor") m.visitors += 1;
      if (g.gender === "male") m.male += 1;
      if (g.gender === "female") m.female += 1;
      byEvent.set(g.event_id, m);
    });

    return byEvent;
  }, [events, allGuests]);

  // Portfolio-wide executive KPIs
  const portfolioSummary = useMemo(() => {
    const totalEvents = events.length;
    const activeCount = events.filter((e) => e.status === "active").length;
    const upcomingCount = events.filter((e) => e.status === "upcoming").length;
    const uniqueOrganizers = new Set(
      events.map((e) => (e.organizer || "General / Sanctuary").trim().toLowerCase()),
    ).size;

    const totalRegistered = allGuests.length;
    const totalCapacity = events.reduce((sum, e) => sum + (e.capacity || 500), 0);
    const totalArrived = allGuests.filter((g) => Object.keys(g.check_ins ?? {}).length > 0).length;
    const arrivalRate =
      totalRegistered > 0 ? Math.round((totalArrived / totalRegistered) * 100) : 0;
    const totalCampers = allGuests.filter((g) => g.status === "camping").length;
    const totalVisitors = allGuests.filter(
      (g) => g.ministry_role === "first_timer" || g.ministry_role === "visitor",
    ).length;

    return {
      totalEvents,
      activeCount,
      upcomingCount,
      uniqueOrganizers,
      totalRegistered,
      totalCapacity,
      totalArrived,
      arrivalRate,
      totalCampers,
      totalVisitors,
    };
  }, [events, allGuests]);

  // Chart data: cross-event comparison
  const crossEventChartData = useMemo(
    () =>
      events.slice(0, 8).map((ev) => {
        const m = eventMetrics.get(ev.id);
        return {
          code: ev.code,
          name: ev.name,
          Registered: m?.registered ?? 0,
          Arrived: m?.arrived ?? 0,
          Campers: m?.campers ?? 0,
        };
      }),
    [events, eventMetrics],
  );

  // Selected event guests & deep analytics
  const selectedGuests = useMemo(
    () => (selected ? allGuests.filter((g) => g.event_id === selected.id) : []),
    [allGuests, selected],
  );

  const selectedDailyChartData = useMemo(() => {
    if (!selected) return [];
    const days = selected.total_days || 3;
    return Array.from({ length: days }, (_, i) => {
      const dayNum = i + 1;
      const registered = selectedGuests.filter(
        (g) => g.days_registered?.includes(dayNum) || g.day === dayNum,
      ).length;
      const arrived = selectedGuests.filter((g) => isCheckedInForDay(g, dayNum)).length;
      return {
        day: `Day ${dayNum}`,
        Registered: registered,
        "Checked in": arrived,
      };
    });
  }, [selected, selectedGuests]);

  const selectedAnalytics = useMemo(() => {
    const ageCounts: Record<AgeGroup, number> = {
      child: 0,
      youth: 0,
      young_adult: 0,
      adult: 0,
      elder: 0,
    };
    const roleCounts = new Map<MinistryRole, number>();
    const dormZones = new Map<string, number>();
    const origins = new Map<string, number>();

    selectedGuests.forEach((g) => {
      const ag = g.age_group || "adult";
      if (ageCounts[ag] !== undefined) ageCounts[ag] += 1;

      const role = g.ministry_role || "member";
      roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);

      if (g.status === "camping") {
        const zone = (g.accommodation_zone || "General Campgrounds").trim();
        dormZones.set(zone, (dormZones.get(zone) ?? 0) + 1);
      }

      const orgLabel = (g.church_name || g.origin || "Unspecified").trim();
      origins.set(orgLabel, (origins.get(orgLabel) ?? 0) + 1);
    });

    return {
      male: selectedGuests.filter((g) => g.gender === "male").length,
      female: selectedGuests.filter((g) => g.gender === "female").length,
      unspecified: selectedGuests.filter((g) => g.gender === "unspecified").length,
      ageCounts,
      roles: Array.from(roleCounts.entries()).sort((a, b) => b[1] - a[1]),
      dormZones: Array.from(dormZones.entries()).sort((a, b) => b[1] - a[1]),
      topOrigins: Array.from(origins.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7),
    };
  }, [selectedGuests]);

  // Filtered events list for Events Registry tab
  const filteredEvents = useMemo(() => {
    let list = events;
    if (statusFilter !== "all") {
      list = list.filter((e) => (e.status || "active") === statusFilter);
    }
    const q = eventSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((e) =>
        [e.name, e.code, e.organizer, e.venue, e.subtitle, String(e.year)]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    return list;
  }, [events, statusFilter, eventSearch]);

  // Staff leaderboard + all registered profiles
  const staffDirectory = useMemo(() => {
    const counts: Record<string, { creates: number; checkIns: number; updates: number }> = {};
    allEdits.forEach((e) => {
      const uid = e.edited_by ?? "system";
      if (!counts[uid]) counts[uid] = { creates: 0, checkIns: 0, updates: 0 };
      if (e.action === "create") counts[uid].creates += 1;
      else if (e.action === "check_in") counts[uid].checkIns += 1;
      else counts[uid].updates += 1;
    });

    return profiles
      .map((p) => {
        const c = counts[p.id] ?? { creates: 0, checkIns: 0, updates: 0 };
        return {
          profile: p,
          ...c,
          total: c.creates + c.checkIns + c.updates,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [profiles, allEdits]);

  // Watchlist: Pastors/VIPs, First-timers, Medical/Dietary notes
  const careWatchlist = useMemo(() => {
    const source = auditEventFilter === "all" ? allGuests : selectedGuests;
    return source
      .filter(
        (g) =>
          g.ministry_role === "pastor" ||
          g.ministry_role === "leader" ||
          g.ministry_role === "first_timer" ||
          Boolean(g.dietary_medical),
      )
      .slice(0, 12);
  }, [allGuests, selectedGuests, auditEventFilter]);

  // Filtered Audit Trail
  const filteredAudits = useMemo(() => {
    return allEdits.filter((e) => {
      if (auditEventFilter !== "all") {
        const evId = e.event_id || e.guest?.event_id;
        if (evId !== auditEventFilter) return false;
      }
      if (auditActionFilter !== "all" && e.action !== auditActionFilter) return false;
      return true;
    });
  }, [allEdits, auditEventFilter, auditActionFilter]);

  const handleActivateWorkspace = (ev: EventRow, destination?: "/" | "/register" | "/checkin") => {
    select(ev.id);
    toast.success(`Active workspace switched to "${ev.name}" (${ev.code})`);
    if (destination) {
      navigate({ to: destination });
    }
  };

  const handleQuickStatusChange = async (ev: EventRow, nextStatus: EventStatus) => {
    try {
      await updateEvent(ev.id, { status: nextStatus });
      toast.success(`Marked "${ev.name}" as ${EVENT_STATUS_LABELS[nextStatus]}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not update event status");
    }
  };

  const handleDuplicate = async (ev: EventRow) => {
    try {
      const cloned = await duplicateEvent(ev);
      toast.success(`Cloned event as "${cloned.name}" (${cloned.code})`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not duplicate event");
    }
  };

  const handleConfirmDeleteEvent = async () => {
    if (!confirmDeleteEvent) return;
    const target = confirmDeleteEvent;
    setConfirmDeleteEvent(null);
    try {
      await deleteEvent(target.id);
      await loadPortfolioData();
      toast.success(`Deleted event "${target.name}"`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not delete event");
    }
  };

  const handleRoleUpdate = async (staff: Profile, nextRole: StaffRole) => {
    setUpdatingRoleId(staff.id);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: nextRole })
        .eq("id", staff.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      await loadPortfolioData();
      toast.success(`Updated ${staff.display_name} to ${STAFF_ROLE_LABELS[nextRole]}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not update staff role");
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleConsolidate = async () => {
    if (!selected) return;
    setMerging(true);
    try {
      const res = await consolidateEventDuplicates(selected.id, user?.id);
      if (res.mergedCount > 0) {
        toast.success(`Consolidated ${res.mergedCount} duplicate record(s) in ${selected.name}`);
      } else {
        toast.info(`All ${selected.name} attendee UUIDs are already unique`);
      }
      await loadPortfolioData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Consolidation failed");
    } finally {
      setMerging(false);
    }
  };

  const handleExportPortfolio = async () => {
    try {
      await exportAllDataToCSV();
      toast.success("Exported multi-event portfolio & audit CSVs");
    } catch {
      toast.error("Could not export portfolio archive");
    }
  };

  return (
    <div className="space-y-6">
      {/* Executive Command Header */}
      <section className="bezel-shell slide-up">
        <div className="bezel-core space-y-6 p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-semibold text-foreground">
                <ChartBar size={14} className="text-accent" weight="fill" aria-hidden="true" />
                <span>Multi-Event Manager Command</span>
              </div>
              <h1 className="text-foreground">Manager dashboard</h1>
              <p className="max-w-[64ch] text-sm text-muted-foreground">
                Create, launch, and oversee conferences, camps, seminars, crusades, and partner
                organization events from one unified operations hub.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                id="manager-create-event-btn"
                type="button"
                onClick={() => openEventStudio({ mode: "create" })}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs hover:opacity-95"
              >
                <CalendarPlus size={17} weight="bold" aria-hidden="true" />
                <span>Create new event</span>
              </button>

              <button
                type="button"
                onClick={handleExportPortfolio}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-secondary px-4 py-2.5 text-xs font-semibold text-secondary-foreground hover:bg-muted"
              >
                <DownloadSimple size={16} className="text-accent" aria-hidden="true" />
                <span>Export all CSVs</span>
              </button>
            </div>
          </div>

          {/* 4 Executive Portfolio KPIs */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Events portfolio</span>
                <CalendarBlank size={15} className="text-accent" aria-hidden="true" />
              </div>
              <div className="mt-1.5 font-mono-code text-3xl font-extrabold text-foreground">
                {portfolioSummary.totalEvents}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {portfolioSummary.activeCount} active · {portfolioSummary.upcomingCount} upcoming ·{" "}
                {portfolioSummary.uniqueOrganizers} host
                {portfolioSummary.uniqueOrganizers === 1 ? "" : "s"}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Total registrations</span>
                <UsersThree size={15} className="text-accent" aria-hidden="true" />
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="font-mono-code text-3xl font-extrabold text-foreground">
                  {portfolioSummary.totalRegistered}
                </span>
                <span className="font-mono-code text-xs text-muted-foreground">
                  / {portfolioSummary.totalCapacity} cap
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Canonical UUID passes across all events
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Verified gate arrivals</span>
                <CheckCircle size={15} className="text-success" weight="fill" aria-hidden="true" />
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="font-mono-code text-3xl font-extrabold text-foreground">
                  {portfolioSummary.totalArrived}
                </span>
                <span className="rounded-full bg-success/12 px-2 py-0.5 font-mono-code text-xs font-semibold text-success">
                  {portfolioSummary.arrivalRate}% rate
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Checked in at least one session day
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Hospitality & visitors</span>
                <Campfire size={15} className="text-warm" weight="duotone" aria-hidden="true" />
              </div>
              <div className="mt-1.5 font-mono-code text-3xl font-extrabold text-foreground">
                {portfolioSummary.totalCampers}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                On-site campers · {portfolioSummary.totalVisitors} guests & first-timers
              </p>
            </div>
          </div>

          {/* Quick-Launch Any Event Bar ("not only Inspire for Change") */}
          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-secondary/50 px-4 py-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-xs">
              <Buildings size={16} className="shrink-0 text-accent" aria-hidden="true" />
              <span className="font-medium text-foreground">
                Launch a standalone event for any host ministry, department, seminar, or community
                brand:
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_LAUNCH_CATEGORIES.map((item) => (
                <button
                  key={item.category}
                  type="button"
                  onClick={() => openEventStudio({ mode: "create", presetCategory: item.category })}
                  className="cursor-pointer rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground hover:border-accent/50 hover:bg-secondary"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Manager Workspace Tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-border bg-card p-1.5 w-fit">
        {(
          [
            { id: "portfolio", label: "Portfolio overview", Icon: TrendUp },
            { id: "events", label: `All events (${events.length})`, Icon: CalendarBlank },
            { id: "analytics", label: "Event deep-dive", Icon: ChartBar },
            { id: "governance", label: `Team & audit (${profiles.length})`, Icon: ShieldCheck },
          ] as const
        ).map((tab) => {
          const Icon = tab.Icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`manager-tab-${tab.id}`}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold ${
                active
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon size={15} weight={active ? "fill" : "regular"} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-52 animate-pulse rounded-2xl bg-secondary" />
          ))}
        </div>
      ) : (
        <>
          {/* TAB 1: PORTFOLIO OVERVIEW */}
          {activeTab === "portfolio" && (
            <div className="fade-in space-y-6">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                {/* Cross-Event Comparison BarChart */}
                <div className="surface-card flex flex-col justify-between p-6 lg:col-span-7">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-bold text-foreground">
                        Cross-event registration vs gate arrival
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Side-by-side headcount comparison across active & scheduled events
                      </p>
                    </div>
                    <span className="font-mono-code text-xs text-muted-foreground">
                      {events.length} event{events.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={crossEventChartData}
                        margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--color-border)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="code"
                          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                          axisLine={{ stroke: "var(--color-border)" }}
                          tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--color-card)",
                            borderColor: "var(--color-border)",
                            borderRadius: "12px",
                            fontSize: "12px",
                          }}
                        />
                        <Bar
                          dataKey="Registered"
                          fill="var(--color-primary)"
                          radius={[6, 6, 0, 0]}
                        />
                        <Bar dataKey="Arrived" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="Campers" fill="var(--color-warm)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Active Workspace Quick Desk */}
                <div className="surface-card flex flex-col justify-between p-6 lg:col-span-5">
                  {selected ? (
                    <>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded-md bg-primary px-2.5 py-1 font-mono-code text-xs font-semibold text-primary-foreground">
                            ACTIVE WORKSPACE · {selected.code}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadgeClass(selected.status || "active")}`}
                          >
                            {EVENT_STATUS_LABELS[selected.status || "active"]}
                          </span>
                        </div>

                        <div>
                          {selected.organizer && (
                            <p className="text-xs font-semibold text-accent">
                              {selected.organizer}
                            </p>
                          )}
                          <h2 className="mt-0.5 text-xl font-bold text-foreground">
                            {selected.name}
                          </h2>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {EVENT_CATEGORY_LABELS[selected.category] || "Event"} ·{" "}
                            {selected.total_days || 3} day
                            {(selected.total_days || 3) > 1 ? "s" : ""}
                            {selected.venue ? ` · ${selected.venue}` : ""}
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-secondary/45 p-3 text-center">
                          <div>
                            <span className="block font-mono-code text-lg font-bold text-foreground">
                              {eventMetrics.get(selected.id)?.registered ?? 0}
                            </span>
                            <span className="text-[11px] text-muted-foreground">Registered</span>
                          </div>
                          <div>
                            <span className="block font-mono-code text-lg font-bold text-success">
                              {eventMetrics.get(selected.id)?.arrived ?? 0}
                            </span>
                            <span className="text-[11px] text-muted-foreground">Checked in</span>
                          </div>
                          <div>
                            <span className="block font-mono-code text-lg font-bold text-warm">
                              {eventMetrics.get(selected.id)?.campers ?? 0}
                            </span>
                            <span className="text-[11px] text-muted-foreground">Campers</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-2 pt-3 border-t border-border">
                        <Link
                          to="/register"
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground no-underline hover:opacity-95"
                        >
                          <UserPlus size={14} weight="bold" aria-hidden="true" />
                          Register desk
                        </Link>
                        <Link
                          to="/checkin"
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-2.5 text-xs font-semibold text-foreground no-underline hover:bg-muted"
                        >
                          <QrCode size={14} className="text-accent" aria-hidden="true" />
                          Gate check-in
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEventStudio({ mode: "edit", event: selected })}
                          className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
                        >
                          <PencilSimple size={14} aria-hidden="true" />
                          Edit settings
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveTab("analytics")}
                          className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
                        >
                          <ChartBar size={14} className="text-accent" aria-hidden="true" />
                          Deep analytics
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="py-12 text-center text-xs text-muted-foreground">
                      Select or create an event to manage.
                    </div>
                  )}
                </div>
              </div>

              {/* Event Portfolio Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-foreground">Managed events portfolio</h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab("events")}
                    className="cursor-pointer text-xs font-semibold text-accent hover:underline"
                  >
                    Open full events registry →
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {events.map((ev) => {
                    const m = eventMetrics.get(ev.id) ?? {
                      registered: 0,
                      arrived: 0,
                      campers: 0,
                      visitors: 0,
                      male: 0,
                      female: 0,
                    };
                    const cap = ev.capacity || 500;
                    const utilPct = Math.min(
                      100,
                      Math.round((m.registered / Math.max(cap, 1)) * 100),
                    );
                    const isSelected = selected?.id === ev.id;

                    return (
                      <div
                        key={ev.id}
                        className={`surface-card flex flex-col justify-between p-5 ${
                          isSelected ? "ring-2 ring-primary" : ""
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="rounded-md bg-secondary px-2.5 py-1 font-mono-code text-xs font-semibold text-foreground">
                              {ev.code}
                            </span>
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadgeClass(ev.status || "active")}`}
                            >
                              {EVENT_STATUS_LABELS[ev.status || "active"]}
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
                              <Buildings size={13} aria-hidden="true" />
                              <span className="truncate">
                                {ev.organizer || "Sanctuary / Fellowship Event"}
                              </span>
                            </div>
                            <h3 className="mt-0.5 truncate text-base font-bold text-foreground">
                              {ev.name}
                            </h3>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {EVENT_CATEGORY_LABELS[ev.category] || "Event"} · {ev.year} ·{" "}
                              {ev.total_days}d{ev.camping_enabled ? " · Camping" : " · Day-only"}
                            </p>
                          </div>

                          <div>
                            <div className="mb-1 flex justify-between text-xs">
                              <span className="text-muted-foreground">Capacity utilization</span>
                              <span className="font-mono-code font-semibold text-foreground">
                                {m.registered}/{cap} ({utilPct}%)
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-secondary">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${utilPct}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                          <span className="font-mono-code text-xs text-muted-foreground">
                            {m.arrived} arrived
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEventStudio({ mode: "edit", event: ev })}
                              className="cursor-pointer rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-secondary"
                            >
                              Edit
                            </button>
                            {!isSelected ? (
                              <button
                                type="button"
                                onClick={() => handleActivateWorkspace(ev)}
                                className="cursor-pointer rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                              >
                                Switch to event
                              </button>
                            ) : (
                              <Link
                                to="/"
                                className="inline-flex items-center gap-1 rounded-lg bg-accent/14 px-2.5 py-1 text-xs font-semibold text-accent no-underline"
                              >
                                Active
                                <ArrowUpRight size={12} aria-hidden="true" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add Event Card */}
                  <button
                    type="button"
                    onClick={() => openEventStudio({ mode: "create" })}
                    className="flex min-h-[210px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card/50 p-6 text-center hover:border-accent hover:bg-secondary/40"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Plus size={22} weight="bold" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-bold text-foreground">Add another event</span>
                    <span className="max-w-[26ch] text-xs text-muted-foreground">
                      Set up a new conference, camp, seminar, outreach, or partner organization
                      event
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ALL EVENTS REGISTRY & LIFECYCLE */}
          {activeTab === "events" && (
            <div className="fade-in space-y-5">
              <div className="surface-card flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <MagnifyingGlass
                    size={16}
                    className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    placeholder="Search events by title, host organization, badge code, venue, or year…"
                    aria-label="Search events"
                    className="w-full rounded-xl border border-border bg-input py-2.5 pr-4 pl-10 text-sm text-foreground"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex rounded-xl bg-secondary p-1">
                    {(["all", "active", "upcoming", "completed", "archived"] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatusFilter(st)}
                        className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium capitalize ${
                          statusFilter === st
                            ? "bg-card font-semibold text-foreground shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => openEventStudio({ mode: "create" })}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    <CalendarPlus size={15} weight="bold" aria-hidden="true" />
                    New event
                  </button>
                </div>
              </div>

              <div className="surface-card overflow-hidden">
                {filteredEvents.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-sm font-semibold text-foreground">
                      No events match your filter
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Clear your search or launch a new event with the Event Studio.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredEvents.map((ev) => {
                      const m = eventMetrics.get(ev.id) ?? {
                        registered: 0,
                        arrived: 0,
                        campers: 0,
                        visitors: 0,
                        male: 0,
                        female: 0,
                      };
                      const isCurrent = selected?.id === ev.id;

                      return (
                        <div
                          key={ev.id}
                          className={`flex flex-col justify-between gap-4 p-5 lg:flex-row lg:items-center ${
                            isCurrent ? "bg-primary/[0.04]" : "hover:bg-secondary/30"
                          }`}
                        >
                          <div className="min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-secondary px-2 py-0.5 font-mono-code text-xs font-semibold text-foreground">
                                {ev.code}
                              </span>
                              {ev.organizer && (
                                <span className="inline-flex items-center gap-1 rounded-md border border-accent/25 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                                  <Buildings size={12} aria-hidden="true" />
                                  {ev.organizer}
                                </span>
                              )}
                              <span className="text-sm font-bold text-foreground">{ev.name}</span>
                              {isCurrent && (
                                <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                                  Active workspace
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span>{EVENT_CATEGORY_LABELS[ev.category] || "Event"}</span>
                              <span>·</span>
                              <span className="font-mono-code">
                                {ev.start_date
                                  ? `${ev.start_date}${ev.end_date ? ` → ${ev.end_date}` : ""}`
                                  : `Year ${ev.year}`}
                              </span>
                              <span>·</span>
                              <span>{ev.total_days} days</span>
                              {ev.venue && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin size={12} aria-hidden="true" />
                                  {ev.venue}
                                </span>
                              )}
                              <span>·</span>
                              <span className="font-mono-code font-semibold text-foreground">
                                {m.registered}/{ev.capacity || 500} registered ({m.arrived} arrived)
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              aria-label={`Lifecycle status for ${ev.name}`}
                              value={ev.status || "active"}
                              onChange={(e) =>
                                handleQuickStatusChange(ev, e.target.value as EventStatus)
                              }
                              className="cursor-pointer rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground"
                            >
                              {Object.entries(EVENT_STATUS_LABELS).map(([k, lbl]) => (
                                <option key={k} value={k}>
                                  {lbl}
                                </option>
                              ))}
                            </select>

                            {!isCurrent && (
                              <button
                                type="button"
                                onClick={() => handleActivateWorkspace(ev)}
                                className="cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                              >
                                Open workspace
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => openEventStudio({ mode: "edit", event: ev })}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
                            >
                              <PencilSimple size={13} aria-hidden="true" />
                              Configure
                            </button>

                            <button
                              type="button"
                              title="Duplicate event template"
                              onClick={() => handleDuplicate(ev)}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
                            >
                              <Copy size={13} aria-hidden="true" />
                              Clone
                            </button>

                            <button
                              type="button"
                              title="Export attendees CSV for this event"
                              onClick={() =>
                                exportGuestsToCSV(ev.id).then(() =>
                                  toast.success(`Exported CSV for ${ev.name}`),
                                )
                              }
                              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
                            >
                              <DownloadSimple size={13} aria-hidden="true" />
                              CSV
                            </button>

                            <button
                              type="button"
                              disabled={events.length <= 1}
                              title={
                                events.length <= 1
                                  ? "Cannot delete the only remaining event"
                                  : `Delete ${ev.name}`
                              }
                              onClick={() => setConfirmDeleteEvent(ev)}
                              className="cursor-pointer rounded-lg border border-destructive/25 bg-destructive/8 p-1.5 text-destructive hover:bg-destructive/15 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Trash size={14} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: EVENT DEEP-DIVE ANALYTICS */}
          {activeTab === "analytics" && selected && (
            <div className="fade-in space-y-6">
              {/* Inline Event Selector for Deep-Dive */}
              <div className="surface-card flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
                <div>
                  <span className="text-xs font-semibold text-accent">
                    {selected.organizer || "Inspecting event telemetry"}
                  </span>
                  <h2 className="text-base font-bold text-foreground">
                    {selected.name} ({selected.code}) — {selectedGuests.length} attendees
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Choose event for deep-dive analytics"
                    value={selected.id}
                    onChange={(e) => select(e.target.value)}
                    className="rounded-xl border border-border bg-secondary px-3.5 py-2 text-xs font-semibold text-foreground"
                  >
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name} ({ev.code})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => exportGuestsToCSV(selected.id)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
                  >
                    <DownloadSimple size={14} className="text-accent" aria-hidden="true" />
                    Export event CSV
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                {/* Daily Schedule BarChart */}
                <div className="surface-card p-6 lg:col-span-7">
                  <h3 className="text-base font-bold text-foreground">
                    Session-by-day attendance vs gate verification
                  </h3>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Expected registrations vs verified physical check-ins across{" "}
                    {selected.total_days || 3} days
                  </p>
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={selectedDailyChartData}
                        margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--color-border)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="day"
                          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                          axisLine={{ stroke: "var(--color-border)" }}
                          tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--color-card)",
                            borderColor: "var(--color-border)",
                            borderRadius: "12px",
                            fontSize: "12px",
                          }}
                        />
                        <Bar
                          dataKey="Registered"
                          fill="var(--color-primary)"
                          radius={[6, 6, 0, 0]}
                        />
                        <Bar
                          dataKey="Checked in"
                          fill="var(--color-success)"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gender & Age Breakdown */}
                <div className="surface-card space-y-4 p-6 lg:col-span-5">
                  <h3 className="text-base font-bold text-foreground">
                    Demographics & age brackets
                  </h3>
                  <div className="space-y-2.5 text-xs">
                    {[
                      { label: "Male", count: selectedAnalytics.male },
                      { label: "Female", count: selectedAnalytics.female },
                      ...(selectedAnalytics.unspecified > 0
                        ? [{ label: "Unrecorded", count: selectedAnalytics.unspecified }]
                        : []),
                    ].map((row) => {
                      const pct = selectedGuests.length
                        ? Math.round((row.count / selectedGuests.length) * 100)
                        : 0;
                      return (
                        <div key={row.label} className="space-y-1">
                          <div className="flex justify-between">
                            <span className="font-medium text-foreground">{row.label}</span>
                            <span className="font-mono-code text-muted-foreground">
                              {row.count} ({pct}%)
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

                  <div className="border-t border-border pt-3">
                    <span className="mb-2 block text-xs font-semibold text-muted-foreground">
                      Age distribution
                    </span>
                    <div className="space-y-1.5 text-xs">
                      {(Object.keys(AGE_GROUP_LABELS) as AgeGroup[]).map((ag) => (
                        <div key={ag} className="flex items-center justify-between">
                          <span className="text-foreground">{AGE_GROUP_LABELS[ag]}</span>
                          <span className="rounded bg-secondary px-2 py-0.5 font-mono-code font-semibold">
                            {selectedAnalytics.ageCounts[ag]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {/* Dormitory & Lodging Zones */}
                <div className="surface-card space-y-3 p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-foreground">
                      Dormitory & lodging zones
                    </h3>
                    <Campfire size={17} className="text-warm" weight="duotone" aria-hidden="true" />
                  </div>
                  {!selected.camping_enabled ? (
                    <p className="text-xs text-muted-foreground">
                      Day-only event (on-site camping is disabled for this program).
                    </p>
                  ) : selectedAnalytics.dormZones.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No campers assigned to dorm zones yet.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border text-xs">
                      {selectedAnalytics.dormZones.map(([zone, count]) => (
                        <li key={zone} className="flex items-center justify-between py-2.5">
                          <span className="font-medium text-foreground">{zone}</span>
                          <span className="rounded-full bg-warm/12 px-2.5 py-0.5 font-mono-code font-semibold text-warm">
                            {count}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Participant / Ministry Roles */}
                <div className="surface-card space-y-3 p-6">
                  <h3 className="text-base font-bold text-foreground">Participant roles</h3>
                  {selectedAnalytics.roles.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No registrations yet.</p>
                  ) : (
                    <ul className="divide-y divide-border text-xs">
                      {selectedAnalytics.roles.map(([role, count]) => (
                        <li key={role} className="flex items-center justify-between py-2.5">
                          <span className="font-medium text-foreground">
                            {MINISTRY_ROLE_LABELS[role] || role}
                          </span>
                          <span className="rounded-full bg-secondary px-2.5 py-0.5 font-mono-code font-semibold text-foreground">
                            {count}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Top Organizations / Parishes / Cities */}
                <div className="surface-card space-y-3 p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-foreground">Parishes, chapters & origins</h3>
                    <Church size={17} className="text-accent" aria-hidden="true" />
                  </div>
                  {selectedAnalytics.topOrigins.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No origin records yet.</p>
                  ) : (
                    <ul className="divide-y divide-border text-xs">
                      {selectedAnalytics.topOrigins.map(([name, count]) => (
                        <li key={name} className="flex items-center justify-between py-2.5">
                          <span className="truncate pr-3 font-medium text-foreground">{name}</span>
                          <span className="rounded-full bg-accent/12 px-2.5 py-0.5 font-mono-code font-semibold text-accent">
                            {count}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TEAM ROLES, CARE WATCHLIST & AUDIT GOVERNANCE */}
          {activeTab === "governance" && (
            <div className="fade-in space-y-6">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                {/* Staff & Role Governance */}
                <div className="surface-card space-y-4 p-6 lg:col-span-7">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-foreground">
                        Staff directory & role governance
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Assign manager, administrator, registrar, or gate usher roles across your team
                      </p>
                    </div>
                    <span className="font-mono-code text-xs text-muted-foreground">
                      {staffDirectory.length} staff
                    </span>
                  </div>

                  {staffDirectory.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No staff profiles found.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {staffDirectory.map((item, idx) => (
                        <div
                          key={item.profile.id}
                          className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-4 sm:flex-row sm:items-center"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-mono-code text-xs font-bold text-primary-foreground">
                              {item.profile.display_name.slice(0, 2).toUpperCase()}
                            </span>
                            <div>
                              <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                <span>{item.profile.display_name}</span>
                                {idx === 0 && item.total > 0 && (
                                  <Medal size={15} className="text-warm" weight="fill" aria-hidden="true" />
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {item.profile.email} · {item.creates} reg · {item.checkIns} check-ins ·{" "}
                                {item.updates} edits
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <select
                              aria-label={`Role for ${item.profile.display_name}`}
                              disabled={updatingRoleId === item.profile.id}
                              value={item.profile.role || "registrar"}
                              onChange={(e) =>
                                handleRoleUpdate(item.profile, e.target.value as StaffRole)
                              }
                              className="cursor-pointer rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground"
                            >
                              {Object.entries(STAFF_ROLE_LABELS).map(([roleKey, roleLbl]) => (
                                <option key={roleKey} value={roleKey}>
                                  {roleLbl}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {selected && (
                    <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center">
                      <div>
                        <span className="block text-xs font-semibold text-foreground">
                          Canonical UUID deduplication ({selected.name})
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Merge any legacy multi-row same-person entries into single multi-day records.
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={merging}
                        onClick={handleConsolidate}
                        className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-secondary px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                      >
                        <ArrowsMerge size={14} className="text-accent" aria-hidden="true" />
                        {merging ? "Scanning…" : "Verify & consolidate"}
                      </button>
                    </div>
                  )}
                </div>

                {/* VIP, First-Timer & Welfare Watchlist */}
                <div className="surface-card space-y-4 p-6 lg:col-span-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-foreground">
                        VIP, visitor & welfare care
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Clergy, leaders, first-time guests, and medical/dietary notes
                      </p>
                    </div>
                    <Sparkle size={18} className="text-warm" weight="fill" aria-hidden="true" />
                  </div>

                  {careWatchlist.length === 0 ? (
                    <div className="rounded-xl bg-secondary/45 p-5 text-xs text-muted-foreground">
                      No VIP, visitor, or special care flags recorded yet.
                    </div>
                  ) : (
                    <ul className="divide-y divide-border text-xs">
                      {careWatchlist.map((g) => {
                        const ev = eventMap[g.event_id];
                        return (
                          <li key={g.id} className="py-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <Link
                                to="/guests/$id"
                                params={{ id: g.id }}
                                className="font-semibold text-foreground no-underline hover:text-accent"
                              >
                                {formatFullName(g)} ({g.reg_code})
                              </Link>
                              {ev && (
                                <span className="font-mono-code text-[11px] text-muted-foreground">
                                  {ev.code}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-muted-foreground">
                              {MINISTRY_ROLE_LABELS[g.ministry_role]}
                              {g.dietary_medical ? ` · Care: ${g.dietary_medical}` : ""}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              {/* Cross-Event Filterable Audit Trail */}
              <div className="surface-card overflow-hidden">
                <div className="flex flex-col justify-between gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2">
                    <ClockCounterClockwise size={17} className="text-accent" aria-hidden="true" />
                    <h2 className="text-base font-bold text-foreground">
                      Cross-event operational audit trail
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label="Filter audit trail by event"
                      value={auditEventFilter}
                      onChange={(e) => setAuditEventFilter(e.target.value)}
                      className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground"
                    >
                      <option value="all">All events</option>
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.name} ({ev.code})
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label="Filter audit trail by action"
                      value={auditActionFilter}
                      onChange={(e) => setAuditActionFilter(e.target.value)}
                      className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground"
                    >
                      <option value="all">All actions</option>
                      <option value="create">Registrations</option>
                      <option value="check_in">Gate check-ins</option>
                      <option value="update">Profile edits</option>
                      <option value="delete">Deletions</option>
                      <option value="merge">UUID merges</option>
                    </select>
                  </div>
                </div>

                {filteredAudits.length === 0 ? (
                  <div className="p-10 text-center text-xs text-muted-foreground">
                    No matching audit records found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-border bg-secondary/60 text-muted-foreground">
                          <th className="px-5 py-3 font-semibold">Event</th>
                          <th className="px-5 py-3 font-semibold">Staff</th>
                          <th className="px-5 py-3 font-semibold">Action</th>
                          <th className="px-5 py-3 font-semibold">Attendee</th>
                          <th className="px-5 py-3 font-semibold">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredAudits.slice(0, 50).map((e) => {
                          const evId = e.event_id || e.guest?.event_id;
                          const ev = evId ? eventMap[evId] : null;
                          const actor = e.edited_by
                            ? profileMap[e.edited_by]?.display_name ?? "Registrar"
                            : "System";

                          return (
                            <tr key={e.id} className="hover:bg-secondary/30">
                              <td className="px-5 py-3 font-mono-code font-semibold text-foreground">
                                {ev?.code ?? "—"}
                              </td>
                              <td className="px-5 py-3 font-medium text-foreground">{actor}</td>
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
                                    {(e.changes as any)?.deleted_guest ||
                                      (e.changes as any)?.name ||
                                      "—"}
                                  </span>
                                )}
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
            </div>
          )}
        </>
      )}

      {/* Delete Event Confirmation Modal */}
      {confirmDeleteEvent && (
        <div
          className="no-print fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
          onClick={() => setConfirmDeleteEvent(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="del-event-title"
            className="bezel-shell scale-in w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bezel-core space-y-4 p-6">
              <h3 id="del-event-title" className="text-base font-bold text-foreground">
                Delete "{confirmDeleteEvent.name}"?
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                This will permanently remove the event{" "}
                <strong className="text-foreground">{confirmDeleteEvent.code}</strong> and its{" "}
                <strong className="font-mono-code text-foreground">
                  {eventMetrics.get(confirmDeleteEvent.id)?.registered ?? 0}
                </strong>{" "}
                registered attendee record(s). To preserve historical data without active desk clutter, mark the event as <strong>Archived</strong> instead.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteEvent(null)}
                  className="cursor-pointer rounded-full border border-border bg-secondary px-4 py-2 text-xs font-semibold text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteEvent}
                  className="cursor-pointer rounded-full bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground"
                >
                  Delete event permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
