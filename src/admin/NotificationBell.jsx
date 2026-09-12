import { useEffect, useRef, useState } from "react";
import { Bell, UserPlus, Vote, Trophy, Trash2, CheckCheck, X } from "lucide-react";
import { useNotifications } from "./useNotifications";

// ── Icon per notification type ─────────────────────────────────
function NotifIcon({ type }) {
  const props = { size: 15, "aria-hidden": true };
  switch (type) {
    case "registration": return <UserPlus  {...props} />;
    case "nomination":   return <Trophy    {...props} />;
    case "vote":         return <Vote      {...props} />;
    default:             return <Bell      {...props} />;
  }
}

// ── Relative time label ────────────────────────────────────────
function timeAgo(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (diff < 60)   return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Type colour accent ─────────────────────────────────────────
function typeAccent(type) {
  switch (type) {
    case "registration": return "#2e7d32";   // green
    case "nomination":   return "#b58a3a";   // gold
    case "vote":         return "#1565c0";   // blue
    default:             return "#888";
  }
}

export default function NotificationBell() {
  const { notifications, unread, markRead, markAllRead, clearAll } =
    useNotifications();

  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const bellRef  = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        bellRef.current  && !bellRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handler(e) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Mark all read when panel opens
  function handleOpen() {
    setOpen((prev) => !prev);
    if (!open && unread > 0) {
      // Small delay so badge is still visible as panel opens
      setTimeout(markAllRead, 800);
    }
  }

  return (
    <div className="notif-wrapper">
      {/* Bell button */}
      <button
        ref={bellRef}
        className="notif-bell-btn"
        onClick={handleOpen}
        aria-label={
          unread > 0
            ? `${unread} unread notification${unread > 1 ? "s" : ""}`
            : "Notifications"
        }
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell size={18} aria-hidden="true" />
        {unread > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          className="notif-panel"
          role="dialog"
          aria-label="Notifications"
          aria-modal="false"
        >
          {/* Panel header */}
          <div className="notif-panel-header">
            <div>
              <strong>Notifications</strong>
              {notifications.length > 0 && (
                <span className="notif-count">
                  {notifications.length}
                </span>
              )}
            </div>
            <div className="notif-header-actions">
              {notifications.length > 0 && (
                <>
                  <button
                    className="notif-action-btn"
                    onClick={markAllRead}
                    title="Mark all read"
                    aria-label="Mark all notifications as read"
                  >
                    <CheckCheck size={14} aria-hidden="true" />
                  </button>
                  <button
                    className="notif-action-btn notif-action-btn--danger"
                    onClick={clearAll}
                    title="Clear all"
                    aria-label="Clear all notifications"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </>
              )}
              <button
                className="notif-action-btn"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div
            className="notif-list"
            role="list"
            aria-label="Recent notifications"
          >
            {notifications.length === 0 ? (
              <div className="notif-empty" role="status">
                <Bell size={28} aria-hidden="true" />
                <p>No notifications yet</p>
                <span>New registrations, nominations and votes will appear here.</span>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`notif-item ${n.read ? "notif-item--read" : "notif-item--unread"}`}
                  role="listitem"
                  aria-label={`${n.title}: ${n.body}`}
                  onClick={() => markRead(n.id)}
                >
                  <div
                    className="notif-item-icon"
                    style={{ background: typeAccent(n.type) + "1a", color: typeAccent(n.type) }}
                    aria-hidden="true"
                  >
                    <NotifIcon type={n.type} />
                  </div>
                  <div className="notif-item-body">
                    <p className="notif-item-title">{n.title}</p>
                    <p className="notif-item-text">{n.body}</p>
                    <p className="notif-item-time">{timeAgo(n.ts)}</p>
                  </div>
                  {!n.read && (
                    <span className="notif-item-dot" aria-hidden="true" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
