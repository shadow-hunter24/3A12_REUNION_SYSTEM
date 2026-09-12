import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { RefreshCw, AlertTriangle, Check, X } from "lucide-react";
import "./AdminPages.css";

const DEFAULT_EXPECTED = 500;

const PAYMENT_METHODS = [
  "MTN MOBILE MONEY",
  "VODAFONE CASH",
  "AIRTELTIGO MONEY",
  "CASH",
  "BANK TRANSFER",
  "OTHER",
];

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  })
    .format(Number(amount || 0))
    .replace("GHS", "GH₵");
}

function formatDate(dateString) {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-GH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status }) {
  const s = (status || "UNPAID").toUpperCase();
  const label = s === "PAID" ? "Fully paid" : s === "PARTIAL" ? "Partially paid" : "Unpaid";
  return (
    <span className={`admin-status-badge status-${s.toLowerCase()}`} aria-label={label}>
      {s}
    </span>
  );
}

// ── Shared field error ────────────────────────────────────────
function FieldErr({ id, msg }) {
  if (!msg) return null;
  return (
    <p id={id} className="contrib-field-error" role="alert">
      <AlertTriangle size={13} aria-hidden="true" /> {msg}
    </p>
  );
}

// ── Inline delete confirmation ────────────────────────────────
function DeleteConfirm({ payment, onConfirm, onCancel, saving }) {
  const confirmRef = useRef(null);
  useEffect(() => { confirmRef.current?.focus(); }, []);
  return (
    <div className="contrib-delete-confirm" role="group" aria-label="Confirm payment deletion">
      <span>Delete this payment?</span>
      <button ref={confirmRef} className="contrib-delete-yes" onClick={() => onConfirm(payment)} disabled={saving}>
        Delete
      </button>
      <button className="contrib-delete-no" onClick={onCancel}>Cancel</button>
    </div>
  );
}

const emptyPaymentForm = {
  amount: "",
  payment_method: "MTN MOBILE MONEY",
  transaction_reference: "",
  payment_date: new Date().toISOString().slice(0, 10),
  notes: "",
};

export default function Contributions() {
  const [classmates, setClassmates]       = useState([]);
  const [contributions, setContributions] = useState([]);
  const [payments, setPayments]           = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  // modal: null | "add" | "history" | "editPayment" | "editExpected"
  const [modal, setModal]                     = useState(null);
  const [activeClassmate, setActiveClassmate] = useState(null);
  const [editingPayment, setEditingPayment]   = useState(null);
  const [deletingPayment, setDeletingPayment] = useState(null);

  const [form, setForm]           = useState(emptyPaymentForm);
  const [formErrors, setFormErrors] = useState({});

  // Expected amount override form
  const [expectedForm, setExpectedForm]       = useState({ amount: "" });
  const [expectedFormError, setExpectedFormError] = useState("");

  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [message, setMessage] = useState("");
  const [error, setError]     = useState("");

  const modalHeadingRef = useRef(null);
  useEffect(() => {
    if (modal) modalHeadingRef.current?.focus();
  }, [modal]);

  useEffect(() => {
    if (!modal) return;
    function onKey(e) { if (e.key === "Escape") closeModal(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

  // ─── DATA ─────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [
        { data: cmData,    error: e1 },
        { data: contData,  error: e2 },
        { data: payData,   error: e3 },
      ] = await Promise.all([
        supabase.from("classmates").select("id, full_name, class_id, phone, email").order("full_name"),
        supabase.from("contributions").select("*"),
        supabase.from("contribution_payments").select("*").order("payment_date", { ascending: false }),
      ]);

      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;

      setClassmates(cmData    || []);
      setContributions(contData || []);
      setPayments(payData     || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── DERIVED MAPS ─────────────────────────────────────────
  const contributionMap = useMemo(() => {
    const map = {};
    contributions.forEach((c) => { map[c.classmate_id] = c; });
    return map;
  }, [contributions]);

  const paymentsByClassmate = useMemo(() => {
    const map = {};
    payments.forEach((p) => {
      if (!map[p.classmate_id]) map[p.classmate_id] = [];
      map[p.classmate_id].push(p);
    });
    return map;
  }, [payments]);

  // ─── STATS ────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalExpected  = classmates.reduce((s, cm) => {
      const c = contributionMap[cm.id];
      return s + Number(c?.expected_amount ?? DEFAULT_EXPECTED);
    }, 0);
    const totalCollected = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    let paid = 0, partial = 0, unpaid = 0;
    classmates.forEach((cm) => {
      const st = contributionMap[cm.id]?.payment_status || "UNPAID";
      if (st === "PAID")         paid++;
      else if (st === "PARTIAL") partial++;
      else                       unpaid++;
    });
    return {
      totalExpected, totalCollected,
      outstanding: Math.max(totalExpected - totalCollected, 0),
      paid, partial, unpaid,
      progress: totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0,
    };
  }, [classmates, payments, contributionMap]);

  // ─── FILTERED ROWS ────────────────────────────────────────
  const rows = useMemo(() => {
    const term = search.toLowerCase().trim();
    return classmates
      .map((cm) => {
        const contrib        = contributionMap[cm.id];
        const expectedAmount = Number(contrib?.expected_amount ?? DEFAULT_EXPECTED);
        const memberPayments = paymentsByClassmate[cm.id] || [];
        const totalPaid      = memberPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
        const balance        = Math.max(expectedAmount - totalPaid, 0);
        const status         = contrib?.payment_status || "UNPAID";
        return { cm, contrib, memberPayments, totalPaid, balance, status, expectedAmount };
      })
      .filter(({ cm, status }) => {
        const matchSearch =
          !term ||
          cm.full_name?.toLowerCase().includes(term) ||
          cm.class_id?.toLowerCase().includes(term) ||
          cm.phone?.toLowerCase().includes(term);
        const matchStatus = statusFilter === "ALL" || status === statusFilter;
        return matchSearch && matchStatus;
      });
  }, [classmates, contributionMap, paymentsByClassmate, search, statusFilter]);

  // ─── MODAL HELPERS ────────────────────────────────────────
  function openAddPayment(cm) {
    setActiveClassmate(cm);
    setForm(emptyPaymentForm);
    setFormErrors({});
    setMessage(""); setError("");
    setModal("add");
  }

  function openHistory(cm) {
    setActiveClassmate(cm);
    setDeletingPayment(null);
    setEditingPayment(null);
    setMessage(""); setError("");
    setModal("history");
  }

  function openEditExpected(cm) {
    const contrib = contributionMap[cm.id];
    setActiveClassmate(cm);
    setExpectedForm({ amount: String(contrib?.expected_amount ?? DEFAULT_EXPECTED) });
    setExpectedFormError("");
    setMessage(""); setError("");
    setModal("editExpected");
  }

  function closeModal() {
    setModal(null);
    setActiveClassmate(null);
    setEditingPayment(null);
    setDeletingPayment(null);
    setFormErrors({});
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: null }));
  }

  // ─── VALIDATE PAYMENT FORM ────────────────────────────────
  function validatePayment(f) {
    const errs = {};
    const amount = Number(f.amount);
    if (!f.amount || isNaN(amount) || amount <= 0)
      errs.amount = "Please enter a valid amount greater than GH₵0.00.";
    else if (amount > 10000)
      errs.amount = "Amount seems unusually large. Please double-check.";
    if (!f.payment_date)
      errs.payment_date = "Please select a payment date.";
    return errs;
  }

  // ─── ADD PAYMENT ──────────────────────────────────────────
  async function handleSubmitAdd(e) {
    e.preventDefault();
    const errs = validatePayment(form);
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }

    setSaving(true); setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: insertError } = await supabase.from("contribution_payments").insert({
        classmate_id:          activeClassmate.id,
        amount:                Number(form.amount),
        payment_method:        form.payment_method,
        transaction_reference: form.transaction_reference.trim() || null,
        payment_date:          form.payment_date || null,
        recorded_by:           user?.email || null,
        notes:                 form.notes.trim() || null,
      });
      if (insertError) throw insertError;
      setMessage(`Payment of ${formatCurrency(form.amount)} recorded for ${activeClassmate.full_name}.`);
      closeModal();
      await loadData();
    } catch (err) {
      setError(err.message || "Could not save payment. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ─── EDIT PAYMENT ─────────────────────────────────────────
  function startEditPayment(p) {
    setEditingPayment(p);
    setForm({
      amount:                String(p.amount),
      payment_method:        p.payment_method || "MTN MOBILE MONEY",
      transaction_reference: p.transaction_reference || "",
      payment_date:          p.payment_date ? p.payment_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      notes:                 p.notes || "",
    });
    setFormErrors({});
    setModal("editPayment");
  }

  async function handleSubmitEditPayment(e) {
    e.preventDefault();
    const errs = validatePayment(form);
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }

    setSaving(true); setError("");
    try {
      const { error: updateError } = await supabase
        .from("contribution_payments")
        .update({
          amount:                Number(form.amount),
          payment_method:        form.payment_method,
          transaction_reference: form.transaction_reference.trim() || null,
          payment_date:          form.payment_date || null,
          notes:                 form.notes.trim() || null,
        })
        .eq("id", editingPayment.id);

      if (updateError) throw updateError;
      setMessage(`Payment updated successfully.`);
      closeModal();
      await loadData();
    } catch (err) {
      setError(err.message || "Could not update payment. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ─── DELETE PAYMENT ───────────────────────────────────────
  async function handleDeletePayment(payment) {
    setSaving(true); setError("");
    try {
      const { error: deleteError } = await supabase
        .from("contribution_payments").delete().eq("id", payment.id);
      if (deleteError) throw deleteError;
      setDeletingPayment(null);
      setMessage("Payment deleted.");
      await loadData();
    } catch (err) {
      setError(err.message || "Could not delete payment. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ─── EDIT EXPECTED AMOUNT ─────────────────────────────────
  async function handleSaveExpected(e) {
    e.preventDefault();
    const val = Number(expectedForm.amount);
    if (!expectedForm.amount || isNaN(val) || val <= 0) {
      setExpectedFormError("Please enter a valid expected amount greater than GH₵0.00.");
      return;
    }
    if (val > 50000) {
      setExpectedFormError("Amount seems unusually high. Please double-check.");
      return;
    }

    setSaving(true); setError("");
    try {
      // Upsert the contributions row — update expected_amount
      const { error: upsertError } = await supabase
        .from("contributions")
        .upsert(
          {
            classmate_id:    activeClassmate.id,
            expected_amount: val,
          },
          { onConflict: "classmate_id" }
        );
      if (upsertError) throw upsertError;
      setMessage(`Expected contribution for ${activeClassmate.full_name} updated to ${formatCurrency(val)}.`);
      closeModal();
      await loadData();
    } catch (err) {
      setExpectedFormError(err.message || "Could not update expected amount. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ─── DELETE CONTRIBUTION RECORD ───────────────────────────
  async function handleDeleteContribution(cm) {
    // This removes the contribution summary record AND (via FK cascade) all payments
    const contrib = contributionMap[cm.id];
    if (!contrib) {
      setError(`No contribution record found for ${cm.full_name}.`);
      return;
    }
    setSaving(true); setError("");
    try {
      // Delete all payments first (in case no ON DELETE CASCADE)
      await supabase.from("contribution_payments").delete().eq("classmate_id", cm.id);
      // Delete the contribution record itself
      const { error: deleteError } = await supabase
        .from("contributions")
        .delete()
        .eq("classmate_id", cm.id);
      if (deleteError) throw deleteError;
      setMessage(`Contribution record for ${cm.full_name} deleted. All payments removed.`);
      closeModal();
      await loadData();
    } catch (err) {
      setError(err.message || "Could not delete contribution record. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ─── ACTIVE DATA ──────────────────────────────────────────
  const activePayments  = activeClassmate ? (paymentsByClassmate[activeClassmate.id] || []) : [];
  const activeTotalPaid = activePayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const activeExpected  = Number(contributionMap[activeClassmate?.id]?.expected_amount ?? DEFAULT_EXPECTED);
  const activeBalance   = Math.max(activeExpected - activeTotalPaid, 0);
  const activeStatus    = contributionMap[activeClassmate?.id]?.payment_status || "UNPAID";

  if (loading) {
    return (
      <div className="empty-message" role="status" aria-live="polite">
        <span className="admin-page-spinner" aria-hidden="true" />
        <strong>Loading Contributions…</strong>
      </div>
    );
  }

  // ─── SHARED PAYMENT FORM BODY ─────────────────────────────
  function PaymentFormFields() {
    return (
      <>
        <div>
          <label htmlFor="pay-amount">
            Amount (GH₵) <span aria-hidden="true" style={{ color: "#d93025" }}>*</span>
          </label>
          <input
            id="pay-amount"
            type="number"
            name="amount"
            value={form.amount}
            onChange={handleChange}
            min="0.01"
            step="0.01"
            placeholder="e.g. 200.00"
            required
            aria-required="true"
            aria-invalid={!!formErrors.amount}
            aria-describedby={formErrors.amount ? "pay-err-amount" : undefined}
            autoFocus
          />
          <FieldErr id="pay-err-amount" msg={formErrors.amount} />
        </div>

        <div className="admin-form-grid">
          <div>
            <label htmlFor="pay-method">Payment Method</label>
            <select id="pay-method" name="payment_method" value={form.payment_method} onChange={handleChange}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pay-date">
              Date <span aria-hidden="true" style={{ color: "#d93025" }}>*</span>
            </label>
            <input
              id="pay-date"
              type="date"
              name="payment_date"
              value={form.payment_date}
              onChange={handleChange}
              aria-required="true"
              aria-invalid={!!formErrors.payment_date}
              aria-describedby={formErrors.payment_date ? "pay-err-date" : undefined}
            />
            <FieldErr id="pay-err-date" msg={formErrors.payment_date} />
          </div>
        </div>

        <div>
          <label htmlFor="pay-ref">Transaction / MoMo Reference</label>
          <input
            id="pay-ref"
            type="text"
            name="transaction_reference"
            value={form.transaction_reference}
            onChange={handleChange}
            placeholder="Optional — e.g. 123456789"
          />
        </div>

        <div>
          <label htmlFor="pay-notes">Notes</label>
          <textarea
            id="pay-notes"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            placeholder="Optional notes…"
            rows="2"
          />
        </div>
      </>
    );
  }

  return (
    <div>
      {/* PAGE HEADER */}
      <div className="page-header">
        <div>
          <p className="page-eyebrow">FINANCIAL MANAGEMENT</p>
          <h1>Contributions</h1>
          <p>
            Track reunion contributions per classmate. Record payments,
            adjust expected amounts and manage all financial records.
          </p>
        </div>
        <button className="secondary-button" onClick={loadData} aria-label="Refresh data">
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </div>

      {/* Global feedback */}
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

      {/* SUMMARY STRIP */}
      <div className="contrib-summary-strip" role="list" aria-label="Contribution summary">
        {[
          { label: "Total Expected",  value: formatCurrency(stats.totalExpected) },
          { label: "Total Collected", value: formatCurrency(stats.totalCollected), highlight: true },
          { label: "Outstanding",     value: formatCurrency(stats.outstanding) },
          { label: "Progress",        value: `${stats.progress}%` },
          { label: "Fully Paid",      value: stats.paid },
          { label: "Partial",         value: stats.partial },
          { label: "Unpaid",          value: stats.unpaid },
        ].map(({ label, value, highlight }) => (
          <div
            key={label}
            role="listitem"
            className={`contrib-summary-item${highlight ? " contrib-summary-highlight" : ""}`}
            aria-label={`${label}: ${value}`}
          >
            <span>{label}</span>
            <strong>{value}</strong>
            {label === "Progress" && (
              <div
                className="contrib-progress-bar"
                role="progressbar"
                aria-valuenow={stats.progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="contrib-progress-fill" style={{ width: `${stats.progress}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* FILTERS */}
      <div className="admin-toolbar" role="search" aria-label="Filter contributions">
        <label htmlFor="contrib-search" className="sr-only">Search members</label>
        <input
          id="contrib-search"
          type="search"
          placeholder="Search name, class ID, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-controls="contrib-table"
        />
        <label htmlFor="contrib-status" className="sr-only">Filter by status</label>
        <select
          id="contrib-status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by payment status"
        >
          <option value="ALL">All Members</option>
          <option value="PAID">Fully Paid</option>
          <option value="PARTIAL">Partial</option>
          <option value="UNPAID">Unpaid</option>
        </select>
      </div>

      {/* TABLE */}
      <div className="data-card">
        <div className="data-card-header">
          <div>
            <h2>Member Contributions</h2>
            <p id="contrib-count" aria-live="polite">
              {rows.length} member{rows.length !== 1 ? "s" : ""} shown
            </p>
          </div>
        </div>

        <div className="table-scroll">
          <table id="contrib-table" className="admin-table" aria-label="Member contribution records">
            <thead>
              <tr>
                <th scope="col">Member</th>
                <th scope="col">Class ID</th>
                <th scope="col">Expected</th>
                <th scope="col">Paid</th>
                <th scope="col">Balance</th>
                <th scope="col">Status</th>
                <th scope="col">Payments</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="8" className="admin-empty-table" role="status">
                    No members match your current filter.
                  </td>
                </tr>
              ) : (
                rows.map(({ cm, memberPayments, totalPaid, balance, status, expectedAmount }) => (
                  <tr key={cm.id}>
                    <td>
                      <strong>{cm.full_name}</strong>
                      {cm.phone && <small className="admin-table-subtext">{cm.phone}</small>}
                    </td>
                    <td>
                      <code style={{ background: "#f4f0e6", padding: "4px 7px", borderRadius: 5, fontSize: 11 }}>
                        {cm.class_id}
                      </code>
                    </td>
                    <td>
                      <span style={{ fontSize: 13 }}>{formatCurrency(expectedAmount)}</span>
                    </td>
                    <td>
                      <strong style={{ color: totalPaid > 0 ? "#198754" : "#aaa" }}>
                        {formatCurrency(totalPaid)}
                      </strong>
                    </td>
                    <td>
                      <strong style={{ color: balance > 0 ? "#b42318" : "#198754" }}>
                        {formatCurrency(balance)}
                      </strong>
                    </td>
                    <td><StatusBadge status={status} /></td>
                    <td>
                      <span style={{ fontSize: 12, color: "#667085" }}>
                        {memberPayments.length} payment{memberPayments.length !== 1 ? "s" : ""}
                      </span>
                    </td>
                    <td>
                      <div className="reg-action-group">
                        <button
                          className="admin-table-action"
                          onClick={() => openAddPayment(cm)}
                          aria-label={`Record payment for ${cm.full_name}`}
                        >
                          + Pay
                        </button>
                        {memberPayments.length > 0 && (
                          <button
                            className="admin-table-action"
                            onClick={() => openHistory(cm)}
                            aria-label={`View payment history for ${cm.full_name}`}
                            style={{ background: "#f0f4ff", color: "#3b5bdb" }}
                          >
                            History
                          </button>
                        )}
                        <button
                          className="admin-table-action"
                          onClick={() => openEditExpected(cm)}
                          aria-label={`Edit expected amount for ${cm.full_name}`}
                          style={{ background: "#fffaeb", color: "#b54708" }}
                        >
                          Expected
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ ADD PAYMENT MODAL ═══ */}
      {modal === "add" && activeClassmate && (
        <div
          className="modal-background"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-pay-heading"
          onClick={closeModal}
        >
          <div className="details-modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={closeModal} aria-label="Close">
              <span aria-hidden="true">×</span>
            </button>
            <p className="page-eyebrow" aria-hidden="true">RECORD PAYMENT</p>
            <h2 id="add-pay-heading" tabIndex={-1} ref={modalHeadingRef} style={{ marginBottom: 4, outline: "none" }}>
              {activeClassmate.full_name}
            </h2>

            <MemberBalanceSummary
              cm={activeClassmate}
              totalPaid={activeTotalPaid}
              balance={activeBalance}
              expected={activeExpected}
            />

            <div aria-live="assertive">
              {error && <div className="admin-error-message" role="alert"><AlertTriangle size={15} aria-hidden="true" /> {error}</div>}
            </div>

            <form className="admin-form" onSubmit={handleSubmitAdd} noValidate>
              <PaymentFormFields />
              <div className="admin-modal-actions">
                <button type="button" className="admin-secondary-button" onClick={closeModal}>Cancel</button>
                <button type="submit" className="admin-primary-button" disabled={saving} aria-busy={saving}>
                  {saving ? "Saving…" : "Save Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ EDIT PAYMENT MODAL ═══ */}
      {modal === "editPayment" && editingPayment && activeClassmate && (
        <div
          className="modal-background"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-pay-heading"
          onClick={closeModal}
        >
          <div className="details-modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={closeModal} aria-label="Close">
              <span aria-hidden="true">×</span>
            </button>
            <p className="page-eyebrow" aria-hidden="true">EDIT PAYMENT</p>
            <h2 id="edit-pay-heading" tabIndex={-1} ref={modalHeadingRef} style={{ marginBottom: 4, outline: "none" }}>
              Edit Payment — {activeClassmate.full_name}
            </h2>
            <p style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>
              Originally recorded: {formatCurrency(editingPayment.amount)} on {formatDate(editingPayment.payment_date)}
            </p>

            <div aria-live="assertive">
              {error && <div className="admin-error-message" role="alert"><AlertTriangle size={15} aria-hidden="true" /> {error}</div>}
            </div>

            <form className="admin-form" onSubmit={handleSubmitEditPayment} noValidate>
              <PaymentFormFields />
              <div className="admin-modal-actions">
                <button type="button" className="admin-secondary-button" onClick={closeModal}>Cancel</button>
                <button type="submit" className="admin-primary-button" disabled={saving} aria-busy={saving}>
                  {saving ? "Saving…" : "Update Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ HISTORY MODAL ═══ */}
      {modal === "history" && activeClassmate && (
        <div
          className="modal-background"
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-heading"
          onClick={closeModal}
        >
          <div className="details-modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={closeModal} aria-label="Close history">
              <span aria-hidden="true">×</span>
            </button>
            <p className="page-eyebrow" aria-hidden="true">PAYMENT HISTORY</p>
            <h2 id="history-heading" tabIndex={-1} ref={modalHeadingRef} style={{ marginBottom: 4, outline: "none" }}>
              {activeClassmate.full_name}
            </h2>
            <small style={{ color: "#999" }}>{activeClassmate.class_id}</small>

            <MemberBalanceSummary
              cm={activeClassmate}
              totalPaid={activeTotalPaid}
              balance={activeBalance}
              expected={activeExpected}
              status={activeStatus}
              style={{ marginTop: 16 }}
            />

            <div aria-live="assertive">
              {error && <div className="admin-error-message" role="alert" style={{ marginTop: 12 }}><AlertTriangle size={15} aria-hidden="true" /> {error}</div>}
            </div>
            <div aria-live="polite">
              {message && <div className="admin-success-message" role="status" style={{ marginTop: 12 }}><Check size={15} aria-hidden="true" /> {message}</div>}
            </div>

            {/* Danger zone — delete entire contribution record */}
            <div className="contrib-danger-zone">
              <div>
                <strong>Danger Zone</strong>
                <p>
                  Delete this classmate's entire contribution record and all
                  associated payments. This cannot be undone.
                </p>
              </div>
              <button
                className="admin-danger-button"
                onClick={() => handleDeleteContribution(activeClassmate)}
                disabled={saving}
                aria-label={`Delete all contribution data for ${activeClassmate.full_name}`}
              >
                Delete All Records
              </button>
            </div>

            {/* Payment list */}
            <div
              className="contrib-history-list"
              role="list"
              aria-label={`Payment history for ${activeClassmate.full_name}`}
            >
              {activePayments.length === 0 ? (
                <p role="status" style={{ color: "#aaa", textAlign: "center", padding: "30px 0" }}>
                  No payments recorded yet.
                </p>
              ) : (
                activePayments.map((p) => (
                  <div
                    key={p.id}
                    className="contrib-history-item"
                    role="listitem"
                    aria-label={`${formatCurrency(p.amount)} via ${p.payment_method} on ${formatDate(p.payment_date)}`}
                  >
                    <div className="contrib-history-left">
                      <strong>{formatCurrency(p.amount)}</strong>
                      <span>{p.payment_method}</span>
                      {p.transaction_reference && <small>Ref: {p.transaction_reference}</small>}
                      {p.notes && <small>{p.notes}</small>}
                    </div>

                    <div className="contrib-history-right">
                      <span>{formatDate(p.payment_date)}</span>
                      {p.recorded_by && <small>by {p.recorded_by}</small>}

                      <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
                        {/* Edit payment button */}
                        <button
                          className="admin-table-action"
                          style={{ background: "#f0f4ff", color: "#3b5bdb", fontSize: 11, padding: "3px 8px" }}
                          onClick={() => startEditPayment(p)}
                          aria-label={`Edit payment of ${formatCurrency(p.amount)}`}
                        >
                          Edit
                        </button>

                        {deletingPayment?.id === p.id ? (
                          <DeleteConfirm
                            payment={p}
                            onConfirm={handleDeletePayment}
                            onCancel={() => setDeletingPayment(null)}
                            saving={saving}
                          />
                        ) : (
                          <button
                            className="contrib-delete-btn"
                            onClick={() => setDeletingPayment(p)}
                            aria-label={`Delete payment of ${formatCurrency(p.amount)} on ${formatDate(p.payment_date)}`}
                          >
                            <X size={14} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: 20, textAlign: "right" }}>
              <button
                className="admin-primary-button"
                onClick={() => { closeModal(); setTimeout(() => openAddPayment(activeClassmate), 50); }}
                aria-label={`Add another payment for ${activeClassmate.full_name}`}
              >
                + Add Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EDIT EXPECTED AMOUNT MODAL ═══ */}
      {modal === "editExpected" && activeClassmate && (
        <div
          className="modal-background"
          role="dialog"
          aria-modal="true"
          aria-labelledby="expected-heading"
          onClick={closeModal}
        >
          <div className="details-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={closeModal} aria-label="Close">
              <span aria-hidden="true">×</span>
            </button>
            <p className="page-eyebrow" aria-hidden="true">EDIT EXPECTED CONTRIBUTION</p>
            <h2 id="expected-heading" tabIndex={-1} ref={modalHeadingRef} style={{ marginBottom: 6, outline: "none" }}>
              {activeClassmate.full_name}
            </h2>
            <p style={{ color: "#666", fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
              The default expected contribution is {formatCurrency(DEFAULT_EXPECTED)}.
              You can override this for individual classmates — for example, if a different
              amount was agreed upon.
            </p>

            <div aria-live="assertive">
              {expectedFormError && (
                <div className="admin-error-message" role="alert">
                  <AlertTriangle size={15} aria-hidden="true" /> {expectedFormError}
                </div>
              )}
            </div>

            <form className="admin-form" onSubmit={handleSaveExpected} noValidate>
              <div>
                <label htmlFor="expected-amount">
                  Expected Amount (GH₵) <span aria-hidden="true" style={{ color: "#d93025" }}>*</span>
                </label>
                <input
                  id="expected-amount"
                  type="number"
                  min="1"
                  step="0.01"
                  value={expectedForm.amount}
                  onChange={(e) => {
                    setExpectedForm({ amount: e.target.value });
                    setExpectedFormError("");
                  }}
                  required
                  aria-required="true"
                  aria-invalid={!!expectedFormError}
                  autoFocus
                />
                <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                  Current default: {formatCurrency(DEFAULT_EXPECTED)} per classmate.
                </p>
              </div>

              <div className="admin-modal-actions">
                <button type="button" className="admin-secondary-button" onClick={closeModal}>Cancel</button>
                <button type="submit" className="admin-primary-button" disabled={saving} aria-busy={saving}>
                  {saving ? "Saving…" : "Save Expected Amount"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Shared balance summary bar ────────────────────────────────
function MemberBalanceSummary({ totalPaid, balance, expected, status, style }) {
  return (
    <div className="contrib-member-summary" style={style} aria-label="Current payment summary">
      <div aria-label={`Paid so far: ${formatCurrency(totalPaid)}`}>
        <span>Paid</span>
        <strong style={{ color: "#198754" }}>{formatCurrency(totalPaid)}</strong>
      </div>
      <div aria-label={`Balance: ${formatCurrency(balance)}`}>
        <span>Balance</span>
        <strong style={{ color: balance > 0 ? "#b42318" : "#198754" }}>{formatCurrency(balance)}</strong>
      </div>
      <div aria-label={`Expected: ${formatCurrency(expected)}`}>
        <span>Expected</span>
        <strong>{formatCurrency(expected)}</strong>
      </div>
      {status && (
        <div>
          <span>Status</span>
          <StatusBadge status={status} />
        </div>
      )}
    </div>
  );
}
