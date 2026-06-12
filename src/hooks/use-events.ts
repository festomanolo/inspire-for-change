import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { EventRow } from "@/lib/types";

const STORAGE_KEY = "selectedEventId";

export function useEvents() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null,
  );
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const { data } = await supabase.from("events").select("*").order("year", { ascending: false });
    const rows = (data as EventRow[]) ?? [];
    setEvents(rows);
    if (rows.length && (!selectedId || !rows.find((r) => r.id === selectedId))) {
      const def = rows[0].id;
      setSelectedId(def);
      localStorage.setItem(STORAGE_KEY, def);
    }
    setLoading(false);
  };

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
