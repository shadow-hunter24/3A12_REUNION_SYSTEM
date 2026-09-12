import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import "./AdminPages.css";

// ── Default icons for common award names ─────────────────────
const CATEGORY_ICONS = {
  "Most Outstanding": "🏆",
  "Most Successful":  "💼",
  "Most Supportive":  "❤️",
  "Most Humorous":    "😂",
  "Best Dressed":     "👔",
  "Most Influential": "🌟",
  "Most Likely":      "🎯",
  "Class Clown":      "🤣",
  "Most Improved":    "📈",
};

function getCategoryIcon(category) {
  if (category.icon && category.icon !== "🏆") return category.icon;
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (category.name.includes(key)) return icon;
  }
  return "🏆";
}

const DEFAULT_CATEGORIES = [
  { name: "Most Outstanding Classmate",  icon: "🏆", description: "The classmate who stands out in every way." },
  { name: "Most Successful Entrepreneur",icon: "💼", description: "The classmate who has built something remarkable." },
  { name: "Most Supportive Classmate",   icon: "❤️", description: "Always there for others, no matter what." },
  { name: "Most Humorous Classmate",     icon: "😂", description: "The one who keeps everyone laughing." },
  { name: "Best Dressed",                icon: "👔", description: "The classmate with unmatched style." },
  { name: "Most Influential Classmate",  icon: "🌟", description: "Making a difference in the lives of others." },
];

const emptyCategory = {
  name: "",
  icon: "🏆",
  description: "",
  nomination_open: true,
  voting_open: false,
};

// ── VIEWS ─────────────────────────────────────────────────────
const VIEW = {
  LIST:      "list",
  DETAIL:    "detail",  // nomination review + finalist management
};

export default function AdminAwards() {
  const [categories, setCategories]     = useState([]);
  const [classmates, setClassmates]     = useState([]);
  const [nominations, setNominations]   = useState([]);
  const [finalists, setFinalists]       = useState([]);
  const [votes, setVotes]               = useState([]);

  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);

  const [view, setView]                 = useState(VIEW.LIST);
  const [activeCategory, setActiveCategory] = useState(null);

  const [showModal, setShowModal]       = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form, setForm]                 = useState(emptyCategory);

  const [message, setMessage]           = useState("");
  const [error, setError]               = useState("");

  // ─── DATA LOADING ───────────────────────────────────────────

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

      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;
      if (e4) throw e4;
      if (e5) throw e5;

      setCategories(catData  || []);
      setClassmates(cmData   || []);
      setNominations(nomData || []);
      setFinalists(finData   || []);
      setVotes(voteData      || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to load awards data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── DERIVED DATA ───────────────────────────────────────────

  const classmateMap = useMemo(() => {
    const map = {};
    classmates.forEach((c) => { map[c.id] = c; });
    return map;
  }, [classmates]);

  // Nomination counts per category, sorted by count desc
  const nominationsByCategory = useMemo(() => {
    const map = {};
    nominations.forEach((n) => {
      if (!map[n.category_id]) map[n.category_id] = {};
      map[n.category_id][n.nominee_id] =
        (map[n.category_id][n.nominee_id] || 0) + 1;
    });
    return map;
  }, [nominations]);

  // Finalist ids per category
  const finalistsByCategoryMap = useMemo(() => {
    const map = {};
    finalists.forEach((f) => {
      if (!map[f.category_id]) map[f.category_id] = new Set();
      map[f.category_id].add(f.classmate_id);
    });
    return map;
  }, [finalists]);

  // Vote counts per category+nominee
  const voteMap = useMemo(() => {
    const map = {};
    votes.forEach((v) => {
      const key = `${v.category_id}:${v.nominee_id}`;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [votes]);

  // Sorted nominee list for the active category detail view
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

  // Finalists with vote counts for active category
  const activeFinalistResults = useMemo(() => {
    if (!activeCategory) return [];
    const catFinalists = finalists
      .filter((f) => f.category_id === activeCategory.id)
      .map((f) => ({
        ...f,
        classmate: classmateMap[f.classmate_id],
        votes: voteMap[`${activeCategory.id}:${f.classmate_id}`] || 0,
      }))
      .filter((f) => f.classmate)
      .sort((a, b) => b.votes - a.votes);
    return catFinalists;
  }, [activeCategory, finalists, classmateMap, voteMap]);

  // ─── CATEGORY CRUD ──────────────────────────────────────────

  function openNewCategory() {
    setEditingCategory(null);
    setForm(emptyCategory);
    setMessage(""); setError("");
    setShowModal(true);
  }

  function openEditCategory(cat) {
    setEditingCategory(cat);
    setForm({
      name:             cat.name || "",
      icon:             cat.icon || "🏆",
      description:      cat.description || "",
      nomination_open:  cat.nomination_open,
      voting_open:      cat.voting_open,
    });
    setMessage(""); setError("");
    setShowModal(true);
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  async function saveCategory(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Please enter an award category name."); return; }

    setSaving(true);
    setMessage(""); setError("");

    try {
      const payload = {
        name:            form.name.trim(),
        icon:            form.icon || "🏆",
        description:     form.description.trim() || null,
        nomination_open: form.nomination_open,
        voting_open:     form.voting_open,
      };

      if (editingCategory) {
        const { error: e } = await supabase
          .from("award_categories").update(payload).eq("id", editingCategory.id);
        if (e) throw e;
        setMessage("Award updated.");
      } else {
        const { error: e } = await supabase
          .from("award_categories").insert(payload);
        if (e) throw e;
        setMessage("Award created.");
      }

      setShowModal(false);
      await loadData();
    } catch (err) {
      setError(err.message || "Could not save award.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(cat) {
    if (!window.confirm(`Delete "${cat.name}"?\n\nThis also deletes all nominations, finalists and votes for this award.`)) return;
    setMessage(""); setError("");

    try {
      const { error: e } = await supabase
        .from("award_categories").delete().eq("id", cat.id);
      if (e) throw e;
      setMessage("Award deleted.");
      if (activeCategory?.id === cat.id) setView(VIEW.LIST);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleField(cat, field) {
    const newValue = !cat[field];
    const { error: e } = await supabase
      .from("award_categories").update({ [field]: newValue }).eq("id", cat.id);
    if (e) { setError(e.message); return; }
    setMessage(
      field === "nomination_open"
        ? (newValue ? `Nominations opened for "${cat.name}".` : `Nominations closed for "${cat.name}".`)
        : (newValue ? `Voting opened for "${cat.name}".` : `Voting closed for "${cat.name}".`)
    );
    await loadData();
    // Keep activeCategory in sync
    if (activeCategory?.id === cat.id) {
      setActiveCategory((prev) => ({ ...prev, [field]: newValue }));
    }
  }

  // ─── FINALIST MANAGEMENT ────────────────────────────────────

  async function addFinalist(categoryId, classmateId) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error: e } = await supabase
      .from("award_finalists")
      .upsert(
        { category_id: categoryId, classmate_id: classmateId, added_by: user?.email || null },
        { onConflict: "category_id,classmate_id", ignoreDuplicates: true }
      );
    if (e) { setError(e.message); return; }
    await loadData();
  }

  async function removeFinalist(categoryId, classmateId) {
    const { error: e } = await supabase
      .from("award_finalists")
      .delete()
      .eq("category_id", categoryId)
      .eq("classmate_id", classmateId);
    if (e) { setError(e.message); return; }
    await loadData();
  }

  // Add all nominees as finalists at once
  async function addAllNomineesAsFinalists(categoryId) {
    const nominees = activeSortedNominees.filter((n) => !n.isFinalist);
    if (nominees.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    const rows = nominees.map((n) => ({
      category_id:  categoryId,
      classmate_id: n.nomineeId,
      added_by:     user?.email || null,
    }));

    const { error: e } = await supabase
      .from("award_finalists")
      .upsert(rows, { onConflict: "category_id,classmate_id", ignoreDuplicates: true });
    if (e) { setError(e.message); return; }
    setMessage("All nominees added as finalists.");
    await loadData();
  }

  // ─── SEED DEFAULT CATEGORIES ────────────────────────────────

  async function seedDefaultCategories() {
    if (!window.confirm("Add the 6 default award categories?\n\nExisting categories will not be affected.")) return;
    setSaving(true);
    try {
      const { error: e } = await supabase
        .from("award_categories")
        .insert(DEFAULT_CATEGORIES.map((c) => ({ ...c, nomination_open: false, voting_open: false })));
      if (e) throw e;
      setMessage("Default categories added.");
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ─── OPEN DETAIL VIEW ───────────────────────────────────────

  function openDetail(cat) {
    setActiveCategory(cat);
    setMessage(""); setError("");
    setView(VIEW.DETAIL);
  }

  // ─── RENDER ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-spinner" />
        <h2>Loading Awards...</h2>
      </div>
    );
  }

  // ── DETAIL VIEW ──────────────────────────────────────────────
  if (view === VIEW.DETAIL && activeCategory) {
    const totalNominations = nominations.filter((n) => n.category_id === activeCategory.id).length;
    const totalVotes       = votes.filter((v) => v.category_id === activeCategory.id).length;
    const totalFinalists   = finalists.filter((f) => f.category_id === activeCategory.id).length;

    return (
      <div>

        {/* Back */}
        <button
          className="awards-admin-back-btn"
          onClick={() => { setView(VIEW.LIST); setActiveCategory(null); }}
        >
          ← Back to All Awards
        </button>

        {/* Header */}
        <div className="page-header" style={{ marginTop: 8 }}>
          <div>
            <p className="page-eyebrow">AWARD MANAGEMENT</p>
            <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span>{getCategoryIcon(activeCategory)}</span>
              {activeCategory.name}
            </h1>
            {activeCategory.description && (
              <p style={{ color: "#777", marginTop: 6 }}>{activeCategory.description}</p>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="secondary-button" onClick={() => openEditCategory(activeCategory)}>
              Edit Award
            </button>
            <button className="secondary-button" onClick={loadData}>↻ Refresh</button>
          </div>
        </div>

        {message && <div className="admin-success-message">{message}</div>}
        {error   && <div className="admin-error-message">{error}</div>}

        {/* Status controls */}
        <div className="awards-status-controls">
          <div className="awards-status-card">
            <div>
              <span className="page-eyebrow">NOMINATIONS</span>
              <p>{activeCategory.nomination_open ? "Open — classmates can nominate" : "Closed"}</p>
            </div>
            <button
              className={activeCategory.nomination_open ? "secondary-button" : "admin-primary-button"}
              onClick={() => toggleField(activeCategory, "nomination_open")}
            >
              {activeCategory.nomination_open ? "Close Nominations" : "Open Nominations"}
            </button>
          </div>

          <div className="awards-status-card">
            <div>
              <span className="page-eyebrow">VOTING</span>
              <p>{activeCategory.voting_open ? "Open — classmates can vote" : "Closed"}</p>
            </div>
            <button
              className={activeCategory.voting_open ? "secondary-button" : "admin-primary-button"}
              onClick={() => toggleField(activeCategory, "voting_open")}
            >
              {activeCategory.voting_open ? "Close Voting" : "Open Voting"}
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="summary-cards" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 28 }}>
          <div><span>Nominations</span><strong>{totalNominations}</strong></div>
          <div><span>Finalists</span><strong>{totalFinalists}</strong></div>
          <div><span>Votes Cast</span><strong>{totalVotes}</strong></div>
        </div>

        {/* ── NOMINATIONS SECTION ── */}
        <div className="data-card" style={{ marginBottom: 24 }}>
          <div className="data-card-header">
            <div>
              <h2>Nominations</h2>
              <p>
                {activeSortedNominees.length} nominee{activeSortedNominees.length !== 1 ? "s" : ""} received nominations.
                Tick the ones you want to include in voting.
              </p>
            </div>
            {activeSortedNominees.some((n) => !n.isFinalist) && (
              <button
                className="admin-primary-button"
                onClick={() => addAllNomineesAsFinalists(activeCategory.id)}
              >
                Add All as Finalists
              </button>
            )}
          </div>

          {activeSortedNominees.length === 0 ? (
            <div className="empty-message">
              <div className="empty-icon">🗳️</div>
              <strong>No nominations yet</strong>
              <p>Open nominations so classmates can start nominating.</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nominee</th>
                    <th>Class ID</th>
                    <th>Nominations</th>
                    <th>Finalist</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSortedNominees.map((row) => (
                    <tr key={row.nomineeId}>
                      <td><strong>{row.classmate.full_name}</strong></td>
                      <td>
                        <code style={{ background: "#f4f0e6", padding: "4px 7px", borderRadius: 5, fontSize: 11 }}>
                          {row.classmate.class_id}
                        </code>
                      </td>
                      <td>
                        <strong style={{ color: "#b28a45" }}>{row.nominations}</strong>
                      </td>
                      <td>
                        {row.isFinalist ? (
                          <span className="admin-status-badge status-paid">✓ Finalist</span>
                        ) : (
                          <span className="admin-status-badge status-unpaid">Not Added</span>
                        )}
                      </td>
                      <td>
                        {row.isFinalist ? (
                          <button
                            className="admin-table-action"
                            style={{ background: "#fef3f2", color: "#b42318" }}
                            onClick={() => removeFinalist(activeCategory.id, row.nomineeId)}
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            className="admin-table-action"
                            onClick={() => addFinalist(activeCategory.id, row.nomineeId)}
                          >
                            Add Finalist
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── FINALISTS + RESULTS ── */}
        <div className="data-card">
          <div className="data-card-header">
            <div>
              <h2>Finalists & Voting Results</h2>
              <p>
                {activeFinalistResults.length} finalist{activeFinalistResults.length !== 1 ? "s" : ""}.
                {activeCategory.voting_open
                  ? " Voting is currently open."
                  : " Open voting when you're ready."}
              </p>
            </div>
          </div>

          {activeFinalistResults.length === 0 ? (
            <div className="empty-message">
              <div className="empty-icon">🏆</div>
              <strong>No finalists yet</strong>
              <p>Add finalists from the nominations above.</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Finalist</th>
                    <th>Class ID</th>
                    <th>Votes</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeFinalistResults.map((f, index) => (
                    <tr key={f.classmate_id}>
                      <td>
                        <strong style={{ color: index === 0 ? "#b28a45" : "#667085" }}>
                          {index + 1}
                        </strong>
                      </td>
                      <td>
                        <strong>
                          {index === 0 && totalVotes > 0 && "🏆 "}
                          {f.classmate.full_name}
                        </strong>
                      </td>
                      <td>
                        <code style={{ background: "#f4f0e6", padding: "4px 7px", borderRadius: 5, fontSize: 11 }}>
                          {f.classmate.class_id}
                        </code>
                      </td>
                      <td>
                        <strong style={{ color: "#172033", fontSize: 16 }}>{f.votes}</strong>
                      </td>
                      <td>
                        <button
                          className="admin-table-action"
                          style={{ background: "#fef3f2", color: "#b42318" }}
                          onClick={() => removeFinalist(activeCategory.id, f.classmate_id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    );
  }

  // ── LIST VIEW ────────────────────────────────────────────────
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
            <button className="secondary-button" onClick={seedDefaultCategories} disabled={saving}>
              Add Default Awards
            </button>
          )}
          <button className="secondary-button" onClick={loadData}>↻ Refresh</button>
          <button className="admin-primary-button" onClick={openNewCategory}>+ Add Award</button>
        </div>
      </div>

      {message && <div className="admin-success-message">{message}</div>}
      {error   && <div className="admin-error-message">{error}</div>}

      {/* Summary */}
      <div className="summary-cards" style={{ marginBottom: 24 }}>
        <div><span>Award Categories</span><strong>{categories.length}</strong></div>
        <div><span>Total Nominations</span><strong>{nominations.length}</strong></div>
        <div>
          <span>Total Finalists</span>
          <strong>{finalists.length}</strong>
        </div>
        <div><span>Total Votes</span><strong>{votes.length}</strong></div>
      </div>

      {/* Category list */}
      {categories.length === 0 ? (
        <div className="awards-admin-empty">
          <span>🏆</span>
          <h3>No award categories yet</h3>
          <p>Create your first award or add the default set to get started quickly.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="admin-primary-button" onClick={openNewCategory}>+ Create Award</button>
            <button className="secondary-button" onClick={seedDefaultCategories}>Add Default Awards</button>
          </div>
        </div>
      ) : (
        <div className="awards-admin-grid">
          {categories.map((cat) => {
            const nomCount      = nominations.filter((n) => n.category_id === cat.id).length;
            const finalistCount = finalists.filter((f) => f.category_id === cat.id).length;
            const voteCount     = votes.filter((v) => v.category_id === cat.id).length;
            const icon          = getCategoryIcon(cat);

            return (
              <div key={cat.id} className="awards-admin-card">

                <div className="awards-admin-card-header">
                  <span className="awards-admin-icon">{icon}</span>
                  <div className="awards-admin-card-title">
                    <h3>{cat.name}</h3>
                    {cat.description && <p>{cat.description}</p>}
                  </div>
                </div>

                {/* Status badges */}
                <div className="awards-status-row">
                  <span className={`admin-status-badge ${cat.nomination_open ? "status-paid" : "status-unpaid"}`}>
                    {cat.nomination_open ? "Nominations Open" : "Nominations Closed"}
                  </span>
                  <span className={`admin-status-badge ${cat.voting_open ? "status-paid" : "status-unpaid"}`}>
                    {cat.voting_open ? "Voting Open" : "Voting Closed"}
                  </span>
                </div>

                {/* Counts */}
                <div className="awards-admin-counts">
                  <div><strong>{nomCount}</strong><span>Nominations</span></div>
                  <div><strong>{finalistCount}</strong><span>Finalists</span></div>
                  <div><strong>{voteCount}</strong><span>Votes</span></div>
                </div>

                {/* Actions */}
                <div className="awards-admin-actions">
                  <button
                    className="admin-primary-button"
                    onClick={() => openDetail(cat)}
                    style={{ flex: 1 }}
                  >
                    Manage →
                  </button>
                  <button
                    className="admin-table-action"
                    onClick={() => openEditCategory(cat)}
                  >
                    Edit
                  </button>
                  <button
                    className="admin-table-action"
                    style={{ background: "#fef3f2", color: "#b42318" }}
                    onClick={() => deleteCategory(cat)}
                  >
                    Delete
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ── CREATE / EDIT MODAL ── */}
      {showModal && (
        <div className="modal-background" onClick={() => setShowModal(false)}>
          <div className="details-modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setShowModal(false)}>×</button>

            <p className="page-eyebrow">AWARD MANAGEMENT</p>
            <h2 style={{ marginBottom: 20 }}>
              {editingCategory ? "Edit Award" : "Create Award"}
            </h2>

            {error && <div className="admin-error-message">{error}</div>}

            <form className="admin-form" onSubmit={saveCategory}>

              <label>
                Award Name *
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Most Successful Entrepreneur"
                  required
                />
              </label>

              <div className="admin-form-grid">
                <label>
                  Icon (emoji)
                  <input
                    type="text"
                    name="icon"
                    value={form.icon}
                    onChange={handleChange}
                    placeholder="🏆"
                    maxLength={4}
                  />
                </label>
              </div>

              <label>
                Description
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows="3"
                  placeholder="What does this award recognise?"
                />
              </label>

              <div className="awards-checkbox-row">
                <label className="awards-checkbox-label">
                  <input
                    type="checkbox"
                    name="nomination_open"
                    checked={form.nomination_open}
                    onChange={handleChange}
                  />
                  Allow nominations
                </label>
                <label className="awards-checkbox-label">
                  <input
                    type="checkbox"
                    name="voting_open"
                    checked={form.voting_open}
                    onChange={handleChange}
                  />
                  Allow voting
                </label>
              </div>

              <div className="admin-modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="admin-primary-button" disabled={saving}>
                  {saving ? "Saving..." : editingCategory ? "Update Award" : "Create Award"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
