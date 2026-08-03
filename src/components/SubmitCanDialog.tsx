"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { uploadCanPhoto } from "@/lib/upload-photo";
import { useAuthContext } from "./AuthProvider";

/**
 * Add a can the catalog doesn't have.
 *
 * Signing in is required, and not just for attribution: an account is what makes
 * "one entry per person per can" enforceable, which is the only thing standing
 * between an unmoderated catalog and the same drink appearing five times.
 *
 * A barcode is optional. With one, the server pulls real nutrition from Open
 * Food Facts instead of trusting what was typed. Without one the can still
 * appears — that is the only route for store brands like Aldi's Gridlock that no
 * public database carries.
 *
 * A photo is uploaded straight to Supabase Storage from here, before the form is
 * submitted, and only its path is sent on. Storage RLS confines a user to a
 * folder named after their own id, and the route re-checks that prefix.
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
  /** Local preview URL, plus the storage path once the upload finishes. */
  const [photo, setPhoto] = useState<{ preview: string; path: string } | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    const result = await uploadCanPhoto(file);
    setUploading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setPhoto({ preview: URL.createObjectURL(file), path: result.path });
  };

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
          photoPath: photo?.path,
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
              Adding a can needs an account. That is how Cansensus keeps one
              entry per person per can instead of the same drink appearing five
              times.
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
              The barcode is the useful bit: with it we look the can up in Open
              Food Facts and fill in real nutrition, and it becomes the can&apos;s
              permanent id so nobody can add a duplicate under a different
              spelling. Without one the can still appears — that is how store
              brands get in — we just use the figures you type.
            </p>

            <Field
              id="barcode"
              label="Barcode"
              hint="12–13 digits under the bars · fills the rest in"
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
                hint={form.barcode.trim() ? "or leave to the barcode" : "oz or ml"}
                value={form.size}
                onChange={set("size")}
                placeholder="16 oz"
                required={!form.barcode.trim()}
              />
              <Field
                id="caf"
                label="Caffeine (mg)"
                hint={
                  form.barcode.trim() ? "or leave to the barcode" : "off the label"
                }
                value={form.caf}
                onChange={set("caf")}
                placeholder="200"
                inputMode="numeric"
                required={!form.barcode.trim()}
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

            <div className="field" style={{ flex: "1 1 100%" }}>
              <span className="label" style={{ display: "block" }}>
                Photo
                <span style={{ color: "var(--faint)", letterSpacing: 0 }}>
                  {" "}
                  · optional, a shot of the can itself
                </span>
              </span>
              <div className="photoRow">
                {photo ? (
                  <>
                    {/* a local object URL, so next/image would add nothing */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.preview}
                      alt="Your can photo"
                      className="photoPreview"
                    />
                    <button
                      type="button"
                      className="btnGhost"
                      onClick={() => setPhoto(null)}
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <label className="photoDrop mono">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => void pickPhoto(e.target.files?.[0])}
                      hidden
                    />
                    {uploading ? "Uploading…" : "Choose or take a photo"}
                  </label>
                )}
              </div>
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
              <button
                type="submit"
                className="btnPrimary"
                disabled={busy || uploading}
              >
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
              Submitting the same can again updates your earlier entry instead
              of adding a duplicate.
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
  hint?: React.ReactNode;
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
