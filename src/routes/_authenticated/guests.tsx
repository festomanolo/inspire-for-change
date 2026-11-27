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
                    <input value={editForm.origin || ""} onChange={(e) => setEditForm({ ...editForm, origin: e.target.value })} style={inputCls} placeholder="Origin" />
                    <input value={editForm.phone || ""} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} style={inputCls} placeholder="Phone" />
                    <select value={editForm.day || ""} onChange={(e) => setEditForm({ ...editForm, day: e.target.value ? parseInt(e.target.value) : null })} style={inputCls}>
                      <option value="">-</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                    </select>
                    <select value={editForm.status || "not_camping"} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as "camping" | "not_camping" })} style={inputCls}>
                      <option value="camping">Camping</option>
                      <option value="not_camping">Not camping</option>
                    </select>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      <button onClick={saveEdit} style={{ padding: "6px 12px", borderRadius: "8px", fontSize: "0.78rem", fontWeight: 600, background: "var(--color-primary)", color: "var(--color-primary-foreground)", border: "none", cursor: "pointer" }}>Save</button>
                      <button onClick={cancelEdit} style={{ padding: "6px 12px", borderRadius: "8px", fontSize: "0.78rem", background: "var(--color-secondary)", border: "none", cursor: "pointer" }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    display: "grid", gridTemplateColumns: "3fr 2fr 2fr 60px 130px 110px",
                    padding: "13px 20px", gap: "8px", alignItems: "center",
                    transition: "background 0.1s ease", cursor: "default",
                  }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-secondary)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <Link to="/guests/$id" params={{ id: g.id }} style={{ fontWeight: 600, fontSize: "0.88rem", textDecoration: "none", color: "var(--color-foreground)", transition: "color 0.1s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-accent)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-foreground)")}>
                      {[g.first_name, g.middle_name, g.last_name].filter(Boolean).join(" ")}
                    </Link>
                    <div style={{ fontSize: "0.82rem", color: "var(--color-muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.origin}</div>
                    <div style={{ fontSize: "0.82rem", color: "var(--color-muted-foreground)", fontVariantNumeric: "tabular-nums" }}>{g.phone}</div>
                    <div>
                      {g.day ? (
                        <span style={{ width: "24px", height: "24px", borderRadius: "6px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "oklch(0.55 0.22 258 / 0.1)", color: "var(--color-accent)", fontSize: "0.75rem", fontWeight: 700 }}>{g.day}</span>
                      ) : <span style={{ color: "var(--color-muted-foreground)" }}>—</span>}
                    </div>
                    <div>
                      <span style={{
                        fontSize: "0.72rem", padding: "3px 10px", borderRadius: "9999px", fontWeight: 600,
                        background: g.status === "camping" ? "oklch(0.55 0.22 258 / 0.1)" : "var(--color-muted)",
                        color: g.status === "camping" ? "var(--color-accent)" : "var(--color-muted-foreground)",
                        border: `1px solid ${g.status === "camping" ? "oklch(0.55 0.22 258 / 0.2)" : "var(--color-border)"}`,
                      }}>
                        {g.status === "camping" ? "⛺ Camping" : "☀️ Day visitor"}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "5px", justifyContent: "flex-end" }} className="no-print">
                      <button onClick={() => startEdit(g)} style={{ padding: "5px 12px", borderRadius: "8px", fontSize: "0.75rem", background: "var(--color-secondary)", border: "1.5px solid var(--color-border)", cursor: "pointer", fontWeight: 500 }}>Edit</button>
                      <button onClick={() => deleteGuest(g)} style={{ padding: "5px 12px", borderRadius: "8px", fontSize: "0.75rem", background: "oklch(0.58 0.22 27 / 0.08)", border: "1px solid oklch(0.58 0.22 27 / 0.15)", cursor: "pointer", color: "var(--color-destructive)", fontWeight: 500 }}>Delete</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <div style={{ padding: "10px 20px", fontSize: "0.75rem", color: "var(--color-muted-foreground)", borderTop: "1px solid var(--color-border)" }}>
          Showing {filtered.length} of {guests.length} guests
        </div>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {loading ? (
          <div style={{ padding: "60px", textAlign: "center", color: "var(--color-muted-foreground)" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "60px", textAlign: "center", color: "var(--color-muted-foreground)" }}>No guests found.</div>
        ) : (
          filtered.map((g, i) => (
            <div key={g.id} className={`surface-card fade-in stagger-${Math.min(i + 1, 6)}`} style={{ padding: "14px 16px" }}>
              {editingId === g.id ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                    <input value={editForm.first_name || ""} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} style={inputCls} placeholder="First name" />
                    <input value={editForm.last_name || ""} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} style={inputCls} placeholder="Last name" />
                  </div>
                  <input value={editForm.origin || ""} onChange={(e) => setEditForm({ ...editForm, origin: e.target.value })} style={inputCls} placeholder="Origin" />
                  <input value={editForm.phone || ""} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} style={inputCls} placeholder="Phone" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                    <select value={editForm.day || ""} onChange={(e) => setEditForm({ ...editForm, day: e.target.value ? parseInt(e.target.value) : null })} style={inputCls}>
                      <option value="">No day</option>
                      <option value="1">Day 1</option>
                      <option value="2">Day 2</option>
                      <option value="3">Day 3</option>
                    </select>
                    <select value={editForm.status || "not_camping"} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as "camping" | "not_camping" })} style={inputCls}>
                      <option value="camping">Camping</option>
                      <option value="not_camping">Not camping</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={saveEdit} style={{ flex: 1, padding: "9px", borderRadius: "10px", fontSize: "0.85rem", fontWeight: 600, background: "var(--color-primary)", color: "var(--color-primary-foreground)", border: "none", cursor: "pointer" }}>Save</button>
                    <button onClick={cancelEdit} style={{ flex: 1, padding: "9px", borderRadius: "10px", fontSize: "0.85rem", background: "var(--color-secondary)", border: "none", cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px" }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", minWidth: 0 }}>
                      <div style={{
                        width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0,
                        background: "linear-gradient(135deg, oklch(0.55 0.22 258 / 0.15), oklch(0.65 0.2 290 / 0.1))",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.75rem", fontWeight: 700, color: "var(--color-accent)",
                      }}>
                        {g.first_name[0]}{g.last_name[0]}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <Link to="/guests/$id" params={{ id: g.id }} style={{ fontWeight: 700, fontSize: "0.9rem", textDecoration: "none", color: "var(--color-foreground)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {[g.first_name, g.middle_name, g.last_name].filter(Boolean).join(" ")}
                        </Link>
                        <div style={{ fontSize: "0.75rem", color: "var(--color-muted-foreground)" }}>{g.origin}</div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: "0.68rem", padding: "3px 8px", borderRadius: "9999px", fontWeight: 600, flexShrink: 0,
                      background: g.status === "camping" ? "oklch(0.55 0.22 258 / 0.1)" : "var(--color-muted)",
                      color: g.status === "camping" ? "var(--color-accent)" : "var(--color-muted-foreground)",
                      border: `1px solid ${g.status === "camping" ? "oklch(0.55 0.22 258 / 0.2)" : "var(--color-border)"}`,
                    }}>
                      {g.status === "camping" ? "⛺" : "☀️"} {g.status === "camping" ? "Camping" : "Day"}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                      <span style={{ fontSize: "0.78rem", color: "var(--color-muted-foreground)" }}>{g.phone}</span>
                      {g.day && (
                        <span style={{ fontSize: "0.72rem", padding: "2px 8px", borderRadius: "6px", fontWeight: 600, background: "oklch(0.55 0.22 258 / 0.08)", color: "var(--color-accent)" }}>
                          Day {g.day}
                        </span>
                      )}
                    </div>
                    <div className="no-print" style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => startEdit(g)} style={{ padding: "5px 12px", borderRadius: "8px", fontSize: "0.75rem", background: "var(--color-secondary)", border: "1.5px solid var(--color-border)", cursor: "pointer", fontWeight: 500 }}>Edit</button>
                      <button onClick={() => deleteGuest(g)} style={{ padding: "5px 12px", borderRadius: "8px", fontSize: "0.75rem", background: "oklch(0.58 0.22 27 / 0.08)", border: "1px solid oklch(0.58 0.22 27 / 0.15)", cursor: "pointer", color: "var(--color-destructive)", fontWeight: 500 }}>Delete</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))
        )}
        {!loading && (
          <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--color-muted-foreground)", padding: "8px 0" }}>
            Showing {filtered.length} of {guests.length} guests
          </p>
        )}
      </div>
    </div>
  );
}
