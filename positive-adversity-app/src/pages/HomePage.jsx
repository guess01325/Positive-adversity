import { Link, NavLink, Outlet } from "react-router-dom";

export default function HomePage() {
  return (
    <div className="space-y-6">
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link to="/store" className="rounded-xl bg-white p-5 shadow-sm border">
          <h3 className="font-bold text-slate-900">Store</h3>
          <p className="mt-1 text-sm text-slate-600">
            Browse Positive Adversity gear.
          </p>
        </Link>

        <Link to="/mission" className="rounded-xl bg-white p-5 shadow-sm border">
          <h3 className="font-bold text-slate-900">Our Mission</h3>
          <p className="mt-1 text-sm text-slate-600">
            Learn more about our purpose, vision, and community impact.
          </p>
        </Link>

        <Link to="/events" className="rounded-xl bg-white p-5 shadow-sm border">
          <h3 className="font-bold text-slate-900">Events</h3>
          <p className="mt-1 text-sm text-slate-600">
            View upcoming outreach and community events.
          </p>
        </Link>

        <Link to="/donate" className="rounded-xl bg-white p-5 shadow-sm border">
          <h3 className="font-bold text-slate-900">Donate</h3>
          <p className="mt-1 text-sm text-slate-600">
            Support youth programs and community work.
          </p>
        </Link>

        <Link to="/login" className="rounded-xl bg-white p-5 shadow-sm border">
          <h3 className="font-bold text-slate-900">Sign In</h3>
          <p className="mt-1 text-sm text-slate-600">
            Access your dashboard or admin tools.
          </p>
        </Link>
      </div>
    </div>
  );
}
