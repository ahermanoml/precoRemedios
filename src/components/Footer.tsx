import Link from "next/link";
import { CMED_DATA } from "@/lib/site";

export function Footer() {
  return (
    <footer className="mx-auto mt-16 max-w-4xl border-t border-border-subtle px-5 pt-6 text-[11px] leading-relaxed text-muted-light md:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <p className="max-w-md">
          Fonte:{" "}
          <a
            href="https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-accent"
          >
            Lista de Preços de Medicamentos da CMED/Anvisa
          </a>
          , publicada em {CMED_DATA}. Os valores são tetos legais (PMC); a farmácia pode cobrar menos.
          Este site não substitui orientação médica ou farmacêutica.
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/guia" className="hover:text-accent">
            Guia do Consumidor
          </Link>
          <Link href="/guia#denuncia" className="hover:text-accent">
            Como denunciar
          </Link>
          <a
            href="https://medtupa.github.io/meds/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent"
          >
            MedTupa — farmácias em Tupaciguara
          </a>
        </nav>
      </div>
    </footer>
  );
}
