import { FormEvent, useState } from "react";
import { api } from "../api";

export default function LoginPage({
  onSuccess,
  authEnabled,
}: {
  onSuccess: () => void;
  authEnabled: boolean;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await api.login(password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>Edwin Admin</h1>

        {!authEnabled && (
          <p className="muted">
            Auth is disabled (no ADMIN_PASSWORD set) — this page is open to
            anyone with network access.
          </p>
        )}

        <input
          type="password"
          placeholder="Admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />

        {error && <div className="error">{error}</div>}

        <button className="btn primary" disabled={busy || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
