import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { corDaPessoa, dataHora, iniciais, numeroDeSerie } from "@/lib/formato";
import { obterSaldo } from "@/lib/ledger";
import { exigirPessoa } from "@/lib/sessao";
import { BotaoSair } from "../botao-sair";
import { Topo } from "../topo";
import { Seguranca } from "./seguranca";

const NOME_PAPEL = { usuario: null, caixa: "Caixa", admin: "Admin" } as const;

export default async function Conta() {
  const pessoa = await exigirPessoa();
  const { numero } = await obterSaldo(db, pessoa.id);
  const papel = NOME_PAPEL[pessoa.papel];
  const passkeys = await db
    .select({ id: schema.passkey.id, nome: schema.passkey.name, criadaEm: schema.passkey.createdAt })
    .from(schema.passkey)
    .where(eq(schema.passkey.userId, pessoa.id))
    .orderBy(desc(schema.passkey.createdAt));

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

      <Seguranca
        passkeys={passkeys.map((p) => ({
          id: p.id,
          nome: p.nome || "Passkey",
          criadaEm: p.criadaEm ? dataHora(p.criadaEm).split(",")[0] : "—",
        }))}
        autenticadorAtivo={pessoa.twoFactorEnabled}
      />

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
