(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let paused = false;
  try { paused = sessionStorage.getItem('nexo-motion-paused') === 'true'; } catch { /* Funciona también sin almacenamiento. */ }
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'motion-toggle';
  function update() {
    document.body.classList.toggle('motion-paused', paused || reduced.matches || document.hidden);
    toggle.hidden = reduced.matches;
    toggle.textContent = paused ? '▶ Activar animaciones' : 'Ⅱ Pausar animaciones';
    toggle.setAttribute('aria-label', paused ? 'Activar animaciones decorativas' : 'Pausar animaciones decorativas');
    toggle.setAttribute('aria-pressed', String(paused));
  }
  toggle.addEventListener('click', () => {
    paused = !paused;
    try { sessionStorage.setItem('nexo-motion-paused', String(paused)); } catch { /* Preferencia local opcional. */ }
    update();
  });
  document.body.append(toggle);
  reduced.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);
  update();
  const card = document.querySelector('.welcome-card');
  if (card) {
    card.addEventListener('pointermove', event => {
      if (paused || reduced.matches || !finePointer.matches) return;
      const bounds = card.getBoundingClientRect();
      card.style.setProperty('--tilt', `${((event.clientX - bounds.left) / bounds.width - .5) * 8}deg`);
    });
    card.addEventListener('pointerleave', () => card.style.removeProperty('--tilt'));
  }
})();
