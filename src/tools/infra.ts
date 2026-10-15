import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { cacheClear, cacheStats } from '../cache.js';
import { jsonResult } from '../util.js';

export function registerInfraTools(server: McpServer): void {
  server.registerTool(
    'trendyol_cache_clear',
    {
      title: 'Clear the in-memory cache',
      description: 'Clear cached scrape results (all, or only keys with a given prefix).',
      inputSchema: z.object({
        prefix: z.string().optional(),
      }),
    },
    async ({ prefix }) => jsonResult({ removed: cacheClear(prefix) }),
  );

  server.registerTool(
    'trendyol_cache_stats',
    {
      title: 'Inspect the cache',
      description: 'Return the number of cached keys and their names.',
      inputSchema: z.object({}),
    },
    async () => jsonResult(cacheStats()),
  );
}
