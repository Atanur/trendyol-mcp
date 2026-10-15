#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { closeBrowser } from './browser.js';
import { createServer } from './server.js';
function log(message) {
    process.stderr.write(`[trendyol-mcp] ${message}\n`);
}
const handle = serveStdio(() => createServer(), {
    onerror: (error) => log(`transport error: ${error.message}`),
});
let shuttingDown = false;
async function shutdown(reason) {
    if (shuttingDown)
        return;
    shuttingDown = true;
    log(`${reason} alındı, kapatılıyor...`);
    // Never let a stuck browser/transport close keep the process alive.
    const force = setTimeout(() => process.exit(0), 3000);
    force.unref();
    await Promise.race([closeBrowser(), new Promise((resolve) => setTimeout(resolve, 2000))]).catch(() => undefined);
    await Promise.race([handle.close(), new Promise((resolve) => setTimeout(resolve, 2000))]).catch(() => undefined);
    process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.stdin.on('end', () => void shutdown('stdin end'));
process.stdin.on('close', () => void shutdown('stdin close'));
process.on('uncaughtException', (error) => log(`uncaughtException: ${error.stack ?? error.message}`));
process.on('unhandledRejection', (error) => log(`unhandledRejection: ${String(error)}`));
// If the host (opencode) dies without closing stdin, our parent becomes launchd (ppid 1).
// Detect that and exit so orphaned servers don't pile up.
const initialPpid = process.ppid;
const watchdog = setInterval(() => {
    if (process.ppid === 1 || process.ppid !== initialPpid) {
        void shutdown(`parent exited (ppid ${initialPpid} -> ${process.ppid})`);
    }
}, 5000);
watchdog.unref();
log(`stdio server hazır (pid ${process.pid}, ppid ${initialPpid}).`);
//# sourceMappingURL=index.js.map