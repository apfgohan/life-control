// Página "Metas": objetivos por área. Concluir uma meta rende XP e faz a patente subir.
var Metas = (function () {
  var el = UI.el;
  var area = 'todas';
  var mostrarConcluidas = false;

  function nomeArea(id) { var a = Dados.AREAS.filter(function (x) { return x[0] === id; })[0]; return a ? a[1] : 'Geral'; }
  function dificuldade(id) { return Dados.DIFICULDADES.filter(function (x) { return x[0] === id; })[0] || Dados.DIFICULDADES[1]; }

  function editar(id, areaPadrao) {
    var m = id ? Dados.meta(id) : null;
    var titulo = el('input', { type: 'text', value: m ? m.titulo : '', placeholder: 'Ex.: Juntar R$ 10.000 de reserva', maxLength: 120 });
    var descricao = el('textarea', { rows: 3, value: m ? m.descricao : '', placeholder: 'Como você vai saber que concluiu? (opcional)' });
    var selArea = el('select', null, Dados.AREAS.map(function (a) { return el('option', { value: a[0], text: a[1], selected: (m ? m.area : (areaPadrao || 'financeiro')) === a[0] }); }));
    var selDif = el('select', null, Dados.DIFICULDADES.map(function (d) { return el('option', { value: d[0], text: d[1] + ' · ' + d[2] + ' XP', selected: (m ? m.dificuldade : 'media') === d[0] }); }));
    var prazo = el('input', { type: 'date', value: (m && m.prazo) || '' });
    var botoes = [{ texto: 'Cancelar', classe: 'btn-secundario' }, { texto: 'Salvar', classe: 'btn-primario', acao: function () {
      if (!titulo.value.trim()) { titulo.focus(); return false; }
      Dados.salvarMeta({ titulo: titulo.value, descricao: descricao.value, area: selArea.value, dificuldade: selDif.value, prazo: prazo.value }, id);
      App.atualizar();
    } }];
    if (m) botoes.unshift({ texto: 'Excluir', classe: 'btn-perigo btn-esquerda', acao: function () {
      UI.confirmar('Excluir a meta "' + m.titulo + '"?' + (m.concluida ? ' O XP que ela rendeu será descontado.' : ''), function () { Dados.excluirMeta(m.id); App.atualizar(); });
    } });
    UI.modal(m ? 'Editar meta' : 'Nova meta', [
      UI.campo('Meta', titulo),
      el('div', { class: 'campos-linha' }, [UI.campo('Área', selArea), UI.campo('Dificuldade', selDif, 'Quanto mais difícil, mais XP ao concluir.')]),
      UI.campo('Prazo (opcional)', prazo),
      UI.campo('Descrição', descricao)
    ], botoes, { icone: 'alvo', subtitulo: 'Concluir metas faz você subir de patente.' });
  }

  function alternar(m) {
    if (m.concluida) {
      UI.confirmar('Reabrir a meta "' + m.titulo + '"? O XP dela será descontado até você concluir de novo.', function () { Dados.concluirMeta(m.id, false); App.atualizar(); }, 'Reabrir');
      return;
    }
    Dados.concluirMeta(m.id, true);
    UI.aviso('Meta concluída · +' + UI.fmtNum(Dados.xpDaMeta(m)) + ' XP');
    App.atualizar();
  }

  function cartao(m) {
    var d = dificuldade(m.dificuldade), hoje = UI.hoje();
    var atrasada = !m.concluida && m.prazo && m.prazo < hoje;
    var prazo = m.concluida ? 'Concluída em ' + UI.fmtData(m.dataConclusao)
      : m.prazo ? (atrasada ? 'Prazo vencido em ' : 'Até ') + UI.fmtData(m.prazo) : 'Sem prazo';
    return el('div', { class: 'meta dif-' + m.dificuldade + (m.concluida ? ' concluida' : '') }, [
      el('button', { type: 'button', class: 'btn-check' + (m.concluida ? ' marcado' : ''), title: m.concluida ? 'Reabrir' : 'Concluir meta', onclick: function () { alternar(m); } }, UI.icone('check')),
      el('button', { type: 'button', class: 'meta-corpo', title: 'Editar', onclick: function () { editar(m.id); } }, [
        el('span', { class: 'meta-titulo', text: m.titulo }),
        m.descricao ? el('span', { class: 'meta-descricao', text: m.descricao }) : null,
        el('span', { class: 'meta-rodape' }, [
          UI.selo(nomeArea(m.area), 'info'),
          UI.selo(d[1], 'neutro'),
          el('span', { class: 'meta-prazo' + (atrasada ? ' negativo' : ''), text: prazo })
        ])
      ]),
      el('span', { class: 'meta-xp', text: '+' + UI.fmtNum(d[2]) + ' XP' })
    ]);
  }

  function render(raiz) {
    var r = Patentes.calcular(), todas = Dados.db.metas;
    var daArea = todas.filter(function (m) { return area === 'todas' || m.area === area; });
    var abertas = daArea.filter(function (m) { return !m.concluida; }).sort(function (a, b) {
      var x = a.prazo || '9999', y = b.prazo || '9999';
      return x !== y ? (x < y ? -1 : 1) : (a.criadoEm || 0) - (b.criadoEm || 0);
    });
    var concluidas = daArea.filter(function (m) { return m.concluida; }).sort(function (a, b) { return (b.dataConclusao || '') < (a.dataConclusao || '') ? -1 : 1; });

    raiz.appendChild(el('div', { class: 'pagina-topo' }, [
      el('div', null, [
        el('h1', { class: 'pagina-titulo', text: 'Metas' }),
        el('div', { class: 'pagina-subtitulo', text: 'Cada meta concluída rende XP e aproxima a próxima patente.' })
      ]),
      el('div', { class: 'pagina-acoes' }, UI.botao('Nova meta', function () { editar(null, area === 'todas' ? null : area); }, 'btn-primario', 'mais'))
    ]));

    raiz.appendChild(el('button', { type: 'button', class: 'painel faixa-patente', title: 'Ver minha patente', onclick: Patentes.abrir }, [
      Patentes.insignia(r.indice, 'grande'),
      el('div', { class: 'faixa-patente-texto' }, [
        el('div', { class: 'patente-nome', text: r.patente.nome }),
        UI.barra(r.pct),
        el('div', { class: 'campo-ajuda', text: UI.fmtNum(r.xp) + ' XP' + (r.proxima ? ' · faltam ' + UI.fmtNum(r.falta) + ' para ' + r.proxima.nome : ' · patente máxima') })
      ]),
      r.proxima ? el('div', { class: 'faixa-patente-proxima' }, [Patentes.insignia(r.proxima.indice, 'media'), el('span', { text: r.proxima.nome })]) : null
    ]));

    raiz.appendChild(el('div', { class: 'segmentado segmentado-areas' }, [['todas', 'Todas']].concat(Dados.AREAS).map(function (a) {
      var n = todas.filter(function (m) { return !m.concluida && (a[0] === 'todas' || m.area === a[0]); }).length;
      return el('button', { type: 'button', class: area === a[0] ? 'ativo' : '', onclick: function () { area = a[0]; App.atualizar(); } }, [a[1], n ? el('span', { class: 'secao-contagem', text: n }) : null]);
    })));

    if (!abertas.length) raiz.appendChild(el('div', { class: 'vazio' }, [
      el('p', { class: 'vazio-destaque', text: todas.length ? 'Nenhuma meta em aberto aqui' : 'Nenhuma meta ainda' }),
      el('p', { text: 'Comece por algo concreto e com data: quitar uma dívida, montar a reserva, treinar três vezes por semana durante um mês.' }),
      el('div', { class: 'vazio-acoes' }, UI.botao('Criar meta', function () { editar(null, area === 'todas' ? null : area); }, 'btn-primario'))
    ]));
    else raiz.appendChild(el('div', { class: 'lista-metas' }, abertas.map(cartao)));

    if (concluidas.length) {
      raiz.appendChild(el('button', { type: 'button', class: 'link link-concluidos', onclick: function () { mostrarConcluidas = !mostrarConcluidas; App.atualizar(); },
        text: (mostrarConcluidas ? 'Ocultar' : 'Mostrar') + ' concluídas (' + concluidas.length + ')' }));
      if (mostrarConcluidas) raiz.appendChild(el('div', { class: 'lista-metas' }, concluidas.map(cartao)));
    }
  }

  return { render: render, editar: editar };
})();
