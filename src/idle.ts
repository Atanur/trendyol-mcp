export interface IdleCloserOptions {
  /** Son etkinlikten bu kadar ms sonra kapat. 0 veya negatifse devre dışı. */
  delayMs: number;
  close: () => void | Promise<void>;
  /** false dönerse kapatma ertelenir (ör. kullanıcı giriş sayfasında işlem yapıyor). */
  canClose?: () => boolean | Promise<boolean>;
}

export interface IdleCloser {
  /** Etkinlik oldu: sayacı sıfırla. */
  touch(): void;
  cancel(): void;
}

/**
 * Boşta kalan kaynağı (tarayıcı) otomatik kapatır. Zamanlayıcı süreci ayakta tutmaz (`unref`)
 * ve `close` hata verirse yutulur: temizlik işi hiçbir zaman sunucuyu çökertmemeli.
 */
export function createIdleCloser(options: IdleCloserOptions): IdleCloser {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cancel = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  const arm = (): void => {
    cancel();
    if (options.delayMs <= 0) return;
    timer = setTimeout(() => {
      timer = undefined;
      void (async () => {
        try {
          if (options.canClose && !(await options.canClose())) {
            arm();
            return;
          }
          await options.close();
        } catch {
          /* temizlik hatası önemsiz */
        }
      })();
    }, options.delayMs);
    timer.unref?.();
  };

  return { touch: arm, cancel };
}
