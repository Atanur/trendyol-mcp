import { useEffect, useMemo, useState } from 'react';

const REQUEST =
  'Hem iş yerinde hem akşam arkadaşlarımla dışarıda giyebileceğim rahat bir pantolon arıyorum, kot olabilir.';
const TYPE_MS = 22;
const FINAL_STATUS = 'Kısa listeye kaydedildi · kaldığın yer hatırlanır';

type Verdict = 'ok' | 'warn' | 'bad';
type Shape = 'regular' | 'slim' | 'baggy' | 'ankle';

interface Piece {
  readonly title: string;
  readonly price: string;
  readonly note: string;
  readonly verdict: Verdict;
  readonly shape: Shape;
  readonly color: string;
  readonly pick?: boolean;
}

const SHAPES: Record<Shape, string> = {
  regular: 'M12 3h24l4 24-6 33h-8l-2-27-2 27h-8l-6-33z',
  slim: 'M14 3h20l3 24-5 33h-5l-2-27-2 27h-5l-5-33z',
  baggy: 'M10 3h28l8 24-6 33H27l-3-25-3 25H8L2 27z',
  ankle: 'M12 3h24l4 24-4 21h-8l-2-19-2 19h-8l-4-21z',
};

const STAMPS: Record<Verdict, string> = { ok: 'uygun', warn: 'dikkat', bad: 'eleme' };

const PIECES: readonly Piece[] = [
  { title: 'Lacivert comfort', price: '1.147 ₺', note: 'relaxed · pamuk', verdict: 'ok', shape: 'regular', color: '#1f3a5f', pick: true },
  { title: 'Siyah regular', price: '1.092 ₺', note: '32/32 seçilebilir', verdict: 'ok', shape: 'regular', color: '#2a2a2e', pick: true },
  { title: 'Okyanus mavisi', price: '1.149 ₺', note: 'palet dışı renk', verdict: 'warn', shape: 'regular', color: '#4a7fb0' },
  { title: 'Buz mavisi boyfriend', price: '634 ₺', note: 'kadın modeli olabilir', verdict: 'warn', shape: 'baggy', color: '#a9c6e6' },
  { title: 'Bilek boy lacivert', price: '850 ₺', note: 'kısa paça', verdict: 'warn', shape: 'ankle', color: '#27456d' },
  { title: 'Siyah slim', price: '1.100 ₺', note: 'istemediğin kalıp', verdict: 'bad', shape: 'slim', color: '#2a2a2e' },
];

const NEEDS = ['pantolon', 'iş + akşam', 'kot', 'rahat kalıp', 'beden 32/32'] as const;
const CHIPS = [
  { label: 'Lacivert comfort · seçildi', muted: false },
  { label: 'Siyah regular · inceleniyor', muted: true },
] as const;

interface StageState {
  typed: string;
  needs: number;
  pieces: number;
  scan: number;
  judged: number;
  picked: boolean;
  chips: number;
  saved: boolean;
  closed: boolean;
  status: string;
}

const INITIAL: StageState = {
  typed: '',
  needs: 0,
  pieces: 0,
  scan: -1,
  judged: 0,
  picked: false,
  chips: 0,
  saved: false,
  closed: false,
  status: 'İhtiyaç dinleniyor…',
};

const FINAL: StageState = {
  typed: REQUEST,
  needs: NEEDS.length,
  pieces: PIECES.length,
  scan: -1,
  judged: PIECES.length,
  picked: true,
  chips: CHIPS.length,
  saved: true,
  closed: false,
  status: FINAL_STATUS,
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export default function HeroStage() {
  const [s, setS] = useState<StageState>(FINAL);
  const [root, setRoot] = useState<HTMLElement | null>(null);

  // Sunucuda ve hareket azaltma tercihinde son hâl görünür; animasyon yalnızca tarayıcıda başlar.
  useEffect(() => {
    if (!root || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let cancelled = false;
    let visible = true;
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
    }, { threshold: 0.15 });
    observer.observe(root);

    const patch = (next: Partial<StageState>) => {
      if (!cancelled) setS((prev) => ({ ...prev, ...next }));
    };
    const pause = async (ms: number) => {
      await sleep(ms);
      while ((document.hidden || !visible) && !cancelled) await sleep(250);
    };

    async function play() {
      setS(INITIAL);
      await pause(700);

      for (let i = 1; i <= REQUEST.length && !cancelled; i += 1) {
        patch({ typed: REQUEST.slice(0, i) });
        await sleep(TYPE_MS);
      }
      patch({ status: 'İhtiyaç anlaşılıyor…' });
      await pause(350);

      for (let i = 1; i <= NEEDS.length; i += 1) {
        patch({ needs: i });
        await pause(230);
      }
      patch({ status: 'Rol, vesile, kumaş, kalıp ve beden çıkarıldı' });
      await pause(600);

      patch({ status: 'Trendyol taranıyor: ürünler diziliyor' });
      for (let i = 1; i <= PIECES.length; i += 1) {
        patch({ pieces: i });
        await pause(150);
      }
      await pause(500);

      patch({ status: 'Profiline göre süzülüyor…' });
      for (let i = 0; i < PIECES.length; i += 1) {
        patch({ scan: i });
        await pause(560);
        patch({ scan: -1, judged: i + 1 });
        await pause(260);
      }
      patch({ status: 'Süzüldü: 2 uygun · 3 dikkat · 1 elendi' });
      await pause(500);

      patch({ picked: true });
      await pause(700);

      patch({ status: 'En iyi adaylar kısa listeye alınıyor…' });
      for (let i = 1; i <= CHIPS.length; i += 1) {
        patch({ chips: i });
        await pause(380);
      }
      patch({ saved: true, status: FINAL_STATUS });
      await pause(2200);

      patch({ status: 'İş bitti: Chrome sekmesi kapatılıyor…' });
      await pause(900);
      patch({ closed: true, status: 'Sekme kapandı. Bir sonraki oturumda kaldığın yerden devam.' });
      await pause(3200);
    }

    (async () => {
      while (!cancelled) await play();
    })();

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [root]);

  const typedDone = s.typed.length === REQUEST.length;
  const summary = useMemo(
    () =>
      'Örnek: "iş ve akşam için rahat bir kot pantolon" isteğinde asistan ihtiyacı anlar, 6 ürünü profile göre süzer, 2\'sini uygun bulur, 3\'ünü uyarıyla işaretler, 1\'ini eler ve en iyi iki adayı kısa listeye kaydeder. İş bitince Chrome sekmesini kapatır.',
    [],
  );

  return (
    <figure ref={setRoot} className="m-0 min-w-0">
      <figcaption className="sr-only">{summary}</figcaption>
      <div className="stage-window" aria-hidden="true">
        <div className="flex items-end justify-between gap-2 border-b bg-secondary px-3 pt-2">
          <span className="stage-tab" data-closed={s.closed}>
            <i className="size-2 shrink-0 rounded-full bg-ok" />
            trendyol.com
            <b className="text-muted-foreground">×</b>
          </span>
          <span className="pb-1.5 font-mono text-[0.7rem] text-muted-foreground">
            {s.closed ? 'Chrome kapandı · oturum profilde kaldı' : 'Chrome açık'}
          </span>
        </div>

        <div className="grid gap-1 border-b px-4 py-3">
          <span className="font-mono text-[0.68rem] font-bold uppercase tracking-widest text-muted-foreground">Sen</span>
          <p className="min-h-[3.6em] text-[0.95rem] leading-snug">
            {s.typed}
            {!typedDone ? <i className="stage-caret" /> : null}
          </p>
        </div>

        <ul className="flex min-h-[3rem] flex-wrap gap-1.5 border-b px-4 py-3">
          {NEEDS.map((label, i) => (
            <li key={label} className="need-chip" data-on={i < s.needs}>
              {label}
            </li>
          ))}
        </ul>

        <ol className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3">
          {PIECES.map((p, i) => {
            const judged = i < s.judged;
            return (
              <li
                key={p.title}
                className="piece"
                data-in={i < s.pieces}
                data-scan={s.scan === i}
                data-verdict={judged ? p.verdict : undefined}
                data-picked={judged && s.picked && p.pick ? true : undefined}
              >
                <svg viewBox="0 0 48 64">
                  <path d={SHAPES[p.shape]} fill={p.color} />
                </svg>
                <strong className="piece-title text-[0.78rem] leading-tight">{p.title}</strong>
                <span className="font-mono text-[0.72rem] text-muted-foreground">{p.price}</span>
                <em className="stamp not-italic">{STAMPS[p.verdict]}</em>
                <small className="piece-reason">{p.note}</small>
              </li>
            );
          })}
        </ol>

        <div className="flex min-h-[3.2rem] flex-wrap items-center gap-2 border-t bg-secondary px-4 py-3">
          <span className="font-mono text-[0.68rem] font-bold uppercase tracking-widest text-muted-foreground">Kısa liste</span>
          {CHIPS.map((c, i) => (
            <span key={c.label} className="tray-chip" data-muted={c.muted} data-on={i < s.chips}>
              {c.label}
            </span>
          ))}
          <span
            className="ml-auto font-mono text-[0.68rem] text-muted-foreground transition-opacity duration-500"
            style={{ opacity: s.saved ? 1 : 0 }}
          >
            kaldığın yer kaydedildi
          </span>
        </div>
      </div>
      <p className="mt-3 min-h-[1.4em] text-center font-mono text-xs text-muted-foreground" aria-hidden="true">
        {s.status}
      </p>
    </figure>
  );
}
