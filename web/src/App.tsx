import { useEffect, useState } from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { api } from "./api";
import LoginPage from "./pages/LoginPage";
import PermissionsPage from "./pages/PermissionsPage";
import RemindersPage from "./pages/RemindersPage";
import MessagesPage from "./pages/MessagesPage";
import NotesPage from "./pages/NotesPage";

export default function App() {
  const [authState, setAuthState] = useState<
    "loading" | "authed" | "guest" | "disabled"
  >("loading");
  const navigate = useNavigate();

  useEffect(() => {
    api
      .me()
      .then((me) => {
        if (!me.authEnabled) {
          setAuthState("disabled");
        } else if (me.authenticated) {
          setAuthState("authed");
        } else {
          setAuthState("guest");
        }
      })
      .catch(() => setAuthState("guest"));
  }, []);

  async function handleLogout() {
    await api.logout();
    setAuthState("guest");
    navigate("/login");
  }

  if (authState === "loading") {
    return <div className="page-loading">Loading…</div>;
  }

  if (authState === "guest") {
    return <LoginPage onSuccess={() => setAuthState("authed")} authEnabled />;
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">Edwin Admin</div>
        <nav>
          <NavLink to="/permissions">Permissions</NavLink>
          <NavLink to="/reminders">Reminders</NavLink>
          <NavLink to="/messages">Messages</NavLink>
          <NavLink to="/notes">Notes</NavLink>
        </nav>
        <button className="btn ghost logout" onClick={handleLogout}>
          Log out
        </button>
      </aside>

      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/permissions" replace />} />
          <Route path="/permissions" element={<PermissionsPage />} />
          <Route path="/reminders" element={<RemindersPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route
            path="/login"
            element={<Navigate to="/permissions" replace />}
          />
        </Routes>
      </main>
    </div>
  );
}
