import "./AdminPages.css";

export default function Checkin() {
  return (
    <div>

      <div className="page-header">

        <div>
          <p className="page-eyebrow">
            EVENT MANAGEMENT
          </p>

          <h1>Event Check-In</h1>

          <p>
            Scan classmates' QR passes when they
            arrive at the reunion.
          </p>
        </div>

      </div>

      <div className="checkin-placeholder">

        <div className="qr-icon">
          ▦
        </div>

        <h2>
          QR Check-In System
        </h2>

        <p>
          Each registered classmate will receive a
          unique digital reunion pass containing a
          QR code.
        </p>

        <button>
          QR Scanner — Coming Soon
        </button>

      </div>

    </div>
  );
}