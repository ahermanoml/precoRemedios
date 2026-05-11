import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guia do Consumidor — MedPreço",
  description:
    "Informações essenciais sobre PMC, CMED, ICMS e como denunciar preços abusivos de medicamentos.",
};

type Section = {
  id: string;
  number: string;
  title: string;
  icon: React.ReactNode;
  iconTone: "accent" | "danger" | "muted";
  body: React.ReactNode;
};

const SECTIONS: Section[] = [
  {
    id: "pmc",
    number: "1",
    title: "O que é o PMC?",
    iconTone: "accent",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8v1m0 7v1m9-5a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    body: (
      <>
        <p>
          O <strong className="font-semibold text-foreground">Preço Máximo ao Consumidor (PMC)</strong>{" "}
          é o teto estabelecido pela Câmara de Regulação do Mercado de Medicamentos (CMED).
        </p>
        <p className="mt-3">
          Nenhuma farmácia ou drogaria no Brasil está autorizada a comercializar medicamentos por
          um valor acima do PMC vigente.
        </p>
      </>
    ),
  },
  {
    id: "denuncia",
    number: "2",
    title: "Como denunciar preços abusivos?",
    iconTone: "danger",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
      </svg>
    ),
    body: (
      <>
        <p>
          Se você identificar um medicamento sendo vendido acima do PMC, é seu direito registrar
          uma denúncia oficial.
        </p>
        <ul className="mt-3 space-y-2">
          <li className="flex gap-2.5">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
            <span>Exija e guarde a nota fiscal da compra.</span>
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
            <span>Registre a ocorrência no site oficial da Anvisa/CMED.</span>
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
            <span>Procure o Procon da sua cidade para orientações.</span>
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "cmed",
    number: "3",
    title: "Entendendo o ICMS",
    iconTone: "muted",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    body: (
      <>
        <p>
          O <strong className="font-semibold text-foreground">Imposto sobre Circulação de
          Mercadorias e Serviços (ICMS)</strong>{" "}
          é um tributo estadual que incide diretamente sobre os medicamentos.
        </p>
        <p className="mt-3">
          As alíquotas variam de acordo com o Estado brasileiro, o que explica por que o PMC de
          um mesmo medicamento pode ser diferente entre regiões.
        </p>
      </>
    ),
  },
];

const TONE_CLASSES: Record<Section["iconTone"], string> = {
  accent: "bg-accent/10 text-accent",
  danger: "bg-danger/10 text-danger",
  muted: "bg-foreground/10 text-foreground",
};

export default function GuiaPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 pt-6">
      <div className="animate-fade-in-up">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-accent">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
          Transparência
        </span>
        <h1 className="mt-4 font-serif text-[40px] leading-[1.05] tracking-tight text-accent">
          Guia do
          <br />
          Consumidor
        </h1>
        <p className="mt-4 text-[14px] leading-relaxed text-muted">
          Informações essenciais para garantir seus direitos na compra de medicamentos. Entenda
          as regras do mercado, como os preços são formados e os canais corretos para proteger
          a sua saúde financeira.
        </p>
      </div>

      <section className="mt-8 space-y-3">
        {SECTIONS.map((section, i) => (
          <article
            key={section.id}
            id={section.id}
            className={`animate-fade-in-up stagger-${i + 1} scroll-mt-20 rounded-2xl border border-border bg-surface p-5`}
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${TONE_CLASSES[section.iconTone]}`}>
              {section.icon}
            </div>
            <h2 className="mt-4 text-[18px] font-semibold leading-tight text-accent">
              <span className="text-foreground">{section.number}.</span> {section.title}
            </h2>
            <div className="mt-3 space-y-0 text-[13.5px] leading-relaxed text-muted">
              {section.body}
            </div>
          </article>
        ))}
      </section>

      <p className="mt-8 text-center text-[11px] text-muted-light">
        Fonte:{" "}
        <a
          href="https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-accent"
        >
          CMED/ANVISA
        </a>
        . Este conteúdo não substitui orientação médica ou farmacêutica.
      </p>
    </main>
  );
}
