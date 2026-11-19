// Transições da apresentação.
// - Página: ao avançar ou recuar (botão "Next", teclado ou comando), a página não se move toda;
//   só os componentes principais (título, separadores, card e fotografia) fazem a transição, como num site
//   (View Transitions do browser; a animação de cada componente está no CSS).
// - Card da linha do tempo: quando aparece ou se muda de faixa, o cabeçalho desce, a linha desenha-se
//   da esquerda para a direita, os anos saltam um a um e no fim entra o card de informação.
// - Fotografia: ao mudar de obra, uma cópia da fotografia atual sai para o lado e passa para trás
//   da pilha, enquanto a nova vem de trás para a frente.
// - Card de informação: sempre que o texto muda, entra inclinado do lado para onde se andou, com um
//   brilho na cor da faixa a atravessá-lo; o título revela-se, o ano salta e o texto aparece a desfocar.
(function () {
  const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DUR_FOTO = 1100;
  const EASE = 'cubic-bezier(.45,0,.2,1)';
  const MOLA = 'cubic-bezier(.2,.9,.25,1.15)';
  const SALTO = 'cubic-bezier(.3,1.6,.5,1)';
  const SUAVE = 'cubic-bezier(.2,.8,.2,1)';
  let ultimaDir = 1;

  // ---------- Página ----------
  function mudarPagina(dir, fn, tipo) {
    if (reduzir || !document.startViewTransition) { fn(); return; }
    document.documentElement.dataset.sentido = dir > 0 ? 'frente' : 'tras';
    document.documentElement.dataset.mudanca = tipo || 'faixa';
    ultimaDir = dir;
    // Salvaguarda: se o browser não arrancar a transição a tempo (por exemplo, com a janela escondida),
    // a página muda na mesma, sem animação, e a navegação nunca fica presa
    let feito = false;
    const correr = () => { if (!feito) { feito = true; fn(); } };
    const reserva = setTimeout(correr, 300);
    // A apresentação desenha a página numa microtarefa; o setTimeout espera por esse desenho
    const t = document.startViewTransition(() => {
      clearTimeout(reserva);
      correr();
      return new Promise((r) => setTimeout(r, 0));
    });
    // Se o browser cancelar a transição (janela escondida, cliques muito rápidos), não é um erro
    const ignorar = () => {};
    t.ready.catch(ignorar); t.finished.catch(ignorar); t.updateCallbackDone.catch(ignorar);
  }

  // ---------- Fotografia ----------
  function antesDeMudarFoto(dir) {
    ultimaDir = dir;
    if (reduzir) return;
    const pilha = document.querySelector('.pola-pilha');
    const foto = pilha && pilha.querySelector('.pola-foto');
    if (!foto) return;

    // Limpa uma transição anterior que ainda esteja a meio
    document.querySelectorAll('.pola-copia').forEach((el) => el.remove());

    // A cópia fica fora da apresentação (no body, por cima da pilha), porque a apresentação
    // apaga os elementos que não fazem parte do seu modelo quando volta a desenhar a página
    const r = pilha.getBoundingClientRect();
    const copia = foto.cloneNode(true);
    copia.classList.remove('pola-foto');
    copia.classList.add('pola-copia');
    copia.setAttribute('aria-hidden', 'true');
    copia.tabIndex = -1;
    Object.assign(copia.style, {
      position: 'fixed', inset: 'auto', left: r.left + 'px', top: r.top + 'px',
      width: r.width + 'px', height: r.height + 'px', margin: '0',
      pointerEvents: 'none', transition: 'none', zIndex: '2'
    });
    document.body.appendChild(copia);

    // A fotografia que sai: vai para o lado (no sentido em que se andou) e volta para trás da pilha
    const lado = -dir;
    copia.animate([
      { translate: '0 0', rotate: '0deg', scale: '1', opacity: 1 },
      { translate: (lado * 78) + '% -4%', rotate: (lado * 12) + 'deg', scale: '0.97', opacity: 1, offset: 0.45 },
      { translate: (lado * 8) + '% 3%', rotate: (lado * 5) + 'deg', scale: '0.88', opacity: 0 }
    ], { duration: DUR_FOTO, easing: EASE, fill: 'forwards' });
    // A meio, a cópia passa para trás da apresentação (#app tem z-index 1), ou seja, para trás da pilha
    setTimeout(() => { copia.style.zIndex = '0'; }, DUR_FOTO * 0.45);

    // A fotografia nova: começa atrás, um pouco mais pequena e escura, e vem para a frente
    foto.animate([
      { translate: (-lado * 5) + '% 3%', scale: '0.88', filter: 'brightness(0.6)' },
      { translate: (-lado * 5) + '% 3%', scale: '0.9', filter: 'brightness(0.65)', offset: 0.45 },
      { translate: '0 0', scale: '1', filter: 'brightness(1)' }
    ], { duration: DUR_FOTO, easing: EASE });

    setTimeout(() => copia.remove(), DUR_FOTO + 60);
  }

  // ---------- Card de informação ----------
  function animarInfo(card, dir, atraso) {
    if (reduzir || !card) return;
    const a = atraso || 0;
    card.getAnimations({ subtree: true }).forEach((x) => x.cancel());
    card.animate([
      { transform: 'perspective(900px) rotateY(' + (-dir * 18) + 'deg) translateX(' + (dir * 56) + 'px)', opacity: 0 },
      { transform: 'perspective(900px) rotateY(0deg) translateX(0)', opacity: 1 }
    ], { duration: 900, delay: a, easing: MOLA, fill: 'backwards' });
    const brilho = card.querySelector('.info-brilho');
    if (brilho) brilho.animate([
      { transform: 'translateX(' + (dir > 0 ? '-110%' : '110%') + ')' },
      { transform: 'translateX(' + (dir > 0 ? '110%' : '-110%') + ')' }
    ], { duration: 1200, delay: a + 150, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'backwards' });
    const titulo = card.querySelector('.info-titulo');
    if (titulo) titulo.animate([
      { clipPath: 'inset(0 100% 0 0)', transform: 'translateX(-14px)' },
      { clipPath: 'inset(0 0 0 0)', transform: 'translateX(0)' }
    ], { duration: 850, delay: a + 200, easing: SUAVE, fill: 'backwards' });
    const ano = card.querySelector('.info-ano');
    if (ano) ano.animate([
      { transform: 'scale(0.3) rotate(-14deg)', opacity: 0 },
      { transform: 'scale(1) rotate(0deg)', opacity: 1 }
    ], { duration: 750, delay: a + 480, easing: SALTO, fill: 'backwards' });
    const nota = card.querySelector('.info-nota');
    if (nota) nota.animate([
      { transform: 'translateY(18px)', filter: 'blur(6px)', opacity: 0 },
      { transform: 'translateY(0)', filter: 'blur(0)', opacity: 1 }
    ], { duration: 850, delay: a + 350, easing: SUAVE, fill: 'backwards' });
  }

  // ---------- Card da linha do tempo ----------
  function animarEntrada(bloco) {
    if (reduzir || !bloco) return;
    bloco.getAnimations({ subtree: true }).forEach((x) => x.cancel());
    const topo = bloco.querySelector('.lt-topo');
    if (topo) topo.animate([
      { transform: 'translateY(-16px)', opacity: 0, letterSpacing: '0.3em' },
      { transform: 'translateY(0)', opacity: 1, letterSpacing: 'normal' }
    ], { duration: 800, easing: SUAVE, fill: 'backwards' });
    const base = bloco.querySelector('.lt-base');
    if (base) base.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
      { duration: 1000, delay: 150, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'backwards' });
    const fill = bloco.querySelector('.lt-fill');
    if (fill) fill.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
      { duration: 900, delay: 650, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'backwards' });
    bloco.querySelectorAll('.lt-obra').forEach((obra, i) => {
      obra.animate([
        { transform: 'translateY(30px) scale(0.4)', opacity: 0 },
        { transform: 'translateY(0) scale(1)', opacity: 1 }
      ], { duration: 800, delay: 300 + i * 170, easing: SALTO, fill: 'backwards' });
    });
    const n = bloco.querySelectorAll('.lt-obra').length;
    animarInfo(bloco.querySelector('.info-card'), 1, 450 + n * 170);
  }

  // ---------- Quem dispara as animações ----------
  // O card da linha do tempo anima quando aparece ou quando muda de faixa (data-faixa);
  // o card de informação anima sozinho quando só o seu texto muda.
  new MutationObserver((registos) => {
    let bloco = null, card = null;
    for (const r of registos) {
      if (r.type === 'attributes' && r.target.classList && r.target.classList.contains('obras-bloco')) { bloco = r.target; continue; }
      if (r.type === 'childList') {
        for (const n of r.addedNodes) {
          if (n.nodeType !== 1) continue;
          const b = n.classList.contains('obras-bloco') ? n : n.querySelector && n.querySelector('.obras-bloco');
          if (b) bloco = b;
        }
      }
      const alvo = r.target.nodeType === 1 ? r.target : r.target.parentElement;
      const c = alvo && alvo.closest && alvo.closest('.info-card');
      if (c) card = c;
    }
    if (bloco && bloco.isConnected) animarEntrada(bloco);
    else if (card && card.isConnected) animarInfo(card, ultimaDir, 0);
    if (bloco || card) ultimaDir = 1;
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-faixa'] });

  // Se a página já abrir com o card visível
  document.querySelectorAll('.obras-bloco').forEach(animarEntrada);

  window.Transicoes = { antesDeMudarFoto: antesDeMudarFoto, mudarPagina: mudarPagina };
})();
