// Server-side access to the CMED list (pages, sitemap, API). The JSON is
// imported rather than read from disk so Vercel bundles it with the function.
import medsFile from "../../public/data/meds.json";
import { decodeMeds, substanceSlug, type Med, type MedsFile } from "./meds";

let meds: Med[] | null = null;
let bySlug: Map<string, Med[]> | null = null;

export function getMeds(): Med[] {
  meds ??= decodeMeds(medsFile as unknown as MedsFile);
  return meds;
}

/** Retail presentations grouped by substance slug ("losartana-potassica"). */
export function getSubstances(): Map<string, Med[]> {
  if (!bySlug) {
    bySlug = new Map();
    for (const med of getMeds()) {
      const slug = substanceSlug(med);
      if (!slug) continue;
      const list = bySlug.get(slug);
      if (list) list.push(med);
      else bySlug.set(slug, [med]);
    }
  }
  return bySlug;
}
