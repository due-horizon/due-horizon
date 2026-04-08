export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-7xl px-6 py-24">
        <p className="text-sm text-cyan-300">Due Horizon</p>

        <h1 className="mt-4 text-5xl font-semibold tracking-tight">
          Never miss a filing deadline again.
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-white/70">
          Due Horizon helps firms and business owners track filings,
          stay compliant, and avoid costly penalties.
        </p>

        <div className="mt-8 flex gap-4">
          <a
            href="/setup"
            className="rounded-xl bg-cyan-400 px-6 py-3 font-medium text-slate-950"
          >
            Start Free Trial
          </a>

          <a
            href="#"
            className="rounded-xl border border-white/15 px-6 py-3 font-medium text-white"
          >
            Book a Demo
          </a>
        </div>
      </section>
    </main>
  );
}