/**
 * Avisos em tempo real para quem está com o app aberto (ver app/api/eventos).
 *
 * É um barramento dentro do processo: vale enquanto o serviço tiver uma
 * réplica só (.railway/railway.ts). Com mais de uma, trocar por LISTEN/NOTIFY
 * do Postgres. Quem perde um aviso não perde nada além da rapidez: o app
 * também consulta o servidor de tempos em tempos.
 */
export type Evento = {
  /** Entrou na conta da pessoa, ou saiu dela por ação de outra (Tomar, saque, estorno). */
  tipo: "recebido" | "debitado";
  transacaoId: string;
  valor: number;
  de: string;
};

type Ouvinte = (evento: Evento) => void;

// Em globalThis porque o Next empacota rotas de API e server actions em
// módulos separados: sem isto, quem publica e quem assina teriam mapas
// diferentes.
const global = globalThis as unknown as { __desapegoOuvintes?: Map<string, Set<Ouvinte>> };
const ouvintes = (global.__desapegoOuvintes ??= new Map());

export function assinar(usuarioId: string, ouvinte: Ouvinte): () => void {
  let conjunto = ouvintes.get(usuarioId);
  if (!conjunto) ouvintes.set(usuarioId, (conjunto = new Set()));
  conjunto.add(ouvinte);
  return () => {
    conjunto.delete(ouvinte);
    if (conjunto.size === 0) ouvintes.delete(usuarioId);
  };
}

export function publicar(usuarioId: string, evento: Evento) {
  for (const ouvinte of ouvintes.get(usuarioId) ?? []) {
    try {
      ouvinte(evento);
    } catch {
      // Uma conexão quebrada não pode impedir o aviso às outras.
    }
  }
}
