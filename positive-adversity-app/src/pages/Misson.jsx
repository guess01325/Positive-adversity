import { Link, NavLink, Outlet } from "react-router-dom";

export default function Misson() {
  return (
    <div className="space-y-6">
  
      <section className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Positive Adversity Mentoring Services
        </p>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <p className="mt-1 text-sm text-slate-600">
          Mission At Positive Adversity Youth Services, our mission is to
          empower youth to achieve their goals through mentorship, guidance, and
          scholarship opportunities. We strive to develop leadership, respect,
          teamwork, responsibility, and creative thinking while supporting young
          people in their everyday challenges and personal growth. Through
          consistent encouragement and positive influence, we aim to help youth
          build confidence, purpose, and a stronger future.
        </p>
      </div>
    </div>
  );
}
