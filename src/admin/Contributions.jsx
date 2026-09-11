import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import "./AdminPages.css";

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

const emptyForm = {
  classmate_id: "",
  expected_amount: "500",
  amount_paid: "",
  payment_method: "MTN MOBILE MONEY",
  transaction_reference: "",
  payment_date: new Date().toISOString().slice(0, 10),
  notes: "",
};

export default function Contributions() {
  const [classmates, setClassmates] = useState([]);
  const [contributions, setContributions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingContribution, setEditingContribution] =
    useState(null);

  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        { data: classmatesData, error: classmatesError },
        { data: contributionsData, error: contributionsError },
      ] = await Promise.all([
        supabase
          .from("classmates")
          .select("*")
          .order("full_name", { ascending: true }),

        supabase
          .from("contributions")
          .select("*")
          .order("updated_at", { ascending: false }),
      ]);

      if (classmatesError) throw classmatesError;
      if (contributionsError) throw contributionsError;

      setClassmates(classmatesData || []);
      setContributions(contributionsData || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to load contribution records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const contributionMap = useMemo(() => {
    const map = {};

    contributions.forEach((item) => {
      map[item.classmate_id] = item;
    });

    return map;
  }, [contributions]);

  const rows = useMemo(() => {
    return classmates
      .map((classmate) => {
        const contribution = contributionMap[classmate.id];

        return {
          classmate,
          contribution,
        };
      })
      .filter(({ classmate, contribution }) => {
        const searchText = search.toLowerCase().trim();

        const matchesSearch =
          !searchText ||
          classmate.full_name?.toLowerCase().includes(searchText) ||
          classmate.class_id?.toLowerCase().includes(searchText) ||
          classmate.phone?.toLowerCase().includes(searchText) ||
          classmate.email?.toLowerCase().includes(searchText);

        const status =
          contribution?.payment_status || "UNPAID";

        const matchesStatus =
          statusFilter === "ALL" ||
          status === statusFilter;

        return matchesSearch && matchesStatus;
      });
  }, [classmates, contributionMap, search, statusFilter]);

  const stats = useMemo(() => {
    let expected = 0;
    let collected = 0;

    let paid = 0;
    let partial = 0;
    let unpaid = 0;

    classmates.forEach((classmate) => {
      const contribution = contributionMap[classmate.id];

      const expectedAmount = Number(
        contribution?.expected_amount || 0
      );

      const amountPaid = Number(
        contribution?.amount_paid || 0
      );

      expected += expectedAmount;
      collected += amountPaid;

      if (contribution?.payment_status === "PAID") {
        paid++;
      } else if (contribution?.payment_status === "PARTIAL") {
        partial++;
      } else {
        unpaid++;
      }
    });

    return {
      expected,
      collected,
      outstanding: Math.max(expected - collected, 0),
      paid,
      partial,
      unpaid,
    };
  }, [classmates, contributionMap]);

  function openNewPayment(classmate = null) {
  setEditingContribution(null);

  setForm({
    ...emptyForm,
    classmate_id: classmate?.id || "",
    expected_amount: "500",
    payment_date: new Date().toISOString().slice(0, 10),
  });

  setMessage("");
  setError("");
  setShowModal(true);
}

  function openEditPayment(classmate, contribution) {
    setEditingContribution(contribution);

    setForm({
      classmate_id: classmate.id,
      expected_amount: contribution.expected_amount || "",
      amount_paid: contribution.amount_paid || "",
      payment_method:
        contribution.payment_method || "MTN MOBILE MONEY",
      transaction_reference:
        contribution.transaction_reference || "",
      payment_date: contribution.payment_date
        ? contribution.payment_date.slice(0, 10)
        : "",
      notes: contribution.notes || "",
    });

    setMessage("");
    setError("");
    setShowModal(true);
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function calculateStatus(expected, paid) {
    const expectedAmount = Number(expected || 0);
    const amountPaid = Number(paid || 0);

    if (amountPaid <= 0) return "UNPAID";
    if (amountPaid >= expectedAmount && expectedAmount > 0) {
      return "PAID";
    }

    return "PARTIAL";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const selectedClassmate = classmates.find(
        (classmate) => classmate.id === form.classmate_id
      );

      if (!selectedClassmate) {
        throw new Error("Please select a classmate.");
      }

      const expectedAmount = Number(
        form.expected_amount || 0
      );

      const amountPaid = Number(form.amount_paid || 0);

      if (expectedAmount < 0 || amountPaid < 0) {
        throw new Error("Amounts cannot be negative.");
      }

      const paymentStatus = calculateStatus(
        expectedAmount,
        amountPaid
      );

      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser();

      const payload = {
        classmate_id: form.classmate_id,
        expected_amount: expectedAmount,
        amount_paid: amountPaid,
        payment_status: paymentStatus,
        payment_method: form.payment_method,
        transaction_reference:
          form.transaction_reference.trim() || null,
        payment_date: form.payment_date
          ? new Date(
              `${form.payment_date}T12:00:00`
            ).toISOString()
          : null,
        recorded_by: user?.email || null,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingContribution) {
        const { error: updateError } = await supabase
          .from("contributions")
          .update(payload)
          .eq("id", editingContribution.id);

        if (updateError) throw updateError;

        setMessage(
          "Payment record updated successfully."
        );
      } else {
        const { error: insertError } = await supabase
          .from("contributions")
          .insert(payload);

        if (insertError) throw insertError;

        setMessage(
          "Payment recorded successfully."
        );
      }

      setShowModal(false);
      setForm(emptyForm);
      setEditingContribution(null);

      await loadData();
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to save payment record.");
    } finally {
      setSaving(false);
    }
  }

  function getStatus(contribution) {
    return contribution?.payment_status || "UNPAID";
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading">
          Loading contribution records...
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">

      <div className="admin-page-header">
        <div>
          <span className="admin-eyebrow">
            FINANCIAL MANAGEMENT
          </span>

          <h1>Contributions</h1>

          <p>
            Record payments received through your mobile money
            number and send confirmation emails to classmates.
          </p>
        </div>

        <button
          className="admin-primary-button"
          onClick={() => openNewPayment()}
        >
          + Record Payment
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
          <span>Total Expected</span>
          <strong>{formatCurrency(stats.expected)}</strong>
        </div>

        <div className="admin-summary-card">
          <span>Total Collected</span>
          <strong>{formatCurrency(stats.collected)}</strong>
        </div>

        <div className="admin-summary-card">
          <span>Outstanding</span>
          <strong>{formatCurrency(stats.outstanding)}</strong>
        </div>

        <div className="admin-summary-card">
          <span>Paid Classmates</span>
          <strong>{stats.paid}</strong>
        </div>

      </div>

      <div className="admin-summary-grid">

        <div className="admin-summary-card">
          <span>Paid</span>
          <strong>{stats.paid}</strong>
        </div>

        <div className="admin-summary-card">
          <span>Partial</span>
          <strong>{stats.partial}</strong>
        </div>

        <div className="admin-summary-card">
          <span>Unpaid</span>
          <strong>{stats.unpaid}</strong>
        </div>

        <div className="admin-summary-card">
          <span>Collection Progress</span>
          <strong>
            {stats.expected > 0
              ? Math.round(
                  (stats.collected / stats.expected) * 100
                )
              : 0}
            %
          </strong>
        </div>

      </div>

      {/* FILTERS */}

      <div className="admin-toolbar">

        <input
          type="text"
          placeholder="Search name, class ID, phone or email..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="ALL">All Payments</option>
          <option value="PAID">Paid</option>
          <option value="PARTIAL">Partial</option>
          <option value="UNPAID">Unpaid</option>
        </select>

        <button
          className="admin-secondary-button"
          onClick={loadData}
        >
          ↻ Refresh
        </button>

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
                <th>Expected</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>

              {rows.length === 0 ? (
                <tr>
                  <td colSpan="8" className="admin-empty-table">
                    No contribution records found.
                  </td>
                </tr>
              ) : (
                rows.map(({ classmate, contribution }) => {

                  const expected = Number(
                    contribution?.expected_amount || 0
                  );

                  const paid = Number(
                    contribution?.amount_paid || 0
                  );

                  const balance = Math.max(
                    expected - paid,
                    0
                  );

                  const status = getStatus(contribution);

                  return (
                    <tr key={classmate.id}>

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
                        {formatCurrency(expected)}
                      </td>

                      <td>
                        {formatCurrency(paid)}
                      </td>

                      <td>
                        {formatCurrency(balance)}
                      </td>

                      <td>
                        <span
                          className={`admin-status-badge status-${status.toLowerCase()}`}
                        >
                          {status}
                        </span>
                      </td>

                      <td>

                        {contribution ? (
                          <button
                            className="admin-table-action"
                            onClick={() =>
                              openEditPayment(
                                classmate,
                                contribution
                              )
                            }
                          >
                            Edit
                          </button>
                        ) : (
                          <button
                            className="admin-table-action"
                            onClick={() =>
                              openNewPayment(classmate)
                            }
                          >
                            Record
                          </button>
                        )}

                      </td>

                    </tr>
                  );
                })
              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* MODAL */}

      {showModal && (
        <div className="admin-modal-backdrop">

          <div className="admin-modal">

            <div className="admin-modal-header">

              <div>
                <span className="admin-eyebrow">
                  MANUAL PAYMENT ENTRY
                </span>

                <h2>
                  {editingContribution
                    ? "Edit Payment"
                    : "Record Payment"}
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
              onSubmit={handleSubmit}
            >

              <label>
                Classmate

                <select
                  name="classmate_id"
                  value={form.classmate_id}
                  onChange={handleChange}
                  disabled={Boolean(editingContribution)}
                  required
                >
                  <option value="">
                    Select classmate
                  </option>

                  {classmates.map((classmate) => (
                    <option
                      key={classmate.id}
                      value={classmate.id}
                    >
                      {classmate.full_name} —{" "}
                      {classmate.class_id}
                    </option>
                  ))}

                </select>
              </label>

              <div className="admin-form-grid">

                <label>
                  Expected Contribution (GH₵)

                  <input
                    type="number"
                    name="expected_amount"
                    value={form.expected_amount}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    required
                  />
                </label>

                <label>
                  Amount Paid (GH₵)

                  <input
                    type="number"
                    name="amount_paid"
                    value={form.amount_paid}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    required
                  />
                </label>

              </div>

              <div className="admin-form-grid">

                <label>
                  Payment Method

                  <select
                    name="payment_method"
                    value={form.payment_method}
                    onChange={handleChange}
                  >
                    <option value="MTN MOBILE MONEY">
                      MTN Mobile Money
                    </option>

                    <option value="VODAFONE CASH">
                      Vodafone Cash
                    </option>

                    <option value="AIRTELTIGO MONEY">
                      AirtelTigo Money
                    </option>

                    <option value="CASH">
                      Cash
                    </option>

                    <option value="BANK TRANSFER">
                      Bank Transfer
                    </option>

                    <option value="OTHER">
                      Other
                    </option>
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
                Transaction Reference / MoMo Reference

                <input
                  type="text"
                  name="transaction_reference"
                  value={form.transaction_reference}
                  onChange={handleChange}
                  placeholder="Optional transaction ID"
                />
              </label>

              <label>
                Notes

                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Optional notes about this payment..."
                  rows="3"
                />
              </label>

              <div className="admin-modal-actions">

                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={() => setShowModal(false)}
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
                    : editingContribution
                    ? "Update Payment"
                    : "Save Payment"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}