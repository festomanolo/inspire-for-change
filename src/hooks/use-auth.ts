import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/types";

export type { Profile };

type JsonUser = {
  id: string;
  email: string;
  created_at: string;
};

export function useAuth() {
  const [user, setUser] = useState<JsonUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let currentUid: string | null = null;

    const loadProfile = async (uid: string) => {
      const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      if (mounted) setProfile((data as Profile) ?? null);
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const u = (data.session?.user as unknown as JsonUser | undefined) ?? null;
      currentUid = u?.id ?? null;
      setUser(u);
      if (u) loadProfile(u.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      const u = (session?.user as unknown as JsonUser | undefined) ?? null;
      currentUid = u?.id ?? null;
      setUser(u);
      if (u) loadProfile(u.id);
      else setProfile(null);
    });

    const ch = supabase
      .channel("auth-profile-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        if (currentUid) loadProfile(currentUid);
      })
      .subscribe();

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      supabase.removeChannel(ch);
    };
  }, []);

  return { user, profile, loading };
}
