import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { corDaPessoa, dataHora, iniciais, inteiro, numeroCurto, numeroDeSerie } from "@/lib/formato";
import { listarExtrato } from "@/lib/ledger";
import { listarAuditoria, obterPessoa, podeGerenciar, type LinhaAuditoria } from "@/lib/pessoas";
import { Nota, tamanhoDoNumero } from "../../../../pecas";
import { Extrato } from "../../../extrato";
import { Topo } from "../../../topo";
import { alternarAtivo } from "../../acoes";
import { exigirEquipe, NOME_PAPEL, VOLTAR_AO_CAIXA } from "../../equipe";

const AVISOS: Record<string, string> = {
  cadastrada: "Pessoa cadastrada. Ela já pode receber Desapegos.",
  alterada: "Dados atualizados.",
  desativada: "Conta desativada. Saldo e histórico foram preservados.",
  reativada: "Conta reativada.",
  "erro:ULTIMO_ADMIN": "Não foi possível: o sistema não pode ficar sem Admin.",
  "erro:SEM_PERMISSAO": "Não foi possível: só um Admin pode fazer isso.",
  "erro:PROPRIA_CONTA": "Você não pode desativar a própria conta.",
};

const CAMPOS: Record<string, string> = { nome: "nome", email: "e-mail", telefone: "telefone" };

function descreverAuditoria(linha: LinhaAuditoria): string {
  const d = linha.detalhes;
  switch (linha.acao) {
    case "cadastrada_pelo_caixa":
      return "Cadastrada no balcão";
    case "termos_aceitos":
      return `Aceitou os termos (versão ${String(d.versao ?? "?")})`;
    case "desativada":
      return "Conta desativada";
    case "reativada":
      return "Conta reativada";
    case "papel_alterado":
      return `Perfil alterado de ${String(d.de)} para ${String(d.para)}`;
    case "estorno":
      return `Estorno feito (${String(d.motivo ?? "sem motivo")})`;
    case "dados_alterados":
      return (
        "Dados alterados: " +
        Object.entries(d as Record<string, { de: string | null; para: string | null }>)
          .map(([campo, v]) => `${CAMPOS[campo] ?? campo} de “${v.de ?? "vazio"}” para “${v.para ?? "vazio"}”`)
          .join("; ")
      );
    default:
      return linha.acao;
  }
}

export default async function Pessoa({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string; feito?: string; a?: string }>;
}) {
  const ator = await exigirEquipe();
  const { id } = await params;
  const { aviso, feito, a: cursor } = await searchParams;
  const pessoa = await obterPessoa(db, ator, id);
  if (!pessoa) notFound();

  const [{ linhas, proximo }, auditoria] = await Promise.all([
    listarExtrato(db, id, { limite: 10, cursor: cursor ?? null }),
    listarAuditoria(db, ator, id),
  ]);

  const nome = pessoa.nome || "Sem nome";
  const papel = NOME_PAPEL[pessoa.papel];
  const saldoTexto = `${pessoa.saldo < 0 ? "−" : ""}${inteiro(Math.abs(pessoa.saldo))}`;
  const ehAPropria = ator.id === id;
  const podeTomar = !(ator.papel === "caixa" && pessoa.papel === "admin");
  const gerencia = podeGerenciar(ator, pessoa);
  const base = `/app/caixa/pessoa/${id}`;

  return (
    <>
      <Topo titulo="Pessoa" voltar={VOLTAR_AO_CAIXA} />

      {aviso && AVISOS[aviso] && (
        <p className={aviso.startsWith("erro:") ? "mensagem mensagem--erro" : "feito"} role="status">
          {AVISOS[aviso]}
        </p>
      )}
      {feito && (
        <p className="feito" role="status">
          Feito. <Link href={`/app/caixa/transacao/${feito}`}>Ver a transação {numeroCurto(feito)}</Link>
        </p>
      )}

      <section className="conta-quem">
        <span className="avatar" style={{ background: corDaPessoa(id) }} aria-hidden="true">
          {iniciais(nome)}
        </span>
        <h2 className="receber-nome">{nome}</h2>
        <p className="etiquetas">
          {papel && <span className="selo">{papel}</span>}
          {!pessoa.ativo && <span className="selo selo--alerta">Desativada</span>}
          {!pessoa.termosAceitosEm && <span className="selo selo--neutro">Ainda não entrou no app</span>}
        </p>
        <p className="receber-email">{pessoa.email}</p>
        {pessoa.telefone && <p className="receber-email">+{pessoa.telefone}</p>}
      </section>

      <Nota
        rotuloDaSecao="Saldo da pessoa"
        rotulo={<p className="rotulo">saldo</p>}
        valor={
          <p className="nota-valor">
            <span className="nota-moeda">D$</span>
            <span className={tamanhoDoNumero(saldoTexto, "nota-numero")}>{saldoTexto}</span>
          </p>
        }
        serie={numeroDeSerie(pessoa.criadaEm, pessoa.numero)}
        rotuloDaSerie="Número da conta"
      />

      {ehAPropria ? (
        <p className="app-aviso">Esta é a sua própria conta: as operações do Caixa são sempre com outra pessoa.</p>
      ) : !pessoa.ativo ? (
        <p className="app-aviso">Conta desativada: reative para fazer operações.</p>
      ) : (
        <nav className="acoes acoes--quatro" aria-label="Operações">
          <Link className="botao" href={`${base}/operacao/pagar`}>Pagar</Link>
          {podeTomar && (
            <Link className="botao botao--lima" href={`${base}/operacao/receber`}>Receber</Link>
          )}
          <Link className="botao botao--contorno" href={`${base}/operacao/deposito`}>Depósito de cédulas</Link>
          {podeTomar && (
            <Link className="botao botao--contorno" href={`${base}/operacao/saque`}>Saque em cédulas</Link>
          )}
        </nav>
      )}

      <section aria-labelledby="titulo-extrato">
        <h2 className="secao-titulo" id="titulo-extrato">Extrato</h2>
        {linhas.length === 0 ? (
          <p className="vazio">{cursor ? "Não há trocas mais antigas." : "Nenhuma troca ainda."}</p>
        ) : (
          <Extrato linhas={linhas} base="/app/caixa/transacao" />
        )}
        <p className="ver-mais">
          {cursor && <Link href={base}>Voltar ao início</Link>}
          {proximo && <Link href={`${base}?a=${encodeURIComponent(proximo)}`}>Mais antigas →</Link>}
        </p>
      </section>

      <section aria-labelledby="titulo-auditoria">
        <h2 className="secao-titulo" id="titulo-auditoria">Registro da conta</h2>
        {auditoria.length === 0 ? (
          <p className="vazio">Nenhuma alteração registrada.</p>
        ) : (
          <ul className="auditoria">
            {auditoria.map((linha) => (
              <li key={linha.id}>
                <span>{descreverAuditoria(linha)}</span>
                <small>
                  {dataHora(linha.criadaEm)} · {linha.atorNome ?? "sistema"}
                </small>
              </li>
            ))}
          </ul>
        )}
      </section>

      {gerencia && (
        <div className="rodape-acao">
          <Link className="botao botao--contorno" href={`${base}/editar`}>Editar dados</Link>
          {!ehAPropria && (
            <form action={alternarAtivo} style={{ display: "contents" }}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="ativar" value={pessoa.ativo ? "0" : "1"} />
              <button className="link" type="submit">
                {pessoa.ativo ? "Desativar esta conta" : "Reativar esta conta"}
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
