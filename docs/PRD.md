# PRD — App da Moeda Social Desapego

Status: rascunho para revisão · Última atualização: 2026-11-05

## 1. Visão geral

Um site/PWA, instalável no celular, para que participantes do Festival Desapegue-se recebam, guardem e enviem **Desapego (D$)**, uma moeda local de crédito mútuo.

A pessoa leva um objeto ao bazar de trocas, o Caixa avalia e credita Desapegos na conta dela. Com esse saldo ela adquire outros objetos no bazar ou transfere para outras pessoas.

**Não é** um app de loja (Play Store / App Store), não tem conversão para Real e não funciona offline.

### Objetivos

- Qualquer pessoa consegue se cadastrar e receber Desapegos em menos de 2 minutos, no balcão do evento.
- Enviar e receber entre pessoas com QR code, em poucos toques.
- O Caixa opera rápido no balcão: achar a pessoa, Dar ou Tomar, pronto.
- A organização consegue auditar tudo: cada Desapego tem origem, destino, autor e motivo.

### Escala esperada

Próximo evento: cerca de 300 usuários cadastrados, num evento de 1.000 a 5.000 pessoas. Poucos operadores de Caixa simultâneos.

## 2. Regras da moeda

Estas regras são o núcleo do sistema e valem para qualquer tela ou perfil.

1. **Soma zero.** Toda transação tira um valor de uma conta e põe o mesmo valor em outra. A soma de todos os saldos é sempre 0. Não existe "criar" nem "destruir" moeda: a moeda em circulação é o espelho do saldo negativo de Caixas e Admins.
2. **Valores inteiros.** Mínimo de 1 D$ por transação, sem centavos.
3. **Uma conta por pessoa.** Usuário, Caixa e Admin têm cada um a sua conta individual. Não há conta compartilhada.
4. **Limite negativo por conta:**

   | Perfil | Limite padrão | Quem altera |
   |---|---|---|
   | Usuário | 0 (não fica negativo) | Admin pode dar limite especial a uma pessoa |
   | Caixa | −1000 (padrão global configurável) | Admin altera o padrão global ou o limite de um Caixa específico |
   | Admin | sem limite | — |

5. **O limite vale para quem inicia a saída.** Uma pessoa não consegue enviar ou Dar além do próprio limite. A exceção é o **Tomar**: o Caixa pode deixar o usuário negativo (caso de compra no bazar), depois de um aviso explícito na tela.
6. **Transações são imutáveis.** Nada é editado ou apagado. Erros se corrigem com um **estorno**: uma transação inversa, vinculada à original, feita por Caixa ou Admin.
7. **Saldo não expira** e não sofre desconto com o tempo.
8. **Sem teto por transação.** Valores acima de 1000 D$ pedem uma confirmação extra.
9. **Transações funcionam o ano todo**, dentro ou fora de uma edição do festival.

### Cédulas de papel

As cédulas físicas continuam existindo e convivem com o app. A conversão é feita pelo Caixa e fica registrada com tipo próprio:

- **Depósito de cédula:** a pessoa entrega cédulas, o Caixa credita o valor na conta dela (sai do saldo do Caixa).
- **Saque em cédula:** o Caixa debita o valor da conta da pessoa (entra no saldo do Caixa) e entrega cédulas.

O livro digital permanece em soma zero; o relatório mostra o total depositado e sacado em papel por período.

## 3. Perfis e permissões

| Ação | Usuário | Caixa | Admin |
|---|:-:|:-:|:-:|
| Ver saldo e extrato próprios | ✔ | ✔ | ✔ |
| Enviar e receber (QR ou e-mail) | ✔ | ✔ | ✔ |
| Listar, buscar e cadastrar usuários | | ✔ | ✔ |
| Ver detalhes, extrato e log de auditoria de um usuário | | ✔ | ✔ |
| Editar dados e desativar usuário comum | | ✔ | ✔ |
| Editar ou desativar Caixa e Admin | | | ✔ |
| Dar / Tomar / depósito e saque de cédula | | ✔ | ✔ |
| Tomar de um Admin | | ✘ | ✔ |
| Estornar transação | | ✔ (as suas) | ✔ (qualquer) |
| Promover / rebaixar perfil | | | ✔ |
| Definir limites negativos | | | ✔ |
| Gerenciar edições do festival | | | ✔ |
| Relatórios e export CSV | | | ✔ |

Regras adicionais:

- O sistema nunca fica sem Admin: o último Admin não pode ser rebaixado nem desativado.
- O primeiro Admin é definido por configuração do servidor (lista de e-mails).
- Usuários nunca são apagados, só **desativados**. Conta desativada não faz login nem transaciona; saldo e histórico ficam preservados.

## 4. Funcionalidades

### 4.1 Cadastro e login

**Cadastro**

- Campos: nome completo, e-mail (obrigatório, é a chave de login), telefone (opcional, guardado sem validação para uso futuro).
- Aceite obrigatório: declaração de ter 18 anos ou mais, termos de uso e consentimento LGPD. Data e versão do aceite ficam registradas.
- Dois caminhos: a própria pessoa pelo site, ou o Caixa no balcão.
- **No balcão a pessoa não precisa entrar no app para receber.** O Caixa cadastra nome e e-mail, credita, e ela recebe um e-mail avisando do saldo. O aceite dos termos acontece no primeiro login, quando ela quiser usar o saldo.

**Login sem senha**

Três formas de entrar, todas levando à mesma conta (identificada pelo e-mail):

- **Código por e-mail** (base, funciona em qualquer aparelho): a pessoa informa o e-mail e recebe um código de 6 dígitos, válido por 10 minutos e de uso único. Limite de tentativas e de reenvios por e-mail e por IP.
- **Entrar com Google:** um toque, sem código, usando o e-mail verificado da conta Google.
- **Passkey** (digital, rosto ou PIN do celular): oferecido logo após o primeiro acesso; daí em diante a entrada é um toque, sem e-mail.

Demais regras:

- Sem link mágico: no iPhone ele abre no Safari e não no PWA instalado.
- Sessão longa no aparelho (90 dias), com opção "sair".
- Se o app for aberto no navegador embutido do Instagram ou WhatsApp, ele orienta a abrir no Chrome ou Safari, onde passkey e instalação funcionam.

**Segundo fator (2FA)**

- Disponível a todos como opcional e **obrigatório quando o saldo passa de 100 D$**.
- O segundo fator é o **passkey**. Para aparelhos que não suportam (sem bloqueio de tela ou muito antigos), a alternativa é **app autenticador (TOTP)**. Códigos de recuperação são gerados na ativação.
- Com saldo acima de 100 e sem 2FA: a pessoa continua **recebendo** normalmente, mas precisa ativar o passkey (ou TOTP) antes de **enviar**.
- Com 2FA ativo, entrar por código de e-mail ou Google em aparelho novo também pede o segundo fator; entrar direto com passkey já satisfaz os dois.
- Perda do segundo fator: Admin pode resetar, com registro no log de auditoria e aviso por e-mail.

### 4.2 Carteira (todos os perfis)

**Tela inicial**

- Saldo em destaque, botões **Receber** e **Enviar**, últimas transações.
- Atualização em tempo real: ao receber, o saldo muda e aparece um aviso na tela sem recarregar.

**Receber**

- Mostra o QR code fixo da pessoa (identifica a conta, sem valor) e o nome.
- Quando chega um valor, a tela mostra a confirmação na hora.

**Enviar**

1. Abre a câmera e lê o QR do destinatário. Alternativa: digitar o e-mail.
2. Mostra o nome do destinatário para conferência.
3. Pessoa digita valor e descrição (opcional entre usuários).
4. Tela de confirmação; acima de 1000 D$, confirmação extra.
5. Comprovante na tela.

- Destinatário precisa ter conta ativa; caso contrário o envio é bloqueado com a mensagem "essa pessoa ainda não tem conta".
- Envio por telefone fica fora da v1, porque o telefone não é validado e permitiria enviar para a pessoa errada.
- Saldo insuficiente bloqueia o envio e mostra quanto falta.

**Histórico**

- Lista paginada com data, contraparte, valor (+/−), descrição e tipo.
- Detalhe da transação com identificador, usado para pedir estorno.

**Avisos por e-mail**

- Ao receber Desapegos.
- Ao ter Desapegos tomados pelo Caixa.
- Ao ter dados de contato alterados por outra pessoa (enviado para o e-mail **antigo**).
- Ao ter 2FA ativado, resetado ou perfil alterado.

### 4.3 Caixa

**Painel**

- Saldo próprio, limite e quanto ainda pode distribuir.
- Busca de usuário por nome, e-mail ou telefone, e leitura do QR da pessoa.

**Gestão de usuários**

- Lista com busca, cadastro, edição e desativação.
- Tela do usuário: dados, saldo, extrato, log de auditoria da conta e botões de operação.
- Toda edição de dados vai para o log de auditoria da conta (quem, quando, valor antigo e novo).

**Operações** (sempre entre a conta do operador e a do usuário). Na tela do Caixa, Dar aparece como **Pagar** e Tomar como **Receber**; este documento e o livro mantêm os nomes Dar e Tomar.

| Operação | Efeito | Descrição |
|---|---|---|
| Dar | Caixa → usuário | Obrigatória (o objeto deixado) |
| Tomar | Usuário → Caixa | Obrigatória (o objeto levado) |
| Depósito de cédula | Caixa → usuário | Automática, com valor |
| Saque em cédula | Usuário → Caixa | Automática, com valor |
| Estorno | Inverte uma transação | Motivo obrigatório |

- **Dar** e **depósito** são bloqueados se levarem o Caixa além do limite dele; a tela mostra quanto ainda está disponível.
- **Tomar** e **saque** que deixariam o usuário negativo mostram um aviso com o saldo resultante e exigem confirmação.
- Tomar de Admin é bloqueado para o perfil Caixa.
- Se houver uma edição do festival ativa na data, a transação é marcada com ela automaticamente.

### 4.4 Admin

Tudo o que o Caixa faz, sem limite negativo, mais:

**Perfis e limites**

- Promover e rebaixar entre Usuário, Caixa e Admin.
- Definir o limite negativo padrão do perfil Caixa.
- Definir limite individual para um Caixa ou limite especial para um usuário comum.
- Rebaixar um Caixa com saldo negativo é permitido; a conta fica impedida de enviar até voltar ao limite novo.

**Edições do festival**

- Cadastro de edições com nome, data de início e data de fim.
- Servem só para registro e filtro de relatório; não bloqueiam transações fora do período.

**Relatórios**

- Filtros: período, edição, tipo de transação, operador, usuário.
- Indicadores:
  - volume total (soma do valor das transações no período);
  - saldo negativo total da organização (soma dos saldos negativos de Caixas e Admins, ou seja, a moeda em circulação);
  - número de transações e de usuários ativos;
  - total depositado e sacado em cédulas;
  - os 10 maiores saldos positivos e os 10 maiores negativos;
  - verificação de integridade: soma de todos os saldos = 0.
- Gráfico de entradas e saídas por período (dia, semana, mês).
- Lista completa de transações com export **CSV**.
- Log de auditoria global (mudanças de perfil, limites, dados de contato, resets de 2FA, estornos).

## 5. Requisitos não funcionais

**PWA**

- Instalável em Android e iOS (manifesto, ícones, tela cheia), com orientação de "adicionar à tela inicial".
- Exige conexão; sem internet mostra uma tela clara de "sem conexão" e não enfileira transações.
- Pensado para celular primeiro; telas de Admin também utilizáveis em desktop.

**Integridade financeira**

- Cada transação é atômica: débito, crédito e checagem de limite acontecem juntos ou não acontecem.
- Proteção contra envio duplicado (toque duplo ou reenvio por rede ruim): cada tentativa tem um identificador único e só é processada uma vez.
- Saldos sempre reconstruíveis a partir do histórico de transações.

**Segurança e privacidade**

- Códigos de login com validade curta, uso único e limite de tentativas.
- Permissões checadas no servidor em toda ação.
- Dados pessoais mínimos (sem CPF). Usuário comum vê de terceiros apenas o nome.
- LGPD: consentimento registrado, e pedido de anonimização tratado pelo Admin (dados pessoais removidos, transações preservadas).

**Idioma:** português do Brasil.

## 6. Abordagem técnica (resumo)

- **Mesmo repositório e domínio** da landing: Next.js, com o app sob `/app`.
- **Banco:** PostgreSQL no Railway.
- **E-mail transacional:** provedor a definir (ex.: Resend), com domínio próprio autenticado.
- **Login com Google:** exige credenciais OAuth criadas no Google Cloud pela organização.
- **Passkey:** WebAuthn, vinculado ao domínio do app (vale tanto no navegador quanto no PWA instalado).
- **Tempo real:** conexão aberta com o servidor (SSE), com consulta periódica como reserva.
- **QR:** leitura pela câmera no navegador; o QR contém um link do app com o identificador público da conta.

O detalhamento (modelo de dados, rotas, bibliotecas) fica para o plano de implementação.

## 7. Entregas

A ordem prioriza o que o balcão precisa.

| Etapa | Conteúdo | Resultado |
|---|---|---|
| 1. Base ✅ | Banco, cadastro, login por e-mail e Google, perfis, livro de transações com soma zero e limites | Contas existem e o núcleo é confiável |
| 2. Carteira ✅ | Saldo, histórico, Receber (QR), Enviar (câmera e e-mail), tempo real, PWA instalável | Pessoas trocam entre si |
| 3. Caixa ✅ | Busca e gestão de usuários, Dar/Tomar, cédulas, estorno, log de auditoria, e-mails de aviso | Balcão do evento operável |
| 4. Admin ✅ | Perfis e limites, lista de transações com CSV, indicadores | Organização audita |
| 5. Complementos ✅ | Passkey e 2FA (com TOTP), edições do festival, gráfico por período | Escopo completo da v1 |

O próximo evento é em 29/11/2026. O cadastro abre assim que o app subir, sem depender do evento. Se o prazo apertar, a etapa 5 pode ir ao ar depois sem impedir a operação.

## 8. Fora da v1

- Login e avisos por SMS ou WhatsApp, e validação de telefone.
- Envio por número de telefone.
- Notificações push.
- QR com valor pré-definido.
- Envio para quem ainda não tem conta.
- Transações offline.
- Catálogo ou estoque de objetos do bazar.
- Outros idiomas.

## 9. Decisões em aberto

1. **2FA e o balcão:** quem recebe mais de 100 D$ no evento precisará ativar o passkey antes de enviar. Confirmar se esse atrito é aceitável ou se o gatilho deve ser só no próximo login.
2. **Maioridade:** caixa de seleção "tenho 18 anos ou mais" (proposto) ou data de nascimento.
3. **Estorno pelo Caixa:** só das próprias operações (proposto) ou de qualquer transação.
4. **Caixa editando outros Caixas e Admins:** bloqueado (proposto).
5. **Textos legais:** quem redige os termos de uso e a política de privacidade.
