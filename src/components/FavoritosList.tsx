"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadMeds } from "@/lib/meds-client";
import { useFavoritos } from "@/lib/preferences";
import type { Med } from "@/lib/meds";
import { MedCard } from "./MedResults";
import { UfSelect } from "./UfSelect";

export function FavoritosList() {
  const favoritos = useFavoritos();
  const [meds, setMeds] = useState<Med[] | null>(null);
  const [error, setError] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    if (favoritos.length === 0 || meds) return;
    loadMeds()
      .then(setMeds)
      .catch(() => setError(true));
  }, [favoritos.length, meds]);

  if (favoritos.length === 0) {
    return (
      <p className="mx-auto mt-3 max-w-xs text-center text-[14px] leading-relaxed text-muted">
        Nenhum medicamento salvo ainda. Abra um resultado da{" "}
        <Link href="/" className="text-accent hover:text-accent-dark">
          busca
        </Link>{" "}
        e toque em &ldquo;Salvar nos favoritos&rdquo; para acompanhar o preço máximo aqui.
      </p>
    );
  }

  if (error) {
    return <p className="mt-6 text-center text-sm text-muted">Não foi possível carregar a lista de preços.</p>;
  }

  if (!meds) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-accent/20 border-t-accent" />
      </div>
    );
  }

  const byGgrem = new Map(meds.map((m) => [m.ggrem, m]));
  const found = favoritos.map((g) => byGgrem.get(g)).filter((m): m is Med => !!m);
  const missing = favoritos.length - found.length;

  return (
    <div className="mt-6">
      <div className="mb-3 flex justify-end">
        <UfSelect />
      </div>
      <div className="space-y-2.5">
        {found.map((med, i) => (
          <MedCard
            key={med.ggrem}
            med={med}
            index={i}
            expanded={expandedId === med.id}
            onToggle={() => setExpandedId((cur) => (cur === med.id ? null : med.id))}
          />
        ))}
      </div>
      {missing > 0 && (
        <p className="mt-4 text-center text-[12px] text-muted-light">
          {missing} {missing === 1 ? "item salvo não está" : "itens salvos não estão"} mais na lista atual da
          CMED.
        </p>
      )}
    </div>
  );
}
