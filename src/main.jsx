import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import "./index.css";

import App from "./App.jsx";
import Register from "./Register.jsx";
import AdminLogin from "./AdminLogin.jsx";

import AdminLayout from "./admin/AdminLayout.jsx";
import Dashboard from "./admin/Dashboard.jsx";
import Registrations from "./admin/Registrations.jsx";
import Contributions from "./admin/Contributions.jsx";
import Tshirts from "./admin/Tshirts.jsx";
import Awards from "./admin/AdminAwards.jsx";
import Memories from "./admin/Memories.jsx";
import Checkin from "./admin/Checkin.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>

      <Routes>

        {/* PUBLIC WEBSITE */}

        <Route
          path="/"
          element={<App />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        {/* ADMIN LOGIN */}

        <Route
          path="/admin/login"
          element={<AdminLogin />}
        />

        {/* ADMIN SYSTEM */}

        <Route
          path="/admin"
          element={<AdminLayout />}
        >

          <Route index element={<Dashboard />} />

          <Route
            path="registrations"
            element={<Registrations />}
          />

          <Route
            path="contributions"
            element={<Contributions />}
          />

          <Route
            path="tshirts"
            element={<Tshirts />}
          />

          <Route
            path="awards"
            element={<Awards />}
          />

          <Route
            path="memories"
            element={<Memories />}
          />

          <Route
            path="checkin"
            element={<Checkin />}
          />

        </Route>

      </Routes>

    </BrowserRouter>
  </StrictMode>
);