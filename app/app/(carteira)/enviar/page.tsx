import { db } from "@/lib/db";
import { obterSaldo } from "@/lib/ledger";
import { exigirPessoa } from "@/lib/sessao";
import { Topo } from "../topo";
import { buscarDestinatario } from "./acoes";
import { FluxoEnviar } from "./fluxo";

export default async function Enviar({
  searchParams,
}: {
  searchParams: Promise<{ para?: string | string[] }>;
}) {
  const pessoa = await exigirPessoa();
  const { saldo, disponivel } = await obterSaldo(db, pessoa.id);

  // Quem lê o QR com a câmera do celular (fora do app) chega aqui com ?para=.
  const { para } = await searchParams;
  const codigo = Array.isArray(para) ? para[0] : para;
  const busca = codigo ? await buscarDestinatario({ para: codigo }) : null;

  return (
    <>
      <Topo titulo="Enviar" />
      <FluxoEnviar
        saldo={saldo}
        disponivel={disponivel}
        destinatarioInicial={busca?.ok ? busca.destinatario : null}
        erroInicial={busca && !busca.ok ? busca.erro : ""}
      />
    </>
  );
}
