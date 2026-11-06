import { db } from "@/lib/db";
import { obterSaldo } from "@/lib/ledger";
import { exigirPessoa } from "@/lib/sessao";
import { BotaoSair } from "./botao-sair";

const NOME_PAPEL = { usuario: null, caixa: "Caixa", admin: "Admin" } as const;

export default async function Carteira() {
  const pessoa = await exigirPessoa();
  const { saldo, disponivel } = await obterSaldo(db, pessoa.id);
  const papel = NOME_PAPEL[pessoa.papel];

  return (
    <>
      <header className="app-topo">
        <p className="sobrenome">Moeda Social Desapego</p>
        <h1 className="app-titulo">Olá, {pessoa.name.split(" ")[0]}</h1>
        {papel && <p className="selo">{papel}</p>}
      </header>

      <section className="cartao saldo" aria-label="Saldo">
        <p className="saldo-rotulo">Seu saldo</p>
        <p className={saldo < 0 ? "saldo-valor saldo-valor--negativo" : "saldo-valor"}>
          <span className="saldo-moeda">D$</span> {saldo.toLocaleString("pt-BR")}
        </p>
        {pessoa.papel === "caixa" && disponivel !== null && (
          <p className="saldo-nota">
            Você ainda pode distribuir D$ {disponivel.toLocaleString("pt-BR")}
          </p>
        )}
        {pessoa.papel === "admin" && <p className="saldo-nota">Sem limite negativo</p>}
      </section>

      <p className="app-aviso">
        Sua conta está pronta. Enviar, receber e o histórico chegam na próxima
        atualização do app.
      </p>

      <footer className="app-rodape">
        <p>{pessoa.email}</p>
        <BotaoSair />
      </footer>
    </>
  );
}
