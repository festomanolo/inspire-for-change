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
    if (filter !== "all") rows = rows.filter((g) => g.status === filter);
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter((g) =>
        [g.first_name, g.middle_name, g.last_name, g.origin, g.phone]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(q)),
      );
    }
    if (sort === "name") {
      rows = [...rows].sort((a, b) =>
        `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`),
      );
    }
    return rows;
  }, [guests, query, filter, sort]);

  const exportCsv = async () => {
    try {
      await exportGuestsToCSV(selected?.id);
    } catch {
      alert("Failed to export CSV. Please try again.");
    }
  };

  const startEdit = (guest: Guest) => {
    setEditingId(guest.id);
    setEditForm(guest);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingId || !user) return;
    const { error: err } = await supabase
      .from("guests")
      .update({
        first_name: editForm.first_name,
        middle_name: editForm.middle_name || null,
        last_name: editForm.last_name,
        origin: editForm.origin,
        phone: editForm.phone,
        status: editForm.status,
        day: editForm.day,
        updated_by: user.id,
      })
      .eq("id", editingId);

    if (err) { toast.error("Failed to update guest"); return; }
    toast.success("Guest updated successfully");
    setEditingId(null);
    setEditForm({});
  };

  const deleteGuest = async (guest: Guest) => {
    if (!confirm(`Delete ${guest.first_name} ${guest.last_name}? This cannot be undone.`)) return;
    const { error: err } = await supabase.from("guests").delete().eq("id", guest.id);
    if (err) { toast.error("Failed to delete guest"); return; }
    toast.success("Guest deleted");
  };

  const inputCls: React.CSSProperties = {
    width: "100%", padding: "7px 10px", borderRadius: "8px",
    background: "var(--color-input)", border: "1.5px solid var(--color-border)",
    fontSize: "0.82rem", color: "var(--color-foreground)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div className="no-print slide-up" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "12px" }}>
        <div>
          <p style={{ fontSize: "0.8rem", color: "var(--color-muted-foreground)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {selected?.name}
          </p>
          <h1 style={{ marginTop: "2px" }}>Guests</h1>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            id="export-csv-btn"
            onClick={exportCsv}
            style={{
              padding: "9px 16px", borderRadius: "9999px", fontSize: "0.82rem",
              background: "var(--color-secondary)", border: "1.5px solid var(--color-border)",
              cursor: "pointer", fontWeight: 500, color: "var(--color-foreground)",
            }}
          >
            ↓ CSV
          </button>
          <button
            id="print-btn"
            onClick={() => window.print()}
            style={{
              padding: "9px 16px", borderRadius: "9999px", fontSize: "0.82rem",
              background: "linear-gradient(135deg, oklch(0.28 0.06 255), oklch(0.55 0.22 258))",
              border: "none", cursor: "pointer", fontWeight: 600, color: "white",
            }}
          >
            🖨 Print
          </button>
        </div>
      </div>

      {/* Search & filters */}
      <div className="no-print surface-card" style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <input
          id="guests-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍  Search by name, origin, or phone…"
          style={{
            width: "100%", padding: "10px 14px", borderRadius: "12px",
            background: "var(--color-input)", border: "1.5px solid var(--color-border)",
            fontSize: "0.88rem", color: "var(--color-foreground)",
          }}
        />
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {/* Status filter pills */}
          <div style={{ display: "flex", gap: "4px", background: "var(--color-secondary)", borderRadius: "10px", padding: "3px" }}>
            {(["all", "camping", "not_camping"] as Filter[]).map((f) => (
              <button
                key={f}
                id={`filter-${f}`}
                onClick={() => setFilter(f)}
                style={{
                  padding: "6px 12px", borderRadius: "8px", fontSize: "0.78rem",
                  border: "none", cursor: "pointer", fontWeight: filter === f ? 600 : 400,
                  background: filter === f ? "var(--color-card)" : "transparent",
                  color: filter === f ? "var(--color-foreground)" : "var(--color-muted-foreground)",
                  boxShadow: filter === f ? "var(--shadow-soft)" : "none",
                  transition: "all 0.15s ease", whiteSpace: "nowrap",
                }}
              >
                {f === "all" ? "All" : f === "camping" ? "⛺ Camping" : "☀️ Day visitors"}
              </button>
            ))}
          </div>
          {/* Sort */}
          <select
            id="guests-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            style={{
              padding: "6px 12px", borderRadius: "10px", fontSize: "0.78rem",
              background: "var(--color-secondary)", border: "1.5px solid var(--color-border)",
              cursor: "pointer", color: "var(--color-foreground)", fontWeight: 500,
            }}
          >
            <option value="newest">Newest first</option>
            <option value="name">A → Z</option>
          </select>
        </div>
      </div>

      {/* Table — desktop */}
      <div className="surface-card hidden md:block" style={{ overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "3fr 2fr 2fr 60px 130px 110px",
          padding: "10px 20px", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.07em", color: "var(--color-muted-foreground)",
          borderBottom: "1px solid var(--color-border)", background: "var(--color-secondary)",
        }}>
          <div>Name</div><div>Origin</div><div>Phone</div><div>Day</div><div>Status</div><div style={{ textAlign: "right" }}>Actions</div>
        </div>

        {loading ? (
          <div style={{ padding: "60px", textAlign: "center", color: "var(--color-muted-foreground)" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "60px", textAlign: "center", color: "var(--color-muted-foreground)" }}>No guests found.</div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {filtered.map((g) => (
              <li key={g.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                {editingId === g.id ? (
                  <div style={{
                    display: "grid", gridTemplateColumns: "3fr 2fr 2fr 60px 130px 110px",
                    padding: "12px 20px", gap: "8px", alignItems: "center",
                    background: "oklch(0.55 0.22 258 / 0.04)",
                  }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <input value={editForm.first_name || ""} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} style={inputCls} placeholder="First name" />
                      <input value={editForm.last_name || ""} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} style={inputCls} placeholder="Last name" />
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
