import { useState } from "react";
import { sendSignInLink, signOut, syncConfigured, syncNow, useSync } from "../sync/sync";

function ago(ts?: number): string {
  if (!ts) return "";
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function AccountCard() {
  const sync = useSync();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (!syncConfigured) {
    return (
      <section className="card">
        <h2 className="card-title">Account & sync</h2>
        <p className="muted">
          Cloud sync isn't switched on for this site yet. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in Vercel's environment variables
          and redeploy. Until then, everything is saved on this device, and you can move it with a backup file on the Progress page.
        </p>
      </section>
    );
  }

  if (sync.email) {
    return (
      <section className="card">
        <h2 className="card-title">Account & sync</h2>
        <p>
          Signed in as <strong>{sync.email}</strong>
        </p>
        <p className={sync.status === "error" ? "warn" : "muted"} role="status">
          {sync.status === "syncing" && "Syncing…"}
          {sync.status === "synced" && `✓ Synced ${ago(sync.lastSync)}`}
          {sync.status === "error" && sync.error}
        </p>
        <div className="row-buttons">
          <button type="button" className="btn" onClick={() => void syncNow()} disabled={sync.status === "syncing"}>
            Sync now
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (confirm("Sign out? Your progress stays on this device and in your account.")) void signOut();
            }}
          >
            Sign out
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <h2 className="card-title">Account & sync</h2>
      <p className="muted">Sign in to keep your progress, settings and presets in sync across your phone and computer. No password: we email you a sign-in link.</p>
      {sent ? (
        <p role="status">
          Check your email for a sign-in link, then open it on this device. <br />
          <button type="button" className="link" onClick={() => setSent(false)}>
            Use a different email
          </button>
        </p>
      ) : (
        <form
          className="field-row"
          onSubmit={async (e) => {
            e.preventDefault();
            setSending(true);
            setErr(null);
            const error = await sendSignInLink(email.trim());
            setSending(false);
            if (error) setErr(error);
            else setSent(true);
          }}
        >
          <input className="text-input" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
          <button type="submit" className="btn primary" disabled={sending || !email.includes("@")}>
            {sending ? "Sending…" : "Send link"}
          </button>
        </form>
      )}
      {err && <p className="warn">{err}</p>}
    </section>
  );
}
