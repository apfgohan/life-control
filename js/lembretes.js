// Página "Lembretes": coisas a fazer num dia, dentro de um prazo ou sem prazo, com grau de relevância.
var Lembretes = (function () {
  var el = UI.el;
  var mostrarConcluidos = false;

  var TIPOS = [['dia', 'Dia específico'], ['prazo', 'Durante um prazo'], ['aberto', 'Sem prazo (até concluir)']];
  var RELEVANCIAS = [['alta', 'Alta'], ['media', 'Média'], ['baixa', 'Baixa']];

  // Texto de quando: "20/11 às 13:00", "até 30/11", "sem prazo".
  function quando(l) {
    if (l.tipo === 'dia') return UI.fmtData(l.data) + (l.hora ? ' às ' + l.hora : '');
    if (l.tipo === 'prazo') return 'de ' + UI.fmtDiaMes(l.inicio) + ' até ' + UI.fmtData(l.fim);
    return 'Sem prazo';
  }
  function detalheDoPrazo(l) {
    var s = Dados.situacaoLembrete(l), limite = Dados.dataLimite(l);
    if (s === 'concluido') return 'Concluído em ' + UI.fmtData(l.dataConclusao);
    if (!limite) return null;
    var d = UI.diasEntre(UI.hoje(), limite);
    if (d < 0) return d === -1 ? 'Atrasado há 1 dia' : 'Atrasado há ' + (-d) + ' dias';
    if (d === 0) return 'Hoje';
    if (d === 1) return 'Amanhã';
    return 'Faltam ' + d + ' dias';
  }

  // ---------- Formulário ----------
  // padrao (opcional): { data } para já abrir num dia do calendário.
  function editar(id, padrao) {
    var l = id ? Dados.lembrete(id) : null, hoje = UI.hoje();
    padrao = padrao || {};
    var titulo = el('input', { type: 'text', value: l ? l.titulo : '', placeholder: 'Ex.: Consulta com o cardiologista', required: true, maxLength: 120 });
    var detalhe = el('textarea', { rows: 3, value: l ? l.detalhe : '', placeholder: 'Detalhes (opcional)' });
    var tipo = el('select', null, TIPOS.map(function (t) { return el('option', { value: t[0], text: t[1], selected: (l ? l.tipo : (padrao.data ? 'dia' : 'aberto')) === t[0] }); }));
    var relev = el('select', null, RELEVANCIAS.map(function (r) { return el('option', { value: r[0], text: r[1], selected: (l ? l.relevancia : 'media') === r[0] }); }));
    var data = el('input', { type: 'date', value: (l && l.data) || padrao.data || hoje });
    var hora = el('input', { type: 'time', value: (l && l.hora) || '' });
    var inicio = el('input', { type: 'date', value: (l && l.inicio) || hoje });
    var fim = el('input', { type: 'date', value: (l && l.fim) || UI.somarDias(hoje, 7) });
    var linhaDia = el('div', { class: 'campos-linha' }, [UI.campo('Dia', data), UI.campo('Hora (opcional)', hora)]);
    var linhaPrazo = el('div', { class: 'campos-linha' }, [UI.campo('Mostrar a partir de', inicio), UI.campo('Prazo final', fim)]);
    function ajustar() {
      linhaDia.hidden = tipo.value !== 'dia';
      linhaPrazo.hidden = tipo.value !== 'prazo';
    }
    tipo.addEventListener('change', ajustar);
    ajustar();

    var botoes = [{ texto: 'Cancelar', classe: 'btn-secundario' }, { texto: 'Salvar', classe: 'btn-primario', acao: function () {
      if (!titulo.value.trim()) { titulo.focus(); return false; }
      Dados.salvarLembrete({ titulo: titulo.value, detalhe: detalhe.value, tipo: tipo.value, relevancia: relev.value, data: data.value, hora: hora.value, inicio: inicio.value, fim: fim.value }, id);
      App.atualizar();
    } }];
    if (l) botoes.unshift({ texto: 'Excluir', classe: 'btn-perigo btn-esquerda', acao: function () {
      UI.confirmar('Excluir o lembrete "' + l.titulo + '"?', function () { Dados.excluirLembrete(l.id); App.atualizar(); });
    } });
    UI.modal(l ? 'Editar lembrete' : 'Novo lembrete', [
      UI.campo('O que fazer', titulo),
      el('div', { class: 'campos-linha' }, [UI.campo('Quando', tipo), UI.campo('Relevância', relev)]),
      linhaDia, linhaPrazo,
      UI.campo('Anotações', detalhe)
    ], botoes, { icone: 'sino', subtitulo: 'Fica visível até você marcar como concluído.' });
  }

  function alternar(l) {
    var feito = !l.concluido;
    Dados.concluirLembrete(l.id, feito);
    if (feito) UI.aviso('Concluído · +' + Patentes.xpDoLembrete(l) + ' XP');
    App.atualizar();
  }

  // Linha de lembrete (usada aqui, no calendário e no painel do Financeiro). compacto: sem anotações.
  function linha(l, compacto) {
    var s = Dados.situacaoLembrete(l), prazo = detalheDoPrazo(l);
    return el('div', { class: 'lembrete relev-' + l.relevancia + (l.concluido ? ' concluido' : '') + (s === 'atrasado' ? ' atrasado' : '') }, [
      el('button', { type: 'button', class: 'btn-check' + (l.concluido ? ' marcado' : ''), title: l.concluido ? 'Reabrir' : 'Marcar como concluído', onclick: function () { alternar(l); } }, UI.icone('check')),
      el('button', { type: 'button', class: 'lembrete-corpo', title: 'Editar', onclick: function () { editar(l.id); } }, [
        el('span', { class: 'lembrete-titulo', text: l.titulo }),
        el('span', { class: 'lembrete-meta' }, [
          el('span', { text: quando(l) }),
          prazo && !l.concluido && l.tipo !== 'aberto' ? el('span', { class: 'lembrete-prazo', text: prazo }) : null,
          l.concluido ? el('span', { text: prazo }) : null
        ]),
        !compacto && l.detalhe ? el('span', { class: 'lembrete-detalhe', text: l.detalhe }) : null
      ]),
      UI.seloPrioridade(l.relevancia)
    ]);
  }

  function grupo(titulo, lista, classe) {
    if (!lista.length) return null;
    return el('section', { class: 'painel' }, [
      el('h2', { class: 'secao-titulo ' + (classe || '') }, [titulo, el('span', { class: 'secao-contagem', text: lista.length })]),
      el('div', { class: 'lista-lembretes' }, lista.map(function (l) { return linha(l); }))
    ]);
  }

  function render(raiz) {
    var hoje = UI.hoje(), g = { atrasado: [], hoje: [], ativo: [], futuro: [], concluido: [] };
    Dados.db.lembretes.forEach(function (l) { g[Dados.situacaoLembrete(l, hoje)].push(l); });
    ['atrasado', 'hoje', 'ativo'].forEach(function (k) { g[k].sort(Dados.ordemLembrete); });
    g.futuro.sort(function (a, b) { var x = a.tipo === 'prazo' ? a.inicio : a.data, y = b.tipo === 'prazo' ? b.inicio : b.data; return x < y ? -1 : x > y ? 1 : Dados.ordemLembrete(a, b); });
    g.concluido.sort(function (a, b) { return (b.dataConclusao || '') < (a.dataConclusao || '') ? -1 : 1; });
    var pendentes = g.atrasado.length + g.hoje.length + g.ativo.length + g.futuro.length;

    raiz.appendChild(el('div', { class: 'pagina-topo' }, [
      el('div', null, [
        el('h1', { class: 'pagina-titulo', text: 'Lembretes' }),
        el('div', { class: 'pagina-subtitulo', text: pendentes ? pendentes + (pendentes === 1 ? ' pendente' : ' pendentes') + (g.atrasado.length ? ' · ' + g.atrasado.length + (g.atrasado.length === 1 ? ' atrasado' : ' atrasados') : '') : 'Nada pendente.' })
      ]),
      el('div', { class: 'pagina-acoes' }, UI.botao('Novo lembrete', function () { editar(); }, 'btn-primario', 'mais'))
    ]));

    if (!Dados.db.lembretes.length) {
      raiz.appendChild(el('div', { class: 'vazio' }, [
        el('p', { class: 'vazio-destaque', text: 'Nenhum lembrete ainda' }),
        el('p', { text: 'Anote consultas, relatórios a entregar, coisas da casa… Cada um com a relevância e o prazo que fizer sentido.' }),
        el('div', { class: 'vazio-acoes' }, UI.botao('Criar o primeiro lembrete', function () { editar(); }, 'btn-primario'))
      ]));
      return;
    }
    [grupo('Atrasados', g.atrasado, 'titulo-perigo'), grupo('Hoje', g.hoje), grupo('Em aberto', g.ativo), grupo('Próximos', g.futuro)].forEach(function (n) { if (n) raiz.appendChild(n); });

    if (g.concluido.length) {
      raiz.appendChild(el('button', { type: 'button', class: 'link link-concluidos', onclick: function () { mostrarConcluidos = !mostrarConcluidos; App.atualizar(); },
        text: (mostrarConcluidos ? 'Ocultar' : 'Mostrar') + ' concluídos (' + g.concluido.length + ')' }));
      if (mostrarConcluidos) raiz.appendChild(grupo('Concluídos', g.concluido));
    }
  }

  return { render: render, editar: editar, linha: linha, quando: quando };
})();
