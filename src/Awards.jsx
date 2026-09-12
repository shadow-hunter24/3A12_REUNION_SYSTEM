import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import "./Awards.css";

export default function Awards() {
  const [classId, setClassId] = useState("");
  const [phone, setPhone] = useState("");

  const [member, setMember] = useState(null);
  const [categories, setCategories] = useState([]);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [nominees, setNominees] = useState([]);

  const [selectedNominee, setSelectedNominee] = useState("");
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);

    const { data, error: categoryError } =
      await supabase
        .from("award_categories")
        .select("*")
        .order("created_at", {
          ascending: true,
        });

    if (categoryError) {
      setError(categoryError.message);
    } else {
      setCategories(data || []);
    }

    setLoading(false);
  }

  async function verifyMember(event) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const { data, error: verifyError } =
        await supabase.rpc(
          "verify_reunion_member",
          {
            p_class_id: classId.trim(),
            p_phone: phone.trim(),
          }
        );

      if (verifyError) {
        throw verifyError;
      }

      if (!data || data.length === 0) {
        throw new Error(
          "We could not verify your Classmate ID and phone number."
        );
      }

      setMember(data[0]);

      setMessage(
        `Welcome, ${data[0].full_name}! You can now participate in the awards.`
      );
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function openCategory(category) {
    setSelectedCategory(category);
    setSelectedNominee("");
    setReason("");
    setMessage("");
    setError("");

    if (
      category.nomination_open ||
      category.voting_open
    ) {
      const { data, error: nomineeError } =
        await supabase.rpc(
          "get_award_nominees",
          {
            p_category_id: category.id,
          }
        );

      if (nomineeError) {
        setError(nomineeError.message);
        return;
      }

      setNominees(data || []);
    }
  }

  async function submitNomination() {
    if (!member || !selectedCategory || !selectedNominee) {
      setError("Please select a nominee.");
      return;
    }

    setActionLoading(true);
    setMessage("");
    setError("");

    try {
      const { data, error: nominationError } =
        await supabase.rpc(
          "submit_award_nomination",
          {
            p_nominator_id: member.id,
            p_category_id: selectedCategory.id,
            p_nominee_id: selectedNominee,
            p_reason: reason,
          }
        );

      if (nominationError) {
        throw nominationError;
      }

      if (!data?.success) {
        throw new Error(
          data?.message || "Nomination could not be submitted."
        );
      }

      setMessage(
        data.message ||
          "Nomination submitted successfully."
      );

      setReason("");

      const { data: refreshedNominees } =
        await supabase.rpc(
          "get_award_nominees",
          {
            p_category_id: selectedCategory.id,
          }
        );

      setNominees(refreshedNominees || []);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function submitVote() {
    if (!member || !selectedCategory || !selectedNominee) {
      setError("Please select a nominee.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to vote for this classmate for "${selectedCategory.name}"?\n\nYou can only vote once for this award.`
    );

    if (!confirmed) return;

    setActionLoading(true);
    setMessage("");
    setError("");

    try {
      const { data, error: voteError } =
        await supabase.rpc(
          "submit_award_vote",
          {
            p_voter_id: member.id,
            p_category_id: selectedCategory.id,
            p_nominee_id: selectedNominee,
          }
        );

      if (voteError) {
        throw voteError;
      }

      if (!data?.success) {
        throw new Error(
          data?.message || "Vote could not be submitted."
        );
      }

      setMessage(
        data.message ||
          "Your vote has been recorded successfully."
      );

      setSelectedNominee("");
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  function logoutMember() {
    setMember(null);
    setClassId("");
    setPhone("");
    setSelectedCategory(null);
    setSelectedNominee("");
    setReason("");
    setMessage("");
    setError("");
  }

  return (
    <div className="awards-page">

      <section className="awards-hero">
        <div className="awards-hero-content">

          <span>3A12 • CLASS OF 2021</span>

          <h1>
            Reunion
            <br />
            <strong>Awards</strong>
          </h1>

          <p>
            Celebrate the classmates who have inspired,
            supported and represented our class over the
            years.
          </p>

        </div>
      </section>

      <main className="awards-container">

        {!member ? (
          <section className="member-verification-card">

            <span className="awards-eyebrow">
              CLASSMATE ACCESS
            </span>

            <h2>
              Verify Your Classmate Account
            </h2>

            <p>
              Enter the Classmate ID and phone number
              you used during reunion registration.
            </p>

            <form
              onSubmit={verifyMember}
              className="awards-form"
            >

              <label>
                Classmate ID

                <input
                  type="text"
                  value={classId}
                  onChange={(event) =>
                    setClassId(event.target.value)
                  }
                  placeholder="e.g. 3A12-BF3F011A"
                  required
                />
              </label>

              <label>
                Phone / WhatsApp Number

                <input
                  type="tel"
                  value={phone}
                  onChange={(event) =>
                    setPhone(event.target.value)
                  }
                  placeholder="Enter your registered phone"
                  required
                />
              </label>

              <button
                className="awards-primary-button"
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Verifying..."
                  : "Continue to Awards"}
              </button>

            </form>

          </section>
        ) : (
          <>
            <section className="member-welcome">

              <div>
                <span className="awards-eyebrow">
                  WELCOME BACK
                </span>

                <h2>
                  Hello, {member.full_name}
                </h2>

                <p>
                  Classmate ID:{" "}
                  <strong>{member.class_id}</strong>
                </p>
              </div>

              <button
                className="awards-outline-button"
                onClick={logoutMember}
              >
                Exit
              </button>

            </section>

            {message && (
              <div className="awards-success">
                {message}
              </div>
            )}

            {error && (
              <div className="awards-error">
                {error}
              </div>
            )}

            <section className="awards-section">

              <div className="awards-section-heading">
                <span className="awards-eyebrow">
                  2026 REUNION
                </span>

                <h2>
                  Award Categories
                </h2>

                <p>
                  Select an award to nominate a classmate
                  or cast your vote.
                </p>
              </div>

              <div className="public-award-grid">

                {categories.map((category) => (
                  <button
                    className={`public-award-card ${
                      selectedCategory?.id === category.id
                        ? "selected"
                        : ""
                    }`}
                    key={category.id}
                    onClick={() =>
                      openCategory(category)
                    }
                  >

                    <span className="award-card-icon">
                      🏆
                    </span>

                    <h3>{category.name}</h3>

                    {category.description && (
                      <p>
                        {category.description}
                      </p>
                    )}

                    <div className="public-award-status">

                      {category.nomination_open && (
                        <span>
                          Nominations Open
                        </span>
                      )}

                      {category.voting_open && (
                        <span>
                          Voting Open
                        </span>
                      )}

                      {!category.nomination_open &&
                        !category.voting_open && (
                          <span>
                            Closed
                          </span>
                        )}

                    </div>

                  </button>
                ))}

              </div>

            </section>

            {selectedCategory && (
              <section className="award-action-panel">

                <span className="awards-eyebrow">
                  SELECTED AWARD
                </span>

                <h2>
                  {selectedCategory.name}
                </h2>

                {selectedCategory.description && (
                  <p>
                    {selectedCategory.description}
                  </p>
                )}

                {selectedCategory.nomination_open && (
                  <div className="award-action-box">

                    <h3>
                      Nominate a Classmate
                    </h3>

                    <label>
                      Select Classmate

                      <select
                        value={selectedNominee}
                        onChange={(event) =>
                          setSelectedNominee(
                            event.target.value
                          )
                        }
                      >
                        <option value="">
                          Select nominee
                        </option>

                        {classmatesForSelection(
                          nominees,
                          member.id
                        ).map((nominee) => (
                          <option
                            key={nominee.nominee_id}
                            value={nominee.nominee_id}
                          >
                            {nominee.nominee_name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Why are you nominating this person?

                      <textarea
                        value={reason}
                        onChange={(event) =>
                          setReason(event.target.value)
                        }
                        rows="4"
                        placeholder="Optional reason..."
                      />
                    </label>

                    <button
                      className="awards-primary-button"
                      onClick={submitNomination}
                      disabled={actionLoading}
                    >
                      {actionLoading
                        ? "Submitting..."
                        : "Submit Nomination"}
                    </button>

                  </div>
                )}

                {selectedCategory.voting_open && (
                  <div className="award-action-box">

                    <h3>
                      Cast Your Vote
                    </h3>

                    <p>
                      You can vote only once for this
                      award category.
                    </p>

                    <label>
                      Select your choice

                      <select
                        value={selectedNominee}
                        onChange={(event) =>
                          setSelectedNominee(
                            event.target.value
                          )
                        }
                      >
                        <option value="">
                          Select nominee
                        </option>

                        {nominees.map((nominee) => (
                          <option
                            key={nominee.nominee_id}
                            value={nominee.nominee_id}
                          >
                            {nominee.nominee_name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      className="awards-vote-button"
                      onClick={submitVote}
                      disabled={actionLoading}
                    >
                      {actionLoading
                        ? "Recording Vote..."
                        : "🏆 Cast My Vote"}
                    </button>

                  </div>
                )}

              </section>
            )}
          </>
        )}

      </main>
    </div>
  );
}

function classmatesForSelection(
  nominees,
  memberId
) {
  return nominees.filter(
    (nominee) => nominee.nominee_id !== memberId
  );
}