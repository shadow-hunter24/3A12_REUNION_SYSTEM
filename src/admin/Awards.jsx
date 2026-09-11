import "./AdminPages.css";

export default function Awards() {
  return (
    <div>

      <div className="page-header">

        <div>
          <p className="page-eyebrow">
            CLASS AWARDS
          </p>

          <h1>Awards & Voting</h1>

          <p>
            Create award categories and manage
            nominations and voting.
          </p>
        </div>

      </div>

      <div className="feature-grid">

        <div className="feature-card">
          <div>🏆</div>

          <h3>Award Categories</h3>

          <p>
            Create awards such as Most Successful,
            Most Supportive, Class Clown and more.
          </p>

          <button>
            Coming Soon
          </button>
        </div>

        <div className="feature-card">
          <div>🗳️</div>

          <h3>Nominations</h3>

          <p>
            Allow classmates to nominate candidates
            for each award.
          </p>

          <button>
            Coming Soon
          </button>
        </div>

        <div className="feature-card">
          <div>📊</div>

          <h3>Voting</h3>

          <p>
            Secure voting with one vote per
            classmate where required.
          </p>

          <button>
            Coming Soon
          </button>
        </div>

      </div>

    </div>
  );
}