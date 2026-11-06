import Link from "next/link";
import { inteiro, numeroDeSerie } from "@/lib/formato";
import type { PessoaResumo } from "@/lib/pessoas";
import { Avatar } from "../../pecas";
import { NOME_PAPEL } from "./equipe";

export function ListaPessoas({ pessoas }: { pessoas: PessoaResumo[] }) {
  return (
    <ul className="extrato">
      {pessoas.map((p) => {
        const nome = p.nome || "Sem nome";
        const marcas = [NOME_PAPEL[p.papel], !p.ativo && "desativada"].filter(Boolean).join(" · ");
        return (
          <li key={p.id}>
            <Link className="extrato-linha" href={`/app/caixa/pessoa/${p.id}`}>
              <Avatar id={p.id} nome={nome} />
              <span className="extrato-texto">
                <span className="extrato-nome">{nome}</span>
                <span className="extrato-detalhe">{p.email}</span>
                <span className="extrato-detalhe">
                  {numeroDeSerie(p.criadaEm, p.numero)}
                  {marcas && ` · ${marcas}`}
                </span>
              </span>
              <span className="extrato-valor">
                {p.saldo < 0 ? "−" : ""}
                {inteiro(Math.abs(p.saldo))}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
