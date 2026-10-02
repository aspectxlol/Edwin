import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, NoteRow } from "../api";

export default function NotesPage() {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [search, setSearch] = useState("");
  const [newContent, setNewContent] = useState("");
  const [editing, setEditing] = useState<{
    id: number;
    content: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setNotes(await api.notes({ search: search || undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();

    if (!newContent.trim()) return;

    try {
      await api.createNote(newContent);
      setNewContent("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function saveEdit() {
    if (!editing) return;

    try {
      await api.updateNote(editing.id, editing.content);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function remove(id: number) {
    try {
      await api.deleteNote(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div>
      <h1>Notes</h1>

      {error && <div className="error">{error}</div>}

      <form className="card inline-form" onSubmit={create}>
        <input
          placeholder="New note…"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
        />
        <button className="btn primary">Add</button>
      </form>

      <input
        className="search"
        placeholder="Search notes…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {notes.map((note) => (
        <div className="card" key={note.id}>
          {editing?.id === note.id ? (
            <div className="note-edit">
              <input
                value={editing.content}
                onChange={(e) =>
                  setEditing({ ...editing, content: e.target.value })
                }
              />
              <div className="card-actions">
                <button className="btn primary small" onClick={saveEdit}>
                  Save
                </button>
                <button className="btn small" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="note-content">{note.content}</div>
              <div className="card-actions">
                <span className="muted small-text">
                  {note.conversationId ?? "no chat"} ·{" "}
                  {new Date(note.updatedAt).toLocaleString()}
                </span>
                <button
                  className="btn small"
                  onClick={() =>
                    setEditing({ id: note.id, content: note.content })
                  }
                >
                  Edit
                </button>
                <button
                  className="btn small danger"
                  onClick={() => remove(note.id)}
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      {notes.length === 0 && <p className="muted">No notes found.</p>}
    </div>
  );
}
