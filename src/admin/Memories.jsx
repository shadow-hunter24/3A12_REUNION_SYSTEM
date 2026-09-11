import "./AdminPages.css";

export default function Memories() {
  return (
    <div>

      <div className="page-header">

        <div>
          <p className="page-eyebrow">
            MEMORY ARCHIVE
          </p>

          <h1>Photos & Memories</h1>

          <p>
            Manage photos, videos and memorable
            moments from the Class of 2021.
          </p>
        </div>

      </div>

      <div className="feature-grid">

        <div className="feature-card">
          <div>📸</div>
          <h3>Class Photos</h3>
          <p>
            Upload and organize class photographs.
          </p>
          <button>Coming Soon</button>
        </div>

        <div className="feature-card">
          <div>🎥</div>
          <h3>Videos</h3>
          <p>
            Store reunion and school memories.
          </p>
          <button>Coming Soon</button>
        </div>

        <div className="feature-card">
          <div>💭</div>
          <h3>Memory Wall</h3>
          <p>
            Display stories and messages from
            classmates.
          </p>
          <button>Coming Soon</button>
        </div>

      </div>

    </div>
  );
}