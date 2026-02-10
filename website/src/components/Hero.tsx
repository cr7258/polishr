export default function Hero() {
  return (
    <section className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden px-4 pt-24 pb-0 sm:px-6 lg:px-8">
      {/* Background gradient effects */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/8 blur-[120px]" />
        <div className="absolute right-1/4 bottom-1/4 h-[400px] w-[400px] rounded-full bg-accent-indigo/6 blur-[100px]" />
        <div className="absolute top-1/3 left-1/4 h-[300px] w-[300px] rounded-full bg-accent-cyan/5 blur-[80px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border-light bg-bg-surface/80 px-4 py-1.5 backdrop-blur-sm">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <span className="font-body text-xs font-medium text-text-secondary">
            Open Source &middot; macOS
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-heading text-4xl font-bold leading-tight tracking-tight text-text-primary sm:text-5xl md:text-6xl lg:text-7xl">
          Polish Your Writing,{" "}
          <span className="bg-gradient-to-r from-primary via-primary-light to-accent-cyan bg-clip-text text-transparent">
            Instantly
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-6 max-w-2xl font-body text-lg leading-relaxed text-text-secondary sm:text-xl">
          Select text in any app, press{" "}
          <kbd className="rounded-md border border-border-light bg-bg-elevated px-2 py-0.5 font-mono text-sm text-text-primary">
            Cmd+Option+P
          </kbd>
          , and get instant AI-powered grammar fixes, rephrasing, and
          translation.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="https://github.com/cr7258/polishr/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="group cursor-pointer inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-base font-semibold text-white shadow-[0_0_24px_rgba(59,130,246,0.3)] transition-all duration-200 hover:bg-primary-hover hover:shadow-[0_0_32px_rgba(59,130,246,0.4)]"
          >
            Download for macOS
            <svg
              className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
          </a>
          <a
            href="#features"
            className="cursor-pointer inline-flex items-center gap-2 rounded-full border border-border-light px-8 py-3.5 text-base font-semibold text-text-primary transition-colors duration-200 hover:border-text-tertiary hover:bg-bg-surface"
          >
            Learn More
          </a>
        </div>

        {/* Demo mockup */}
        <div className="mx-auto mt-16 max-w-2xl">
          <div className="overflow-hidden rounded-2xl border border-border bg-bg-surface/50 shadow-2xl shadow-primary/5">
            {/* Window chrome */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-[#FF5F57]" />
              <div className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
              <div className="h-3 w-3 rounded-full bg-[#28C840]" />
              <span className="ml-3 font-body text-xs text-text-muted">
                Polishr
              </span>
            </div>
            {/* Content */}
            <div className="p-6">
              <div className="space-y-4">
                {/* Explanation */}
                <div className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z"
                    />
                  </svg>
                  <span className="font-body text-sm text-text-secondary">
                    Fixed subject-verb agreement
                  </span>
                </div>
                {/* Diff display */}
                <div className="rounded-xl bg-bg-primary/60 p-4 font-body text-sm leading-relaxed">
                  <span className="text-text-primary">The team </span>
                  <span className="rounded bg-red-500/15 px-0.5 text-red-400 line-through">
                    have been working
                  </span>{" "}
                  <span className="rounded bg-emerald-500/15 px-0.5 text-emerald-400">
                    has been working
                  </span>
                  <span className="text-text-primary">
                    {" "}
                    on this project for months.
                  </span>
                </div>
                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <button className="cursor-pointer rounded-lg bg-primary px-4 py-2 font-body text-xs font-semibold text-white transition-colors duration-200 hover:bg-primary-hover">
                    Accept
                  </button>
                  <button className="cursor-pointer rounded-lg border border-border-light px-4 py-2 font-body text-xs font-medium text-text-secondary transition-colors duration-200 hover:bg-bg-elevated hover:text-text-primary">
                    Copy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
