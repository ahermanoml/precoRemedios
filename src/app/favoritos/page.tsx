import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Favoritos — MedPreço",
};

export default function FavoritosPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 pt-6">
      <div className="animate-fade-in-up py-16 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </div>
        <h1 className="font-serif text-[28px] tracking-tight text-accent">
          Favoritos
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-[14px] leading-relaxed text-muted">
          Em breve você poderá salvar medicamentos para acompanhar seus preços.
        </p>
        <span className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.05] px-3 py-1 text-[10px] uppercase tracking-widest text-muted-light">
          Em desenvolvimento
        </span>
      </div>
    </main>
  );
}
