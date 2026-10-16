import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CopyCommand from '@/components/CopyCommand';
import { INSTALL_CMD, MARKETPLACE_CMD } from '@/data/content';

export default function InstallTabs() {
  return (
    <Tabs defaultValue="plugin" className="w-full">
      <TabsList>
        <TabsTrigger value="plugin">Claude Code plugin'i</TabsTrigger>
        <TabsTrigger value="manual">Elle kurulum</TabsTrigger>
      </TabsList>

      <TabsContent value="plugin" className="mt-4 grid gap-3">
        <CopyCommand step={1} command={MARKETPLACE_CMD} />
        <CopyCommand step={2} command={INSTALL_CMD} />
        <p className="text-sm text-muted-foreground">
          Claude Code'u yeniden başlat ve şunu yaz: <strong className="text-foreground">"Trendyol'da ceket bakıyorum."</strong> Gerisini asistan sorar.
          Daha önce MCP'yi elle eklediysen önce onu kaldır: <code className="font-mono text-[0.82rem]">claude mcp remove trendyol -s user</code>.
        </p>
      </TabsContent>

      <TabsContent value="manual" className="mt-4 grid gap-3">
        <CopyCommand step={1} command="pnpm install && pnpm build" />
        <CopyCommand step={2} command="claude mcp add trendyol -- node /MUTLAK/YOL/trendyol-mcp/dist/index.js" />
        <p className="text-sm text-muted-foreground">
          Standart bir MCP olduğu için başka istemcilere de bağlanır. Ayrıntılar ve ortam değişkenleri:{' '}
          <a className="underline underline-offset-4" href="https://github.com/Atanur/trendyol-mcp/blob/main/docs/MANUAL-SETUP.md">
            docs/MANUAL-SETUP.md
          </a>
          .
        </p>
      </TabsContent>
    </Tabs>
  );
}
