// Komut kopyalama düğmeleri ve hero animasyonu. Hiçbir veri göndermez, izleme yok.
const RESET_MS = 1800;

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Pano API'si yoksa (ör. http veya eski tarayıcı) seçili metinle dene.
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

for (const button of document.querySelectorAll('button.copy[data-copy]')) {
  const original = button.textContent;
  button.addEventListener('click', async () => {
    const ok = await copyText(button.dataset.copy);
    button.textContent = ok ? 'Kopyalandı' : 'Seçip kopyala';
    button.dataset.done = String(ok);
    setTimeout(() => {
      button.textContent = original;
      delete button.dataset.done;
    }, RESET_MS);
  });
}

// --- Hero: asistanın çalışmasının animasyonlu örneği ---------------------------------------
const REQUEST = 'Hem iş yerinde hem akşam arkadaşlarımla giyebileceğim rahat bir pantolon arıyorum, kot olabilir.';
const TYPE_MS = 22;
const FINAL_STATUS = 'Kısa listeye kaydedildi · kaldığın yer hatırlanır';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function initStage(stage) {
  const typed = stage.querySelector('[data-typed]');
  const needs = [...stage.querySelectorAll('[data-need] li')];
  const pieces = [...stage.querySelectorAll('.piece')];
  const chips = [...stage.querySelectorAll('[data-chip]')];
  const saved = stage.querySelector('[data-saved]');
  const status = stage.querySelector('[data-status]');
  const note = stage.querySelector('[data-chromenote]');

  const setStatus = (text) => { status.textContent = text; };
  const verdictOf = (piece) => `is-${piece.dataset.v}`;

  function reset() {
    typed.textContent = '';
    stage.classList.remove('is-typed', 'is-closed');
    for (const el of needs) el.classList.remove('on');
    for (const el of chips) el.classList.remove('on');
    saved.classList.remove('on');
    for (const piece of pieces) piece.classList.remove('in', 'scan', 'picked', 'is-ok', 'is-warn', 'is-bad');
    note.textContent = 'Chrome açık';
    setStatus('İhtiyaç dinleniyor…');
  }

  // Hareket azaltma tercihinde animasyon yok: son hâli göster.
  function showFinal() {
    typed.textContent = REQUEST;
    stage.classList.add('is-typed');
    for (const el of needs) el.classList.add('on');
    for (const piece of pieces) {
      piece.classList.add('in', verdictOf(piece));
      if ('pick' in piece.dataset) piece.classList.add('picked');
    }
    for (const el of chips) el.classList.add('on');
    saved.classList.add('on');
    setStatus(FINAL_STATUS);
  }

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    showFinal();
    return;
  }

  // Sekme gizliyken ya da sahne ekran dışındayken beklet: gereksiz iş yapma.
  let visible = true;
  new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }, { threshold: 0.15 }).observe(stage);
  const pause = async (ms) => {
    await sleep(ms);
    while (document.hidden || !visible) await sleep(250);
  };

  async function play() {
    reset();
    await pause(700);

    for (let i = 1; i <= REQUEST.length; i += 1) {
      typed.textContent = REQUEST.slice(0, i);
      await sleep(TYPE_MS);
    }
    stage.classList.add('is-typed');
    setStatus('İhtiyaç anlaşılıyor…');
    await pause(350);

    for (const el of needs) {
      el.classList.add('on');
      await pause(230);
    }
    setStatus('Rol, vesile, kumaş, kalıp ve beden çıkarıldı');
    await pause(600);

    setStatus('Trendyol taranıyor: ürünler diziliyor');
    for (const piece of pieces) {
      piece.classList.add('in');
      await pause(150);
    }
    await pause(500);

    setStatus('Profiline göre süzülüyor…');
    for (const piece of pieces) {
      piece.classList.add('scan');
      await pause(560);
      piece.classList.remove('scan');
      piece.classList.add(verdictOf(piece));
      await pause(260);
    }
    setStatus('Süzüldü: 2 uygun · 3 dikkat · 1 elendi');
    await pause(500);

    for (const piece of pieces) if ('pick' in piece.dataset) piece.classList.add('picked');
    await pause(700);

    setStatus('En iyi adaylar kısa listeye alınıyor…');
    for (const el of chips) {
      el.classList.add('on');
      await pause(380);
    }
    saved.classList.add('on');
    setStatus(FINAL_STATUS);
    await pause(2200);

    setStatus('İş bitti: Chrome sekmesi kapatılıyor…');
    await pause(900);
    stage.classList.add('is-closed');
    note.textContent = 'Chrome kapandı · oturum profilde kaldı';
    setStatus('Sekme kapandı. Bir sonraki oturumda kaldığın yerden devam.');
    await pause(3200);
  }

  (async () => {
    for (;;) await play();
  })();
}

for (const stage of document.querySelectorAll('[data-stage]')) initStage(stage);
