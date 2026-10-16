import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { createIdleCloser } from '../src/idle.js';
import { staleTabs } from '../src/tabs.js';

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('createIdleCloser', () => {
  beforeEach(() => mock.timers.enable({ apis: ['setTimeout'] }));
  afterEach(() => mock.timers.reset());

  it('boşta kalma süresi dolunca kapatır, öncesinde kapatmaz', async () => {
    let closed = 0;
    const idle = createIdleCloser({ delayMs: 1000, close: () => { closed += 1; } });
    idle.touch();
    mock.timers.tick(999);
    await flush();
    assert.equal(closed, 0);
    mock.timers.tick(1);
    await flush();
    assert.equal(closed, 1);
  });

  it('her etkinlikte (touch) süreyi sıfırlar', async () => {
    let closed = 0;
    const idle = createIdleCloser({ delayMs: 1000, close: () => { closed += 1; } });
    idle.touch();
    mock.timers.tick(800);
    idle.touch();
    mock.timers.tick(800);
    await flush();
    assert.equal(closed, 0, 'ikinci touch süreyi uzatmalı');
    mock.timers.tick(200);
    await flush();
    assert.equal(closed, 1);
  });

  it('iptal edilince kapatmaz', async () => {
    let closed = 0;
    const idle = createIdleCloser({ delayMs: 1000, close: () => { closed += 1; } });
    idle.touch();
    idle.cancel();
    mock.timers.tick(5000);
    await flush();
    assert.equal(closed, 0);
  });

  it('canClose false dönerse (ör. kullanıcı giriş yapıyor) kapatmayı erteler, sonra kapatır', async () => {
    let closed = 0;
    let allowed = false;
    const idle = createIdleCloser({ delayMs: 1000, close: () => { closed += 1; }, canClose: () => allowed });
    idle.touch();
    mock.timers.tick(1000);
    await flush();
    assert.equal(closed, 0);
    allowed = true;
    mock.timers.tick(1000);
    await flush();
    assert.equal(closed, 1);
  });

  it('delayMs 0 veya negatifse devre dışıdır', async () => {
    let closed = 0;
    const idle = createIdleCloser({ delayMs: 0, close: () => { closed += 1; } });
    idle.touch();
    mock.timers.tick(10_000_000);
    await flush();
    assert.equal(closed, 0);
  });

  it('close hata fırlatırsa yutar (süreç çökmemeli)', async () => {
    const idle = createIdleCloser({ delayMs: 10, close: () => { throw new Error('boom'); } });
    idle.touch();
    mock.timers.tick(10);
    await flush();
  });
});

describe('staleTabs', () => {
  it('en son (aktif) sekme hariç hepsini döner', () => {
    assert.deepEqual(staleTabs(['a', 'b', 'c']), ['a', 'b']);
  });

  it('tek veya hiç sekme varsa kapatılacak bir şey yoktur', () => {
    assert.deepEqual(staleTabs(['a']), []);
    assert.deepEqual(staleTabs([]), []);
  });

  it('girdiyi değiştirmez', () => {
    const tabs = ['a', 'b'];
    staleTabs(tabs);
    assert.deepEqual(tabs, ['a', 'b']);
  });
});
