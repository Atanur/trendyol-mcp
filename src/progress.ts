/** Araç işleyicisine verilen bağlamın, ilerleme bildirimi için gereken en küçük parçası. */
export interface ProgressContext {
  mcpReq: {
    _meta?: { progressToken?: string | number };
    notify: (notification: { method: string; params?: Record<string, unknown> }) => Promise<void>;
  };
}

/**
 * Uzun süren araçlarda "şu an ne yapıyorum" bilgisini MCP `notifications/progress` ile bildirir.
 * İstemci ilerleme jetonu göndermediyse sessizce hiçbir şey yapmaz; bildirim hatası asıl işi bozmaz.
 * Dönen fonksiyon her çağrıda adımı bir artırır: `step("Yorumlar okunuyor")`.
 */
export function createProgress(ctx: ProgressContext, total: number): (message: string) => Promise<void> {
  let current = 0;
  return async (message: string): Promise<void> => {
    current += 1;
    const progressToken = ctx.mcpReq._meta?.progressToken;
    if (progressToken === undefined) return;
    await ctx.mcpReq
      .notify({ method: 'notifications/progress', params: { progressToken, progress: current, total, message } })
      .catch(() => undefined);
  };
}
