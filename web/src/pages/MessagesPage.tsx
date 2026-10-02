import { useCallback, useEffect, useRef, useState } from "react";
import { api, ConversationRow, MessageRow } from "../api";

export default function MessagesPage() {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [selected, setSelected] = useState<ConversationRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .conversations()
      .then(setConversations)
      .catch(() => setConversations([]));
  }, []);

  const open = useCallback(async (conversation: ConversationRow) => {
    setSelected(conversation);
    setLoading(true);

    try {
      const msgs = await api.messages(conversation.conversationId, 200);

      setMessages(msgs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="messages-layout">
      <div className="conversation-list">
        <h1>Chats</h1>
        {conversations.map((c) => (
          <button
            key={c.conversationId}
            className={
              selected?.conversationId === c.conversationId
                ? "conversation active"
                : "conversation"
            }
            onClick={() => open(c)}
          >
            <div className="conversation-name">
              {c.isGroup && <span className="badge">G</span>}
              {c.name}
            </div>
            <div className="muted small-text">
              {c.messageCount} messages
              {c.lastMessageAt
                ? ` · ${new Date(c.lastMessageAt).toLocaleDateString()}`
                : ""}
            </div>
          </button>
        ))}
        {conversations.length === 0 && (
          <p className="muted">No conversations yet.</p>
        )}
      </div>

      <div className="message-view">
        {selected && (
          <div className="message-header">
            <strong>{selected.name}</strong>
            <span className="muted mono">{selected.conversationId}</span>
          </div>
        )}

        <div className="message-scroll">
          {loading && <p className="muted">Loading…</p>}

          {!loading &&
            messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === "assistant" ? "bubble bot" : "bubble human"
                }
              >
                <div className="bubble-meta">
                  {m.senderName ?? m.senderId} ·{" "}
                  {new Date(m.createdAt).toLocaleString()}
                </div>
                <div className="bubble-text">
                  {m.content || <em>[attachment]</em>}
                </div>
              </div>
            ))}

          {!loading && selected && messages.length === 0 && (
            <p className="muted">No messages.</p>
          )}

          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
