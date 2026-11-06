import { randomBytes } from "node:crypto";
import { and, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import type { Banco } from "./db";
import { account, auditoria, configuracao, conta, passkey, session, twoFactor, user, PAPEIS, type Papel } from "./db/schema";
import { CHAVE_LIMITE_CAIXA, LIMITE_PADRAO_CAIXA } from "./ledger";

/**
 * Gestão de pessoas pelo Caixa e pelo Admin. Como o livro (lib/ledger.ts), este
 * arquivo recebe quem está agindo e aplica as permissões da seção 3 do PRD;
 * toda mudança deixa uma linha em `auditoria`.
 */

export type Ator = { id: string; papel: Papel };

export type CodigoErroPessoa =
  | "SEM_PERMISSAO"
  | "NAO_ENCONTRADA"
  | "NOME_INVALIDO"
  | "EMAIL_INVALIDO"
  | "EMAIL_EM_USO"
  | "TELEFONE_INVALIDO"
  | "ULTIMO_ADMIN"
  | "PROPRIA_CONTA"
  | "PAPEL_INVALIDO"
  | "LIMITE_INVALIDO";

export class ErroPessoa extends Error {
  constructor(
    public codigo: CodigoErroPessoa,
    mensagem: string,
    /** Em EMAIL_EM_USO, o id de quem já usa o e-mail. */
    public pessoaId?: string,
  ) {
    super(mensagem);
    this.name = "ErroPessoa";
  }
}

// ---------------------------------------------------------------------------
// Validação (também usada pelo cadastro que a própria pessoa faz)
// ---------------------------------------------------------------------------

/** Só dígitos, com DDI. Aceita DDD + número (10 ou 11 dígitos) ou já com 55. */
export function normalizarTelefone(bruto: string): string | null | "invalido" {
  const digitos = bruto.replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) return digitos;
  return "invalido";
}

/** Nome e sobrenome, sem espaços repetidos. `null` se não for um nome completo. */
export function normalizarNome(bruto: string): string | null {
  const nome = bruto.trim().replace(/\s+/g, " ");
  if (nome.length > 120 || nome.split(" ").filter((p) => p.length >= 2).length < 2) return null;
  return nome;
}

export function normalizarEmail(bruto: string): string | null {
  const email = bruto.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function validar(dados: { nome: string; email: string; telefone: string }) {
  const nome = normalizarNome(dados.nome);
  if (!nome) throw new ErroPessoa("NOME_INVALIDO", "Informe o nome completo (nome e sobrenome).");
  const email = normalizarEmail(dados.email);
  if (!email) throw new ErroPessoa("EMAIL_INVALIDO", "Esse e-mail não parece válido.");
  const telefone = normalizarTelefone(dados.telefone);
  if (telefone === "invalido") {
    throw new ErroPessoa("TELEFONE_INVALIDO", "Telefone inválido. Use DDD + número, ou deixe em branco.");
  }
  return { nome, email, telefone };
}

// ---------------------------------------------------------------------------
// Permissões
// ---------------------------------------------------------------------------

const ehEquipe = (papel: Papel) => papel === "caixa" || papel === "admin";

/** Editar e desativar: o Caixa só mexe em usuário comum; o Admin, em qualquer um. */
export function podeGerenciar(ator: Ator, alvo: { papel: Papel }): boolean {
  return ator.papel === "admin" || (ator.papel === "caixa" && alvo.papel === "usuario");
}

function exigirEquipe(ator: Ator) {
  if (!ehEquipe(ator.papel)) throw new ErroPessoa("SEM_PERMISSAO", "Restrito a Caixa e Admin.");
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

const colunas = {
  id: user.id,
  nome: user.name,
  email: user.email,
  telefone: user.telefone,
  papel: user.papel,
  ativo: user.ativo,
  criadaEm: user.createdAt,
  termosAceitosEm: user.termosAceitosEm,
  saldo: sql<number>`coalesce(${conta.saldo}, 0)`.mapWith(Number),
  /** Limite individual; nulo = o padrão do perfil. */
  limiteNegativo: conta.limiteNegativo,
  numero: sql<number>`coalesce(${conta.numero}, 0)`.mapWith(Number),
};

export type PessoaResumo = Awaited<ReturnType<typeof buscarPessoas>>[number];

/**
 * Busca por nome, e-mail, telefone ou número da conta (o "412" de
 * DES-2026-00412). Sem termo, devolve as cadastradas mais recentemente.
 */
export async function buscarPessoas(db: Banco, ator: Ator, termo: string, limite = 30) {
  exigirEquipe(ator);
  const texto = termo.trim().slice(0, 120);
  // % e _ são curingas do LIKE: escapados, valem como texto.
  const padrao = `%${texto.replace(/[\\%_]/g, "\\$&")}%`;
  const digitos = texto.replace(/\D/g, "");
  const serie = /^des-\d{4}-(\d+)$/i.exec(texto)?.[1];
  const numero = serie ?? (/^\d{1,9}$/.test(texto) ? texto : null);

  const filtros = [ilike(user.name, padrao), ilike(user.email, padrao)];
  if (digitos.length >= 4) filtros.push(ilike(user.telefone, `%${digitos}%`));
  if (numero) filtros.push(eq(conta.numero, Number(numero)));

  return db
    .select(colunas)
    .from(user)
    .leftJoin(conta, eq(conta.usuarioId, user.id))
    .where(texto ? or(...filtros) : undefined)
    .orderBy(texto ? user.name : desc(user.createdAt))
    .limit(Math.min(Math.max(limite, 1), 100));
}

export async function obterPessoa(db: Banco, ator: Ator, id: string) {
  exigirEquipe(ator);
  const [pessoa] = await db
    .select(colunas)
    .from(user)
    .leftJoin(conta, eq(conta.usuarioId, user.id))
    .where(eq(user.id, id));
  return pessoa ?? null;
}

export type LinhaAuditoria = {
  id: string;
  criadaEm: Date;
  acao: string;
  detalhes: Record<string, unknown>;
  atorNome: string | null;
};

/** O que aconteceu com a conta de uma pessoa, do mais recente para o mais antigo. */
export async function listarAuditoria(
  db: Banco,
  ator: Ator,
  alvoId: string,
  limite = 30,
): Promise<LinhaAuditoria[]> {
  exigirEquipe(ator);
  const linhas = await db
    .select({
      id: auditoria.id,
      criadaEm: auditoria.criadaEm,
      acao: auditoria.acao,
      detalhes: auditoria.detalhes,
      atorNome: user.name,
    })
    .from(auditoria)
    .leftJoin(user, eq(user.id, auditoria.atorId))
    .where(eq(auditoria.alvoId, alvoId))
    .orderBy(desc(auditoria.criadaEm))
    .limit(limite);
  return linhas.map((l) => ({ ...l, detalhes: (l.detalhes ?? {}) as Record<string, unknown> }));
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

async function emailEmUso(db: Banco, email: string, excetoId?: string) {
  const [outra] = await db
    .select({ id: user.id })
    .from(user)
    .where(excetoId ? and(eq(user.email, email), ne(user.id, excetoId)) : eq(user.email, email));
  return outra?.id ?? null;
}

/**
 * Cadastro no balcão. A pessoa já pode receber; os termos ela aceita no
 * primeiro login, e é esse login (com o código enviado ao e-mail) que prova
 * que o endereço é dela.
 */
export async function criarPessoa(
  db: Banco,
  ator: Ator,
  dados: { nome: string; email: string; telefone: string },
): Promise<{ id: string }> {
  exigirEquipe(ator);
  const { nome, email, telefone } = validar(dados);

  const existente = await emailEmUso(db, email);
  if (existente) {
    throw new ErroPessoa("EMAIL_EM_USO", "Já existe uma conta com esse e-mail.", existente);
  }

  const id = randomBytes(24).toString("base64url");
  await db.transaction(async (tx) => {
    await tx.insert(user).values({ id, name: nome, email, telefone, emailVerified: false });
    await tx.insert(conta).values({ usuarioId: id });
    await tx.insert(auditoria).values({
      atorId: ator.id,
      alvoId: id,
      acao: "cadastrada_pelo_caixa",
      detalhes: { nome, email, telefone },
    });
  });
  return { id };
}

export type Alteracoes = Partial<Record<"nome" | "email" | "telefone", { de: string | null; para: string | null }>>;

/**
 * Corrige os dados de alguém. Trocar o e-mail troca a chave de login, então
 * derruba as sessões e os vínculos (Google) antigos: quem tinha o e-mail velho
 * deixa de entrar, e o novo só vale depois de provado com o código.
 */
export async function editarPessoa(
  db: Banco,
  ator: Ator,
  alvoId: string,
  dados: { nome: string; email: string; telefone: string },
): Promise<{ alteracoes: Alteracoes; emailAntigo: string }> {
  exigirEquipe(ator);
  const { nome, email, telefone } = validar(dados);

  return db.transaction(async (tx) => {
    const [alvo] = await tx.select().from(user).where(eq(user.id, alvoId)).for("update");
    if (!alvo) throw new ErroPessoa("NAO_ENCONTRADA", "Pessoa não encontrada.");
    if (!podeGerenciar(ator, alvo)) {
      throw new ErroPessoa("SEM_PERMISSAO", "Só um Admin pode alterar os dados de Caixa e Admin.");
    }

    const alteracoes: Alteracoes = {};
    if (alvo.name !== nome) alteracoes.nome = { de: alvo.name, para: nome };
    if (alvo.email !== email) alteracoes.email = { de: alvo.email, para: email };
    if ((alvo.telefone ?? null) !== telefone) alteracoes.telefone = { de: alvo.telefone ?? null, para: telefone };
    if (Object.keys(alteracoes).length === 0) return { alteracoes, emailAntigo: alvo.email };

    if (alteracoes.email) {
      const outra = await emailEmUso(tx as unknown as Banco, email, alvoId);
      if (outra) throw new ErroPessoa("EMAIL_EM_USO", "Já existe uma conta com esse e-mail.", outra);
      await tx.delete(session).where(eq(session.userId, alvoId));
      await tx.delete(account).where(eq(account.userId, alvoId));
    }

    await tx
      .update(user)
      .set({
        name: nome,
        email,
        telefone,
        updatedAt: new Date(),
        ...(alteracoes.email ? { emailVerified: false } : {}),
      })
      .where(eq(user.id, alvoId));
    await tx.insert(auditoria).values({
      atorId: ator.id,
      alvoId,
      acao: "dados_alterados",
      detalhes: alteracoes,
    });
    return { alteracoes, emailAntigo: alvo.email };
  });
}

/**
 * Desativa ou reativa. Nada é apagado: saldo e histórico ficam, a pessoa só
 * deixa de entrar e de transacionar.
 */
export async function definirAtivo(db: Banco, ator: Ator, alvoId: string, ativo: boolean): Promise<void> {
  exigirEquipe(ator);
  if (ator.id === alvoId) {
    throw new ErroPessoa("PROPRIA_CONTA", "Você não pode desativar a própria conta.");
  }

  await db.transaction(async (tx) => {
    const [alvo] = await tx.select().from(user).where(eq(user.id, alvoId)).for("update");
    if (!alvo) throw new ErroPessoa("NAO_ENCONTRADA", "Pessoa não encontrada.");
    if (!podeGerenciar(ator, alvo)) {
      throw new ErroPessoa("SEM_PERMISSAO", "Só um Admin pode desativar Caixa e Admin.");
    }
    if (alvo.ativo === ativo) return;

    if (!ativo && alvo.papel === "admin") {
      const [{ outros }] = await tx
        .select({ outros: sql<number>`count(*)::int` })
        .from(user)
        .where(and(eq(user.papel, "admin"), eq(user.ativo, true), ne(user.id, alvoId)));
      if (outros === 0) throw new ErroPessoa("ULTIMO_ADMIN", "O sistema não pode ficar sem Admin.");
    }

    await tx.update(user).set({ ativo, updatedAt: new Date() }).where(eq(user.id, alvoId));
    if (!ativo) await tx.delete(session).where(eq(session.userId, alvoId));
    await tx.insert(auditoria).values({
      atorId: ator.id,
      alvoId,
      acao: ativo ? "reativada" : "desativada",
      detalhes: {},
    });
  });
}

// ---------------------------------------------------------------------------
// Só Admin: perfis e limites
// ---------------------------------------------------------------------------

function exigirAdmin(ator: Ator) {
  if (ator.papel !== "admin") throw new ErroPessoa("SEM_PERMISSAO", "Restrito a Admin.");
}

const LIMITE_MAXIMO = 1_000_000;

function validarLimite(valor: number) {
  if (!Number.isInteger(valor) || valor < 0 || valor > LIMITE_MAXIMO) {
    throw new ErroPessoa("LIMITE_INVALIDO", "O limite precisa ser um número inteiro, de 0 a 1.000.000.");
  }
}

/**
 * Promove ou rebaixa. Ninguém muda o próprio perfil (um Admin não se tranca
 * para fora por engano) e o sistema nunca fica sem Admin ativo. Rebaixar quem
 * está negativo é permitido: a conta só fica impedida de enviar até voltar ao
 * limite novo.
 */
export async function definirPapel(
  db: Banco,
  ator: Ator,
  alvoId: string,
  papel: Papel,
): Promise<{ de: Papel; para: Papel; email: string }> {
  exigirAdmin(ator);
  if (!PAPEIS.includes(papel)) throw new ErroPessoa("PAPEL_INVALIDO", "Perfil inválido.");
  if (ator.id === alvoId) throw new ErroPessoa("PROPRIA_CONTA", "Você não pode mudar o próprio perfil.");

  return db.transaction(async (tx) => {
    const [alvo] = await tx.select().from(user).where(eq(user.id, alvoId)).for("update");
    if (!alvo) throw new ErroPessoa("NAO_ENCONTRADA", "Pessoa não encontrada.");
    if (alvo.papel === papel) return { de: alvo.papel, para: papel, email: alvo.email };

    if (alvo.papel === "admin" && alvo.ativo) {
      const [{ outros }] = await tx
        .select({ outros: sql<number>`count(*)::int` })
        .from(user)
        .where(and(eq(user.papel, "admin"), eq(user.ativo, true), ne(user.id, alvoId)));
      if (outros === 0) throw new ErroPessoa("ULTIMO_ADMIN", "O sistema não pode ficar sem Admin.");
    }

    await tx.update(user).set({ papel, updatedAt: new Date() }).where(eq(user.id, alvoId));
    await tx.insert(auditoria).values({
      atorId: ator.id,
      alvoId,
      acao: "papel_alterado",
      detalhes: { de: alvo.papel, para: papel },
    });
    return { de: alvo.papel, para: papel, email: alvo.email };
  });
}

/**
 * Limite negativo individual: um Caixa com limite próprio ou um usuário com
 * crédito especial. `null` volta ao padrão do perfil.
 */
export async function definirLimite(db: Banco, ator: Ator, alvoId: string, limite: number | null): Promise<void> {
  exigirAdmin(ator);
  if (limite !== null) validarLimite(limite);

  await db.transaction(async (tx) => {
    const [alvo] = await tx.select({ papel: user.papel }).from(user).where(eq(user.id, alvoId));
    if (!alvo) throw new ErroPessoa("NAO_ENCONTRADA", "Pessoa não encontrada.");
    if (alvo.papel === "admin") {
      throw new ErroPessoa("LIMITE_INVALIDO", "Admin não tem limite negativo.");
    }
    await tx.insert(conta).values({ usuarioId: alvoId }).onConflictDoNothing();
    const [atual] = await tx.select().from(conta).where(eq(conta.usuarioId, alvoId)).for("update");
    if (atual.limiteNegativo === limite) return;

    await tx.update(conta).set({ limiteNegativo: limite }).where(eq(conta.usuarioId, alvoId));
    await tx.insert(auditoria).values({
      atorId: ator.id,
      alvoId,
      acao: "limite_alterado",
      detalhes: { de: atual.limiteNegativo, para: limite },
    });
  });
}

export async function obterLimitePadraoCaixa(db: Banco): Promise<number> {
  const [linha] = await db
    .select({ valor: configuracao.valor })
    .from(configuracao)
    .where(eq(configuracao.chave, CHAVE_LIMITE_CAIXA));
  return linha?.valor ?? LIMITE_PADRAO_CAIXA;
}

/** O limite de todo Caixa que não tem limite individual. */
export async function definirLimitePadraoCaixa(db: Banco, ator: Ator, valor: number): Promise<void> {
  exigirAdmin(ator);
  validarLimite(valor);
  await db.transaction(async (tx) => {
    const anterior = await obterLimitePadraoCaixa(tx as unknown as Banco);
    if (anterior === valor) return;
    await tx
      .insert(configuracao)
      .values({ chave: CHAVE_LIMITE_CAIXA, valor })
      .onConflictDoUpdate({ target: configuracao.chave, set: { valor } });
    await tx.insert(auditoria).values({
      atorId: ator.id,
      acao: "limite_padrao_caixa",
      detalhes: { de: anterior, para: valor },
    });
  });
}

/** Caixas e Admins, para a tela de equipe. */
export async function listarEquipe(db: Banco, ator: Ator) {
  exigirAdmin(ator);
  return db
    .select(colunas)
    .from(user)
    .leftJoin(conta, eq(conta.usuarioId, user.id))
    .where(ne(user.papel, "usuario"))
    .orderBy(user.papel, user.name);
}

export type LinhaAuditoriaGlobal = LinhaAuditoria & { alvoId: string | null; alvoNome: string | null };

/** Tudo o que foi registrado, de todas as contas, do mais recente para o mais antigo. */
export async function listarAuditoriaGlobal(
  db: Banco,
  ator: Ator,
  opcoes: { limite?: number; pular?: number } = {},
): Promise<LinhaAuditoriaGlobal[]> {
  exigirAdmin(ator);
  const resultado = await db.execute(sql`
    select a.id, a.criada_em, a.acao, a.detalhes, a.alvo_id,
           quem.name as ator_nome, alvo.name as alvo_nome
    from ${auditoria} a
    left join ${user} quem on quem.id = a.ator_id
    left join ${user} alvo on alvo.id = a.alvo_id
    order by a.criada_em desc, a.id desc
    limit ${Math.min(Math.max(opcoes.limite ?? 50, 1), 200)} offset ${Math.max(opcoes.pular ?? 0, 0)}
  `);
  const linhas = ("rows" in resultado ? resultado.rows : resultado) as unknown as Record<string, never>[];
  return linhas.map((l) => ({
    id: l.id,
    criadaEm: new Date(l.criada_em),
    acao: l.acao,
    detalhes: (l.detalhes ?? {}) as Record<string, unknown>,
    atorNome: l.ator_nome,
    alvoId: l.alvo_id,
    alvoNome: l.alvo_nome,
  }));
}

/**
 * Para quem perdeu o aparelho: apaga passkeys, autenticador e códigos de
 * recuperação. A pessoa volta a entrar só com o código por e-mail e pode
 * ativar a proteção de novo. Devolve se havia algo para remover.
 */
export async function removerSegundoFator(db: Banco, ator: Ator, alvoId: string): Promise<{ email: string; removeu: boolean }> {
  exigirAdmin(ator);
  return db.transaction(async (tx) => {
    const [alvo] = await tx.select().from(user).where(eq(user.id, alvoId)).for("update");
    if (!alvo) throw new ErroPessoa("NAO_ENCONTRADA", "Pessoa não encontrada.");
    const chaves = await tx.delete(passkey).where(eq(passkey.userId, alvoId)).returning({ id: passkey.id });
    const totp = await tx.delete(twoFactor).where(eq(twoFactor.userId, alvoId)).returning({ id: twoFactor.id });
    const removeu = chaves.length > 0 || totp.length > 0 || alvo.twoFactorEnabled;
    if (!removeu) return { email: alvo.email, removeu };
    await tx.update(user).set({ twoFactorEnabled: false, updatedAt: new Date() }).where(eq(user.id, alvoId));
    await tx.insert(auditoria).values({
      atorId: ator.id,
      alvoId,
      acao: "segundo_fator_removido",
      detalhes: { passkeys: chaves.length, autenticador: totp.length > 0 || alvo.twoFactorEnabled },
    });
    return { email: alvo.email, removeu };
  });
}

/** Quantas passkeys a pessoa tem e se o autenticador está ativo, para a ficha. */
export async function protecaoDaConta(db: Banco, ator: Ator, alvoId: string) {
  exigirEquipe(ator);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(passkey)
    .where(eq(passkey.userId, alvoId));
  const [alvo] = await db.select({ ativo: user.twoFactorEnabled }).from(user).where(eq(user.id, alvoId));
  return { passkeys: total, autenticador: alvo?.ativo ?? false };
}
