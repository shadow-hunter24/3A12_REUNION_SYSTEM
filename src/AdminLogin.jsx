import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import "./AdminLogin.css";

export default function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();

    setError("");
    setLoading(true);

    const { data, error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (loginError) {
      setLoading(false);
      setError("Invalid email or password.");
      return;
    }

    // Make sure the authenticated user is actually an admin.
    const { data: admin, error: adminError } = await supabase
      .from("admin_users")
      .select("email")
      .eq("email", data.user.email)
      .maybeSingle();

    if (adminError || !admin) {
      await supabase.auth.signOut();

      setLoading(false);
      setError("This account is not authorized to access the admin panel.");
      return;
    }

    navigate("/admin");
  }

  return (
    <div className="admin-login-page">

      <div className="admin-login-card">

        <Link to="/" className="login-logo">
          3A12
        </Link>

        <p className="login-eyebrow">
          CLASS OF 2021
        </p>

        <h1>Admin Portal</h1>

        <p className="login-description">
          Sign in to manage reunion registrations,
          attendance and other class activities.
        </p>

        {error && (
          <div className="login-error">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>

          <div className="login-field">
            <label>Email Address</label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="login-field">
            <label>Password</label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? "Signing In..." : "Sign In →"}
          </button>

        </form>

        <div className="login-footer">
          <Link to="/">
            ← Return to reunion website
          </Link>

          <span>
            Authorized administrators only
          </span>
        </div>

      </div>

    </div>
  );
}