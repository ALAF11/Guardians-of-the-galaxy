// Botões de avançar (.eg-wrap): adaptado do "Cursor Edge Glow Button" do MicroKit
// (https://github.com/henriquegpb/microkit).
//
// MIT License — Copyright (c) 2026 Henrique Barone
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
// associated documentation files (the "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the
// following conditions: The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY
// KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
// PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR
// ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
// Versão sem React: como os botões são criados e recriados pela apresentação, cada .eg-wrap novo
// é ligado quando aparece na página. A luz começa na ponta direita, com o brilho aceso.
(function () {
  const FREQUENCY = 3.4;
  const DAMPING = 0.78;
  const GLOW_RISE = 0.5;
  const EDGE_SATURATION = 0.55;
  const EDGE_BRIGHTNESS = 0.12;
  const HUE_SHIFT = -5;
  const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ligar(container) {
    if (container.__eg) return;
    const button = container.querySelector('.eg-btn');
    const lightTrack = container.querySelector('.eg-luz');
    const rightGlow = container.querySelector('.eg-dir');
    const leftGlow = container.querySelector('.eg-esq');
    if (!button || !lightTrack || !rightGlow || !leftGlow) return;
    container.__eg = true;

    let bound = container.getBoundingClientRect().width / 2 + 12;
    let x = bound;
    let velocity = 0;
    let target = bound;
    let inside = false;
    let last = 0;
    let frameId = null;

    const measure = () => {
      const novo = container.getBoundingClientRect().width / 2 + 12;
      // Enquanto está em repouso na ponta direita, acompanha a nova largura do botão
      if (!inside && frameId === null && Math.abs(x - bound) < 0.5) { x = target = novo; }
      bound = novo;
      paint();
    };

    const paint = () => {
      lightTrack.style.setProperty('--light-x', x.toFixed(2) + 'px');
      const normalized = Math.max(-1, Math.min(1, x / bound));
      const magnitude = Math.abs(normalized);
      const intensity = Math.pow(magnitude, GLOW_RISE);
      const colorTuning =
        'hue-rotate(' + HUE_SHIFT + 'deg)' +
        ' saturate(' + (1 + EDGE_SATURATION * magnitude).toFixed(3) + ')' +
        ' brightness(' + (1 + EDGE_BRIGHTNESS * magnitude).toFixed(3) + ')';
      rightGlow.style.opacity = (normalized > 0 ? intensity : 0).toFixed(3);
      leftGlow.style.opacity = (normalized < 0 ? intensity : 0).toFixed(3);
      rightGlow.style.filter = colorTuning;
      leftGlow.style.filter = colorTuning;
    };

    paint();
    new ResizeObserver(measure).observe(container);
    if (reduzirMovimento) return;

    const frame = (now = performance.now()) => {
      const delta = Math.min((now - last) / 1000, 0.032);
      last = now;
      const angularFrequency = 2 * Math.PI * FREQUENCY;
      velocity += (angularFrequency * angularFrequency * (target - x) - 2 * DAMPING * angularFrequency * velocity) * delta;
      x += velocity * delta;
      paint();
      if (inside || Math.abs(target - x) > 0.15 || Math.abs(velocity) > 0.6) {
        frameId = requestAnimationFrame(frame);
      } else {
        frameId = null;
        x = target;
        velocity = 0;
        paint();
      }
    };

    const kick = () => {
      if (frameId === null) {
        last = performance.now();
        frameId = requestAnimationFrame(frame);
      }
    };

    container.addEventListener('pointermove', (event) => {
      const bounds = container.getBoundingClientRect();
      inside = true;
      target = Math.max(-bound, Math.min(bound, event.clientX - (bounds.left + bounds.width / 2)));
      kick();
    });
    container.addEventListener('pointerleave', () => { inside = false; target = x; kick(); });
    button.addEventListener('focus', () => { if (button.matches(':focus-visible')) { inside = false; target = 0; kick(); } });
    button.addEventListener('blur', () => { inside = false; target = x; kick(); });
  }

  const procurar = () => document.querySelectorAll('.eg-wrap').forEach(ligar);
  new MutationObserver(procurar).observe(document.documentElement, { childList: true, subtree: true });
  procurar();
})();
