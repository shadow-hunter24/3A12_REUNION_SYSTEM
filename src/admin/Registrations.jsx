import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import "./AdminPages.css";

const SHS_HOUSES = [
  "Aggrey", "Nkrumah", "Guggisberg", "Busia",
  "Danquah", "Acheampong", "Other",
];

const TSHIRT_SIZES = ["S", "M", "L", "XL", "XXL", "XXXL"];

// ── Inline confirmation dialog ────────────────────────────────
function ConfirmDialog({ heading, body, confirmLabel, onConfirm, onCancel }) {
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
      style={{ zIndex: 200 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-reg-heading"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="details-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-reg-heading" style={{ marginBottom: 10, outline: "none" }} tabIndex={-1}>
          {heading}
        </h2>
        <p style={{ color: "#555", lineHeight: 1.7, marginBottom: 24, fontSize: 14 }}>{body}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button className="admin-secondary-button" onClick={onCancel}>Cancel</button>
          <button ref={btnRef} className="admin-danger-button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Field-level error helper ──────────────────────────────────
function FieldErr({ id, msg }) {
  if (!msg) return null;
  return (
    <p id={id} className="contrib-field-error" role="alert">
      <span aria-hidden="true">⚠ </span>{msg}
    </p>
  );
}

export default function Registrations() {
  const [classmates, setClassmates] = useState([]);
  const [search, setSearch]         = useState("");
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");

  // Which modal is open: null | "view" | "edit"
  const [modal, setModal]           = useState(null);
  const [selected, setSelected]     = useState(null);   // current row

  // Edit form state
  const [editForm, setEditForm]     = useState({});
  const [editErrors, setEditErrors] = useState({});
  const [saving, setSaving]         = useState(false);
  const [saveMsg, setSaveMsg]       = useState("");

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState(null); // classmate object

  // Focus management
  const modalHeadingRef = useRef(null);
  useEffect(() => {
    if (modal) modalHeadingRef.current?.focus();
  }, [modal]);

  // Escape closes modals
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        setModal(null);
        setConfirmDelete(null);
      }
    }
    if (modal || confirmDelete) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, confirmDelete]);

  useEffect(() => { loadRegistrations(); }, []);

  async function loadRegistrations() {
    setLoading(true);
    setError("");
    const { data, error: fetchError } = await supabase
      .from("classmates")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError("Could not load registrations. Please check your connection and try again.");
    } else {
      setClassmates(data || []);
    }
    setLoading(false);
  }

  // ── Open view modal ───────────────────────────────────────
  function openView(person) {
    setSelected(person);
    setSaveMsg("");
    setModal("view");
  }

  // ── Open edit modal ───────────────────────────────────────
  function openEdit(person, e) {
    e?.stopPropagation();
    setSelected(person);
    setEditForm({
      full_name:        person.full_name || "",
      nickname:         person.nickname || "",
      phone:            person.phone || "",
      email:            person.email || "",
      class_stream:     person.class_stream || "",
      shs_house:        person.shs_house || "",
      occupation:       person.occupation || "",
      organization:     person.organization || "",
      location:         person.location || "",
      attending:        person.attending ?? true,
      guests:           person.guests ?? 0,
      tshirt_size:      person.tshirt_size || "",
      tshirt_quantity:  person.tshirt_quantity ?? 0,
      favourite_memory: person.favourite_memory || "",
    });
    setEditErrors({});
    setSaveMsg("");
    setModal("edit");
  }

  function handleEditChange(e) {
    const { name, value, type, checked } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    if (editErrors[name]) setEditErrors((prev) => ({ ...prev, [name]: null }));
  }

  // ── Validate edit form ────────────────────────────────────
  function validateEdit() {
    const errs = {};
    if (!editForm.full_name.trim())
      errs.full_name = "Full name is required.";
    else if (editForm.full_name.trim().length < 3)
      errs.full_name = "Full name must be at least 3 characters.";

    if (!editForm.phone.trim())
      errs.phone = "Phone number is required.";
    else if (editForm.phone.replace(/\D/g, "").length < 10)
      errs.phone = "Enter a valid phone number with at least 10 digits.";

    if (editForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email))
      errs.email = "Enter a valid email address.";

    const qty = Number(editForm.tshirt_quantity);
    if (isNaN(qty) || qty < 0)
      errs.tshirt_quantity = "Quantity cannot be negative.";
    if (qty > 10)
      errs.tshirt_quantity = "Maximum 10 T-shirts per registration.";

    return errs;
  }

  // ── Save edits ────────────────────────────────────────────
  async function handleSaveEdit(e) {
    e.preventDefault();
    const errs = validateEdit();
    if (Object.keys(errs).length > 0) { setEditErrors(errs); return; }

    setSaving(true);
    setSaveMsg("");

    // Check for phone number conflict (another classmate with the same phone)
    if (editForm.phone.trim() !== selected.phone) {
      const { data: existing } = await supabase
        .from("classmates")
        .select("id")
        .eq("phone", editForm.phone.trim())
        .neq("id", selected.id)
        .maybeSingle();

      if (existing) {
        setEditErrors({ phone: "This phone number is already registered to another classmate." });
        setSaving(false);
        return;
      }
    }

    const payload = {
      full_name:        editForm.full_name.trim(),
      nickname:         editForm.nickname.trim() || null,
      phone:            editForm.phone.trim(),
      email:            editForm.email.trim() || null,
      class_stream:     editForm.class_stream.trim() || null,
      shs_house:        editForm.shs_house.trim() || null,
      occupation:       editForm.occupation.trim() || null,
      organization:     editForm.organization.trim() || null,
      location:         editForm.location.trim() || null,
      attending:        editForm.attending === "true" || editForm.attending === true,
      guests:           Number(editForm.guests) || 0,
      tshirt_size:      Number(editForm.tshirt_quantity) > 0 ? editForm.tshirt_size || null : null,
      tshirt_quantity:  Number(editForm.tshirt_quantity) || 0,
      favourite_memory: editForm.favourite_memory.trim() || null,
    };

    const { data: updated, error: updateError } = await supabase
      .from("classmates")
      .update(payload)
      .eq("id", selected.id)
      .select()
      .single();

    if (updateError) {
      const code = updateError.code;
      if (code === "23505") {
        setEditErrors({ phone: "This phone number is already registered to another classmate." });
      } else {
        setSaveMsg(`error:${updateError.message || "Could not save changes. Please try again."}`);
      }
      setSaving(false);
      return;
    }

    // Update local state so the table reflects changes immediately
    setClassmates((prev) => prev.map((c) => c.id === selected.id ? updated : c));
    setSelected(updated);
    setSaveMsg("success:Changes saved successfully.");
    setSaving(false);
  }

  // ── Delete classmate ──────────────────────────────────────
  function requestDelete(person, e) {
    e?.stopPropagation();
    setConfirmDelete(person);
  }

  async function doDelete() {
    if (!confirmDelete) return;
    const person = confirmDelete;
    setConfirmDelete(null);
    setModal(null);

    const { error: deleteError } = await supabase
      .from("classmates")
      .delete()
      .eq("id", person.id);

    if (deleteError) {
      setError(`Could not delete ${person.full_name}: ${deleteError.message}`);
      return;
    }

    setClassmates((prev) => prev.filter((c) => c.id !== person.id));
  }

  // ── Filtered rows ─────────────────────────────────────────
  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return classmates.filter((p) =>
      [p.full_name, p.class_id, p.phone, p.email, p.occupation, p.location]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term))
    );
  }, [classmates, search]);

  const attending    = classmates.filter((p) => p.attending).length;
  const notAttending = classmates.filter((p) => !p.attending).length;

  // ── Helpers ───────────────────────────────────────────────
  const [saveType, saveText] = saveMsg.startsWith("error:")
    ? ["error", saveMsg.slice(6)]
    : saveMsg.startsWith("success:")
      ? ["success", saveMsg.slice(8)]
      : [null, ""];

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="page-eyebrow">CLASS MANAGEMENT</p>
          <h1>Registrations</h1>
          <p>View, edit and manage everyone registered for the reunion.</p>
        </div>
        <button
          className="secondary-button"
          onClick={loadRegistrations}
          aria-label="Refresh registrations list"
          aria-busy={loading}
        >
          <span aria-hidden="true">↻</span> Refresh
        </button>
      </div>

      {/* Page-level error */}
      {error && (
        <div className="admin-error-message" role="alert" aria-live="assertive">
          <span aria-hidden="true">⚠ </span>{error}
          <button
            style={{ marginLeft: 12, fontWeight: 700, background: "none", border: "none", cursor: "pointer", color: "inherit", textDecoration: "underline" }}
            onClick={() => { setError(""); loadRegistrations(); }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="summary-cards" role="list" aria-label="Registration summary">
        <div role="listitem" aria-label={`Total: ${classmates.length}`}>
          <span>Total</span><strong>{classmates.length}</strong>
        </div>
        <div role="listitem" aria-label={`Attending: ${attending}`}>
          <span>Attending</span><strong>{attending}</strong>
        </div>
        <div role="listitem" aria-label={`Not attending: ${notAttending}`}>
          <span>Not Attending</span><strong>{notAttending}</strong>
        </div>
      </div>

      {/* Table card */}
      <div className="data-card">
        <div className="data-card-header">
          <div>
            <h2>Classmates</h2>
            <p id="table-count" aria-live="polite">
              {filtered.length} record{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="search-wrapper">
            <label htmlFor="reg-search" className="sr-only">Search registrations</label>
            <input
              id="reg-search"
              className="search-input"
              type="search"
              placeholder="Search name, ID, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-controls="reg-table"
              aria-describedby="table-count"
            />
          </div>
        </div>

        {loading ? (
          <div className="empty-message" role="status" aria-live="polite">
            <span className="admin-page-spinner" aria-hidden="true" />
            <strong>Loading registrations…</strong>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-message" role="status">
            <div className="empty-icon" aria-hidden="true">👥</div>
            <strong>No results found</strong>
            <p>{search ? `No registrations match "${search}".` : "No registrations yet."}</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table id="reg-table" className="admin-table" aria-label="Classmate registrations">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Class ID</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Location</th>
                  <th scope="col">Attendance</th>
                  <th scope="col">Registered</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((person) => (
                  <tr key={person.id}>
                    <td>
                      <strong>{person.full_name}</strong>
                      {person.nickname && <small>"{person.nickname}"</small>}
                    </td>
                    <td><code>{person.class_id}</code></td>
                    <td>{person.phone}</td>
                    <td>{person.location || "—"}</td>
                    <td>
                      <span className={person.attending ? "badge success" : "badge danger"}>
                        {person.attending ? "Attending" : "Not attending"}
                      </span>
                    </td>
                    <td>{new Date(person.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="reg-action-group">
                        <button
                          className="admin-table-action"
                          onClick={() => openView(person)}
                          aria-label={`View details for ${person.full_name}`}
                        >
                          View
                        </button>
                        <button
                          className="admin-table-action reg-edit-btn"
                          onClick={(e) => openEdit(person, e)}
                          aria-label={`Edit ${person.full_name}`}
                        >
                          Edit
                        </button>
                        <button
                          className="admin-table-action reg-delete-btn"
                          onClick={(e) => requestDelete(person, e)}
                          aria-label={`Delete ${person.full_name}`}
                        >
                          Delete
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

      {/* ═══ VIEW MODAL ═══ */}
      {modal === "view" && selected && (
        <div
          className="modal-background"
          role="dialog"
          aria-modal="true"
          aria-labelledby="view-modal-heading"
          onClick={() => setModal(null)}
        >
          <div className="details-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="close-modal"
              onClick={() => setModal(null)}
              aria-label={`Close details for ${selected.full_name}`}
            >
              <span aria-hidden="true">×</span>
            </button>

            <p className="page-eyebrow" aria-hidden="true">CLASSMATE PROFILE</p>
            <h2
              id="view-modal-heading"
              tabIndex={-1}
              ref={modalHeadingRef}
              style={{ outline: "none" }}
            >
              {selected.full_name}
            </h2>
            <div className="class-id" aria-label={`Classmate ID: ${selected.class_id}`}>
              {selected.class_id}
            </div>

            <dl className="details-grid">
              <div><dt>Nickname</dt><dd>{selected.nickname || "—"}</dd></div>
              <div><dt>Phone</dt><dd>{selected.phone}</dd></div>
              <div><dt>Email</dt><dd>{selected.email || "—"}</dd></div>
              <div><dt>Class / Stream</dt><dd>{selected.class_stream || "—"}</dd></div>
              <div><dt>SHS House</dt><dd>{selected.shs_house || "—"}</dd></div>
              <div><dt>Occupation</dt><dd>{selected.occupation || "—"}</dd></div>
              <div><dt>Organization</dt><dd>{selected.organization || "—"}</dd></div>
              <div><dt>Location</dt><dd>{selected.location || "—"}</dd></div>
              <div><dt>Attendance</dt>
                <dd>
                  <span className={selected.attending ? "badge success" : "badge danger"}>
                    {selected.attending ? "Attending" : "Not attending"}
                  </span>
                </dd>
              </div>
              <div><dt>Guests</dt><dd>{selected.guests}</dd></div>
              <div><dt>T-Shirt</dt><dd>{selected.tshirt_size ? `${selected.tshirt_size} × ${selected.tshirt_quantity}` : "—"}</dd></div>
              <div><dt>Privacy Consent</dt><dd>{selected.privacy_consent ? "Given ✓" : "Not given"}</dd></div>
            </dl>

            {selected.favourite_memory && (
              <div className="memory-panel">
                <span>Favourite SHS Memory</span>
                <p>{selected.favourite_memory}</p>
              </div>
            )}

            {/* Quick actions from view modal */}
            <div className="reg-modal-actions">
              <button
                className="admin-secondary-button"
                onClick={() => setModal(null)}
              >
                Close
              </button>
              <button
                className="admin-primary-button"
                onClick={() => openEdit(selected)}
              >
                Edit This Record
              </button>
              <button
                className="admin-danger-button"
                onClick={() => requestDelete(selected)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EDIT MODAL ═══ */}
      {modal === "edit" && selected && (
        <div
          className="modal-background"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-modal-heading"
          onClick={() => setModal(null)}
        >
          <div
            className="details-modal reg-edit-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close-modal"
              onClick={() => setModal(null)}
              aria-label="Close edit form"
            >
              <span aria-hidden="true">×</span>
            </button>

            <p className="page-eyebrow" aria-hidden="true">EDIT REGISTRATION</p>
            <h2
              id="edit-modal-heading"
              tabIndex={-1}
              ref={modalHeadingRef}
              style={{ marginBottom: 20, outline: "none" }}
            >
              {selected.full_name}
            </h2>
            <div className="class-id" style={{ marginBottom: 20 }}>
              {selected.class_id}
            </div>

            {/* Feedback */}
            <div aria-live="polite" aria-atomic="true">
              {saveType === "success" && (
                <div className="admin-success-message" role="status">
                  <span aria-hidden="true">✓ </span>{saveText}
                </div>
              )}
            </div>
            <div aria-live="assertive">
              {saveType === "error" && (
                <div className="admin-error-message" role="alert">
                  <span aria-hidden="true">⚠ </span>{saveText}
                </div>
              )}
            </div>

            <form
              className="admin-form reg-edit-form"
              onSubmit={handleSaveEdit}
              noValidate
              aria-label="Edit registration form"
            >
              {/* ── Personal ── */}
              <div className="reg-edit-section-heading">Personal Information</div>

              <div className="admin-form-grid">
                <div>
                  <label htmlFor="edit-full-name">
                    Full Name <span aria-hidden="true" style={{ color: "#d93025" }}>*</span>
                  </label>
                  <input
                    id="edit-full-name"
                    type="text"
                    name="full_name"
                    value={editForm.full_name}
                    onChange={handleEditChange}
                    required
                    aria-required="true"
                    aria-invalid={!!editErrors.full_name}
                    aria-describedby={editErrors.full_name ? "err-full-name" : undefined}
                    autoComplete="name"
                  />
                  <FieldErr id="err-full-name" msg={editErrors.full_name} />
                </div>

                <div>
                  <label htmlFor="edit-nickname">Nickname</label>
                  <input
                    id="edit-nickname"
                    type="text"
                    name="nickname"
                    value={editForm.nickname}
                    onChange={handleEditChange}
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label htmlFor="edit-phone">
                    Phone / WhatsApp <span aria-hidden="true" style={{ color: "#d93025" }}>*</span>
                  </label>
                  <input
                    id="edit-phone"
                    type="tel"
                    name="phone"
                    value={editForm.phone}
                    onChange={handleEditChange}
                    required
                    aria-required="true"
                    aria-invalid={!!editErrors.phone}
                    aria-describedby={editErrors.phone ? "err-phone" : undefined}
                    autoComplete="tel"
                  />
                  <FieldErr id="err-phone" msg={editErrors.phone} />
                </div>

                <div>
                  <label htmlFor="edit-email">Email Address</label>
                  <input
                    id="edit-email"
                    type="email"
                    name="email"
                    value={editForm.email}
                    onChange={handleEditChange}
                    placeholder="Optional"
                    aria-invalid={!!editErrors.email}
                    aria-describedby={editErrors.email ? "err-email" : undefined}
                    autoComplete="email"
                  />
                  <FieldErr id="err-email" msg={editErrors.email} />
                </div>
              </div>

              {/* ── Class info ── */}
              <div className="reg-edit-section-heading">Class Information</div>

              <div className="admin-form-grid">
                <div>
                  <label htmlFor="edit-class-stream">Class / Stream</label>
                  <input
                    id="edit-class-stream"
                    type="text"
                    name="class_stream"
                    value={editForm.class_stream}
                    onChange={handleEditChange}
                    placeholder="e.g. 3A12"
                  />
                </div>

                <div>
                  <label htmlFor="edit-shs-house">SHS House</label>
                  <select
                    id="edit-shs-house"
                    name="shs_house"
                    value={editForm.shs_house}
                    onChange={handleEditChange}
                  >
                    <option value="">Select house</option>
                    {SHS_HOUSES.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── Life after SHS ── */}
              <div className="reg-edit-section-heading">Life After SHS</div>

              <div className="admin-form-grid">
                <div>
                  <label htmlFor="edit-occupation">Occupation</label>
                  <input
                    id="edit-occupation"
                    type="text"
                    name="occupation"
                    value={editForm.occupation}
                    onChange={handleEditChange}
                  />
                </div>
                <div>
                  <label htmlFor="edit-organization">Organization</label>
                  <input
                    id="edit-organization"
                    type="text"
                    name="organization"
                    value={editForm.organization}
                    onChange={handleEditChange}
                  />
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <label htmlFor="edit-location">Current Location</label>
                  <input
                    id="edit-location"
                    type="text"
                    name="location"
                    value={editForm.location}
                    onChange={handleEditChange}
                    placeholder="e.g. Accra, Ghana"
                  />
                </div>
              </div>

              {/* ── Reunion details ── */}
              <div className="reg-edit-section-heading">Reunion Details</div>

              <div className="admin-form-grid">
                <div>
                  <label htmlFor="edit-attending">Attendance</label>
                  <select
                    id="edit-attending"
                    name="attending"
                    value={String(editForm.attending)}
                    onChange={handleEditChange}
                  >
                    <option value="true">Attending</option>
                    <option value="false">Not attending</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-guests">Number of Guests</label>
                  <select
                    id="edit-guests"
                    name="guests"
                    value={editForm.guests}
                    onChange={handleEditChange}
                  >
                    {[0, 1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>{n === 0 ? "None" : n}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-tshirt-size">T-Shirt Size</label>
                  <select
                    id="edit-tshirt-size"
                    name="tshirt_size"
                    value={editForm.tshirt_size}
                    onChange={handleEditChange}
                  >
                    <option value="">No size selected</option>
                    {TSHIRT_SIZES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-tshirt-qty">T-Shirt Quantity</label>
                  <input
                    id="edit-tshirt-qty"
                    type="number"
                    name="tshirt_quantity"
                    min="0"
                    max="10"
                    value={editForm.tshirt_quantity}
                    onChange={handleEditChange}
                    aria-invalid={!!editErrors.tshirt_quantity}
                    aria-describedby={editErrors.tshirt_quantity ? "err-tshirt-qty" : undefined}
                  />
                  <FieldErr id="err-tshirt-qty" msg={editErrors.tshirt_quantity} />
                </div>
              </div>

              {/* ── Memory ── */}
              <div className="reg-edit-section-heading">Favourite SHS Memory</div>
              <div>
                <label htmlFor="edit-memory" className="sr-only">Favourite SHS memory</label>
                <textarea
                  id="edit-memory"
                  name="favourite_memory"
                  value={editForm.favourite_memory}
                  onChange={handleEditChange}
                  rows="4"
                  maxLength={500}
                  placeholder="Optional…"
                />
              </div>

              {/* ── Actions ── */}
              <div className="admin-modal-actions" style={{ paddingTop: 8 }}>
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="admin-danger-button"
                  onClick={() => requestDelete(selected)}
                >
                  Delete Record
                </button>
                <button
                  type="submit"
                  className="admin-primary-button"
                  disabled={saving}
                  aria-busy={saving}
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ DELETE CONFIRMATION ═══ */}
      {confirmDelete && (
        <ConfirmDialog
          heading={`Delete ${confirmDelete.full_name}?`}
          body={`This will permanently remove ${confirmDelete.full_name}'s registration, contribution records and all associated payments. This cannot be undone.`}
          confirmLabel="Yes, Delete Permanently"
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
