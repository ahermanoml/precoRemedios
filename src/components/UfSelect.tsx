"use client";

import { UFS, aliquotaDe, aliquotaGenericoDe } from "@/lib/icms";
import { useUf } from "@/lib/preferences";

/** "Preços para [SP ▾] · ICMS 18%" — the choice is remembered in the browser. */
export function UfSelect({ className = "" }: { className?: string }) {
  const [uf, setUf] = useUf();
  return (
    <label className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted ${className}`}>
      <span className="whitespace-nowrap">Preços para</span>
      <span className="relative">
        <select
          value={uf}
          onChange={(e) => setUf(e.target.value)}
          aria-label="Seu estado"
          className="appearance-none rounded-full border border-border bg-surface py-1 pl-3 pr-7 text-[12px] font-semibold text-foreground outline-none transition-colors hover:border-accent/40 focus:border-accent/60"
        >
          {UFS.map((u) => (
            <option key={u.uf} value={u.uf}>
              {u.uf} — {u.nome}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-light"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </span>
      <span className="whitespace-nowrap text-muted-light">
        · ICMS {aliquotaDe(uf)}
        {aliquotaGenericoDe(uf) && ` (genéricos ${aliquotaGenericoDe(uf)})`}
      </span>
    </label>
  );
}
