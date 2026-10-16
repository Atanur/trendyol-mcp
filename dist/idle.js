/**
 * Boşta kalan kaynağı (tarayıcı) otomatik kapatır. Zamanlayıcı süreci ayakta tutmaz (`unref`)
 * ve `close` hata verirse yutulur: temizlik işi hiçbir zaman sunucuyu çökertmemeli.
 */
export function createIdleCloser(options) {
    let timer;
    const cancel = () => {
        if (timer !== undefined)
            clearTimeout(timer);
        timer = undefined;
    };
    const arm = () => {
        cancel();
        if (options.delayMs <= 0)
            return;
        timer = setTimeout(() => {
            timer = undefined;
            void (async () => {
                try {
                    if (options.canClose && !(await options.canClose())) {
                        arm();
                        return;
                    }
                    await options.close();
                }
                catch {
                    /* temizlik hatası önemsiz */
                }
            })();
        }, options.delayMs);
        timer.unref?.();
    };
    return { touch: arm, cancel };
}
//# sourceMappingURL=idle.js.map