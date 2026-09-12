import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import "./AdminPages.css";

// ── Inline confirm dialog ─────────────────────────────────────
function ConfirmDialog({ heading, body, confirmLabel, onConfirm, onCancel, dangerous = true }) {
  const btnRef = useRef(null);
  useEffect(() => { btnRef.current?.focus(); }, []);
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onCancel(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="modal-background"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mem-confirm-heading"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="details-modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <h2 id="mem-confirm-heading" style={{ marginBottom: 10, outline: "none" }} tabIndex={-1}>
          {heading}
        </h2>
        <p style={{ color: "#555", lineHeight: 1.7, marginBottom: 24, fontSize: 14 }}>{body}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="admin-secondary-button" onClick={onCancel}>Cancel</button>
          <button
            ref={btnRef}
            className={dangerous ? "admin-danger-button" : "admin-primary-button"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Approve modal ─────────────────────────────────────────────
function ApproveModal({ classmate, onApprove, onCancel, saving }) {
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [displayName, setDisplayName] = useState(() => {
    const parts = (classmate.full_name || "").trim().split(/\s+/);
    // Default: "Kwame A." — first name + last initial
    return parts.length >= 2
      ? `${parts[0]} ${parts[parts.length - 1][0]}.`
      : parts[0] || classmate.full_name;
  });
  const headingRef = useRef(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onCancel(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="modal-background"
      role="dialog"
      aria-modal="true"
      aria-labelledby="approve-mem-heading"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="details-modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <button className="close-modal" onClick={onCancel} aria-label="Close">
          <span aria-hidden="true">×</span>
        </button>

        <p className="page-eyebrow" aria-hidden="true">APPROVE MEMORY</p>
        <h2
          id="approve-mem-heading"
          ref={headingRef}
          tabIndex={-1}
          style={{ marginBottom: 16, outline: "none" }}
        >
          {classmate.full_name}
        </h2>

        {/* Memory preview */}
        <div className="mem-preview-box">
          <p style={{ margin: 0, color: "#444", lineHeight: 1.7, fontStyle: "italic" }}>
            "{classmate.favourite_memory}"
          </p>
        </div>

        <div className="admin-form" style={{ gap: 16, display: "flex", flexDirection: "column", marginTop: 20 }}>

          {/* Display name */}
          <div>
            <label htmlFor="approve-display-name" style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
              Display name on public wall
            </label>
            <input
              id="approve-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={isAnonymous}
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8, fontFamily: "inherit", fontSize: 14 }}
              aria-describedby="display-name-hint"
            />
            <p id="display-name-hint" style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
              This is how the classmate's name will appear publicly. Defaults to first name + last initial for privacy.
            </p>
          </div>

          {/* Anonymous option */}
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "#b58a3a" }}
            />
            Publish anonymously (name hidden on public wall)
          </label>

        </div>

        <div className="admin-modal-actions" style={{ marginTop: 24 }}>
          <button className="admin-secondary-button" onClick={onCancel}>Cancel</button>
          <button
            className="admin-primary-button"
            onClick={() => onApprove({ displayName: isAnonymous ? "Anonymous" : displayName.trim(), isAnonymous })}
            disabled={saving || (!isAnonymous && !displayName.trim())}
            aria-busy={saving}
          >
            {saving ? "Publishing…" : "Publish to Wall"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function Memories() {
  const [classmates, setClassmates]   = useState([]); // those with a memory
  const [wallEntries, setWallEntries] = useState([]); // approved wall entries
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [search, setSearch]           = useState("");
  const [tab, setTab]                 = useState("submissions"); // "submissions" | "wall"
  const [message, setMessage]         = useState("");
  const [error, setError]             = useState("");
  const [approving, setApproving]     = useState(null);   // classmate being approved
  const [confirmRemove, setConfirmRemove] = useState(null); // wall entry to remove

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [
        { data: cmData,   error: e1 },
        { data: wallData, error: e2 },
      ] = await Promise.all([
        supabase
          .from("classmates")
          .select("id, full_name, class_id, favourite_memory, created_at")
          .not("favourite_memory", "is", null)
          .neq("favourite_memory", "")
          .order("created_at", { ascending: false }),
        supabase
          .from("memories_wall")
          .select("*, classmates(full_name, class_id)")
          .order("approved_at", { ascending: false }),
      ]);

      if (e1) throw e1;
      if (e2) throw e2;
      setClassmates(cmData   || []);
      setWallEntries(wallData || []);
    } catch (err) {
      setError(err.message || "Could not load memories. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Which classmates are already on the wall (by classmate_id)
  const onWallIds = useMemo(() => new Set(wallEntries.map((w) => w.classmate_id)), [wallEntries]);

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    const term = search.toLowerCase().trim();
    return classmates.filter((c) =>
      !term ||
      c.full_name?.toLowerCase().includes(term) ||
      c.class_id?.toLowerCase().includes(term) ||
      c.favourite_memory?.toLowerCase().includes(term)
    );
  }, [classmates, search]);

  // Filtered wall entries
  const filteredWall = useMemo(() => {
    const term = search.toLowerCase().trim();
    return wallEntries.filter((w) =>
      !term ||
      w.display_name?.toLowerCase().includes(term) ||
      w.memory_text?.toLowerCase().includes(term)
    );
  }, [wallEntries, search]);

  // ── Approve memory ───────────────────────────────────────────
  async function handleApprove({ displayName, isAnonymous }) {
    if (!approving) return;
    setSaving(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: e } = await supabase.from("memories_wall").upsert(
        {
          classmate_id:  approving.id,
          memory_text:   approving.favourite_memory,
          display_name:  displayName,
          is_anonymous:  isAnonymous,
          approved_by:   user?.email || "admin",
          approved_at:   new Date().toISOString(),
        },
        { onConflict: "classmate_id" }
      );
      if (e) throw e;
      setMessage(`"${approving.full_name}" memory published to the wall.`);
      setApproving(null);
      await loadData();
    } catch (err) {
      setError(err.message || "Could not approve memory.");
    } finally {
      setSaving(false);
    }
  }

  // ── Remove from wall ─────────────────────────────────────────
  async function handleRemoveFromWall() {
    if (!confirmRemove) return;
    setSaving(true);
    setError("");
    try {
      const { error: e } = await supabase
        .from("memories_wall")
        .delete()
        .eq("id", confirmRemove.id);
      if (e) throw e;
      setMessage("Memory removed from public wall.");
      setConfirmRemove(null);
      await loadData();
    } catch (err) {
      setError(err.message || "Could not remove memory.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>

      {/* PAGE HEADER */}
      <div className="page-header">
        <div>
          <p className="page-eyebrow">MEMORY ARCHIVE</p>
          <h1>Photos &amp; Memories</h1>
          <p>
            Review memory submissions from classmates and publish approved
            ones to the public Memory Wall.
          </p>
        </div>
        <button
          className="secondary-button"
          onClick={loadData}
          aria-label="Refresh memories"
        >
          <span aria-hidden="true">↻</span> Refresh
        </button>
      </div>

      {/* Feedback */}
      <div aria-live="polite" aria-atomic="true">
        {message && (
          <div className="admin-success-message" role="status">
            <span aria-hidden="true">✓ </span>{message}
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

      {/* SUMMARY */}
      <div className="summary-cards" role="list" aria-label="Memory statistics" style={{ marginBottom: 24 }}>
        <div role="listitem" aria-label={`Total submissions: ${classmates.length}`}>
          <span>Submissions</span>
          <strong>{classmates.length}</strong>
        </div>
        <div role="listitem" aria-label={`Published on wall: ${wallEntries.length}`}>
          <span>On Public Wall</span>
          <strong>{wallEntries.length}</strong>
        </div>
        <div role="listitem" aria-label={`Pending review: ${classmates.length - onWallIds.size}`}>
          <span>Pending Review</span>
          <strong>{classmates.length - onWallIds.size}</strong>
        </div>
        <div role="listitem" aria-label={`Anonymous entries: ${wallEntries.filter((w) => w.is_anonymous).length}`}>
          <span>Anonymous</span>
          <strong>{wallEntries.filter((w) => w.is_anonymous).length}</strong>
        </div>
      </div>

      {/* TABS */}
      <div className="mem-tabs" role="tablist" aria-label="Memory views">
        <button
          role="tab"
          aria-selected={tab === "submissions"}
          aria-controls="tab-submissions"
          className={`mem-tab ${tab === "submissions" ? "mem-tab--active" : ""}`}
          onClick={() => setTab("submissions")}
        >
          All Submissions
          <span className="mem-tab-count">{classmates.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "wall"}
          aria-controls="tab-wall"
          className={`mem-tab ${tab === "wall" ? "mem-tab--active" : ""}`}
          onClick={() => setTab("wall")}
        >
          Public Wall
          <span className="mem-tab-count">{wallEntries.length}</span>
        </button>
      </div>

      {/* SEARCH */}
      <div className="admin-toolbar" style={{ marginTop: 16 }}>
        <label htmlFor="mem-search" className="sr-only">Search memories</label>
        <input
          id="mem-search"
          type="search"
          placeholder={tab === "submissions" ? "Search name, ID or memory text…" : "Search wall entries…"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search"
          style={{ flex: 1 }}
        />
      </div>

      {/* SUBMISSIONS TAB */}
      {tab === "submissions" && (
        <div
          id="tab-submissions"
          role="tabpanel"
          aria-label="All memory submissions"
        >
          {loading ? (
            <div className="empty-message" role="status">
              <span className="admin-page-spinner" aria-hidden="true" />
              <strong>Loading submissions…</strong>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="empty-message" role="status">
              <div className="empty-icon" aria-hidden="true">💭</div>
              <strong>{search ? `No submissions match "${search}"` : "No memory submissions yet"}</strong>
              <p>Classmates share their favourite memories during registration.</p>
            </div>
          ) : (
            <div className="mem-card-grid">
              {filteredSubmissions.map((c) => {
                const isOnWall = onWallIds.has(c.id);
                return (
                  <div
                    key={c.id}
                    className={`mem-card ${isOnWall ? "mem-card--approved" : ""}`}
                    aria-label={`Memory from ${c.full_name}${isOnWall ? ", published on wall" : ""}`}
                  >
                    <div className="mem-card-header">
                      <div>
                        <strong>{c.full_name}</strong>
                        <code className="mem-class-id">{c.class_id}</code>
                      </div>
                      {isOnWall && (
                        <span className="mem-badge-published" aria-label="Published on public wall">
                          ✓ On Wall
                        </span>
                      )}
                    </div>

                    <p className="mem-text">"{c.favourite_memory}"</p>

                    <div className="mem-card-actions">
                      {isOnWall ? (
                        <button
                          className="admin-table-action"
                          style={{ background: "#fef3f2", color: "#b42318" }}
                          onClick={() => {
                            const entry = wallEntries.find((w) => w.classmate_id === c.id);
                            setConfirmRemove(entry);
                          }}
                          aria-label={`Remove ${c.full_name}'s memory from public wall`}
                        >
                          Remove from Wall
                        </button>
                      ) : (
                        <button
                          className="admin-primary-button"
                          style={{ fontSize: 13, padding: "8px 14px" }}
                          onClick={() => setApproving(c)}
                          aria-label={`Publish ${c.full_name}'s memory to the public wall`}
                        >
                          Publish to Wall →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* WALL TAB */}
      {tab === "wall" && (
        <div
          id="tab-wall"
          role="tabpanel"
          aria-label="Public memory wall"
        >
          {loading ? (
            <div className="empty-message" role="status">
              <span className="admin-page-spinner" aria-hidden="true" />
              <strong>Loading wall…</strong>
            </div>
          ) : filteredWall.length === 0 ? (
            <div className="empty-message" role="status">
              <div className="empty-icon" aria-hidden="true">🏛️</div>
              <strong>{search ? `No entries match "${search}"` : "The memory wall is empty"}</strong>
              <p>Approve memories from the Submissions tab to publish them here.</p>
            </div>
          ) : (
            <>
              <p style={{ color: "#888", fontSize: 13, marginBottom: 16 }}>
                These memories are visible on the public-facing website.
              </p>
              <div className="mem-wall-grid">
                {filteredWall.map((w) => (
                  <div key={w.id} className="mem-wall-card" aria-label={`Public memory from ${w.display_name}`}>
                    <p className="mem-wall-text">"{w.memory_text}"</p>
                    <div className="mem-wall-footer">
                      <span className="mem-wall-name">
                        {w.is_anonymous ? (
                          <em style={{ color: "#aaa" }}>Anonymous</em>
                        ) : (
                          <>— {w.display_name}</>
                        )}
                      </span>
                      <button
                        className="contrib-delete-btn"
                        onClick={() => setConfirmRemove(w)}
                        aria-label={`Remove ${w.display_name}'s memory from wall`}
                      >
                        <span aria-hidden="true">✕</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* APPROVE MODAL */}
      {approving && (
        <ApproveModal
          classmate={approving}
          onApprove={handleApprove}
          onCancel={() => setApproving(null)}
          saving={saving}
        />
      )}

      {/* REMOVE CONFIRM */}
      {confirmRemove && (
        <ConfirmDialog
          heading="Remove from public wall?"
          body="This memory will no longer appear on the public Memory Wall. The original submission from the classmate is not deleted."
          confirmLabel="Yes, Remove"
          onConfirm={handleRemoveFromWall}
          onCancel={() => setConfirmRemove(null)}
        />
      )}

    </div>
  );
}
