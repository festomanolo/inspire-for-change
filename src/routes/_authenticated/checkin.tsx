import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEvents } from "@/hooks/use-events";
import { useAuth } from "@/hooks/use-auth";
import {
  GENDER_LABELS,
  MINISTRY_ROLE_LABELS,
  formatFullName,
  isCheckedInForDay,
  type Guest,
} from "@/lib/types";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Campfire,
  CheckCircle,
  Church,
  ClockCounterClockwise,
  MagnifyingGlass,
  QrCode,
  Sparkle,
  UserPlus,
} from "@phosphor-icons/react";

export const Route = createFileRoute("/_authenticated/checkin")({
  head: () => ({ meta: [{ title: "Gate Check-in — Inspired for Change" }] }),
  component: CheckInDeskPage,
});

type DeskFilter = "pending" | "checked_in" | "all" | "camping" | "first_timers";

function CheckInDeskPage() {
  const { selected } = useEvents();
  const { user } = useAuth();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState<number>(1);
  const [search, setSearch] = useState("");
  const [deskFilter, setDeskFilter] = useState<DeskFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadGuests = async () => {
    if (!selected) return;
    const { data } = await supabase
      .from("guests")
      .select("*")
      .eq("event_id", selected.id)
      .order("created_at", { ascending: false });
    setGuests((data as unknown as Guest[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    loadGuests();

    const ch = supabase
      .channel("checkin-" + selected.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "guests" }, () => {
        loadGuests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const totalDays = selected?.total_days || 3;
  const dayNumbers = Array.from({ length: totalDays }, (_, i) => i + 1);

  const expectedForDay = useMemo(
    () => guests.filter((g) => g.days_registered?.includes(activeDay) || g.day === activeDay),
    [guests, activeDay],
  );

  const checkedInCount = useMemo(
    () => guests.filter((g) => isCheckedInForDay(g, activeDay)).length,
    [guests, activeDay],
  );

  const filtered = useMemo(() => {
    let list = guests;
    if (deskFilter === "pending") {
      list = list.filter(
        (g) =>
          (g.days_registered?.includes(activeDay) || g.day === activeDay) &&
          !isCheckedInForDay(g, activeDay),
      );
    } else if (deskFilter === "checked_in") {
      list = list.filter((g) => isCheckedInForDay(g, activeDay));
    } else if (deskFilter === "camping") {
      list = list.filter((g) => g.status === "camping");
    } else if (deskFilter === "first_timers") {
      list = list.filter((g) => g.ministry_role === "first_timer" || g.ministry_role === "visitor");
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((g) =>
        [
          g.reg_code,
          g.id,
          g.first_name,
          g.middle_name,
          g.last_name,
          formatFullName(g),
          g.phone,
          g.church_name,
          g.origin,
        ]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(q)),
      );
    }

    return list;
  }, [guests, deskFilter, activeDay, search]);

  const toggleCheckIn = async (guest: Guest) => {
    if (!user) return;
    setBusyId(guest.id);
    const currentlyChecked = isCheckedInForDay(guest, activeDay);
    const nextCheckIns = { ...(guest.check_ins ?? {}) };
    const nextDays = new Set<number>(guest.days_registered ?? (guest.day ? [guest.day] : [1]));

    if (currentlyChecked) {
      delete nextCheckIns[String(activeDay)];
    } else {
      nextCheckIns[String(activeDay)] = new Date().toISOString();
      nextDays.add(activeDay);
    }

    const { error } = await supabase
      .from("guests")
      .update({
        check_ins: nextCheckIns as any,
        days_registered: Array.from(nextDays).sort((a, b) => a - b),
        updated_by: user.id,
      } as any)
      .eq("id", guest.id);

    setBusyId(null);

    if (error) {
      toast.error("Check-in failed. Please try again.");
      return;
    }

    if (!currentlyChecked) {
      toast.success(`Checked in ${formatFullName(guest)} (${guest.reg_code}) for Day ${activeDay}`);
    } else {
      toast.info(`Reverted Day ${activeDay} check-in for ${formatFullName(guest)}`);
    }
    await loadGuests();
  };

  const handleQuickEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && filtered.length === 1) {
      e.preventDefault();
      toggleCheckIn(filtered[0]);
      setSearch("");
    }
  };

  if (!selected) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading event desk…</div>;
  }

  const denom = Math.max(expectedForDay.length, checkedInCount, 1);
  const progressPct = Math.min(100, Math.round((checkedInCount / denom) * 100));

  return (
    <div className="space-y-6">
      {/* Desk Header + Day Switcher */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {selected.name} · {selected.venue || "Sanctuary Entrance"}
          </p>
          <h1 className="mt-1">Gate check-in desk</h1>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-card p-1.5">
          {dayNumbers.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setActiveDay(d)}
              className={`cursor-pointer rounded-xl px-4 py-2 text-xs font-semibold ${
                activeDay === d
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              Day {d}
            </button>
          ))}
        </div>
      </div>

      {/* Live Gate Progress Strip */}
      <div className="bezel-shell">
        <div className="bezel-core grid grid-cols-1 gap-6 p-5 sm:p-6 lg:grid-cols-12 lg:items-center">
          <div className="space-y-2 lg:col-span-5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-foreground">
                Day {activeDay} sanctuary arrival progress
              </span>
              <span className="font-mono-code text-xs font-semibold text-accent">
                {checkedInCount} arrived / {expectedForDay.length} expected
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Scan or type a badge code (e.g. <span className="font-mono-code">{selected.code}-0001</span>) and press Enter for instant verification.
            </p>
          </div>

          <div className="lg:col-span-7">
            <div className="relative">
              <MagnifyingGlass
                size={18}
                className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleQuickEnter}
                placeholder={`Scan badge code (${selected.code}-0001), UUID, name, church, or phone…`}
                aria-label="Search attendee to check in"
                className="w-full rounded-2xl border border-border bg-input py-3.5 pr-28 pl-11 text-sm text-foreground"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: "all", label: `All registered (${guests.length})` },
              { id: "pending", label: `Awaiting Day ${activeDay} (${Math.max(0, expectedForDay.length - checkedInCount)})` },
              { id: "checked_in", label: `Checked in (${checkedInCount})` },
              { id: "camping", label: "Campers & dorms" },
              { id: "first_timers", label: "Visitors & first-timers" },
            ] as { id: DeskFilter; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDeskFilter(tab.id)}
              className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-medium ${
                deskFilter === tab.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Link
          to="/register"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground no-underline hover:border-accent/50"
        >
          <UserPlus size={14} className="text-accent" aria-hidden="true" />
          Walk-in registration
        </Link>
      </div>

      {/* Check-in Queue */}
      <div className="surface-card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-16 animate-pulse rounded-xl bg-secondary" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <QrCode size={24} aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-foreground">No matching attendees in queue</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Try clearing your filter or register a new walk-in attendee directly at the gate.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((g) => {
              const checked = isCheckedInForDay(g, activeDay);
              const checkTime = g.check_ins?.[String(activeDay)];
              const isFirstTimer = g.ministry_role === "first_timer";

              return (
                <li
                  key={g.id}
                  className={`flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center ${
                    checked ? "bg-success/[0.04]" : "hover:bg-secondary/40"
                  }`}
                >
                  <div className="flex min-w-0 items-start gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary font-mono-code text-xs font-semibold text-foreground">
                      {g.first_name[0]}
                      {g.last_name[0]}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-secondary px-2 py-0.5 font-mono-code text-[11px] font-semibold text-foreground">
                          {g.reg_code}
                        </span>
                        <Link
                          to="/guests/$id"
                          params={{ id: g.id }}
                          className="inline-flex items-center gap-1 font-semibold text-foreground no-underline hover:text-accent"
                        >
                          <span>{formatFullName(g)}</span>
                          <ArrowUpRight size={13} className="text-muted-foreground" aria-hidden="true" />
                        </Link>
                        {isFirstTimer && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-warm/12 px-2 py-0.5 text-[11px] font-semibold text-warm">
                            <Sparkle size={11} weight="fill" aria-hidden="true" />
                            First-time guest
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {g.gender !== "unspecified" && <span>{GENDER_LABELS[g.gender]}</span>}
                        <span>{MINISTRY_ROLE_LABELS[g.ministry_role] || "Member"}</span>
                        {g.church_name && (
                          <span className="inline-flex items-center gap-1">
                            <Church size={12} aria-hidden="true" />
                            {g.church_name}
                          </span>
                        )}
                        <span>{g.origin}</span>
                        {g.phone && <span className="font-mono-code">{g.phone}</span>}
                        {g.status === "camping" && (
                          <span className="inline-flex items-center gap-1 font-medium text-warm">
                            <Campfire size={12} aria-hidden="true" />
                            {g.accommodation_zone || "Camping"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center justify-end gap-2.5">
                    {checked && checkTime && (
                      <span className="font-mono-code text-[11px] text-success">
                        Arrived {new Date(checkTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={busyId === g.id}
                      onClick={() => toggleCheckIn(g)}
                      className={`inline-flex min-w-[136px] cursor-pointer items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold ${
                        checked
                          ? "border border-border bg-card text-muted-foreground hover:text-foreground"
                          : "bg-primary text-primary-foreground shadow-xs hover:opacity-95"
                      }`}
                    >
                      {checked ? (
                        <>
                          <ClockCounterClockwise size={14} aria-hidden="true" />
                          Undo Day {activeDay}
                        </>
                      ) : (
                        <>
                          <CheckCircle size={15} weight="bold" aria-hidden="true" />
                          Check in Day {activeDay}
                        </>
                      )}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
