import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import {
  ArrowRight,
  Campfire,
  Church,
  Eye,
  EyeSlash,
  IdentificationBadge,
  QrCode,
  UsersThree,
} from "@phosphor-icons/react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Registrar Sign in — Inspired for Change" },
      { name: "description", content: "Sanctuary & church event registration desk sign in." },
    ],
  }),
  component: AuthPage,
});

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

const signUpSchema = signInSchema.extend({
  displayName: z.string().trim().min(2, "Full name must be at least 2 characters").max(80),
});

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      if (mode === "signup") {
        const parsed = signUpSchema.safeParse({ email, password, displayName });
        if (!parsed.success) {
          setError(parsed.error.issues[0].message);
          setLoading(false);
          return;
        }
        const { data, error: err } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
            data: { display_name: parsed.data.displayName },
          },
        });
        if (err) throw new Error(err.message);
        if (data?.session) {
          await router.invalidate();
          navigate({ to: "/", replace: true });
          return;
        }
        setSuccess("Staff account created. You can now sign in below.");
        setMode("signin");
        setPassword("");
      } else {
        const parsed = signInSchema.safeParse({ email, password });
        if (!parsed.success) {
          setError(parsed.error.issues[0].message);
          setLoading(false);
          return;
        }
        const { error: err } = await supabase.auth.signInWithPassword(parsed.data);
        if (err) throw new Error(err.message);
        await router.invalidate();
        navigate({ to: "/", replace: true });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-[100dvh] grid-cols-1 bg-background lg:grid-cols-12">
      {/* Left Architectural Sanctuary Editorial Panel */}
      <aside className="hidden flex-col justify-between bg-primary p-12 text-primary-foreground lg:col-span-5 lg:flex">
        <div className="space-y-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/14">
              <Church size={22} weight="duotone" aria-hidden="true" />
            </div>
            <div>
              <span className="block text-base font-bold tracking-tight">Inspired for Change</span>
              <span className="block text-xs opacity-75">Sanctuary & Church Event Operations</span>
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="max-w-[16ch] text-4xl leading-[1.08] font-extrabold tracking-tight">
              Orderly hospitality for every gathering.
            </h1>
            <p className="max-w-[44ch] text-sm leading-relaxed opacity-80">
              Manage Inspired for Change convocations, youth camps, leadership summits, seminars,
              and partner organization events with canonical UUID passes and multi-event manager
              telemetry.
            </p>
          </div>
        </div>

        <div className="space-y-3.5 border-t border-primary-foreground/15 pt-8 text-xs">
          {[
            {
              Icon: IdentificationBadge,
              text: "Canonical UUID v4 records & printable QR badge passes (no phone-as-ID blocks)",
            },
            {
              Icon: Campfire,
              text: "Gender-aware dormitory allocation & multi-day session attendance",
            },
            {
              Icon: UsersThree,
              text: "Shared family phone linking for spouses, children, and parish delegations",
            },
            {
              Icon: QrCode,
              text: "Instant gate check-in desk & live pastoral follow-up telemetry",
            },
          ].map(({ Icon, text }) => (
            <div key={text} className="flex items-center gap-3 opacity-90">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/12">
                <Icon size={15} aria-hidden="true" />
              </span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Right Registrar Sign-in Workspace */}
      <div className="flex flex-col items-center justify-center px-5 py-12 sm:px-8 lg:col-span-7">
        <div className="w-full max-w-[420px] space-y-6">
          {/* Mobile Header */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Church size={21} weight="duotone" aria-hidden="true" />
            </div>
            <div>
              <div className="text-base font-bold text-foreground">Inspired for Change</div>
              <div className="text-xs text-muted-foreground">
                Church Events & Sanctuary Registry
              </div>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 rounded-2xl border border-border bg-secondary p-1">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                id={`auth-tab-${m}`}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError("");
                  setSuccess("");
                }}
                className={`cursor-pointer rounded-xl py-2.5 text-xs font-semibold ${
                  mode === m
                    ? "bg-card text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "signin" ? "Registrar sign in" : "New staff account"}
              </button>
            ))}
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {mode === "signin" ? "Welcome back to the desk" : "Create your registrar profile"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {mode === "signin"
                ? "Sign in to issue attendee passes, manage dormitories, and verify arrivals."
                : "Onboard as a church registrar, usher, or camp coordinator."}
            </p>
          </div>

          <div className="bezel-shell">
            <form onSubmit={onSubmit} className="bezel-core space-y-4 p-6 sm:p-7">
              {mode === "signup" && (
                <div>
                  <label
                    htmlFor="auth-display-name"
                    className="mb-1.5 block text-xs font-semibold text-foreground"
                  >
                    Full name
                  </label>
                  <input
                    id="auth-display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Pastor Daniel Mwakasege"
                    required
                    autoComplete="name"
                    className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm text-foreground"
                  />
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="mb-1.5 block text-xs font-semibold text-foreground">
                  Email address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="registrar@church.org"
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm text-foreground"
                />
              </div>

              <div>
                <label htmlFor="auth-password" className="mb-1.5 block text-xs font-semibold text-foreground">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    className="w-full rounded-xl border border-border bg-input py-2.5 pr-11 pl-3.5 text-sm text-foreground"
                  />
                  <button
                    type="button"
                    id="auth-toggle-password"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer rounded-lg p-1 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <Eye size={17} /> : <EyeSlash size={17} />}
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs font-medium text-destructive">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-xl border border-success/30 bg-success/10 px-3.5 py-2.5 text-xs font-medium text-success">
                  {success}
                </div>
              )}

              <button
                id="auth-submit-btn"
                type="submit"
                disabled={loading}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-95 disabled:opacity-50"
              >
                <span>{loading ? "Authenticating…" : mode === "signin" ? "Sign in to workspace" : "Create staff account"}</span>
                <ArrowRight size={16} weight="bold" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
