import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useEvents } from "@/hooks/use-events";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/register")({
  head: () => ({ meta: [{ title: "Register guest — Inspired for Change" }] }),
  component: RegisterPage,
});

const schema = z.object({
  first_name: z.string().trim().min(1, "Required").max(80),
  middle_name: z.string().trim().max(80).optional(),
  last_name: z.string().trim().min(1, "Required").max(80),
  origin: z.string().trim().min(1, "Required").max(120),
  phone: z.string().trim().min(4, "Required").max(40),
  status: z.enum(["camping", "not_camping"]),
});

function RegisterPage() {
  const { selected } = useEvents();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    origin: "",
    phone: "",
    status: "not_camping" as "camping" | "not_camping",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedToast, setSavedToast] = useState("");

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent, andAnother = false) => {
    e.preventDefault();
    setError("");
    if (!selected || !user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const { data, error: err } = await supabase
      .from("guests")
      .insert({
        event_id: selected.id,
        first_name: parsed.data.first_name,
        middle_name: parsed.data.middle_name || null,
        last_name: parsed.data.last_name,
        origin: parsed.data.origin,
        phone: parsed.data.phone,
        status: parsed.data.status,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (andAnother) {
      setForm({
        first_name: "",
        middle_name: "",
        last_name: "",
        origin: form.origin,
        phone: "",
        status: form.status,
      });
      setSavedToast(`${parsed.data.first_name} added`);
      setTimeout(() => setSavedToast(""), 2200);
    } else if (data) {
      navigate({ to: "/guests/$id", params: { id: (data as { id: string }).id } });
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <p className="text-sm text-muted-foreground">{selected?.name}</p>
        <h1 className="text-4xl mt-1">Register a guest</h1>
      </div>

      <form onSubmit={(e) => onSubmit(e, false)} className="surface-elevated p-8 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="First name" required>
            <input
              autoFocus
              value={form.first_name}
              onChange={(e) => update("first_name", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Middle name">
            <input
              value={form.middle_name}
              onChange={(e) => update("middle_name", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Last name" required>
            <input
              value={form.last_name}
              onChange={(e) => update("last_name", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Location / origin" required>
          <input
            value={form.origin}
            onChange={(e) => update("origin", e.target.value)}
            className={inputCls}
            placeholder="City, country"
          />
        </Field>

        <Field label="Phone number" required>
          <input
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            className={inputCls}
            placeholder="+1 555 000 0000"
          />
        </Field>

        <div>
          <label className="block text-sm font-medium mb-2">Status</label>
          <div className="grid grid-cols-2 gap-3">
            <StatusOption
              active={form.status === "camping"}
              onClick={() => update("status", "camping")}
              label="Camping"
            />
            <StatusOption
              active={form.status === "not_camping"}
              onClick={() => update("status", "not_camping")}
              label="Not camping"
            />
          </div>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-xl">{error}</div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save & view"}
          </button>
          <button
            type="button"
            onClick={(e) => onSubmit(e, true)}
            disabled={saving}
            className="px-6 py-3 rounded-full bg-secondary text-secondary-foreground font-medium hover:bg-muted transition-all disabled:opacity-50"
          >
            Save & add another
          </button>
        </div>
      </form>

      {savedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 surface-elevated px-5 py-3 fade-in text-sm">
          ✓ {savedToast}
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring transition-all";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">
        {label} {required && <span className="text-muted-foreground">*</span>}
      </label>
      {children}
    </div>
  );
}

function StatusOption({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
        active
          ? "bg-accent text-accent-foreground border-accent"
          : "bg-secondary text-secondary-foreground border-border hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}
