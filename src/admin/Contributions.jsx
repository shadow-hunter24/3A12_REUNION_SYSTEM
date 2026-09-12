import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import "./AdminPages.css";

const EXPECTED_AMOUNT = 500;

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
  return (
    <span className={`admin-status-badge status-${s.toLowerCase()}`}>
      {s}
    </span>
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

  const [loading, setSaving_loading]      = useState(true);
  const [saving, setSaving]               = useState(false);

  // Which modal is open: null | "add" | "history" | "delete"
  const [modal, setModal]                 = useState(null);
  const [activeClassmate, setActiveClassmate] = useState(null);
  const [deletingPayment, setDeletingPayment] = useState(null);

  const [form, setForm]                   = useState(emptyPaymentForm);
  const [search, setSearch]               = useState("");
  const [statusFilter, setStatusFilter]   = useState("ALL");

  const [message, setMessage]             = useState("");
  const [error, setError]                 = useState("");

  // ─── DATA LOADING ──────────────────────────────────────────

  const loadData = useCallback(async () => {
    setSaving_loading(true);
    setError("");

    try {
      const [
        { data: classmatesData,    error: e1 },
        { data: contributionsData, error: e2 },
        { data: paymentsData,      error: e3 },
      ] = await Promise.all([
        supabase
          .from("classmates")
          .select("id, full_name, class_id, phone, email")
          .order("full_name"),

        supabase
          .from("contributions")
          .select("*"),

        supabase
          .from("contribution_payments")
          .select("*")
          .order("payment_date", { ascending: false }),
      ]);

      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;

      setClassmates(classmatesData    || []);
      setContributions(contributionsData || []);
      setPayments(paymentsData        || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to load data.");
    } finally {
      setSaving_loading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── DERIVED MAPS ──────────────────────────────────────────

  // contributions summary keyed by classmate_id
  const contributionMap = useMemo(() => {
    const map = {};
    contributions.forEach((c) => { map[c.classmate_id] = c; });
    return map;
  }, [contributions]);

  // all payments grouped by classmate_id
  const paymentsByClassmate = useMemo(() => {
    const map = {};
    payments.forEach((p) => {
      if (!map[p.classmate_id]) map[p.classmate_id] = [];
      map[p.classmate_id].push(p);
    });
    return map;
  }, [payments]);

  // ─── OVERALL STATS ─────────────────────────────────────────

  const stats = useMemo(() => {
    const totalExpected = classmates.length * EXPECTED_AMOUNT;
    const totalCollected = payments.reduce(
      (sum, p) => sum + Number(p.amount || 0), 0
    );

    let paid = 0, partial = 0, unpaid = 0;

    classmates.forEach((cm) => {
      const c = contributionMap[cm.id];
      const status = c?.payment_status || "UNPAID";
      if (status === "PAID")         paid++;
      else if (status === "PARTIAL") partial++;
      else                           unpaid++;
    });

    return {
      totalExpected,
      totalCollected,
      outstanding: Math.max(totalExpected - totalCollected, 0),
      paid, partial, unpaid,
      progress: totalExpected > 0
        ? Math.round((totalCollected / totalExpected) * 100)
        : 0,
    };
  }, [classmates, payments, contributionMap]);

  // ─── FILTERED TABLE ROWS ───────────────────────────────────

  const rows = useMemo(() => {
    const term = search.toLowerCase().trim();

    return classmates
      .map((cm) => {
        const contrib = contributionMap[cm.id];
        const memberPayments = paymentsByClassmate[cm.id] || [];
        const totalPaid = memberPayments.reduce(
          (sum, p) => sum + Number(p.amount || 0), 0
        );
        const balance  = Math.max(EXPECTED_AMOUNT - totalPaid, 0);
        const status   = contrib?.payment_status || "UNPAID";

        return { cm, contrib, memberPayments, totalPaid, balance, status };
      })
      .filter(({ cm, status }) => {
        const matchesSearch =
          !term ||
          cm.full_name?.toLowerCase().includes(term) ||
          cm.class_id?.toLowerCase().includes(term) ||
          cm.phone?.toLowerCase().includes(term) ||
          cm.email?.toLowerCase().includes(term);

        const matchesStatus =
          statusFilter === "ALL" || status === statusFilter;

        return matchesSearch && matchesStatus;
      });
  }, [classmates, contributionMap, paymentsByClassmate, search, statusFilter]);

  // ─── FORM HANDLERS ─────────────────────────────────────────

  function openAddPayment(classmate) {
    setActiveClassmate(classmate);
    setForm(emptyPaymentForm);
    setMessage("");
    setError("");
    setModal("add");
  }

  function openHistory(classmate) {
    setActiveClassmate(classmate);
    setMessage("");
    setError("");
    setModal("history");
  }

  function closeModal() {
    setModal(null);
    setActiveClassmate(null);
    setDeletingPayment(null);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // ─── SAVE NEW INSTALLMENT ──────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const amount = Number(form.amount);
      if (!amount || amount <= 0) {
        throw new Error("Please enter a valid payment amount.");
      }

      const { data: { user } } = await supabase.auth.getUser();

      const { error: insertError } = await supabase
        .from("contribution_payments")
        .insert({
          classmate_id:          activeClassmate.id,
          amount,
          payment_method:        form.payment_method,
          transaction_reference: form.transaction_reference.trim() || null,
          payment_date:          form.payment_date || null,
          recorded_by:           user?.email || null,
          notes:                 form.notes.trim() || null,
        });

      if (insertError) throw insertError;

      setMessage("Payment recorded successfully.");
      setModal(null);
      await loadData();
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not save payment.");
    } finally {
      setSaving(false);
    }
  }

  // ─── DELETE PAYMENT ────────────────────────────────────────

  async function handleDeletePayment(payment) {
    setSaving(true);
    setError("");

    try {
      const { error: deleteError } = await supabase
        .from("contribution_payments")
        .delete()
        .eq("id", payment.id);

      if (deleteError) throw deleteError;

      setDeletingPayment(null);
      setMessage("Payment deleted.");
      await loadData();

      // Refresh the history for the open classmate
      // (payments state is updated by loadData)
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not delete payment.");
    } finally {
      setSaving(false);
    }
  }

  // ─── RENDER ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-spinner"></div>
        <h2>Loading Contributions...</h2>
      </div>
    );
  }

  // Payments for the currently open history modal
  const activePayments = activeClassmate
    ? (paymentsByClassmate[activeClassmate.id] || [])
    : [];

  const activeTotalPaid = activePayments.reduce(
    (sum, p) => sum + Number(p.amount || 0), 0
  );
  const activeBalance = Math.max(EXPECTED_AMOUNT - activeTotalPaid, 0);
  const activeStatus  = contributionMap[activeClassmate?.id]?.payment_status || "UNPAID";

  return (
    <div>

      {/* ── PAGE HEADER ── */}
      <div className="page-header">
        <div>
          <p className="page-eyebrow">FINANCIAL MANAGEMENT</p>
          <h1>Contributions</h1>
          <p>
            Track GH₵500 reunion contributions per classmate.
            Record installment payments and view each member's balance.
          </p>
        </div>
      </div>

      {message && (
        <div className="admin-success-message">{message}</div>
      )}
      {error && (
        <div className="admin-error-message">{error}</div>
      )}

      {/* ── OVERALL SUMMARY ── */}
      <div className="contrib-summary-strip">

        <div className="contrib-summary-item">
          <span>Total Expected</span>
          <strong>{formatCurrency(stats.totalExpected)}</strong>
        </div>

        <div className="contrib-summary-item contrib-summary-highlight">
          <span>Total Collected</span>
          <strong>{formatCurrency(stats.totalCollected)}</strong>
        </div>

        <div className="contrib-summary-item">
          <span>Outstanding</span>
          <strong>{formatCurrency(stats.outstanding)}</strong>
        </div>

        <div className="contrib-summary-item">
          <span>Progress</span>
          <strong>{stats.progress}%</strong>
          <div className="contrib-progress-bar">
            <div
              className="contrib-progress-fill"
              style={{ width: `${stats.progress}%` }}
            />
          </div>
        </div>

        <div className="contrib-summary-item">
          <span>Fully Paid</span>
          <strong>{stats.paid}</strong>
        </div>

        <div className="contrib-summary-item">
          <span>Partial</span>
          <strong>{stats.partial}</strong>
        </div>

        <div className="contrib-summary-item">
          <span>Unpaid</span>
          <strong>{stats.unpaid}</strong>
        </div>

      </div>

      {/* ── FILTERS ── */}
      <div className="admin-toolbar">
        <input
          type="text"
          placeholder="Search name, class ID, phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Members</option>
          <option value="PAID">Fully Paid</option>
          <option value="PARTIAL">Partial</option>
          <option value="UNPAID">Unpaid</option>
        </select>

        <button className="secondary-button" onClick={loadData}>
          ↻ Refresh
        </button>
      </div>

      {/* ── TABLE ── */}
      <div className="data-card">
        <div className="data-card-header">
          <div>
            <h2>Member Contributions</h2>
            <p>{rows.length} members shown</p>
          </div>
        </div>

        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Class ID</th>
                <th>Expected</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Payments</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="8" className="admin-empty-table">
                    No members found.
                  </td>
                </tr>
              ) : (
                rows.map(({ cm, memberPayments, totalPaid, balance, status }) => (
                  <tr key={cm.id}>
                    <td>
                      <strong>{cm.full_name}</strong>
                      {cm.phone && (
                        <small style={{ display: "block", color: "#999", marginTop: 3 }}>
                          {cm.phone}
                        </small>
                      )}
                    </td>

                    <td>
                      <code style={{
                        background: "#f4f0e6",
                        padding: "4px 7px",
                        borderRadius: 5,
                        fontSize: 11,
                      }}>
                        {cm.class_id}
                      </code>
                    </td>

                    <td>{formatCurrency(EXPECTED_AMOUNT)}</td>

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

                    <td>
                      <StatusBadge status={status} />
                    </td>

                    <td>
                      <span style={{ fontSize: 12, color: "#667085" }}>
                        {memberPayments.length} payment{memberPayments.length !== 1 ? "s" : ""}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          className="admin-table-action"
                          onClick={() => openAddPayment(cm)}
                          title="Record a payment"
                        >
                          + Pay
                        </button>

                        {memberPayments.length > 0 && (
                          <button
                            className="admin-table-action"
                            onClick={() => openHistory(cm)}
                            title="View payment history"
                            style={{ background: "#f0f4ff", color: "#3b5bdb" }}
                          >
                            History
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          MODAL — ADD PAYMENT INSTALLMENT
      ═══════════════════════════════════════════════════════ */}
      {modal === "add" && activeClassmate && (
        <div className="modal-background" onClick={closeModal}>
          <div
            className="details-modal"
            style={{ maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="close-modal" onClick={closeModal}>×</button>

            <p className="page-eyebrow">RECORD PAYMENT</p>
            <h2 style={{ marginBottom: 4 }}>{activeClassmate.full_name}</h2>

            {/* Mini balance summary */}
            <div className="contrib-member-summary">
              {(() => {
                const mp = paymentsByClassmate[activeClassmate.id] || [];
                const tp = mp.reduce((s, p) => s + Number(p.amount || 0), 0);
                const bl = Math.max(EXPECTED_AMOUNT - tp, 0);
                return (
                  <>
                    <div>
                      <span>Paid so far</span>
                      <strong style={{ color: "#198754" }}>{formatCurrency(tp)}</strong>
                    </div>
                    <div>
                      <span>Balance</span>
                      <strong style={{ color: bl > 0 ? "#b42318" : "#198754" }}>
                        {formatCurrency(bl)}
                      </strong>
                    </div>
                    <div>
                      <span>Target</span>
                      <strong>{formatCurrency(EXPECTED_AMOUNT)}</strong>
                    </div>
                  </>
                );
              })()}
            </div>

            {error && <div className="admin-error-message">{error}</div>}

            <form className="admin-form" onSubmit={handleSubmit}>

              <label>
                Amount Paid (GH₵) *
                <input
                  type="number"
                  name="amount"
                  value={form.amount}
                  onChange={handleChange}
                  min="0.01"
                  step="0.01"
                  placeholder="e.g. 200.00"
                  required
                  autoFocus
                />
              </label>

              <div className="admin-form-grid">
                <label>
                  Payment Method
                  <select
                    name="payment_method"
                    value={form.payment_method}
                    onChange={handleChange}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Payment Date
                  <input
                    type="date"
                    name="payment_date"
                    value={form.payment_date}
                    onChange={handleChange}
                  />
                </label>
              </div>

              <label>
                Transaction / MoMo Reference
                <input
                  type="text"
                  name="transaction_reference"
                  value={form.transaction_reference}
                  onChange={handleChange}
                  placeholder="Optional — e.g. 123456789"
                />
              </label>

              <label>
                Notes
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Optional notes..."
                  rows="2"
                />
              </label>

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={closeModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="admin-primary-button"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Payment"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL — PAYMENT HISTORY
      ═══════════════════════════════════════════════════════ */}
      {modal === "history" && activeClassmate && (
        <div className="modal-background" onClick={closeModal}>
          <div
            className="details-modal"
            style={{ maxWidth: 620 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="close-modal" onClick={closeModal}>×</button>

            <p className="page-eyebrow">PAYMENT HISTORY</p>
            <h2 style={{ marginBottom: 4 }}>{activeClassmate.full_name}</h2>
            <small style={{ color: "#999" }}>{activeClassmate.class_id}</small>

            {/* Member balance card */}
            <div className="contrib-member-summary" style={{ marginTop: 16 }}>
              <div>
                <span>Total Paid</span>
                <strong style={{ color: "#198754" }}>
                  {formatCurrency(activeTotalPaid)}
                </strong>
              </div>
              <div>
                <span>Balance</span>
                <strong style={{ color: activeBalance > 0 ? "#b42318" : "#198754" }}>
                  {formatCurrency(activeBalance)}
                </strong>
              </div>
              <div>
                <span>Status</span>
                <StatusBadge status={activeStatus} />
              </div>
            </div>

            {error && <div className="admin-error-message" style={{ marginTop: 12 }}>{error}</div>}

            {/* Payments list */}
            <div className="contrib-history-list">
              {activePayments.length === 0 ? (
                <p style={{ color: "#aaa", textAlign: "center", padding: "30px 0" }}>
                  No payments recorded yet.
                </p>
              ) : (
                activePayments.map((p) => (
                  <div key={p.id} className="contrib-history-item">
                    <div className="contrib-history-left">
                      <strong>{formatCurrency(p.amount)}</strong>
                      <span>{p.payment_method}</span>
                      {p.transaction_reference && (
                        <small>Ref: {p.transaction_reference}</small>
                      )}
                      {p.notes && <small>{p.notes}</small>}
                    </div>

                    <div className="contrib-history-right">
                      <span>{formatDate(p.payment_date)}</span>
                      {p.recorded_by && (
                        <small>by {p.recorded_by}</small>
                      )}

                      {deletingPayment?.id === p.id ? (
                        <div className="contrib-delete-confirm">
                          <span>Delete?</span>
                          <button
                            onClick={() => handleDeletePayment(p)}
                            disabled={saving}
                          >
                            Yes
                          </button>
                          <button onClick={() => setDeletingPayment(null)}>
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          className="contrib-delete-btn"
                          onClick={() => setDeletingPayment(p)}
                          title="Delete this payment"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add another payment from history modal */}
            <div style={{ marginTop: 20, textAlign: "right" }}>
              <button
                className="admin-primary-button"
                onClick={() => {
                  closeModal();
                  setTimeout(() => openAddPayment(activeClassmate), 50);
                }}
              >
                + Add Payment
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
