import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./lib/supabase";
import {
  Trophy, Briefcase, Heart, Laugh, Shirt, Star, Target,
  TrendingUp, AlertTriangle, Check, Vote, X, Info,
} from "lucide-react";
import "./Awards.css";

// ─── STEP CONSTANTS ───────────────────────────────────────────
const STEP = {
  VERIFY:   "verify",
  BROWSE:   "browse",
  NOMINATE: "nominate",
  VOTE:     "vote",
};

// Component-based icon lookup — no emojis
const CATEGORY_ICON_MAP = {
  "Most Outstanding": Trophy,
  "Most Successful":  Briefcase,
  "Most Supportive":  Heart,
  "Most Humorous":    Laugh,
  "Best Dressed":     Shirt,
  "Most Influential": Star,
  "Most Likely":      Target,
  "Best Couple":      Heart,
  "Most Improved":    TrendingUp,
  "Class Clown":      Laugh,
};

function CategoryIcon({ category, size = 20 }) {
  for (const [key, Icon] of Object.entries(CATEGORY_ICON_MAP)) {
    if (category.name.includes(key)) return <Icon size={size} aria-hidden="true" />;
  }
  return <Trophy size={size} aria-hidden="true" />;
}

// ─── Shared feedback components ───────────────────────────────
function FeedbackBanner({ type, message, id }) {
  if (!message) return null;
  return (
    <div
      id={id}
      className={`awards-feedback awards-feedback--${type}`}
      role="alert"
      aria-live={type === "error" ? "assertive" : "polite"}
    >
      {type === "error"
        ? <AlertTriangle size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
        : <Check size={15} aria-hidden="true" style={{ flexShrink: 0 }} />}
      {message}
    </div>
  );
}

// ─── Vote confirmation dialog ─────────────────────────────────
function VoteConfirmDialog({ nominee, onConfirm, onCancel, loading }) {
  const confirmRef = useRef(null);
  useEffect(() => { confirmRef.current?.focus(); }, []);

  return (
    <div
      className="vote-confirm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vote-confirm-heading"
    >
      <div className="vote-confirm-card">
        <h3 id="vote-confirm-heading">Confirm Your Vote</h3>
        <p>
          You are about to vote for <strong>{nominee}</strong>.
          This action is <strong>final</strong> — you cannot change your vote after submitting.
        </p>
        <div className="vote-confirm-actions">
          <button
            className="awards-outline-button"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            className="awards-primary-button"
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <><span className="awards-spinner" aria-hidden="true" /> Submitting…</>
            ) : (
              "Yes, Submit My Vote"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AwardsPage() {
  // ── Auth state
  const [classId, setClassId] = useState("");
  const [phone, setPhone]     = useState("");
  const [member, setMember]   = useState(null);

  // ── Data
  const [categories, setCategories]       = useState([]);
  const [allClassmates, setAllClassmates] = useState([]);
  const [finalists, setFinalists]         = useState([]);
  const [myNominations, setMyNominations] = useState({});
  const [myVotes, setMyVotes]             = useState({});

  // ── UI state
  const [step, setStep]                     = useState(STEP.VERIFY);
  const [activeCategory, setActiveCategory] = useState(null);
  const [nomineeSearch, setNomineeSearch]   = useState("");
  const [selectedNominee, setSelectedNominee] = useState("");
  const [reason, setReason]               = useState("");

  // Vote confirmation dialog
  const [pendingVote, setPendingVote] = useState(null); // { nomineeId, nomineeName }

  // ── Loading / feedback
  const [loading, setLoading]           = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage]           = useState("");
  const [error, setError]               = useState("");

  // Focus management — move focus to feedback when it appears
  const errorRef   = useRef(null);
  const messageRef = useRef(null);
  useEffect(() => { if (error)   errorRef.current?.focus();   }, [error]);
  useEffect(() => { if (message) messageRef.current?.focus(); }, [message]);

  // ── Escape key closes confirm dialog
  useEffect(() => {
    if (!pendingVote) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") setPendingVote(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pendingVote]);

  // Load categories on mount
  useEffect(() => { loadCategories(); }, []);

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
        { p_class_id: classId.trim().toUpperCase(), p_phone: phone.trim() }
      );

      if (rpcError) throw rpcError;
      if (!data || data.length === 0) {
        throw new Error(
          "We couldn't find a registration matching that Classmate ID and phone number. " +
          "Please double-check both fields and try again."
        );
      }

      const verified = data[0];
      if (!verified.id || !verified.full_name) {
        throw new Error(
          "Verification returned incomplete data. Please contact the reunion committee."
        );
      }

      setMember(verified);
      await loadMyActivity(verified.id);
      setStep(STEP.BROWSE);
      setMessage(`Welcome back, ${verified.full_name}! Select an award below.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadMyActivity(memberId) {
    const { data: nomData } = await supabase
      .from("award_nominations")
      .select("category_id, nominee_id")
      .eq("nominator_id", memberId);

    const nomMap = {};
    (nomData || []).forEach((n) => { nomMap[n.category_id] = n.nominee_id; });
    setMyNominations(nomMap);

    const { data: voteData } = await supabase
      .from("award_votes")
      .select("category_id")
      .eq("voter_id", memberId);

    const voteMap = {};
    (voteData || []).forEach((v) => { voteMap[v.category_id] = true; });
    setMyVotes(voteMap);
  }

  // ─── STEP 2: BROWSE ────────────────────────────────────────

  async function openCategory(category) {
    setActiveCategory(category);
    setSelectedNominee("");
    setNomineeSearch("");
    setReason("");
    setMessage("");
    setError("");

    if (category.nomination_open) {
      setLoading(true);
      const { data, error: rpcError } = await supabase.rpc(
        "get_classmates_for_nomination",
        { p_nominator_id: member.id }
      );
      setLoading(false);
      if (rpcError) { setError("Could not load classmates. Please try again."); return; }
      setAllClassmates(data || []);

      const prevNominee = myNominations[category.id];
      if (prevNominee) setSelectedNominee(prevNominee);
      setStep(STEP.NOMINATE);
    } else if (category.voting_open) {
      setLoading(true);
      const { data, error: rpcError } = await supabase.rpc(
        "get_finalists_for_voting",
        { p_category_id: category.id }
      );
      setLoading(false);
      if (rpcError) { setError("Could not load finalists. Please try again."); return; }
      setFinalists(data || []);
      setStep(STEP.VOTE);
    } else {
      setMessage("This award is not yet open for nominations or voting. Check back soon.");
    }
  }

  // ─── STEP 3: NOMINATE ──────────────────────────────────────

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
    if (!selectedNominee) {
      setError("Please select a classmate to nominate before submitting.");
      return;
    }

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

  function requestVote(nomineeId, nomineeName) {
    if (myVotes[activeCategory.id]) {
      setError("You have already voted for this award. Each member may only vote once.");
      return;
    }
    setPendingVote({ nomineeId, nomineeName });
  }

  async function confirmVote() {
    if (!pendingVote) return;
    setActionLoading(true);
    setError("");
    setMessage("");

    try {
      const { data, error: rpcError } = await supabase.rpc("submit_vote", {
        p_voter_id:    member.id,
        p_category_id: activeCategory.id,
        p_nominee_id:  pendingVote.nomineeId,
      });

      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.message || "Vote could not be recorded.");

      setMyVotes((prev) => ({ ...prev, [activeCategory.id]: true }));
      setMessage(data.message || "Your vote has been recorded. Thank you!");
      setPendingVote(null);
      setStep(STEP.BROWSE);
    } catch (err) {
      setError(err.message);
      setPendingVote(null);
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

  function goBackToBrowse() {
    setStep(STEP.BROWSE);
    setError("");
    setMessage("");
  }

  // ─── RENDER ────────────────────────────────────────────────

  return (
    <div className="awards-page">

      {/* HERO */}
      <section className="awards-hero" aria-labelledby="awards-hero-heading">
        <div className="awards-hero-content">
          <Link
            to="/"
            className="awards-back-link"
            aria-label="Back to reunion home page"
          >
            ← Back to Home
          </Link>
          <span aria-hidden="true">3A12 • CLASS OF 2021</span>
          <h1 id="awards-hero-heading">
            Reunion <strong>Awards</strong>
          </h1>
          <p>
            Celebrate the classmates who have inspired, supported
            and represented our class.
          </p>
        </div>
      </section>

      <main className="awards-container" aria-label="Awards portal">

        {/* ── VERIFY ── */}
        {step === STEP.VERIFY && (
          <section
            className="member-verification-card"
            aria-labelledby="verify-heading"
          >
            <span className="awards-eyebrow" aria-hidden="true">CLASSMATE ACCESS</span>
            <h2 id="verify-heading">Verify Your Identity</h2>
            <p>
              Enter the Classmate ID and phone number you registered with.
              Your data is used only to confirm you're a verified class member.
            </p>

            <FeedbackBanner type="error" message={error} id="verify-error" />

            <form
              onSubmit={handleVerify}
              className="awards-form"
              noValidate
              aria-label="Identity verification form"
            >
              <div className="awards-form-field">
                <label htmlFor="verify-class-id">Classmate ID</label>
                <input
                  id="verify-class-id"
                  type="text"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  placeholder="e.g. 3A12-BF3F011A"
                  autoCapitalize="characters"
                  autoComplete="off"
                  required
                  aria-required="true"
                  aria-describedby="verify-class-id-hint"
                />
                <p className="awards-field-hint" id="verify-class-id-hint">
                  You received this ID when you registered for the reunion.
                </p>
              </div>

              <div className="awards-form-field">
                <label htmlFor="verify-phone">Phone / WhatsApp Number</label>
                <input
                  id="verify-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 024 XXX XXXX"
                  autoComplete="tel"
                  required
                  aria-required="true"
                  aria-describedby="verify-phone-hint"
                />
                <p className="awards-field-hint" id="verify-phone-hint">
                  The same number you used during registration.
                </p>
              </div>

              <button
                className="awards-primary-button"
                type="submit"
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? (
                  <><span className="awards-spinner" aria-hidden="true" /> Verifying…</>
                ) : (
                  "Continue to Awards →"
                )}
              </button>
            </form>
          </section>
        )}

        {/* ── BROWSE ── */}
        {step === STEP.BROWSE && member && (
          <>
            <div className="awards-member-bar" role="region" aria-label="Your verified identity">
              <div>
                <span className="awards-eyebrow" aria-hidden="true">VERIFIED CLASSMATE</span>
                <p className="awards-member-name">{member.full_name}</p>
                <code className="awards-class-id" aria-label={`Classmate ID: ${member.class_id}`}>
                  {member.class_id}
                </code>
              </div>
              <button
                className="awards-outline-button"
                onClick={logout}
                aria-label="Sign out of awards portal"
              >
                Sign Out
              </button>
            </div>

            {/* ARIA live region for browse-level feedback */}
            <div aria-live="polite" aria-atomic="true">
              <FeedbackBanner type="success" message={message} id="browse-success" />
              <FeedbackBanner type="error"   message={error}   id="browse-error"   />
            </div>

            <div className="awards-section-heading">
              <span className="awards-eyebrow" aria-hidden="true">2026 REUNION</span>
              <h2>Award Categories</h2>
              <p>
                Select an award to nominate a classmate or cast your vote.
                You can nominate one person per category.
              </p>
            </div>

            {categories.length === 0 ? (
              <div className="awards-empty" role="status">
                <Trophy size={48} aria-hidden="true" />
                <h3>Award categories coming soon</h3>
                <p>The admin is setting up the awards. Check back shortly.</p>
              </div>
            ) : (
              <div className="public-award-grid" role="list" aria-label="Award categories">
                {categories.map((cat) => {
                  const hasNominated = !!myNominations[cat.id];
                  const hasVoted     = !!myVotes[cat.id];
                  const isOpen       = cat.nomination_open || cat.voting_open;

                  let statusLabel = "Closed";
                  if (cat.nomination_open) statusLabel = hasNominated ? "Nominated" : "Nominations Open";
                  if (cat.voting_open)     statusLabel = hasVoted     ? "Voted"     : "Voting Open";

                  return (
                    <div key={cat.id} role="listitem">
                      <button
                        className={`public-award-card${!isOpen ? " public-award-card--closed" : ""}`}
                        onClick={() => openCategory(cat)}
                        aria-label={`${cat.name} — ${statusLabel}`}
                        aria-disabled={!isOpen}
                      >
                        <span className="award-card-icon" aria-hidden="true">
                          <CategoryIcon category={cat} size={28} />
                        </span>
                        <h3>{cat.name}</h3>
                        {cat.description && <p>{cat.description}</p>}

                        <div className="public-award-status" aria-hidden="true">
                          {cat.nomination_open && (
                            <span className="status-open">
                              {hasNominated ? <><Check size={12} style={{ display: "inline", verticalAlign: "middle" }} /> Nominated</> : "Nominations Open"}
                            </span>
                          )}
                          {cat.voting_open && (
                            <span className="status-open">
                              {hasVoted ? <><Check size={12} style={{ display: "inline", verticalAlign: "middle" }} /> Voted</> : "Voting Open"}
                            </span>
                          )}
                          {!isOpen && <span className="status-closed">Closed</span>}
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── NOMINATE ── */}
        {step === STEP.NOMINATE && activeCategory && (
          <div
            className="awards-action-page"
            role="main"
            aria-labelledby="nominate-heading"
          >
            <button className="awards-back-btn" onClick={goBackToBrowse}>
              ← Back to Categories
            </button>

            <span className="awards-eyebrow" aria-hidden="true">NOMINATE</span>
            <h2 id="nominate-heading">{activeCategory.name}</h2>
            {activeCategory.description && (
              <p className="awards-action-desc">{activeCategory.description}</p>
            )}

            {myNominations[activeCategory.id] && (
              <div className="awards-info-banner" role="note">
                <Info size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
                You've already nominated someone for this award.
                Submitting again will <strong>replace</strong> your previous choice.
              </div>
            )}

            <div aria-live="assertive">
              <FeedbackBanner type="error"   message={error}   id="nominate-error"   />
            </div>
            <div aria-live="polite">
              <FeedbackBanner type="success" message={message} id="nominate-success" />
            </div>

            <form
              onSubmit={handleNominate}
              className="awards-nominate-form"
              noValidate
              aria-label={`Nomination form for ${activeCategory.name}`}
            >
              {/* Search */}
              <div className="nominate-search-box">
                <label htmlFor="nominee-search" className="sr-only">
                  Search classmates by name or ID
                </label>
                <input
                  id="nominee-search"
                  type="search"
                  placeholder="Search by name or Classmate ID…"
                  value={nomineeSearch}
                  onChange={(e) => setNomineeSearch(e.target.value)}
                  autoFocus
                  aria-label="Search classmates"
                  aria-controls="nominee-list"
                />
                {nomineeSearch && (
                  <button
                    type="button"
                    className="nominate-clear-btn"
                    onClick={() => setNomineeSearch("")}
                    aria-label="Clear search"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>

              {/* Classmate list */}
              {loading ? (
                <div className="awards-loading" role="status" aria-live="polite">
                  <span className="awards-spinner awards-spinner--dark" aria-hidden="true" />
                  Loading classmates…
                </div>
              ) : (
                <div
                  id="nominee-list"
                  className="nominate-list"
                  role="radiogroup"
                  aria-label="Select a classmate to nominate"
                  aria-required="true"
                >
                  {filteredClassmates.length === 0 ? (
                    <div className="nominate-empty" role="status">
                      No classmates match "{nomineeSearch}". Try a different name or ID.
                    </div>
                  ) : (
                    filteredClassmates.map((cm) => (
                      <label
                        key={cm.id}
                        className={`nominate-row ${selectedNominee === cm.id ? "selected" : ""}`}
                      >
                        <input
                          type="radio"
                          name="nominee"
                          value={cm.id}
                          checked={selectedNominee === cm.id}
                          onChange={() => setSelectedNominee(cm.id)}
                          aria-label={`Nominate ${cm.full_name} (${cm.class_id})`}
                        />
                        <div className="nominate-row-info">
                          <strong>{cm.full_name}</strong>
                          <code aria-label={`Classmate ID ${cm.class_id}`}>{cm.class_id}</code>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              )}

              {/* Selected summary */}
              {selectedNominee && (
                <div
                  className="nominate-selected-summary"
                  aria-live="polite"
                  role="status"
                >
                  Nominating: <strong>{getSelectedNomineeName()}</strong>
                </div>
              )}

              {/* Optional reason */}
              <div className="awards-form-field">
                <label htmlFor="nominate-reason">
                  Why are you nominating this person?
                  <span className="nominate-optional" aria-label="optional"> (optional)</span>
                </label>
                <textarea
                  id="nominate-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows="3"
                  maxLength={400}
                  placeholder="e.g. He consistently supported classmates and organised several activities."
                  aria-describedby="nominate-reason-hint"
                />
                <p className="awards-field-hint" id="nominate-reason-hint">
                  Your reason may be seen by admins to help select finalists.
                  Max 400 characters.
                </p>
              </div>

              <div className="awards-action-footer">
                <button
                  type="button"
                  className="awards-outline-button"
                  onClick={goBackToBrowse}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="awards-primary-button"
                  disabled={actionLoading || !selectedNominee}
                  aria-busy={actionLoading}
                >
                  {actionLoading ? (
                    <><span className="awards-spinner" aria-hidden="true" /> Submitting…</>
                  ) : (
                    "Submit Nomination →"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── VOTE ── */}
        {step === STEP.VOTE && activeCategory && (
          <div
            className="awards-action-page"
            role="main"
            aria-labelledby="vote-heading"
          >
            <button className="awards-back-btn" onClick={goBackToBrowse}>
              ← Back to Categories
            </button>

            <span className="awards-eyebrow" aria-hidden="true">CAST YOUR VOTE</span>
            <h2 id="vote-heading">{activeCategory.name}</h2>
            {activeCategory.description && (
              <p className="awards-action-desc">{activeCategory.description}</p>
            )}

            {myVotes[activeCategory.id] ? (
              <div className="awards-voted-banner" role="status" aria-live="polite">
                <Check size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
                Your vote has been recorded for this award. Thank you!
              </div>
            ) : (
              <p className="awards-vote-instruction">
                Choose one finalist. You can only vote <strong>once</strong> for this award
                and your choice is final.
              </p>
            )}

            <div aria-live="assertive">
              <FeedbackBanner type="error"   message={error}   id="vote-error"   />
            </div>
            <div aria-live="polite">
              <FeedbackBanner type="success" message={message} id="vote-success" />
            </div>

            {loading ? (
              <div className="awards-loading" role="status" aria-live="polite">
                <span className="awards-spinner awards-spinner--dark" aria-hidden="true" />
                Loading finalists…
              </div>
            ) : finalists.length === 0 ? (
              <div className="awards-empty" role="status">
                <Trophy size={48} aria-hidden="true" />
                <h3>Finalists not yet announced</h3>
                <p>The admin is reviewing nominations. Check back soon.</p>
              </div>
            ) : (
              <div
                className="vote-list"
                role="list"
                aria-label={`Finalists for ${activeCategory.name}`}
              >
                {finalists.map((f) => (
                  <div key={f.classmate_id} className="vote-row" role="listitem">
                    <div className="vote-row-info">
                      <strong>{f.full_name}</strong>
                      <code aria-label={`Classmate ID ${f.class_id}`}>{f.class_id}</code>
                    </div>

                    {myVotes[activeCategory.id] ? (
                      <span className="vote-cast-label" aria-label="You voted for this finalist">
                        <Check size={13} style={{ display: "inline", verticalAlign: "middle" }} /> Voted
                      </span>
                    ) : (
                      <button
                        className="awards-vote-button"
                        onClick={() => requestVote(f.classmate_id, f.full_name)}
                        aria-label={`Vote for ${f.full_name}`}
                      >
                        <Vote size={15} aria-hidden="true" /> Vote
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!myVotes[activeCategory.id] && finalists.length > 0 && (
              <p className="awards-vote-note" role="note">
                Your vote is anonymous and final. You cannot change it after submitting.
              </p>
            )}
          </div>
        )}

      </main>

      {/* Vote confirmation dialog — rendered outside main so it overlays */}
      {pendingVote && (
        <VoteConfirmDialog
          nominee={pendingVote.nomineeName}
          onConfirm={confirmVote}
          onCancel={() => setPendingVote(null)}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
