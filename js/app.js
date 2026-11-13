// Navegação entre as páginas (rotas no endereço: #/financeiro, #/lembretes, ...).
var App = (function () {
  var rotas = {
    inicio: Financeiro.render,
    comparativos: Comparativos.render,
    lembretes: Lembretes.render,
    metas: Metas.render,
    fisico: Fisico.render,
    backup: Backup.render,
    configuracoes: Configuracoes.render
  };
  var ROTA_INICIAL = 'inicio'; // endereços antigos (#/financeiro) também caem aqui
  var ultimaRota = null;

  function render() {
    var partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    var nome = rotas[partes[0]] ? partes[0] : ROTA_INICIAL;
    var chave = partes.join('/');
    var rolagem = chave === ultimaRota ? window.scrollY : 0;
    ultimaRota = chave;

    document.querySelectorAll('#menu a').forEach(function (a) {
      a.classList.toggle('ativo', a.getAttribute('data-rota') === nome);
    });
    desenharLateral();
    var raiz = document.getElementById('conteudo');
    raiz.innerHTML = '';
    rotas[nome](raiz, partes.slice(1));
    window.scrollTo(0, rolagem);
    Patentes.conferirPromocao();
  }

  // ---------- Menu lateral ----------
  function fotoPerfil(p) {
    var el = UI.el;
    if (p.foto) return el('img', { class: 'perfil-foto', src: p.foto, alt: '' });
    var inicial = (p.nome || 'L').trim().charAt(0).toUpperCase() || 'L';
    return el('span', { class: 'perfil-foto perfil-inicial', text: inicial });
  }

  // Perfil com a patente (abre "Minha patente") e contador de lembretes; redesenhado a cada atualização da tela.
  function desenharLateral() {
    var el = UI.el, p = Dados.db.perfil || {};
    var caixa = document.getElementById('lateral-perfil');
    if (caixa) {
      var r = Patentes.calcular();
      caixa.innerHTML = '';
      caixa.appendChild(el('button', { type: 'button', class: 'lateral-perfil', title: 'Ver minha patente', onclick: Patentes.abrir }, [
        el('span', { class: 'lateral-perfil-topo' }, [
          fotoPerfil(p),
          el('span', { class: 'lateral-perfil-texto' }, [
            el('strong', { class: 'lateral-nome', text: p.nome || 'Meu perfil' }),
            el('span', { class: 'lateral-patente' }, [Patentes.insignia(r.indice, 'mini'), el('span', { text: r.patente.nome })])
          ])
        ]),
        UI.barra(r.pct),
        el('span', { class: 'lateral-xp', text: UI.fmtNum(r.xp) + ' XP' + (r.proxima ? ' · faltam ' + UI.fmtNum(r.falta) : '') })
      ]));
    }
    // Lembretes atrasados ou de hoje: número ao lado do item do menu.
    var link = document.querySelector('#menu a[data-rota="lembretes"]');
    if (link) {
      var hoje = UI.hoje();
      var n = Dados.db.lembretes.filter(function (l) { var s = Dados.situacaoLembrete(l, hoje); return s === 'atrasado' || s === 'hoje'; }).length;
      var velho = link.querySelector('.menu-contador');
      if (velho) velho.remove();
      if (n) link.appendChild(el('span', { class: 'menu-contador', text: n, title: n + (n === 1 ? ' lembrete para hoje ou atrasado' : ' lembretes para hoje ou atrasados') }));
    }
  }
  function fecharMenu() { document.body.classList.remove('menu-aberto'); }

  window.addEventListener('hashchange', function () { fecharMenu(); render(); });
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('#menu a[data-icone]').forEach(function (a) {
      var texto = a.textContent.trim();
      a.textContent = '';
      a.title = texto;
      a.appendChild(UI.icone(a.getAttribute('data-icone')));
      a.appendChild(UI.el('span', { class: 'lateral-texto', text: texto }));
    });
    // Menu recolhido (só os ícones): lembrado neste aparelho.
    var CHAVE_MINI = 'life-control.menu-recolhido';
    function aplicarMini(mini) {
      document.body.classList.toggle('lateral-mini', mini);
      var b = document.getElementById('recolher-menu');
      b.title = mini ? 'Expandir o menu' : 'Recolher o menu';
      b.setAttribute('aria-label', b.title);
    }
    var mini = false;
    try { mini = localStorage.getItem(CHAVE_MINI) === '1'; } catch (e) { /* preferência */ }
    aplicarMini(mini);
    document.getElementById('recolher-menu').addEventListener('click', function () {
      var agora = !document.body.classList.contains('lateral-mini');
      aplicarMini(agora);
      try { localStorage.setItem(CHAVE_MINI, agora ? '1' : '0'); } catch (e) { /* preferência */ }
    });
    document.getElementById('abrir-menu').addEventListener('click', function () { document.body.classList.toggle('menu-aberto'); });
    document.getElementById('lateral-fundo').addEventListener('click', fecharMenu);
    render();
    Nuvem.iniciar();         // login e sincronização entre aparelhos (se o Firebase estiver configurado)
    Armazenamento.iniciar(); // conecta à pasta de dados (se já escolhida) e carrega o arquivo, se for mais recente
    // Permite instalar como app e abrir sem internet (só funciona em https ou localhost).
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('Service worker não registrado', e); });
    }
  });

  // ---------- Versão nova publicada ----------
  // Uma aba aberta continua com os arquivos antigos até ser recarregada: confere o versao.json de tempos em tempos.
  var avisoVersao = null;
  function conferirVersao() {
    if (!window.VERSAO_APP || !/^https?:$/.test(location.protocol) || avisoVersao) return;
    fetch('versao.json?_=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) {
      if (!v || !v.versao || v.versao === window.VERSAO_APP || avisoVersao) return;
      avisoVersao = UI.el('div', { class: 'aviso-versao' }, [
        UI.el('span', { text: 'Há uma versão nova do programa.' }),
        UI.botao('Atualizar agora', function () { location.reload(); }, 'btn-primario')
      ]);
      document.body.appendChild(avisoVersao);
    }).catch(function () { /* sem internet: confere depois */ });
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') conferirVersao(); });
  setInterval(conferirVersao, 10 * 60 * 1000);
  setTimeout(conferirVersao, 5000);

  return { atualizar: render, fotoPerfil: fotoPerfil };
})();
