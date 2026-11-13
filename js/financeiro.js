// Página "Financeiro": calendário do mês com entradas, gastos e lembretes, e o resumo por categoria.
var Financeiro = (function () {
  var el = UI.el;
  var mes = UI.hoje().slice(0, 7); // mês mostrado ('AAAA-MM'); continua o mesmo ao trocar de página

  var DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  function irPara(m) { mes = m; App.atualizar(); }

  // ---------- Formulário de lançamento ----------
  // base: lançamento existente, conta fixa em aberto (virtual) ou { data, tipo, missaoId } para um novo.
  function lancar(base) {
    base = base || {};
    var existente = base.id ? Dados.lancamento(base.id) : null;
    var origem = existente || base;
    var tipoAtual = origem.itemId ? Dados.tipoDoItem(origem.itemId) : (base.tipo || 'gasto');

    var btnGasto = el('button', { type: 'button', text: 'Gasto', onclick: function () { trocarTipo('gasto'); } });
    var btnEntrada = el('button', { type: 'button', text: 'Entrada', onclick: function () { trocarTipo('entrada'); } });
    var seletorItem = el('select', { required: true });
    var valor = el('input', { type: 'text', inputMode: 'decimal', placeholder: '0,00', value: UI.campoValor(origem.valor), autocomplete: 'off' });
    var data = el('input', { type: 'date', value: origem.data || UI.hoje(), required: true });
    var descricao = el('input', { type: 'text', value: origem.descricao || '', placeholder: 'Opcional', maxLength: 140 });
    var seletorMissao = el('select');
    var previsto = el('input', { type: 'checkbox', checked: existente ? existente.status === 'previsto' : false });
    var rotuloPrevisto = el('span');
    var ajudaItem = el('span', { class: 'campo-ajuda' });

    function preencherItens(selecionado) {
      seletorItem.innerHTML = '';
      Dados.categorias(tipoAtual).forEach(function (c) {
        var itens = Dados.itensDa(c.id, true).filter(function (i) { return !i.arquivado || i.id === selecionado; });
        if (!itens.length) return;
        seletorItem.appendChild(el('optgroup', { label: c.nome }, itens.map(function (i) { return el('option', { value: i.id, text: i.nome, selected: i.id === selecionado }); })));
      });
    }
    function preencherMissoes(selecionada) {
      seletorMissao.innerHTML = '';
      seletorMissao.appendChild(el('option', { value: '', text: 'Nenhuma' }));
      Dados.missoes().forEach(function (m) { seletorMissao.appendChild(el('option', { value: m.id, text: m.nome + (m.inicio ? ' (' + UI.fmtDiaMes(m.inicio) + ')' : ''), selected: m.id === selecionada })); });
      seletorMissao.appendChild(el('option', { value: '+nova', text: '+ Nova missão…' }));
    }
    function trocarTipo(t) {
      tipoAtual = t;
      btnGasto.classList.toggle('ativo', t === 'gasto');
      btnEntrada.classList.toggle('ativo', t === 'entrada');
      preencherItens(origem.itemId);
      rotuloPrevisto.textContent = t === 'gasto' ? 'Ainda não paguei (previsto)' : 'Ainda não recebi (previsto)';
      ajustarAjuda();
    }
    function ajustarAjuda() {
      var i = Dados.item(seletorItem.value), c = i && Dados.categoria(i.categoriaId);
      ajudaItem.textContent = i && i.papel === 'diaria' ? 'Escolha a missão abaixo para comparar a diária com os gastos da viagem.'
        : i && i.papel === 'auxilio-saude' ? 'Entra na comparação com os gastos de saúde.'
        : c && c.papel === 'saude' ? 'Entra na comparação com o Auxílio Saúde.' : '';
    }
    seletorItem.addEventListener('change', ajustarAjuda);
    seletorMissao.addEventListener('change', function () {
      if (seletorMissao.value !== '+nova') return;
      seletorMissao.value = '';
      Comparativos.editarMissao(null, function (m) { preencherMissoes(m.id); });
    });
    trocarTipo(tipoAtual);
    preencherMissoes(origem.missaoId);

    var ehFixo = !!origem.mesFixo;
    var botoes = [{ texto: 'Cancelar', classe: 'btn-secundario' }, { texto: existente ? 'Salvar' : (base.virtual ? 'Confirmar' : 'Lançar'), classe: 'btn-primario', acao: function () {
      var v = UI.lerValor(valor.value);
      if (!seletorItem.value) { UI.aviso('Escolha o item.'); return false; }
      if (!(v > 0)) { UI.aviso('Informe o valor.'); valor.focus(); return false; }
      if (!data.value) { data.focus(); return false; }
      Dados.salvarLancamento({ data: data.value, itemId: seletorItem.value, valor: v, descricao: descricao.value, status: previsto.checked ? 'previsto' : 'realizado',
        missaoId: seletorMissao.value && seletorMissao.value !== '+nova' ? seletorMissao.value : null, mesFixo: origem.mesFixo || null }, existente ? existente.id : null);
      mes = data.value.slice(0, 7);
      App.atualizar();
    } }];
    if (existente) botoes.unshift({ texto: 'Excluir', classe: 'btn-perigo btn-esquerda', acao: function () {
      UI.confirmar('Excluir este lançamento de ' + UI.fmtMoeda(existente.valor) + ' (' + Dados.nomeDoItem(existente.itemId) + ')?' + (existente.mesFixo ? ' A conta fixa volta a aparecer como prevista neste mês.' : ''), function () { Dados.excluirLancamento(existente.id); App.atualizar(); });
    } });
    if (base.virtual) botoes.unshift({ texto: 'Não vale este mês', classe: 'btn-secundario btn-esquerda', acao: function () {
      Dados.salvarLancamento({ data: base.data, itemId: base.itemId, valor: 0, status: 'realizado', mesFixo: base.mesFixo, pulado: true });
      UI.aviso('Conta dispensada em ' + UI.nomeMes(base.mesFixo).toLowerCase());
      App.atualizar();
    } });

    UI.modal(existente ? 'Editar lançamento' : base.virtual ? 'Confirmar conta fixa' : 'Novo lançamento', [
      ehFixo ? null : el('div', { class: 'segmentado' }, [btnGasto, btnEntrada]),
      UI.campo('Item', seletorItem),
      ajudaItem,
      el('div', { class: 'campos-linha' }, [UI.campo('Valor (R$)', valor), UI.campo('Data', data)]),
      UI.campo('Descrição', descricao),
      UI.campo('Missão', seletorMissao, 'Use quando o gasto ou a diária for de uma viagem a serviço.'),
      el('label', { class: 'campo-check' }, [previsto, rotuloPrevisto])
    ], botoes, { icone: 'carteira', subtitulo: base.virtual ? 'Ajuste o valor e a data, se forem diferentes do previsto.' : ehFixo ? 'Conta fixa de ' + UI.nomeMes(origem.mesFixo).toLowerCase() : 'Entradas e gastos do dia a dia.' });
    if (!origem.valor) valor.focus();
  }

  // ---------- Linha de lançamento (lista do mês e detalhe do dia) ----------
  function linhaLancamento(l, comData) {
    var entrada = Dados.tipoDoItem(l.itemId) === 'entrada', previsto = l.status === 'previsto';
    var m = l.missaoId ? Dados.missao(l.missaoId) : null, c = Dados.categoriaDoItem(l.itemId);
    return el('div', { class: 'lanc' + (previsto ? ' previsto' : '') }, [
      comData ? el('span', { class: 'lanc-data', text: UI.fmtDiaMes(l.data) }) : null,
      el('span', { class: 'lanc-cor', style: { background: Dados.corDoItem(l.itemId) } }),
      el('button', { type: 'button', class: 'lanc-corpo', title: l.virtual ? 'Confirmar pagamento' : 'Editar', onclick: function () { lancar(l); } }, [
        el('span', { class: 'lanc-nome', text: Dados.nomeDoItem(l.itemId) }),
        el('span', { class: 'lanc-meta' }, [
          c ? c.nome : '', l.descricao ? ' · ' + l.descricao : '',
          m ? el('span', { class: 'lanc-missao', text: m.nome }) : null,
          previsto ? el('span', { class: 'lanc-previsto', text: l.virtual ? 'Conta fixa' : 'Previsto' }) : null
        ])
      ]),
      el('span', { class: 'lanc-valor ' + (entrada ? 'positivo' : 'negativo'), text: (entrada ? '+' : '−') + UI.fmtMoeda(l.valor) }),
      previsto ? UI.botao(entrada ? 'Recebi' : 'Paguei', function () {
        if (l.virtual) { lancar(l); return; }
        Dados.salvarLancamento({ data: l.data, itemId: l.itemId, valor: l.valor, descricao: l.descricao, status: 'realizado', missaoId: l.missaoId }, l.id);
        App.atualizar();
      }, 'btn-secundario btn-mini') : null
    ]);
  }

  // ---------- Detalhe do dia ----------
  function abrirDia(iso, lancs, lembretes) {
    var entradas = 0, gastos = 0;
    lancs.forEach(function (l) { if (Dados.tipoDoItem(l.itemId) === 'entrada') entradas += l.valor; else gastos += l.valor; });
    // Clicar numa linha (editar, concluir, pagar) fecha este detalhe: a ação abre o próprio formulário ou redesenha a tela.
    var d = new Date(iso + 'T00:00:00');
    var m = UI.modal(DIAS[(d.getDay() + 6) % 7] + ', ' + UI.fmtData(iso), [
      lancs.length ? el('div', { class: 'dia-totais' }, [
        el('span', { class: 'positivo', text: '+' + UI.fmtMoeda(entradas) }), el('span', { class: 'negativo', text: '−' + UI.fmtMoeda(gastos) })
      ]) : null,
      lancs.length ? el('div', { class: 'lista-lanc', onclick: function (e) { if (e.target.closest('button')) m.fechar(); } }, lancs.map(function (l) { return linhaLancamento(l); }))
        : el('p', { class: 'modal-desc', text: 'Nenhum lançamento neste dia.' }),
      lembretes.length ? el('div', { class: 'secao-titulo dia-secao', text: 'Lembretes' }) : null,
      lembretes.length ? el('div', { class: 'lista-lembretes', onclick: function (e) { if (e.target.closest('button')) m.fechar(); } }, lembretes.map(function (l) { return Lembretes.linha(l, true); })) : null
    ], [
      { texto: 'Novo lembrete', classe: 'btn-secundario btn-esquerda', acao: function () { setTimeout(function () { Lembretes.editar(null, { data: iso }); }, 0); } },
      { texto: 'Lançar neste dia', classe: 'btn-primario', acao: function () { setTimeout(function () { lancar({ data: iso }); }, 0); } }
    ], { icone: 'calendario' });
  }

  // ---------- Calendário ----------
  function calendario(lancs) {
    var hoje = UI.hoje(), porDia = {};
    lancs.forEach(function (l) { (porDia[l.data] || (porDia[l.data] = [])).push(l); });
    var primeiro = new Date(mes + '-01T00:00:00'), deslocamento = (primeiro.getDay() + 6) % 7, total = Dados.diasNoMes(mes);
    var celulas = DIAS.map(function (d) { return el('div', { class: 'cal-cabecalho', text: d }); });
    for (var i = 0; i < deslocamento; i++) celulas.push(el('div', { class: 'cal-dia fora' }));
    for (var dia = 1; dia <= total; dia++) (function (iso, numero) {
      var doDia = porDia[iso] || [], lembretes = Dados.lembretesDoDia(iso);
      var entradas = 0, gastos = 0;
      doDia.forEach(function (l) { if (Dados.tipoDoItem(l.itemId) === 'entrada') entradas += l.valor; else gastos += l.valor; });
      var pendentes = lembretes.filter(function (l) { return !l.concluido; });
      celulas.push(el('button', { type: 'button', class: 'cal-dia' + (iso === hoje ? ' hoje' : '') + (doDia.length || lembretes.length ? ' com-itens' : ''),
        'aria-label': UI.fmtData(iso), onclick: function () { abrirDia(iso, doDia, lembretes); } }, [
        el('span', { class: 'cal-topo' }, [
          el('span', { class: 'cal-numero', text: numero }),
          lembretes.length ? el('span', { class: 'cal-lembretes', title: lembretes.map(function (l) { return l.titulo; }).join('\n') },
            (pendentes.length ? pendentes : lembretes).slice(0, 4).map(function (l) { return el('span', { class: 'cal-ponto relev-' + l.relevancia + (l.concluido ? ' concluido' : '') }); })) : null
        ]),
        entradas ? el('span', { class: 'cal-total positivo', text: '+' + UI.fmtCurto(entradas) }) : null,
        gastos ? el('span', { class: 'cal-total negativo', text: '−' + UI.fmtCurto(gastos) }) : null,
        el('span', { class: 'cal-itens' }, doDia.slice(0, 2).map(function (l) {
          return el('span', { class: 'cal-item' + (l.status === 'previsto' ? ' previsto' : ''), style: { borderLeftColor: Dados.corDoItem(l.itemId) }, text: Dados.nomeDoItem(l.itemId) });
        }).concat(doDia.length > 2 ? [el('span', { class: 'cal-mais', text: '+' + (doDia.length - 2) + ' mais' })] : [])),
        pendentes.length ? el('span', { class: 'cal-lembrete-texto relev-' + pendentes[0].relevancia, text: (pendentes[0].hora ? pendentes[0].hora + ' ' : '') + pendentes[0].titulo }) : null
      ]));
    })(mes + '-' + UI.pad(dia), dia);
    while ((celulas.length - 7) % 7) celulas.push(el('div', { class: 'cal-dia fora' }));
    return el('div', { class: 'calendario' }, celulas);
  }

  // ---------- Painéis laterais ----------
  function painelCategorias(resumo, tipo, titulo) {
    var linhas = Dados.categorias(tipo).map(function (c) { return { c: c, r: resumo.categorias[c.id] }; }).filter(function (x) { return x.r && (x.r.realizado || x.r.previsto); });
    var maior = linhas.reduce(function (m, x) { return Math.max(m, x.r.realizado + x.r.previsto); }, 0);
    linhas.sort(function (a, b) { return (b.r.realizado + b.r.previsto) - (a.r.realizado + a.r.previsto); });
    return el('section', { class: 'painel painel-lado' }, [
      el('h2', { class: 'secao-titulo', text: titulo }),
      linhas.length ? linhas.map(function (x) {
        var itens = Dados.itensDa(x.c.id, true).filter(function (i) { return resumo.itens[i.id]; });
        return el('details', { class: 'cat' }, [
          el('summary', null, [
            el('span', { class: 'cat-linha' }, [
              el('span', { class: 'lanc-cor', style: { background: x.c.cor } }),
              el('span', { class: 'cat-nome', text: x.c.nome }),
              el('span', { class: 'cat-valor', text: UI.fmtMoeda(x.r.realizado) })
            ]),
            UI.barra(maior ? x.r.realizado / maior * 100 : 0, x.c.cor),
            x.r.previsto ? el('span', { class: 'cat-previsto', text: '+ ' + UI.fmtMoeda(x.r.previsto) + ' previsto' }) : null
          ]),
          el('div', { class: 'cat-itens' }, itens.map(function (i) {
            var ri = resumo.itens[i.id];
            return el('div', { class: 'cat-item' }, [el('span', { text: i.nome }), el('span', { text: UI.fmtMoeda(ri.realizado) + (ri.previsto ? ' (+' + UI.fmtMoeda(ri.previsto) + ')' : '') })]);
          }))
        ]);
      }) : el('p', { class: 'modal-desc', text: tipo === 'gasto' ? 'Nenhum gasto neste mês.' : 'Nenhuma entrada neste mês.' })
    ]);
  }

  // Comparação de uma linha: "recebido − gasto = saldo".
  function comparacao(rotulo, mais, menos, saldo, rotuloMais, rotuloMenos) {
    return el('div', { class: 'comparacao' }, [
      el('div', { class: 'comparacao-topo' }, [el('span', { class: 'comparacao-nome', text: rotulo }), el('span', { class: 'comparacao-saldo ' + (saldo >= 0 ? 'positivo' : 'negativo'), text: UI.fmtMoeda(saldo, true) })]),
      el('div', { class: 'comparacao-detalhe' }, [
        el('span', null, [rotuloMais + ' ', el('strong', { class: 'positivo', text: UI.fmtMoeda(mais) })]),
        el('span', null, [rotuloMenos + ' ', el('strong', { class: 'negativo', text: UI.fmtMoeda(menos) })])
      ])
    ]);
  }

  function painelComparativos() {
    var doMes = function (l) { return l.data && l.data.slice(0, 7) === mes; };
    var missoes = Dados.missoes().map(function (m) { return { m: m, s: Dados.saldoDaMissao(m.id, doMes) }; }).filter(function (x) { return x.s.lancamentos.length; });
    var saude = Dados.saldoSaude(mes);
    return el('section', { class: 'painel painel-lado' }, [
      el('div', { class: 'painel-lado-topo' }, [el('h2', { class: 'secao-titulo', text: 'Diárias e Saúde no mês' }), el('a', { class: 'link', href: '#/comparativos', text: 'Ver tudo' })]),
      missoes.length ? missoes.map(function (x) { return comparacao(x.m.nome, x.s.recebido, x.s.gasto, x.s.saldo, 'Diárias', 'Gastos'); })
        : el('p', { class: 'modal-desc', text: 'Nenhuma missão com lançamentos neste mês.' }),
      el('div', { class: 'comparacao-divisor' }),
      comparacao('Saúde', saude.reembolso, saude.gasto, saude.saldo, 'Auxílio', 'Gastos')
    ]);
  }

  function painelLembretes() {
    var ativos = Dados.lembretesAtivos();
    return el('section', { class: 'painel painel-lado' }, [
      el('div', { class: 'painel-lado-topo' }, [el('h2', { class: 'secao-titulo', text: 'Pendências' }), el('a', { class: 'link', href: '#/lembretes', text: ativos.length > 5 ? 'Ver todas (' + ativos.length + ')' : 'Ver todas' })]),
      ativos.length ? el('div', { class: 'lista-lembretes' }, ativos.slice(0, 5).map(function (l) { return Lembretes.linha(l, true); }))
        : el('p', { class: 'modal-desc', text: 'Nada pendente para agora.' }),
      UI.botao('Novo lembrete', function () { Lembretes.editar(); }, 'btn-secundario btn-bloco', 'mais')
    ]);
  }

  function cartaoValor(icone, rotulo, valor, classe, detalhe) {
    return el('div', { class: 'cartao' }, [
      el('div', { class: 'cartao-icone ' + (classe || '') }, UI.icone(icone)),
      el('div', null, [
        el('div', { class: 'cartao-rotulo', text: rotulo }),
        el('div', { class: 'cartao-valor ' + (classe || ''), text: valor }),
        detalhe ? el('div', { class: 'cartao-detalhe', text: detalhe }) : null
      ])
    ]);
  }

  function render(raiz) {
    var lancs = Dados.lancamentosDoMes(mes), r = Dados.resumoDoMes(mes), mesDeHoje = UI.hoje().slice(0, 7);
    var temPrevisto = r.entradasPrevistas || r.gastosPrevistos;

    raiz.appendChild(el('div', { class: 'pagina-topo' }, [
      el('div', { class: 'seletor-mes' }, [
        el('button', { type: 'button', class: 'btn-icone btn-mes', title: 'Mês anterior', onclick: function () { irPara(UI.somarMeses(mes, -1)); } }, UI.icone('anterior')),
        el('h1', { class: 'pagina-titulo', text: UI.nomeMes(mes) }),
        el('button', { type: 'button', class: 'btn-icone btn-mes', title: 'Próximo mês', onclick: function () { irPara(UI.somarMeses(mes, 1)); } }, UI.icone('proximo')),
        mes !== mesDeHoje ? UI.botao('Hoje', function () { irPara(mesDeHoje); }, 'btn-secundario btn-mini') : null
      ]),
      el('div', { class: 'pagina-acoes' }, [
        UI.botao('Entrada', function () { lancar({ tipo: 'entrada', data: mes === mesDeHoje ? UI.hoje() : mes + '-01' }); }, 'btn-secundario', 'mais'),
        UI.botao('Lançar gasto', function () { lancar({ tipo: 'gasto', data: mes === mesDeHoje ? UI.hoje() : mes + '-01' }); }, 'btn-primario', 'mais')
      ])
    ]));

    raiz.appendChild(el('div', { class: 'cartoes cartoes-fin' }, [
      cartaoValor('progresso', 'Entradas', UI.fmtMoeda(r.entradas), 'positivo', r.entradasPrevistas ? '+ ' + UI.fmtMoeda(r.entradasPrevistas) + ' a receber' : null),
      cartaoValor('carteira', 'Gastos', UI.fmtMoeda(r.gastos), 'negativo', r.gastosPrevistos ? '+ ' + UI.fmtMoeda(r.gastosPrevistos) + ' a pagar' : null),
      cartaoValor('grafico', 'Saldo do mês', UI.fmtMoeda(r.saldo, true), r.saldo >= 0 ? 'positivo' : 'negativo', 'Recebido − pago até agora'),
      cartaoValor('calendario', 'Saldo previsto', UI.fmtMoeda(r.saldoPrevisto, true), r.saldoPrevisto >= 0 ? 'positivo' : 'negativo', temPrevisto ? 'Com o que falta pagar e receber' : 'Sem contas em aberto')
    ]));

    raiz.appendChild(el('div', { class: 'fin-grade' }, [
      el('div', { class: 'fin-principal' }, [
        el('section', { class: 'painel painel-calendario' }, calendario(lancs)),
        el('section', { class: 'painel' }, [
          el('h2', { class: 'secao-titulo' }, ['Lançamentos do mês', el('span', { class: 'secao-contagem', text: lancs.length })]),
          lancs.length ? el('div', { class: 'lista-lanc' }, lancs.map(function (l) { return linhaLancamento(l, true); }))
            : el('p', { class: 'modal-desc', text: 'Nada lançado em ' + UI.nomeMes(mes).toLowerCase() + '. Use "Lançar gasto" ou clique num dia do calendário. Contas que se repetem (aluguel, salário…) podem ser marcadas como fixas em Configurações.' })
        ])
      ]),
      el('div', { class: 'fin-lado' }, [painelLembretes(), painelCategorias(r, 'gasto', 'Gastos por categoria'), painelCategorias(r, 'entrada', 'Entradas'), painelComparativos()])
    ]));
  }

  return { render: render, lancar: lancar, linhaLancamento: linhaLancamento, comparacao: comparacao };
})();
