const providers = [
  {
    name: "DeepSeek",
    description: "Cost-effective, high-quality AI models",
  },
  {
    name: "OpenAI",
    description: "GPT-4o and the latest models",
  },
  {
    name: "OpenRouter",
    description: "Access 100+ models through one API",
  },
  {
    name: "MiniMax",
    description: "Fast multilingual models",
  },
];

export default function Providers() {
  return (
    <section className="relative px-4 py-24 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 font-body text-sm font-semibold uppercase tracking-wider text-primary">
            Bring Your Own API
          </p>
          <h2 className="font-heading text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Works with your favorite providers
          </h2>
          <p className="mt-4 font-body text-lg text-text-secondary">
            Polishr connects to any OpenAI-compatible API. Use whichever
            provider and model you prefer.
          </p>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {providers.map((provider, index) => (
            <div
              key={index}
              className="group cursor-pointer rounded-2xl border border-border bg-bg-surface/50 p-6 text-center transition-all duration-300 hover:border-border-light hover:bg-bg-surface"
            >
              {/* Provider icon placeholder */}
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-bg-elevated">
                <svg
                  className="h-5 w-5 text-primary-light"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z"
                  />
                </svg>
              </div>
              <h3 className="font-heading text-base font-semibold text-text-primary">
                {provider.name}
              </h3>
              <p className="mt-2 font-body text-xs leading-relaxed text-text-tertiary">
                {provider.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
