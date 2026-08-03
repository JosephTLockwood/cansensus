"use client";

import { useEffect, useState } from "react";
import { HANDLE_PATTERN } from "@/lib/use-auth";

/**
 * Shown once, immediately after a first Google sign-in.
 *
 * The point of this screen is that Google gave us a real name and we are not
 * going to use it. Nothing about the user is publicly visible until they choose
 * a handle here.
 */
export function HandlePicker({
  onClaim,
  onCheck,
  onSignOut,
}: {
  onClaim: (handle: string) => Promise<{ error: string | null }>;
  onCheck: (handle: string) => Promise<boolean>;
  onSignOut: () => void;
}) {
  const [value, setValue] = useState("");
  /** Result of the last completed lookup, tagged with the handle it was for. */
  const [checked, setChecked] = useState<{ handle: string; free: boolean } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handle = value.trim().toLowerCase();

  // Everything except the network result is derived, so the effect never has to
  // set state synchronously just to describe what the input already says.
  const status: "idle" | "invalid" | "checking" | "free" | "taken" = !handle
    ? "idle"
    : !HANDLE_PATTERN.test(handle)
      ? "invalid"
      : checked?.handle === handle
        ? checked.free
          ? "free"
          : "taken"
        : "checking";

  // Debounced availability check, so every keystroke isn't a round trip.
  useEffect(() => {
    if (!handle || !HANDLE_PATTERN.test(handle)) return;
    let active = true;
    const t = setTimeout(async () => {
      const free = await onCheck(handle);
      if (active) setChecked({ handle, free });
    }, 400);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [handle, onCheck]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const { error: err } = await onClaim(handle);
    setSaving(false);
    if (err) setError(err);
  };

  return (
    <div className="modalScrim" role="dialog" aria-modal="true" aria-labelledby="handle-title">
      <form className="modalCard" onSubmit={submit}>
        <div className="label" style={{ marginBottom: 10 }}>
          One thing first
        </div>
        <h2 id="handle-title" className="modalTitle display">
          Pick a handle
        </h2>
        <p className="modalCopy">
          This is the only name the league ever shows. Your Google name and email
          stay private — they are never copied anywhere other people can read.
        </p>

        <label htmlFor="handle" className="label" style={{ display: "block", marginBottom: 8 }}>
          Handle
        </label>
        <input
          id="handle"
          className="mono handleInput"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="tallboy_tori"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={20}
          autoFocus
        />

        <div className="handleStatus mono">
          {status === "idle" && (
            <span style={{ color: "var(--faint)" }}>
              3–20 characters · lowercase, numbers, underscores
            </span>
          )}
          {status === "invalid" && (
            <span style={{ color: "var(--orange)" }}>
              Lowercase letters, numbers and underscores only, 3–20 characters.
            </span>
          )}
          {status === "checking" && (
            <span style={{ color: "var(--faint)" }}>Checking…</span>
          )}
          {status === "free" && (
            <span style={{ color: "var(--lime)" }}>{handle} is available</span>
          )}
          {status === "taken" && (
            <span style={{ color: "var(--orange)" }}>
              {handle} is taken or reserved
            </span>
          )}
        </div>

        {error && (
          <p className="mono" style={{ color: "var(--orange)", fontSize: 11 }}>
            {error}
          </p>
        )}

        <div className="modalActions">
          <button
            type="submit"
            className="btnPrimary"
            disabled={status !== "free" || saving}
            style={
              status !== "free" || saving
                ? { opacity: 0.45, cursor: "not-allowed" }
                : undefined
            }
          >
            {saving ? "Claiming…" : "Claim it →"}
          </button>
          <button type="button" className="btnGhost" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </form>
    </div>
  );
}
