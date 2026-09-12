import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import "./AdminPages.css";

function formatTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-GH", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getInitials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default function Checkin() {
  const [classmates, setClassmates] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(null); // id of classmate being saved
  const [search, setSearch]         = useState("");
  const [filter, setFilter]         = useState("ALL"); // ALL | IN | OUT
  const [message, setMessage]       = useState("");
  const [error, setError]           = useState("");
  const searchRef = useRef(null);

  // Auto-focus search on mount (admin is standing at the door)
  useEffect(() => { searchRef.current?.focus(); }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: e } = await supabase
      .from("classmates")
      .select("id, full_name, class_id, phone, attending, guests, checked_in, checked_in_at, checked_in_by")
      .eq("attending", true)          // only show classmates who said they're attending
      .order("full_name", { ascending: true });

    if (e) {
      setError("Could not load classmates. Please refresh.");
      console.error(e);
    } else {
      setClassmates(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Check in ────────────────────────────────────────────────
  async function checkIn(person) {
    setSaving(person.id);
    setMessage(""); setError("");

    const { data: { user } } = await supabase.auth.getUser();

    const { error: e } = await supabase
      .from("classmates")
      .update({
        checked_in:    true,
        checked_in_at: new Date().toISOString(),
        checked_in_by: user?.email || "admin",
      })
      .eq("id", person.id);

    if (e) {
      setError(`Could not check in ${person.full_name}: ${e.message}`);
    } else {
      setClassmates((prev) =>
        prev.map((c) =>
          c.id === person.id
            ? { ...c, checked_in: true, checked_in_at: new Date().toISOString(), checked_in_by: user?.email || "admin" }
            : c
        )
      );
      setMessage(`✓ ${person.full_name} checked in.`);
      // Auto-clear message after 3 s
      setTimeout(() => setMessage(""), 3000);
    }
    setSaving(null);
  }

  // ── Undo check-in ────────────────────────────────────────────
  async function undoCheckIn(person) {
    setSaving(person.id);
    setMessage(""); setError("");

    const { error: e } = await supabase
      .from("classmates")
      .update({ checked_in: false, checked_in_at: null, checked_in_by: null })
      .eq("id", person.id);

    if (e) {
      setError(`Could not undo check-in for ${person.full_name}: ${e.message}`);
    } else {
      setClassmates((prev) =>
        prev.map((c) =>
          c.id === person.id
            ? { ...c, checked_in: false, checked_in_at: null, checked_in_by: null }
            : c
        )
      );
      setMessage(`↩ ${person.full_name} check-in undone.`);
      setTimeout(() => setMessage(""), 3000);
    }
    setSaving(null);
  }

  // ── Stats ────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total      = classmates.length;
    const checkedIn  = classmates.filter((c) => c.checked_in).length;
    const remaining  = total - checkedIn;
    const totalPeople = classmates.reduce((s, c) => s + 1 + Number(c.guests || 0), 0);
    const checkedInPeople = classmates
      .filter((c) => c.checked_in)
      .reduce((s, c) => s + 1 + Number(c.guests || 0), 0);
    return { total, checkedIn, remaining, totalPeople, checkedInPeople };
  }, [classmates]);

  // ── Filtered list ────────────────────────────────────────────
  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return classmates.filter((c) => {
      const matchSearch =
        !term ||
        c.full_name?.toLowerCase().includes(term) ||
        c.class_id?.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term);
      const matchFilter =
        filter === "ALL" ||
        (filter === "IN"  &&  c.checked_in) ||
        (filter === "OUT" && !c.checked_in);
      return matchSearch && matchFilter;
    });
  }, [classmates, search, filter]);

  return (
    <div>

      {/* PAGE HEADER */}
      <div className="page-header">
        <div>
          <p className="page-eyebrow">EVENT MANAGEMENT</p>
          <h1>Event Check-In</h1>
          <p>Search a classmate's name or ID and tap Check In as they arrive.</p>
        </div>
        <button
          className="secondary-button"
          onClick={loadData}
          aria-label="Refresh check-in list"
          aria-busy={loading}
        >
          <span aria-hidden="true">↻</span> Refresh
        </button>
      </div>

      {/* Feedback */}
      <div aria-live="polite" aria-atomic="true">
        {message && (
          <div className="admin-success-message" role="status">
            {message}
          </div>
        )}
      </div>
      <div aria-live="assertive">
        {error && (
          <div className="admin-error-message" role="alert">
            <span aria-hidden="true">⚠ </span>{error}
          </div>
        )}
      </div>

      {/* STATS */}
      <div
        className="checkin-stats-grid"
        role="list"
        aria-label="Check-in statistics"
      >
        <div className="checkin-stat-card checkin-stat-total" role="listitem">
          <span aria-hidden="true">👥</span>
          <div>
            <strong>{stats.total}</strong>
            <p>Expected Classmates</p>
          </div>
        </div>
        <div className="checkin-stat-card checkin-stat-in" role="listitem">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>{stats.checkedIn}</strong>
            <p>Checked In</p>
          </div>
        </div>
        <div className="checkin-stat-card checkin-stat-out" role="listitem">
          <span aria-hidden="true">⏳</span>
          <div>
            <strong>{stats.remaining}</strong>
            <p>Not Yet Arrived</p>
          </div>
        </div>
        <div className="checkin-stat-card checkin-stat-people" role="listitem">
          <span aria-hidden="true">🎟️</span>
          <div>
            <strong>{stats.checkedInPeople} / {stats.totalPeople}</strong>
            <p>People (incl. guests)</p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="checkin-progress-wrapper"
        aria-label={`${stats.checkedIn} of ${stats.total} classmates checked in`}
      >
        <div className="checkin-progress-track">
          <div
            className="checkin-progress-fill"
            style={{ width: stats.total ? `${(stats.checkedIn / stats.total) * 100}%` : "0%" }}
            role="progressbar"
            aria-valuenow={stats.checkedIn}
            aria-valuemin={0}
            aria-valuemax={stats.total}
          />
        </div>
        <span className="checkin-progress-label">
          {stats.total ? Math.round((stats.checkedIn / stats.total) * 100) : 0}% arrived
        </span>
      </div>

      {/* SEARCH + FILTER */}
      <div className="admin-toolbar" role="search" aria-label="Search and filter classmates">
        <label htmlFor="checkin-search" className="sr-only">Search by name, ID or phone</label>
        <input
          id="checkin-search"
          ref={searchRef}
          type="search"
          placeholder="Search name, class ID or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search classmates"
          aria-controls="checkin-list"
          style={{ flex: 1 }}
        />

        <label htmlFor="checkin-filter" className="sr-only">Filter by check-in status</label>
        <select
          id="checkin-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="ALL">All ({stats.total})</option>
          <option value="IN">Checked In ({stats.checkedIn})</option>
          <option value="OUT">Not Arrived ({stats.remaining})</option>
        </select>
      </div>

      {/* LIST */}
      {loading ? (
        <div className="empty-message" role="status" aria-live="polite">
          <span className="admin-page-spinner" aria-hidden="true" />
          <strong>Loading classmates…</strong>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-message" role="status">
          <div className="empty-icon" aria-hidden="true">🎟️</div>
          <strong>
            {search
              ? `No classmates match "${search}"`
              : filter === "IN" ? "No one checked in yet"
              : filter === "OUT" ? "Everyone has arrived!"
              : "No attending classmates found"}
          </strong>
          {filter === "OUT" && !search && (
            <p style={{ color: "#198754", marginTop: 8 }}>
              All expected classmates have been checked in 🎉
            </p>
          )}
        </div>
      ) : (
        <div
          id="checkin-list"
          className="checkin-list"
          role="list"
          aria-label="Classmate check-in list"
        >
          {filtered.map((person) => (
            <div
              key={person.id}
              className={`checkin-row ${person.checked_in ? "checkin-row--in" : ""}`}
              role="listitem"
              aria-label={`${person.full_name} — ${person.checked_in ? "checked in" : "not yet arrived"}`}
            >
              {/* Avatar */}
              <div
                className={`checkin-avatar ${person.checked_in ? "checkin-avatar--in" : ""}`}
                aria-hidden="true"
              >
                {person.checked_in ? "✓" : getInitials(person.full_name)}
              </div>

              {/* Info */}
              <div className="checkin-info">
                <strong>{person.full_name}</strong>
                <div className="checkin-meta">
                  <code>{person.class_id}</code>
                  {person.guests > 0 && (
                    <span className="checkin-guests">
                      +{person.guests} guest{person.guests > 1 ? "s" : ""}
                    </span>
                  )}
                  {person.checked_in && (
                    <span className="checkin-time">
                      Arrived {formatTime(person.checked_in_at)}
                    </span>
                  )}
                </div>
              </div>

              {/* Action */}
              <div className="checkin-action">
                {person.checked_in ? (
                  <>
                    <span className="checkin-badge-in" aria-hidden="true">✓ Checked In</span>
                    <button
                      className="checkin-undo-btn"
                      onClick={() => undoCheckIn(person)}
                      disabled={saving === person.id}
                      aria-label={`Undo check-in for ${person.full_name}`}
                      aria-busy={saving === person.id}
                    >
                      {saving === person.id ? "…" : "Undo"}
                    </button>
                  </>
                ) : (
                  <button
                    className="checkin-btn"
                    onClick={() => checkIn(person)}
                    disabled={saving === person.id}
                    aria-label={`Check in ${person.full_name}`}
                    aria-busy={saving === person.id}
                  >
                    {saving === person.id ? (
                      <><span className="admin-page-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} aria-hidden="true" /> Checking in…</>
                    ) : (
                      "Check In →"
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
