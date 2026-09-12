import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  Users, Check, UserRound, X, Wallet, Pin, Shirt,
  Ticket, RefreshCw, Camera, Trophy,
} from "lucide-react";
import "./Dashboard.css";

function formatDate(dateString) {
  if (!dateString) return "—";

  return new Date(dateString).toLocaleDateString("en-GH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  })
    .format(Number(amount || 0))
    .replace("GHS", "GH₵");
}

function getInitials(name) {
  if (!name) return "?";

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function Dashboard() {
  const [classmates, setClassmates] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contributionTableExists, setContributionTableExists] =
    useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: classmatesData,
        error: classmatesError,
      } = await supabase
        .from("classmates")
        .select("*")
        .order("created_at", { ascending: false });

      if (classmatesError) {
        throw classmatesError;
      }

      setClassmates(classmatesData || []);

      /*
       * Contributions are not yet required for the dashboard
       * to work. If the table exists, we load it.
       *
       * If it does not exist yet, the dashboard simply uses
       * GH₵0.00 until the contribution module is created.
       */
      const {
        data: contributionsData,
        error: contributionsError,
      } = await supabase
        .from("contributions")
        .select("*");

      if (contributionsError) {
        setContributionTableExists(false);
        setContributions([]);
      } else {
        setContributionTableExists(true);
        setContributions(contributionsData || []);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error("Dashboard error:", err);

      setError(
        err?.message ||
          "Unable to load dashboard data. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  /*
   * LIVE REGISTRATION STATISTICS
   */
  const statistics = useMemo(() => {
    const total = classmates.length;

    const attending = classmates.filter(
      (person) => person.attending === true
    ).length;

    const notAttending = classmates.filter(
      (person) => person.attending === false
    ).length;

    const totalGuests = classmates.reduce(
      (sum, person) => sum + Number(person.guests || 0),
      0
    );

    const totalPeopleAttending = attending + totalGuests;

    const tshirtQuantity = classmates.reduce(
      (sum, person) => sum + Number(person.tshirt_quantity || 0),
      0
    );

    const classmatesWithTshirts = classmates.filter(
      (person) => Number(person.tshirt_quantity || 0) > 0
    ).length;

    const privacyAccepted = classmates.filter(
      (person) => person.privacy_consent === true
    ).length;

    return {
      total,
      attending,
      notAttending,
      totalGuests,
      totalPeopleAttending,
      tshirtQuantity,
      classmatesWithTshirts,
      privacyAccepted,
    };
  }, [classmates]);

  /*
   * CONTRIBUTION STATISTICS
   *
   * This supports several common column names so the
   * dashboard remains flexible when we create the
   * contribution system.
   */
  const contributionStats = useMemo(() => {
    if (!contributionTableExists || !contributions.length) {
      return {
        expected: 0,
        collected: 0,
        outstanding: 0,
        paid: 0,
        partial: 0,
        unpaid: 0,
      };
    }

    let expected = 0;
    let collected = 0;

    let paid = 0;
    let partial = 0;
    let unpaid = 0;

    contributions.forEach((item) => {
      const expectedAmount = Number(
        item.expected_amount ??
          item.amount_expected ??
          item.total_amount ??
          0
      );

      const amountPaid = Number(
        item.amount_paid ??
          item.paid_amount ??
          item.amount ??
          0
      );

      expected += expectedAmount;
      collected += amountPaid;

      const status = String(item.status || "").toUpperCase();

      if (status === "PAID" || amountPaid >= expectedAmount) {
        paid += 1;
      } else if (status === "PARTIAL" || amountPaid > 0) {
        partial += 1;
      } else {
        unpaid += 1;
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
  }, [contributions, contributionTableExists]);

  const attendancePercentage =
    statistics.total > 0
      ? Math.round(
          (statistics.attending / statistics.total) * 100
        )
      : 0;

  /*
   * T-SHIRT SIZE BREAKDOWN
   */
  const tshirtSizes = useMemo(() => {
    const sizes = {};

    classmates.forEach((person) => {
      const size = person.tshirt_size?.trim();

      if (!size) return;

      const quantity = Number(person.tshirt_quantity || 0);

      if (!sizes[size]) {
        sizes[size] = 0;
      }

      sizes[size] += quantity;
    });

    return Object.entries(sizes).sort(
      ([, a], [, b]) => b - a
    );
  }, [classmates]);

  /*
   * RECENT REGISTRATIONS
   */
  const recentRegistrations = classmates.slice(0, 6);

  if (loading) {
    return (
      <div className="dashboard-page">
        <div
          className="dashboard-loading"
          role="status"
          aria-live="polite"
          aria-label="Loading dashboard data"
        >
          <div className="dashboard-spinner" aria-hidden="true"></div>
          <h2>Loading Dashboard…</h2>
          <p>Connecting to the reunion database.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">

      {/* HEADER */}
      <div className="dashboard-header">
        <div>
          <span className="dashboard-eyebrow" aria-hidden="true">
            CLASS OF 2021 • 5TH ANNIVERSARY
          </span>
          <h1>Reunion Dashboard</h1>
          <p>
            Monitor registrations, attendance, T-shirts,
            contributions and reunion activities from one place.
          </p>
        </div>

        <button
          className="refresh-button"
          onClick={loadDashboard}
          disabled={loading}
          aria-label="Refresh dashboard data"
          aria-busy={loading}
        >
          <RefreshCw size={15} aria-hidden="true" /> Refresh
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <div
          className="dashboard-alert"
          role="alert"
          aria-live="assertive"
        >
          <div>
            <strong>Unable to load some data.</strong>
            <span>{error}</span>
          </div>
          <button onClick={loadDashboard} aria-label="Retry loading dashboard">
            Try Again
          </button>
        </div>
      )}

      {/* LIVE STATUS */}
      <div className="live-status" aria-live="polite" aria-atomic="true">
        <span className="live-dot" aria-hidden="true"></span>
        <span>Live database data</span>
        {lastUpdated && (
          <span className="last-updated">
            Last updated{" "}
            {lastUpdated.toLocaleTimeString("en-GH", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>

      {/* MAIN STATISTICS */}
      <section
        className="stats-grid"
        aria-label="Main registration statistics"
      >
        <div className="stat-card stat-primary" role="figure" aria-label={`Total registered: ${statistics.total} classmates`}>
          <div className="stat-icon" aria-hidden="true"><Users size={22} /></div>
          <div className="stat-content">
            <span>Total Registered</span>
            <strong>{statistics.total}</strong>
            <small>Classmates</small>
          </div>
        </div>

        <div className="stat-card stat-success" role="figure" aria-label={`Attending: ${statistics.attending}, ${attendancePercentage}% of registered`}>
          <div className="stat-icon" aria-hidden="true"><Check size={22} /></div>
          <div className="stat-content">
            <span>Attending</span>
            <strong>{statistics.attending}</strong>
            <small>{attendancePercentage}% of registered</small>
          </div>
        </div>

        <div className="stat-card stat-warning" role="figure" aria-label={`Guests: ${statistics.totalGuests}, ${statistics.totalPeopleAttending} people expected total`}>
          <div className="stat-icon" aria-hidden="true"><UserRound size={22} /></div>
          <div className="stat-content">
            <span>Guests</span>
            <strong>{statistics.totalGuests}</strong>
            <small>{statistics.totalPeopleAttending} people expected</small>
          </div>
        </div>

        <div className="stat-card stat-danger" role="figure" aria-label={`Not attending: ${statistics.notAttending} classmates`}>
          <div className="stat-icon" aria-hidden="true"><X size={22} /></div>
          <div className="stat-content">
            <span>Not Attending</span>
            <strong>{statistics.notAttending}</strong>
            <small>Classmates</small>
          </div>
        </div>
      </section>

      {/* SECONDARY STATISTICS */}
      <section
        className="stats-grid secondary-stats"
        aria-label="Financial and logistics statistics"
      >

        <div className="stat-card">
          <div className="stat-icon" aria-hidden="true"><Wallet size={22} /></div>
          <div className="stat-content">
            <span>Total Collected</span>
            <strong>{formatCurrency(contributionStats.collected)}</strong>
            <small>{contributionTableExists ? "Contribution records" : "Contribution module pending"}</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" aria-hidden="true"><Pin size={22} /></div>
          <div className="stat-content">
            <span>Outstanding</span>
            <strong>{formatCurrency(contributionStats.outstanding)}</strong>
            <small>Remaining balance</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" aria-hidden="true"><Shirt size={22} /></div>
          <div className="stat-content">
            <span>T-Shirts</span>
            <strong>{statistics.tshirtQuantity}</strong>
            <small>{statistics.classmatesWithTshirts} classmates ordered</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" aria-hidden="true"><Ticket size={22} /></div>
          <div className="stat-content">
            <span>Expected Attendance</span>
            <strong>{statistics.totalPeopleAttending}</strong>
            <small>Including guests</small>
          </div>
        </div>

      </section>

      {/* CONTENT GRID */}
      <div className="dashboard-content-grid">

        {/* RECENT REGISTRATIONS */}
        <section className="dashboard-panel recent-panel">

          <div className="panel-header">
            <div>
              <span className="panel-label">
                DATABASE
              </span>

              <h2>Recent Registrations</h2>
            </div>

            <Link
              to="/admin/registrations"
              className="panel-link"
            >
              View All →
            </Link>
          </div>

          {recentRegistrations.length === 0 ? (
            <div className="empty-state">
              <div><Users size={36} aria-hidden="true" /></div>
              <h3>No registrations yet</h3>
              <p>New classmates will appear here after they register.</p>
            </div>
          ) : (
            <div className="registration-list">

              {recentRegistrations.map((person) => (
                <div
                  className="registration-item"
                  key={person.id}
                >
                  <div className="person-avatar">
                    {getInitials(person.full_name)}
                  </div>

                  <div className="person-info">
                    <strong>
                      {person.full_name}
                    </strong>

                    <span>
                      {person.class_id}
                      {person.location
                        ? ` • ${person.location}`
                        : ""}
                    </span>
                  </div>

                  <div className="registration-status">
                    <span
                      className={
                        person.attending
                          ? "badge badge-success"
                          : "badge badge-muted"
                      }
                    >
                      {person.attending
                        ? "Attending"
                        : "Not Attending"}
                    </span>

                    <small>
                      {formatDate(person.created_at)}
                    </small>
                  </div>
                </div>
              ))}

            </div>
          )}

        </section>

        {/* ATTENDANCE */}
        <section className="dashboard-panel">

          <div className="panel-header">
            <div>
              <span className="panel-label">
                ATTENDANCE
              </span>

              <h2>Attendance Overview</h2>
            </div>
          </div>

          <div className="attendance-chart">

            <div
              className="attendance-circle"
              style={{
                "--attendance":
                  `${attendancePercentage}%`,
              }}
            >
              <div>
                <strong>
                  {attendancePercentage}%
                </strong>

                <span>Attending</span>
              </div>
            </div>

            <div className="attendance-details">

              <div className="attendance-detail">
                <span className="detail-dot attending"></span>

                <div>
                  <strong>
                    {statistics.attending}
                  </strong>

                  <span>Attending</span>
                </div>
              </div>

              <div className="attendance-detail">
                <span className="detail-dot not-attending"></span>

                <div>
                  <strong>
                    {statistics.notAttending}
                  </strong>

                  <span>Not attending</span>
                </div>
              </div>

              <div className="attendance-detail">
                <span className="detail-dot guests"></span>

                <div>
                  <strong>
                    {statistics.totalGuests}
                  </strong>

                  <span>Guests</span>
                </div>
              </div>

            </div>

          </div>

        </section>

      </div>

      {/* LOWER GRID */}
      <div className="dashboard-content-grid">

        {/* T-SHIRTS */}
        <section className="dashboard-panel">

          <div className="panel-header">

            <div>
              <span className="panel-label">
                MERCHANDISE
              </span>

              <h2>T-Shirt Orders</h2>
            </div>

            <Link
              to="/admin/tshirts"
              className="panel-link"
            >
              Manage →
            </Link>

          </div>

          {tshirtSizes.length === 0 ? (
            <div className="empty-state compact">
              <div><Shirt size={32} aria-hidden="true" /></div>
              <p>No T-shirt orders have been recorded yet.</p>
            </div>
          ) : (
            <div className="size-list">

              {tshirtSizes.map(([size, quantity]) => (
                <div
                  className="size-row"
                  key={size}
                >
                  <div className="size-name">
                    {size}
                  </div>

                  <div className="size-progress">
                    <div
                      className="size-progress-fill"
                      style={{
                        width: `${
                          statistics.tshirtQuantity
                            ? (quantity /
                                statistics.tshirtQuantity) *
                              100
                            : 0
                        }%`,
                      }}
                    ></div>
                  </div>

                  <strong>
                    {quantity}
                  </strong>
                </div>
              ))}

              <div className="total-row">
                <span>Total T-Shirts</span>
                <strong>
                  {statistics.tshirtQuantity}
                </strong>
              </div>

            </div>
          )}

        </section>

        {/* CONTRIBUTIONS */}
        <section className="dashboard-panel">

          <div className="panel-header">

            <div>
              <span className="panel-label">
                FINANCE
              </span>

              <h2>Contribution Summary</h2>
            </div>

            <Link
              to="/admin/contributions"
              className="panel-link"
            >
              Manage →
            </Link>

          </div>

          {!contributionTableExists ? (
            <div className="module-pending">
              <div className="pending-icon"><Wallet size={28} aria-hidden="true" /></div>

              <h3>
                Contribution Module
              </h3>

              <p>
                The contribution database has not been
                created yet.
              </p>

              <span>
                This section will automatically become live
                once the contribution table is connected.
              </span>

            </div>
          ) : (
            <div className="finance-summary">

              <div className="finance-main">
                <span>Total Collected</span>

                <strong>
                  {formatCurrency(
                    contributionStats.collected
                  )}
                </strong>

                <div className="finance-progress">
                  <div
                    style={{
                      width: `${
                        contributionStats.expected > 0
                          ? Math.min(
                              (contributionStats.collected /
                                contributionStats.expected) *
                                100,
                              100
                            )
                          : 0
                      }%`,
                    }}
                  ></div>
                </div>

                <small>
                  {contributionStats.expected > 0
                    ? `${Math.round(
                        (contributionStats.collected /
                          contributionStats.expected) *
                          100
                      )}% of expected contributions`
                    : "No expected contribution amount set"}
                </small>
              </div>

              <div className="finance-stats">

                <div>
                  <strong>
                    {contributionStats.paid}
                  </strong>

                  <span>Paid</span>
                </div>

                <div>
                  <strong>
                    {contributionStats.partial}
                  </strong>

                  <span>Partial</span>
                </div>

                <div>
                  <strong>
                    {contributionStats.unpaid}
                  </strong>

                  <span>Unpaid</span>
                </div>

              </div>

            </div>
          )}

        </section>

      </div>

      {/* QUICK ACTIONS */}
      <section className="quick-actions-panel">

        <div className="panel-header">
          <div>
            <span className="panel-label">
              ADMINISTRATION
            </span>

            <h2>Quick Actions</h2>
          </div>
        </div>

        <div className="quick-actions">
          <Link to="/admin/registrations" className="quick-action">
            <span><Users size={20} aria-hidden="true" /></span>
            <div>
              <strong>Registrations</strong>
              <small>View and manage classmates</small>
            </div>
          </Link>
          <Link to="/admin/contributions" className="quick-action">
            <span><Wallet size={20} aria-hidden="true" /></span>
            <div>
              <strong>Contributions</strong>
              <small>Track reunion payments</small>
            </div>
          </Link>
          <Link to="/admin/tshirts" className="quick-action">
            <span><Shirt size={20} aria-hidden="true" /></span>
            <div>
              <strong>T-Shirts</strong>
              <small>Manage shirt orders</small>
            </div>
          </Link>
          <Link to="/admin/awards" className="quick-action">
            <span><Trophy size={20} aria-hidden="true" /></span>
            <div>
              <strong>Awards</strong>
              <small>Manage nominations and voting</small>
            </div>
          </Link>
          <Link to="/admin/memories" className="quick-action">
            <span><Camera size={20} aria-hidden="true" /></span>
            <div>
              <strong>Memories</strong>
              <small>Photos, videos and stories</small>
            </div>
          </Link>
          <Link to="/admin/checkin" className="quick-action">
            <span><Ticket size={20} aria-hidden="true" /></span>
            <div>
              <strong>Check-In</strong>
              <small>Scan reunion QR passes</small>
            </div>
          </Link>
        </div>

      </section>

    </div>
  );
}