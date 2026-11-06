import { db } from "@/lib/db";
import { listarEdicoes } from "@/lib/edicoes";
import { NOME_TIPO, numeroCurto } from "@/lib/formato";
import { linhaCsv, listarTransacoes } from "@/lib/relatorios";
import { pessoaComCadastro } from "@/lib/sessao";
import { lerFiltros } from "../filtros";

export const dynamic = "force-dynamic";

const data = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" });
const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", timeStyle: "medium" });
const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

/** Teto de segurança: no ritmo do Festival, o livro inteiro cabe com folga. */
const MAXIMO = 200_000;

/** O relatório filtrado inteiro, em CSV, lido do banco em lotes e enviado aos poucos. */
export async function GET(pedido: Request) {
  const pessoa = await pessoaComCadastro();
  if (pessoa?.papel !== "admin") return new Response("Restrito a Admin.", { status: 403 });

  const parametros = Object.fromEntries(new URL(pedido.url).searchParams);
  const { filtros } = await lerFiltros(parametros);
  const codificador = new TextEncoder();
  // A edição de cada transação é a que contém o dia dela (horário de Brasília).
  const edicoes = await listarEdicoes(db);
  const diaIso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
  const edicaoDe = (instante: Date) => {
    const dia = diaIso.format(instante);
    return edicoes.find((e) => e.inicio <= dia && dia <= e.fim)?.nome ?? null;
  };

  const fluxo = new ReadableStream<Uint8Array>({
    async start(controle) {
      try {
        // BOM: sem ele o Excel lê os acentos errado.
        controle.enqueue(codificador.encode("﻿"));
        controle.enqueue(
          codificador.encode(
            linhaCsv([
              "Número", "Data", "Hora", "Tipo", "Valor (D$)",
              "Saiu de", "E-mail (saiu de)", "Entrou em", "E-mail (entrou em)",
              "Feita por", "E-mail (feita por)", "Descrição", "Estorno de", "Edição", "Identificador",
            ]),
          ),
        );
        let cursor: string | null = null;
        let enviadas = 0;
        do {
          const pagina = await listarTransacoes(db, filtros, { limite: 1000, cursor });
          let lote = "";
          for (const t of pagina.linhas) {
            lote += linhaCsv([
              numeroCurto(t.id), data.format(t.criadaEm), hora.format(t.criadaEm), NOME_TIPO[t.tipo], t.valor,
              t.deNome, t.deEmail, t.paraNome, t.paraEmail,
              t.operadorNome, t.operadorEmail, t.descricao,
              t.estornoDe ? numeroCurto(t.estornoDe) : null, edicaoDe(t.criadaEm), t.id,
            ]);
          }
          controle.enqueue(codificador.encode(lote));
          enviadas += pagina.linhas.length;
          cursor = pagina.proximo;
        } while (cursor && enviadas < MAXIMO);
        controle.close();
      } catch (erro) {
        controle.error(erro);
      }
    },
  });

  return new Response(fluxo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="desapego-transacoes-${hoje()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
