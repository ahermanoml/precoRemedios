"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_TABS } from "./nav-tabs";

export function AppHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-border-subtle bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 md:px-8">
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent transition-colors group-hover:bg-accent/25">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8 2a1 1 0 00-1 1v4H3a1 1 0 00-1 1v4a1 1 0 001 1h4v4a1 1 0 001 1h4a1 1 0 001-1v-4h4a1 1 0 001-1V8a1 1 0 00-1-1h-4V3a1 1 0 00-1-1H8z" />
            </svg>
          </span>
          <span className="font-serif text-[18px] tracking-tight text-foreground">
            MedPreço
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_TABS.map((tab) => {
            const active =
              tab.href === "/"
                ? pathname === "/"
                : pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-accent/10 text-accent"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
