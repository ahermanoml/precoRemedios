"use client";

import { decodeMeds, type Med, type MedsFile } from "./meds";

let pending: Promise<Med[]> | null = null;

/** Fetches and decodes the full CMED list once per page load. */
export function loadMeds(): Promise<Med[]> {
  pending ??= fetch("/data/meds.json")
    .then((res) => {
      if (!res.ok) throw new Error(`meds.json: ${res.status}`);
      return res.json() as Promise<MedsFile>;
    })
    .then(decodeMeds)
    .catch((err) => {
      pending = null; // allow a retry
      throw err;
    });
  return pending;
}
