import { Link, NavLink } from "react-router-dom";
import logo from "../assets/logo.png";
import logoFull from "../assets/logo-full.png";
import { DONATE_URL } from "../lib/constants";

const navClass = ({ isActive }) =>
  `rounded-full px-4 py-2 text-sm font-bold transition ${
    isActive
      ? "bg-white text-slate-950"
      : "text-slate-300 hover:bg-white/10 hover:text-white"
  }`;

const actions = [
  {
    title: "Shop",
    text: "Browse the PA Store and Team Store.",
    to: "/store",
  },
  {
    title: "Events",
    text: "See upcoming programs and community dates.",
    to: "/events",
  },
  {
    title: "Mission Statement",
    text: "Learn about the purpose behind the work.",
    to: "/mission",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#090909] text-white">
      <header
        className="border-b border-white/10 px-4 py-3"
        style={{ paddingTop: "max(env(safe-area-inset-top), 24px)" }}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={logo}
              alt="Positive Adversity"
              className="h-11 w-auto shrink-0 object-contain"
            />
            <p className="truncate text-xs font-black uppercase tracking-[0.22em] text-[#f6b332]">
              Positive Adversity
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            <NavLink to="/" end className={navClass}>
              Home
            </NavLink>
            <NavLink to="/store" className={navClass}>
              Shop
            </NavLink>
            <NavLink to="/events" className={navClass}>
              Events
            </NavLink>
            <NavLink to="/mission" className={navClass}>
              Mission
            </NavLink>
            <NavLink to="/login" className={navClass}>
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

      <section className="mx-auto grid min-h-[calc(100vh-88px)] max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.28em] text-[#f6b332]">
            Youth Services, Events, and Stores
          </p>
          <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[0.95] text-white sm:text-7xl">
            Positive Adversity
          </h1>
          <p className="mt-6 max-w-2xl text-lg font-semibold leading-8 text-slate-300">
            Empowering young people through youth services, community events,
            donations, and shop sales that help support the mission.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/store"
              className="rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950 hover:bg-slate-200"
            >
              Shop
            </Link>
            <a
              href={DONATE_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-[#f6b332] px-6 py-3 text-sm font-black text-slate-950 hover:bg-[#ffd166]"
            >
              Donate
            </a>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40">
          <div className="flex aspect-square items-center justify-center rounded-[1.5rem] bg-white">
            <img
              src={logoFull}
              alt="Positive Adversity logo"
              className="max-h-[78%] w-full object-contain px-4"
            />
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-white px-4 py-10 text-slate-950 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          {actions.map((action) => (
            <Link
              key={action.title}
              to={action.to}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm hover:border-slate-300 hover:bg-white"
            >
              <p className="text-xl font-black">{action.title}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                {action.text}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
