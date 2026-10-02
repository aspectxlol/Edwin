import { useCallback, useEffect, useState } from "react";
import { api, GroupRow, UserRow } from "../api";

const PERM_KEYS = [
  "chat.reply",
  "tools.notes.*",
  "tools.reminders.*",
  "tools.order.*",
  "tools.system.*",
  "*",
];

const EFFECTS = ["", "allow", "deny"] as const;

function PermissionEditor({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const entries = Object.entries(value);

  return (
    <div className="perm-editor">
      {entries.map(([key, effect]) => (
        <div className="perm-row" key={key}>
          <code>{key}</code>
          <select
            value={effect}
            onChange={(e) => {
              const next = { ...value };

              if (e.target.value === "") {
                delete next[key];
              } else {
                next[key] = e.target.value;
              }

              onChange(next);
            }}
          >
            {EFFECTS.map((fx) => (
              <option key={fx} value={fx}>
                {fx === "" ? "(unset)" : fx}
              </option>
            ))}
          </select>
          <button
            className="btn ghost small"
            onClick={() => {
              const next = { ...value };

              delete next[key];
              onChange(next);
            }}
          >
            ×
          </button>
        </div>
      ))}

      <AddPermissionRow
        onAdd={(key, effect) => onChange({ ...value, [key]: effect })}
      />
    </div>
  );
}

function AddPermissionRow({
  onAdd,
}: {
  onAdd: (key: string, effect: "allow" | "deny") => void;
}) {
  const [key, setKey] = useState("");
  const [effect, setEffect] = useState<"allow" | "deny">("allow");

  return (
    <div className="perm-row add">
      <input
        list="perm-keys"
        placeholder="e.g. tools.order.create"
        value={key}
        onChange={(e) => setKey(e.target.value)}
      />
      <datalist id="perm-keys">
        {PERM_KEYS.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
      <select
        value={effect}
        onChange={(e) => setEffect(e.target.value as "allow" | "deny")}
      >
        <option value="allow">allow</option>
        <option value="deny">deny</option>
      </select>
      <button
        className="btn small"
        disabled={!key.trim()}
        onClick={() => {
          onAdd(key.trim(), effect);
          setKey("");
        }}
      >
        +
      </button>
    </div>
  );
}

export default function PermissionsPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [tab, setTab] = useState<"users" | "groups">("users");
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [u, g] = await Promise.all([api.users(), api.groups()]);

      setUsers(u);
      setGroups(g);
      setDirty({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function patchUser(u: UserRow, patch: Partial<UserRow>) {
    setUsers((prev) =>
      prev.map((row) =>
        row.platformId === u.platformId ? { ...row, ...patch } : row,
      ),
    );
    setDirty((d) => ({ ...d, [`u:${u.platformId}`]: true }));
  }

  function patchGroup(g: GroupRow, patch: Partial<GroupRow>) {
    setGroups((prev) =>
      prev.map((row) =>
        row.platformId === g.platformId ? { ...row, ...patch } : row,
      ),
    );
    setDirty((d) => ({ ...d, [`g:${g.platformId}`]: true }));
  }

  async function saveUser(u: UserRow) {
    try {
      await api.updateUser(u.platformId, {
        isOwner: u.isOwner,
        permissions: u.permissions,
        preferences: u.preferences,
      });
      setDirty((d) => ({ ...d, [`u:${u.platformId}`]: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function saveGroup(g: GroupRow) {
    try {
      await api.updateGroup(g.platformId, {
        autoParticipate: g.autoParticipate,
        permissions: g.permissions,
        preferences: g.preferences,
      });
      setDirty((d) => ({ ...d, [`g:${g.platformId}`]: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Permissions</h1>
        <div className="tabs">
          <button
            className={tab === "users" ? "tab active" : "tab"}
            onClick={() => setTab("users")}
          >
            Users ({users.length})
          </button>
          <button
            className={tab === "groups" ? "tab active" : "tab"}
            onClick={() => setTab("groups")}
          >
            Groups ({groups.length})
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {tab === "users" &&
        users.map((u) => (
          <div className="card" key={u.platformId}>
            <div className="card-head">
              <div>
                <strong>{u.displayName ?? "(unnamed)"}</strong>
                <div className="muted mono">{u.platformId}</div>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={u.isOwner}
                  onChange={(e) => patchUser(u, { isOwner: e.target.checked })}
                />
                Owner
              </label>
            </div>

            <PermissionEditor
              value={u.permissions}
              onChange={(permissions) => patchUser(u, { permissions })}
            />

            <div className="card-actions">
              <button
                className={dirty[`u:${u.platformId}`] ? "btn primary" : "btn"}
                disabled={!dirty[`u:${u.platformId}`]}
                onClick={() => saveUser(u)}
              >
                Save
              </button>
            </div>
          </div>
        ))}

      {tab === "groups" &&
        groups.map((g) => (
          <div className="card" key={g.platformId}>
            <div className="card-head">
              <div>
                <strong>{g.name ?? "(unnamed)"}</strong>
                <div className="muted mono">{g.platformId}</div>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={g.autoParticipate}
                  onChange={(e) =>
                    patchGroup(g, { autoParticipate: e.target.checked })
                  }
                />
                Auto-participate
              </label>
            </div>

            <PermissionEditor
              value={g.permissions}
              onChange={(permissions) => patchGroup(g, { permissions })}
            />

            <div className="card-actions">
              <button
                className={dirty[`g:${g.platformId}`] ? "btn primary" : "btn"}
                disabled={!dirty[`g:${g.platformId}`]}
                onClick={() => saveGroup(g)}
              >
                Save
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}
