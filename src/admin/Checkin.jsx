import "./AdminPages.css";

export default function Checkin() {
  return (
    <div>

      <div className="page-header">
        <div>
          <p className="page-eyebrow">EVENT MANAGEMENT</p>
          <h1>Event Check-In</h1>
          <p>
            Scan classmates' QR passes when they arrive at the reunion.
          </p>
        </div>
      </div>

      {/* Status notice */}
      <div
        className="memories-notice"
        role="note"
        aria-label="Module status notice"
      >
        <span aria-hidden="true">ℹ </span>
        The QR Check-In scanner will be activated closer to the event date.
        Each registered classmate will receive a unique digital pass via WhatsApp.
      </div>

      <div
        className="checkin-placeholder"
        role="region"
        aria-labelledby="checkin-heading"
      >
        <div
          className="qr-icon"
          aria-hidden="true"
        >
          ▦
        </div>

        <h2 id="checkin-heading">QR Check-In System</h2>

        <p>
          Each registered classmate will receive a unique digital reunion
          pass containing a QR code. Scan it at the door for instant
          check-in and attendance tracking.
        </p>

        <dl className="checkin-info-grid">
          <div>
            <dt>How it works</dt>
            <dd>
              Classmates present their QR pass on arrival. The scanner
              verifies their registration and marks them as checked in.
            </dd>
          </div>
          <div>
            <dt>Who receives a pass</dt>
            <dd>
              Every classmate who completes registration receives a
              personalised pass with their name and Classmate ID.
            </dd>
          </div>
          <div>
            <dt>Guest check-in</dt>
            <dd>
              Guests are checked in alongside the registered classmate
              using the same pass.
            </dd>
          </div>
          <div>
            <dt>Data privacy</dt>
            <dd>
              Check-in data is used only to track attendance for catering
              and seating purposes, consistent with the consent given at
              registration.
            </dd>
          </div>
        </dl>

        <button
          disabled
          aria-disabled="true"
          aria-label="QR Scanner — coming soon"
          className="checkin-coming-soon-btn"
        >
          QR Scanner — Coming Soon
        </button>
      </div>

    </div>
  );
}
