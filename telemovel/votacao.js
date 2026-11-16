// Liga a apresentação e a página do telemóvel à mesma "sala" de votação.
// Com o Firebase configurado (config.js), tudo passa pela Realtime Database:
//   sala/live                         pergunta aberta { sessao, q, estado, abertaEm }
//   sala/votos/<sessao>/<q>/<votante> opção escolhida
//   sala/ligados/<votante>            telemóveis com a página aberta
// Sem Firebase, funciona em modo local (separadores do mesmo browser), para ensaiar.
(function () {
  'use strict';

  const cfg = window.VOTACAO_CONFIG || {};
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const GRACA = 12000; // igual às regras da base de dados

  function carregar(src) {
    return new Promise(function (ok, falha) {
      const s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = falha;
      document.head.appendChild(s);
    });
  }

  function comFirebase() {
    return carregar(SDK + 'firebase-app-compat.js')
      .then(function () { return carregar(SDK + 'firebase-database-compat.js'); })
      .then(function () {
        const fb = window.firebase;
        const db = fb.initializeApp(cfg.firebase).database();
        const sala = db.ref('sala');
        let desvio = 0;
        db.ref('.info/serverTimeOffset').on('value', function (s) { desvio = s.val() || 0; });

        function ouvir(ref, ler, cb) {
          const f = function (s) { cb(ler(s)); };
          ref.on('value', f);
          return function () { ref.off('value', f); };
        }

        return {
          modo: 'firebase',
          url: cfg.urlTelemovel || 'https://' + cfg.firebase.projectId + '.web.app/',
          agora: function () { return Date.now() + desvio; },
          abrir: function (live) {
            return sala.child('live')
              .set(Object.assign({}, live, { abertaEm: fb.database.ServerValue.TIMESTAMP }))
              .catch(function () {});
          },
          aoVivo: function (cb) { return ouvir(sala.child('live'), function (s) { return s.val(); }, cb); },
          votar: function (sessao, q, votante, opcao) {
            return sala.child('votos/' + sessao + '/' + q + '/' + votante).set(opcao);
          },
          aosVotos: function (sessao, cb) {
            return ouvir(sala.child('votos/' + sessao), function (s) { return s.val() || {}; }, cb);
          },
          entrar: function (votante) {
            const eu = sala.child('ligados/' + votante);
            db.ref('.info/connected').on('value', function (s) {
              if (s.val()) eu.onDisconnect().remove().then(function () { return eu.set(true); });
            });
          },
          aosLigados: function (cb) { return ouvir(sala.child('ligados'), function (s) { return s.numChildren(); }, cb); }
        };
      });
  }

  function local() {
    const CHAVE = 'awesome-mix-votacao';
    const ouvintes = [];

    function ler() {
      try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { return {}; }
    }
    function avisar() {
      const d = ler();
      ouvintes.slice().forEach(function (f) { f(d); });
    }
    function gravar(mudar) {
      const d = ler();
      mudar(d);
      try { localStorage.setItem(CHAVE, JSON.stringify(d)); } catch (e) { /* sem armazenamento */ }
      avisar();
    }
    function ouvir(ler1, cb) {
      const f = function (d) { cb(ler1(d)); };
      ouvintes.push(f);
      f(ler());
      return function () {
        const i = ouvintes.indexOf(f);
        if (i >= 0) ouvintes.splice(i, 1);
      };
    }
    window.addEventListener('storage', function (e) { if (e.key === CHAVE) avisar(); });

    return {
      modo: 'local',
      url: null,
      agora: function () { return Date.now(); },
      abrir: function (live) {
        gravar(function (d) { d.live = Object.assign({}, live, { abertaEm: Date.now() }); });
        return Promise.resolve();
      },
      aoVivo: function (cb) { return ouvir(function (d) { return d.live || null; }, cb); },
      votar: function (sessao, q, votante, opcao) {
        const live = ler().live;
        if (!live || live.sessao !== sessao || live.q !== String(q) || live.estado !== 'pergunta' || Date.now() > live.abertaEm + GRACA) {
          return Promise.reject(new Error('fechada'));
        }
        gravar(function (d) {
          d.votos = d.votos || {};
          const s = d.votos[sessao] = d.votos[sessao] || {};
          (s[q] = s[q] || {})[votante] = opcao;
        });
        return Promise.resolve();
      },
      aosVotos: function (sessao, cb) {
        return ouvir(function (d) { return (d.votos && d.votos[sessao]) || {}; }, cb);
      },
      entrar: function (votante) {
        gravar(function (d) { d.ligados = d.ligados || {}; d.ligados[votante] = true; });
        window.addEventListener('pagehide', function () {
          gravar(function (d) { if (d.ligados) delete d.ligados[votante]; });
        });
      },
      aosLigados: function (cb) { return ouvir(function (d) { return Object.keys(d.ligados || {}).length; }, cb); }
    };
  }

  window.Votacao = {
    duracao: cfg.duracao || 8,
    // Resolve com a ligação, ou null se o Firebase não carregar (sem internet): a apresentação segue sem perguntas
    ligar: function () {
      if (!cfg.firebase) return Promise.resolve(local());
      const espera = new Promise(function (ok) { setTimeout(function () { ok(null); }, 10000); });
      return Promise.race([comFirebase(), espera]).catch(function () { return null; });
    },
    // Um identificador por telemóvel, guardado para não contar o mesmo voto duas vezes
    idVotante: function () {
      let id = '';
      try { id = localStorage.getItem('awesome-mix-votante') || ''; } catch (e) { /* sem armazenamento */ }
      if (!id) {
        id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        try { localStorage.setItem('awesome-mix-votante', id); } catch (e) { /* sem armazenamento */ }
      }
      return id;
    }
  };
})();
