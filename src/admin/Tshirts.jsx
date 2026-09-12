import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { RefreshCw, AlertTriangle, Check } from "lucide-react";
import "./AdminPages.css";

const SHIRT_SIZES = ["S", "M", "L", "XL", "XXL", "XXXL"];

const SIZE_LABELS = {
  S: "Small",
  M: "Medium",
  L: "Large",
  XL: "Extra Large",
  XXL: "Double Extra Large",
  XXXL: "Triple Extra Large",
};

export default function Tshirts() {
  const [classmates, setClassmates] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [savingId, setSavingId]     = useState(null);

  const [search, setSearch]         = useState("");
  const [sizeFilter, setSizeFilter] = useState("ALL");

  // Per-row inline feedback
  const [rowFeedback, setRowFeedback] = useState({}); // { [id]: { type: "success"|"error", msg } }

  // Page-level error (load failure)
  const [loadError, setLoadError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { data, error: fetchError } = await supabase
        .from("classmates")
        .select("id, class_id, full_name, phone, email, tshirt_size, tshirt_quantity")
        .order("full_name", { ascending: true });

      if (fetchError) throw fetchError;
      setClassmates(data || []);
    } catch (err) {
      console.error(err);
      setLoadError(err.message || "Unable to load T-shirt records. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredClassmates = useMemo(() => {
    const term = search.toLowerCase().trim();
    return classmates.filter((c) => {
      const matchesSearch =
        !term ||
        c.full_name?.toLowerCase().includes(term) ||
        c.class_id?.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term);
      const matchesSize = sizeFilter === "ALL" || (c.tshirt_size || "") === sizeFilter;
      return matchesSearch && matchesSize;
    });
  }, [classmates, search, sizeFilter]);

  const stats = useMemo(() => {
    const result = { total: 0, people: 0, unselected: 0, sizes: {} };
    SHIRT_SIZES.forEach((s) => { result.sizes[s] = 0; });
    classmates.forEach((c) => {
      const qty = Number(c.tshirt_quantity || 0);
      result.total += qty;
      if (qty > 0) result.people++;
      else result.unselected++;
      if (c.tshirt_size && qty > 0) {
        result.sizes[c.tshirt_size] = (result.sizes[c.tshirt_size] || 0) + qty;
      }
    });
    return result;
  }, [classmates]);

  async function updateTshirt(id, size, quantity) {
    setSavingId(id);
    setRowFeedback((prev) => ({ ...prev, [id]: null }));

    try {
      const cleanQty  = Math.max(0, Number(quantity || 0));
      const cleanSize = cleanQty > 0 ? size : null;

      if (cleanQty > 0 && !cleanSize) {
        setRowFeedback((prev) => ({
          ...prev,
          [id]: { type: "error", msg: "Please select a size before saving." },
        }));
        return;
      }

      const { error: updateError } = await supabase
        .from("classmates")
        .update({ tshirt_size: cleanSize, tshirt_quantity: cleanQty })
        .eq("id", id);

      if (updateError) throw updateError;

      setClassmates((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, tshirt_size: cleanSize, tshirt_quantity: cleanQty } : c
        )
      );

      setRowFeedback((prev) => ({
        ...prev,
        [id]: { type: "success", msg: "Saved." },
      }));

      // Auto-clear success after 3 s
      setTimeout(() => {
        setRowFeedback((prev) => ({ ...prev, [id]: null }));
      }, 3000);
    } catch (err) {
      console.error(err);
      setRowFeedback((prev) => ({
        ...prev,
        [id]: { type: "error", msg: err.message || "Could not save. Please try again." },
      }));
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <div className="empty-message" role="status" aria-live="polite" aria-label="Loading T-shirt records">
        <span className="admin-page-spinner" aria-hidden="true" />
        <strong>Loading T-shirt records…</strong>
      </div>
    );
  }

  return (
    <div className="admin-page">

      {/* PAGE HEADER */}
      <div className="admin-page-header page-header">
        <div>
          <span className="admin-eyebrow page-eyebrow">MERCHANDISE MANAGEMENT</span>
          <h1>T-Shirts</h1>
          <p>Manage reunion T-shirt sizes and quantities ordered by classmates.</p>
        </div>
        <button
          className="secondary-button"
          onClick={loadData}
          aria-label="Refresh T-shirt records"
        >
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </div>

      {/* Load error */}
      {loadError && (
        <div className="admin-error-message" role="alert" aria-live="assertive">
          <AlertTriangle size={15} aria-hidden="true" /> {loadError}
        </div>
      )}

      {/* SUMMARY CARDS */}
      <div
        className="admin-summary-grid"
        role="list"
        aria-label="T-shirt order summary"
      >
        {[
          { label: "Total T-Shirts",      value: stats.total },
          { label: "Classmates Ordering", value: stats.people },
          { label: "Not Selected",        value: stats.unselected },
          { label: "Sizes Recorded",      value: Object.values(stats.sizes).filter((q) => q > 0).length },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="admin-summary-card"
            role="listitem"
            aria-label={`${label}: ${value}`}
          >
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      {/* SIZE BREAKDOWN */}
      <div
        className="admin-feature-grid"
        role="list"
        aria-label="T-shirt quantity by size"
      >
        {SHIRT_SIZES.map((size) => (
          <div
            key={size}
            className="admin-feature-card"
            role="listitem"
            aria-label={`Size ${SIZE_LABELS[size]}: ${stats.sizes[size] || 0} shirts`}
          >
            <span className="admin-eyebrow" aria-hidden="true">SIZE</span>
            <h3 aria-hidden="true">{size}</h3>
            <p>
              {stats.sizes[size] || 0} shirt{(stats.sizes[size] || 0) !== 1 ? "s" : ""}
            </p>
          </div>
        ))}
      </div>

      {/* FILTERS */}
      <div className="admin-toolbar" role="search" aria-label="Filter T-shirt records">
        <label htmlFor="tshirt-search" className="sr-only">Search classmates</label>
        <input
          id="tshirt-search"
          type="search"
          placeholder="Search name, class ID, phone or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search classmates"
          aria-controls="tshirt-table"
        />

        <label htmlFor="tshirt-size-filter" className="sr-only">Filter by size</label>
        <select
          id="tshirt-size-filter"
          value={sizeFilter}
          onChange={(e) => setSizeFilter(e.target.value)}
          aria-label="Filter by T-shirt size"
        >
          <option value="ALL">All Sizes</option>
          {SHIRT_SIZES.map((s) => (
            <option key={s} value={s}>{s} — {SIZE_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* TABLE */}
      <div className="admin-table-card">
        <div className="admin-table-wrapper">
          <table
            id="tshirt-table"
            className="admin-table"
            aria-label="T-shirt orders per classmate"
          >
            <thead>
              <tr>
                <th scope="col">Classmate</th>
                <th scope="col">Class ID</th>
                <th scope="col">Phone</th>
                <th scope="col">Size</th>
                <th scope="col">Quantity</th>
                <th scope="col">Action</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredClassmates.length === 0 ? (
                <tr>
                  <td colSpan="7" className="admin-empty-table" role="status">
                    {search
                      ? `No classmates match "${search}". Try a different search term.`
                      : "No T-shirt records found."}
                  </td>
                </tr>
              ) : (
                filteredClassmates.map((classmate) => (
                  <TshirtRow
                    key={classmate.id}
                    classmate={classmate}
                    saving={savingId === classmate.id}
                    feedback={rowFeedback[classmate.id]}
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

function TshirtRow({ classmate, saving, feedback, onSave }) {
  const [size, setSize]         = useState(classmate.tshirt_size || "");
  const [quantity, setQuantity] = useState(classmate.tshirt_quantity || 0);

  // Unique IDs for accessibility
  const sizeId     = `size-${classmate.id}`;
  const qtyId      = `qty-${classmate.id}`;
  const feedbackId = `feedback-${classmate.id}`;

  return (
    <tr aria-label={`T-shirt order for ${classmate.full_name}`}>
      <td>
        <strong>{classmate.full_name}</strong>
        {classmate.email && (
          <small className="admin-table-subtext">{classmate.email}</small>
        )}
      </td>

      <td>
        <code aria-label={`Class ID ${classmate.class_id}`}>{classmate.class_id}</code>
      </td>

      <td>{classmate.phone}</td>

      <td>
        <label htmlFor={sizeId} className="sr-only">
          T-shirt size for {classmate.full_name}
        </label>
        <select
          id={sizeId}
          value={size}
          onChange={(e) => setSize(e.target.value)}
          aria-label={`T-shirt size for ${classmate.full_name}`}
          aria-describedby={feedback ? feedbackId : undefined}
        >
          <option value="">Select size</option>
          {SHIRT_SIZES.map((s) => (
            <option key={s} value={s}>{s} — {SIZE_LABELS[s]}</option>
          ))}
        </select>
      </td>

      <td>
        <label htmlFor={qtyId} className="sr-only">
          T-shirt quantity for {classmate.full_name}
        </label>
        <input
          id={qtyId}
          type="number"
          min="0"
          max="10"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          aria-label={`T-shirt quantity for ${classmate.full_name}`}
          style={{ width: "80px" }}
        />
      </td>

      <td>
        <button
          className="admin-table-action"
          disabled={saving}
          aria-busy={saving}
          aria-label={`Save T-shirt changes for ${classmate.full_name}`}
          onClick={() => onSave(classmate.id, size, quantity)}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </td>

      {/* Inline per-row feedback */}
      <td>
        {feedback && (
          <span
            id={feedbackId}
            className={`tshirt-row-feedback tshirt-row-feedback--${feedback.type}`}
            role={feedback.type === "error" ? "alert" : "status"}
            aria-live={feedback.type === "error" ? "assertive" : "polite"}
          >
            <span aria-hidden="true">{feedback.type === "error" ? <AlertTriangle size={13} /> : <Check size={13} />}</span>
            {feedback.msg}
          </span>
        )}
      </td>
    </tr>
  );
}
