import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  buildSuggestedEventCode,
  type EventCategory,
  type EventRow,
  type EventStatus,
} from "@/lib/types";

const STORAGE_KEY = "selectedEventId";
const EVENT_BUS = "ifc:selected-event-changed";
export const EVENT_STUDIO_BUS = "ifc:open-event-studio";

export type EventStudioDetail = {
  mode: "create" | "edit";
  event?: EventRow;
  presetCategory?: EventCategory;
};

export function openEventStudio(detail: EventStudioDetail = { mode: "create" }) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<EventStudioDetail>(EVENT_STUDIO_BUS, { detail }));
  }
}

export type CreateChurchEventInput = {
  name: string;
  year: number;
  organizer?: string | null;
  code?: string;
  category?: EventCategory;
  subtitle?: string | null;
  venue?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  total_days?: number;
  capacity?: number | null;
  camping_enabled?: boolean;
  status?: EventStatus;
};

export type CreateEventInput = CreateChurchEventInput;

export function useEvents() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null,
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from("events").select("*").order("year", { ascending: false });
    const rows = ((data as unknown as EventRow[]) ?? []).map((ev) => ({
      ...ev,
      code: ev.code || `IFC-${String(ev.year).slice(-2)}`,
      category: ev.category || "conference",
      total_days: ev.total_days || 3,
      camping_enabled: ev.camping_enabled !== false,
      status: ev.status || "active",
    }));
    setEvents(rows);
    setSelectedId((prev) => {
      if (rows.length && (!prev || !rows.find((r) => r.id === prev))) {
        const def = rows[0].id;
        if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, def);
        return def;
      }
      return prev;
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();

    const handleSync = (e: Event) => {
      const custom = e as CustomEvent<{ id?: string; reload?: boolean }>;
      if (custom.detail?.id) setSelectedId(custom.detail.id);
      if (custom.detail?.reload) refresh();
    };
    if (typeof window !== "undefined") {
      window.addEventListener(EVENT_BUS, handleSync);
    }

    const ch = supabase
      .channel("events-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => {
        refresh();
      })
      .subscribe();

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(EVENT_BUS, handleSync);
      }
      supabase.removeChannel(ch);
    };
  }, [refresh]);

  const select = (id: string) => {
    setSelectedId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
      window.dispatchEvent(new CustomEvent(EVENT_BUS, { detail: { id } }));
    }
  };

  const createEvent = async (input: CreateChurchEventInput) => {
    const payload = {
      name: input.name.trim(),
      year: input.year,
      code: input.code?.trim() || undefined,
      category: input.category || "conference",
      subtitle: input.subtitle?.trim() || null,
      venue: input.venue?.trim() || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      total_days: input.total_days ?? 3,
      capacity: input.capacity ?? 500,
      camping_enabled: input.camping_enabled !== false,
      status: input.status || "active",
    };
    const { data, error } = await supabase
      .from("events")
      .insert(payload as any)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await refresh();
    if (data) {
      const created = data as unknown as EventRow;
      select(created.id);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(EVENT_BUS, { detail: { id: created.id, reload: true } }));
      }
      return created;
    }
    throw new Error("Failed to create event");
  };

  const createYear = async (year: number, name: string) => {
    return createEvent({ year, name, category: "conference", total_days: 3 });
  };

  const updateEvent = async (id: string, updates: Partial<EventRow>) => {
    const { data, error } = await (supabase.from("events") as any)
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await refresh();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(EVENT_BUS, { detail: { reload: true } }));
    }
    return data as EventRow;
  };

  const deleteEvent = async (id: string) => {
    const { error } = await (supabase.from("events") as any).delete().eq("id", id);
    if (error) throw new Error(error.message);
    await refresh();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(EVENT_BUS, { detail: { reload: true } }));
    }
  };

  const selected = events.find((e) => e.id === selectedId) ?? null;
  return {
    events,
    selected,
    selectedId,
    select,
    createEvent,
    createYear,
    updateEvent,
    deleteEvent,
    loading,
    refresh,
  };
}
