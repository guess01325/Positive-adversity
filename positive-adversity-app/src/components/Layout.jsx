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
  <header className="w-full max-w-full overflow-hidden bg-slate-100 pt-[env(safe-area-inset-top)] pb-3">      
    <div className="mx-auto box-border flex w-full max-w-7xl items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">    <div className="flex min-w-0 items-center gap-3 overflow-hidden">
      <img
        src={logo}
        alt="Positive Adversity Logo"
        className="h-10 w-auto shrink-0 object-contain sm:h-12"
      />

      <div className="min-w-0 overflow-hidden">
        <p className="truncate text-xs tracking-widest text-slate-600 sm:text-sm">
          POSITIVE ADVERSITY
        </p>

        <h1 className="truncate text-base font-semibold leading-tight text-slate-900 sm:text-2xl">
          Time, notes, and payroll tracking
        </h1>
      </div>
    </div>

    <button
      className="relative z-50 shrink-0 rounded-lg border bg-white px-3 py-2 text-sm sm:px-4"
      type="button"
      onClick={async () => {
        console.log("LOGOUT BUTTON CLICKED");

        try {
          await logout();
          console.log("LOGOUT COMPLETE");
        } catch (error) {
          console.error("LOGOUT FAILED:", {
            code: error?.code,
            message: error?.message,
            name: error?.name,
          });
        }
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
