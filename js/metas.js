// Página "Metas": objetivos por área. Concluir uma meta rende XP e faz a patente subir.
var Metas = (function () {
  var el = UI.el;
  var area = 'todas';
  var mostrarConcluidas = false;

  function nomeArea(id) { var a = Dados.AREAS.filter(function (x) { return x[0] === id; })[0]; return a ? a[1] : 'Geral'; }
  function dificuldade(id) { return Dados.DIFICULDADES.filter(function (x) { return x[0] === id; })[0] || Dados.DIFICULDADES[1]; }

  function kg(v) { return (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' kg'; }
  // Título automático da meta de recorde: "Supino reto com 50 kg", "Barra fixa: 12 repetições".
  function tituloPR(b, carga, reps) {
    if (!b) return '';
    if (b.equipamento === 'corpo') return b.nome + ': ' + reps + ' repetições';
    return b.nome + ' com ' + kg(carga) + (reps > 1 ? ' × ' + reps : '');
  }

  function editar(id, areaPadrao) {
    var m = id ? Dados.meta(id) : null;
    var tipo = m && m.tipo === 'pr' ? 'pr' : 'livre';
    var titulo = el('input', { type: 'text', value: m ? m.titulo : '', placeholder: 'Ex.: Correr 10 km', maxLength: 120 });
    var descricao = el('textarea', { rows: 3, value: m ? m.descricao : '', placeholder: 'Como você vai saber que concluiu? (opcional)' });
    var selArea = el('select', null, Dados.AREAS.map(function (a) { return el('option', { value: a[0], text: a[1], selected: (m ? m.area : (areaPadrao || 'habitos')) === a[0] }); }));
    var selDif = el('select', null, Dados.DIFICULDADES.map(function (d) { return el('option', { value: d[0], text: d[1] + ' · ' + d[2] + ' XP', selected: (m ? m.dificuldade : 'media') === d[0] }); }));
    var prazo = el('input', { type: 'date', value: (m && m.prazo) || '' });

    // Campos da meta de recorde (PR)
    var selEx = el('select');
    var bases = Dados.biblioteca();
    selEx.appendChild(el('option', { value: '', text: bases.length ? 'Escolha o exercício…' : 'Cadastre exercícios em Configurações', disabled: true, selected: !(m && m.exercicioId) }));
    Dados.GRUPOS.forEach(function (g) {
      var l = bases.filter(function (b) { return b.grupo === g[0]; });
      if (l.length) selEx.appendChild(el('optgroup', { label: g[1] }, l.map(function (b) { return el('option', { value: b.id, text: b.nome, selected: m && m.exercicioId === b.id }); })));
    });
    var alvoCarga = el('input', { type: 'text', inputMode: 'decimal', value: m && m.alvoCarga ? String(m.alvoCarga).replace('.', ',') : '', placeholder: 'Ex.: 50' });
    var alvoReps = el('input', { type: 'number', inputMode: 'numeric', min: 1, max: 999, value: m && m.alvoReps ? m.alvoReps : '', placeholder: '1' });
    var campoCarga = UI.campo('Carga alvo (kg)', alvoCarga);
    var rotuloReps = el('span', { class: 'campo-rotulo' }), campoReps = el('label', { class: 'campo' }, [rotuloReps, alvoReps]);
    var infoPR = el('span', { class: 'campo-ajuda' });
    var blocoPR = el('div', { class: 'bloco-pr' }, [
      el('div', { class: 'campo' }, [el('span', { class: 'campo-rotulo', text: 'Exercício' }), selEx, infoPR]),
      el('div', { class: 'campos-linha' }, [campoCarga, campoReps])
    ]);
    var campoArea = UI.campo('Área', selArea);

    function atualizar() {
      var pr = tipo === 'pr';
      blocoPR.hidden = !pr;
      campoArea.hidden = pr;
      var b = Dados.base(selEx.value), corpo = b && b.equipamento === 'corpo';
      campoCarga.hidden = corpo;
      rotuloReps.textContent = corpo ? 'Repetições' : 'Repetições (mínimo)';
      alvoReps.placeholder = corpo ? '12' : '1';
      var atual = b ? Dados.prDaBase(b.id) : null;
      infoPR.textContent = !b ? 'Batida sozinha quando um treino registrar este exercício com a carga do alvo.'
        : 'Seu PR hoje: ' + Configuracoes.textoPR(atual) + '. A meta é batida sozinha quando um treino registrar a carga do alvo.';
      titulo.placeholder = pr ? (b ? tituloPR(b, UI.lerValor(alvoCarga.value) || 0, Number(alvoReps.value) || (corpo ? 12 : 1)) + ' (ou escreva o seu)' : 'Ex.: Supino com 50 kg') : 'Ex.: Correr 10 km';
    }
    [selEx, alvoCarga, alvoReps].forEach(function (c) { c.addEventListener('input', atualizar); c.addEventListener('change', atualizar); });
    var segTipo = el('div', { class: 'segmentado' }, [['livre', 'Livre'], ['pr', 'Recorde (PR)']].map(function (o, i, arr) {
      return el('button', { type: 'button', class: tipo === o[0] ? 'ativo' : '', text: o[1], onclick: function (ev) {
        tipo = o[0];
        Array.prototype.forEach.call(ev.currentTarget.parentNode.children, function (b, j) { b.classList.toggle('ativo', arr[j][0] === tipo); });
        atualizar();
      } });
    }));

    var botoes = [{ texto: 'Cancelar', classe: 'btn-secundario' }, { texto: 'Salvar', classe: 'btn-primario', acao: function () {
      var campos = { titulo: titulo.value, descricao: descricao.value, area: selArea.value, dificuldade: selDif.value, prazo: prazo.value, tipo: tipo };
      if (tipo === 'pr') {
        var b = Dados.base(selEx.value), corpo = b && b.equipamento === 'corpo';
        if (!b) { UI.aviso('Escolha o exercício.'); selEx.focus(); return false; }
        var c = UI.lerValor(alvoCarga.value), n = Number(alvoReps.value) || (corpo ? 0 : 1);
        if (!corpo && !(c > 0)) { UI.aviso('Informe a carga alvo.'); alvoCarga.focus(); return false; }
        if (!(n > 0)) { UI.aviso('Informe as repetições.'); alvoReps.focus(); return false; }
        campos.exercicioId = b.id; campos.alvoCarga = c; campos.alvoReps = n;
        campos.titulo = titulo.value.trim() || tituloPR(b, c, n);
      } else if (!titulo.value.trim()) { titulo.focus(); return false; }
      var antes = m ? m.concluida : false;
      var salva = Dados.salvarMeta(campos, id);
      if (salva.tipo === 'pr' && salva.concluida && !antes) UI.aviso('Seu PR já bate essa meta · +' + UI.fmtNum(Dados.xpDaMeta(salva)) + ' XP');
      App.atualizar();
    } }];
    if (m) botoes.unshift({ texto: 'Excluir', classe: 'btn-perigo btn-esquerda', acao: function () {
      UI.confirmar('Excluir a meta "' + m.titulo + '"?' + (m.concluida ? ' O XP que ela rendeu será descontado.' : ''), function () { Dados.excluirMeta(m.id); App.atualizar(); });
    } });
    UI.modal(m ? 'Editar meta' : 'Nova meta', [
      el('div', { class: 'campo' }, [el('span', { class: 'campo-rotulo', text: 'Tipo' }), segTipo]),
      blocoPR,
      UI.campo('Meta', titulo),
      el('div', { class: 'campos-linha' }, [campoArea, UI.campo('Dificuldade', selDif, 'Quanto mais difícil, mais XP ao concluir.')]),
      UI.campo('Prazo (opcional)', prazo),
      UI.campo('Descrição', descricao)
    ], botoes, { icone: 'alvo', subtitulo: 'Concluir metas faz você subir de patente.' });
    atualizar();
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
    var d = dificuldade(m.dificuldade), hoje = UI.hoje(), ehPR = m.tipo === 'pr';
    var atrasada = !m.concluida && m.prazo && m.prazo < hoje;
    var prazo = m.concluida ? (ehPR ? 'Batida em ' : 'Concluída em ') + UI.fmtData(m.dataConclusao)
      : m.prazo ? (atrasada ? 'Prazo vencido em ' : 'Até ') + UI.fmtData(m.prazo) : 'Sem prazo';
    var p = ehPR ? Dados.progressoMetaPR(m) : null;
    var marca = ehPR
      ? el('span', { class: 'btn-check auto' + (m.concluida ? ' marcado' : ''), title: m.concluida ? 'Batida' : 'Batida sozinha ao registrar o treino' }, UI.icone('check'))
      : el('button', { type: 'button', class: 'btn-check' + (m.concluida ? ' marcado' : ''), title: m.concluida ? 'Reabrir' : 'Concluir meta', onclick: function () { alternar(m); } }, UI.icone('check'));
    return el('div', { class: 'meta dif-' + m.dificuldade + (m.concluida ? ' concluida' : '') }, [
      marca,
      UI.simboloMeta(ehPR ? 'pr' : m.area),
      el('button', { type: 'button', class: 'meta-corpo', title: 'Editar', onclick: function () { editar(m.id); } }, [
        el('span', { class: 'meta-titulo', text: m.titulo }),
        m.descricao ? el('span', { class: 'meta-descricao', text: m.descricao }) : null,
        p ? el('span', { class: 'meta-pr' }, [
          el('span', { text: (p.base ? p.base.nome + ' · ' : '') + 'PR atual: ' + Configuracoes.textoPR(p.pr) + ' · alvo: ' + (p.corpo ? m.alvoReps + ' reps' : kg(m.alvoCarga) + (m.alvoReps > 1 ? ' × ' + m.alvoReps : '')) }),
          UI.barra(p.pct)
        ]) : null,
        el('span', { class: 'meta-rodape' }, [
          UI.selo(ehPR ? 'Recorde' : nomeArea(m.area), 'info'),
          ehPR ? UI.selo('automática', 'neutro') : null,
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
        el('div', { class: 'pagina-subtitulo', text: 'Metas recorrentes (por dia, semana ou mês) e metas de longo prazo. Cada uma cumprida rende XP.' })
      ]),
      el('div', { class: 'pagina-acoes' }, [
        UI.botao('Meta recorrente', function () { Habitos.editar(); }, 'btn-secundario', 'mais'),
        UI.botao('Meta de longo prazo', function () { editar(null, area === 'todas' ? null : area); }, 'btn-primario', 'mais')
      ])
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

    raiz.appendChild(Habitos.painelGerenciar());
    raiz.appendChild(el('h2', { class: 'secao-titulo titulo-manual', text: 'Metas de longo prazo' }));
    raiz.appendChild(el('div', { class: 'segmentado segmentado-areas' }, [['todas', 'Todas']].concat(Dados.AREAS).map(function (a) {
      var n = todas.filter(function (m) { return !m.concluida && (a[0] === 'todas' || m.area === a[0]); }).length;
      return el('button', { type: 'button', class: area === a[0] ? 'ativo' : '', onclick: function () { area = a[0]; App.atualizar(); } }, [a[1], n ? el('span', { class: 'secao-contagem', text: n }) : null]);
    })));

    if (!abertas.length) raiz.appendChild(el('div', { class: 'vazio' }, [
      el('p', { class: 'vazio-destaque', text: todas.length ? 'Nenhuma meta em aberto aqui' : 'Nenhuma meta ainda' }),
      el('p', { text: 'Comece por algo concreto e com data: correr 10 km, chegar a um peso, terminar um curso ou um recorde (PR) como supino com 50 kg, que é batido sozinho quando você registrar o treino.' }),
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
