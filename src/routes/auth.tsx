import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "Sign in — Inspired for Change" }, { name: "description", content: "Staff sign in for guest registration." }],
  }),
  component: AuthPage,
});

const signInSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "At least 6 characters").max(72),
});

const signUpSchema = signInSchema.extend({
  displayName: z.string().trim().min(2, "Required").max(80),
});

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        const parsed = signUpSchema.safeParse({ email, password, displayName });
        if (!parsed.success) {
          setError(parsed.error.issues[0].message);
          setLoading(false);
          return;
        }
        const { error: err } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
            data: { display_name: parsed.data.displayName },
          },
        });
        if (err) throw err;
      } else {
        const parsed = signInSchema.safeParse({ email, password });
        if (!parsed.success) {
          setError(parsed.error.issues[0].message);
          setLoading(false);
          return;
        }
        const { error: err } = await supabase.auth.signInWithPassword(parsed.data);
        if (err) throw err;
      }
      await router.invalidate();
      navigate({ to: "/", replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="w-full max-w-md fade-in">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-display font-semibold tracking-tight">Inspired for Change</h1>
          <p className="mt-3 text-muted-foreground">
            {mode === "signin" ? "Sign in to continue" : "Create your staff account"}
          </p>
        </div>

        <form onSubmit={onSubmit} className="surface-elevated p-8 space-y-5">
          {mode === "signup" && (
            <div>
              <label className="block text-sm font-medium mb-2">Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                placeholder="Jane Doe"
                required
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              placeholder="••••••••"
              required
            />
          </div>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-xl">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all disabled:opacity-50"
          >
            {loading ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-muted-foreground">
          {mode === "signin" ? "New staff member?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError("");
            }}
            className="text-accent hover:underline font-medium"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
