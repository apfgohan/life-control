// Metas recorrentes: diárias (em dias da semana escolhidos), semanais e mensais, de Estudo, Treino, Dieta ou Hábito.
// Estudo (horas do Controle de Estudos), Treino (treinos finalizados) e Dieta (dias 100% ou refeições na dieta)
// são calculados sozinhos; Hábito é marcado à mão. Aparecem na Página Inicial, no detalhe de cada dia e em Metas.
var Habitos = (function () {
  var el = UI.el;
  var DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  var filtroArea = 'todas';

  function textoDias(h) {
    var d = h.dias.slice().sort(), chave = d.join('');
    if (d.length === 7) return 'todos os dias';
    if (chave === '01234') return 'seg a sex';
    if (chave === '56') return 'sáb e dom';
    return d.map(function (i) { return DIAS[i]; }).join(', ');
  }
  function automatica(h) { return h.medida !== 'manual'; }
  function fmtValor(h, v) {
    if (h.medida === 'horas') return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    return String(Math.round(v));
  }
  function unidade(h, v) { var m = Dados.medidaHabito(h.medida); return h.medida === 'horas' ? 'h' : (Math.abs(v - 1) < 1e-9 ? m[3] : m[4]); }
  function nomePeriodo(p) { return p === 'dia' ? 'por dia' : p === 'semana' ? 'por semana' : 'por mês'; }
  // "4 h por dia · seg a sex", "5 treinos por semana", "Dia 100% na dieta · todos os dias"
  function descricao(h) {
    var alvo = fmtValor(h, h.alvo) + ' ' + unidade(h, h.alvo), dias = h.periodo === 'dia' ? ' · ' + textoDias(h) : '';
    if (h.medida === 'manual') return (h.periodo === 'dia' ? 'Marcar ao fazer' : alvo + ' ' + nomePeriodo(h.periodo)) + dias;
    if (h.medida === 'dias100' && h.periodo === 'dia') return 'Todas as refeições na dieta' + dias;
    return alvo + ' ' + nomePeriodo(h.periodo) + dias;
  }
  // Título automático, quando o campo fica em branco.
  function tituloPadrao(area, medida, periodo, alvo) {
    var n = Number(alvo) || 1;
    if (medida === 'horas') return 'Estudar ' + n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' h' + (periodo === 'dia' ? '' : periodo === 'semana' ? ' na semana' : ' no mês');
    if (medida === 'treinos') return periodo === 'dia' ? 'Treinar' : n + ' treinos ' + (periodo === 'semana' ? 'na semana' : 'no mês');
    if (medida === 'dias100') return periodo === 'dia' ? 'Dia 100% na dieta' : n + ' dias 100% na dieta';
    if (medida === 'refeicoes') return n + ' refeições na dieta';
    return 'Meta';
  }
  function nomeArea(a) { var x = Dados.AREAS_HABITO.filter(function (y) { return y[0] === a; })[0]; return x ? x[1] : 'Hábito'; }

  // ---------- Formulário ----------
  function segmentado(opcoes, atual, aoEscolher) {
    var botoes = opcoes.map(function (o) {
      return el('button', { type: 'button', class: o[0] === atual ? 'ativo' : '', text: o[1], onclick: function () {
        botoes.forEach(function (b, i) { b.classList.toggle('ativo', opcoes[i][0] === o[0]); });
        aoEscolher(o[0]);
      } });
    });
    return el('div', { class: 'segmentado' }, botoes);
  }

  function editar(id, padrao) {
    var h = id ? Dados.habito(id) : null;
    padrao = padrao || {};
    var area = h ? h.area : (padrao.area || 'estudo'), periodo = h ? h.periodo : (padrao.periodo || 'dia');
    var medida = h ? h.medida : null, dificuldade = h ? h.dificuldade : 'facil';
    var titulo = el('input', { type: 'text', value: h ? h.titulo : '', maxLength: 100 });
    var selMedida = el('select');
    var alvo = el('input', { type: 'text', inputMode: 'decimal', value: h ? fmtValor(h, h.alvo) : '' });
    var rotuloAlvo = el('span', { class: 'campo-rotulo' }), ajudaAlvo = el('span', { class: 'campo-ajuda' });
    var campoAlvo = el('label', { class: 'campo' }, [rotuloAlvo, alvo, ajudaAlvo]);
    var campoMedida = UI.campo('O que mede', selMedida);
    var marcados = h && h.periodo === 'dia' ? h.dias.slice() : [0, 1, 2, 3, 4, 5, 6];
    var botoesDias = DIAS.map(function (nome, i) {
      var b = el('button', { type: 'button', class: 'dia-chip' + (marcados.indexOf(i) >= 0 ? ' ativo' : ''), text: nome, onclick: function () {
        var p = marcados.indexOf(i);
        if (p >= 0) marcados.splice(p, 1); else marcados.push(i);
        b.classList.toggle('ativo', p < 0);
      } });
      return b;
    });
    function atalho(texto, dias) {
      return el('button', { type: 'button', class: 'link', text: texto, onclick: function () {
        marcados = dias.slice();
        botoesDias.forEach(function (b, i) { b.classList.toggle('ativo', dias.indexOf(i) >= 0); });
      } });
    }
    var campoDias = UI.campo('Em quais dias', el('div', { class: 'dias-escolha' }, [
      el('div', { class: 'dias-chips' }, botoesDias),
      el('div', { class: 'atalhos' }, [atalho('Todos', [0, 1, 2, 3, 4, 5, 6]), atalho('Seg a sex', [0, 1, 2, 3, 4]), atalho('Sáb e dom', [5, 6])])
    ]));
    var xpInfo = el('span', { class: 'campo-ajuda' });

    function atualizar() {
      var opcoes = Dados.MEDIDAS_HABITO.filter(function (m) { return m[1] === area; });
      if (!opcoes.some(function (m) { return m[0] === medida; })) medida = opcoes[0][0];
      selMedida.innerHTML = '';
      opcoes.forEach(function (m) { selMedida.appendChild(el('option', { value: m[0], text: m[2], selected: m[0] === medida })); });
      campoMedida.hidden = opcoes.length < 2;
      campoDias.hidden = periodo !== 'dia';
      var semAlvo = medida === 'manual' && periodo === 'dia' || medida === 'dias100' && periodo === 'dia' || medida === 'treinos' && periodo === 'dia';
      campoAlvo.hidden = semAlvo;
      var m = Dados.medidaHabito(medida);
      rotuloAlvo.textContent = medida === 'horas' ? 'Horas de estudo ' + nomePeriodo(periodo) : 'Quantas ' + m[4] + ' ' + nomePeriodo(periodo);
      ajudaAlvo.textContent = medida === 'horas' ? 'Somadas do Controle de Estudos (todas as sessões, inclusive Anki).' : medida === 'treinos' ? 'Treinos finalizados na aba Treinos.' : medida === 'refeicoes' ? 'Refeições registradas como "Dieta".' : medida === 'dias100' ? 'Dias com todas as refeições do plano na dieta.' : '';
      if (!alvo.value) alvo.placeholder = medida === 'horas' ? (periodo === 'dia' ? '4' : periodo === 'semana' ? '25' : '100') : periodo === 'semana' ? '5' : '20';
      titulo.placeholder = tituloPadrao(area, medida, periodo, alvo.value || alvo.placeholder) + ' (ou escreva o seu)';
      var dif = Dados.DIFICULDADE_HABITO.filter(function (d) { return d[0] === dificuldade; })[0];
      xpInfo.textContent = 'Cumprir rende ' + Math.round(Dados.XP_PERIODO[periodo] * dif[2]) + ' XP ' + (periodo === 'dia' ? 'por dia' : periodo === 'semana' ? 'por semana' : 'por mês') + '.';
    }
    selMedida.addEventListener('change', function () { medida = selMedida.value; atualizar(); });
    alvo.addEventListener('input', atualizar);
    var selDif = segmentado(Dados.DIFICULDADE_HABITO.map(function (d) { return [d[0], d[1] + ' ×' + String(d[2]).replace('.', ',')]; }), dificuldade, function (v) { dificuldade = v; atualizar(); });

    var botoes = [{ texto: 'Cancelar', classe: 'btn-secundario' }, { texto: 'Salvar', classe: 'btn-primario', acao: function () {
      if (periodo === 'dia' && !marcados.length) { UI.aviso('Escolha pelo menos um dia da semana.'); return false; }
      var v = campoAlvo.hidden ? 1 : UI.lerValor(alvo.value || alvo.placeholder);
      if (!(v > 0)) { UI.aviso('Informe o alvo.'); alvo.focus(); return false; }
      if (medida === 'manual' && !titulo.value.trim()) { UI.aviso('Dê um nome ao hábito.'); titulo.focus(); return false; }
      Dados.salvarHabito({ titulo: titulo.value.trim() || tituloPadrao(area, medida, periodo, v), area: area, periodo: periodo, medida: medida, alvo: v, dias: marcados, dificuldade: dificuldade }, id);
      App.atualizar();
    } }];
    if (h) botoes.unshift({ texto: 'Excluir', classe: 'btn-perigo btn-esquerda', acao: function () {
      UI.confirmar('Excluir a meta "' + h.titulo + '"? O XP que ela rendeu também sai.', function () { Dados.excluirHabito(h.id); App.atualizar(); });
    } });
    UI.modal(h ? 'Editar meta recorrente' : 'Nova meta recorrente', [
      el('div', { class: 'campo' }, [el('span', { class: 'campo-rotulo', text: 'Área' }), segmentado(Dados.AREAS_HABITO, area, function (v) { area = v; atualizar(); })]),
      el('div', { class: 'campo' }, [el('span', { class: 'campo-rotulo', text: 'Período' }), segmentado(Dados.PERIODOS, periodo, function (v) { periodo = v; atualizar(); })]),
      campoMedida, campoAlvo, campoDias,
      UI.campo('Nome da meta', titulo),
      el('div', { class: 'campo' }, [el('span', { class: 'campo-rotulo', text: 'Dificuldade' }), selDif, xpInfo])
    ], botoes, { icone: 'alvo', subtitulo: 'Estudo, Treino e Dieta se marcam sozinhos; Hábito você marca.' });
    atualizar();
  }

  // ---------- Linha de uma meta num dia ----------
  function alternar(h, iso) {
    var feito = !h.feitos[iso], antes = Dados.progressoHabito(h, iso).completo;
    Dados.marcarHabito(h.id, iso, feito);
    if (feito) UI.aviso(!antes && Dados.progressoHabito(h, iso).completo ? 'Meta cumprida · +' + Dados.xpDoHabito(h) + ' XP' : 'Registrado');
    App.atualizar();
  }

  function linha(h, iso) {
    var p = Dados.progressoHabito(h, iso), auto = automatica(h), diariaSimples = h.periodo === 'dia' && p.alvo === 1;
    var seq = Dados.sequenciaHabito(h), feitoHoje = !!h.feitos[iso];
    var marca = auto
      ? el('span', { class: 'btn-check auto' + (p.completo ? ' marcado' : ''), title: p.completo ? 'Cumprida' : 'Marca sozinha' }, UI.icone('check'))
      : el('button', { type: 'button', class: 'btn-check' + (feitoHoje ? ' marcado' : ''), title: feitoHoje ? 'Desmarcar' : 'Marcar que fiz', onclick: function () { alternar(h, iso); } }, UI.icone('check'));
    return el('div', { class: 'habito area-' + h.area + (p.completo ? ' completo' : '') }, [
      marca,
      UI.simboloMeta(h.area),
      el('button', { type: 'button', class: 'habito-corpo', title: 'Editar', onclick: function () { editar(h.id); } }, [
        el('span', { class: 'habito-titulo', text: h.titulo }),
        el('span', { class: 'habito-meta' }, [
          el('span', { class: 'habito-area', text: nomeArea(h.area) }),
          el('span', { text: descricao(h) }),
          seq > 1 ? el('span', { class: 'habito-sequencia', text: seq + ' dias seguidos' }) : null,
          auto ? el('span', { class: 'habito-auto', text: 'automática' }) : null
        ]),
        diariaSimples ? null : UI.barra(p.pct)
      ]),
      el('span', { class: 'habito-lado' }, [
        diariaSimples && !auto ? null : el('span', { class: 'habito-contagem' + (p.completo ? ' positivo' : ''), text: fmtValor(h, p.feitas) + '/' + fmtValor(h, p.alvo) + (h.medida === 'horas' ? ' h' : '') }),
        el('span', { class: 'habito-xp', text: '+' + Dados.xpDoHabito(h) + ' XP' })
      ])
    ]);
  }

  // Metas que valem num dia, separadas por frequência.
  function doDia(iso) {
    var r = { dia: [], semana: [], mes: [] };
    Dados.habitos().forEach(function (h) { if (Dados.habitoValeNoDia(h, iso) && h.desde <= iso) r[h.periodo].push(h); });
    return r;
  }

  function grupo(titulo, lista, iso) {
    if (!lista.length) return null;
    return el('div', { class: 'habitos-grupo' }, [
      el('div', { class: 'habitos-grupo-titulo', text: titulo }),
      el('div', { class: 'lista-habitos' }, lista.map(function (h) { return linha(h, iso); }))
    ]);
  }

  // Aviso quando há meta de estudo e as horas do Controle de Estudos não estão chegando.
  function avisoEstudos(lista) {
    if (!lista.some(function (h) { return h.medida === 'horas'; }) || !window.Estudos) return null;
    var i = Estudos.info();
    if (i.conectado && i.estado !== 'erro') return null;
    return el('p', { class: 'aviso-estudos' }, i.estado === 'erro'
      ? 'Não foi possível ler o Controle de Estudos: ' + i.erro
      : (i.temDados ? 'Mostrando as horas de estudo da última leitura (' + new Date(i.lidoEm).toLocaleString('pt-BR') + '). ' : '') + 'Entre com a sua conta Google (a mesma do Controle de Estudos) para as horas chegarem sozinhas.');
  }

  // Painel da Página Inicial: metas de hoje, da semana e do mês.
  function painelHoje() {
    var hoje = UI.hoje(), g = doDia(hoje), total = Dados.db.habitos.length;
    var cumpridasHoje = g.dia.filter(function (h) { return Dados.habitoCumpridoNoDia(h, hoje); }).length;
    return el('section', { class: 'painel painel-habitos' }, [
      el('div', { class: 'painel-lado-topo' }, [
        el('h2', { class: 'secao-titulo' }, ['Metas', g.dia.length ? el('span', { class: 'secao-contagem' + (cumpridasHoje === g.dia.length ? ' completa' : ''), text: cumpridasHoje + '/' + g.dia.length + ' hoje' }) : null]),
        el('div', { class: 'pagina-acoes' }, [
          el('a', { class: 'link', href: '#/metas', text: 'Ver todas' }),
          UI.botao('Nova meta', function () { editar(); }, 'btn-secundario btn-mini', 'mais')
        ])
      ]),
      avisoEstudos(Dados.db.habitos),
      total ? el('div', { class: 'habitos-colunas' }, [
        grupo('Hoje', g.dia, hoje) || el('div', { class: 'habitos-grupo' }, [el('div', { class: 'habitos-grupo-titulo', text: 'Hoje' }), el('p', { class: 'modal-desc', text: 'Nenhuma meta diária para hoje.' })]),
        grupo('Esta semana', g.semana, hoje),
        grupo('Este mês', g.mes, hoje)
      ]) : el('p', { class: 'modal-desc', text: 'Crie metas de estudo (horas do Controle de Estudos), treino, dieta ou hábitos, por dia, semana ou mês. As de estudo, treino e dieta se marcam sozinhas.' })
    ]);
  }

  // Página Metas: todas as metas recorrentes, com filtro por área e o progresso do período atual.
  function painelGerenciar() {
    var hoje = UI.hoje(), todas = Dados.habitos();
    var lista = todas.filter(function (h) { return filtroArea === 'todas' || h.area === filtroArea; });
    var filtros = el('div', { class: 'segmentado' }, [['todas', 'Todas']].concat(Dados.AREAS_HABITO).map(function (a) {
      var n = todas.filter(function (h) { return a[0] === 'todas' || h.area === a[0]; }).length;
      return el('button', { type: 'button', class: filtroArea === a[0] ? 'ativo' : '', onclick: function () { filtroArea = a[0]; App.atualizar(); } }, [a[1], n ? el('span', { class: 'secao-contagem', text: n }) : null]);
    }));
    return el('section', { class: 'painel painel-habitos' }, [
      el('div', { class: 'painel-lado-topo' }, [
        el('h2', { class: 'secao-titulo' }, ['Metas recorrentes', todas.length ? el('span', { class: 'secao-contagem', text: todas.length }) : null]),
        UI.botao('Nova meta recorrente', function () { editar(null, { area: filtroArea !== 'todas' ? filtroArea : null }); }, 'btn-primario btn-mini', 'mais')
      ]),
      todas.length ? filtros : null,
      avisoEstudos(lista),
      // Agrupadas por tipo (área); dentro de cada uma, diárias, semanais e depois mensais.
      lista.length ? el('div', { class: 'habitos-colunas' }, Dados.AREAS_HABITO.map(function (a) {
        var doTipo = lista.filter(function (h) { return h.area === a[0]; });
        if (!doTipo.length) return null;
        return el('div', { class: 'habitos-grupo' }, [
          el('div', { class: 'habitos-grupo-titulo titulo-tipo' }, [UI.simboloMeta(a[0]), a[1], el('span', { class: 'secao-contagem', text: doTipo.length })]),
          el('div', { class: 'lista-habitos' }, doTipo.map(function (h) {
            if (Dados.habitoValeNoDia(h, hoje)) return linha(h, hoje);
            return el('div', { class: 'habito inativo' }, [
              el('span', { class: 'btn-check desligado', title: 'Não vale hoje' }),
              UI.simboloMeta(h.area),
              el('button', { type: 'button', class: 'habito-corpo', title: 'Editar', onclick: function () { editar(h.id); } }, [
                el('span', { class: 'habito-titulo', text: h.titulo }), el('span', { class: 'habito-meta', text: nomeArea(h.area) + ' · ' + descricao(h) + ' · não vale hoje' })
              ])
            ]);
          }))
        ]);
      })) : el('p', { class: 'modal-desc', text: todas.length ? 'Nenhuma meta nesta área.' : 'Exemplos: estudar 4 h de segunda a sexta e 5 h no fim de semana, treinar todo dia, 5 treinos na semana, dia 100% na dieta, tomar banho em menos de 15 minutos.' })
    ]);
  }

  return { editar: editar, linha: linha, doDia: doDia, painelHoje: painelHoje, painelGerenciar: painelGerenciar };
})();
