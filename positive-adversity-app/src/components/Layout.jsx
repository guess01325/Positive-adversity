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
<div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-100 touch-pan-y">
<header className="w-full max-w-full overflow-hidden bg-slate-100 px-4 py-3">
  <div className="flex w-full items-start justify-between gap-3">
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <img
        src={logo}
        alt="Positive Adversity Logo"
        className="h-10 w-auto shrink-0 object-contain"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs tracking-widest text-slate-600">
          POSITIVE ADVERSITY
        </p>

        <h1 className="text-base font-semibold leading-tight text-slate-900">
          Time, notes, and payroll tracking
        </h1>
      </div>
    </div>

    <button
      className="shrink-0 rounded-lg border bg-white px-3 py-2 text-sm"
      type="button"
      onClick={async () => {
        await logout();
      }}
    >
      Log out
    </button>
  </div>
</header>

    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
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

      <main className="w-full max-w-full overflow-x-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <Outlet />
      </main>
    </div>
  </div>
);
}
