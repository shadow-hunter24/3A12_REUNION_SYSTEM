import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import "./AdminLogin.css";

export default function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  // Counts failed attempts — show helpful hint after 2 failures
  const [attempts, setAttempts] = useState(0);

  // Focus the email field on mount for efficiency
  const emailRef = useRef(null);
  useEffect(() => { emailRef.current?.focus(); }, []);

  // Move focus to the error banner when it appears
  const errorRef = useRef(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: loginError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (loginError) {
      setLoading(false);
      setAttempts((n) => n + 1);

      // Map common Supabase auth error codes to friendly messages
      const msg = loginError.message?.toLowerCase() || "";
      if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
        setError("The email or password you entered is incorrect. Please try again.");
      } else if (msg.includes("email not confirmed")) {
        setError("Your email address has not been confirmed. Please check your inbox.");
      } else if (msg.includes("too many requests") || msg.includes("rate limit")) {
        setError("Too many login attempts. Please wait a few minutes before trying again.");
      } else {
        setError("Sign-in failed. Please check your connection and try again.");
      }
      return;
    }

    // Verify the authenticated user is an admin
    const { data: admin, error: adminError } = await supabase
      .from("admin_users")
      .select("email")
      .eq("email", data.user.email)
      .maybeSingle();

    if (adminError || !admin) {
      await supabase.auth.signOut();
      setLoading(false);
      setAttempts((n) => n + 1);
      setError(
        "This account is not authorised to access the admin panel. " +
        "If you believe this is an error, contact the system administrator."
      );
      return;
    }

    navigate("/admin");
  }

  return (
    <div className="admin-login-page">
      <div
        className="admin-login-card"
        role="main"
        aria-labelledby="login-heading"
      >

        <Link to="/" className="login-logo" aria-label="Go back to reunion home page">
          3A12
        </Link>

        <p className="login-eyebrow" aria-hidden="true">CLASS OF 2021</p>

        <h1 id="login-heading">Admin Portal</h1>

        <p className="login-description">
          Sign in to manage reunion registrations,
          attendance and other class activities.
        </p>

        {/* Error banner — receives focus so screen readers announce it */}
        {error && (
          <div
            className="login-error"
            role="alert"
            aria-live="assertive"
            tabIndex={-1}
            ref={errorRef}
          >
            <span className="login-error-icon" aria-hidden="true">⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* Hint after multiple failures */}
        {attempts >= 2 && !error && (
          <div className="login-hint" role="note" aria-live="polite">
            Having trouble? Make sure Caps Lock is off and you're using the
            correct admin credentials.
          </div>
        )}

        <form onSubmit={handleLogin} noValidate aria-label="Admin sign-in form">

          <div className="login-field">
            <label htmlFor="admin-email">Email Address</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              autoComplete="email"
              aria-required="true"
              aria-describedby={error ? "login-error-msg" : undefined}
              ref={emailRef}
            />
          </div>

          <div className="login-field">
            <label htmlFor="admin-password">Password</label>
            <div className="password-wrapper">
              <input
                id="admin-password"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                aria-required="true"
              />
              <button
                type="button"
                className="show-pwd-btn"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? "Hide password" : "Show password"}
                aria-pressed={showPwd}
              >
                {showPwd ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <>
                <span className="login-spinner" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              "Sign In →"
            )}
          </button>

        </form>

        <div className="login-footer">
          <Link to="/">← Return to reunion website</Link>
          <span>Authorised administrators only</span>
        </div>

      </div>
    </div>
  );
}
