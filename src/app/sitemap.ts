import type { MetadataRoute } from "next";
import { getSubstances } from "@/lib/meds-server";
import { CMED_PUBLICADA_EM, SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = CMED_PUBLICADA_EM;
  return [
    { url: SITE_URL, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/guia`, changeFrequency: "monthly", priority: 0.5 },
    ...[...getSubstances().keys()].map((slug) => ({
      url: `${SITE_URL}/medicamento/${slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
