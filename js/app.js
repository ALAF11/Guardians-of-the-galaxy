// Lógica do protótipo do canvas, copiada tal e qual. O motor está em js/dc-lite.js.
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = this.fresh();
    this.timers = [];
  }
  fresh() {
    return {
      view: 'home', i: 0, tab: 0, playing: false, visited: [],
      toast: '', toastKey: 0, fanOpen: [false, false, false, false],
      secs: 0, timerOn: false, warned: false,
      workSel: {}, flip: false, beats: {}, fansSeen: false, listOpen: false,
      perguntadas: {}, votoQ: -1, votoAte: 0, votoAgora: 0
    };
  }
  componentDidMount() {
    this.tick = setInterval(() => {
      const p = this.state;
      if (!p.timerOn) return;
      const limit = 420;
      const ns = p.secs + 1;
      if (ns >= limit) { this.setState({ secs: limit, timerOn: false }); this.goMap(); this.flash('The tape is over!'); return; }
      if (limit - ns === 60 && !p.warned) { this.setState({ secs: ns, warned: true }); this.flash('Last minute of tape!'); return; }
      this.setState({ secs: ns });
    }, 1000);
    // Teclado e comando de apresentação: → / espaço / Page Down avançam, ← / Page Up recuam, F ecrã inteiro
    this.onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape' && this.state.listOpen) { this.setState({ listOpen: false }); return; }
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); this.next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); this.prev(); }
      else if (e.key === 'f' || e.key === 'F') this.toggleFullscreen();
    };
    document.addEventListener('keydown', this.onKey);
    // O botão de ecrã inteiro acompanha o estado real (também quando se sai com Escape)
    this.onFullscreen = () => this.setState({ fullscreen: !!document.fullscreenElement });
    document.addEventListener('fullscreenchange', this.onFullscreen);
    this.ligarVotacao();
  }
  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }
  componentWillUnmount() {
    document.removeEventListener('keydown', this.onKey);
    document.removeEventListener('fullscreenchange', this.onFullscreen);
    clearInterval(this.tick);
    clearInterval(this.votoTick);
    this.timers.forEach((t) => clearTimeout(t));
  }
  later(fn, ms) { this.timers.push(setTimeout(fn, ms)); }
  flash(msg) {
    const k = this.state.toastKey + 1;
    this.setState({ toast: msg, toastKey: k });
    this.later(() => { if (this.state.toastKey === k) this.setState({ toast: '' }); }, 1800);
  }
  // Ao entrar em "Contributo e ligações", os três portais da faixa abrem sozinhos
  withPortals(beats, i) {
    const nb = Object.assign({}, beats);
    nb[i] = [true, true, true];
    return nb;
  }
  goTab(k) {
    this.setState((p) => ({ tab: k, beats: k === 1 ? this.withPortals(p.beats, p.i) : p.beats }));
    if (k === 1 && this.state.i < 7) this.perguntar(this.state.i);
  }
  showFans() {
    this.setState({ view: 'hidden', playing: true, fansSeen: true, listOpen: false });
  }
  goMap() {
    this.setState({ view: 'map', playing: false, listOpen: false });
    this.fimVotacao();
  }

  // ---------- Votação no telemóvel (pasta telemovel/) ----------
  // Ao entrar em "Contributo e ligações", abre-se nos telemóveis a pergunta sobre o que se
  // disse em "Obras"; a dos Fãs abre ao sair da faixa escondida. No fim, o mapa mostra os acertos.
  ligarVotacao() {
    if (!window.Votacao) return;
    Votacao.ligar().then((api) => {
      if (!api) return;
      this.voto = api;
      const url = api.url || new URL('telemovel/', location.href).href;
      api.aosLigados((n) => this.setState({ ligados: n }));
      this.novaSessao();
      this.setState({ votacaoOn: true, votoUrl: url });
      this.desenharQR(url);
    });
  }
  // Cada vez que a apresentação começa do zero, as respostas também começam do zero
  novaSessao() {
    if (!this.voto) return;
    if (this.pararVotos) this.pararVotos();
    clearInterval(this.votoTick);
    this.sessao = Date.now().toString(36);
    this.votoAberta = null;
    this.voto.abrir({ sessao: this.sessao, q: '-1', estado: 'espera' });
    this.pararVotos = this.voto.aosVotos(this.sessao, (v) => this.setState({ votos: v }));
    this.setState({ votos: {}, perguntadas: {}, votoQ: -1 });
  }
  perguntar(q) {
    if (!this.voto || this.state.perguntadas[q] || !window.PERGUNTAS[q]) return;
    const agora = Date.now();
    const ate = agora + Votacao.duracao * 1000;
    this.voto.abrir({ sessao: this.sessao, q: String(q), estado: 'pergunta' });
    this.votoAberta = q;
    this.setState((p) => {
      const feitas = Object.assign({}, p.perguntadas);
      feitas[q] = true;
      return { perguntadas: feitas, votoQ: q, votoAte: ate, votoAgora: agora };
    });
    clearInterval(this.votoTick);
    this.votoTick = setInterval(() => {
      const t = Date.now();
      // Um segundo depois do fim, fecha a pergunta na base de dados; o aviso fica mais um pouco no ecrã
      if (this.votoAberta === q && t >= ate + 1000) {
        this.votoAberta = null;
        this.voto.abrir({ sessao: this.sessao, q: '-1', estado: 'espera' });
      }
      if (t >= ate + 5000) { clearInterval(this.votoTick); this.setState({ votoQ: -1 }); return; }
      this.setState({ votoAgora: t });
    }, 250);
  }
  fimVotacao() {
    if (!this.voto) return;
    clearInterval(this.votoTick);
    this.votoAberta = null;
    this.voto.abrir({ sessao: this.sessao, q: '-1', estado: 'fim' });
    this.setState({ votoQ: -1 });
  }
  desenharQR(url) {
    if (!window.QRCode) {
      if (document.readyState !== 'complete') window.addEventListener('load', () => this.desenharQR(url), { once: true });
      return;
    }
    const box = document.createElement('div');
    new QRCode(box, { text: url, width: 380, height: 380, colorDark: '#17131f', colorLight: '#f3e9d2', correctLevel: QRCode.CorrectLevel.M });
    const canvas = box.querySelector('canvas');
    if (canvas) this.setState({ qrSrc: canvas.toDataURL() });
  }
  open(idx, tab) {
    this.setState((p) => ({
      view: 'track', i: idx, tab: tab || 0, playing: true, flip: false, listOpen: false,
      beats: tab === 1 ? this.withPortals(p.beats, idx) : p.beats,
      visited: p.visited.indexOf(idx) >= 0 ? p.visited : p.visited.concat([idx])
    }));
  }
  startTape() {
    if (this.state.timerOn || this.state.secs >= 420) return;
    // Se o mapa foi aberto antes de começar, os telemóveis voltam a ficar à espera
    if (this.voto && this.state.secs === 0) this.voto.abrir({ sessao: this.sessao, q: '-1', estado: 'espera' });
    this.setState({ timerOn: true });
  }
  // Percurso: em cada faixa Obras → Contributo e ligações → faixa seguinte.
  // Depois dos Parques vem a faixa escondida (Os Fãs). A faixa pessoal só tem Obras, e no fim vem o mapa.
  // Na página inicial, o primeiro avanço só põe a fita a contar (abertura).
  next() {
    const s = this.state;
    if (s.view === 'home') {
      if (!s.timerOn && s.secs === 0) this.startTape();
      else { this.open(s.secs > 0 ? s.i : 0); this.startTape(); }
    } else if (s.view === 'track') {
      if (s.tab < 1 && s.i < 7) this.goTab(1);
      else if (s.i === 6) this.showFans();
      else if (s.i < 7) this.open(s.i + 1);
      else this.goMap();
    } else if (s.view === 'hidden') {
      this.open(7);
      this.perguntar(7);
    }
  }
  prev() {
    const s = this.state;
    if (s.view === 'track') {
      if (s.tab > 0) this.setState({ tab: s.tab - 1 });
      else if (s.i === 7) this.showFans();
      else if (s.i > 0) this.open(s.i - 1, 1);
      else this.setState({ view: 'home', playing: false });
    } else if (s.view === 'hidden') {
      this.open(6, 1);
    } else if (s.view === 'map') {
      this.open(7);
    }
  }
  renderVals() {
    const accent = this.props.accent ?? '#e8893d';
    const showTimer = this.props.showTimer ?? true;
    const s = this.state;
    const T = [
      { side: 'A', title: 'The Origin', platform: 'Comics', short: 'Comics', color: '#e8a33d',
        works: [
          { label: 'Original team', year: '1969', note: 'First appears in Marvel Super-Heroes #18: a group of rebels from the 31st century who fight for the freedom of the galaxy.', img: '[Cover: Marvel Super-Heroes #18]', fact: 'Yondu was already part of the original 1969 team, but as a hero from the 31st century.' },
          { label: 'Star-Lord’s debut', year: '1976', note: 'Peter Quill appears for the first time, many years before he joins the team.', img: '[Cover: Marvel Preview #4]', fact: 'Star-Lord was created by Steve Englehart and spent decades away from the Guardians.' },
          { label: 'New team', year: '2008', note: 'Dan Abnett and Andy Lanning bring together Star-Lord, Gamora, Drax, Rocket and Groot. This is the team the films will adapt.', img: '[Cover: Guardians of the Galaxy #1, 2008]', fact: 'Rocket’s name was inspired by the Beatles song Rocky Raccoon.' }
        ],
        links: [
          { to: 1, text: 'Gives the films the 2008 team: the line-up, the humor and the characters.' },
          { to: 2, text: 'Thanos and Gamora were born in 1970s comics, long before the films.' },
          { to: 3, text: 'The animated series and What If...? take characters and ideas from the comics.' }
        ] },
      { side: 'A', title: 'The Big Screen', platform: 'Films', short: 'Films', color: '#e8893d',
        works: [
          { label: 'Vol. 1', year: '2014', note: 'Peter Quill brings together a group of outlaws to protect an Infinity Stone. A family is born.', img: '[Poster: Vol. 1]', fact: 'James Gunn wrote and directed all three films, which gives the trilogy a single voice.' },
          { label: 'Vol. 2', year: '2017', note: 'Peter meets his father, Ego, and realizes that his real family is the one he chose.', img: '[Poster: Vol. 2]', fact: 'Ego, Peter’s father, is literally a living planet.' },
          { label: 'Vol. 3', year: '2023', note: 'Rocket’s origin and the farewell of this version of the team.', img: '[Poster: Vol. 3]', fact: 'Vol. 3 finally tells Rocket’s origin, which had been held back since the first film.' }
        ],
        links: [
          { to: 5, text: 'The tapes in the story become real albums: the films create the soundtrack.' },
          { to: 3, text: 'Baby Groot from Vol. 2 leads to the I Am Groot shorts.' },
          { to: 6, text: 'The humor and retro style of the films set the tone for the theme park rides.' }
        ] },
      { side: 'A', title: 'Crossover', platform: 'Marvel Universe', short: 'Crossover', color: '#e86a8a',
        works: [
          { label: 'Infinity War', year: '2018', note: 'The Guardians meet Thor and join the war against Thanos, Gamora’s adoptive father.', img: '[Image: the Guardians with Thor]', fact: 'Thor spends the whole film calling Rocket a rabbit.' },
          { label: 'Endgame', year: '2019', note: 'The team fights in the final battle, and a Gamora from the past comes back.', img: '[Image: the final battle]', fact: 'The Gamora who comes back is from 2014 and does not know the Guardians.' },
          { label: 'Love and Thunder', year: '2022', note: 'Thor travels with the Guardians at the start of the film, before they go their separate ways.', img: '[Image: Thor with the Guardians]', fact: 'It is the last time Thor and the Guardians share the screen before Vol. 3.' }
        ],
        links: [
          { to: 1, text: 'What happens to Gamora in Infinity War changes the direction of Vol. 3.' },
          { to: 0, text: 'The war against Thanos is inspired by a classic comics saga.' },
          { to: 3, text: 'What If...? imagines other versions of these events.' }
        ] },
      { side: 'B', title: 'Short Stories', platform: 'Animation and Disney+', short: 'Animation', color: '#4fb8ab',
        works: [
          { label: 'Animated series', year: '2015', note: 'Weekly adventures on Disney XD, with a tone made for a younger audience.', img: '[Image: animated series]', fact: 'The series premiered about a year after Vol. 1, to build on the success of the film.' },
          { label: 'What If...?', year: '2021', note: 'Imagines other versions of the Marvel universe.', img: '[Image: What If...?]', fact: 'In one episode, it is T’Challa, not Peter, who is taken by Yondu and becomes Star-Lord.' },
          { label: 'I Am Groot', year: '2022', note: 'Shorts of a few minutes with Baby Groot, almost without dialogue.', img: '[Image: I Am Groot]', fact: 'Each short lasts only a few minutes and tells its story almost only with images and sound.' },
          { label: 'Holiday Special', year: '2022', note: 'A Christmas special set before Vol. 3 that adds context to Peter’s story.', img: '[Image: Holiday Special]', fact: 'The Christmas present the team gets for Peter is the actor Kevin Bacon.' }
        ],
        links: [
          { to: 1, text: 'The Holiday Special bridges the films and sets up Vol. 3.' },
          { to: 2, text: 'What If...? takes moments from the Marvel universe and asks: what if it were different?' },
          { to: 5, text: 'The shorts tell stories without dialogue, relying on images and sound.' }
        ] },
      { side: 'B', title: 'You Are Star-Lord', platform: 'Video games', short: 'Games', color: '#8f8cf0',
        works: [
          { label: 'Telltale Series', year: '2017', note: 'A story-driven adventure in episodes, where the player’s choices change the story.', img: '[Cover: Telltale Series]', fact: 'It was released in five episodes over several months, like a TV series.' },
          { label: 'Marvel’s Guardians of the Galaxy', year: '2021', note: 'An action game by Eidos-Montréal: you are Peter and you lead the team in an original story.', img: '[Cover: 2021 game]', fact: 'In this game, Peter is a huge fan of a fictional 1980s band called Star-Lord, with original songs.' }
        ],
        links: [
          { to: 1, text: 'Creates a third version of the story: neither the films’ nor the comics’.' },
          { to: 5, text: 'Like in the films, 1980s music is part of the game’s identity.' },
          { to: 6, text: 'Like in the theme park, the audience stops watching and starts taking part.' }
        ] },
      { side: 'B', title: 'The Soundtrack', platform: 'Music', short: 'Music', color: '#f0c75e',
        works: [
          { label: 'Awesome Mix Vol. 1', year: '2014', note: 'The tape Peter’s mother left him: his link to Earth.', img: '[Cover: Awesome Mix Vol. 1]', fact: 'It reached No. 1 on the Billboard 200 album chart in the United States with only old songs.' },
          { label: 'Awesome Mix Vol. 2', year: '2017', note: 'The second tape, the last gift from Peter’s mother.', img: '[Cover: Awesome Mix Vol. 2]', fact: 'The Vol. 2 tape appears at the end of the first film, as a gift his mother had kept for him.' },
          { label: 'Awesome Mix Vol. 3', year: '2023', note: 'The soundtrack moves forward in time, with more recent songs.', img: '[Cover: Awesome Mix Vol. 3]', fact: 'At the end of Vol. 2, Peter gets a Zune: the music no longer fits on a tape.' }
        ],
        links: [
          { to: 1, text: 'The tape is an object in the story: it connects Peter to his mother.' },
          { to: 6, text: 'On Cosmic Rewind, the song for each ride is picked at random.' },
          { to: 4, text: 'The 2021 game follows the same rule: retro music as identity.' }
        ] },
      { side: 'B', title: 'Into the Story', platform: 'Theme parks', short: 'Parks', color: '#6cc4e8',
        works: [
          { label: 'Mission: BREAKOUT!', year: '2017', note: 'At Disney California Adventure: a drop tower where you help Rocket free the team.', img: '[Image: Mission: BREAKOUT!]', fact: 'It replaced the old Twilight Zone Tower of Terror in the same building.' },
          { label: 'Cosmic Rewind', year: '2022', note: 'At EPCOT, Florida: a roller coaster with spinning cars and music from the 70s and 80s.', img: '[Image: Cosmic Rewind]', fact: 'The cars spin 360º and the ride starts with a launch backwards.' }
        ],
        links: [
          { to: 1, text: 'Takes the characters and the tone of the films into a physical space.' },
          { to: 5, text: 'Retro music drives the whole experience.' },
          { to: 0, text: 'Xandar and the Nova Corps, the setting of the ride, come from the comics.' }
        ] },
      { side: 'Bonus', title: 'My View', platform: 'Bonus track', short: 'Me', color: '#f3e9d2',
        works: [
          { label: 'How I found it', year: '2020', note: 'I started watching the films during the COVID-19 lockdown.', img: '[Your photo: the lockdown]', fact: 'Being at home during the lockdown is what got me into this universe.' },
          { label: 'Favorite moment', year: 'Vol. 2', note: 'Every moment with Groot, above all Baby Groot dancing at the start of Vol. 2 while the team fights a giant monster.', img: '[Image: Baby Groot dancing, Vol. 2]', fact: 'In that scene, Baby Groot dances to Mr. Blue Sky, by Electric Light Orchestra.' },
          { label: 'Next stop', year: '2026', note: 'Each platform makes me want the next one. I have never played the games, so that is my next stop.', img: '[Image: the 2021 game]', fact: 'The 2021 game is the platform I want to try next.' }
        ],
        links: [] }
    ];
    const tabNames = ['Works', 'Contribution and links'];
    const pad = (n) => (n < 10 ? '0' : '') + n;
    const fmt = (t) => pad(Math.floor(t / 60)) + ':' + pad(t % 60);
    const beatsOf = (idx) => s.beats[idx] || [false, false, false];
    const pos = (idx) => { const a = (-90 + idx * 45) * Math.PI / 180; return { x: 50 + 36 * Math.cos(a), y: 50 + 36 * Math.sin(a) }; };
    const seg = (a, b, color) => {
      const dx = b.x - a.x, dy = b.y - a.y;
      return { x: a.x.toFixed(2), y: a.y.toFixed(2), len: Math.sqrt(dx * dx + dy * dy).toFixed(2), deg: (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1), color: color };
    };

    const limit = 420;
    const remaining = Math.max(0, limit - s.secs);
    const list = T.map((t, idx) => {
      const visited = s.visited.indexOf(idx) >= 0;
      return {
        num: pad(idx + 1), title: t.title, platform: t.platform,
        mark: visited ? 'played' : '',
        markColor: visited ? '#4fb8ab' : '#b8ab92',
        border: '#3a3145',
        segColor: idx === s.i ? accent : (visited ? '#7a6a8a' : '#3a3145'),
        pick: () => { this.open(idx); this.startTape(); }
      };
    });
    const c = T[s.i];
    const sel = Math.min(s.workSel[s.i] || 0, c.works.length - 1);
    const setWork = (k) => { const ws = Object.assign({}, s.workSel); ws[s.i] = k; this.setState({ workSel: ws, flip: false }); };
    const cur = {
      num: pad(s.i + 1), title: c.title, platform: c.platform, color: c.color, short: c.short,
      sideLabel: c.side === 'Bonus' ? 'BONUS TRACK' : 'SIDE ' + c.side,
      sel: c.works[sel],
      works: c.works.map((w, k) => {
        const on = k === sel;
        return {
          label: w.label, year: w.year,
          dot: on ? c.color : (k < sel ? '#3a3145' : '#2b2433'), ring: on ? '#f3e9d2' : '#5c5068',
          dotText: on ? '#17131f' : '#f3e9d2', glow: on ? '0 0 24px ' + c.color : 'none',
          labelColor: on ? '#f3e9d2' : '#b8ab92',
          pick: () => setWork(k)
        };
      })
    };
    const timelineFill = c.works.length > 1 ? 'calc((100% - 80px) * ' + (sel / (c.works.length - 1)).toFixed(3) + ')' : '0px';
    const tabs = (s.i === 7 ? tabNames.slice(0, 1) : tabNames).map((label, k) => {
      const on = k === s.tab;
      return {
        n: k + 1, label: label, sel: on ? 'true' : 'false',
        border: on ? c.color : '#3a3145', bg: on ? c.color : '#201a29', fg: on ? '#17131f' : '#f3e9d2',
        pick: () => this.goTab(k)
      };
    });

    const pola = c.works[sel];
    const polaRots = [-3, 2.5, -1.5, 3];
    const polaDots = c.works.map((w, k) => ({ color: k === sel ? c.color : '#3a3145' }));

    const bArr = beatsOf(s.i);
    const pieces = c.links.map((l, k) => {
      const open = bArr[k];
      return {
        n: k + 1, text: l.text, toLabel: T[l.to].short, toColor: T[l.to].color, closed: !open, open: open,
        border: open ? T[l.to].color : '#5c5068', bg: open ? '#2b2433' : '#241d2e',
        pick: () => { const nb = Object.assign({}, s.beats); const arr = bArr.slice(); arr[k] = true; nb[s.i] = arr; this.setState({ beats: nb }); }
      };
    });
    const pc = pos(s.i);
    const conLines = c.links.filter((l, k) => bArr[k]).map((l) => seg(pc, pos(l.to), T[l.to].color));
    const conNodes = T.map((t, idx) => {
      const isCur = idx === s.i;
      const lit = c.links.some((l, k) => l.to === idx && bArr[k]);
      const p = pos(idx);
      return {
        x: p.x.toFixed(2), y: p.y.toFixed(2), label: t.short,
        size: isCur ? 34 : (lit ? 26 : 18),
        fill: isCur ? c.color : (lit ? t.color : '#2b2433'),
        ring: isCur ? '#f3e9d2' : (lit ? t.color : '#3a3145'),
        glow: isCur ? '0 0 22px ' + c.color : (lit ? '0 0 14px ' + t.color : 'none'),
        labelColor: isCur || lit ? '#f3e9d2' : '#8a7e96'
      };
    });
    let portalsOpen = 0;
    T.forEach((t, idx) => beatsOf(idx).forEach((b) => { if (b) portalsOpen += 1; }));

    const fanData = [
      { title: 'Cosplay', text: 'At conventions, fans dress up as Star-Lord, Gamora or Groot: they wear the universe on their own bodies.', color: '#e8893d' },
      { title: 'Theories', text: 'On social media and in forums, fans debate what comes next and continue the story off screen.', color: '#8f8cf0' },
      { title: 'Collectibles', text: 'Figures, LEGO and replica tapes let fans keep the universe at home.', color: '#4fb8ab' },
      { title: 'Memes and fan art', text: 'Groot’s line became a meme: fans create and share their own versions of the universe.', color: '#e86a8a' }
    ];
    const fanCards = fanData.map((f, k) => {
      const open = s.fanOpen[k];
      return {
        title: f.title, text: f.text, open: open, closed: !open,
        border: f.color, bg: open ? f.color : '#201a29', fg: open ? '#17131f' : '#f3e9d2',
        pick: () => { const nf = s.fanOpen.slice(); nf[k] = !nf[k]; this.setState({ fanOpen: nf }); }
      };
    });

    const visitedCount = s.visited.length;
    // Respostas da turma: uma pergunta por planeta do mapa (telemovel/perguntas.js); pct = acertos
    const P = window.PERGUNTAS || [];
    const votos = s.votos || {};
    const quem = {};
    const res = P.map((p, q) => {
      const v = votos[q] || {};
      let total = 0, certas = 0;
      Object.keys(v).forEach((k) => { quem[k] = true; total += 1; if (v[k] === p.certa) certas += 1; });
      return { total: total, pct: total ? Math.round(100 * certas / total) : null };
    });
    const respostas = Object.keys(quem).length;
    // No mapa, o oitavo planeta são os Fãs e o merchandise (a faixa pessoal não é uma plataforma)
    const fans = { platform: 'Fans and merch', color: '#f6b8c8', links: [{ to: 1 }, { to: 3 }, { to: 5 }] };
    const mapT = T.slice(0, 7).concat([fans]);
    const mapNodes = mapT.map((t, idx) => {
      const p = pos(idx);
      const isFans = t === fans;
      const lit = isFans ? s.fansSeen : s.visited.indexOf(idx) >= 0;
      const r = res[idx] || { pct: null };
      // Com respostas, o brilho de cada planeta cresce com a percentagem de acertos
      const glow = r.pct !== null ? '0 0 ' + (8 + Math.round(r.pct * 0.5)) + 'px ' + t.color : (lit ? '0 0 26px ' + t.color : 'none');
      return {
        num: isFans ? '★' : pad(idx + 1), label: t.platform, x: p.x.toFixed(2), y: p.y.toFixed(2),
        pct: r.pct !== null ? r.pct + '%' : '', pctColor: t.color,
        fill: lit ? t.color : '#2b2433', ring: lit ? '#f3e9d2' : '#3a3145', glow: glow,
        numColor: lit ? '#17131f' : '#8a7e96', labelColor: lit ? '#f3e9d2' : '#8a7e96',
        pick: isFans ? () => { this.showFans(); this.startTape(); } : () => { this.open(idx); this.startTape(); }
      };
    });
    // As ligações para a faixa pessoal ficam de fora; as restantes acendem-se uma a uma
    const mapLinks = [];
    mapT.forEach((t, idx) => t.links.forEach((l) => { if (l.to < 7) mapLinks.push(seg(pos(idx), pos(l.to), t.color)); }));
    mapLinks.forEach((l, k) => { l.delay = (0.3 + k * 0.13).toFixed(2); });
    const comPct = res.map((r, q) => ({ pct: r.pct, nome: mapT[q].platform })).filter((o) => o.pct !== null)
      .sort((a, b) => b.pct - a.pct);
    let turmaTexto = '';
    if (comPct.length > 1) {
      const mais = comPct[0], menos = comPct[comPct.length - 1];
      turmaTexto = 'Most right answers: ' + mais.nome + ' (' + mais.pct + '%). Hardest question: ' + menos.nome + ' (' + menos.pct + '%).';
    } else if (comPct.length === 1) {
      turmaTexto = comPct[0].pct + '% of the class got the ' + comPct[0].nome + ' question right.';
    }
    const startPath = 'Start with Vol. 1 with the Awesome Mix playing, move on to the 2021 game and, if you get stuck, the 2008 comics have everything else.';

    // Segundo de fita em que cada faixa deve acabar (ver planeamento/guiao.md)
    const target = [60, 105, 135, 175, 215, 260, 295, 360][s.i];
    let paceText = 'Press Play to start the tape';
    let paceColor = '#b8ab92';
    if (s.secs > 0 || s.timerOn) {
      const diff = target - s.secs;
      paceText = diff >= 0 ? 'On time: finish this track by ' + fmt(target) + ' on the tape' : fmt(-diff) + ' behind: speed up';
      paceColor = diff >= 0 ? '#4fb8ab' : '#f6b8c8';
    }

    const vq = s.votoQ;
    const vp = vq >= 0 ? P[vq] : null;
    const vResta = s.votoAte - s.votoAgora;
    const vTotal = vp ? res[vq].total : 0;
    const ligados = s.ligados || 0;

    return {
      accent: accent, showTimer: showTimer,
      votacaoOn: !!s.votacaoOn, qrSrc: s.qrSrc || '', votoUrlCurto: (s.votoUrl || '').replace(/^https?:\/\//, '').replace(/\/$/, ''),
      votoDur: window.Votacao ? Votacao.duracao : 8,
      ligadosTexto: ligados === 1 ? '1 phone connected' : ligados + ' phones connected',
      // Depois de fechar, o aviso mostra a resposta certa e a percentagem de acertos
      votoPill: !!vp, votoTexto: !vp ? '' : (vResta > 0 ? vp.texto : 'Right answer: ' + vp.opcoes[vp.certa]), votoCor: vp ? vp.cor : accent,
      votoSeg: vResta > 0 ? Math.ceil(vResta / 1000) : '✓',
      votoFrac: Math.max(0, Math.min(100, 100 * vResta / ((window.Votacao ? Votacao.duracao : 8) * 1000))).toFixed(1),
      votoLabel: vResta > 0 ? 'ANSWER ON YOUR PHONE' : 'TIME’S UP!',
      votoRespostasTexto: (vTotal === 1 ? '1 answer' : vTotal + ' answers') + (vResta <= 0 && vTotal ? ' · ' + res[vq].pct + '% got it right' : ''),
      turmaTexto: turmaTexto, temTurma: respostas > 0,
      statLabel: respostas > 0 ? 'PLAYERS IN THE CLASS' : 'TRACKS PLAYED',
      statValor: respostas > 0 ? String(respostas) : visitedCount + '/8',
      isHome: s.view === 'home', isTrack: s.view === 'track', isMap: s.view === 'map', isHidden: s.view === 'hidden',
      sideA: list.slice(0, 3), sideB: list.slice(3), all: list, cur: cur, tabs: tabs, timelineFill: timelineFill,
      t0: s.tab === 0, t1: s.tab === 1, t2: s.tab === 2,
      pola: pola, polaRot: polaRots[sel % 4], polaDots: polaDots, stackOpacity: c.works.length > 1 ? 1 : 0,
      flipDeg: s.flip ? 180 : 0,
      toggleFlip: () => this.setState((p) => ({ flip: !p.flip })),
      polaPrev: () => setWork((sel - 1 + c.works.length) % c.works.length),
      polaNext: () => setWork((sel + 1) % c.works.length),
      pieces: pieces, conLines: conLines, conNodes: conNodes, portalsOpen: portalsOpen,
      revealAll: () => { const nb = Object.assign({}, s.beats); nb[s.i] = [true, true, true]; this.setState({ beats: nb }); },
      visitedCount: visitedCount, tapeLabel: s.playing ? 'PLAYING' : 'C-60',
      startLabel: s.secs > 0 ? 'Continue' : 'Play: start the 7 minutes',
      showBack: !(s.i === 0 && s.tab === 0),
      backLabel: s.tab > 0 ? 'Back: ' + tabNames[s.tab - 1] : 'Previous track',
      advanceLabel: s.tab < 1 && s.i < 7 ? 'Next: ' + tabNames[s.tab + 1] : (s.i === 6 ? 'Hidden track' : (s.i < 7 ? 'Next track' : 'See the galaxy map')),
      advance: () => this.next(),
      stepBack: () => this.prev(),
      paceText: paceText, paceColor: paceColor,
      reelAnim: s.playing ? 'animation: spin 2.4s linear infinite' : 'animation: none',
      playLabel: s.playing ? 'Pause' : 'Play the tape',
      fanCards: fanCards,
      hiddenNum: '★', hiddenTitle: 'The Fans', hiddenSub: 'Hidden track · participatory culture', hiddenMark: '', hiddenBorder: '#f0c75e',
      openHidden: () => { this.showFans(); this.startTape(); },
      listOpen: s.listOpen,
      openList: () => this.setState({ listOpen: true }),
      closeList: () => this.setState({ listOpen: false }),
      keepList: (e) => e.stopPropagation(),
      hiddenBack: () => this.prev(),
      hiddenNext: () => this.next(),
      mapNodes: mapNodes, mapLinks: mapLinks, startPath: startPath, usedText: fmt(Math.min(s.secs, limit)),
      toast: s.toast, toastShow: s.toast !== '',
      timerText: fmt(remaining),
      timerColor: remaining <= 0 ? '#f6b8c8' : (remaining <= 60 ? '#f0c75e' : '#f3e9d2'),
      timerBorder: remaining <= 60 && s.secs > 0 ? '#f0c75e' : '#3a3145',
      timerAnim: s.timerOn && remaining <= 60 ? 'animation: blink 1s linear infinite' : '',
      timerLabel: s.timerOn ? 'Pause' : 'Start',
      toggleTimer: () => this.setState((p) => ({ timerOn: !p.timerOn })),
      resetTimer: () => this.setState({ secs: 0, timerOn: false, warned: false }),
      togglePlay: () => this.setState((p) => ({ playing: !p.playing })),
      start: () => { this.open(s.secs > 0 ? s.i : 0); this.startTape(); },
      shuffle: () => {
        const left = [0, 1, 2, 3, 4, 5, 6, 7].filter((k) => s.visited.indexOf(k) < 0 && k !== s.i);
        const pool = left.length ? left : [0, 1, 2, 3, 4, 5, 6, 7].filter((k) => k !== s.i);
        this.open(pool[Math.floor(Math.random() * pool.length)]);
        this.startTape();
      },
      openMap: () => this.goMap(),
      toggleFullscreen: () => this.toggleFullscreen(),
      fullscreenLabel: s.fullscreen ? 'Exit full screen' : 'Full screen',
      goHome: () => this.setState({ view: 'home', playing: false }),
      rewind: () => { this.setState(this.fresh()); this.novaSessao(); }
    };
  }
}

mountDC(Component, document.getElementById('app'), document.getElementById('app-template'), {"accent": "#e8893d", "showTimer": true});
