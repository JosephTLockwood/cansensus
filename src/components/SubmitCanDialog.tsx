"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { useAuthContext } from "./AuthProvider";

/**
 * Add a can the league doesn't have.
 *
 * Signing in is required, and not just for attribution: an account is what makes
 * "one submission per person per can" enforceable. Without it the queue fills
 * with the same can over and over.
 *
 * A barcode is optional but strongly encouraged — with one, the server can
 * corroborate against Open Food Facts and the can goes live immediately with
 * sourced nutrition. Without one it goes to the review queue, which is the only
 * route for store brands like Aldi's Gridlock that no public database carries.
 */
export function SubmitCanDialog({
  onClose,
  onSubmitted,
}: {
  onClose: () => void;
  onSubmitted: (message: string) => void;
}) {
  const { session, profile } = useAuthContext();
  const [form, setForm] = useState({
    barcode: "",
    name: "",
    brand: "",
    size: "",
    caf: "",
    sug: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const signedIn = Boolean(session && profile);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const supabase = getSupabase();
      const token = (await supabase?.auth.getSession())?.data.session
        ?.access_token;
      if (!token) {
        setError("Your session expired — sign in again.");
        return;
      }

      // Accept "16 oz", "473 ml" or a bare number of ounces.
      const raw = form.size.trim().toLowerCase();
      let ml: number | null = null;
      const mlMatch = raw.match(/([\d.]+)\s*ml/);
      const ozMatch = raw.match(/([\d.]+)\s*(fl\.?\s*oz|oz)?$/);
      if (mlMatch) ml = parseFloat(mlMatch[1]);
      else if (ozMatch) ml = parseFloat(ozMatch[1]) * 29.5735;

      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          barcode: form.barcode || undefined,
          name: form.name,
          brand: form.brand,
          ml: ml ?? undefined,
          caf: form.caf || undefined,
          sug: form.sug || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
        return;
      }
      onSubmitted(json.message);
      onClose();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modalScrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-title"
    >
      <form className="modalCard modalCardWide" onSubmit={submit}>
        <div className="label" style={{ marginBottom: 10 }}>
          Missing a can?
        </div>
        <h2 id="submit-title" className="modalTitle display">
          Add a can
        </h2>

        {!signedIn ? (
          <>
            <p className="modalCopy">
              Adding a can needs an account. That is how the league keeps one
              submission per person per can instead of the same drink appearing
              five times.
            </p>
            <div className="modalActions">
              <button type="button" className="btnGhost" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="modalCopy">
              With a barcode we check it against Open Food Facts and it goes live
              straight away with real nutrition. Without one it goes to the
              review queue — which is the only way in for store brands.
            </p>

            <Field
              id="barcode"
              label="Barcode"
              hint="optional, but gets it live instantly"
              value={form.barcode}
              onChange={set("barcode")}
              placeholder="070847022206"
              inputMode="numeric"
            />
            <div className="fieldRow">
              <Field
                id="brand"
                label="Brand"
                value={form.brand}
                onChange={set("brand")}
                placeholder="Gridlock"
                required
              />
              <Field
                id="name"
                label="Flavour"
                value={form.name}
                onChange={set("name")}
                placeholder="Blue Raspberry"
                required
              />
            </div>
            <div className="fieldRow">
              <Field
                id="size"
                label="Size"
                hint="oz or ml"
                value={form.size}
                onChange={set("size")}
                placeholder="16 oz"
                required
              />
              <Field
                id="caf"
                label="Caffeine (mg)"
                hint="off the label"
                value={form.caf}
                onChange={set("caf")}
                placeholder="200"
                inputMode="numeric"
                required
              />
              <Field
                id="sug"
                label="Sugar (g)"
                hint="optional"
                value={form.sug}
                onChange={set("sug")}
                placeholder="0"
                inputMode="numeric"
              />
            </div>

            {error && (
              <p
                className="mono"
                style={{ color: "var(--orange)", fontSize: 11, marginTop: 4 }}
              >
                {error}
              </p>
            )}

            <div className="modalActions">
              <button type="submit" className="btnPrimary" disabled={busy}>
                {busy ? "Checking…" : "Submit can →"}
              </button>
              <button type="button" className="btnGhost" onClick={onClose}>
                Cancel
              </button>
            </div>
            <p
              className="mono"
              style={{ fontSize: 10, color: "var(--faint)", marginTop: 12 }}
            >
              Submitting again updates your earlier entry rather than adding a
              duplicate.
            </p>
          </>
        )}
      </form>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  placeholder,
  required,
  inputMode,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  inputMode?: "numeric" | "text";
}) {
  return (
    <div className="field">
      <label htmlFor={id} className="label" style={{ display: "block" }}>
        {label}
        {hint && (
          <span style={{ color: "var(--faint)", letterSpacing: 0 }}>
            {" "}
            · {hint}
          </span>
        )}
      </label>
      <input
        id={id}
        className="mono handleInput"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        inputMode={inputMode}
        autoComplete="off"
      />
    </div>
  );
}
