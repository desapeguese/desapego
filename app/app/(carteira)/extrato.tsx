import Link from "next/link";
import { dataHora, inteiro, NOME_TIPO } from "@/lib/formato";
import type { LinhaExtrato } from "@/lib/ledger";
import { Avatar, AvatarCaixa } from "../pecas";

export function Extrato({
  linhas,
  base = "/app/transacao",
}: {
  linhas: LinhaExtrato[];
  /** Para onde cada linha leva: o comprovante da pessoa ou a visão do Caixa. */
  base?: string;
}) {
  return (
    <ul className="extrato">
      {linhas.map((linha) => {
        const nome = linha.contraparteNome || "Sem nome";
        // A descrição diz mais que o tipo; sem ela (ou em cédulas, onde ela
        // repete o tipo) mostra-se o tipo.
        const oQue =
          linha.tipo === "envio" && linha.descricao
            ? linha.descricao
            : linha.descricao && !linha.tipo.endsWith("_cedula")
              ? `${NOME_TIPO[linha.tipo]}: ${linha.descricao}`
              : NOME_TIPO[linha.tipo];
        return (
          <li key={linha.id}>
            <Link className="extrato-linha" href={`${base}/${linha.id}`}>
              {/* A barraca marca quando a outra ponta foi o caixa de alguém. */}
              {linha.contraparteNoCaixa ? <AvatarCaixa /> : <Avatar id={linha.contraparteId} nome={nome} />}
              <span className="extrato-texto">
                <span className="extrato-nome">{nome}</span>
                <span className="extrato-detalhe">
                  {oQue} · {dataHora(linha.criadaEm)}
                </span>
              </span>
              <span className={linha.valor < 0 ? "extrato-valor" : "extrato-valor extrato-valor--entrada"}>
                {linha.valor < 0 ? "−" : "+"} {inteiro(Math.abs(linha.valor))}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
