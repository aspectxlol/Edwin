import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, ReminderRow } from "../api";

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return "";

  // Format for <input type="datetime-local">: YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ReminderCard({
  reminder,
  onChanged,
}: {
  reminder: ReminderRow;
  onChanged: () => void;
}) {
  const [content, setContent] = useState(reminder.content);
  const [when, setWhen] = useState(toLocalInputValue(reminder.remindAt));

  async function save() {
    await api.updateReminder(reminder.id, {
      content,
      remindAt: when || null,
    });
    onChanged();
  }

  async function toggleCompleted() {
    await api.updateReminder(reminder.id, { completed: !reminder.completed });
    onChanged();
  }

  async function remove() {
    await api.deleteReminder(reminder.id);
    onChanged();
  }

  return (
    <div className={reminder.completed ? "card done" : "card"}>
      <input
        className="reminder-content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="reminder-row">
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        />
        <button className="btn small" onClick={save}>
          Save
        </button>
        <button className="btn small" onClick={toggleCompleted}>
          {reminder.completed ? "Reopen" : "Complete"}
        </button>
        <button className="btn small danger" onClick={remove}>
          Delete
        </button>
      </div>
      {reminder.conversationId && (
        <div className="muted mono small-text">{reminder.conversationId}</div>
      )}
    </div>
  );
}

export default function RemindersPage() {
  const [scheduled, setScheduled] = useState<ReminderRow[]>([]);
  const [unscheduled, setUnscheduled] = useState<ReminderRow[]>([]);
  const [content, setContent] = useState("");
  const [when, setWhen] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.reminders();

      setScheduled(data.scheduled);
      setUnscheduled(data.unscheduled);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();

    if (!content.trim()) return;

    try {
      await api.createReminder(
        content,
        when || undefined,
        conversationId || undefined,
      );
      setContent("");
      setWhen("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  return (
    <div>
      <h1>Reminders</h1>

      {error && <div className="error">{error}</div>}

      <form className="card inline-form" onSubmit={create}>
        <input
          placeholder="Remind me to…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        />
        <input
          placeholder="Chat JID (optional)"
          className="mono"
          value={conversationId}
          onChange={(e) => setConversationId(e.target.value)}
        />
        <button className="btn primary">Add</button>
      </form>

      <h2>Unscheduled</h2>
      {unscheduled.length === 0 && <p className="muted">None.</p>}
      {unscheduled.map((r) => (
        <ReminderCard key={r.id} reminder={r} onChanged={load} />
      ))}

      <h2>Scheduled</h2>
      {scheduled.length === 0 && <p className="muted">None.</p>}
      {scheduled.map((r) => (
        <ReminderCard key={r.id} reminder={r} onChanged={load} />
      ))}
    </div>
  );
}
