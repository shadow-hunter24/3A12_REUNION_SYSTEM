import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./lib/supabase";
import "./App.css";

const REUNION_DATE = new Date("2026-12-31T10:00:00");

function useCountdown(target) {
  const [timeLeft, setTimeLeft] = useState(() =>
    getTimeLeft(target)
  );

  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(getTimeLeft(target));
    }, 1000);

    return () => clearInterval(id);
  }, [target]);

  return timeLeft;
}

function getTimeLeft(target) {
  const diff = Math.max(target - Date.now(), 0);

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function pad(n) {
  return String(n).padStart(2, "0");
}


function App() {
  const countdown = useCountdown(REUNION_DATE);
  const [menuOpen, setMenuOpen] = useState(false);

  // â”€â”€ Public memory wall â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [memories, setMemories]       = useState([]);
  const [memoriesLoading, setMemoriesLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("memories_wall")
      .select("id, memory_text, display_name, is_anonymous, approved_at")
      .order("approved_at", { ascending: false })
      .then(({ data }) => {
        setMemories(data || []);
        setMemoriesLoading(false);
      });
  }, []);

  // Close mobile menu when navigating to a section
  function handleNavClick() {
    setMenuOpen(false);
  }

  return (
    <div className="app">
      {/* Skip navigation link â€” keyboard / screen-reader users */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Navigation */}
      <nav className="navbar" aria-label="Main navigation">
        <div className="logo" aria-label="3A12 Class of 2021">
          <span aria-hidden="true">3A12</span>
          <small>CLASS OF 2021</small>
        </div>

        <div className="nav-links" role="list">
          <a href="#home" role="listitem">Home</a>
          <a href="#about" role="listitem">About</a>
          <a href="#programme" role="listitem">Programme</a>
          <a href="#memories" role="listitem">Memories</a>
          <a href="#contact" role="listitem">Contact</a>
        </div>

        <Link to="/register" className="nav-button">
          Register
        </Link>

        {/* Hamburger â€” mobile only */}
        <button
          className="nav-hamburger"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
        >
          <span aria-hidden="true">{menuOpen ? "âœ•" : "â˜°"}</span>
        </button>
      </nav>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div
          className="mobile-nav-overlay"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <div
        id="mobile-nav"
        className={`mobile-nav${menuOpen ? " mobile-nav-open" : ""}`}
        aria-hidden={!menuOpen}
        role="dialog"
        aria-label="Navigation menu"
      >
        <a href="#home"      onClick={handleNavClick}>Home</a>
        <a href="#about"     onClick={handleNavClick}>About</a>
        <a href="#programme" onClick={handleNavClick}>Programme</a>
        <a href="#memories"  onClick={handleNavClick}>Memories</a>
        <a href="#contact"   onClick={handleNavClick}>Contact</a>
        <Link to="/register" onClick={handleNavClick} className="mobile-nav-register">
          Register for Reunion â†’
        </Link>
      </div>

      {/* Main content landmark */}
      <main id="main-content">

        {/* Hero */}
        <section className="hero" id="home" aria-labelledby="hero-heading">
          <div className="hero-overlay" aria-hidden="true"></div>

          <div className="hero-content">
            <div className="badge" aria-hidden="true">ðŸŽ“ CLASS OF 2021</div>

            <h1 id="hero-heading">
              5th Anniversary
              <span>Reunion</span>
            </h1>

            <p className="hero-theme">
              Different Paths â€¢ One Beginning â€¢ One Family
            </p>

            <p className="hero-description">
              Five years after leaving SHS, we're coming together once again
              to reconnect, remember, celebrate and create new memories.
            </p>

            <div className="hero-buttons">
              <Link to="/register" className="primary-button">
                Register for Reunion â†’
              </Link>

              <Link to="/awards" className="secondary-button">
                <span aria-hidden="true">ðŸ†</span> Awards &amp; Voting
              </Link>

              <a href="#programme" className="secondary-button">
                View Programme
              </a>
            </div>

            <div className="year" aria-label="Class years: 2021 to 2026">
              <span>2021</span>
              <strong aria-hidden="true">â†’</strong>
              <span>2026</span>
            </div>
          </div>
        </section>

        {/* Countdown */}
        <section className="countdown-section" aria-labelledby="countdown-heading">
          <p id="countdown-heading">THE COUNTDOWN IS ON</p>

          {/* aria-live so screen readers announce updates periodically */}
          <div
            className="countdown"
            aria-live="polite"
            aria-atomic="true"
            aria-label={`Time until reunion: ${countdown.days} days, ${countdown.hours} hours, ${countdown.minutes} minutes, ${countdown.seconds} seconds`}
          >
            <div aria-hidden="true">
              <strong>{pad(countdown.days)}</strong>
              <span>Days</span>
            </div>
            <div aria-hidden="true">
              <strong>{pad(countdown.hours)}</strong>
              <span>Hours</span>
            </div>
            <div aria-hidden="true">
              <strong>{pad(countdown.minutes)}</strong>
              <span>Minutes</span>
            </div>
            <div aria-hidden="true">
              <strong>{pad(countdown.seconds)}</strong>
              <span>Seconds</span>
            </div>
          </div>
        </section>

        {/* About */}
        <section className="section about" id="about" aria-labelledby="about-heading">
          <div className="section-label" aria-hidden="true">OUR STORY</div>

          <h2 id="about-heading">
            Five Years Later,
            <br />
            <span>We're Still One Class.</span>
          </h2>

          <p>
            We entered SHS as young students with different dreams.
            In 2021, we left as classmates ready to face the world.
            Today, after five incredible years, we are coming together
            to celebrate how far we've travelled and the people we've become.
          </p>

          <div className="stats" role="list" aria-label="Class statistics">
            <div className="stat" role="listitem">
              <strong>2021</strong>
              <span>Graduation Year</span>
            </div>
            <div className="stat" role="listitem">
              <strong>5</strong>
              <span>Years Later</span>
            </div>
            <div className="stat" role="listitem">
              <strong>1</strong>
              <span>Class Family</span>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="section features" aria-labelledby="features-heading">
          <div className="section-label" aria-hidden="true">WHAT TO EXPECT</div>

          <h2 id="features-heading">
            More Than Just
            <br />
            <span>A Get-Together.</span>
          </h2>

          <div className="feature-grid" role="list">
            <article className="feature-card" role="listitem">
              <div className="feature-icon" aria-hidden="true">ðŸ¤</div>
              <h3>Reconnect</h3>
              <p>Meet old friends, classmates and teachers after five years apart.</p>
            </article>

            <article className="feature-card" role="listitem">
              <div className="feature-icon" aria-hidden="true">ðŸ“¸</div>
              <h3>Create Memories</h3>
              <p>Capture new moments and relive some of our best SHS memories.</p>
            </article>

            <article className="feature-card" role="listitem">
              <div className="feature-icon" aria-hidden="true">ðŸ†</div>
              <h3>Celebrate</h3>
              <p>Celebrate the achievements and journeys of our classmates.</p>
            </article>

            <article className="feature-card" role="listitem">
              <div className="feature-icon" aria-hidden="true">ðŸ’¼</div>
              <h3>Network</h3>
              <p>Build professional, business and personal connections.</p>
            </article>
          </div>
        </section>

        {/* Programme */}
        <section className="section programme" id="programme" aria-labelledby="programme-heading">
          <div className="section-label" aria-hidden="true">EVENT PROGRAMME</div>

          <h2 id="programme-heading">
            A Day To
            <br />
            <span>Remember.</span>
          </h2>

          <ol className="timeline" aria-label="Event schedule">
            <li className="timeline-item">
              <span>10:00 AM</span>
              <div>
                <h3>Arrival &amp; Registration</h3>
                <p>Welcome, check-in and networking.</p>
              </div>
            </li>
            <li className="timeline-item">
              <span>11:00 AM</span>
              <div>
                <h3>Opening Ceremony</h3>
                <p>Prayer, welcome address and introductions.</p>
              </div>
            </li>
            <li className="timeline-item">
              <span>12:00 PM</span>
              <div>
                <h3>SHS Memories &amp; Games</h3>
                <p>Trivia, old pictures, stories and fun activities.</p>
              </div>
            </li>
            <li className="timeline-item">
              <span>1:00 PM</span>
              <div>
                <h3>Lunch &amp; Networking</h3>
                <p>Good food, conversations and connections.</p>
              </div>
            </li>
            <li className="timeline-item">
              <span>3:00 PM</span>
              <div>
                <h3>Awards &amp; Recognition</h3>
                <p>Celebrating classmates and our teachers.</p>
              </div>
            </li>
            <li className="timeline-item">
              <span>4:00 PM</span>
              <div>
                <h3>Music, Dance &amp; Photography</h3>
                <p>Let's make some unforgettable memories.</p>
              </div>
            </li>
          </ol>
        </section>

        {/* Registration CTA */}
        <section className="register-section" id="register" aria-labelledby="register-heading">
          <div>
            <div className="section-label" aria-hidden="true">CLASS OF 2021</div>

            <h2 id="register-heading">
              Your Seat
              <br />
              <span>Is Waiting.</span>
            </h2>

            <p>
              Be part of the reunion. Register now and let's make the
              5th anniversary one to remember.
            </p>

            <Link to="/register" className="primary-button">
              Register Now â†’
            </Link>
          </div>
        </section>

        {/* Memories */}
        <section className="section memories" id="memories" aria-labelledby="memories-heading">
          <div className="section-label" aria-hidden="true">MEMORIES</div>

          <h2 id="memories-heading">
            Then &amp; Now
            <br />
            <span>2021 â†’ 2026</span>
          </h2>

          {memoriesLoading ? (
            <div className="memory-placeholder" role="status" aria-live="polite">
              <div aria-hidden="true">ðŸ’­</div>
              <h3>Loading Memoriesâ€¦</h3>
            </div>
          ) : memories.length === 0 ? (
            <div className="memory-placeholder" role="region" aria-label="Memory wall â€” no entries yet">
              <div aria-hidden="true">ðŸ“·</div>
              <h3>Our Memories Will Live Here</h3>
              <p>
                Approved memories from the Class of 2021 will appear here.
              </p>
            </div>
          ) : (
            <div className="memory-wall-grid" role="list" aria-label="Class memory wall">
              {memories.map((m) => (
                <article
                  key={m.id}
                  className="memory-wall-card"
                  role="listitem"
                  aria-label={`Memory from ${m.is_anonymous ? "Anonymous" : m.display_name}`}
                >
                  <div className="memory-wall-quote" aria-hidden="true">"</div>
                  <p className="memory-wall-text">{m.memory_text}</p>
                  <div className="memory-wall-author">
                    {m.is_anonymous
                      ? <em>â€” Anonymous</em>
                      : <span>â€” {m.display_name}</span>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

      </main>

      {/* Footer */}
      <footer id="contact" aria-label="Site footer">
        <div className="footer-logo" aria-label="3A12 Class of 2021">
          <strong aria-hidden="true">3A12</strong>
          <span>CLASS OF 2021</span>
        </div>

        <p>Different Paths â€¢ One Beginning â€¢ One Family</p>

        <div className="footer-bottom">
          <small>Â© 2026 Class of 2021 Reunion. All rights reserved.</small>
        </div>
      </footer>
    </div>
  );
}

export default App;
