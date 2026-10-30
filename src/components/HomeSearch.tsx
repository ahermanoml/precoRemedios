"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { loadMeds } from "@/lib/meds-client";
import { createSearchIndex, searchMeds, type SearchIndex, type SearchResult } from "@/lib/search";
import { MedResults } from "@/components/MedResults";

const POPULAR_SEARCHES = ["Dipirona", "Paracetamol", "Losartana"];

// Keep the search in the address bar (?q=losartana) so it can be shared and
// survives the back button. replaceState: one history entry per visit, not
// one per keystroke.
function syncUrl(q: string) {
  const url = q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : "/";
  if (window.location.pathname + window.location.search !== url) {
    window.history.replaceState(null, "", url);
  }
}

function InfoCard({
  index,
  href,
  icon,
  title,
  description,
}: {
  index: string;
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface to-surface/40 p-5 transition-all duration-300 hover:border-accent/40 hover:-translate-y-0.5 hover:shadow-[0_10px_40px_-12px_rgba(52,211,153,0.15)]"
    >
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/[0.05] blur-2xl transition-all duration-300 group-hover:bg-accent/[0.1]" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/15">
            {icon}
          </div>
          <span className="font-mono text-[11px] tracking-[0.2em] text-muted-light">
            {index}
          </span>
        </div>
        <h3 className="mt-5 text-[17px] font-semibold leading-tight text-foreground transition-colors group-hover:text-accent">
          {title}
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          {description}
        </p>
        <div className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-accent/70 transition-all duration-200 group-hover:text-accent group-hover:gap-2.5">
          Ler mais
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

export function HomeSearch() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [dataState, setDataState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const indexRef = useRef<SearchIndex | null>(null);
  const latestRef = useRef("");
  const loadingRef = useRef(false);

  const run = useCallback((q: string) => {
    latestRef.current = q;
    syncUrl(q);
    if (q.trim().length < 2) {
      setResult(null);
      setSubmitted("");
      return;
    }
    if (!indexRef.current) return; // runs again once the data arrives
    setResult(searchMeds(indexRef.current, q));
    setSubmitted(q);
  }, []);

  // The list is ~1 MB compressed: fetch it only once the visitor shows intent
  // to search (focus, typing, a suggestion, or a ?q= link), not on page load.
  const ensureData = useCallback(() => {
    if (indexRef.current || loadingRef.current) return;
    loadingRef.current = true;
    setDataState("loading");
    loadMeds()
      .then((meds) => {
        indexRef.current = createSearchIndex(meds);
        setDataState("ready");
        run(latestRef.current);
      })
      .catch(() => setDataState("error"))
      .finally(() => {
        loadingRef.current = false;
      });
  }, [run]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      // Restoring a shared/back-button ?q= once on mount; reading it during
      // render would make the static home page mismatch on hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery(q);
      latestRef.current = q;
      ensureData();
    }
  }, [ensureData]);

  const handleInput = (value: string) => {
    setQuery(value);
    latestRef.current = value;
    ensureData();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => run(value), 150);
  };

  const searching = query.trim().length >= 2;
  const waitingForData = searching && dataState === "loading";

  return (
    <main className="mx-auto max-w-4xl px-5 md:px-8">
      {/* Hero / search section */}
      <section className="pt-8 md:pt-12 pb-2">
        <div className="flex items-baseline gap-3 md:gap-4">
          <span className="hidden md:inline font-mono text-[11px] tracking-[0.2em] text-muted-light">
            01 / BUSCA
          </span>
          <span className="hidden md:block h-px flex-1 bg-border-subtle" />
        </div>
        <h1 className="mt-2 md:mt-6 text-center md:text-left font-serif text-[38px] md:text-[44px] leading-[1.05] tracking-tight text-accent">
          <span className="md:hidden">
            Preço máximo
            <br />
            de medicamentos
            <br />
            no Brasil<span className="text-accent-dark">.</span>
          </span>
          <span className="hidden md:inline">
            Preço máximo de medicamentos no Brasil<span className="text-accent-dark">.</span>
          </span>
        </h1>
        <p className="mt-4 md:mt-4 mx-auto md:mx-0 max-w-md md:max-w-xl text-center md:text-left text-[14px] leading-relaxed text-muted">
          Acesse a base de dados oficial e garanta a{" "}
          <span className="text-foreground">transparência</span> nos valores de
          medicamentos em todo o território nacional.
        </p>

        {/* Pill search bar with inline BUSCAR button */}
        <form
          className="mt-6 relative"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            ensureData();
            run(query);
          }}
        >
          <svg
            className="absolute left-5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-light"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onFocus={ensureData}
            onPointerDown={ensureData}
            placeholder="Remédio ou substância"
            aria-label="Busque por nome, substância ou laboratório"
            enterKeyHint="search"
            className="w-full rounded-full border border-border bg-surface py-3 pl-12 pr-[108px] text-[14px] text-foreground outline-none transition-all duration-200 placeholder:text-muted-light focus:border-accent/40 focus:shadow-[0_0_0_3px_rgba(52,211,153,0.08)] [&::-webkit-search-cancel-button]:hidden"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-accent px-5 py-2 text-[12px] font-bold tracking-widest text-background transition-colors hover:bg-accent-dark hover:text-foreground"
          >
            BUSCAR
          </button>
          {waitingForData && (
            <div className="absolute -bottom-6 right-2">
              <div className="h-3.5 w-3.5 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
            </div>
          )}
        </form>

        {/* Suggestion chips */}
        <div className="mt-4 flex flex-wrap items-center justify-center md:justify-start gap-x-3 gap-y-1.5 text-[12px]">
          <span className="font-serif italic text-muted-light">Sugestões:</span>
          {POPULAR_SEARCHES.map((term) => (
            <button
              key={term}
              onClick={() => handleInput(term)}
              className="inline-flex items-center gap-1.5 text-accent transition-colors hover:text-accent-dark"
            >
              <span className="h-1 w-1 rounded-full bg-accent" />
              {term}
            </button>
          ))}
        </div>
      </section>

      {/* Loading */}
      {waitingForData && (
        <div className="py-16 text-center animate-fade-in-up">
          <div className="mx-auto mb-3 h-7 w-7 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
          <p className="text-sm text-muted">Carregando a lista da CMED...</p>
        </div>
      )}

      {searching && dataState === "error" && (
        <div className="py-12 text-center animate-fade-in-up">
          <p className="text-[15px] font-medium text-foreground">Não foi possível carregar a lista de preços.</p>
          <button
            type="button"
            onClick={ensureData}
            className="mt-3 rounded-full border border-border px-4 py-1.5 text-[13px] text-accent hover:border-accent/40"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {/* Results */}
      {searching && result && (
        <section className="mt-6 mx-auto max-w-2xl">
          {result.results.length === 0 ? (
            <div className="py-12 text-center animate-fade-in-up">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-foreground/5">
                <svg className="h-5 w-5 text-muted-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                </svg>
              </div>
              <p className="text-[15px] font-medium text-foreground">
                Nenhum resultado para &ldquo;{submitted}&rdquo;
              </p>
              <p className="mt-1.5 text-sm text-muted">
                Tente outro nome ou princípio ativo
              </p>
            </div>
          ) : (
            <>
              {result.aproximado && (
                <p className="mb-3 text-[13px] text-muted">
                  Nada com &ldquo;{submitted}&rdquo; exatamente. Resultados parecidos:
                </p>
              )}
              <MedResults key={submitted} meds={result.results} />
            </>
          )}
        </section>
      )}

      {/* Info cards — only show when not searching */}
      {!searching && (
        <section className="mt-10 md:mt-12 animate-fade-in-up">
          <div className="hidden md:flex items-baseline gap-3 mb-5">
            <span className="font-mono text-[11px] tracking-[0.2em] text-muted-light">
              02 / ENTENDA
            </span>
            <span className="h-px flex-1 bg-border-subtle" />
          </div>
          <div className="grid gap-3 md:grid-cols-2 md:gap-4">
            <InfoCard
              index="01"
              href="/guia#pmc"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8M14 7h7v7" />
                </svg>
              }
              title="Como funciona o Preço Máximo?"
              description="Entenda as regras que limitam os valores cobrados nas farmácias e protegem o consumidor."
            />
            <InfoCard
              index="02"
              href="/guia#cmed"
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6" />
                </svg>
              }
              title="O que é CMED?"
              description="Conheça a Câmara de Regulação do Mercado de Medicamentos e seu papel no Brasil."
            />
          </div>
        </section>
      )}
    </main>
  );
}
