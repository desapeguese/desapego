"use client";

import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

export type PasskeyResumo = { id: string; nome: string; criadaEm: string };

type Erro = { code?: string; message?: string; status?: number } | null | undefined;

function traduzir(erro: Erro): string {
  switch (erro?.code) {
    case "SEGUNDO_FATOR_PENDENTE":
      return "Confirme sua identidade antes de mudar a proteção da conta.";
    case "INVALID_CODE":
    case "INVALID_TWO_FACTOR_CODE":
      return "Código incorreto. Confira no app autenticador e tente de novo.";
    case "AUTH_CANCELLED":
    case "ERROR_CEREMONY_ABORTED":
      return "A confirmação foi cancelada.";
    default:
      return erro?.status === 429
        ? "Muitas tentativas. Espere um pouco."
        : "Não deu certo agora. Tente de novo em instantes.";
  }
}

/** Nome amigável do aparelho, para a pessoa reconhecer a passkey na lista. */
function nomeDoAparelho(): string {
  const a = navigator.userAgent;
  if (/iPhone/.test(a)) return "iPhone";
  if (/iPad/.test(a)) return "iPad";
  if (/Android/.test(a)) return "Celular Android";
  if (/Mac/.test(a)) return "Mac";
  if (/Windows/.test(a)) return "Computador Windows";
  return "Este aparelho";
}

export function Seguranca(props: { passkeys: PasskeyResumo[]; autenticadorAtivo: boolean }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [suportaPasskey, setSuportaPasskey] = useState(true);
  // Ativação do autenticador em andamento: o QR, a chave e os códigos de recuperação.
  const [ativacao, setAtivacao] = useState<{ uri: string; qr: string; chave: string; recuperacao: string[] } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [recuperacao, setRecuperacao] = useState<string[] | null>(null);

  useEffect(() => {
    setSuportaPasskey(typeof window.PublicKeyCredential === "function");
  }, []);

  const comecar = () => {
    setOcupado(true);
    setErro("");
    setAviso("");
  };

  async function adicionarPasskey() {
    comecar();
    const resposta = await authClient.passkey.addPasskey({ name: nomeDoAparelho() });
    setOcupado(false);
    if (resposta?.error) return setErro(traduzir(resposta.error));
    setAviso("Pronto: este aparelho agora entra com digital, rosto ou PIN.");
    router.refresh();
  }

  async function removerPasskey(id: string) {
    comecar();
    const { error } = await authClient.passkey.deletePasskey({ id });
    setOcupado(false);
    if (error) return setErro(traduzir(error));
    router.refresh();
  }

  async function iniciarAutenticador() {
    comecar();
    const { data, error } = await authClient.twoFactor.enable({ method: "totp" });
    setOcupado(false);
    if (error || !data || data.method !== "totp") return setErro(traduzir(error));
    const chave = new URL(data.totpURI).searchParams.get("secret") ?? "";
    setAtivacao({
      uri: data.totpURI,
      qr: await QRCode.toString(data.totpURI, { type: "svg", margin: 1, color: { dark: "#1F3F10", light: "#ffffff" } }),
      chave,
      recuperacao: data.backupCodes,
    });
    setCodigo("");
  }

  async function confirmarAutenticador() {
    comecar();
    const { error } = await authClient.twoFactor.verifyTotp({ code: codigo });
    setOcupado(false);
    if (error) return setErro(traduzir(error));
    setRecuperacao(ativacao?.recuperacao ?? []);
    setAtivacao(null);
    router.refresh();
  }

  async function desativarAutenticador() {
    comecar();
    const { error } = await authClient.twoFactor.disable({});
    setOcupado(false);
    if (error) return setErro(traduzir(error));
    setRecuperacao(null);
    setAviso("App autenticador desativado.");
    router.refresh();
  }

  return (
    <section className="cartao formulario" id="seguranca" aria-labelledby="titulo-seguranca">
      <h2 className="secao-titulo" id="titulo-seguranca">Segurança</h2>
      <p className="mensagem">
        Com uma proteção ativa, entrar por código de e-mail num aparelho novo também pede a digital, o rosto
        ou o código do autenticador.
      </p>

      <p className="mensagem mensagem--erro" role="alert">{erro}</p>
      {aviso && <p className="feito" role="status">{aviso}</p>}

      <h3 className="rotulo">digital, rosto ou PIN (passkey)</h3>
      {props.passkeys.length > 0 && (
        <ul className="auditoria">
          {props.passkeys.map((p) => (
            <li key={p.id} className="linha-acao">
              <span>
                {p.nome}
                <small> · desde {p.criadaEm}</small>
              </span>
              <button type="button" className="link" disabled={ocupado} onClick={() => removerPasskey(p.id)}>
                remover
              </button>
            </li>
          ))}
        </ul>
      )}
      {suportaPasskey ? (
        <button type="button" className="botao" disabled={ocupado} onClick={adicionarPasskey}>
          {props.passkeys.length > 0 ? "Adicionar este aparelho" : "Ativar neste aparelho"}
        </button>
      ) : (
        <p className="mensagem">
          Este navegador não suporta passkey. Abra o app no Chrome ou no Safari, ou use o app autenticador abaixo.
        </p>
      )}

      <h3 className="rotulo">app autenticador</h3>
      {recuperacao && (
        <div className="recuperacao" role="status">
          <p>
            <strong>Autenticador ativado.</strong> Guarde estes códigos de recuperação: cada um vale uma vez e
            eles não serão mostrados de novo.
          </p>
          <ul>
            {recuperacao.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}
      {ativacao ? (
        <>
          <p className="mensagem">
            Abra o Google Authenticator (ou outro app do tipo), leia o código abaixo e digite os 6 dígitos que ele
            mostrar.
          </p>
          <div className="qr-autenticador" role="img" aria-label="QR code para o app autenticador" dangerouslySetInnerHTML={{ __html: ativacao.qr }} />
          <p className="mensagem">
            Sem câmera? Digite a chave no app: <code className="chave">{ativacao.chave}</code>
          </p>
          <label className="campo">
            <span>Código do app</span>
            <input
              className="campo-codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <button type="button" className="botao" disabled={ocupado || codigo.length !== 6} onClick={confirmarAutenticador}>
            Confirmar
          </button>
          <button type="button" className="link" disabled={ocupado} onClick={() => setAtivacao(null)}>
            Cancelar
          </button>
        </>
      ) : props.autenticadorAtivo ? (
        <div className="linha-acao">
          <span>Ativo</span>
          <button type="button" className="link" disabled={ocupado} onClick={desativarAutenticador}>
            desativar
          </button>
        </div>
      ) : (
        <button type="button" className="botao botao--contorno" disabled={ocupado} onClick={iniciarAutenticador}>
          Usar app autenticador
        </button>
      )}
    </section>
  );
}
