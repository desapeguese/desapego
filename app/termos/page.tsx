import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termos de uso e privacidade — Moeda Social Desapego",
  alternates: { canonical: "/termos" },
};

// RASCUNHO. Descreve o que o app faz hoje, em linguagem simples, mas ainda não
// passou por revisão jurídica. Ao publicar o texto definitivo, mude também
// VERSAO_TERMOS em lib/sessao.ts: é ela que fica gravada em cada aceite.
export default function Termos() {
  return (
    <main className="app texto-legal">
      <header className="app-topo">
        <p className="sobrenome">Moeda Social Desapego</p>
        <h1 className="app-titulo">Termos de uso e privacidade</h1>
        <p className="app-subtitulo">Versão preliminar, sujeita a revisão.</p>
      </header>

      <section>
        <h2>O que é a Desapego</h2>
        <p>
          A Desapego é a moeda social do Festival Desapegue-se. Ela serve para
          trocas entre participantes e no bazar do Festival. Não é dinheiro
          oficial, não pode ser convertida em reais e não rende juros.
        </p>
      </section>

      <section>
        <h2>Quem pode usar</h2>
        <p>Pessoas com 18 anos ou mais, com uma conta por pessoa.</p>
      </section>

      <section>
        <h2>Como funciona a conta</h2>
        <ul>
          <li>Você entra com um código enviado ao seu e-mail, sem senha.</li>
          <li>Toda transação fica registrada de forma permanente e não pode ser apagada.</li>
          <li>Erros são corrigidos pela equipe do Caixa com uma transação de estorno.</li>
          <li>O saldo não expira.</li>
          <li>A organização pode desativar contas usadas de forma indevida.</li>
        </ul>
      </section>

      <section>
        <h2>Seus dados</h2>
        <ul>
          <li>Guardamos nome completo, e-mail, telefone (se informado) e o histórico de transações.</li>
          <li>Usamos esses dados apenas para operar a moeda e nos comunicar com você sobre a sua conta.</li>
          <li>Outros participantes veem apenas o seu nome quando transacionam com você.</li>
          <li>A equipe do Caixa e a administração veem seus dados de cadastro e seu extrato, para atendimento e auditoria.</li>
          <li>Não vendemos nem compartilhamos seus dados com terceiros para publicidade.</li>
          <li>
            Você pode pedir a correção ou a anonimização dos seus dados pessoais.
            As transações permanecem no livro, sem identificar você.
          </li>
        </ul>
      </section>

      <section>
        <h2>Contato</h2>
        <p>
          Dúvidas e pedidos sobre seus dados: fale com a organização pelo site{" "}
          <a href="https://www.festivaldesapeguese.com.br/">festivaldesapeguese.com.br</a>.
        </p>
      </section>

      <p>
        <Link href="/">Voltar ao início</Link>
      </p>
    </main>
  );
}
