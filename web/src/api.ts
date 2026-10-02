export interface UserRow {
  id: number;
  platformId: string;
  displayName: string | null;
  platform: string;
  isOwner: boolean;
  permissions: Record<string, string>;
  preferences: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GroupRow {
  id: number;
  platformId: string;
  name: string | null;
  platform: string;
  autoParticipate: boolean;
  permissions: Record<string, string>;
  preferences: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationRow {
  conversationId: string;
  name: string;
  isGroup: boolean;
  lastMessageAt: string | null;
  messageCount: number;
}

export interface MessageRow {
  id: number;
  conversationId: string;
  senderId: string;
  senderName: string | null;
  role: "human" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface NoteRow {
  id: number;
  content: string;
  recipientId: string | null;
  conversationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderRow {
  id: number;
  content: string;
  remindAt: string | null;
  completed: boolean;
  recipientId: string | null;
  conversationId: string | null;
  createdAt: string;
  updatedAt: string;
}

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));

    throw new ApiError(
      res.status,
      (body as { error?: string }).error ?? res.statusText,
    );
  }

  return res.json() as Promise<T>;
}

export const api = {
  me: () =>
    request<{ authenticated: boolean; authEnabled: boolean }>("/api/me"),
  login: (password: string) =>
    request<{ ok: boolean }>("/api/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  logout: () => request<{ ok: boolean }>("/api/logout", { method: "POST" }),

  users: () => request<UserRow[]>("/api/users"),
  updateUser: (platformId: string, patch: Partial<UserRow>) =>
    request<UserRow>(`/api/users/${encodeURIComponent(platformId)}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  groups: () => request<GroupRow[]>("/api/groups"),
  updateGroup: (platformId: string, patch: Partial<GroupRow>) =>
    request<GroupRow>(`/api/groups/${encodeURIComponent(platformId)}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  conversations: () => request<ConversationRow[]>("/api/conversations"),
  messages: (conversationId: string, limit = 200) =>
    request<MessageRow[]>(
      `/api/messages/${encodeURIComponent(conversationId)}?limit=${limit}`,
    ),

  notes: (params: { search?: string; conversationId?: string } = {}) => {
    const qs = new URLSearchParams();

    if (params.search) qs.set("search", params.search);
    if (params.conversationId) qs.set("conversationId", params.conversationId);

    const query = qs.toString();

    return request<NoteRow[]>(`/api/notes${query ? `?${query}` : ""}`);
  },
  createNote: (content: string, conversationId?: string) =>
    request<NoteRow>("/api/notes", {
      method: "POST",
      body: JSON.stringify({ content, conversationId }),
    }),
  updateNote: (id: number, content: string) =>
    request<NoteRow>(`/api/notes/${id}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),
  deleteNote: (id: number) =>
    request<{ ok: boolean }>(`/api/notes/${id}`, { method: "DELETE" }),

  reminders: () =>
    request<{ scheduled: ReminderRow[]; unscheduled: ReminderRow[] }>(
      "/api/reminders",
    ),
  createReminder: (
    content: string,
    remindAt?: string,
    conversationId?: string,
  ) =>
    request<ReminderRow>("/api/reminders", {
      method: "POST",
      body: JSON.stringify({ content, remindAt, conversationId }),
    }),
  updateReminder: (
    id: number,
    patch: { content?: string; remindAt?: string | null; completed?: boolean },
  ) =>
    request<ReminderRow>(`/api/reminders/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  deleteReminder: (id: number) =>
    request<{ ok: boolean }>(`/api/reminders/${id}`, { method: "DELETE" }),
};
