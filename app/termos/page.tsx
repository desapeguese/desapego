import type { Metadata } from "next";
import Link from "next/link";
import { fontesDoApp } from "../fontes";

export const viewport = { themeColor: "#D9DFCF", colorScheme: "light" as const };

export const metadata: Metadata = {
  title: "Termos de uso e privacidade — Moeda Social Desapego",
  alternates: { canonical: "/termos" },
};

// Texto aprovado pela organização em 7 de novembro de 2026. A cópia de
// referência é docs/termos-de-uso.md. Ao mudar o texto, mude também
// VERSAO_TERMOS em lib/sessao.ts: é ela que fica gravada em cada aceite.
export default function Termos() {
  return (
    <main className={`app texto-legal ${fontesDoApp}`}>
      <header className="app-topo">
        <h1 className="app-titulo">Termos de uso e privacidade</h1>
        <p className="app-subtitulo">
          Ao criar sua carteira na Moeda Social Desapego, você declara ter 18 anos ou mais e concorda com os
          termos abaixo. Versão de 7 de novembro de 2026.
        </p>
      </header>

      <h2 className="app-titulo texto-legal-parte">Termos de uso</h2>

      <section>
        <h2>1. O que é a Desapego</h2>
        <p>
          A Desapego é a moeda social do Festival Desapegue-se, organizado pela MLG Produções (CNPJ
          00.814.223/0001-92), do Rio de Janeiro – RJ. Ela serve para trocas entre participantes e no bazar do
          Festival.
        </p>
        <p>
          A Desapego <strong>não é dinheiro oficial</strong>: não pode ser convertida em reais, não rende juros,
          não é um investimento e não tem valor fora da comunidade do Festival.
        </p>
      </section>

      <section>
        <h2>2. Quem pode usar</h2>
        <ul>
          <li>Pessoas com <strong>18 anos ou mais</strong>.</li>
          <li><strong>Uma conta por pessoa</strong>, identificada pelo e-mail.</li>
          <li>
            A equipe do Festival pode cadastrar uma pessoa no balcão, com nome e e-mail. Nesse caso, estes termos
            são aceitos no primeiro acesso ao app.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Como funciona a conta</h2>
        <ul>
          <li>
            Você entra com um <strong>código enviado ao seu e-mail</strong>, sem senha. Opcionalmente, pode usar
            a conta Google, a digital ou o rosto do seu aparelho (passkey) ou um app autenticador.
          </li>
          <li>
            <strong>Toda transação fica registrada de forma permanente</strong> e não pode ser apagada nem
            editada por ninguém, inclusive pela organização.
          </li>
          <li>
            <strong>Erros são corrigidos com um estorno</strong>: uma transação inversa, feita pela equipe do
            Festival, que fica registrada junto da original.
          </li>
          <li>O saldo <strong>não expira</strong> e não perde valor com o tempo.</li>
          <li>
            Para enviar Desapegos quando o saldo passa de D$ 100, é preciso ativar uma proteção extra da conta
            (digital, rosto ou app autenticador). Receber continua livre.
          </li>
          <li>
            Ao levar um objeto do bazar, o valor pode ser registrado na sua conta mesmo que o seu saldo fique
            negativo. Isso é sempre combinado com você na hora, e um saldo negativo impede novos envios até ser
            coberto.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Cédulas de papel</h2>
        <p>
          As cédulas físicas de Desapego convivem com o app. No Festival, a equipe pode receber cédulas e
          creditar o valor na sua conta, ou debitar da sua conta e entregar cédulas. Essas conversões ficam
          registradas como qualquer outra transação.
        </p>
      </section>

      <section>
        <h2>5. Responsabilidades</h2>
        <ul>
          <li>Mantenha o acesso ao seu e-mail e ao seu aparelho. Quem tem acesso a eles tem acesso à sua carteira.</li>
          <li>Não use a conta de outra pessoa nem crie contas para terceiros.</li>
          <li>
            A organização pode <strong>desativar contas</strong> usadas de forma indevida. Uma conta desativada
            não entra nem transaciona, mas o saldo e o histórico são preservados.
          </li>
          <li>
            A organização não se responsabiliza por trocas combinadas entre participantes fora do bazar, nem pelos
            objetos trocados.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Encerramento e mudanças</h2>
        <ul>
          <li>A organização pode encerrar a moeda ou o app, avisando os participantes com antecedência razoável.</li>
          <li>
            Em caso de encerramento, quem tiver saldo positivo terá <strong>90 dias</strong> para trocar seus
            Desapegos por itens no Festival Desapegue-se seguinte, ou por cédulas, procurando a administração pelo
            e-mail <a href="mailto:contato@festivaldesapeguese.com.br">contato@festivaldesapeguese.com.br</a>.
          </li>
          <li>
            Estes termos podem mudar. Mudanças relevantes são comunicadas por e-mail, e o uso continuado do app
            vale como aceite.
          </li>
        </ul>
      </section>

      <h2 className="app-titulo texto-legal-parte">Política de privacidade</h2>

      <section>
        <h2>7. Quem é responsável pelos dados</h2>
        <p>O controlador dos dados é a MLG Produções, CNPJ 00.814.223/0001-92, Rio de Janeiro – RJ.</p>
        <p>
          Encarregada pelo tratamento de dados (DPO): Renata Luci de Lara Baptista,{" "}
          <a href="mailto:renata@festivaldesapeguese.com.br">renata@festivaldesapeguese.com.br</a>.
        </p>
      </section>

      <section>
        <h2>8. Quais dados guardamos</h2>
        <table className="tabela">
          <thead>
            <tr>
              <th scope="col">Dado</th>
              <th scope="col">Obrigatório?</th>
              <th scope="col">Para quê</th>
            </tr>
          </thead>
          <tbody>
            <tr><th scope="row">Nome completo</th><td>sim</td><td>Identificar você nas trocas e no balcão</td></tr>
            <tr><th scope="row">E-mail</th><td>sim</td><td>Entrar no app e receber avisos da conta</td></tr>
            <tr><th scope="row">Telefone</th><td>não</td><td>Contato e busca pela equipe</td></tr>
            <tr><th scope="row">Histórico de transações</th><td>—</td><td>Funcionamento da moeda e auditoria</td></tr>
            <tr><th scope="row">Registro de alterações na conta</th><td>—</td><td>Auditoria (quem mudou o quê e quando)</td></tr>
            <tr><th scope="row">Dados de login (sessões, passkeys, autenticador)</th><td>—</td><td>Segurança da conta</td></tr>
            <tr><th scope="row">Data e versão do aceite destes termos</th><td>—</td><td>Comprovar o consentimento</td></tr>
          </tbody>
        </table>
        <p>
          Não pedimos CPF, documento, endereço nem dados de pagamento. Não há cookies de publicidade nem
          rastreamento de terceiros.
        </p>
      </section>

      <section>
        <h2>9. Para que usamos</h2>
        <p>
          Apenas para <strong>operar a moeda</strong> e <strong>nos comunicar com você sobre a sua conta</strong>:
          código de login, avisos de recebimento e de débito, mudanças de dados ou de perfil.
        </p>
        <p>
          Base legal: execução do serviço que você solicitou ao criar a carteira e cumprimento de obrigações de
          auditoria da organização (Lei 13.709/2018, art. 7º, incisos V e II).
        </p>
      </section>

      <section>
        <h2>10. Quem vê os seus dados</h2>
        <ul>
          <li>
            <strong>Outros participantes</strong> veem apenas o seu <strong>nome</strong> quando transacionam com
            você (e as iniciais no histórico deles).
          </li>
          <li>
            <strong>A equipe do Festival</strong> vê seus dados de cadastro, saldo, extrato e o registro da conta,
            para atendimento e auditoria.
          </li>
          <li>
            <strong>Prestadores de serviço</strong>, no Brasil e nos Estados Unidos, que hospedam o app e enviam os
            e-mails em nosso nome. Eles não usam os dados para outros fins.
          </li>
        </ul>
        <p>Não vendemos nem compartilhamos seus dados com terceiros para publicidade.</p>
      </section>

      <section>
        <h2>11. Por quanto tempo</h2>
        <ul>
          <li>Enquanto a conta existir e pelo tempo necessário à auditoria da moeda.</li>
          <li>
            <strong>Transações nunca são apagadas</strong>, porque o livro da moeda precisa ser íntegro. A pedido,
            os seus dados pessoais podem ser <strong>anonimizados</strong>: nome, e-mail e telefone são removidos,
            e as transações permanecem sem identificar você.
          </li>
        </ul>
      </section>

      <section>
        <h2>12. Seus direitos</h2>
        <p>Você pode, a qualquer momento, pedir:</p>
        <ul>
          <li>confirmação de que tratamos seus dados e acesso a eles;</li>
          <li>correção de dados incompletos ou errados;</li>
          <li>anonimização dos dados pessoais;</li>
          <li>informação sobre com quem compartilhamos;</li>
          <li>revogação do consentimento.</li>
        </ul>
        <p>Pedidos à encarregada de dados (seção 7). Respondemos em até <strong>30 dias</strong>.</p>
      </section>

      <section>
        <h2>13. Segurança</h2>
        <p>
          Login sem senha, com código de uso único; proteção extra opcional (passkey ou app autenticador),
          obrigatória para enviar acima de D$ 100; registro permanente de toda operação; acesso da equipe
          limitado por perfil. Em caso de incidente de segurança relevante, avisaremos as pessoas afetadas e a
          Autoridade Nacional de Proteção de Dados, conforme a lei.
        </p>
      </section>

      <section>
        <h2>14. Contato</h2>
        <p>
          Dúvidas, pedidos e reclamações:{" "}
          <a href="mailto:contato@festivaldesapeguese.com.br">contato@festivaldesapeguese.com.br</a>, ou pelo
          site <a href="https://www.festivaldesapeguese.com.br/">festivaldesapeguese.com.br</a>.
        </p>
      </section>

      <p>
        <Link href="/">Voltar ao início</Link>
      </p>
    </main>
  );
}
