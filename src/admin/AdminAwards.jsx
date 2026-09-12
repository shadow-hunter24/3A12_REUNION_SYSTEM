import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  Trophy, RefreshCw, AlertTriangle, Check, Vote, X,
  Briefcase, Heart, Laugh, Shirt, Star, Target, TrendingUp,
} from "lucide-react";

// ── Category icon component (replaces emoji strings) ──────────
const CATEGORY_ICON_MAP = {
  "Most Outstanding": Trophy,
  "Most Successful":  Briefcase,
  "Most Supportive":  Heart,
  "Most Humorous":    Laugh,
  "Best Dressed":     Shirt,
  "Most Influential": Star,
  "Most Likely":      Target,
  "Class Clown":      Laugh,
  "Most Improved":    TrendingUp,
};

function CategoryIcon({ category, size = 24 }) {
  for (const [key, Icon] of Object.entries(CATEGORY_ICON_MAP)) {
    if (category?.name?.includes(key)) return <Icon size={size} aria-hidden="true" />;
  }
  return <Trophy size={size} aria-hidden="true" />;
}
import "./AdminPages.css";

// ── Default icons removed — using Lucide CategoryIcon component instead ──────

const DEFAULT_CATEGORIES = [
  { name: "Most Outstanding Classmate",   description: "The classmate who stands out in every way." },
  { name: "Most Successful Entrepreneur", description: "The classmate who has built something remarkable." },
  { name: "Most Supportive Classmate",    description: "Always there for others, no matter what." },
  { name: "Most Humorous Classmate",      description: "The one who keeps everyone laughing." },
  { name: "Best Dressed",                 description: "The classmate with unmatched style." },
  { name: "Most Influential Classmate",   description: "Making a difference in the lives of others." },
];

const emptyCategory = {
  name: "",
  description: "",
  nomination_open: true,
  voting_open: false,
};

const VIEW = { LIST: "list", DETAIL: "detail" };

// ── Inline confirmation dialog (replaces window.confirm) ──────
function ConfirmDialog({ heading, body, confirmLabel, onConfirm, onCancel, dangerous = false }) {
  const confirmRef = useRef(null);
  useEffect(() => { confirmRef.current?.focus(); }, []);

  // Escape cancels
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
      aria-labelledby="confirm-dialog-heading"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="details-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <h2
          id="confirm-dialog-heading"
          tabIndex={-1}
          style={{ outline: "none", marginBottom: 10 }}
        >
          {heading}
        </h2>
        <p style={{ color: "#555", lineHeight: 1.7, marginBottom: 24, fontSize: 14 }}>{body}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button className="admin-secondary-button" onClick={onCancel}>Cancel</button>
          <button
            ref={confirmRef}
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

export default function AdminAwards() {
  const [categories, setCategories]   = useState([]);
  const [classmates, setClassmates]   = useState([]);
  const [nominations, setNominations] = useState([]);
  const [finalists, setFinalists]     = useState([]);
  const [votes, setVotes]             = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  const [view, setView]                     = useState(VIEW.LIST);
  const [activeCategory, setActiveCategory] = useState(null);

  const [showModal, setShowModal]           = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form, setForm]                     = useState(emptyCategory);
  const [formErrors, setFormErrors]         = useState({});

  // Inline confirm dialogs (replaces window.confirm)
  const [confirmDialog, setConfirmDialog]   = useState(null);
  // { heading, body, confirmLabel, dangerous, onConfirm }

  const [message, setMessage] = useState("");
  const [error, setError]     = useState("");

  // Focus management for category modal
  const modalHeadingRef = useRef(null);
  useEffect(() => {
    if (showModal) modalHeadingRef.current?.focus();
  }, [showModal]);

  // Escape closes category modal
  useEffect(() => {
    if (!showModal) return;
    function onKey(e) { if (e.key === "Escape") setShowModal(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showModal]);

  // ─── DATA ─────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [
        { data: catData,  error: e1 },
        { data: cmData,   error: e2 },
        { data: nomData,  error: e3 },
        { data: finData,  error: e4 },
        { data: voteData, error: e5 },
      ] = await Promise.all([
        supabase.from("award_categories").select("*").order("created_at"),
        supabase.from("classmates").select("id, full_name, class_id").order("full_name"),
        supabase.from("award_nominations").select("*"),
        supabase.from("award_finalists").select("*"),
        supabase.from("award_votes").select("*"),
      ]);

      if (e1) throw e1; if (e2) throw e2; if (e3) throw e3;
      if (e4) throw e4; if (e5) throw e5;

      setCategories(catData  || []);
      setClassmates(cmData   || []);
      setNominations(nomData || []);
      setFinalists(finData   || []);
      setVotes(voteData      || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to load awards data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── DERIVED DATA ─────────────────────────────────────────
  const classmateMap = useMemo(() => {
    const map = {};
    classmates.forEach((c) => { map[c.id] = c; });
    return map;
  }, [classmates]);

  const nominationsByCategory = useMemo(() => {
    const map = {};
    nominations.forEach((n) => {
      if (!map[n.category_id]) map[n.category_id] = {};
      map[n.category_id][n.nominee_id] = (map[n.category_id][n.nominee_id] || 0) + 1;
    });
    return map;
  }, [nominations]);

  const finalistsByCategoryMap = useMemo(() => {
    const map = {};
    finalists.forEach((f) => {
      if (!map[f.category_id]) map[f.category_id] = new Set();
      map[f.category_id].add(f.classmate_id);
    });
    return map;
  }, [finalists]);

  const voteMap = useMemo(() => {
    const map = {};
    votes.forEach((v) => {
      const key = `${v.category_id}:${v.nominee_id}`;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [votes]);

  const activeSortedNominees = useMemo(() => {
    if (!activeCategory) return [];
    const counts = nominationsByCategory[activeCategory.id] || {};
    return Object.entries(counts)
      .map(([nomineeId, count]) => ({
        nomineeId,
        classmate: classmateMap[nomineeId],
        nominations: count,
        isFinalist: !!(finalistsByCategoryMap[activeCategory.id]?.has(nomineeId)),
        votes: voteMap[`${activeCategory.id}:${nomineeId}`] || 0,
      }))
      .filter((r) => r.classmate)
      .sort((a, b) => b.nominations - a.nominations);
  }, [activeCategory, nominationsByCategory, classmateMap, finalistsByCategoryMap, voteMap]);

  const activeFinalistResults = useMemo(() => {
    if (!activeCategory) return [];
    return finalists
      .filter((f) => f.category_id === activeCategory.id)
      .map((f) => ({
        ...f,
        classmate: classmateMap[f.classmate_id],
        votes: voteMap[`${activeCategory.id}:${f.classmate_id}`] || 0,
      }))
      .filter((f) => f.classmate)
      .sort((a, b) => b.votes - a.votes);
  }, [activeCategory, finalists, classmateMap, voteMap]);

  // ─── CATEGORY CRUD ────────────────────────────────────────
  function openNewCategory() {
    setEditingCategory(null);
    setForm(emptyCategory);
    setFormErrors({});
    setMessage(""); setError("");
    setShowModal(true);
  }

  function openEditCategory(cat) {
    setEditingCategory(cat);
    setForm({
      name:            cat.name || "",
      description:     cat.description || "",
      nomination_open: cat.nomination_open,
      voting_open:     cat.voting_open,
    });
    setFormErrors({});
    setMessage(""); setError("");
    setShowModal(true);
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: type === "checkbox" ? checked : value };
      // Enforce mutual exclusivity on the checkboxes
      if (type === "checkbox" && checked) {
        if (name === "voting_open")     updated.nomination_open = false;
        if (name === "nomination_open") updated.voting_open     = false;
      }
      return updated;
    });
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: null }));
  }

  function validateCategoryForm() {
    const errors = {};
    if (!form.name.trim()) errors.name = "Award name is required.";
    if (form.name.trim().length > 100) errors.name = "Award name must be 100 characters or fewer.";
    return errors;
  }

  async function saveCategory(e) {
    e.preventDefault();
    const errors = validateCategoryForm();
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }

    setSaving(true);
    setMessage(""); setError("");

    try {
      const payload = {
        name:            form.name.trim(),
        description:     form.description.trim() || null,
        nomination_open: form.nomination_open,
        voting_open:     form.voting_open,
      };

      if (editingCategory) {
        const { error: e } = await supabase.from("award_categories").update(payload).eq("id", editingCategory.id);
        if (e) throw e;
        setMessage(`"${payload.name}" updated successfully.`);
      } else {
        const { error: e } = await supabase.from("award_categories").insert(payload);
        if (e) throw e;
        setMessage(`"${payload.name}" created successfully.`);
      }

      setShowModal(false);
      await loadData();
    } catch (err) {
      setError(err.message || "Could not save award. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete category — uses inline dialog ──────────────────
  function requestDeleteCategory(cat) {
    setConfirmDialog({
      heading: `Delete "${cat.name}"?`,
      body: "This will permanently delete all nominations, finalists and votes for this award. This action cannot be undone.",
      confirmLabel: "Yes, Delete Award",
      dangerous: true,
      onConfirm: () => doDeleteCategory(cat),
    });
  }

  async function doDeleteCategory(cat) {
    setConfirmDialog(null);
    setMessage(""); setError("");
    try {
      const { error: e } = await supabase.from("award_categories").delete().eq("id", cat.id);
      if (e) throw e;
      setMessage(`"${cat.name}" deleted.`);
      if (activeCategory?.id === cat.id) setView(VIEW.LIST);
      await loadData();
    } catch (err) {
      setError(err.message || "Could not delete award.");
    }
  }

  async function toggleField(cat, field) {
    const newValue = !cat[field];

    // Enforce mutual exclusivity:
    // Opening voting → automatically close nominations
    // Opening nominations → automatically close voting
    const update = { [field]: newValue };
    if (newValue) {
      if (field === "voting_open")     update.nomination_open = false;
      if (field === "nomination_open") update.voting_open     = false;
    }

    const { error: e } = await supabase
      .from("award_categories")
      .update(update)
      .eq("id", cat.id);
    if (e) { setError(e.message); return; }

    const fieldLabel = field === "nomination_open" ? "Nominations" : "Voting";
    let msg = `${fieldLabel} ${newValue ? "opened" : "closed"} for "${cat.name}".`;
    if (newValue && field === "voting_open")     msg += " Nominations have been closed automatically.";
    if (newValue && field === "nomination_open") msg += " Voting has been closed automatically.";
    setMessage(msg);

    await loadData();
    if (activeCategory?.id === cat.id) {
      setActiveCategory((prev) => ({ ...prev, ...update }));
    }
  }

  // ── Finalist management ───────────────────────────────────
  async function addFinalist(categoryId, classmateId) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error: e } = await supabase.from("award_finalists").upsert(
      { category_id: categoryId, classmate_id: classmateId, added_by: user?.email || null },
      { onConflict: "category_id,classmate_id", ignoreDuplicates: true }
    );
    if (e) { setError(e.message); return; }
    setMessage("Finalist added.");
    await loadData();
  }

  async function removeFinalist(categoryId, classmateId) {
    const { error: e } = await supabase.from("award_finalists")
      .delete().eq("category_id", categoryId).eq("classmate_id", classmateId);
    if (e) { setError(e.message); return; }
    setMessage("Finalist removed.");
    await loadData();
  }

  // ── Nomination management ─────────────────────────────────
  function requestDeleteNomination(nomineeId, nomineeName) {
    setConfirmDialog({
      heading: `Remove all nominations for ${nomineeName}?`,
      body: "This will delete every nomination cast for this person in this category. This cannot be undone.",
      confirmLabel: "Yes, Remove Nominations",
      dangerous: true,
      onConfirm: () => doDeleteNomination(nomineeId, nomineeName),
    });
  }

  async function doDeleteNomination(nomineeId, nomineeName) {
    setConfirmDialog(null);
    setMessage(""); setError("");
    const { error: e } = await supabase
      .from("award_nominations")
      .delete()
      .eq("category_id", activeCategory.id)
      .eq("nominee_id", nomineeId);
    if (e) { setError(e.message); return; }
    setMessage(`Nominations for ${nomineeName} removed.`);
    await loadData();
  }

  function requestClearAllNominations() {
    setConfirmDialog({
      heading: `Clear ALL nominations for "${activeCategory.name}"?`,
      body: "This will permanently delete every nomination cast for this award category. This cannot be undone.",
      confirmLabel: "Yes, Clear All Nominations",
      dangerous: true,
      onConfirm: dolearAllNominations,
    });
  }

  async function dolearAllNominations() {
    setConfirmDialog(null);
    setMessage(""); setError("");
    const { error: e } = await supabase
      .from("award_nominations")
      .delete()
      .eq("category_id", activeCategory.id);
    if (e) { setError(e.message); return; }
    setMessage("All nominations cleared.");
    await loadData();
  }

  // ── Vote management ───────────────────────────────────────
  function requestDeleteVote(classmate_id, name) {
    setConfirmDialog({
      heading: `Remove ${name}'s votes?`,
      body: `This will delete all votes cast for ${name} in this category. This cannot be undone.`,
      confirmLabel: "Yes, Remove Votes",
      dangerous: true,
      onConfirm: () => doDeleteVote(classmate_id, name),
    });
  }

  async function doDeleteVote(classmate_id, name) {
    setConfirmDialog(null);
    setMessage(""); setError("");
    const { error: e } = await supabase
      .from("award_votes")
      .delete()
      .eq("category_id", activeCategory.id)
      .eq("nominee_id", classmate_id);
    if (e) { setError(e.message); return; }
    setMessage(`Votes for ${name} removed.`);
    await loadData();
  }

  function requestClearAllVotes() {
    setConfirmDialog({
      heading: `Clear ALL votes for "${activeCategory.name}"?`,
      body: "This will permanently delete every vote cast for this award category. This cannot be undone.",
      confirmLabel: "Yes, Clear All Votes",
      dangerous: true,
      onConfirm: doClearAllVotes,
    });
  }

  async function doClearAllVotes() {
    setConfirmDialog(null);
    setMessage(""); setError("");
    const { error: e } = await supabase
      .from("award_votes")
      .delete()
      .eq("category_id", activeCategory.id);
    if (e) { setError(e.message); return; }
    setMessage("All votes cleared.");
    await loadData();
  }

  // ── Seed defaults — uses inline dialog ────────────────────
  function requestSeedDefaults() {
    setConfirmDialog({
      heading: "Add default award categories?",
      body: "This will add 6 standard award categories. Existing categories will not be affected.",
      confirmLabel: "Yes, Add Defaults",
      dangerous: false,
      onConfirm: doSeedDefaults,
    });
  }

  async function doSeedDefaults() {
    setConfirmDialog(null);
    setSaving(true);
    try {
      const { error: e } = await supabase.from("award_categories").insert(
        DEFAULT_CATEGORIES.map((c) => ({ ...c, nomination_open: false, voting_open: false }))
      );
      if (e) throw e;
      setMessage("6 default categories added.");
      await loadData();
    } catch (err) {
      setError(err.message || "Could not add defaults.");
    } finally {
      setSaving(false);
    }
  }

  async function addAllNomineesAsFinalists(categoryId) {
    const nominees = activeSortedNominees.filter((n) => !n.isFinalist);
    if (nominees.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    const rows = nominees.map((n) => ({
      category_id: categoryId, classmate_id: n.nomineeId, added_by: user?.email || null,
    }));
    const { error: e } = await supabase.from("award_finalists")
      .upsert(rows, { onConflict: "category_id,classmate_id", ignoreDuplicates: true });
    if (e) { setError(e.message); return; }
    setMessage(`${nominees.length} nominee${nominees.length !== 1 ? "s" : ""} added as finalists.`);
    await loadData();
  }

  function openDetail(cat) {
    setActiveCategory(cat);
    setMessage(""); setError("");
    setView(VIEW.DETAIL);
  }

  // ─── LOADING ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="empty-message" role="status" aria-live="polite" aria-label="Loading awards">
        <span className="admin-page-spinner" aria-hidden="true" />
        <strong>Loading Awards…</strong>
      </div>
    );
  }

  // ─── DETAIL VIEW ──────────────────────────────────────────
  if (view === VIEW.DETAIL && activeCategory) {
    const totalNominations = nominations.filter((n) => n.category_id === activeCategory.id).length;
    const totalVotes       = votes.filter((v) => v.category_id === activeCategory.id).length;
    const totalFinalists   = finalists.filter((f) => f.category_id === activeCategory.id).length;

    return (
      <div>
        <button
          className="awards-admin-back-btn"
          onClick={() => { setView(VIEW.LIST); setActiveCategory(null); }}
          aria-label="Back to all award categories"
        >
          ← Back to All Awards
        </button>

        <div className="page-header" style={{ marginTop: 8 }}>
          <div>
            <p className="page-eyebrow">AWARD MANAGEMENT</p>
            <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span aria-hidden="true"><CategoryIcon category={activeCategory} size={28} /></span>
              {activeCategory.name}
            </h1>
            {activeCategory.description && (
              <p style={{ color: "#777", marginTop: 6 }}>{activeCategory.description}</p>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="secondary-button"
              onClick={() => openEditCategory(activeCategory)}
              aria-label={`Edit ${activeCategory.name}`}
            >
              Edit Award
            </button>
            <button
              className="secondary-button"
              onClick={loadData}
              aria-label="Refresh award data"
            >
              <RefreshCw size={14} aria-hidden="true" /> Refresh
            </button>
          </div>
        </div>

        {/* Feedback — ARIA live */}
        <div aria-live="polite" aria-atomic="true">
          {message && (
            <div className="admin-success-message" role="status">
              <Check size={15} aria-hidden="true" /> {message}
            </div>
          )}
        </div>
        <div aria-live="assertive">
          {error && (
            <div className="admin-error-message" role="alert">
              <AlertTriangle size={15} aria-hidden="true" /> {error}
            </div>
          )}
        </div>

        {/* Status controls */}
        <div className="awards-status-controls" role="group" aria-label="Nomination and voting controls">
          <div className="awards-status-card">
            <div>
              <span className="page-eyebrow">NOMINATIONS</span>
              <p style={{ color: "#667085", fontSize: 13, margin: "4px 0 0" }}>
                {activeCategory.nomination_open
                  ? "Open — classmates can nominate"
                  : "Closed — nominations not accepted"}
              </p>
            </div>
            <button
              className={activeCategory.nomination_open ? "secondary-button" : "admin-primary-button"}
              onClick={() => toggleField(activeCategory, "nomination_open")}
              aria-label={activeCategory.nomination_open
                ? `Close nominations for ${activeCategory.name}`
                : `Open nominations for ${activeCategory.name}`}
              aria-pressed={activeCategory.nomination_open}
            >
              {activeCategory.nomination_open ? "Close Nominations" : "Open Nominations"}
            </button>
          </div>

          <div className="awards-status-card">
            <div>
              <span className="page-eyebrow">VOTING</span>
              <p style={{ color: "#667085", fontSize: 13, margin: "4px 0 0" }}>
                {activeCategory.voting_open
                  ? "Open — classmates can vote"
                  : "Closed — voting not active"}
              </p>
            </div>
            <button
              className={activeCategory.voting_open ? "secondary-button" : "admin-primary-button"}
              onClick={() => toggleField(activeCategory, "voting_open")}
              aria-label={activeCategory.voting_open
                ? `Close voting for ${activeCategory.name}`
                : `Open voting for ${activeCategory.name}`}
              aria-pressed={activeCategory.voting_open}
            >
              {activeCategory.voting_open ? "Close Voting" : "Open Voting"}
            </button>
          </div>
        </div>

        {/* Summary */}
        <div
          className="summary-cards"
          role="list"
          aria-label="Award statistics"
          style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 28 }}
        >
          {[
            { label: "Nominations", value: totalNominations },
            { label: "Finalists",   value: totalFinalists },
            { label: "Votes Cast",  value: totalVotes },
          ].map(({ label, value }) => (
            <div key={label} role="listitem" aria-label={`${label}: ${value}`}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>

        {/* Nominations table */}
        <div className="data-card" style={{ marginBottom: 24 }}>
          <div className="data-card-header">
            <div>
              <h2>Nominations</h2>
              <p>
                {activeSortedNominees.length} nominee{activeSortedNominees.length !== 1 ? "s" : ""} received nominations.
                Tick the ones you want to include in voting.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {activeSortedNominees.length > 0 && (
                <button
                  className="admin-table-action"
                  style={{ background: "#fef3f2", color: "#b42318" }}
                  onClick={requestClearAllNominations}
                  aria-label="Clear all nominations for this category"
                >
                  Clear All Nominations
                </button>
              )}
              {activeSortedNominees.some((n) => !n.isFinalist) && (
                <button
                  className="admin-primary-button"
                  onClick={() => addAllNomineesAsFinalists(activeCategory.id)}
                  aria-label="Add all nominees as finalists"
                >
                  Add All as Finalists
                </button>
              )}
            </div>
          </div>

          {activeSortedNominees.length === 0 ? (
            <div className="empty-message" role="status">
              <div className="empty-icon" aria-hidden="true"><Vote size={36} /></div>
              <strong>No nominations yet</strong>
              <p>Open nominations so classmates can start nominating.</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="admin-table" aria-label={`Nominations for ${activeCategory.name}`}>
                <thead>
                  <tr>
                    <th scope="col">Nominee</th>
                    <th scope="col">Class ID</th>
                    <th scope="col">Nominations</th>
                    <th scope="col">Finalist Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSortedNominees.map((row) => (
                    <tr key={row.nomineeId}>
                      <td><strong>{row.classmate.full_name}</strong></td>
                      <td>
                        <code aria-label={`Class ID ${row.classmate.class_id}`}
                          style={{ background: "#f4f0e6", padding: "4px 7px", borderRadius: 5, fontSize: 11 }}>
                          {row.classmate.class_id}
                        </code>
                      </td>
                      <td>
                        <strong style={{ color: "#b28a45" }}
                          aria-label={`${row.nominations} nominations`}>
                          {row.nominations}
                        </strong>
                      </td>
                      <td>
                        {row.isFinalist
                          ? <span className="admin-status-badge status-paid" aria-label="Is a finalist"><Check size={13} style={{ display: "inline", verticalAlign: "middle" }} /> Finalist</span>
                          : <span className="admin-status-badge status-unpaid" aria-label="Not yet a finalist">Not Added</span>}
                      </td>
                      <td>
                        <div className="reg-action-group">
                          {row.isFinalist ? (
                            <button
                              className="admin-table-action"
                              style={{ background: "#fef3f2", color: "#b42318" }}
                              onClick={() => removeFinalist(activeCategory.id, row.nomineeId)}
                              aria-label={`Remove ${row.classmate.full_name} from finalists`}
                            >
                              Remove Finalist
                            </button>
                          ) : (
                            <button
                              className="admin-table-action"
                              onClick={() => addFinalist(activeCategory.id, row.nomineeId)}
                              aria-label={`Add ${row.classmate.full_name} as finalist`}
                            >
                              Add Finalist
                            </button>
                          )}
                          <button
                            className="admin-table-action"
                            style={{ background: "#fef3f2", color: "#b42318" }}
                            onClick={() => requestDeleteNomination(row.nomineeId, row.classmate.full_name)}
                            aria-label={`Delete all nominations for ${row.classmate.full_name}`}
                          >
                            Delete Nominations
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Finalists & results */}
        <div className="data-card">
          <div className="data-card-header">
            <div>
              <h2>Finalists &amp; Voting Results</h2>
              <p>
                {activeFinalistResults.length} finalist{activeFinalistResults.length !== 1 ? "s" : ""}.
                {activeCategory.voting_open ? " Voting is currently open." : " Open voting when you're ready."}
              </p>
            </div>
            {totalVotes > 0 && (
              <button
                className="admin-table-action"
                style={{ background: "#fef3f2", color: "#b42318" }}
                onClick={requestClearAllVotes}
                aria-label="Clear all votes for this category"
              >
                Clear All Votes
              </button>
            )}
          </div>

          {activeFinalistResults.length === 0 ? (
            <div className="empty-message" role="status">
              <div className="empty-icon" aria-hidden="true"><Trophy size={36} /></div>
              <strong>No finalists yet</strong>
              <p>Add finalists from the nominations above.</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="admin-table" aria-label={`Finalists and results for ${activeCategory.name}`}>
                <thead>
                  <tr>
                    <th scope="col">Rank</th>
                    <th scope="col">Finalist</th>
                    <th scope="col">Class ID</th>
                    <th scope="col">Votes</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeFinalistResults.map((f, index) => (
                    <tr key={f.classmate_id}>
                      <td>
                        <strong
                          style={{ color: index === 0 ? "#b28a45" : "#667085" }}
                          aria-label={`Rank ${index + 1}`}
                        >
                          {index + 1}
                        </strong>
                      </td>
                      <td>
                        <strong>
                          {index === 0 && totalVotes > 0 && <Trophy size={14} aria-hidden="true" style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />}
                          {f.classmate.full_name}
                          {index === 0 && totalVotes > 0 && <span className="sr-only"> (current leader)</span>}
                        </strong>
                      </td>
                      <td>
                        <code aria-label={`Class ID ${f.classmate.class_id}`}
                          style={{ background: "#f4f0e6", padding: "4px 7px", borderRadius: 5, fontSize: 11 }}>
                          {f.classmate.class_id}
                        </code>
                      </td>
                      <td>
                        <strong style={{ fontSize: 16 }} aria-label={`${f.votes} votes`}>
                          {f.votes}
                        </strong>
                      </td>
                      <td>
                        <div className="reg-action-group">
                          <button
                            className="admin-table-action"
                            style={{ background: "#fef3f2", color: "#b42318" }}
                            onClick={() => removeFinalist(activeCategory.id, f.classmate_id)}
                            aria-label={`Remove ${f.classmate.full_name} from finalists`}
                          >
                            Remove Finalist
                          </button>
                          {f.votes > 0 && (
                            <button
                              className="admin-table-action"
                              style={{ background: "#fef3f2", color: "#b42318" }}
                              onClick={() => requestDeleteVote(f.classmate_id, f.classmate.full_name)}
                              aria-label={`Delete votes for ${f.classmate.full_name}`}
                            >
                              Delete Votes
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Confirm dialog */}
        {confirmDialog && (
          <ConfirmDialog
            heading={confirmDialog.heading}
            body={confirmDialog.body}
            confirmLabel={confirmDialog.confirmLabel}
            dangerous={confirmDialog.dangerous}
            onConfirm={confirmDialog.onConfirm}
            onCancel={() => setConfirmDialog(null)}
          />
        )}
      </div>
    );
  }

  // ─── LIST VIEW ────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <div>
          <p className="page-eyebrow">REUNION AWARDS</p>
          <h1>Awards</h1>
          <p>Create award categories, manage nominations and voting, approve finalists.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {categories.length === 0 && (
            <button
              className="secondary-button"
              onClick={requestSeedDefaults}
              disabled={saving}
              aria-label="Add 6 default award categories"
            >
              Add Default Awards
            </button>
          )}
          <button className="secondary-button" onClick={loadData} aria-label="Refresh awards list">
            <RefreshCw size={14} aria-hidden="true" /> Refresh
          </button>
          <button className="admin-primary-button" onClick={openNewCategory} aria-label="Create a new award category">
            + Add Award
          </button>
        </div>
      </div>

      {/* Feedback */}
      <div aria-live="polite" aria-atomic="true">
        {message && (
          <div className="admin-success-message" role="status">
            <Check size={15} aria-hidden="true" /> {message}
          </div>
        )}
      </div>
      <div aria-live="assertive">
        {error && (
          <div className="admin-error-message" role="alert">
            <AlertTriangle size={15} aria-hidden="true" /> {error}
          </div>
        )}
      </div>

      {/* Summary */}
      <div
        className="summary-cards"
        role="list"
        aria-label="Awards overview"
        style={{ marginBottom: 24 }}
      >
        {[
          { label: "Award Categories",  value: categories.length },
          { label: "Total Nominations", value: nominations.length },
          { label: "Total Finalists",   value: finalists.length },
          { label: "Total Votes",       value: votes.length },
        ].map(({ label, value }) => (
          <div key={label} role="listitem" aria-label={`${label}: ${value}`}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      {/* Category grid */}
      {categories.length === 0 ? (
        <div className="awards-admin-empty" role="status">
          <span aria-hidden="true"><Trophy size={48} /></span>
          <h3>No award categories yet</h3>
          <p>Create your first award or add the default set to get started quickly.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="admin-primary-button" onClick={openNewCategory}>+ Create Award</button>
            <button className="secondary-button" onClick={requestSeedDefaults}>Add Default Awards</button>
          </div>
        </div>
      ) : (
        <div className="awards-admin-grid" role="list" aria-label="Award categories">
          {categories.map((cat) => {
            const nomCount      = nominations.filter((n) => n.category_id === cat.id).length;
            const finalistCount = finalists.filter((f) => f.category_id === cat.id).length;
            const voteCount     = votes.filter((v) => v.category_id === cat.id).length;

            return (
              <div key={cat.id} className="awards-admin-card" role="listitem">
                <div className="awards-admin-card-header">
                  <span className="awards-admin-icon" aria-hidden="true"><CategoryIcon category={cat} size={24} /></span>
                  <div className="awards-admin-card-title">
                    <h3>{cat.name}</h3>
                    {cat.description && <p>{cat.description}</p>}
                  </div>
                </div>

                <div className="awards-status-row" aria-label="Status">
                  <span className={`admin-status-badge ${cat.nomination_open ? "status-paid" : "status-unpaid"}`}
                    aria-label={cat.nomination_open ? "Nominations open" : "Nominations closed"}>
                    {cat.nomination_open ? "Nominations Open" : "Nominations Closed"}
                  </span>
                  <span className={`admin-status-badge ${cat.voting_open ? "status-paid" : "status-unpaid"}`}
                    aria-label={cat.voting_open ? "Voting open" : "Voting closed"}>
                    {cat.voting_open ? "Voting Open" : "Voting Closed"}
                  </span>
                </div>

                <div
                  className="awards-admin-counts"
                  aria-label={`${nomCount} nominations, ${finalistCount} finalists, ${voteCount} votes`}
                >
                  <div><strong aria-hidden="true">{nomCount}</strong><span>Nominations</span></div>
                  <div><strong aria-hidden="true">{finalistCount}</strong><span>Finalists</span></div>
                  <div><strong aria-hidden="true">{voteCount}</strong><span>Votes</span></div>
                </div>

                <div className="awards-admin-actions">
                  <button
                    className="admin-primary-button"
                    onClick={() => openDetail(cat)}
                    style={{ flex: 1 }}
                    aria-label={`Manage ${cat.name}`}
                  >
                    Manage →
                  </button>
                  <button
                    className="admin-table-action"
                    onClick={() => openEditCategory(cat)}
                    aria-label={`Edit ${cat.name}`}
                  >
                    Edit
                  </button>
                  <button
                    className="admin-table-action"
                    style={{ background: "#fef3f2", color: "#b42318" }}
                    onClick={() => requestDeleteCategory(cat)}
                    aria-label={`Delete ${cat.name}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      {showModal && (
        <div
          className="modal-background"
          role="dialog"
          aria-modal="true"
          aria-labelledby="award-modal-heading"
          onClick={() => setShowModal(false)}
        >
          <div
            className="details-modal"
            style={{ maxWidth: 540 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close-modal"
              onClick={() => setShowModal(false)}
              aria-label="Close award form"
            >
              <span aria-hidden="true">×</span>
            </button>

            <p className="page-eyebrow" aria-hidden="true">AWARD MANAGEMENT</p>
            <h2
              id="award-modal-heading"
              tabIndex={-1}
              ref={modalHeadingRef}
              style={{ marginBottom: 20, outline: "none" }}
            >
              {editingCategory ? "Edit Award" : "Create Award"}
            </h2>

            <div aria-live="assertive">
              {error && (
                <div className="admin-error-message" role="alert">
                  <AlertTriangle size={15} aria-hidden="true" /> {error}
                </div>
              )}
            </div>

            <form className="admin-form" onSubmit={saveCategory} noValidate aria-label="Award category form">

              <div>
                <label htmlFor="award-name">
                  Award Name <span aria-hidden="true" style={{ color: "#d93025" }}>*</span>
                </label>
                <input
                  id="award-name"
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Most Successful Entrepreneur"
                  required
                  aria-required="true"
                  aria-describedby={formErrors.name ? "award-name-error" : undefined}
                  aria-invalid={!!formErrors.name}
                  maxLength={100}
                />
                {formErrors.name && (
                  <p id="award-name-error" className="contrib-field-error" role="alert">
                    <AlertTriangle size={13} aria-hidden="true" /> {formErrors.name}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="award-description">Description</label>
                <textarea
                  id="award-description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows="3"
                  placeholder="What does this award recognise?"
                  maxLength={300}
                />
              </div>

              <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
                <legend style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "#333" }}>
                  Award Status
                </legend>
                <div className="awards-checkbox-row">
                  <label className="awards-checkbox-label">
                    <input
                      type="checkbox"
                      name="nomination_open"
                      checked={form.nomination_open}
                      onChange={handleChange}
                      aria-describedby="nomination-hint"
                    />
                    Allow nominations
                  </label>
                  <label className="awards-checkbox-label">
                    <input
                      type="checkbox"
                      name="voting_open"
                      checked={form.voting_open}
                      onChange={handleChange}
                      aria-describedby="voting-hint"
                    />
                    Allow voting
                  </label>
                </div>
                <p id="nomination-hint" className="sr-only">
                  When enabled, classmates can nominate others for this award.
                </p>
                <p id="voting-hint" className="sr-only">
                  When enabled, classmates can cast their vote among the approved finalists.
                </p>
              </fieldset>

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-primary-button"
                  disabled={saving}
                  aria-busy={saving}
                >
                  {saving ? "Saving…" : editingCategory ? "Update Award" : "Create Award"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline confirm dialog */}
      {confirmDialog && (
        <ConfirmDialog
          heading={confirmDialog.heading}
          body={confirmDialog.body}
          confirmLabel={confirmDialog.confirmLabel}
          dangerous={confirmDialog.dangerous}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
