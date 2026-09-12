import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./lib/supabase";
import "./Awards.css";

// ─── STEP CONSTANTS ───────────────────────────────────────────
const STEP = {
  VERIFY:    "verify",
  BROWSE:    "browse",
  NOMINATE:  "nominate",
  VOTE:      "vote",
};

// Default icons for known award types
const CATEGORY_ICONS = {
  "Most Outstanding":   "🏆",
  "Most Successful":    "💼",
  "Most Supportive":    "❤️",
  "Most Humorous":      "😂",
  "Best Dressed":       "👔",
  "Most Influential":   "🌟",
  "Most Likely":        "🎯",
  "Best Couple":        "💑",
  "Most Improved":      "📈",
  "Class Clown":        "🤣",
};

function getCategoryIcon(category) {
  if (category.icon && category.icon !== "🏆") return category.icon;
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (category.name.includes(key)) return icon;
  }
  return "🏆";
}

export default function AwardsPage() {
  // ── Auth state
  const [classId, setClassId]   = useState("");
  const [phone, setPhone]       = useState("");
  const [member, setMember]     = useState(null);

  // ── Data
  const [categories, setCategories]     = useState([]);
  const [allClassmates, setAllClassmates] = useState([]);
  const [finalists, setFinalists]       = useState([]);
  const [myNominations, setMyNominations] = useState({});  // categoryId → nomineeId
  const [myVotes, setMyVotes]           = useState({});    // categoryId → true

  // ── UI state
  const [step, setStep]                   = useState(STEP.VERIFY);
  const [activeCategory, setActiveCategory] = useState(null);
  const [nomineeSearch, setNomineeSearch]   = useState("");
  const [selectedNominee, setSelectedNominee] = useState("");
  const [reason, setReason]               = useState("");

  // ── Loading / feedback
  const [loading, setLoading]       = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage]       = useState("");
  const [error, setError]           = useState("");

  // Load categories on mount (public — no auth needed)
  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    const { data, error: e } = await supabase
      .from("award_categories")
      .select("*")
      .order("created_at", { ascending: true });

    if (!e) setCategories(data || []);
  }

  // ─── STEP 1: VERIFY ────────────────────────────────────────

  async function handleVerify(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "verify_reunion_member",
        { p_class_id: classId.trim(), p_phone: phone.trim() }
      );

      if (rpcError) throw rpcError;
      if (!data || data.length === 0) {
        throw new Error(
          "We couldn't verify your details. Please check your Classmate ID and phone number."
        );
      }

      const verified = data[0];

      // Guard: make sure the returned row has the expected shape
      if (!verified.id || !verified.full_name) {
        throw new Error(
          "Verification returned incomplete data. Please contact the admin."
        );
      }
      setMember(verified);

      // Load this member's existing nominations and votes
      await loadMyActivity(verified.id);

      setStep(STEP.BROWSE);
      setMessage(`Welcome, ${verified.full_name}! Select an award below.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadMyActivity(memberId) {
    // Load nominations this member has already submitted
    const { data: nomData } = await supabase
      .from("award_nominations")
      .select("category_id, nominee_id")
      .eq("nominator_id", memberId);

    const nomMap = {};
    (nomData || []).forEach((n) => { nomMap[n.category_id] = n.nominee_id; });
    setMyNominations(nomMap);

    // Load votes this member has already cast
    const { data: voteData } = await supabase
      .from("award_votes")
      .select("category_id")
      .eq("voter_id", memberId);

    const voteMap = {};
    (voteData || []).forEach((v) => { voteMap[v.category_id] = true; });
    setMyVotes(voteMap);
  }

  // ─── STEP 2: BROWSE — open a category ──────────────────────

  async function openCategory(category) {
    setActiveCategory(category);
    setSelectedNominee("");
    setNomineeSearch("");
    setReason("");
    setMessage("");
    setError("");

    if (category.nomination_open) {
      // Load all classmates (name + class ID only — no private data)
      setLoading(true);
      const { data, error: rpcError } = await supabase.rpc(
        "get_classmates_for_nomination",
        { p_nominator_id: member.id }
      );
      setLoading(false);

      if (rpcError) { setError(rpcError.message); return; }
      setAllClassmates(data || []);

      // Pre-select their previous nominee if they already nominated
      const prevNominee = myNominations[category.id];
      if (prevNominee) setSelectedNominee(prevNominee);

      setStep(STEP.NOMINATE);
    } else if (category.voting_open) {
      // Load finalists approved by admin
      setLoading(true);
      const { data, error: rpcError } = await supabase.rpc(
        "get_finalists_for_voting",
        { p_category_id: category.id }
      );
      setLoading(false);

      if (rpcError) { setError(rpcError.message); return; }
      setFinalists(data || []);
      setStep(STEP.VOTE);
    } else {
      setMessage("This award is not yet open for nominations or voting.");
    }
  }

  // ─── STEP 3: NOMINATE ──────────────────────────────────────

  // Filtered classmate list based on search input
  const filteredClassmates = useMemo(() => {
    const term = nomineeSearch.toLowerCase().trim();
    if (!term) return allClassmates;
    return allClassmates.filter(
      (c) =>
        c.full_name.toLowerCase().includes(term) ||
        c.class_id.toLowerCase().includes(term)
    );
  }, [allClassmates, nomineeSearch]);

  async function handleNominate(e) {
    e.preventDefault();
    if (!selectedNominee) { setError("Please select a classmate to nominate."); return; }

    setActionLoading(true);
    setError("");
    setMessage("");

    try {
      const { data, error: rpcError } = await supabase.rpc("submit_nomination", {
        p_nominator_id: member.id,
        p_category_id:  activeCategory.id,
        p_nominee_id:   selectedNominee,
        p_reason:       reason.trim() || null,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || "Nomination could not be submitted.");

      // Update local nominations map
      setMyNominations((prev) => ({ ...prev, [activeCategory.id]: selectedNominee }));
      setMessage(data.message);
      setStep(STEP.BROWSE);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  // ─── STEP 4: VOTE ──────────────────────────────────────────

  async function handleVote(nomineeId) {
    if (myVotes[activeCategory.id]) {
      setError("You have already voted for this award.");
      return;
    }

    setActionLoading(true);
    setError("");
    setMessage("");

    try {
      const { data, error: rpcError } = await supabase.rpc("submit_vote", {
        p_voter_id:    member.id,
        p_category_id: activeCategory.id,
        p_nominee_id:  nomineeId,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || "Vote could not be recorded.");

      setMyVotes((prev) => ({ ...prev, [activeCategory.id]: true }));
      setMessage(data.message);
      setStep(STEP.BROWSE);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  // ─── LOGOUT ────────────────────────────────────────────────

  function logout() {
    setMember(null);
    setClassId("");
    setPhone("");
    setStep(STEP.VERIFY);
    setActiveCategory(null);
    setMyNominations({});
    setMyVotes({});
    setMessage("");
    setError("");
  }

  // ─── HELPERS ───────────────────────────────────────────────

  function getSelectedNomineeName() {
    const c = allClassmates.find((cm) => cm.id === selectedNominee);
    return c ? `${c.full_name} (${c.class_id})` : "";
  }

  // ─── RENDER ────────────────────────────────────────────────

  return (
    <div className="awards-page">

      {/* HERO */}
      <section className="awards-hero">
        <div className="awards-hero-content">
          <Link to="/" className="awards-back-link">← Back to Home</Link>
          <span>3A12 • CLASS OF 2021</span>
          <h1>Reunion <strong>Awards</strong></h1>
          <p>
            Celebrate the classmates who have inspired, supported
            and represented our class.
          </p>
        </div>
      </section>

      <main className="awards-container">

        {/* ── STEP: VERIFY ── */}
        {step === STEP.VERIFY && (
          <section className="member-verification-card">
            <span className="awards-eyebrow">CLASSMATE ACCESS</span>
            <h2>Verify Your Identity</h2>
            <p>
              Enter the Classmate ID and phone number you used
              when registering for the reunion.
            </p>

            {error && <div className="awards-error">{error}</div>}

            <form onSubmit={handleVerify} className="awards-form">
              <label>
                Classmate ID
                <input
                  type="text"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  placeholder="e.g. 3A12-BF3F011A"
                  autoCapitalize="characters"
                  required
                />
              </label>

              <label>
                Phone / WhatsApp Number
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 024 XXX XXXX"
                  required
                />
              </label>

              <button
                className="awards-primary-button"
                type="submit"
                disabled={loading}
              >
                {loading ? "Verifying..." : "Continue to Awards →"}
              </button>
            </form>
          </section>
        )}

        {/* ── STEP: BROWSE ── */}
        {step === STEP.BROWSE && member && (
          <>
            {/* Member header */}
            <div className="awards-member-bar">
              <div>
                <span className="awards-eyebrow">VERIFIED CLASSMATE</span>
                <p className="awards-member-name">{member.full_name}</p>
                <code className="awards-class-id">{member.class_id}</code>
              </div>
              <button className="awards-outline-button" onClick={logout}>
                Sign Out
              </button>
            </div>

            {message && <div className="awards-success">{message}</div>}
            {error   && <div className="awards-error">{error}</div>}

            <div className="awards-section-heading">
              <span className="awards-eyebrow">2026 REUNION</span>
              <h2>Award Categories</h2>
              <p>
                Select an award to nominate a classmate or cast your vote.
                You can nominate one person per category.
              </p>
            </div>

            {categories.length === 0 ? (
              <div className="awards-empty">
                <span>🏆</span>
                <h3>Award categories coming soon</h3>
                <p>The admin is setting up the awards. Check back shortly.</p>
              </div>
            ) : (
              <div className="public-award-grid">
                {categories.map((cat) => {
                  const hasNominated  = !!myNominations[cat.id];
                  const hasVoted      = !!myVotes[cat.id];
                  const icon          = getCategoryIcon(cat);

                  return (
                    <button
                      key={cat.id}
                      className="public-award-card"
                      onClick={() => openCategory(cat)}
                    >
                      <span className="award-card-icon">{icon}</span>
                      <h3>{cat.name}</h3>
                      {cat.description && <p>{cat.description}</p>}

                      <div className="public-award-status">
                        {cat.nomination_open && (
                          <span className="status-open">
                            {hasNominated ? "✓ Nominated" : "Nominations Open"}
                          </span>
                        )}
                        {cat.voting_open && (
                          <span className="status-open">
                            {hasVoted ? "✓ Voted" : "Voting Open"}
                          </span>
                        )}
                        {!cat.nomination_open && !cat.voting_open && (
                          <span className="status-closed">Closed</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── STEP: NOMINATE ── */}
        {step === STEP.NOMINATE && activeCategory && (
          <div className="awards-action-page">

            <button
              className="awards-back-btn"
              onClick={() => { setStep(STEP.BROWSE); setError(""); setMessage(""); }}
            >
              ← Back to Categories
            </button>

            <span className="awards-eyebrow">NOMINATE</span>
            <h2>{activeCategory.name}</h2>
            {activeCategory.description && (
              <p className="awards-action-desc">{activeCategory.description}</p>
            )}

            {myNominations[activeCategory.id] && (
              <div className="awards-info-banner">
                You have already submitted a nomination for this award.
                Submitting again will replace your previous choice.
              </div>
            )}

            {error   && <div className="awards-error">{error}</div>}
            {message && <div className="awards-success">{message}</div>}

            <form onSubmit={handleNominate} className="awards-nominate-form">

              {/* Search */}
              <div className="nominate-search-box">
                <input
                  type="text"
                  placeholder="Search by name or class ID..."
                  value={nomineeSearch}
                  onChange={(e) => setNomineeSearch(e.target.value)}
                  autoFocus
                />
                {nomineeSearch && (
                  <button
                    type="button"
                    className="nominate-clear-btn"
                    onClick={() => setNomineeSearch("")}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Classmate list */}
              {loading ? (
                <div className="awards-loading">Loading classmates...</div>
              ) : (
                <div className="nominate-list">
                  {filteredClassmates.length === 0 ? (
                    <div className="nominate-empty">
                      No classmates match "{nomineeSearch}".
                    </div>
                  ) : (
                    filteredClassmates.map((cm) => (
                      <label
                        key={cm.id}
                        className={`nominate-row ${
                          selectedNominee === cm.id ? "selected" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="nominee"
                          value={cm.id}
                          checked={selectedNominee === cm.id}
                          onChange={() => setSelectedNominee(cm.id)}
                        />
                        <div className="nominate-row-info">
                          <strong>{cm.full_name}</strong>
                          <code>{cm.class_id}</code>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              )}

              {/* Selected summary */}
              {selectedNominee && (
                <div className="nominate-selected-summary">
                  Nominating: <strong>{getSelectedNomineeName()}</strong>
                </div>
              )}

              {/* Optional reason */}
              <label className="nominate-reason-label">
                Why are you nominating this person?
                <span className="nominate-optional">(optional)</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows="3"
                  placeholder="e.g. He has consistently supported classmates and organized several activities."
                />
              </label>

              <div className="awards-action-footer">
                <button
                  type="button"
                  className="awards-outline-button"
                  onClick={() => { setStep(STEP.BROWSE); setError(""); }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="awards-primary-button"
                  disabled={actionLoading || !selectedNominee}
                >
                  {actionLoading ? "Submitting..." : "Submit Nomination →"}
                </button>
              </div>

            </form>
          </div>
        )}

        {/* ── STEP: VOTE ── */}
        {step === STEP.VOTE && activeCategory && (
          <div className="awards-action-page">

            <button
              className="awards-back-btn"
              onClick={() => { setStep(STEP.BROWSE); setError(""); setMessage(""); }}
            >
              ← Back to Categories
            </button>

            <span className="awards-eyebrow">CAST YOUR VOTE</span>
            <h2>{activeCategory.name}</h2>
            {activeCategory.description && (
              <p className="awards-action-desc">{activeCategory.description}</p>
            )}

            {myVotes[activeCategory.id] ? (
              <div className="awards-success awards-voted-banner">
                ✓ You have already voted for this award. Thank you!
              </div>
            ) : (
              <p className="awards-vote-instruction">
                Choose one finalist below. You can only vote once for this award.
              </p>
            )}

            {error   && <div className="awards-error">{error}</div>}
            {message && <div className="awards-success">{message}</div>}

            {loading ? (
              <div className="awards-loading">Loading finalists...</div>
            ) : finalists.length === 0 ? (
              <div className="awards-empty">
                <span>🏆</span>
                <h3>Finalists not yet announced</h3>
                <p>The admin is reviewing nominations. Check back soon.</p>
              </div>
            ) : (
              <div className="vote-list">
                {finalists.map((f) => (
                  <div key={f.classmate_id} className="vote-row">
                    <div className="vote-row-info">
                      <strong>{f.full_name}</strong>
                      <code>{f.class_id}</code>
                    </div>

                    {myVotes[activeCategory.id] ? (
                      <span className="vote-cast-label">Voted ✓</span>
                    ) : (
                      <button
                        className="awards-vote-button"
                        onClick={() => handleVote(f.classmate_id)}
                        disabled={actionLoading}
                      >
                        {actionLoading ? "..." : "🗳️ Vote"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!myVotes[activeCategory.id] && finalists.length > 0 && (
              <p className="awards-vote-note">
                Your vote is anonymous and final. You cannot change it after submitting.
              </p>
            )}

          </div>
        )}

      </main>
    </div>
  );
}
