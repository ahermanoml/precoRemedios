import Link from "next/link";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border-subtle bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3.5">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent transition-colors group-hover:bg-accent/25">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8 2a1 1 0 00-1 1v4H3a1 1 0 00-1 1v4a1 1 0 001 1h4v4a1 1 0 001 1h4a1 1 0 001-1v-4h4a1 1 0 001-1V8a1 1 0 00-1-1h-4V3a1 1 0 00-1-1H8z" />
            </svg>
          </span>
          <span className="font-serif text-[18px] tracking-tight text-foreground">
            MedPreço
          </span>
        </Link>
        <div className="flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
          SP <span className="text-muted-light">(ICMS)</span>
        </div>
      </div>
    </header>
  );
}
