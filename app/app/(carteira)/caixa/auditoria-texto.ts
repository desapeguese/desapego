import type { LinhaAuditoria } from "@/lib/pessoas";

const CAMPOS: Record<string, string> = { nome: "nome", email: "e-mail", telefone: "telefone" };
const PERFIS: Record<string, string> = { usuario: "Usuário", caixa: "Caixa", admin: "Admin" };
const limite = (v: unknown) => (v === null || v === undefined ? "o padrão do perfil" : `D$ ${String(v)}`);

/** Uma linha do registro, em português de gente. */
export function descreverAuditoria(linha: Pick<LinhaAuditoria, "acao" | "detalhes">): string {
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
      return (
        `Perfil alterado de ${PERFIS[String(d.de)] ?? String(d.de)} para ${PERFIS[String(d.para)] ?? String(d.para)}` +
        (d.origem ? " (configuração do servidor)" : "")
      );
    case "limite_alterado":
      return `Limite negativo alterado de ${limite(d.de)} para ${limite(d.para)}`;
    case "limite_padrao_caixa":
      return `Limite padrão do Caixa alterado de D$ ${String(d.de)} para D$ ${String(d.para)}`;
    case "edicao_criada":
      return `Edição criada: ${String(d.nome)} (${String(d.inicio)} a ${String(d.fim)})`;
    case "edicao_removida":
      return `Edição removida: ${String(d.nome)} (${String(d.inicio)} a ${String(d.fim)})`;
    case "edicao_alterada": {
      const de = d.de as Record<string, string>;
      const para = d.para as Record<string, string>;
      return `Edição alterada: ${de.nome} (${de.inicio} a ${de.fim}) passou a ${para.nome} (${para.inicio} a ${para.fim})`;
    }
    case "segundo_fator_removido":
      return "Proteção da conta removida (passkey e app autenticador)";
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
