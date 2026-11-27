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

    const loadProfile = async (uid: string) => {
      const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      if (mounted) setProfile((data as Profile) ?? null);
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser((data.session?.user as any) ?? null);
      if (data.session?.user) loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser((session?.user as any) ?? null);
      if (session?.user) loadProfile(session.user.id);
      else setProfile(null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, profile, loading };
}
