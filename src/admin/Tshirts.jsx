import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import "./AdminPages.css";

const shirtSizes = ["S", "M", "L", "XL", "XXL", "XXXL"];

export default function Tshirts() {
  const [classmates, setClassmates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const [search, setSearch] = useState("");
  const [sizeFilter, setSizeFilter] = useState("ALL");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: fetchError } = await supabase
        .from("classmates")
        .select(
          "id, class_id, full_name, phone, email, tshirt_size, tshirt_quantity"
        )
        .order("full_name", { ascending: true });

      if (fetchError) throw fetchError;

      setClassmates(data || []);
    } catch (err) {
      console.error(err);
      setError(
        err.message || "Unable to load T-shirt records."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredClassmates = useMemo(() => {
    const searchText = search.toLowerCase().trim();

    return classmates.filter((classmate) => {
      const matchesSearch =
        !searchText ||
        classmate.full_name
          ?.toLowerCase()
          .includes(searchText) ||
        classmate.class_id
          ?.toLowerCase()
          .includes(searchText) ||
        classmate.phone
          ?.toLowerCase()
          .includes(searchText) ||
        classmate.email
          ?.toLowerCase()
          .includes(searchText);

      const size = classmate.tshirt_size || "";

      const matchesSize =
        sizeFilter === "ALL" || size === sizeFilter;

      return matchesSearch && matchesSize;
    });
  }, [classmates, search, sizeFilter]);

  const stats = useMemo(() => {
    const result = {
      total: 0,
      people: 0,
      unselected: 0,
      sizes: {},
    };

    shirtSizes.forEach((size) => {
      result.sizes[size] = 0;
    });

    classmates.forEach((classmate) => {
      const quantity = Number(
        classmate.tshirt_quantity || 0
      );

      result.total += quantity;

      if (quantity > 0) {
        result.people++;
      } else {
        result.unselected++;
      }

      if (classmate.tshirt_size && quantity > 0) {
        if (!result.sizes[classmate.tshirt_size]) {
          result.sizes[classmate.tshirt_size] = 0;
        }

        result.sizes[classmate.tshirt_size] += quantity;
      }
    });

    return result;
  }, [classmates]);

  async function updateTshirt(id, size, quantity) {
    setSavingId(id);
    setMessage("");
    setError("");

    try {
      const cleanQuantity = Math.max(
        0,
        Number(quantity || 0)
      );

      const cleanSize =
        cleanQuantity > 0 ? size : null;

      const { error: updateError } = await supabase
        .from("classmates")
        .update({
          tshirt_size: cleanSize,
          tshirt_quantity: cleanQuantity,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      setClassmates((previous) =>
        previous.map((classmate) =>
          classmate.id === id
            ? {
                ...classmate,
                tshirt_size: cleanSize,
                tshirt_quantity: cleanQuantity,
              }
            : classmate
        )
      );

      setMessage("T-shirt information updated successfully.");
    } catch (err) {
      console.error(err);
      setError(
        err.message || "Unable to update T-shirt information."
      );
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading">
          Loading T-shirt records...
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">

      <div className="admin-page-header">
        <div>
          <span className="admin-eyebrow">
            MERCHANDISE MANAGEMENT
          </span>

          <h1>T-Shirts</h1>

          <p>
            Manage reunion T-shirt sizes and quantities
            ordered by classmates.
          </p>
        </div>

        <button
          className="admin-secondary-button"
          onClick={loadData}
        >
          ↻ Refresh
        </button>
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
          <span>Total T-Shirts</span>
          <strong>{stats.total}</strong>
        </div>

        <div className="admin-summary-card">
          <span>Classmates Ordering</span>
          <strong>{stats.people}</strong>
        </div>

        <div className="admin-summary-card">
          <span>Not Selected</span>
          <strong>{stats.unselected}</strong>
        </div>

        <div className="admin-summary-card">
          <span>Sizes Recorded</span>
          <strong>
            {
              Object.values(stats.sizes).filter(
                (quantity) => quantity > 0
              ).length
            }
          </strong>
        </div>

      </div>

      {/* SIZE SUMMARY */}

      <div className="admin-feature-grid">

        {shirtSizes.map((size) => (
          <div
            className="admin-feature-card"
            key={size}
          >
            <span className="admin-eyebrow">
              SIZE
            </span>

            <h3>{size}</h3>

            <p>
              {stats.sizes[size] || 0} shirt
              {(stats.sizes[size] || 0) !== 1
                ? "s"
                : ""}
            </p>
          </div>
        ))}

      </div>

      {/* FILTERS */}

      <div className="admin-toolbar">

        <input
          type="text"
          placeholder="Search name, class ID, phone or email..."
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
        />

        <select
          value={sizeFilter}
          onChange={(event) =>
            setSizeFilter(event.target.value)
          }
        >
          <option value="ALL">All Sizes</option>

          {shirtSizes.map((size) => (
            <option value={size} key={size}>
              {size}
            </option>
          ))}
        </select>

      </div>

      {/* TABLE */}

      <div className="admin-table-card">

        <div className="admin-table-wrapper">

          <table className="admin-table">

            <thead>
              <tr>
                <th>Classmate</th>
                <th>Class ID</th>
                <th>Phone</th>
                <th>Size</th>
                <th>Quantity</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>

              {filteredClassmates.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="admin-empty-table"
                  >
                    No T-shirt records found.
                  </td>
                </tr>
              ) : (
                filteredClassmates.map((classmate) => (

                  <TshirtRow
                    key={classmate.id}
                    classmate={classmate}
                    saving={savingId === classmate.id}
                    onSave={updateTshirt}
                  />

                ))
              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}

function TshirtRow({
  classmate,
  saving,
  onSave,
}) {
  const [size, setSize] = useState(
    classmate.tshirt_size || ""
  );

  const [quantity, setQuantity] = useState(
    classmate.tshirt_quantity || 0
  );

  return (
    <tr>

      <td>
        <strong>
          {classmate.full_name}
        </strong>

        {classmate.email && (
          <small className="admin-table-subtext">
            {classmate.email}
          </small>
        )}
      </td>

      <td>{classmate.class_id}</td>

      <td>{classmate.phone}</td>

      <td>
        <select
          value={size}
          onChange={(event) =>
            setSize(event.target.value)
          }
        >
          <option value="">
            Select
          </option>

          {shirtSizes.map((shirtSize) => (
            <option
              value={shirtSize}
              key={shirtSize}
            >
              {shirtSize}
            </option>
          ))}
        </select>
      </td>

      <td>
        <input
          type="number"
          min="0"
          value={quantity}
          onChange={(event) =>
            setQuantity(event.target.value)
          }
          style={{ width: "80px" }}
        />
      </td>

      <td>
        <button
          className="admin-table-action"
          disabled={saving}
          onClick={() =>
            onSave(
              classmate.id,
              size,
              quantity
            )
          }
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </td>

    </tr>
  );
}