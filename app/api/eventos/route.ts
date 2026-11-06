import { assinar, type Evento } from "@/lib/eventos";
import { pessoaComCadastro } from "@/lib/sessao";

export const dynamic = "force-dynamic";

/** Server-Sent Events: um fluxo por aba aberta, com os avisos da pessoa logada. */
export async function GET(pedido: Request) {
  const pessoa = await pessoaComCadastro();
  if (!pessoa) return new Response(null, { status: 401 });

  const codificador = new TextEncoder();
  let encerrar = () => {};

  const fluxo = new ReadableStream<Uint8Array>({
    start(controle) {
      const escrever = (texto: string) => {
        try {
          controle.enqueue(codificador.encode(texto));
        } catch {
          encerrar();
        }
      };
      const cancelar = assinar(pessoa.id, (evento: Evento) =>
        escrever(`event: ${evento.tipo}\ndata: ${JSON.stringify(evento)}\n\n`),
      );
      // Proxies derrubam conexões paradas; um comentário a cada 25 s a mantém.
      const pulso = setInterval(() => escrever(": pulso\n\n"), 25_000);
      encerrar = () => {
        clearInterval(pulso);
        cancelar();
        try {
          controle.close();
        } catch {
          // Já fechado.
        }
      };
      pedido.signal.addEventListener("abort", encerrar);
      escrever("retry: 5000\n\n");
    },
    cancel() {
      encerrar();
    },
  });

  return new Response(fluxo, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      // Sem isto, proxies com buffer (nginx e afins) seguram os eventos.
      "X-Accel-Buffering": "no",
    },
  });
}
