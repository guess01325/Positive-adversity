import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import logo from "../assets/logo.png";
const linkClasses = ({ isActive }) =>
  `rounded-xl px-4 py-2 text-sm font-medium ${
    isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200"
  }`;

export default function Layout() {
  const { user, role, isAdmin, logout } = useAuth();
  const displayName = user?.displayName || user?.email || "Not signed in";
  const email = user?.email || "";
  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100">
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
  <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">

    {/* LEFT SIDE */}
    <div className="flex items-center gap-3">
      <img
        src={logo}
        alt="Positive Adversity Logo"
        className="h-12 w-auto object-contain"
      />

      <div>
        <p className="text-sm tracking-widest">POSITIVE ADVERSITY</p>
        <h1 className="text-2xl font-semibold">
          Time, notes, and payroll tracking
        </h1>
      </div>
    </div>

    {/* RIGHT SIDE */}
    <button className="border px-4 py-2 rounded-lg"
     type="button"
  onClick={logout}>
      Log out
    </button>

  </div>
</header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <nav className="mb-6 flex flex-wrap gap-2">
          <NavLink to="/" end className={linkClasses}>
            Dashboard
          </NavLink>

          <NavLink to="/profile" className={linkClasses}>
            Profile
          </NavLink>

          {isAdmin && (
            <NavLink to="/admin" className={linkClasses}>
              Admin
            </NavLink>
          )}
        </nav>

        <main className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
