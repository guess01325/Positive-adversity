import { Link } from "react-router-dom";
import logoFull from "../assets/logo-full.png";
import { DONATE_URL } from "../lib/constants";

export default function Misson() {
  return (
    <div className="space-y-8 pb-10">
      <section className="grid overflow-hidden rounded-[2rem] border border-white/10 bg-[#111111] shadow-2xl shadow-black/40 lg:grid-cols-[1fr_0.9fr]">
        <div className="p-6 sm:p-8 lg:p-10">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-[#f6b332]">
            Our Mission
          </p>
          <h1 className="mt-5 max-w-3xl text-5xl font-black leading-none text-white sm:text-6xl">
            Turning support into momentum.
          </h1>
          <div className="mt-6 max-w-2xl space-y-4 text-base font-semibold leading-8 text-slate-300">
            <p>
              Positive Adversity Youth Services is to empower young people to
              overcome adversity, reach their full potential, and build a strong
              foundation for a successful future through mentorship, guidance,
              accountability, positive relationships, and meaningful
              opportunities.
            </p>
            <p>
              We are committed to helping youth achieve their goals while
              developing essential life skills, including leadership, respect,
              teamwork, responsibility, confidence, and creative thinking.
              Through consistent encouragement, positive role models,
              scholarships, and community-based experiences, we help young
              people navigate everyday challenges, make positive decisions, and
              recognize their potential.
            </p>
            <p>
              We believe every young person deserves someone who will listen,
              encourage, challenge, and believe in them. Our goal is to provide
              the support and opportunities young people need to turn adversity
              into opportunity and build a brighter future.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/events"
              className="rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950 hover:bg-slate-200"
            >
              View Events
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

        <div className="flex items-center justify-center bg-white p-8">
          <img
            src={logoFull}
            alt="Positive Adversity logo"
            className="max-h-80 w-full object-contain"
          />
        </div>
      </section>

    </div>
  );
}
