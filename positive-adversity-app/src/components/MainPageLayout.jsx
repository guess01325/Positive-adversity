import { NavLink, Outlet } from "react-router-dom";
import logo from "../assets/logo.png";
import { DONATE_URL } from "../lib/constants";

const linkClasses = ({ isActive }) =>
  `rounded-full px-4 py-2 text-sm font-bold transition ${
    isActive
      ? "bg-white text-slate-950"
      : "text-slate-300 hover:bg-white/10 hover:text-white"
  }`;

export default function MainPageLayout() {
  return (
    <div
      className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#090909] text-white touch-pan-y"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 24px)",
      }}
    >
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#090909]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={logo}
              alt="Positive Adversity"
              className="h-11 w-auto shrink-0 object-contain"
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-black uppercase tracking-[0.22em] text-[#f6b332]">
                Positive Adversity
              </p>
              <p className="truncate text-sm font-semibold text-slate-300">
                Youth Services, Events, and Team Gear
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            <NavLink to="/" end className={linkClasses}>
              Home
            </NavLink>

            <NavLink to="/store" end className={linkClasses}>
              Team Gear
            </NavLink>

            <NavLink to="/events" className={linkClasses}>
              Events
            </NavLink>

            <NavLink to="/mission" className={linkClasses}>
              Mission
            </NavLink>

            <NavLink to="/login" end className={linkClasses}>
              Sign In
            </NavLink>

            <a
              href={DONATE_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-[#f6b332] px-4 py-2 text-sm font-black text-slate-950 shadow-[0_0_22px_rgba(246,179,50,0.25)] hover:bg-[#ffd166]"
            >
              Donate
            </a>
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        <main className="w-full max-w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
