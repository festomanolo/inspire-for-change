import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEvents } from "@/hooks/use-events";
import type { Guest, GuestEdit, Profile } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Dashboard — Inspired for Change" }] }),
  component: Dashboard,
});

function Dashboard() {
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
      setGuests((gs as Guest[]) ?? []);

      const { data: es } = await supabase
        .from("guest_edits")
        .select("*, guest:guests(*)")
        .order("edited_at", { ascending: false })
        .limit(8);
      if (cancelled) return;
      const filtered = ((es as (GuestEdit & { guest?: Guest })[]) ?? []).filter(
        (e) => e.guest?.event_id === selected.id,
      );
      setEdits(filtered);

      const { data: ps } = await supabase.from("profiles").select("*");
      if (cancelled) return;
      const map: Record<string, Profile> = {};
      ((ps as Profile[]) ?? []).forEach((p) => (map[p.id] = p));
      setProfiles(map);
    };
    load();

    const channel = supabase
      .channel("dashboard-" + selected.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "guests" }, (payload) => {
        const newGuest = payload.new as Guest;
        if (newGuest.event_id === selected.id) {
          toast.success(`New registration: ${newGuest.first_name} ${newGuest.last_name}`);
          load();
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "guests" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "guest_edits" }, load)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [selected]);

  if (!selected) return <div className="text-muted-foreground">Loading…</div>;

  const total = guests.length;
  const campers = guests.filter((g) => g.status === "camping").length;
  const notCampers = total - campers;
  const day1 = guests.filter((g) => g.day === 1).length;
  const day2 = guests.filter((g) => g.day === 2).length;
  const day3 = guests.filter((g) => g.day === 3).length;
  const recent = guests.slice(0, 5);

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm text-muted-foreground">{selected.name}</p>
        <h1 className="text-4xl mt-1">Overview</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total guests" value={total} />
        <StatCard label="Camping" value={campers} accent />
        <StatCard label="Not camping" value={notCampers} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Day 1" value={day1} />
        <StatCard label="Day 2" value={day2} />
        <StatCard label="Day 3" value={day3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="surface-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg">Recent registrations</h2>
            <Link to="/guests" className="text-sm text-accent hover:underline">
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No guests yet.</p>
          ) : (
            <ul className="space-y-1">
              {recent.map((g) => (
                <li key={g.id}>
                  <Link
                    to="/guests/$id"
                    params={{ id: g.id }}
                    className="flex items-center justify-between py-3 px-3 -mx-3 rounded-xl hover:bg-secondary transition-colors"
                  >
                    <div>
                      <div className="font-medium">
                        {[g.first_name, g.middle_name, g.last_name].filter(Boolean).join(" ")}
                      </div>
                      <div className="text-xs text-muted-foreground">{g.origin}</div>
                    </div>
                    <StatusPill status={g.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="surface-card p-6">
          <h2 className="text-lg mb-5">Recent edits</h2>
          {edits.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No edits yet.</p>
          ) : (
            <ul className="space-y-3">
              {edits.map((e) => {
                const who = e.edited_by ? profiles[e.edited_by]?.display_name : "Unknown";
                return (
                  <li key={e.id} className="text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <span>
                        <span className="font-medium">{who}</span>{" "}
                        <span className="text-muted-foreground">
                          {e.action === "create" ? "registered" : "updated"}
                        </span>{" "}
                        {e.guest && (
                          <Link
                            to="/guests/$id"
                            params={{ id: e.guest.id }}
                            className="font-medium hover:underline"
                          >
                            {e.guest.first_name} {e.guest.last_name}
                          </Link>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
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

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`surface-card p-6 ${accent ? "bg-accent/10 border-accent/30" : ""}`}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-4xl font-display font-semibold mt-2 tabular-nums">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: "camping" | "not_camping" }) {
  return (
    <span
      className={`text-xs px-3 py-1 rounded-full ${
        status === "camping"
          ? "bg-accent/10 text-accent border border-accent/20"
          : "bg-muted text-muted-foreground border border-border"
      }`}
    >
      {status === "camping" ? "Camping" : "Not camping"}
    </span>
  );
}
