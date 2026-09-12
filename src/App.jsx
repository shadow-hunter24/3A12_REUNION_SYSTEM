import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
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

  // Close mobile menu when navigating to a section
  function handleNavClick() {
    setMenuOpen(false);
  }

  return (
    <div className="app">
      {/* Navigation */}
      <nav className="navbar">
        <div className="logo">
          <span>3A12</span>
          <small>CLASS OF 2021</small>
        </div>

        <div className="nav-links">
          <a href="#home">Home</a>
          <a href="#about">About</a>
          <a href="#programme">Programme</a>
          <a href="#memories">Memories</a>
          <a href="#contact">Contact</a>
        </div>

        <Link to="/register" className="nav-button">
          Register
        </Link>

        {/* Hamburger — mobile only */}
        <button
          className="nav-hamburger"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </nav>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div
          className="mobile-nav-overlay"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div className={`mobile-nav${menuOpen ? " mobile-nav-open" : ""}`}>
        <a href="#home"      onClick={handleNavClick}>Home</a>
        <a href="#about"     onClick={handleNavClick}>About</a>
        <a href="#programme" onClick={handleNavClick}>Programme</a>
        <a href="#memories"  onClick={handleNavClick}>Memories</a>
        <a href="#contact"   onClick={handleNavClick}>Contact</a>
        <Link to="/register" onClick={handleNavClick} className="mobile-nav-register">
          Register for Reunion →
        </Link>
      </div>

      {/* Hero */}
      <section className="hero" id="home">
        <div className="hero-overlay"></div>

        <div className="hero-content">
          <div className="badge">🎓 CLASS OF 2021</div>

          <h1>
            5th Anniversary
            <span>Reunion</span>
          </h1>

          <p className="hero-theme">
            Different Paths • One Beginning • One Family
          </p>

          <p className="hero-description">
            Five years after leaving SHS, we're coming together once again
            to reconnect, remember, celebrate and create new memories.
          </p>

          <div className="hero-buttons">
            <Link to="/register" className="primary-button">
              Register for Reunion →
            </Link>

            <a href="#programme" className="secondary-button">
              View Programme
            </a>
          </div>

          <div className="year">
            <span>2021</span>
            <strong>→</strong>
            <span>2026</span>
          </div>
        </div>
      </section>

      {/* Countdown */}
      <section className="countdown-section">
        <p>THE COUNTDOWN IS ON</p>

        <div className="countdown">
          <div>
            <strong>{pad(countdown.days)}</strong>
            <span>Days</span>
          </div>

          <div>
            <strong>{pad(countdown.hours)}</strong>
            <span>Hours</span>
          </div>

          <div>
            <strong>{pad(countdown.minutes)}</strong>
            <span>Minutes</span>
          </div>

          <div>
            <strong>{pad(countdown.seconds)}</strong>
            <span>Seconds</span>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="section about" id="about">
        <div className="section-label">OUR STORY</div>

        <h2>
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

        <div className="stats">
          <div className="stat">
            <strong>2021</strong>
            <span>Graduation Year</span>
          </div>

          <div className="stat">
            <strong>5</strong>
            <span>Years Later</span>
          </div>

          <div className="stat">
            <strong>1</strong>
            <span>Class Family</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section features">
        <div className="section-label">WHAT TO EXPECT</div>

        <h2>
          More Than Just
          <br />
          <span>A Get-Together.</span>
        </h2>

        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">🤝</div>
            <h3>Reconnect</h3>
            <p>
              Meet old friends, classmates and teachers after five years apart.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📸</div>
            <h3>Create Memories</h3>
            <p>
              Capture new moments and relive some of our best SHS memories.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🏆</div>
            <h3>Celebrate</h3>
            <p>
              Celebrate the achievements and journeys of our classmates.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">💼</div>
            <h3>Network</h3>
            <p>
              Build professional, business and personal connections.
            </p>
          </div>
        </div>
      </section>

      {/* Programme */}
      <section className="section programme" id="programme">
        <div className="section-label">EVENT PROGRAMME</div>

        <h2>
          A Day To
          <br />
          <span>Remember.</span>
        </h2>

        <div className="timeline">
          <div className="timeline-item">
            <span>10:00 AM</span>
            <div>
              <h3>Arrival & Registration</h3>
              <p>Welcome, check-in and networking.</p>
            </div>
          </div>

          <div className="timeline-item">
            <span>11:00 AM</span>
            <div>
              <h3>Opening Ceremony</h3>
              <p>Prayer, welcome address and introductions.</p>
            </div>
          </div>

          <div className="timeline-item">
            <span>12:00 PM</span>
            <div>
              <h3>SHS Memories & Games</h3>
              <p>Trivia, old pictures, stories and fun activities.</p>
            </div>
          </div>

          <div className="timeline-item">
            <span>1:00 PM</span>
            <div>
              <h3>Lunch & Networking</h3>
              <p>Good food, conversations and connections.</p>
            </div>
          </div>

          <div className="timeline-item">
            <span>3:00 PM</span>
            <div>
              <h3>Awards & Recognition</h3>
              <p>Celebrating classmates and our teachers.</p>
            </div>
          </div>

          <div className="timeline-item">
            <span>4:00 PM</span>
            <div>
              <h3>Music, Dance & Photography</h3>
              <p>Let's make some unforgettable memories.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Registration */}
      <section className="register-section" id="register">
        <div>
          <div className="section-label">CLASS OF 2021</div>

          <h2>
            Your Seat
            <br />
            <span>Is Waiting.</span>
          </h2>

          <p>
            Be part of the reunion. Register now and let's make the
            5th anniversary one to remember.
          </p>

          <Link to="/register" className="primary-button">
            Register Now →
          </Link>
        </div>
      </section>

      {/* Memories */}
      <section className="section memories" id="memories">
        <div className="section-label">MEMORIES</div>

        <h2>
          Then & Now
          <br />
          <span>2021 → 2026</span>
        </h2>

        <div className="memory-placeholder">
          <div>📷</div>
          <h3>Our Memories Will Live Here</h3>
          <p>
            Photos and videos submitted by members of the Class of 2021
            will appear here.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact">
        <div className="footer-logo">
          <strong>3A12</strong>
          <span>CLASS OF 2021</span>
        </div>

        <p>
          Different Paths • One Beginning • One Family
        </p>

        <div className="footer-bottom">
          © 2026 Class of 2021 Reunion. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

export default App;