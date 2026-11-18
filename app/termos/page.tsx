import type { Metadata } from "next";
import Link from "next/link";
import { fontesDoApp } from "../fontes";

export const viewport = { themeColor: "#D9DFCF", colorScheme: "light" as const };

export const metadata: Metadata = {
  title: "Termos de uso e privacidade — Moeda Social Desapego",
  alternates: { canonical: "/termos" },
};

// Texto da revisão jurídica de 13/11/2026, ajustado ao funcionamento do
// sistema. A fonte é docs/termos-de-uso.md: edite lá e gere esta página de
// novo, em vez de mexer aqui. Ao mudar o texto, mude também VERSAO_TERMOS em
// lib/sessao.ts: é ela que fica gravada em cada aceite.
export default function Termos() {
  return (
    <main className={`app texto-legal ${fontesDoApp}`}>
      <header className="app-topo">
        <h1 className="app-titulo">Termos de uso e privacidade</h1>
        <p className="app-subtitulo">Moeda Social Desapego · versão de 18 de novembro de 2026</p>
      </header>

      <p className="texto-legal-abertura">Ao criar ou acessar sua carteira na Moeda Social Desapego, você declara ter 18 anos ou mais e concorda com os termos abaixo.</p>
      <h2 className="app-titulo texto-legal-parte">Termos de Uso</h2>
      <section>
        <h2>1. O que é a Desapego e como obter créditos</h2>
        <p>A Desapego (D$) é a moeda social do Festival Desapegue-se, organizado pela MLG Produções (CNPJ 00.814.223/0001-92), do Rio de Janeiro – RJ. Ela serve para trocas entre participantes e no bazar oficial do Festival.</p>
        <p>A Desapego não é dinheiro oficial: não pode ser convertida em reais (R$), não rende juros, não é um investimento e não tem valor fora da comunidade do Festival.</p>
        <p>Os créditos em Desapegos são obtidos principalmente pela entrega de objetos em bom estado de conservação, higiene e funcionamento no balcão de avaliação do Festival, ou por transferências diretas de outros participantes. A equipe de curadoria do Festival tem autonomia exclusiva para avaliar os itens, definir sua pontuação em Desapegos conforme os critérios vigentes da edição e recusar objetos danificados, incompletos, ilícitos ou que não atendam às regras do evento.</p>
        <p><strong>Natureza comunitária, ausência de caráter mercantil e irrevogabilidade das trocas:</strong> a Desapego opera exclusivamente em circuito fechado de economia circular, solidária, consumo consciente e fomento cultural, sem intuito de lucro mercantil na circulação dos bens usados (configurando permuta comunitária/cessão gratuita, sem fato gerador de compra e venda comercial). O sistema não constitui moeda eletrônica, arranjo de pagamento aberto ou serviço financeiro sujeito à regulação do Banco Central do Brasil (Lei nº 12.865/2013). Ao entregar um objeto no balcão do Festival e concordar com a pontuação atribuída pela curadoria, você cede o bem de forma voluntária, definitiva e irrevogável ao acervo comunitário do evento em troca dos créditos em Desapegos, não sendo possível exigir a devolução do objeto físico original nem qualquer compensação em dinheiro após a conclusão do lançamento.</p>
      </section>
      <section>
        <h2>2. Quem pode usar e cadastro no balcão</h2>
        <ul>
          <li>Pessoas com 18 anos ou mais.</li>
          <li>Uma conta por pessoa, identificada pelo e-mail.</li>
          <li>A equipe do Festival pode cadastrar uma pessoa presencialmente no balcão, com nome e e-mail, mediante solicitação verbal da própria pessoa e apresentação do resumo destas regras no local. Nessa hipótese, um aviso é enviado ao e-mail informado e o uso efetivo da carteira digital fica condicionado à confirmação de leitura e aceite destes Termos no primeiro acesso ao app.</li>
        </ul>
      </section>
      <section>
        <h2>3. Como funciona a conta e o saldo</h2>
        <ul>
          <li>Você entra com um código de uso único enviado ao seu e-mail, sem senha. Opcionalmente, pode usar a conta Google, a digital ou o rosto do seu aparelho (passkey) ou um app autenticador. A validação por digital ou reconhecimento facial ocorre exclusivamente dentro do seu próprio aparelho; o Festival nunca coleta nem armazena sua biometria.</li>
          <li>O registro contábil de toda transação no livro da moeda é permanente e não pode ser apagado nem editado manualmente por ninguém, inclusive pela organização, para garantir que a soma de créditos da comunidade seja íntegra (sem prejuízo da desvinculação dos seus dados pessoais caso você encerre sua conta, conforme explicado no item 11).</li>
          <li>Erros operacionais são corrigidos com um estorno: uma transação inversa, feita pela equipe do Festival, que fica registrada junto da original.</li>
          <li>O saldo não expira entre uma edição e outra do Festival e não perde valor com o tempo, salvo em caso de encerramento definitivo do projeto (item 6).</li>
          <li>Para realizar envios de Desapegos quando o saldo da sua conta for superior a D$ 100, é obrigatório ativar uma proteção extra da conta (passkey com digital/rosto ou app autenticador). Receber Desapegos continua livre.</li>
          <li><strong>Saldo suficiente e saldo negativo:</strong> envios a outros participantes e retiradas de objetos no bazar só são registrados quando há saldo suficiente na sua conta; a carteira não fica negativa por essas operações. Excepcionalmente, a correção de um lançamento indevido (estorno) pode deixar o saldo negativo. Nesse caso, o saldo negativo representa exclusivamente um compromisso comunitário em moeda social — jamais gera dívida em dinheiro oficial (Reais), juros ou cobrança financeira —, e você não poderá fazer novos envios ou retiradas até que ele seja coberto pela entrega de novos objetos avaliados pelo Festival ou pelo recebimento de Desapegos de outros participantes.</li>
        </ul>
      </section>
      <section>
        <h2>4. Cédulas de papel</h2>
        <p>As cédulas físicas de Desapego convivem com o app. No Festival, a equipe pode receber cédulas e creditar o valor na sua conta, ou debitar da sua conta e entregar cédulas. Essas conversões ficam registradas como qualquer outra transação.</p>
        <p><strong>Cuidado com as cédulas:</strong> as cédulas físicas funcionam ao portador durante o evento. A organização não reembolsa nem repõe em conta digital valores referentes a cédulas de papel perdidas, extraviadas, rasgadas ou danificadas sob a guarda do participante, reservando-se o direito de recusar cédulas com indícios de adulteração ou falsificação.</p>
      </section>
      <section>
        <h2>5. Responsabilidades e uso indevido</h2>
        <ul>
          <li>Mantenha o acesso seguro ao seu e-mail e ao seu aparelho. Quem tem acesso a eles tem acesso à sua carteira.</li>
          <li>Não use a conta de outra pessoa nem crie contas para terceiros.</li>
          <li>A organização pode suspender ou desativar contas em caso de uso indevido, tais como: tentativa de fraude ou manipulação de saldos, criação de contas falsas ou duplicadas, comercialização de Desapegos por dinheiro real (R$) ou violação das normas de convivência do Festival. Uma conta desativada fica bloqueada para acesso e novas transações, preservando-se o histórico para fins de auditoria. O titular será comunicado por e-mail sobre o motivo do bloqueio e poderá apresentar contestação ou pedido de revisão pelo e-mail <a href="mailto:contato@festivaldesapeguese.com.br">contato@festivaldesapeguese.com.br</a>.</li>
          <li><strong>Sobre os objetos:</strong> todos os itens que circulam no Festival são bens usados ou doados, disponibilizados no estado de conservação em que se encontram, cabendo ao participante conferi-los no ato da retirada. A organização atua como facilitadora comunitária e não oferece garantia comercial sobre itens de segunda mão cedidos no bazar, salvo em casos de falha direta comprovada da própria organização. Nas trocas diretas combinadas livremente entre participantes fora do bazar oficial, a responsabilidade pela qualidade, entrega e procedência do item é exclusiva dos participantes envolvidos.</li>
          <li><strong>Origem dos objetos e itens proibidos:</strong> ao disponibilizar qualquer objeto no balcão do Festival ou em trocas diretas, você declara ser o legítimo proprietário do bem e garante que ele tem origem lícita e não apresenta riscos ocultos à saúde ou segurança de terceiros, isentando a organização de reclamações de terceiros. É estritamente proibida a entrega ou troca de medicamentos, cosméticos abertos ou vencidos, alimentos perecíveis, animais, produtos falsificados/piratas, armas, materiais inflamáveis ou qualquer item cuja circulação seja vedada por lei.</li>
        </ul>
      </section>
      <section>
        <h2>6. Encerramento do projeto e mudanças nos termos</h2>
        <ul>
          <li>Caso a organização decida encerrar definitivamente o aplicativo ou a Moeda Social Desapego, os participantes serão avisados por e-mail e nos canais oficiais com antecedência mínima de 90 (noventa) dias contados da data de envio do comunicado.</li>
          <li>Se apenas o aplicativo for descontinuado (mantendo-se a moeda ativa), o participante poderá converter seu saldo em cédulas físicas durante esse prazo de 90 dias. Caso a própria Moeda Social Desapego seja extinta, a organização garantirá, dentro desse período de 90 dias, a realização de pelo menos uma edição presencial do Festival ou feira específica de liquidação comunitária para que os participantes com saldo positivo possam trocá-lo efetivamente por objetos disponíveis no acervo do bazar, encerrando-se a validade dos créditos após o evento final.</li>
          <li>Estes termos podem ser atualizados. Mudanças relevantes serão comunicadas previamente por e-mail, indicando a data em que passarão a valer. Caso você não concorde com as alterações, poderá solicitar o encerramento da sua conta antes da entrada em vigor das novas regras (utilizando seu saldo vigente nas atividades do Festival ou convertendo-o em cédulas). O uso do app após a data de vigência informada valerá como aceite da nova versão.</li>
        </ul>
      </section>
      <h2 className="app-titulo texto-legal-parte">Política de Privacidade</h2>
      <section>
        <h2>7. Quem é responsável pelos dados</h2>
        <p>O controlador dos dados é a MLG Produções, CNPJ 00.814.223/0001-92, Rio de Janeiro – RJ.</p>
        <p>Encarregada pelo tratamento de dados (DPO): Renata Luci de Lara Baptista — <a href="mailto:renata@festivaldesapeguese.com.br">renata@festivaldesapeguese.com.br</a>.</p>
      </section>
      <section>
        <h2>8. Quais dados guardamos e por que tratamos</h2>
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr><th scope="col">Dado</th><th scope="col">Obrigatório?</th><th scope="col">Para quê</th><th scope="col">Base legal (LGPD)</th></tr>
            </thead>
            <tbody>
              <tr><th scope="row">Nome completo</th><td>Sim</td><td>Identificar você nas trocas e no balcão</td><td>Execução de contrato (art. 7º, V)</td></tr>
              <tr><th scope="row">E-mail</th><td>Sim</td><td>Entrar no app e receber avisos da conta</td><td>Execução de contrato (art. 7º, V)</td></tr>
              <tr><th scope="row">Telefone</th><td>Não</td><td>Contato rápido e busca pela equipe no balcão</td><td>Consentimento (art. 7º, I)</td></tr>
              <tr><th scope="row">Histórico de transações</th><td>—</td><td>Funcionamento da carteira e integridade da moeda</td><td>Execução de contrato e legítimo interesse (art. 7º, V e IX)</td></tr>
              <tr><th scope="row">Registro de alterações na conta</th><td>—</td><td>Segurança e prevenção a fraudes (quem mudou o quê e quando)</td><td>Legítimo interesse e exercício regular de direitos (art. 7º, IX e VI)</td></tr>
              <tr><th scope="row">Dados técnicos de login (sessões, chaves públicas de passkey/autenticador)</th><td>—</td><td>Autenticação segura e prevenção a acessos indevidos</td><td>Prevenção à fraude e segurança do titular (art. 11, II, “g” / art. 7º, IX)</td></tr>
              <tr><th scope="row">Registros de acesso à aplicação (IP, data e hora)</th><td>—</td><td>Guarda obrigatória de logs pelo prazo legal de 6 meses</td><td>Cumprimento de obrigação legal (art. 7º, II da LGPD c/c art. 15 do Marco Civil da Internet – Lei 12.965/2014)</td></tr>
              <tr><th scope="row">Data e versão do aceite destes termos</th><td>—</td><td>Comprovar a adesão às regras de uso e ciência desta Política</td><td>Cumprimento de obrigação legal e exercício de direitos (art. 7º, II e VI)</td></tr>
            </tbody>
          </table>
        </div>
        <p>Não pedimos CPF, documento de identidade, endereço físico nem dados financeiros ou de pagamento. Utilizamos apenas recursos técnicos estritamente necessários para manter sua sessão ativa e segura no aplicativo; não utilizamos cookies de publicidade nem ferramentas de rastreamento de terceiros.</p>
      </section>
      <section>
        <h2>9. Finalidade do tratamento</h2>
        <p>Usamos seus dados exclusivamente para operar a carteira digital da moeda social, garantir a segurança das trocas contra fraudes e nos comunicar com você sobre a sua conta (código de login, avisos de recebimento e débito, alterações cadastrais ou comunicados oficiais sobre o Festival).</p>
        <p>A maior parte dos seus dados é tratada porque é indispensável para executar o serviço gratuito que você solicitou ao aderir à carteira (art. 7º, V da Lei 13.709/2018 – LGPD), para manter a segurança e auditoria interna da comunidade contra fraudes (legítimo interesse, art. 7º, IX) e para resguardar direitos em caso de dúvidas ou disputas (art. 7º, VI). O seu consentimento específico (art. 7º, I) é utilizado apenas quando você opta livremente por fornecer dados opcionais, como o telefone.</p>
      </section>
      <section>
        <h2>10. Compartilhamento e transferência internacional</h2>
        <ul>
          <li><strong>Outros participantes:</strong> veem apenas o seu nome quando realizam ou iniciam uma transação direta com você, por exemplo ao informar o seu e-mail para enviar Desapegos (e as suas iniciais no histórico resumido deles).</li>
          <li><strong>A equipe autorizada do Festival:</strong> vê seus dados de cadastro, saldo, extrato e registros da conta, exclusivamente para atendimento no balcão, suporte e auditoria de segurança.</li>
          <li><strong>Fornecedores de tecnologia e transferência internacional:</strong> contamos com um provedor de hospedagem em nuvem (Railway Corporation) e um provedor de envio de e-mails transacionais (Resend — Plus Five Five, Inc.), ambos sediados nos Estados Unidos, que atuam apenas como operadores sob nossas instruções contratuais, sem permissão para usar seus dados para fins próprios. O armazenamento e o processamento ocorrem nos Estados Unidos. Essa transferência internacional de dados é regida pelos acordos de tratamento de dados desses provedores, que preveem cláusulas contratuais padrão e salvaguardas técnicas como criptografia em trânsito e em repouso (art. 33 da LGPD): <a href="https://railway.com/legal/dpa">acordo do provedor de hospedagem</a> e <a href="https://resend.com/legal/dpa">acordo do provedor de e-mails</a>. Você pode solicitar a lista atualizada desses fornecedores à nossa Encarregada a qualquer momento.</li>
        </ul>
        <p>Não vendemos nem compartilhamos seus dados com terceiros para fins comerciais ou publicitários.</p>
      </section>
      <section>
        <h2>11. Por quanto tempo guardamos e desvinculação de dados</h2>
        <ul>
          <li>Mantemos seus dados cadastrais enquanto sua conta estiver ativa.</li>
          <li>Os registros técnicos de conexão e acesso à aplicação (endereço IP, data e hora) são mantidos sob sigilo pelo prazo mínimo obrigatório de 6 (seis) meses, conforme exige o art. 15 da Lei nº 12.965/2014 (Marco Civil da Internet).</li>
          <li>Caso você peça o encerramento da sua conta e a exclusão dos seus dados, nós removeremos seu nome, e-mail, telefone e credenciais de acesso (salvo se houver necessidade de retenção temporária para cumprimento de obrigação legal ou defesa em processos, nos termos do art. 16 da LGPD). O encerramento é feito com o saldo da conta zerado: antes dele, use o seu saldo nas atividades do Festival ou converta-o em cédulas.</li>
          <li>Como o livro contábil da moeda social não pode ter seus valores apagados sem quebrar a soma de toda a comunidade, o histórico matemático das suas transações passadas será mantido de forma permanentemente desvinculada e anonimizada: seus dados identificáveis são eliminados e substituídos por um código irreversível, de modo que os valores continuem fechando no sistema sem que seja possível identificar você direta ou indiretamente.</li>
        </ul>
      </section>
      <section>
        <h2>12. Seus direitos e prazos de resposta</h2>
        <p>Você pode, a qualquer momento e gratuitamente, solicitar à nossa Encarregada (seção 7):</p>
        <ul>
          <li>confirmação da existência de tratamento e acesso aos seus dados;</li>
          <li>correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a LGPD;</li>
          <li>portabilidade dos dados a outro fornecedor, quando aplicável;</li>
          <li>eliminação dos dados pessoais tratados com base no seu consentimento (como o telefone) e encerramento da sua conta, com a consequente desvinculação e anonimização do seu cadastro;</li>
          <li>informação sobre as entidades com as quais compartilhamos dados;</li>
          <li>informação sobre a possibilidade de não fornecer consentimento para dados opcionais e sobre as consequências da negativa, bem como a revogação desse consentimento a qualquer momento;</li>
          <li>oposição a tratamentos realizados com fundamento em dispensa de consentimento, em caso de descumprimento da LGPD.</li>
        </ul>
        <p>Atendemos aos pedidos de confirmação e acesso aos dados de forma imediata (em formato simplificado) ou em até 15 (quinze) dias corridos (para declarações completas e demais solicitações), conforme o art. 19 da LGPD.</p>
      </section>
      <section>
        <h2>13. Segurança</h2>
        <p>Adotamos login sem senha com código de uso único; proteção extra opcional (passkey no próprio aparelho ou app autenticador), que passa a ser obrigatória para enviar quando o saldo da conta supera D$ 100; registro íntegro de toda operação; criptografia em trânsito e acesso da equipe restrito por perfil de permissão. Em caso de incidente de segurança que possa acarretar risco ou dano relevante, notificaremos os participantes afetados e a Autoridade Nacional de Proteção de Dados (ANPD), conforme a legislação.</p>
      </section>
      <section>
        <h2>14. Contato</h2>
        <p>Dúvidas gerais, suporte sobre a moeda e solicitações sobre a conta: <a href="mailto:contato@festivaldesapeguese.com.br">contato@festivaldesapeguese.com.br</a> ou pelo site <a href="https://www.festivaldesapeguese.com.br/">festivaldesapeguese.com.br</a>. Para assuntos específicos sobre proteção de dados pessoais, contate diretamente a Encarregada pelo e-mail <a href="mailto:renata@festivaldesapeguese.com.br">renata@festivaldesapeguese.com.br</a>.</p>
      </section>
      <section>
        <h2>15. Legislação e foro</h2>
        <p>Estes Termos são regidos pelas leis da República Federativa do Brasil. Caso qualquer dúvida ou controvérsia não possa ser resolvida de forma amigável pelos nossos canais de contato, fica eleito o Foro da Comarca da Capital do Estado do Rio de Janeiro – RJ, ressalvadas as disposições específicas de competência previstas na legislação aplicável.</p>
      </section>


      <p>
        <Link href="/">Voltar ao início</Link>
      </p>
    </main>
  );
}
