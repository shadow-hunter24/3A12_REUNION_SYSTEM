import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  LayoutDashboard, Users, Wallet, Shirt, Trophy,
  Camera, Ticket, Globe, Menu, X, LogOut,
} from "lucide-react";
import "./AdminLayout.css";

const menu = [
  { name: "Dashboard",     path: "/admin",               Icon: LayoutDashboard },
  { name: "Registrations", path: "/admin/registrations", Icon: Users },
  { name: "Contributions", path: "/admin/contributions", Icon: Wallet },
  { name: "T-Shirts",      path: "/admin/tshirts",       Icon: Shirt },
  { name: "Awards",        path: "/admin/awards",        Icon: Trophy },
  { name: "Memories",      path: "/admin/memories",      Icon: Camera },
  { name: "Check-In",      path: "/admin/checkin",       Icon: Ticket },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const [user, setUser]           = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Logout confirmation state (replaces browser confirm dialog)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const logoutConfirmRef = useRef(null);

  useEffect(() => { checkUser(); }, []);

  // Close mobile menu on navigation
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // Move focus into logout dialog when it opens
  useEffect(() => {
    if (showLogoutConfirm) logoutConfirmRef.current?.focus();
  }, [showLogoutConfirm]);

  // Escape closes mobile sidebar and logout dialog
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") {
        if (showLogoutConfirm) { setShowLogoutConfirm(false); return; }
        if (mobileOpen) setMobileOpen(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showLogoutConfirm, mobileOpen]);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/admin/login"); return; }

    const { data: admin } = await supabase
      .from("admin_users")
      .select("email")
      .eq("email", user.email)
      .maybeSingle();

    if (!admin) {
      await supabase.auth.signOut();
      navigate("/admin/login");
      return;
    }
    setUser(user);
  }

  async function doLogout() {
    await supabase.auth.signOut();
    navigate("/admin/login");
  }

  // Active check helper
  function isActive(path) {
    return path === "/admin"
      ? location.pathname === "/admin"
      : location.pathname.startsWith(path);
  }

  return (
    <div className="admin-layout">

      {/* ── MOBILE TOP BAR ── */}
      <div className="admin-topbar" role="banner">
        <div className="admin-brand-mobile" aria-hidden="true">3A12</div>
        <button
          className="mobile-menu-button"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileOpen}
          aria-controls="admin-sidebar"
        >
          <span aria-hidden="true">
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </span>
        </button>
      </div>

      {/* ── SIDEBAR OVERLAY (mobile) ── */}
      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside
        id="admin-sidebar"
        className={`admin-sidebar ${mobileOpen ? "sidebar-open" : ""}`}
        aria-label="Admin navigation"
        aria-hidden={!mobileOpen && window.innerWidth <= 800 ? true : undefined}
      >
        <div className="admin-brand" aria-label="3A12 Reunion Admin Panel">
          <div className="admin-logo" aria-hidden="true">3A12</div>
          <div>
            <strong>Reunion</strong>
            <span>Admin Panel</span>
          </div>
        </div>

        <nav className="admin-navigation" aria-label="Admin menu">
          <p className="navigation-label" aria-hidden="true">MANAGEMENT</p>

          {menu.map(({ name, path, Icon }) => (
            <Link
              key={path}
              to={path}
              className={`admin-menu-item ${isActive(path) ? "active" : ""}`}
              aria-current={isActive(path) ? "page" : undefined}
            >
              <Icon size={16} aria-hidden="true" />
              {name}
            </Link>
          ))}

          <p className="navigation-label" aria-hidden="true">SYSTEM</p>

          <Link to="/" className="admin-menu-item">
            <Globe size={16} aria-hidden="true" />
            View Website
          </Link>
        </nav>

        <div className="admin-account">
          <div
            className="admin-avatar"
            aria-label={`Signed in as ${user?.email || "Administrator"}`}
            aria-hidden="true"
          >
            {user?.email?.charAt(0).toUpperCase() ?? "A"}
          </div>

          <div className="admin-account-info">
            <strong>Administrator</strong>
            <span title={user?.email}>{user?.email}</span>
          </div>

          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="admin-logout-btn"
            aria-label="Sign out of admin panel"
            title="Sign out"
          >
            <LogOut size={18} aria-hidden="true" />
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="admin-content" id="admin-main-content">
        <Outlet />
      </main>

      {/* ── LOGOUT CONFIRMATION DIALOG ── */}
      {showLogoutConfirm && (
        <div
          className="logout-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-dialog-heading"
          onClick={(e) => {
            // Close when clicking outside the card
            if (e.target === e.currentTarget) setShowLogoutConfirm(false);
          }}
        >
          <div className="logout-card">
            <h2 id="logout-dialog-heading">Sign Out?</h2>
            <p>You will be returned to the login page. Any unsaved changes may be lost.</p>
            <div className="logout-actions">
              <button
                className="admin-secondary-button"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button
                ref={logoutConfirmRef}
                className="admin-primary-button logout-confirm-btn"
                onClick={doLogout}
              >
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
