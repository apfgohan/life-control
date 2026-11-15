// Metas recorrentes: diárias (em dias da semana escolhidos), semanais e mensais (fazer N vezes no período).
// Aparecem na Página Inicial (abaixo do calendário), no detalhe de cada dia e na página Metas.
var Habitos = (function () {
  var el = UI.el;
  var DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  function textoDias(h) {
    var d = h.dias.slice().sort(), chave = d.join('');
    if (d.length === 7) return 'Todos os dias';
    if (chave === '01234') return 'Segunda a sexta';
    if (chave === '56') return 'Sábado e domingo';
    return d.map(function (i) { return DIAS[i]; }).join(', ');
  }
  function descricao(h) {
    if (h.periodo === 'dia') return textoDias(h);
    return h.vezes + (h.vezes === 1 ? ' vez' : ' vezes') + (h.periodo === 'semana' ? ' por semana' : ' por mês');
  }

  // ---------- Formulário ----------
  function editar(id, periodoPadrao) {
    var h = id ? Dados.habito(id) : null;
    var titulo = el('input', { type: 'text', value: h ? h.titulo : '', placeholder: 'Ex.: Estudar 4 horas', maxLength: 100 });
    var periodo = el('select', null, Dados.PERIODOS.map(function (p) { return el('option', { value: p[0], text: p[1], selected: (h ? h.periodo : (periodoPadrao || 'dia')) === p[0] }); }));
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
    var vezes = el('input', { type: 'number', min: 1, max: 31, value: h && h.periodo !== 'dia' ? h.vezes : 4 });
    var ligadaTreino = el('input', { type: 'checkbox', checked: !!(h && h.treino) });
    var rotuloVezes = el('span', { class: 'campo-rotulo' });
    var campoVezes = el('label', { class: 'campo' }, [rotuloVezes, vezes]);
    function ajustar() {
      campoDias.hidden = periodo.value !== 'dia';
      campoVezes.hidden = periodo.value === 'dia';
      rotuloVezes.textContent = periodo.value === 'semana' ? 'Quantas vezes por semana' : 'Quantas vezes por mês';
    }
    periodo.addEventListener('change', ajustar);
    ajustar();

    var botoes = [{ texto: 'Cancelar', classe: 'btn-secundario' }, { texto: 'Salvar', classe: 'btn-primario', acao: function () {
      if (!titulo.value.trim()) { titulo.focus(); return false; }
      if (periodo.value === 'dia' && !marcados.length) { UI.aviso('Escolha pelo menos um dia da semana.'); return false; }
      Dados.salvarHabito({ titulo: titulo.value, periodo: periodo.value, dias: marcados, vezes: Number(vezes.value), treino: ligadaTreino.checked }, id);
      App.atualizar();
    } }];
    if (h) botoes.unshift({ texto: 'Excluir', classe: 'btn-perigo btn-esquerda', acao: function () {
      UI.confirmar('Excluir a meta "' + h.titulo + '"? O histórico dela e o XP que ela rendeu também saem.', function () { Dados.excluirHabito(h.id); App.atualizar(); });
    } });
    UI.modal(h ? 'Editar meta recorrente' : 'Nova meta recorrente', [
      UI.campo('Meta', titulo, 'Para horários diferentes na semana e no fim de semana, crie duas metas (ex.: "Estudar 4 horas" de seg a sex e "Estudar 5 horas" sáb e dom).'),
      UI.campo('Frequência', periodo),
      campoDias, campoVezes,
      el('label', { class: 'campo-check' }, [ligadaTreino, el('span', { text: 'Marcar sozinha quando eu finalizar um treino' })])
    ], botoes, { icone: 'alvo', subtitulo: 'Cumprir rende XP: ' + Dados.XP_HABITO.dia + ' por dia, ' + Dados.XP_HABITO.semana + ' por semana batida, ' + Dados.XP_HABITO.mes + ' por mês batido.' });
  }

  // ---------- Linha de uma meta num dia (marcar / desmarcar) ----------
  function alternar(h, iso) {
    var feito = !h.feitos[iso];
    var antes = Dados.progressoHabito(h, iso).completo;
    Dados.marcarHabito(h.id, iso, feito);
    if (feito) {
      var bateu = !antes && Dados.progressoHabito(h, iso).completo;
      UI.aviso(h.periodo === 'dia' ? 'Meta cumprida · +' + Dados.XP_HABITO.dia + ' XP' : bateu ? 'Meta ' + (h.periodo === 'semana' ? 'da semana' : 'do mês') + ' batida · +' + Dados.XP_HABITO[h.periodo] + ' XP' : 'Registrado');
    }
    App.atualizar();
  }

  function linha(h, iso) {
    var feito = !!h.feitos[iso], p = Dados.progressoHabito(h, iso), diaria = h.periodo === 'dia';
    var seq = diaria ? Dados.sequenciaHabito(h) : 0;
    return el('div', { class: 'habito' + (feito ? ' feito' : '') + (!diaria && p.completo ? ' completo' : '') }, [
      el('button', { type: 'button', class: 'btn-check' + (feito ? ' marcado' : ''), title: feito ? 'Desmarcar' : (diaria ? 'Marcar como cumprida' : 'Registrar que fiz neste dia'), onclick: function () { alternar(h, iso); } }, UI.icone('check')),
      el('button', { type: 'button', class: 'habito-corpo', title: 'Editar', onclick: function () { editar(h.id); } }, [
        el('span', { class: 'habito-titulo', text: h.titulo }),
        el('span', { class: 'habito-meta' }, [
          el('span', { text: descricao(h) }),
          diaria && seq > 1 ? el('span', { class: 'habito-sequencia', text: seq + ' dias seguidos' }) : null,
          h.treino ? el('span', { class: 'habito-auto', text: 'marca ao treinar' }) : null
        ]),
        diaria ? null : UI.barra(p.feitas / p.alvo * 100)
      ]),
      diaria ? null : el('span', { class: 'habito-contagem' + (p.completo ? ' positivo' : ''), text: p.feitas + '/' + p.alvo })
    ]);
  }

  // Metas que valem num dia, separadas por frequência.
  function doDia(iso) {
    var r = { dia: [], semana: [], mes: [] };
    Dados.habitos().forEach(function (h) { if (Dados.habitoValeNoDia(h, iso)) r[h.periodo].push(h); });
    return r;
  }

  function grupo(titulo, lista, iso) {
    if (!lista.length) return null;
    return el('div', { class: 'habitos-grupo' }, [
      el('div', { class: 'habitos-grupo-titulo', text: titulo }),
      el('div', { class: 'lista-habitos' }, lista.map(function (h) { return linha(h, iso); }))
    ]);
  }

  // Painel da Página Inicial: metas de hoje, da semana e do mês.
  function painelHoje() {
    var hoje = UI.hoje(), g = doDia(hoje), total = Dados.db.habitos.length;
    var feitasHoje = g.dia.filter(function (h) { return h.feitos[hoje]; }).length;
    return el('section', { class: 'painel painel-habitos' }, [
      el('div', { class: 'painel-lado-topo' }, [
        el('h2', { class: 'secao-titulo' }, ['Metas', g.dia.length ? el('span', { class: 'secao-contagem' + (feitasHoje === g.dia.length ? ' completa' : ''), text: feitasHoje + '/' + g.dia.length + ' hoje' }) : null]),
        el('div', { class: 'pagina-acoes' }, [
          el('a', { class: 'link', href: '#/metas', text: 'Ver todas' }),
          UI.botao('Nova meta', function () { editar(); }, 'btn-secundario btn-mini', 'mais')
        ])
      ]),
      total ? el('div', { class: 'habitos-colunas' }, [
        grupo('Hoje', g.dia, hoje) || el('div', { class: 'habitos-grupo' }, [el('div', { class: 'habitos-grupo-titulo', text: 'Hoje' }), el('p', { class: 'modal-desc', text: 'Nenhuma meta diária para hoje.' })]),
        grupo('Esta semana', g.semana, hoje),
        grupo('Este mês', g.mes, hoje)
      ]) : el('p', { class: 'modal-desc', text: 'Crie metas diárias (estudar 4 horas de segunda a sexta), semanais (academia 4 vezes na semana) ou mensais. Você marca aqui o que cumpriu e ganha XP.' })
    ]);
  }

  // Lista para a página Metas (todas, com a situação de hoje).
  function painelGerenciar() {
    var hoje = UI.hoje(), todas = Dados.habitos();
    return el('section', { class: 'painel painel-habitos' }, [
      el('div', { class: 'painel-lado-topo' }, [
        el('h2', { class: 'secao-titulo' }, ['Metas diárias, semanais e mensais', todas.length ? el('span', { class: 'secao-contagem', text: todas.length }) : null]),
        UI.botao('Nova meta recorrente', function () { editar(); }, 'btn-secundario btn-mini', 'mais')
      ]),
      todas.length ? el('div', { class: 'habitos-colunas' }, Dados.PERIODOS.map(function (p) {
        var lista = todas.filter(function (h) { return h.periodo === p[0]; });
        if (!lista.length) return null;
        return el('div', { class: 'habitos-grupo' }, [
          el('div', { class: 'habitos-grupo-titulo', text: p[1] + 's' }),
          el('div', { class: 'lista-habitos' }, lista.map(function (h) {
            // Meta diária que não vale hoje: só mostra (sem botão de marcar).
            return Dados.habitoValeNoDia(h, hoje) ? linha(h, hoje) : el('div', { class: 'habito inativo' }, [
              el('span', { class: 'btn-check desligado', title: 'Não vale hoje' }),
              el('button', { type: 'button', class: 'habito-corpo', title: 'Editar', onclick: function () { editar(h.id); } }, [
                el('span', { class: 'habito-titulo', text: h.titulo }), el('span', { class: 'habito-meta', text: descricao(h) + ' · não vale hoje' })
              ])
            ]);
          }))
        ]);
      })) : el('p', { class: 'modal-desc', text: 'Nenhuma ainda. Exemplos: "Estudar 4 horas" de segunda a sexta, "Tomar banho em menos de 15 minutos" todos os dias, "Ir à academia" 4 vezes por semana.' })
    ]);
  }

  return { editar: editar, linha: linha, doDia: doDia, painelHoje: painelHoje, painelGerenciar: painelGerenciar };
})();
