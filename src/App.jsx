import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { GraduationCap, Handshake, Camera, Trophy, Briefcase, ImageIcon, Menu, X } from "lucide-react";
import "./App.css";

// ── Fallback values (used until DB loads or if DB is empty) ───
const FALLBACK = {
  event_name:       "5th Anniversary Reunion",
  event_tagline:    "Different Paths • One Beginning • One Family",
  event_date:       "2026-12-31T10:00:00",
  event_venue:      "",
  hero_description: "Five years after leaving SHS, we're coming together once again to reconnect, remember, celebrate and create new memories.",
  about_copy:       "We entered SHS as young students with different dreams. In 2021, we left as classmates ready to face the world. Today, after five incredible years, we are coming together to celebrate how far we've travelled and the people we've become.",
  footer_copyright: "© 2026 Class of 2021 Reunion. All rights reserved.",
  registration_open: "true",
};

const FALLBACK_PROGRAMME = [
  { id: "1", time_label: "10:00 AM", title: "Arrival & Registration",     description: "Welcome, check-in and networking." },
  { id: "2", time_label: "11:00 AM", title: "Opening Ceremony",           description: "Prayer, welcome address and introductions." },
  { id: "3", time_label: "12:00 PM", title: "SHS Memories & Games",       description: "Trivia, old pictures, stories and fun activities." },
  { id: "4", time_label: "1:00 PM",  title: "Lunch & Networking",         description: "Good food, conversations and connections." },
  { id: "5", time_label: "3:00 PM",  title: "Awards & Recognition",       description: "Celebrating classmates and our teachers." },
  { id: "6", time_label: "4:00 PM",  title: "Music, Dance & Photography", description: "Let's make some unforgettable memories." },
];

function useCountdown(target) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(target));

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  return timeLeft;
}

function getTimeLeft(target) {
  const diff = Math.max(target - Date.now(), 0);
  return {
    days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours:   Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  // ── Site settings from DB ─────────────────────────────────
  const [cfg, setCfg]             = useState(FALLBACK);
  const [programme, setProgramme] = useState(FALLBACK_PROGRAMME);

  // ── Public memory wall ────────────────────────────────────
  const [memories,        setMemories]        = useState([]);
  const [memoriesLoading, setMemoriesLoading] = useState(true);

  useEffect(() => {
    // Load site settings + programme + memories in parallel
    Promise.all([
      supabase.from("site_settings").select("key, value"),
      supabase.from("programme_items").select("*").order("sort_order"),
      supabase.from("memories_wall")
        .select("id, memory_text, display_name, is_anonymous, approved_at")
        .order("approved_at", { ascending: false }),
    ]).then(([{ data: sData }, { data: pData }, { data: mData }]) => {
      if (sData?.length) {
        const map = {};
        sData.forEach(({ key, value }) => { map[key] = value; });
        setCfg((prev) => ({ ...prev, ...map }));
      }
      if (pData?.length) setProgramme(pData);
      setMemories(mData || []);
      setMemoriesLoading(false);
    });
  }, []);

  const reunionDate = new Date(cfg.event_date || FALLBACK.event_date);
  const countdown   = useCountdown(reunionDate);

  // Close mobile menu when navigating to a section
  function handleNavClick() {
    setMenuOpen(false);
  }

  return (
    <div className="app">
      {/* Skip navigation link – keyboard / screen-reader users */}
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

        {/* Hamburger – mobile only */}
        <button
          className="nav-hamburger"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
        >
          <span aria-hidden="true">{menuOpen ? <X size={20} /> : <Menu size={20} />}</span>
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
          Register for Reunion →
        </Link>
      </div>

      {/* Main content landmark */}
      <main id="main-content">

        {/* Hero */}
        <section className="hero" id="home" aria-labelledby="hero-heading">
          <div className="hero-overlay" aria-hidden="true"></div>

          <div className="hero-content">
            <div className="badge" aria-hidden="true"><GraduationCap size={18} aria-hidden="true" /> CLASS OF 2021</div>

            <h1 id="hero-heading">
              {cfg.event_name}
            </h1>

            <p className="hero-theme">
              {cfg.event_tagline}
            </p>

            <p className="hero-description">
              {cfg.hero_description}
            </p>

            {cfg.event_venue && (
              <p className="hero-venue">
                <strong>Venue:</strong> {cfg.event_venue}
              </p>
            )}

            <div className="hero-buttons">
              <Link to="/register" className="primary-button">
                Register for Reunion →
              </Link>

              <Link to="/awards" className="secondary-button">
                <Trophy size={16} aria-hidden="true" /> Awards &amp; Voting
              </Link>

              <a href="#programme" className="secondary-button">
                View Programme
              </a>
            </div>

            <div className="year" aria-label="Class years: 2021 to 2026">
              <span>2021</span>
              <strong aria-hidden="true">→</strong>
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
            {cfg.about_copy}
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
              <div className="feature-icon" aria-hidden="true"><Handshake size={24} aria-hidden="true" /></div>
              <h3>Reconnect</h3>
              <p>Meet old friends, classmates and teachers after five years apart.</p>
            </article>

            <article className="feature-card" role="listitem">
              <div className="feature-icon" aria-hidden="true"><Camera size={24} aria-hidden="true" /></div>
              <h3>Create Memories</h3>
              <p>Capture new moments and relive some of our best SHS memories.</p>
            </article>

            <article className="feature-card" role="listitem">
              <div className="feature-icon" aria-hidden="true"><Trophy size={24} aria-hidden="true" /></div>
              <h3>Celebrate</h3>
              <p>Celebrate the achievements and journeys of our classmates.</p>
            </article>

            <article className="feature-card" role="listitem">
              <div className="feature-icon" aria-hidden="true"><Briefcase size={24} aria-hidden="true" /></div>
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
            {programme.map((item) => (
              <li key={item.id} className="timeline-item">
                <span>{item.time_label}</span>
                <div>
                  <h3>{item.title}</h3>
                  {item.description && <p>{item.description}</p>}
                </div>
              </li>
            ))}
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
              Register Now →
            </Link>
          </div>
        </section>

        {/* Memories */}
        <section className="section memories" id="memories" aria-labelledby="memories-heading">
          <div className="section-label" aria-hidden="true">MEMORIES</div>

          <h2 id="memories-heading">
            Then &amp; Now
            <br />
            <span>2021 → 2026</span>
          </h2>

          {memoriesLoading ? (
            <div className="memory-placeholder" role="status" aria-live="polite">
              <div aria-hidden="true"><ImageIcon size={28} aria-hidden="true" /></div>
              <h3>Loading Memories…</h3>
            </div>
          ) : memories.length === 0 ? (
            <div className="memory-placeholder" role="region" aria-label="Memory wall — no entries yet">
              <div aria-hidden="true"><Camera size={28} aria-hidden="true" /></div>
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
                      ? <em>— Anonymous</em>
                      : <span>— {m.display_name}</span>}
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

        <p>{cfg.event_tagline}</p>

        <div className="footer-bottom">
          <small>{cfg.footer_copyright}</small>
        </div>
      </footer>
    </div>
  );
}

export default App;
