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
              Manage conferences, youth camps, gospel crusades, and multi-day sanctuary check-ins with canonical UUID passes and household-friendly registration.
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
              <div className="text-xs text-muted-foreground">Church Events & Sanctuary Registry</div>
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
                {m === "signup" ? "Create account" : "Sign in"}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: "20px" }}>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "4px" }}>
              {mode === "signup" ? "Join the team" : "Welcome back"}
            </h2>
            <p style={{ fontSize: "0.875rem", color: "var(--color-muted-foreground)" }}>
              {mode === "signup"
                ? "Create your staff account to start registering guests."
                : "Sign in to your staff account to continue."}
            </p>
          </div>

          <form onSubmit={onSubmit} className="surface-elevated p-6 sm:p-8 space-y-4">
            {mode === "signup" && (
              <div className="fade-in">
                <label htmlFor="auth-display-name" style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "6px", color: "var(--color-foreground)" }}>
                  Full name
                </label>
                <input
                  id="auth-display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={{
                    width: "100%", padding: "11px 14px", borderRadius: "12px",
                    background: "var(--color-input)", border: "1.5px solid var(--color-border)",
                    fontSize: "0.9rem", color: "var(--color-foreground)",
                    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                  }}
                  placeholder="Jane Doe"
                  required
                  autoComplete="name"
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-email" style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "6px" }}>
                Email address
              </label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: "100%", padding: "11px 14px", borderRadius: "12px",
                  background: "var(--color-input)", border: "1.5px solid var(--color-border)",
                  fontSize: "0.9rem", color: "var(--color-foreground)",
                  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                }}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="auth-password" style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "6px" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: "100%", padding: "11px 44px 11px 14px", borderRadius: "12px",
                    background: "var(--color-input)", border: "1.5px solid var(--color-border)",
                    fontSize: "0.9rem", color: "var(--color-foreground)",
                    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                  }}
                  placeholder="••••••••"
                  required
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  id="auth-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", padding: "4px",
                    color: "var(--color-muted-foreground)", display: "flex", alignItems: "center",
                  }}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              {mode === "signup" && (
                <p style={{ fontSize: "0.75rem", color: "var(--color-muted-foreground)", marginTop: "5px" }}>
                  At least 6 characters
                </p>
              )}
            </div>

            {error && (
              <div className="scale-in" style={{
                fontSize: "0.85rem", color: "var(--color-destructive)",
                background: "oklch(0.58 0.22 27 / 0.08)", padding: "10px 14px",
                borderRadius: "10px", border: "1px solid oklch(0.58 0.22 27 / 0.2)",
              }}>
                {error}
              </div>
            )}

            {success && (
              <div className="scale-in" style={{
                fontSize: "0.85rem", color: "var(--color-success)",
                background: "oklch(0.62 0.18 150 / 0.08)", padding: "10px 14px",
                borderRadius: "10px", border: "1px solid oklch(0.62 0.18 150 / 0.2)",
              }}>
                {success}
              </div>
            )}

            <button
              id="auth-submit-btn"
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "13px 20px", borderRadius: "12px", border: "none",
                background: loading ? "var(--color-muted)" : "linear-gradient(135deg, oklch(0.28 0.06 255), oklch(0.45 0.2 268))",
                color: loading ? "var(--color-muted-foreground)" : "white",
                fontWeight: 600, fontSize: "0.9rem", cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 4px 14px oklch(0.45 0.2 268 / 0.3)",
                transition: "all 0.2s ease",
              }}
            >
              {loading ? "Please wait…" : mode === "signin" ? "Sign in →" : "Create account →"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: "20px", fontSize: "0.8rem", color: "var(--color-muted-foreground)" }}>
            {mode === "signup" ? (
              <>Already have an account?{" "}
                <button id="auth-switch-to-signin" onClick={() => { setMode("signin"); setError(""); setSuccess(""); }}
                  style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 600,
                    color: "var(--color-accent)", textDecoration: "underline", fontSize: "inherit" }}>
                  Sign in
                </button>
              </>
            ) : (
              <>New staff member?{" "}
                <button id="auth-switch-to-signup" onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}
                  style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 600,
                    color: "var(--color-accent)", textDecoration: "underline", fontSize: "inherit" }}>
                  Create an account
                </button>
              </>
            )}
          </p>

          <p style={{ textAlign: "center", marginTop: "24px", fontSize: "0.72rem", color: "var(--color-muted-foreground)" }}>
            Staff only · Contact your admin if you need access
          </p>
        </div>
      </div>
    </div>
  );
}
