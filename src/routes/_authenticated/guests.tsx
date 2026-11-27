import { createFileRoute, Link, Outlet, useMatch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEvents } from "@/hooks/use-events";
import { useAuth } from "@/hooks/use-auth";
import {
  AGE_GROUP_LABELS,
  GENDER_LABELS,
  MINISTRY_ROLE_LABELS,
  formatFullName,
  isCheckedInForDay,
  type Gender,
  type Guest,
  type GuestStatus,
} from "@/lib/types";
import { exportGuestsToCSV } from "@/lib/csv-export";
import { toast } from "sonner";
import {
  Campfire,
  CheckCircle,
  Church,
  DownloadSimple,
  MagnifyingGlass,
  PencilSimple,
  Printer,
  SunHorizon,
  Trash,
  UserPlus,
  Users,
} from "@phosphor-icons/react";

export const Route = createFileRoute("/_authenticated/guests")({
  head: () => ({ meta: [{ title: "Attendee Directory — Inspired for Change" }] }),
  component: GuestsRouteLayout,
});

function GuestsRouteLayout() {
  const detailMatch = useMatch({ from: "/_authenticated/guests/$id", shouldThrow: false });
  if (detailMatch) {
    return <Outlet />;
  }
  return <GuestsDirectory />;
}

type AccomFilter = "all" | "camping" | "not_camping";
type GenderFilter = "all" | "male" | "female";
type SortOrder = "newest" | "name" | "code";

function GuestsDirectory() {
  const { selected } = useEvents();
  const { user } = useAuth();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [accomFilter, setAccomFilter] = useState<AccomFilter>("all");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [dayFilter, setDayFilter] = useState<number | "all">("all");
  const [sort, setSort] = useState<SortOrder>("newest");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Guest>>({});
  const [confirmDeleteGuest, setConfirmDeleteGuest] = useState<Guest | null>(null);

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

    const channel = supabase
      .channel("guests-" + selected.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "guests" }, () => {
        loadGuests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const totalDays = selected?.total_days || 3;
  const dayList = Array.from({ length: totalDays }, (_, i) => i + 1);

  const filtered = useMemo(() => {
    let rows = guests;
    if (accomFilter !== "all") rows = rows.filter((g) => g.status === accomFilter);
    if (genderFilter !== "all") rows = rows.filter((g) => g.gender === genderFilter);
    if (dayFilter !== "all") {
      rows = rows.filter((g) => g.days_registered?.includes(dayFilter) || g.day === dayFilter);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter((g) =>
        [
          g.reg_code,
          g.id,
          g.first_name,
          g.middle_name,
          g.last_name,
          formatFullName(g),
          g.origin,
          g.church_name,
          g.phone,
          g.accommodation_zone,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }

    if (sort === "name") {
      rows = [...rows].sort((a, b) =>
        `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`),
      );
    } else if (sort === "code") {
      rows = [...rows].sort((a, b) => (a.reg_code || "").localeCompare(b.reg_code || ""));
    }
    return rows;
  }, [guests, query, accomFilter, genderFilter, dayFilter, sort]);

  const handleExportCsv = async () => {
    try {
      await exportGuestsToCSV(selected?.id);
      toast.success("Attendee CSV downloaded");
    } catch {
      toast.error("Failed to export CSV. Please try again.");
    }
  };

  const startEdit = (guest: Guest) => {
    setEditingId(guest.id);
    setEditForm({ ...guest });
  };

  const saveEdit = async () => {
    if (!editingId || !user) return;
    const { error: err } = await supabase
      .from("guests")
      .update({
        first_name: editForm.first_name,
        middle_name: editForm.middle_name || null,
        last_name: editForm.last_name,
        gender: editForm.gender,
        origin: editForm.origin,
        church_name: editForm.church_name || null,
        phone: editForm.phone || "",
        status: editForm.status,
        updated_by: user.id,
      } as any)
      .eq("id", editingId);

    if (err) {
      toast.error("Failed to save changes");
      return;
    }
    toast.success("Attendee updated");
    setEditingId(null);
    setEditForm({});
    await loadGuests();
  };

  const confirmDelete = async () => {
    if (!confirmDeleteGuest) return;
    const target = confirmDeleteGuest;
    setConfirmDeleteGuest(null);
    const { error: err } = await supabase.from("guests").delete().eq("id", target.id);
    if (err) {
      toast.error("Failed to remove attendee");
      return;
    }
    toast.success(`Removed ${formatFullName(target)}`);
    await loadGuests();
  };

  const quickToggleDayCheckIn = async (guest: Guest, dayNum: number) => {
    if (!user) return;
    const checked = isCheckedInForDay(guest, dayNum);
    const nextCheckIns = { ...(guest.check_ins ?? {}) };
    const nextDays = new Set<number>(guest.days_registered ?? [1]);
    if (checked) {
      delete nextCheckIns[String(dayNum)];
    } else {
      nextCheckIns[String(dayNum)] = new Date().toISOString();
      nextDays.add(dayNum);
    }

    const { error } = await supabase
      .from("guests")
      .update({
        check_ins: nextCheckIns as any,
        days_registered: Array.from(nextDays).sort((a, b) => a - b),
        updated_by: user.id,
      } as any)
      .eq("id", guest.id);

    if (error) {
      toast.error("Could not update check-in");
      return;
    }
    await loadGuests();
  };

  const maleCount = guests.filter((g) => g.gender === "male").length;
  const femaleCount = guests.filter((g) => g.gender === "female").length;

  return (
    <div className="space-y-5">
      {/* Directory Header */}
      <div className="no-print flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {selected?.name} · {guests.length} registered ({maleCount} male, {femaleCount} female)
          </p>
          <h1 className="mt-1">Attendee directory</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="export-csv-btn"
            type="button"
            onClick={handleExportCsv}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
          >
            <DownloadSimple size={15} className="text-accent" aria-hidden="true" />
            Export CSV
          </button>
          <button
            id="print-btn"
            type="button"
            onClick={() => window.print()}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
          >
            <Printer size={15} className="text-accent" aria-hidden="true" />
            Print roster
          </button>
          <Link
            to="/register"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground no-underline hover:opacity-95"
          >
            <UserPlus size={15} weight="bold" aria-hidden="true" />
            Register attendee
          </Link>
        </div>
      </div>

      {/* Multi-faceted Filter Bar */}
      <div className="no-print surface-card space-y-3 p-4">
        <div className="relative">
          <MagnifyingGlass
            size={17}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="guests-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by badge ID (IFC-26-0001), UUID, name, church, city, dorm, or phone…"
            aria-label="Search directory"
            className="w-full rounded-xl border border-border bg-input py-2.5 pr-4 pl-10 text-sm text-foreground"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Gender Filter */}
          <div className="flex rounded-xl bg-secondary p-1">
            {(["all", "male", "female"] as GenderFilter[]).map((gf) => (
              <button
                key={gf}
                type="button"
                onClick={() => setGenderFilter(gf)}
                className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-medium capitalize ${
                  genderFilter === gf
                    ? "bg-card font-semibold text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {gf === "all" ? "All genders" : gf}
              </button>
            ))}
          </div>

          {/* Accommodation Filter */}
          <div className="flex rounded-xl bg-secondary p-1">
            {(["all", "camping", "not_camping"] as AccomFilter[]).map((af) => (
              <button
                key={af}
                id={`filter-${af}`}
                type="button"
                onClick={() => setAccomFilter(af)}
                className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-medium ${
                  accomFilter === af
                    ? "bg-card font-semibold text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {af === "all" ? "All lodging" : af === "camping" ? "Campers" : "Day commuters"}
              </button>
            ))}
          </div>

          {/* Day Filter */}
          <select
            aria-label="Filter by day"
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="cursor-pointer rounded-xl border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground"
          >
            <option value="all">All days</option>
            {dayList.map((d) => (
              <option key={d} value={d}>
                Day {d}
              </option>
            ))}
          </select>

          {/* Sort */}
          <select
            id="guests-sort"
            aria-label="Sort order"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOrder)}
            className="cursor-pointer rounded-xl border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground"
          >
            <option value="newest">Newest registered</option>
            <option value="code">Badge code</option>
            <option value="name">Name (A–Z)</option>
          </select>
        </div>
      </div>

      {/* Desktop Roster Table */}
      <div className="surface-card hidden overflow-hidden lg:block">
        <div className="grid grid-cols-12 gap-3 border-b border-border bg-secondary/70 px-5 py-3 text-xs font-semibold text-muted-foreground">
          <div className="col-span-3">Attendee & badge ID</div>
          <div className="col-span-2">Demographics</div>
          <div className="col-span-3">Church & contact</div>
          <div className="col-span-2">Days & check-in</div>
          <div className="col-span-1">Lodging</div>
          <div className="no-print col-span-1 text-right">Actions</div>
        </div>

        {loading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-secondary" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-semibold text-foreground">No attendees match your filters</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Adjust your search terms or register a new person for {selected?.name}.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((g) => (
              <li key={g.id} className="px-5 py-3.5 hover:bg-secondary/35">
                {editingId === g.id ? (
                  <div className="grid grid-cols-12 items-center gap-2.5">
                    <div className="col-span-3 flex gap-1.5">
                      <input
                        value={editForm.first_name || ""}
                        onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                        placeholder="First"
                        className="w-full rounded-lg border border-border bg-input px-2.5 py-1.5 text-xs"
                      />
                      <input
                        value={editForm.last_name || ""}
                        onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                        placeholder="Last"
                        className="w-full rounded-lg border border-border bg-input px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <select
                        value={editForm.gender || "unspecified"}
                        onChange={(e) =>
                          setEditForm({ ...editForm, gender: e.target.value as Gender })
                        }
                        className="w-full rounded-lg border border-border bg-input px-2 py-1.5 text-xs"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="unspecified">Unspecified</option>
                      </select>
                    </div>
                    <div className="col-span-3 flex gap-1.5">
                      <input
                        value={editForm.church_name || ""}
                        onChange={(e) => setEditForm({ ...editForm, church_name: e.target.value })}
                        placeholder="Church"
                        className="w-full rounded-lg border border-border bg-input px-2.5 py-1.5 text-xs"
                      />
                      <input
                        value={editForm.phone || ""}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        placeholder="Phone"
                        className="w-full rounded-lg border border-border bg-input px-2.5 py-1.5 font-mono-code text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        value={editForm.origin || ""}
                        onChange={(e) => setEditForm({ ...editForm, origin: e.target.value })}
                        placeholder="City / Region"
                        className="w-full rounded-lg border border-border bg-input px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div className="col-span-1">
                      <select
                        value={editForm.status || "not_camping"}
                        onChange={(e) =>
                          setEditForm({ ...editForm, status: e.target.value as GuestStatus })
                        }
                        className="w-full rounded-lg border border-border bg-input px-1.5 py-1.5 text-xs"
                      >
                        <option value="not_camping">Day</option>
                        <option value="camping">Camp</option>
                      </select>
                    </div>
                    <div className="col-span-1 flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={saveEdit}
                        className="cursor-pointer rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="cursor-pointer rounded-lg bg-secondary px-2 py-1.5 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-12 items-center gap-3">
                    <div className="col-span-3 min-w-0">
                      <Link
                        to="/guests/$id"
                        params={{ id: g.id }}
                        className="block truncate text-sm font-semibold text-foreground no-underline hover:text-accent"
                      >
                        {formatFullName(g)}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-1.5 font-mono-code text-xs text-muted-foreground">
                        <span className="font-medium text-accent">{g.reg_code}</span>
                        <span>·</span>
                        <span title={g.id}>{g.id.slice(0, 8)}</span>
                      </div>
                    </div>

                    <div className="col-span-2 text-xs">
                      <span className="font-medium text-foreground">
                        {GENDER_LABELS[g.gender] || "Not recorded"}
                      </span>
                      <span className="block text-muted-foreground">
                        {MINISTRY_ROLE_LABELS[g.ministry_role] || AGE_GROUP_LABELS[g.age_group]}
                      </span>
                    </div>

                    <div className="col-span-3 min-w-0 text-xs">
                      <div className="flex items-center gap-1 truncate text-foreground">
                        <Church size={13} className="shrink-0 text-accent" aria-hidden="true" />
                        <span className="truncate">{g.church_name || g.origin}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
                        <span className="font-mono-code">{g.phone || "No phone"}</span>
                        {g.is_shared_phone && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-secondary px-1.5 py-0.5 text-xs">
                            <Users size={11} aria-hidden="true" />
                            Shared
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="col-span-2 flex flex-wrap gap-1">
                      {(g.days_registered?.length ? g.days_registered : g.day ? [g.day] : [1]).map(
                        (d) => {
                          const checked = isCheckedInForDay(g, d);
                          return (
                            <button
                              key={d}
                              type="button"
                              title={checked ? `Checked in Day ${d} (click to undo)` : `Click to check in Day ${d}`}
                              onClick={() => quickToggleDayCheckIn(g, d)}
                              className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-0.5 font-mono-code text-xs font-semibold ${
                                checked
                                  ? "border-success/35 bg-success/12 text-success"
                                  : "border-border bg-secondary text-foreground hover:border-accent/40"
                              }`}
                            >
                              {checked && <CheckCircle size={11} weight="fill" aria-hidden="true" />}
                              D{d}
                            </button>
                          );
                        },
                      )}
                    </div>

                    <div className="col-span-1">
                      {g.status === "camping" ? (
                        <span
                          title={g.accommodation_zone || "Camping"}
                          className="inline-flex items-center gap-1 rounded-full bg-warm/12 px-2.5 py-1 text-xs font-semibold text-warm"
                        >
                          <Campfire size={13} aria-hidden="true" />
                          Camp
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          <SunHorizon size={13} aria-hidden="true" />
                          Day
                        </span>
                      )}
                    </div>

                    <div className="no-print col-span-1 flex items-center justify-end gap-1">
                      <button
                        type="button"
                        aria-label={`Edit ${formatFullName(g)}`}
                        onClick={() => startEdit(g)}
                        className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <PencilSimple size={15} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${formatFullName(g)}`}
                        onClick={() => setConfirmDeleteGuest(g)}
                        className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/12 hover:text-destructive"
                      >
                        <Trash size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          Showing {filtered.length} of {guests.length} registered attendees
        </div>
      </div>

      {/* Mobile & Tablet Card Roster */}
      <div className="space-y-3 lg:hidden">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-secondary" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="surface-card p-10 text-center text-xs text-muted-foreground">
            No attendees found matching your filters.
          </div>
        ) : (
          filtered.map((g) => (
            <div key={g.id} className="surface-card space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-secondary px-2 py-0.5 font-mono-code text-xs font-semibold text-accent">
                      {g.reg_code}
                    </span>
                    {g.gender !== "unspecified" && (
                      <span className="text-xs text-muted-foreground">{GENDER_LABELS[g.gender]}</span>
                    )}
                  </div>
                  <Link
                    to="/guests/$id"
                    params={{ id: g.id }}
                    className="mt-1 block truncate text-base font-bold text-foreground no-underline hover:text-accent"
                  >
                    {formatFullName(g)}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {g.church_name ? `${g.church_name} · ${g.origin}` : g.origin}
                  </p>
                </div>

                {g.status === "camping" ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warm/12 px-2.5 py-1 text-xs font-semibold text-warm">
                    <Campfire size={13} aria-hidden="true" />
                    Camp
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    Day
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(g.days_registered?.length ? g.days_registered : g.day ? [g.day] : [1]).map((d) => {
                    const checked = isCheckedInForDay(g, d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => quickToggleDayCheckIn(g, d)}
                        className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-2.5 py-1 font-mono-code text-xs font-semibold ${
                          checked
                            ? "border-success/35 bg-success/12 text-success"
                            : "border-border bg-secondary text-foreground"
                        }`}
                      >
                        {checked && <CheckCircle size={12} weight="fill" aria-hidden="true" />}
                        Day {d}
                      </button>
                    );
                  })}
                </div>

                <div className="no-print flex items-center gap-2">
                  <Link
                    to="/guests/$id"
                    params={{ id: g.id }}
                    className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground no-underline"
                  >
                    Badge & details
                  </Link>
                  <button
                    type="button"
                    aria-label={`Remove ${formatFullName(g)}`}
                    onClick={() => setConfirmDeleteGuest(g)}
                    className="cursor-pointer rounded-lg border border-destructive/20 bg-destructive/10 p-1.5 text-destructive"
                  >
                    <Trash size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Accessible Delete Confirmation Dialog */}
      {confirmDeleteGuest && (
        <div
          className="no-print fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
          onClick={() => setConfirmDeleteGuest(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="del-guest-title"
            className="bezel-shell scale-in w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bezel-core space-y-4 p-6">
              <h3 id="del-guest-title" className="text-base font-bold text-foreground">
                Remove attendee record?
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                This will permanently remove <strong>{formatFullName(confirmDeleteGuest)}</strong> (
                <span className="font-mono-code">{confirmDeleteGuest.reg_code}</span>) from the active roster.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteGuest(null)}
                  className="cursor-pointer rounded-full border border-border bg-secondary px-4 py-2 text-xs font-semibold text-foreground"
                >
                  Keep record
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="cursor-pointer rounded-full bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground"
                >
                  Remove permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
