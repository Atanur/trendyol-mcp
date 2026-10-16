import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

const RESET_MS = 1800;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Pano API'si yoksa (ör. http) seçili metinle dene.
    const area = Object.assign(document.createElement('textarea'), { value: text });
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

interface Props {
  readonly command: string;
  readonly step?: number;
}

export default function CopyCommand({ command, step }: Props) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle');

  async function onCopy() {
    setState((await copyText(command)) ? 'ok' : 'fail');
    setTimeout(() => setState('idle'), RESET_MS);
  }

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border bg-card py-2 pl-4 pr-2 shadow-sm">
      {step ? (
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground">
          {step}
        </span>
      ) : null}
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[0.82rem]">{command}</code>
      <Button type="button" size="sm" variant="secondary" onClick={onCopy} aria-label={`Komutu kopyala: ${command}`}>
        {state === 'ok' ? <Check /> : <Copy />}
        <span aria-live="polite">{state === 'ok' ? 'Kopyalandı' : state === 'fail' ? 'Seçip kopyala' : 'Kopyala'}</span>
      </Button>
    </div>
  );
}
