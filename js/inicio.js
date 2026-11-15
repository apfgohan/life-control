// Página Inicial: avisos no topo, o treino (iniciar ou continuar) e as metas de hoje, da semana e do mês.
var Inicio = (function () {
  var el = UI.el;

  function painelAvisos() {
    var ativos = Dados.lembretesAtivos(), hoje = UI.hoje();
    var urgentes = ativos.filter(function (l) { var s = Dados.situacaoLembrete(l, hoje); return s === 'atrasado' || s === 'hoje'; }).length;
    return el('section', { class: 'painel painel-avisos' + (urgentes ? ' urgente' : '') }, [
      el('div', { class: 'painel-lado-topo' }, [
        el('h2', { class: 'secao-titulo' }, [UI.icone('sino'), 'Avisos', ativos.length ? el('span', { class: 'secao-contagem', text: ativos.length }) : null]),
        el('div', { class: 'pagina-acoes' }, [
          el('a', { class: 'link', href: '#/lembretes', text: ativos.length > 6 ? 'Ver todos (' + ativos.length + ')' : 'Ver todos' }),
          UI.botao('Novo aviso', function () { Lembretes.editar(); }, 'btn-secundario btn-mini', 'mais')
        ])
      ]),
      ativos.length ? el('div', { class: 'grade-avisos' }, ativos.slice(0, 6).map(function (l) { return Lembretes.linha(l, true); }))
        : el('p', { class: 'modal-desc', text: 'Nenhum aviso pendente para agora.' })
    ]);
  }

  function saudacao() {
    var h = new Date().getHours(), nome = (Dados.db.perfil.nome || '').split(' ')[0];
    var s = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    var d = new Date(), dias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    return el('div', { class: 'pagina-topo' }, el('div', null, [
      el('h1', { class: 'pagina-titulo', text: s + (nome ? ', ' + nome : '') }),
      el('div', { class: 'pagina-subtitulo', text: dias[d.getDay()].charAt(0).toUpperCase() + dias[d.getDay()].slice(1) + ', ' + UI.fmtData(UI.hoje()) })
    ]));
  }

  function render(raiz) {
    raiz.appendChild(saudacao());
    raiz.appendChild(painelAvisos());
    raiz.appendChild(Treinos.painelInicio());
    raiz.appendChild(Habitos.painelHoje());
  }

  return { render: render };
})();
