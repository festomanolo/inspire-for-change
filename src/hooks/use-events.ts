import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { EventCategory, EventRow, EventStatus } from "@/lib/types";

const STORAGE_KEY = "selectedEventId";
const EVENT_BUS = "ifc:selected-event-changed";

export type CreateChurchEventInput = {
  name: string;
  year: number;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (id: string) => {
    setSelectedId(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const createYear = async (year: number, name: string) => {
    const { data, error } = await supabase
      .from("events")
      .insert({ year, name })
      .select()
      .single();
    if (error) throw error;
    await refresh();
    if (data) select((data as EventRow).id);
    return data as EventRow;
  };

  const selected = events.find((e) => e.id === selectedId) ?? null;
  return { events, selected, selectedId, select, createYear, loading, refresh };
}
