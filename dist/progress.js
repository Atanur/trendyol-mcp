/**
 * Uzun süren araçlarda "şu an ne yapıyorum" bilgisini MCP `notifications/progress` ile bildirir.
 * İstemci ilerleme jetonu göndermediyse sessizce hiçbir şey yapmaz; bildirim hatası asıl işi bozmaz.
 * Dönen fonksiyon her çağrıda adımı bir artırır: `step("Yorumlar okunuyor")`.
 */
export function createProgress(ctx, total) {
    let current = 0;
    return async (message) => {
        current += 1;
        const progressToken = ctx.mcpReq._meta?.progressToken;
        if (progressToken === undefined)
            return;
        await ctx.mcpReq
            .notify({ method: 'notifications/progress', params: { progressToken, progress: current, total, message } })
            .catch(() => undefined);
    };
}
//# sourceMappingURL=progress.js.map