import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import "./AdminPages.css";

export default function Registrations() {
  const [classmates, setClassmates] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRegistrations();
  }, []);

  async function loadRegistrations() {
    const { data, error } = await supabase
      .from("classmates")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(error);
    } else {
      setClassmates(data || []);
    }

    setLoading(false);
  }

  const filtered = useMemo(() => {
    const term = search.toLowerCase();

    return classmates.filter((person) =>
      [
        person.full_name,
        person.class_id,
        person.phone,
        person.email,
        person.occupation,
        person.location,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(term)
        )
    );
  }, [classmates, search]);

  return (
    <div>

      <div className="page-header">

        <div>
          <p className="page-eyebrow">
            CLASS MANAGEMENT
          </p>

          <h1>Registrations</h1>

          <p>
            View and manage everyone registered
            for the reunion.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={loadRegistrations}
        >
          ↻ Refresh
        </button>

      </div>

      <div className="summary-cards">

        <div>
          <span>Total</span>
          <strong>{classmates.length}</strong>
        </div>

        <div>
          <span>Attending</span>
          <strong>
            {
              classmates.filter(
                (person) => person.attending
              ).length
            }
          </strong>
        </div>

        <div>
          <span>Not Attending</span>
          <strong>
            {
              classmates.filter(
                (person) => !person.attending
              ).length
            }
          </strong>
        </div>

      </div>

      <div className="data-card">

        <div className="data-card-header">

          <div>
            <h2>Classmates</h2>
            <p>{filtered.length} records</p>
          </div>

          <input
            className="search-input"
            placeholder="Search name, ID, phone..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />

        </div>

        {loading ? (

          <div className="empty-message">
            Loading registrations...
          </div>

        ) : (

          <div className="table-scroll">

            <table className="admin-table">

              <thead>
                <tr>
                  <th>Name</th>
                  <th>Class ID</th>
                  <th>Phone</th>
                  <th>Location</th>
                  <th>Attendance</th>
                  <th>Registered</th>
                </tr>
              </thead>

              <tbody>

                {filtered.map((person) => (

                  <tr
                    key={person.id}
                    onClick={() =>
                      setSelected(person)
                    }
                  >

                    <td>
                      <strong>
                        {person.full_name}
                      </strong>

                      {person.nickname && (
                        <small>
                          "{person.nickname}"
                        </small>
                      )}
                    </td>

                    <td>
                      <code>
                        {person.class_id}
                      </code>
                    </td>

                    <td>
                      {person.phone}
                    </td>

                    <td>
                      {person.location || "—"}
                    </td>

                    <td>
                      <span
                        className={
                          person.attending
                            ? "badge success"
                            : "badge danger"
                        }
                      >
                        {person.attending
                          ? "Attending"
                          : "Not attending"}
                      </span>
                    </td>

                    <td>
                      {new Date(
                        person.created_at
                      ).toLocaleDateString()}
                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        )}

      </div>

      {selected && (

        <div
          className="modal-background"
          onClick={() => setSelected(null)}
        >

          <div
            className="details-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            <button
              className="close-modal"
              onClick={() =>
                setSelected(null)
              }
            >
              ×
            </button>

            <p className="page-eyebrow">
              CLASSMATE PROFILE
            </p>

            <h2>{selected.full_name}</h2>

            <div className="class-id">
              {selected.class_id}
            </div>

            <div className="details-grid">

              <div>
                <span>Nickname</span>
                <strong>
                  {selected.nickname || "—"}
                </strong>
              </div>

              <div>
                <span>Phone</span>
                <strong>
                  {selected.phone}
                </strong>
              </div>

              <div>
                <span>Email</span>
                <strong>
                  {selected.email || "—"}
                </strong>
              </div>

              <div>
                <span>Occupation</span>
                <strong>
                  {selected.occupation || "—"}
                </strong>
              </div>

              <div>
                <span>Organization</span>
                <strong>
                  {selected.organization || "—"}
                </strong>
              </div>

              <div>
                <span>Location</span>
                <strong>
                  {selected.location || "—"}
                </strong>
              </div>

              <div>
                <span>T-Shirt</span>
                <strong>
                  {selected.tshirt_size
                    ? `${selected.tshirt_size} × ${selected.tshirt_quantity}`
                    : "—"}
                </strong>
              </div>

              <div>
                <span>Guests</span>
                <strong>
                  {selected.guests}
                </strong>
              </div>

            </div>

            {selected.favourite_memory && (
              <div className="memory-panel">
                <span>
                  Favourite SHS Memory
                </span>

                <p>
                  {selected.favourite_memory}
                </p>
              </div>
            )}

          </div>

        </div>

      )}

    </div>
  );
}