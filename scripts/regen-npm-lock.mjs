// package-lock.json'u yeniden üretir. Claude Code plugin kurulumu pnpm-lock.yaml'ı okumaz, npm kilidi ister.
// Geçici temiz bir dizinde çalışır: pnpm'in node_modules düzeni npm'in çözümlemesini bozabildiği için.
// Kullanım: pnpm lock:npm   (package.json bağımlılıkları değişince çalıştır, sonra package-lock.json'u commit'le)
import { execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..');
const tmp = await mkdtemp(path.join(os.tmpdir(), 'trendyol-mcp-lock-'));

try {
  await copyFile(path.join(root, 'package.json'), path.join(tmp, 'package.json'));
  execFileSync('npm', ['install', '--package-lock-only', '--ignore-scripts'], { cwd: tmp, stdio: 'inherit' });
  await copyFile(path.join(tmp, 'package-lock.json'), path.join(root, 'package-lock.json'));
  console.log('package-lock.json güncellendi. Şimdi commit\'le.');
} finally {
  await rm(tmp, { recursive: true, force: true });
}
