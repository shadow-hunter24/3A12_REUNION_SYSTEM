import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

const STORAGE_KEY  = "admin_notifications";
const MAX_ITEMS    = 50; // keep latest 50 notifications

// ── Helpers ────────────────────────────────────────────────────
function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function save(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch { /* storage full — ignore */ }
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Build a human-readable notification from a Supabase real-time payload
function buildNotification(table, record) {
  const ts = new Date().toISOString();

  switch (table) {
    case "classmates":
      return {
        id: makeId(), ts, read: false,
        type: "registration",
        title: "New Registration",
        body: record.full_name
          ? `${record.full_name} just registered.`
          : "A new classmate just registered.",
      };

    case "award_nominations":
      return {
        id: makeId(), ts, read: false,
        type: "nomination",
        title: "New Nomination",
        body: "A classmate cast a nomination.",
      };

    case "award_votes":
      return {
        id: makeId(), ts, read: false,
        type: "vote",
        title: "New Vote",
        body: "A classmate just voted for an award.",
      };

    case "memories_wall":
      return null; // memory approved by admin — no notification needed

    default:
      return null;
  }
}

// Check for new rows created since a given timestamp
async function fetchRecent(table, since, limit = 10) {
  const { data } = await supabase
    .from(table)
    .select("id, created_at, full_name")
    .gt("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data || [];
}

// ── Hook ───────────────────────────────────────────────────────
export function useNotifications() {
  const [notifications, setNotifications] = useState(() => load());
  const channelRef    = useRef(null);
  // Advances each poll — tracks the latest timestamp we've already processed
  const lastSeenRef   = useRef(new Date(Date.now() - 60_000).toISOString());

  const unread = notifications.filter((n) => !n.read).length;

  // Persist whenever notifications change
  useEffect(() => { save(notifications); }, [notifications]);

  // Add a notification (de-duplicate by id)
  const add = useCallback((notif) => {
    if (!notif) return;
    setNotifications((prev) => {
      if (prev.some((n) => n.id === notif.id)) return prev;
      return [notif, ...prev].slice(0, MAX_ITEMS);
    });
  }, []);

  // Mark all as read
  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  // Mark one as read
  const markRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  // Clear all
  const clearAll = useCallback(() => {
    setNotifications([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // ── Real-time subscriptions ─────────────────────────────────
  useEffect(() => {
    // Back-fill any activity in the last 60 seconds on mount
    const since = lastSeenRef.current;

    async function poll() {
      const now = new Date().toISOString();
      try {
        const [regs, noms, votes] = await Promise.all([
          fetchRecent("classmates",        lastSeenRef.current),
          fetchRecent("award_nominations", lastSeenRef.current),
          fetchRecent("award_votes",       lastSeenRef.current),
        ]);
        const items = [
          ...regs.map((r)  => buildNotification("classmates",        r)),
          ...noms.map((n)  => buildNotification("award_nominations", n)),
          ...votes.map((v) => buildNotification("award_votes",       v)),
        ].filter(Boolean);
        items.forEach(add);
        // Advance the cursor so next poll only picks up newer records
        lastSeenRef.current = now;
      } catch (e) {
        console.warn("[Notifications] poll error:", e);
      }
    }

    // Initial backfill
    poll();

    // Poll every 30 seconds as fallback (catches activity even if websocket misses it)
    const pollInterval = setInterval(poll, 30_000);

    // Subscribe to real-time inserts — runs under the authenticated session
    const channel = supabase
      .channel("admin-notifications", { config: { private: false } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "classmates" },
        (payload) => add(buildNotification("classmates", payload.new))
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "award_nominations" },
        (payload) => add(buildNotification("award_nominations", payload.new))
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "award_votes" },
        (payload) => add(buildNotification("award_votes", payload.new))
      )
      .subscribe((status, err) => {
        if (err) console.warn("[Notifications] subscription error:", err);
        else console.log("[Notifications] status:", status);
      });

    channelRef.current = channel;

    return () => {
      clearInterval(pollInterval);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [add]);

  return { notifications, unread, markRead, markAllRead, clearAll };
}
