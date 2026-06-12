import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEvents } from "@/hooks/use-events";
import { useAuth } from "@/hooks/use-auth";
import type { Guest } from "@/lib/types";
import { exportGuestsToCSV } from "@/lib/csv-export";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/guests")({
  head: () => ({ meta: [{ title: "Guests — Inspired for Change" }] }),
  component: GuestsPage,
});

type Filter = "all" | "camping" | "not_camping";
type Sort = "newest" | "name";

function GuestsPage() {
  const { selected } = useEvents();
  const { user } = useAuth();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Guest>>({});

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("guests")
        .select("*")
        .eq("event_id", selected.id)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setGuests((data as Guest[]) ?? []);
      setLoading(false);
    };
    load();
    const channel = supabase
      .channel("guests-" + selected.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "guests" }, (payload) => {
        const newGuest = payload.new as Guest;
        if (newGuest.event_id === selected.id) {
          toast.success(`New guest registered: ${newGuest.first_name} ${newGuest.last_name}`);
          load();
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "guests" }, (payload) => {
        const updated = payload.new as Guest;
        if (updated.event_id === selected.id) {
          toast.info(`Guest updated: ${updated.first_name} ${updated.last_name}`);
          load();
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "guests" }, (payload) => {
        const deleted = payload.old as Guest;
        if (deleted.event_id === selected.id) {
          toast.warning(`Guest removed: ${deleted.first_name} ${deleted.last_name}`);
          load();
        }
      })
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [selected]);

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
    } catch (error) {
      console.error("Error exporting CSV:", error);
      alert("Failed to export CSV. Please try again.");
    }
  };

  const printList = () => window.print();

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
    
    if (err) {
      toast.error("Failed to update guest");
      return;
    }
    
    toast.success("Guest updated successfully");
    setEditingId(null);
    setEditForm({});
  };

  const deleteGuest = async (guest: Guest) => {
    if (!confirm(`Delete ${guest.first_name} ${guest.last_name}? This cannot be undone.`)) return;
    
    const { error: err } = await supabase
      .from("guests")
      .delete()
      .eq("id", guest.id);
    
    if (err) {
      toast.error("Failed to delete guest");
      return;
    }
    
    toast.success("Guest deleted successfully");
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 no-print">
        <div>
          <p className="text-sm text-muted-foreground">{selected?.name}</p>
          <h1 className="text-4xl mt-1">Guests</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportCsv}
            className="px-5 py-2.5 rounded-full bg-secondary text-secondary-foreground text-sm hover:bg-muted transition-colors"
          >
            Download CSV
          </button>
          <button
            onClick={printList}
            className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
          >
            Print
          </button>
        </div>
      </div>

      <div className="surface-card p-2 mb-5 no-print flex flex-col md:flex-row gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, origin, or phone"
          className="flex-1 px-4 py-2.5 rounded-xl bg-transparent focus:outline-none"
        />
        <div className="flex gap-1 rounded-xl bg-secondary p-1">
          {(["all", "camping", "not_camping"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                filter === f ? "bg-card shadow-soft" : "text-muted-foreground"
              }`}
            >
              {f === "all" ? "All" : f === "camping" ? "Camping" : "Not camping"}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="px-4 py-2.5 rounded-xl bg-secondary text-sm border-0 focus:outline-none cursor-pointer"
        >
          <option value="newest">Newest first</option>
          <option value="name">By name</option>
        </select>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="hidden md:grid grid-cols-12 px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
          <div className="col-span-3">Name</div>
          <div className="col-span-2">Origin</div>
          <div className="col-span-2">Phone</div>
          <div className="col-span-1">Day</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">No guests found.</div>
        ) : (
          <ul>
            {filtered.map((g) => (
              <li key={g.id} className="border-b border-border last:border-0">
                {editingId === g.id ? (
                  <div className="grid grid-cols-1 md:grid-cols-12 px-6 py-4 gap-2 items-center bg-accent/5">
                    <div className="col-span-3">
                      <input
                        value={editForm.first_name || ""}
                        onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                        className="w-full px-2 py-1 rounded border border-border bg-input text-sm"
                        placeholder="First name"
                      />
                      <input
                        value={editForm.last_name || ""}
                        onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                        className="w-full px-2 py-1 rounded border border-border bg-input text-sm mt-1"
                        placeholder="Last name"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        value={editForm.origin || ""}
                        onChange={(e) => setEditForm({ ...editForm, origin: e.target.value })}
                        className="w-full px-2 py-1 rounded border border-border bg-input text-sm"
                        placeholder="Origin"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        value={editForm.phone || ""}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        className="w-full px-2 py-1 rounded border border-border bg-input text-sm"
                        placeholder="Phone"
                      />
                    </div>
                    <div className="col-span-1">
                      <select
                        value={editForm.day || ""}
                        onChange={(e) => setEditForm({ ...editForm, day: e.target.value ? parseInt(e.target.value) : null })}
                        className="w-full px-2 py-1 rounded border border-border bg-input text-sm"
                      >
                        <option value="">-</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <select
                        value={editForm.status || "not_camping"}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value as "camping" | "not_camping" })}
                        className="w-full px-2 py-1 rounded border border-border bg-input text-sm"
                      >
                        <option value="camping">Camping</option>
                        <option value="not_camping">Not camping</option>
                      </select>
                    </div>
                    <div className="col-span-2 flex gap-2 justify-end">
                      <button
                        onClick={saveEdit}
                        className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-12 px-6 py-4 gap-2 items-center hover:bg-secondary/50 transition-colors">
                    <Link to="/guests/$id" params={{ id: g.id }} className="col-span-3 font-medium hover:text-accent">
                      {[g.first_name, g.middle_name, g.last_name].filter(Boolean).join(" ")}
                    </Link>
                    <div className="col-span-2 text-sm text-muted-foreground">{g.origin}</div>
                    <div className="col-span-2 text-sm text-muted-foreground tabular-nums">{g.phone}</div>
                    <div className="col-span-1 text-sm">
                      {g.day ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-medium">
                          {g.day}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                    <div className="col-span-2">
                      <span
                        className={`text-xs px-3 py-1 rounded-full ${
                          g.status === "camping"
                            ? "bg-accent/10 text-accent border border-accent/20"
                            : "bg-muted text-muted-foreground border border-border"
                        }`}
                      >
                        {g.status === "camping" ? "Camping" : "Not camping"}
                      </span>
                    </div>
                    <div className="col-span-2 flex gap-2 justify-end no-print">
                      <button
                        onClick={() => startEdit(g)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-muted text-foreground transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteGuest(g)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="px-6 py-3 text-xs text-muted-foreground border-t border-border">
          Showing {filtered.length} of {guests.length}
        </div>
      </div>
    </div>
  );
}
