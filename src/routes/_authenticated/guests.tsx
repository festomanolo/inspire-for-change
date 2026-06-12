import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEvents } from "@/hooks/use-events";
import type { Guest } from "@/lib/types";
import { exportGuestsToCSV } from "@/lib/csv-export";

export const Route = createFileRoute("/_authenticated/guests")({
  head: () => ({ meta: [{ title: "Guests — Inspired for Change" }] }),
  component: GuestsPage,
});

type Filter = "all" | "camping" | "not_camping";
type Sort = "newest" | "name";

function GuestsPage() {
  const { selected } = useEvents();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");

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
      .on("postgres_changes", { event: "*", schema: "public", table: "guests" }, load)
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
          <div className="col-span-4">Name</div>
          <div className="col-span-3">Origin</div>
          <div className="col-span-3">Phone</div>
          <div className="col-span-2 text-right">Status</div>
        </div>
        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">No guests found.</div>
        ) : (
          <ul>
            {filtered.map((g) => (
              <li key={g.id} className="border-b border-border last:border-0">
                <Link
                  to="/guests/$id"
                  params={{ id: g.id }}
                  className="grid grid-cols-1 md:grid-cols-12 px-6 py-4 gap-2 items-center hover:bg-secondary/50 transition-colors"
                >
                  <div className="col-span-4 font-medium">
                    {[g.first_name, g.middle_name, g.last_name].filter(Boolean).join(" ")}
                  </div>
                  <div className="col-span-3 text-sm text-muted-foreground">{g.origin}</div>
                  <div className="col-span-3 text-sm text-muted-foreground tabular-nums">{g.phone}</div>
                  <div className="col-span-2 md:text-right">
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
                </Link>
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
