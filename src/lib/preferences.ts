"use client";

import { createStore } from "./store";
import { DEFAULT_UF, isUf } from "./icms";

const ufStore = createStore<string>("medpreco-uf", DEFAULT_UF, (v): v is string => typeof v === "string" && isUf(v));

/** The visitor's state, remembered in the browser (SP until they pick one). */
export function useUf(): [string, (uf: string) => void] {
  return [ufStore.useValue(), ufStore.write];
}

// Favorites are CMED GGREM codes: stable across list updates, so a saved
// medicine keeps showing the current ceiling price.
const favStore = createStore<string[]>(
  "medpreco-favoritos",
  [],
  (v): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string")
);

export function useFavoritos(): string[] {
  return favStore.useValue();
}

export function toggleFavorito(ggrem: string) {
  const current = favStore.read();
  favStore.write(
    current.includes(ggrem) ? current.filter((g) => g !== ggrem) : [...current, ggrem]
  );
}
