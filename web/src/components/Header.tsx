import { Code, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import ThemeToggle from '@/components/ThemeToggle';
import { NAV, REPO } from '@/data/content';

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="/" className="font-heading text-lg font-bold tracking-tight" aria-label="trendyol-mcp ana sayfa">
          trendyol<span className="text-primary">-mcp</span>
        </a>

        <nav aria-label="Ana menü" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Button key={item.href} variant="ghost" render={<a href={item.href} />}>
              {item.label}
            </Button>
          ))}
          <Button variant="outline" render={<a href={REPO} />}>
            <Code /> GitHub
          </Button>
          <ThemeToggle />
        </nav>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <Sheet>
            <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Menüyü aç" />}>
              <Menu />
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Menü</SheetTitle>
                <SheetDescription>trendyol-mcp bölümleri</SheetDescription>
              </SheetHeader>
              <nav aria-label="Mobil menü" className="grid gap-1 px-4">
                {NAV.map((item) => (
                  <SheetClose key={item.href} render={<a href={item.href} className="rounded-md px-3 py-2 text-base hover:bg-accent" />}>
                    {item.label}
                  </SheetClose>
                ))}
                <a href={REPO} className="rounded-md px-3 py-2 text-base hover:bg-accent">
                  GitHub
                </a>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
