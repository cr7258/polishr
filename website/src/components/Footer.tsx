import Image from "next/image";

export default function Footer() {
  return (
    <footer className="border-t border-border px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
          {/* Logo & description */}
          <div className="flex flex-col items-center md:items-start">
            <div className="flex items-center gap-2.5">
              <Image
                src="/logo.jpeg"
                alt="Polishr"
                width={24}
                height={24}
                className="h-6 w-6 object-cover"
              />
              <span className="font-heading text-lg font-bold text-text-primary">
                Polishr
              </span>
            </div>
            <p className="mt-2 max-w-xs text-center font-body text-sm text-text-tertiary md:text-left">
              Polish your writing instantly. Open source desktop app for macOS.
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-8">
            <div className="flex flex-col gap-3">
              <p className="font-body text-xs font-semibold uppercase tracking-wider text-text-muted">
                Product
              </p>
              <a
                href="#features"
                className="cursor-pointer font-body text-sm text-text-tertiary transition-colors duration-200 hover:text-text-primary"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="cursor-pointer font-body text-sm text-text-tertiary transition-colors duration-200 hover:text-text-primary"
              >
                How It Works
              </a>
              <a
                href="https://github.com/cr7258/polishr/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer font-body text-sm text-text-tertiary transition-colors duration-200 hover:text-text-primary"
              >
                Download
              </a>
            </div>
            <div className="flex flex-col gap-3">
              <p className="font-body text-xs font-semibold uppercase tracking-wider text-text-muted">
                Community
              </p>
              <a
                href="https://github.com/cr7258/polishr"
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer font-body text-sm text-text-tertiary transition-colors duration-200 hover:text-text-primary"
              >
                GitHub
              </a>
              <a
                href="https://github.com/cr7258/polishr/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer font-body text-sm text-text-tertiary transition-colors duration-200 hover:text-text-primary"
              >
                Issues
              </a>
              <a
                href="https://github.com/cr7258/polishr/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer font-body text-sm text-text-tertiary transition-colors duration-200 hover:text-text-primary"
              >
                MIT License
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 border-t border-border pt-6 text-center">
          <p className="font-body text-xs text-text-muted">
            &copy; {new Date().getFullYear()} Polishr. Open source under MIT
            License.
          </p>
        </div>
      </div>
    </footer>
  );
}
