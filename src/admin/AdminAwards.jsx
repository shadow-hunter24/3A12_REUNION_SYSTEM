import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import "./AdminPages.css";

const emptyCategory = {
  name: "",
  description: "",
  nomination_open: true,
  voting_open: false,
};

export default function Awards() {
  const [categories, setCategories] = useState([]);
  const [nominations, setNominations] = useState([]);
  const [votes, setVotes] = useState([]);
  const [classmates, setClassmates] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form, setForm] = useState(emptyCategory);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        categoriesResult,
        nominationsResult,
        votesResult,
        classmatesResult,
      ] = await Promise.all([
        supabase
          .from("award_categories")
          .select("*")
          .order("created_at", { ascending: true }),

        supabase
          .from("award_nominations")
          .select("*"),

        supabase
          .from("award_votes")
          .select("*"),

        supabase
          .from("classmates")
          .select("id, full_name, class_id, email")
          .order("full_name", { ascending: true }),
      ]);

      if (categoriesResult.error) {
        throw categoriesResult.error;
      }

      if (nominationsResult.error) {
        throw nominationsResult.error;
      }

      if (votesResult.error) {
        throw votesResult.error;
      }

      if (classmatesResult.error) {
        throw classmatesResult.error;
      }

      setCategories(categoriesResult.data || []);
      setNominations(nominationsResult.data || []);
      setVotes(votesResult.data || []);
      setClassmates(classmatesResult.data || []);
    } catch (err) {
      console.error(err);
      setError(
        err.message || "Unable to load awards information."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const nominationCount = useMemo(() => {
    const counts = {};

    nominations.forEach((item) => {
      counts[item.category_id] =
        (counts[item.category_id] || 0) + 1;
    });

    return counts;
  }, [nominations]);

  const voteCount = useMemo(() => {
    const counts = {};

    votes.forEach((item) => {
      counts[item.category_id] =
        (counts[item.category_id] || 0) + 1;
    });

    return counts;
  }, [votes]);

  const nomineeVoteCounts = useMemo(() => {
    const counts = {};

    votes.forEach((vote) => {
      const key = `${vote.category_id}-${vote.nominee_id}`;

      counts[key] = (counts[key] || 0) + 1;
    });

    return counts;
  }, [votes]);

  function openNewCategory() {
    setEditingCategory(null);
    setForm(emptyCategory);
    setMessage("");
    setError("");
    setShowModal(true);
  }

  function openEditCategory(category) {
    setEditingCategory(category);

    setForm({
      name: category.name || "",
      description: category.description || "",
      nomination_open: category.nomination_open,
      voting_open: category.voting_open,
    });

    setMessage("");
    setError("");
    setShowModal(true);
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function saveCategory(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Please enter an award category name.");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        nomination_open: form.nomination_open,
        voting_open: form.voting_open,
      };

      if (editingCategory) {
        const { error: updateError } = await supabase
          .from("award_categories")
          .update(payload)
          .eq("id", editingCategory.id);

        if (updateError) throw updateError;

        setMessage("Award category updated successfully.");
      } else {
        const { error: insertError } = await supabase
          .from("award_categories")
          .insert(payload);

        if (insertError) throw insertError;

        setMessage("Award category created successfully.");
      }

      setShowModal(false);
      setEditingCategory(null);
      setForm(emptyCategory);

      await loadData();
    } catch (err) {
      console.error(err);
      setError(
        err.message || "Unable to save award category."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleNomination(category) {
    setMessage("");
    setError("");

    try {
      const newValue = !category.nomination_open;

      const { error: updateError } = await supabase
        .from("award_categories")
        .update({
          nomination_open: newValue,
        })
        .eq("id", category.id);

      if (updateError) throw updateError;

      setMessage(
        newValue
          ? `Nominations opened for "${category.name}".`
          : `Nominations closed for "${category.name}".`
      );

      await loadData();
    } catch (err) {
      console.error(err);
      setError(
        err.message || "Unable to change nomination status."
      );
    }
  }

  async function toggleVoting(category) {
    setMessage("");
    setError("");

    try {
      const newValue = !category.voting_open;

      const { error: updateError } = await supabase
        .from("award_categories")
        .update({
          voting_open: newValue,
        })
        .eq("id", category.id);

      if (updateError) throw updateError;

      setMessage(
        newValue
          ? `Voting opened for "${category.name}".`
          : `Voting closed for "${category.name}".`
      );

      await loadData();
    } catch (err) {
      console.error(err);
      setError(
        err.message || "Unable to change voting status."
      );
    }
  }

  async function deleteCategory(category) {
    const confirmed = window.confirm(
      `Delete "${category.name}"?\n\nThis will also delete its nominations and votes.`
    );

    if (!confirmed) return;

    setMessage("");
    setError("");

    try {
      const { error: deleteError } = await supabase
        .from("award_categories")
        .delete()
        .eq("id", category.id);

      if (deleteError) throw deleteError;

      setMessage("Award category deleted successfully.");

      await loadData();
    } catch (err) {
      console.error(err);
      setError(
        err.message || "Unable to delete award category."
      );
    }
  }

  function getNomineeName(id) {
    const classmate = classmates.find(
      (item) => item.id === id
    );

    return classmate?.full_name || "Unknown classmate";
  }

  function getCategoryNominations(categoryId) {
    return nominations.filter(
      (item) => item.category_id === categoryId
    );
  }

  function getCategoryResults(categoryId) {
    const categoryNominations =
      getCategoryNominations(categoryId);

    return categoryNominations
      .map((nomination) => {
        const key = `${categoryId}-${nomination.nominee_id}`;

        return {
          nomineeId: nomination.nominee_id,
          name: getNomineeName(nomination.nominee_id),
          votes: nomineeVoteCounts[key] || 0,
        };
      })
      .sort((a, b) => b.votes - a.votes);
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading">
          Loading awards...
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">

      <div className="admin-page-header">

        <div>
          <span className="admin-eyebrow">
            REUNION AWARDS
          </span>

          <h1>Awards</h1>

          <p>
            Manage award categories, nominations, voting
            and final results.
          </p>
        </div>

        <div className="admin-header-actions">

          <button
            className="admin-secondary-button"
            onClick={loadData}
          >
            ↻ Refresh
          </button>

          <button
            className="admin-primary-button"
            onClick={openNewCategory}
          >
            + Add Award
          </button>

        </div>

      </div>

      {message && (
        <div className="admin-success-message">
          {message}
        </div>
      )}

      {error && (
        <div className="admin-error-message">
          {error}
        </div>
      )}

      {/* SUMMARY */}

      <div className="admin-summary-grid">

        <div className="admin-summary-card">
          <span>Award Categories</span>
          <strong>{categories.length}</strong>
        </div>

        <div className="admin-summary-card">
          <span>Total Nominations</span>
          <strong>{nominations.length}</strong>
        </div>

        <div className="admin-summary-card">
          <span>Total Votes</span>
          <strong>{votes.length}</strong>
        </div>

        <div className="admin-summary-card">
          <span>Voting Open</span>
          <strong>
            {
              categories.filter(
                (category) => category.voting_open
              ).length
            }
          </strong>
        </div>

      </div>

      {/* AWARD CATEGORIES */}

      <div className="awards-admin-grid">

        {categories.length === 0 ? (
          <div className="admin-table-card awards-empty-card">
            <h3>No award categories yet</h3>

            <p>
              Create your first reunion award category
              to get started.
            </p>

            <button
              className="admin-primary-button"
              onClick={openNewCategory}
            >
              + Create First Award
            </button>
          </div>
        ) : (
          categories.map((category) => {

            const results =
              getCategoryResults(category.id);

            return (
              <div
                className="awards-category-card"
                key={category.id}
              >

                <div className="awards-category-header">

                  <div>
                    <span className="admin-eyebrow">
                      AWARD
                    </span>

                    <h2>{category.name}</h2>
                  </div>

                  <button
                    className="admin-table-action"
                    onClick={() =>
                      openEditCategory(category)
                    }
                  >
                    Edit
                  </button>

                </div>

                {category.description && (
                  <p className="awards-description">
                    {category.description}
                  </p>
                )}

                <div className="awards-status-row">

                  <span
                    className={`admin-status-badge ${
                      category.nomination_open
                        ? "status-paid"
                        : "status-unpaid"
                    }`}
                  >
                    {category.nomination_open
                      ? "NOMINATIONS OPEN"
                      : "NOMINATIONS CLOSED"}
                  </span>

                  <span
                    className={`admin-status-badge ${
                      category.voting_open
                        ? "status-paid"
                        : "status-unpaid"
                    }`}
                  >
                    {category.voting_open
                      ? "VOTING OPEN"
                      : "VOTING CLOSED"}
                  </span>

                </div>

                <div className="awards-stat-row">

                  <div>
                    <span>Nominations</span>
                    <strong>
                      {nominationCount[category.id] || 0}
                    </strong>
                  </div>

                  <div>
                    <span>Votes</span>
                    <strong>
                      {voteCount[category.id] || 0}
                    </strong>
                  </div>

                </div>

                {/* RESULTS */}

                <div className="awards-results">

                  <h3>Current Results</h3>

                  {results.length === 0 ? (
                    <p className="awards-no-results">
                      No nominees yet.
                    </p>
                  ) : (
                    results
                      .slice(0, 5)
                      .map((result, index) => (
                        <div
                          className="award-result-row"
                          key={result.nomineeId}
                        >

                          <div className="award-rank">
                            {index + 1}
                          </div>

                          <div className="award-nominee">
                            <strong>
                              {result.name}
                            </strong>
                          </div>

                          <div className="award-votes">
                            {result.votes} vote
                            {result.votes !== 1
                              ? "s"
                              : ""}
                          </div>

                        </div>
                      ))
                  )}

                </div>

                {/* CONTROLS */}

                <div className="awards-actions">

                  <button
                    className="admin-secondary-button"
                    onClick={() =>
                      toggleNomination(category)
                    }
                  >
                    {category.nomination_open
                      ? "Close Nominations"
                      : "Open Nominations"}
                  </button>

                  <button
                    className="admin-primary-button"
                    onClick={() =>
                      toggleVoting(category)
                    }
                  >
                    {category.voting_open
                      ? "Close Voting"
                      : "Open Voting"}
                  </button>

                  <button
                    className="admin-danger-button"
                    onClick={() =>
                      deleteCategory(category)
                    }
                  >
                    Delete
                  </button>

                </div>

              </div>
            );
          })
        )}

      </div>

      {/* MODAL */}

      {showModal && (
        <div className="admin-modal-backdrop">

          <div className="admin-modal">

            <div className="admin-modal-header">

              <div>
                <span className="admin-eyebrow">
                  AWARD MANAGEMENT
                </span>

                <h2>
                  {editingCategory
                    ? "Edit Award"
                    : "Create Award"}
                </h2>
              </div>

              <button
                className="admin-modal-close"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>

            </div>

            <form
              className="admin-form"
              onSubmit={saveCategory}
            >

              <label>
                Award Name

                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Most Successful Classmate"
                  required
                />
              </label>

              <label>
                Description

                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Explain what this award recognises..."
                  rows="4"
                />
              </label>

              <div className="awards-checkbox-grid">

                <label className="awards-checkbox">
                  <input
                    type="checkbox"
                    name="nomination_open"
                    checked={form.nomination_open}
                    onChange={handleChange}
                  />

                  <span>
                    Allow nominations
                  </span>
                </label>

                <label className="awards-checkbox">
                  <input
                    type="checkbox"
                    name="voting_open"
                    checked={form.voting_open}
                    onChange={handleChange}
                  />

                  <span>
                    Allow voting
                  </span>
                </label>

              </div>

              <div className="admin-modal-actions">

                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={() =>
                    setShowModal(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="admin-primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingCategory
                    ? "Update Award"
                    : "Create Award"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}