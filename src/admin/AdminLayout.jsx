import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import "./AdminLayout.css";


export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      navigate("/admin/login");
      return;
    }

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

  async function logout() {
    await supabase.auth.signOut();
    navigate("/admin/login");
  }

  const menu = [
    {
      name: "Dashboard",
      path: "/admin",
      icon: "▦",
    },
    {
      name: "Registrations",
      path: "/admin/registrations",
      icon: "👥",
    },
    {
      name: "Contributions",
      path: "/admin/contributions",
      icon: "💰",
    },
    {
      name: "T-Shirts",
      path: "/admin/tshirts",
      icon: "👕",
    },
    {
      name: "Awards",
      path: "/admin/awards",
      icon: "🏆",
    },
    {
      name: "Memories",
      path: "/admin/memories",
      icon: "📸",
    },
    {
      name: "Check-In",
      path: "/admin/checkin",
      icon: "🎟️",
    },
  ];

  return (
    <div className="admin-layout">

      {/* MOBILE TOP BAR */}
      <div className="admin-topbar">
        <div className="admin-brand-mobile">
          3A12
        </div>

        <button
          className="mobile-menu-button"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* SIDEBAR OVERLAY (mobile) */}
      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`admin-sidebar ${mobileOpen ? "sidebar-open" : ""}`}
      >

        <div className="admin-brand">
          <div className="admin-logo">
            3A12
          </div>

          <div>
            <strong>Reunion</strong>
            <span>Admin Panel</span>
          </div>
        </div>

        <nav className="admin-navigation">

          <p className="navigation-label">
            MANAGEMENT
          </p>

          {menu.map((item) => {

            const active =
              item.path === "/admin"
                ? location.pathname === "/admin"
                : location.pathname.startsWith(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`admin-menu-item ${
                  active ? "active" : ""
                }`}
              >
                <span>{item.icon}</span>
                {item.name}
              </Link>
            );
          })}

          <p className="navigation-label">
            SYSTEM
          </p>

          <Link
            to="/"
            className="admin-menu-item"
          >
            <span>↩</span>
            View Website
          </Link>

        </nav>

        <div className="admin-account">

          <div className="admin-avatar">
            {user?.email?.charAt(0).toUpperCase()}
          </div>

          <div className="admin-account-info">
            <strong>Administrator</strong>
            <span>{user?.email}</span>
          </div>

          <button
            onClick={logout}
            title="Logout"
          >
            ↪
          </button>

        </div>

      </aside>

      <main className="admin-content">
        <Outlet />
      </main>

    </div>
  );
}