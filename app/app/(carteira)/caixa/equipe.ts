import { exigirPessoa } from "@/lib/sessao";

/** Porta de toda página do Caixa: só Caixa e Admin; o resto volta à carteira. */
export const exigirEquipe = () => exigirPessoa({ papeis: ["caixa", "admin"] });

export const NOME_PAPEL = { usuario: null, caixa: "Caixa", admin: "Admin" } as const;

export const VOLTAR_AO_CAIXA = { href: "/app/caixa", rotulo: "Voltar ao Caixa" };
