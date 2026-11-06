import Link from "next/link";
import { db } from "@/lib/db";
import { corDaPessoa, iniciais, numeroDeSerie } from "@/lib/formato";
import { obterSaldo } from "@/lib/ledger";
import { exigirPessoa } from "@/lib/sessao";
import { BotaoSair } from "../botao-sair";
import { Topo } from "../topo";

const NOME_PAPEL = { usuario: null, caixa: "Caixa", admin: "Admin" } as const;

export default async function Conta() {
  const pessoa = await exigirPessoa();
  const { numero } = await obterSaldo(db, pessoa.id);
  const papel = NOME_PAPEL[pessoa.papel];

  return (
    <>
      <Topo titulo="Sua conta" />

      <section className="conta-quem">
        <span className="avatar" style={{ background: corDaPessoa(pessoa.id) }} aria-hidden="true">
          {iniciais(pessoa.name)}
        </span>
        <p className="receber-nome">{pessoa.name}</p>
        {papel && <p className="selo">{papel}</p>}
      </section>

      <dl className="ficha cartao">
        <div>
          <dt>e-mail</dt>
          <dd>{pessoa.email}</dd>
        </div>
        {pessoa.telefone && (
          <div>
            <dt>telefone</dt>
            <dd>+{pessoa.telefone}</dd>
          </div>
        )}
        <div>
          <dt>número da conta</dt>
          <dd className="serie">{numeroDeSerie(pessoa.createdAt, numero)}</dd>
        </div>
      </dl>

      <p className="app-aviso">
        Precisa corrigir seus dados? Procure o Caixa do Festival.{" "}
        <Link href="/termos">Termos de uso e privacidade</Link>
      </p>

      <div className="rodape-acao">
        <BotaoSair />
      </div>
    </>
  );
}
