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
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel — branding */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background: "linear-gradient(145deg, oklch(0.28 0.06 255) 0%, oklch(0.45 0.2 268) 50%, oklch(0.55 0.22 258) 100%)",
        }}
      >
        {/* Decorative blobs */}
        <div style={{
          position: "absolute", top: "-80px", right: "-80px", width: "320px", height: "320px",
          borderRadius: "50%", background: "oklch(1 0 0 / 0.06)", filter: "blur(60px)",
        }} />
        <div style={{
          position: "absolute", bottom: "-60px", left: "-60px", width: "280px", height: "280px",
          borderRadius: "50%", background: "oklch(1 0 0 / 0.08)", filter: "blur(50px)",
        }} />

        <div className="relative">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "48px" }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "oklch(1 0 0 / 0.15)", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <SparkleIcon />
            </div>
            <span style={{ color: "white", fontWeight: 600, fontSize: "1.1rem", letterSpacing: "-0.02em" }}>
              Inspired for Change
            </span>
          </div>
          <h2 style={{ color: "white", fontSize: "clamp(2rem, 4vw, 2.8rem)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.15, marginBottom: "16px" }}>
            Guest Registration<br />Made Simple
          </h2>
          <p style={{ color: "oklch(1 0 0 / 0.7)", fontSize: "1rem", lineHeight: 1.6, maxWidth: "360px" }}>
            Register and track event guests across multiple days with real-time collaboration for your entire team.
          </p>
        </div>

        <div style={{ position: "relative" }}>
          {[
            { icon: "✓", label: "Real-time guest tracking" },
            { icon: "✓", label: "Multi-device staff access" },
            { icon: "✓", label: "Instant duplicate detection" },
            { icon: "✓", label: "CSV export & print reports" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <div style={{
                width: "22px", height: "22px", borderRadius: "6px",
                background: "oklch(1 0 0 / 0.15)", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "12px", color: "white", flexShrink: 0,
              }}>
                {item.icon}
              </div>
              <span style={{ color: "oklch(1 0 0 / 0.8)", fontSize: "0.9rem" }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 sm:px-8 min-h-screen lg:min-h-0">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 text-center slide-up">
          <div style={{
            width: "52px", height: "52px", borderRadius: "16px", margin: "0 auto 12px",
            background: "linear-gradient(135deg, oklch(0.28 0.06 255), oklch(0.55 0.22 258))",
            display: "flex", alignItems: "center", justifyContent: "center", color: "white",
          }}>
            <SparkleIcon />
          </div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "4px" }}>
            Inspired for Change
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--color-muted-foreground)" }}>
            Guest registration system
          </p>
        </div>

        <div className="w-full max-w-[420px] slide-up">
          {/* Tab switcher */}
          <div style={{
            display: "flex", background: "var(--color-secondary)", borderRadius: "14px",
            padding: "4px", marginBottom: "24px",
          }}>
            {(["signup", "signin"] as const).map((m) => (
              <button
                key={m}
                id={`auth-tab-${m}`}
                type="button"
                onClick={() => { setMode(m); setError(""); setSuccess(""); }}
                style={{
                  flex: 1, padding: "10px 16px", borderRadius: "10px", fontSize: "0.875rem",
                  fontWeight: 500, border: "none", cursor: "pointer", transition: "all 0.2s ease",
                  background: mode === m ? "var(--color-card)" : "transparent",
                  color: mode === m ? "var(--color-foreground)" : "var(--color-muted-foreground)",
                  boxShadow: mode === m ? "var(--shadow-soft)" : "none",
                }}
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
