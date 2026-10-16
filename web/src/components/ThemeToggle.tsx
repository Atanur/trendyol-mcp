import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    setDark(next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      // Depolama kapalıysa tercih yalnızca bu oturumda geçerli.
    }
  }

  return (
    <Button type="button" variant="ghost" size="icon" onClick={toggle} aria-label={dark ? 'Açık temaya geç' : 'Koyu temaya geç'}>
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
