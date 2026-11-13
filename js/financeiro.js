// Página Inicial: avisos no topo, calendário do mês com entradas, gastos e lembretes, metas do dia e resumo por categoria.
var Financeiro = (function () {
  var el = UI.el;
  var mes = UI.hoje().slice(0, 7); // mês mostrado ('AAAA-MM'); continua o mesmo ao trocar de página
  var CHAVE_FORMA = 'life-control.ultima-forma';

  var DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  function irPara(m) { mes = m; App.atualizar(); }
  function ehEntrada(l) { return !l.fatura && Dados.tipoDoItem(l.itemId) === 'entrada'; }

  // Totais de uma lista de movimentos: as compras no cartão ficam à parte (o gasto entra pela fatura).
  function totais(lista) {
    var t = { entradas: 0, gastos: 0, cartao: 0 };
    lista.forEach(function (l) {
      if (ehEntrada(l)) t.entradas += l.valor;
      else if (!l.fatura && Dados.ehCompraCartao(l)) t.cartao += l.valor;
      else t.gastos += l.valor;
    });
    return t;
  }

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
    var linhaPrevisto = el('label', { class: 'campo-check' }, [previsto, rotuloPrevisto]);
    var ajudaItem = el('span', { class: 'campo-ajuda' });

    // Forma de pagamento (só gastos). No cartão: parcelas e vencimento da primeira fatura.
    var seletorForma = el('select');
    var campoForma = UI.campo('Forma de pagamento', seletorForma);
    var parcelas = el('input', { type: 'number', min: 1, max: 48, value: origem.parcelas || 1 });
    var primeira = el('input', { type: 'date', value: origem.primeiraFatura || '' });
    var linhaCartao = el('div', { class: 'campos-linha' }, [UI.campo('Parcelas', parcelas), UI.campo('Vencimento da 1ª fatura', primeira)]);
    var ajudaCartao = el('div', { class: 'aviso-cartao' });
    var vencimentoManual = !!origem.primeiraFatura; // depois que o usuário mexe na data, ela não é mais recalculada

    (function preencherFormas() {
      var ultima = null;
      try { ultima = localStorage.getItem(CHAVE_FORMA); } catch (e) { /* preferência */ }
      var selecionada = existente ? existente.formaId : (Dados.forma(ultima) && !Dados.forma(ultima).arquivado ? ultima : null);
      if (existente && !existente.formaId) seletorForma.appendChild(el('option', { value: '', text: 'Não informada' }));
      Dados.formas(true).forEach(function (f) {
        if (f.arquivado && f.id !== selecionada) return;
        seletorForma.appendChild(el('option', { value: f.id, text: f.nome, selected: f.id === selecionada }));
      });
    })();

    function cartaoEscolhido() {
      var f = Dados.forma(seletorForma.value);
      return tipoAtual === 'gasto' && f && f.tipo === 'cartao' ? f : null;
    }
    function ajustarCartao() {
      var f = cartaoEscolhido();
      campoForma.hidden = tipoAtual !== 'gasto';
      linhaCartao.hidden = !f;
      ajudaCartao.hidden = !f;
      linhaPrevisto.hidden = !!f;
      if (!f) return;
      if (!vencimentoManual && data.value) primeira.value = Dados.vencimentoPadrao(f, data.value);
      var v = UI.lerValor(valor.value), n = Math.max(1, Math.round(Number(parcelas.value)) || 1);
      ajudaCartao.textContent = (v > 0 && n > 1 ? n + 'x de ' + UI.fmtMoeda(v / n) + '. ' : '')
        + 'A compra aparece no calendário no dia ' + (data.value ? UI.fmtDiaMes(data.value) : 'da compra') + ', mas o gasto entra '
        + (n > 1 ? 'nas faturas a partir de ' : 'na fatura de ') + (primeira.value ? UI.fmtData(primeira.value) : '—') + '.';
    }
    seletorForma.addEventListener('change', function () { vencimentoManual = false; ajustarCartao(); });
    data.addEventListener('change', ajustarCartao);
    parcelas.addEventListener('input', ajustarCartao);
    valor.addEventListener('input', ajustarCartao);
    primeira.addEventListener('change', function () { vencimentoManual = true; ajustarCartao(); });

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
      ajustarCartao();
    }
    function ajustarAjuda() {
      var i = Dados.item(seletorItem.value), c = i && Dados.categoria(i.categoriaId);
      ajudaItem.textContent = i && i.papel === 'diaria' ? 'Escolha a missão abaixo para comparar a diária com os gastos da viagem.'
        : i && i.papel === 'auxilio-saude' ? 'Entra na comparação com os gastos de saúde.'
        : c && c.papel === 'saude' ? 'Entra na comparação com o Auxílio Saúde.' : '';
      ajudaItem.hidden = !ajudaItem.textContent;
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
      var v = UI.lerValor(valor.value), cartao = cartaoEscolhido();
      if (!seletorItem.value) { UI.aviso('Escolha o item.'); return false; }
      if (!(v > 0)) { UI.aviso('Informe o valor.'); valor.focus(); return false; }
      if (!data.value) { data.focus(); return false; }
      if (cartao && !primeira.value) { UI.aviso('Informe o vencimento da 1ª fatura.'); primeira.focus(); return false; }
      if (cartao && primeira.value < data.value) { UI.aviso('A fatura não pode vencer antes da compra.'); primeira.focus(); return false; }
      Dados.salvarLancamento({ data: data.value, itemId: seletorItem.value, valor: v, descricao: descricao.value, status: previsto.checked ? 'previsto' : 'realizado',
        missaoId: seletorMissao.value && seletorMissao.value !== '+nova' ? seletorMissao.value : null, mesFixo: origem.mesFixo || null,
        formaId: tipoAtual === 'gasto' ? seletorForma.value || null : null, parcelas: Number(parcelas.value), primeiraFatura: primeira.value }, existente ? existente.id : null);
      if (tipoAtual === 'gasto' && seletorForma.value) { try { localStorage.setItem(CHAVE_FORMA, seletorForma.value); } catch (e) { /* preferência */ } }
      mes = data.value.slice(0, 7);
      App.atualizar();
    } }];
    if (existente) botoes.unshift({ texto: 'Excluir', classe: 'btn-perigo btn-esquerda', acao: function () {
      UI.confirmar('Excluir este lançamento de ' + UI.fmtMoeda(existente.valor) + ' (' + Dados.nomeDoItem(existente.itemId) + ')?'
        + (existente.mesFixo ? ' A conta fixa volta a aparecer como prevista neste mês.' : '')
        + (Dados.ehCompraCartao(existente) ? ' As parcelas saem das faturas do cartão.' : ''), function () { Dados.excluirLancamento(existente.id); App.atualizar(); });
    } });
    if (base.virtual) botoes.unshift({ texto: 'Não vale este mês', classe: 'btn-secundario btn-esquerda', acao: function () {
      Dados.salvarLancamento({ data: base.data, itemId: base.itemId, valor: 0, status: 'realizado', mesFixo: base.mesFixo, pulado: true });
      UI.aviso('Conta dispensada em ' + UI.nomeMes(base.mesFixo).toLowerCase());
      App.atualizar();
    } });

    UI.modal(existente ? 'Editar lançamento' : base.virtual ? 'Confirmar conta recorrente' : 'Novo lançamento', [
      ehFixo ? null : el('div', { class: 'segmentado' }, [btnGasto, btnEntrada]),
      UI.campo('Item', seletorItem),
      ajudaItem,
      el('div', { class: 'campos-linha' }, [UI.campo('Valor (R$)', valor), UI.campo(tipoAtual === 'gasto' ? 'Data da compra' : 'Data', data)]),
      campoForma, linhaCartao, ajudaCartao,
      UI.campo('Descrição', descricao),
      UI.campo('Missão', seletorMissao, 'Use quando o gasto ou a diária for de uma viagem a serviço.'),
      linhaPrevisto
    ], botoes, { icone: 'carteira', subtitulo: base.virtual ? (base.valor ? 'Ajuste o valor e a data, se forem diferentes do previsto.' : 'Informe o valor desta conta neste mês.') : ehFixo ? 'Conta fixa de ' + UI.nomeMes(origem.mesFixo).toLowerCase() : 'Entradas e gastos do dia a dia.' });
    if (!origem.valor) valor.focus();
  }

  // ---------- Fatura de cartão ----------
  function alternarFatura(f) {
    Dados.marcarFatura(f.chave, !f.pagaEm);
    UI.aviso(f.pagaEm ? 'Fatura reaberta' : 'Fatura paga · ' + UI.fmtMoeda(f.valor));
    App.atualizar();
  }
  function abrirFatura(f) {
    var m = UI.modal('Fatura ' + Dados.nomeDaForma(f.formaId), [
      el('div', { class: 'dia-totais' }, [
        el('span', { class: 'negativo', text: UI.fmtMoeda(f.valor) }),
        el('span', { class: 'fatura-situacao ' + (f.pagaEm ? 'positivo' : ''), text: f.pagaEm ? 'Paga em ' + UI.fmtData(f.pagaEm) : 'Vence em ' + UI.fmtData(f.data) })
      ]),
      el('div', { class: 'lista-lanc' }, f.parcelas.slice().sort(function (a, b) { return a.l.data < b.l.data ? -1 : 1; }).map(function (p) {
        return el('div', { class: 'lanc' }, [
          el('span', { class: 'lanc-data', text: UI.fmtDiaMes(p.l.data) }),
          el('span', { class: 'lanc-cor', style: { background: Dados.corDoItem(p.l.itemId) } }),
          el('button', { type: 'button', class: 'lanc-corpo', title: 'Editar a compra', onclick: function () { m.fechar(); lancar(p.l); } }, [
            el('span', { class: 'lanc-nome', text: Dados.nomeDoItem(p.l.itemId) }),
            el('span', { class: 'lanc-meta', text: (p.l.descricao ? p.l.descricao + ' · ' : '') + (p.de > 1 ? 'parcela ' + p.numero + ' de ' + p.de + ' · total ' + UI.fmtMoeda(p.l.valor) : 'à vista no cartão') })
          ]),
          el('span', { class: 'lanc-valor', text: UI.fmtMoeda(p.valor) })
        ]);
      }))
    ], [
      { texto: 'Fechar', classe: 'btn-secundario' },
      { texto: f.pagaEm ? 'Desfazer pagamento' : 'Marcar como paga', classe: 'btn-primario', acao: function () { alternarFatura(f); } }
    ], { icone: 'carteira', subtitulo: f.parcelas.length + (f.parcelas.length === 1 ? ' compra' : ' compras') + ' nesta fatura' });
  }

  // ---------- Linha de movimento (lista do mês e detalhe do dia) ----------
  function linhaFatura(f, comData) {
    return el('div', { class: 'lanc fatura' + (f.pagaEm ? '' : ' previsto') }, [
      comData ? el('span', { class: 'lanc-data', text: UI.fmtDiaMes(f.data) }) : null,
      el('span', { class: 'lanc-cor cor-cartao' }),
      el('button', { type: 'button', class: 'lanc-corpo', title: 'Ver as compras da fatura', onclick: function () { abrirFatura(f); } }, [
        el('span', { class: 'lanc-nome', text: 'Fatura ' + Dados.nomeDaForma(f.formaId) }),
        el('span', { class: 'lanc-meta' }, [
          f.parcelas.length + (f.parcelas.length === 1 ? ' compra' : ' compras'),
          f.pagaEm ? el('span', { class: 'lanc-pago', text: 'Paga' }) : el('span', { class: 'lanc-previsto', text: 'A pagar' })
        ])
      ]),
      el('span', { class: 'lanc-valor negativo', text: '−' + UI.fmtMoeda(f.valor) }),
      f.pagaEm ? null : UI.botao('Paguei', function () { alternarFatura(f); }, 'btn-secundario btn-mini')
    ]);
  }

  function linhaLancamento(l, comData) {
    if (l.fatura) return linhaFatura(l, comData);
    var entrada = ehEntrada(l), previsto = l.status === 'previsto', cartao = Dados.ehCompraCartao(l);
    var m = l.missaoId ? Dados.missao(l.missaoId) : null, c = Dados.categoriaDoItem(l.itemId), forma = l.formaId ? Dados.nomeDaForma(l.formaId) : '';
    return el('div', { class: 'lanc' + (previsto ? ' previsto' : '') + (cartao ? ' no-cartao' : '') }, [
      comData ? el('span', { class: 'lanc-data', text: UI.fmtDiaMes(l.data) }) : null,
      el('span', { class: 'lanc-cor', style: { background: Dados.corDoItem(l.itemId) } }),
      el('button', { type: 'button', class: 'lanc-corpo', title: l.virtual ? 'Confirmar pagamento' : 'Editar', onclick: function () { lancar(l); } }, [
        el('span', { class: 'lanc-nome', text: Dados.nomeDoItem(l.itemId) }),
        el('span', { class: 'lanc-meta' }, [
          c ? c.nome : '', l.descricao ? ' · ' + l.descricao : '',
          forma && !cartao ? el('span', { class: 'lanc-forma', text: forma }) : null,
          cartao ? el('span', { class: 'lanc-cartao', text: forma + (l.parcelas > 1 ? ' · ' + l.parcelas + 'x' : '') + ' · fatura de ' + UI.fmtDiaMes(l.primeiraFatura) }) : null,
          m ? el('span', { class: 'lanc-missao', text: m.nome }) : null,
          previsto ? el('span', { class: 'lanc-previsto', text: l.virtual ? 'Conta recorrente' : 'Previsto' }) : null
        ])
      ]),
      el('span', { class: 'lanc-valor ' + (cartao ? 'neutro' : entrada ? 'positivo' : 'negativo'), title: cartao ? 'Compra no cartão: o gasto entra na fatura' : null,
        text: l.virtual && !l.valor ? 'valor a definir' : cartao ? UI.fmtMoeda(l.valor) : (entrada ? '+' : '−') + UI.fmtMoeda(l.valor) }),
      previsto ? UI.botao(entrada ? 'Recebi' : 'Paguei', function () {
        if (l.virtual) { lancar(l); return; }
        Dados.salvarLancamento({ data: l.data, itemId: l.itemId, valor: l.valor, descricao: l.descricao, status: 'realizado', missaoId: l.missaoId }, l.id);
        App.atualizar();
      }, 'btn-secundario btn-mini') : null
    ]);
  }

  // ---------- Detalhe do dia ----------
  function abrirDia(iso, lancs, lembretes) {
    var t = totais(lancs), hoje = UI.hoje();
    var metas = iso <= hoje ? Habitos.doDia(iso) : { dia: [], semana: [], mes: [] };
    var listaMetas = metas.dia.concat(metas.semana, metas.mes);
    // Clicar numa linha (editar, concluir, pagar) fecha este detalhe: a ação abre o próprio formulário ou redesenha a tela.
    var d = new Date(iso + 'T00:00:00');
    function fecharAoClicar(e) { if (e.target.closest('button')) m.fechar(); }
    var m = UI.modal(DIAS[(d.getDay() + 6) % 7] + ', ' + UI.fmtData(iso), [
      lancs.length ? el('div', { class: 'dia-totais' }, [
        el('span', { class: 'positivo', text: '+' + UI.fmtMoeda(t.entradas) }), el('span', { class: 'negativo', text: '−' + UI.fmtMoeda(t.gastos) }),
        t.cartao ? el('span', { class: 'neutro', title: 'Compras no cartão neste dia', text: 'Cartão ' + UI.fmtMoeda(t.cartao) }) : null
      ]) : null,
      lancs.length ? el('div', { class: 'lista-lanc', onclick: fecharAoClicar }, lancs.map(function (l) { return linhaLancamento(l); }))
        : el('p', { class: 'modal-desc', text: 'Nenhum lançamento neste dia.' }),
      lembretes.length ? el('div', { class: 'secao-titulo dia-secao', text: 'Lembretes' }) : null,
      lembretes.length ? el('div', { class: 'lista-lembretes', onclick: fecharAoClicar }, lembretes.map(function (l) { return Lembretes.linha(l, true); })) : null,
      listaMetas.length ? el('div', { class: 'secao-titulo dia-secao', text: iso === hoje ? 'Metas de hoje' : 'Metas deste dia' }) : null,
      listaMetas.length ? el('div', { class: 'lista-habitos', onclick: fecharAoClicar }, listaMetas.map(function (h) { return Habitos.linha(h, iso); })) : null
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
      var doDia = porDia[iso] || [], lembretes = Dados.lembretesDoDia(iso), t = totais(doDia);
      var pendentes = lembretes.filter(function (l) { return !l.concluido; });
      var metas = iso <= hoje ? Dados.resumoHabitosDoDia(iso) : { total: 0 };
      celulas.push(el('button', { type: 'button', class: 'cal-dia' + (iso === hoje ? ' hoje' : '') + (doDia.length || lembretes.length ? ' com-itens' : ''),
        'aria-label': UI.fmtData(iso), onclick: function () { abrirDia(iso, doDia, lembretes); } }, [
        el('span', { class: 'cal-topo' }, [
          el('span', { class: 'cal-numero', text: numero }),
          el('span', { class: 'cal-marcas' }, [
            metas.total ? el('span', { class: 'cal-metas' + (metas.feitas === metas.total ? ' completa' : ''), title: 'Metas diárias cumpridas', text: metas.feitas + '/' + metas.total }) : null,
            lembretes.length ? el('span', { class: 'cal-lembretes', title: lembretes.map(function (l) { return l.titulo; }).join('\n') },
              (pendentes.length ? pendentes : lembretes).slice(0, 4).map(function (l) { return el('span', { class: 'cal-ponto relev-' + l.relevancia + (l.concluido ? ' concluido' : '') }); })) : null
          ])
        ]),
        t.entradas ? el('span', { class: 'cal-total positivo', text: '+' + UI.fmtCurto(t.entradas) }) : null,
        t.gastos ? el('span', { class: 'cal-total negativo', text: '−' + UI.fmtCurto(t.gastos) }) : null,
        t.cartao ? el('span', { class: 'cal-total neutro', title: 'Compras no cartão (o gasto entra na fatura)', text: 'cartão ' + UI.fmtCurto(t.cartao) }) : null,
        el('span', { class: 'cal-itens' }, doDia.slice(0, 2).map(function (l) {
          if (l.fatura) return el('span', { class: 'cal-item fatura' + (l.pagaEm ? '' : ' previsto'), text: 'Fatura ' + Dados.nomeDaForma(l.formaId).replace(/^Cart[ãa]o de Cr[ée]dito\s*/i, '') });
          return el('span', { class: 'cal-item' + (l.status === 'previsto' ? ' previsto' : '') + (Dados.ehCompraCartao(l) ? ' no-cartao' : ''), style: { borderLeftColor: Dados.corDoItem(l.itemId) }, text: Dados.nomeDoItem(l.itemId) });
        }).concat(doDia.length > 2 ? [el('span', { class: 'cal-mais', text: '+' + (doDia.length - 2) + ' mais' })] : [])),
        pendentes.length ? el('span', { class: 'cal-lembrete-texto relev-' + pendentes[0].relevancia, text: (pendentes[0].hora ? pendentes[0].hora + ' ' : '') + pendentes[0].titulo }) : null
      ]));
    })(mes + '-' + UI.pad(dia), dia);
    while ((celulas.length - 7) % 7) celulas.push(el('div', { class: 'cal-dia fora' }));
    return el('div', { class: 'calendario' }, celulas);
  }

  // ---------- Avisos (topo da página) ----------
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

  // Cartões: a fatura que vence neste mês, o que está atrasado e o que já está comprometido nos próximos meses.
  function painelCartoes() {
    var todas = Dados.faturas(), fimDoMes = mes + '-31', inicioDoMes = mes + '-01';
    var cartoes = Dados.formas(true).filter(function (f) { return f.tipo === 'cartao' && (!f.arquivado || todas.some(function (x) { return x.formaId === f.id && !x.pagaEm; })); });
    if (!cartoes.length) return null;
    return el('section', { class: 'painel painel-lado' }, [
      el('h2', { class: 'secao-titulo', text: 'Cartões de crédito' }),
      cartoes.map(function (c) {
        var minhas = todas.filter(function (x) { return x.formaId === c.id; });
        var doMes = minhas.filter(function (x) { return x.data >= inicioDoMes && x.data <= fimDoMes; });
        var atrasadas = minhas.filter(function (x) { return x.data < inicioDoMes && !x.pagaEm; });
        var futuras = minhas.filter(function (x) { return x.data > fimDoMes && !x.pagaEm; });
        var somar = function (lista) { return lista.reduce(function (s, x) { return s + x.valor; }, 0); };
        return el('div', { class: 'cartao-credito' }, [
          el('div', { class: 'cartao-credito-nome', text: c.nome }),
          doMes.length ? doMes.map(function (f) {
            return el('button', { type: 'button', class: 'cartao-credito-linha', title: 'Ver as compras da fatura', onclick: function () { abrirFatura(f); } }, [
              el('span', { text: 'Fatura de ' + UI.fmtDiaMes(f.data) + (f.pagaEm ? ' · paga' : '') }),
              el('strong', { class: f.pagaEm ? 'positivo' : 'negativo', text: UI.fmtMoeda(f.valor) })
            ]);
          }) : el('div', { class: 'cartao-credito-linha vazia' }, [el('span', { text: 'Sem fatura neste mês' }), el('span', { text: '—' })]),
          atrasadas.length ? el('button', { type: 'button', class: 'cartao-credito-linha', onclick: function () { abrirFatura(atrasadas[0]); } }, [
            el('span', { class: 'negativo', text: 'Em aberto de meses anteriores' }), el('strong', { class: 'negativo', text: UI.fmtMoeda(somar(atrasadas)) })]) : null,
          futuras.length ? el('div', { class: 'cartao-credito-linha vazia' }, [
            el('span', { text: 'Próximas faturas (' + futuras.length + ')' }), el('span', { text: UI.fmtMoeda(somar(futuras)) })]) : null
        ]);
      })
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

    raiz.appendChild(painelAvisos());

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
      cartaoValor('carteira', 'Gastos', UI.fmtMoeda(r.gastos), 'negativo', r.gastosPrevistos ? '+ ' + UI.fmtMoeda(r.gastosPrevistos) + ' a pagar' : (r.comprasNoCartao ? UI.fmtMoeda(r.comprasNoCartao) + ' comprados no cartão' : null)),
      cartaoValor('grafico', 'Saldo do mês', UI.fmtMoeda(r.saldo, true), r.saldo >= 0 ? 'positivo' : 'negativo', 'Recebido − pago até agora'),
      cartaoValor('calendario', 'Saldo previsto', UI.fmtMoeda(r.saldoPrevisto, true), r.saldoPrevisto >= 0 ? 'positivo' : 'negativo', temPrevisto ? 'Com o que falta pagar e receber' : 'Sem contas em aberto')
    ]));

    raiz.appendChild(el('div', { class: 'fin-grade' }, [
      el('div', { class: 'fin-principal' }, [
        el('section', { class: 'painel painel-calendario' }, calendario(lancs)),
        Habitos.painelHoje(),
        el('section', { class: 'painel' }, [
          el('h2', { class: 'secao-titulo' }, ['Lançamentos do mês', el('span', { class: 'secao-contagem', text: lancs.length })]),
          lancs.length ? el('div', { class: 'lista-lanc' }, lancs.map(function (l) { return linhaLancamento(l, true); }))
            : el('p', { class: 'modal-desc', text: 'Nada lançado em ' + UI.nomeMes(mes).toLowerCase() + '. Use "Lançar gasto" ou clique num dia do calendário. Contas que se repetem (aluguel, salário…) podem ser marcadas como fixas em Configurações.' })
        ])
      ]),
      el('div', { class: 'fin-lado' }, [painelCategorias(r, 'gasto', 'Gastos por categoria'), painelCartoes(), painelCategorias(r, 'entrada', 'Entradas'), painelComparativos()])
    ]));
  }

  return { render: render, lancar: lancar, linhaLancamento: linhaLancamento, comparacao: comparacao };
})();
