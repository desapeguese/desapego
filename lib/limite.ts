/**
 * Limitador de taxa em memória (janela deslizante). Vale enquanto o serviço
 * tiver uma réplica só (.railway/railway.ts); com mais de uma, mover para o
 * banco.
 */
// Em globalThis porque o Next empacota rotas de API e server actions em
// módulos separados, e cada um teria a sua contagem.
const global = globalThis as unknown as { __desapegoLimites?: Map<string, number[]> };
const registros = (global.__desapegoLimites ??= new Map<string, number[]>());

export function permitir(chave: string, maximo: number, janelaMs: number): boolean {
  const agora = Date.now();
  const recentes = (registros.get(chave) ?? []).filter((t) => agora - t < janelaMs);
  if (recentes.length >= maximo) {
    registros.set(chave, recentes);
    return false;
  }
  recentes.push(agora);
  registros.set(chave, recentes);

  if (registros.size > 20_000) {
    // As janelas são de minutos: qualquer coisa parada há uma hora já venceu.
    for (const [k, tempos] of registros) {
      if (agora - (tempos.at(-1) ?? 0) > 60 * 60 * 1000) registros.delete(k);
    }
  }
  return true;
}
