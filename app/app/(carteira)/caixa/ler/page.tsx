import { Topo } from "../../topo";
import { exigirEquipe, VOLTAR_AO_CAIXA } from "../equipe";
import { LeitorDePessoa } from "./leitor-de-pessoa";

export default async function LerQr() {
  await exigirEquipe();
  return (
    <>
      <Topo titulo="Ler QR" voltar={VOLTAR_AO_CAIXA}>
        <p className="app-subtitulo">Peça para a pessoa abrir “Receber” e aponte a câmera para a roda.</p>
      </Topo>
      <LeitorDePessoa />
    </>
  );
}
