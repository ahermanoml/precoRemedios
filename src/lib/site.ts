import meta from "@/data/cmed-meta.json";
import { brDate, monthYear } from "./meds";

export const SITE_URL = "https://medpreco.com";
export const SITE_NAME = "MedPreço";

/** Date of the CMED list currently in public/data/meds.json (ISO) */
export const CMED_PUBLICADA_EM = meta.publicadaEm;
/** "out/2026" */
export const CMED_MES = monthYear(meta.publicadaEm);
/** "09/10/2026" */
export const CMED_DATA = brDate(meta.publicadaEm);
