import { ogCard, OG_SIZE } from "@/lib/og";
import { CMED_MES } from "@/lib/site";

export const alt = "MedPreço — preço máximo de medicamentos no Brasil";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return ogCard({
    title: "Preço máximo de medicamentos no Brasil",
    subtitle: "Mais de 22 mil apresentações, com o ICMS do seu estado",
    footer: `Lista oficial CMED/Anvisa · ${CMED_MES}`,
  });
}
