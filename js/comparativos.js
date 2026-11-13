// Página "Missões e Saúde": compara o que entrou com o que saiu.
//   Missões: diárias recebidas × gastos da viagem a serviço (fora da circunscrição).
//   Saúde:   Auxílio Saúde recebido × gastos com saúde.
var Comparativos = (function () {
  var el = UI.el;
  var ano = UI.hoje().slice(0, 4);

  // aoSalvar (opcional): chamado com a missão criada (usado pelo formulário de lançamento).
  function editarMissao(id, aoSalvar) {
    var m = id ? Dados.missao(id) : null;
    var nome = el('input', { type: 'text', value: m ? m.nome : '', placeholder: 'Ex.: Operação em São Paulo', maxLength: 80 });
    var destino = el('input', { type: 'text', value: m ? m.destino : '', placeholder: 'Cidade (opcional)', maxLength: 80 });
    var inicio = el('input', { type: 'date', value: (m && m.inicio) || UI.hoje() });
    var fim = el('input', { type: 'date', value: (m && m.fim) || '' });
    var botoes = [{ texto: 'Cancelar', classe: 'btn-secundario' }, { texto: 'Salvar', classe: 'btn-primario', acao: function () {
      if (!nome.value.trim()) { nome.focus(); return false; }
      var salva = Dados.salvarMissao({ nome: nome.value, destino: destino.value, inicio: inicio.value, fim: fim.value }, id);
      if (aoSalvar) aoSalvar(salva); else App.atualizar();
    } }];
    if (m) botoes.unshift({ texto: 'Excluir', classe: 'btn-perigo btn-esquerda', acao: function () {
      UI.confirmar('Excluir a missão "' + m.nome + '"? Os lançamentos continuam no financeiro, só deixam de pertencer a ela.', function () { Dados.excluirMissao(m.id); App.atualizar(); });
    } });
    UI.modal(m ? 'Editar missão' : 'Nova missão', [
      UI.campo('Nome', nome),
      UI.campo('Destino', destino),
      el('div', { class: 'campos-linha' }, [UI.campo('Início', inicio), UI.campo('Fim (opcional)', fim)])
    ], botoes, { icone: 'mala', subtitulo: 'Depois, marque a missão nas diárias e nos gastos da viagem.' });
  }

  function periodo(m) {
    if (!m.inicio) return '';
    return UI.fmtData(m.inicio) + (m.fim && m.fim !== m.inicio ? ' a ' + UI.fmtData(m.fim) : '');
  }

  function cartaoMissao(m) {
    var s = Dados.saldoDaMissao(m.id);
    var pendente = s.aReceber || s.aGastar;
    return el('details', { class: 'missao' }, [
      el('summary', null, [
        el('div', { class: 'missao-topo' }, [
          el('div', null, [
            el('div', { class: 'missao-nome', text: m.nome }),
            el('div', { class: 'missao-meta', text: [m.destino, periodo(m)].filter(Boolean).join(' · ') || 'Sem data' })
          ]),
          el('div', { class: 'missao-saldo ' + (s.saldo >= 0 ? 'positivo' : 'negativo') }, [
            el('span', { class: 'missao-saldo-rotulo', text: s.saldo >= 0 ? 'Sobrou' : 'Faltou' }),
            el('strong', { text: UI.fmtMoeda(s.saldo, true) })
          ])
        ]),
        el('div', { class: 'missao-numeros' }, [
          UI.metrica('Diárias recebidas', UI.fmtMoeda(s.recebido), 'positivo'),
          UI.metrica('Gastos na missão', UI.fmtMoeda(s.gasto), 'negativo'),
          UI.metrica('Lançamentos', String(s.lancamentos.length))
        ]),
        pendente ? el('div', { class: 'campo-ajuda', text: 'Ainda previsto: ' + (s.aReceber ? UI.fmtMoeda(s.aReceber) + ' a receber' : '') + (s.aReceber && s.aGastar ? ' e ' : '') + (s.aGastar ? UI.fmtMoeda(s.aGastar) + ' a pagar' : '') + ' (não entra no saldo).' }) : null
      ]),
      el('div', { class: 'missao-corpo' }, [
        s.lancamentos.length ? el('div', { class: 'lista-lanc' }, s.lancamentos.map(function (l) { return Financeiro.linhaLancamento(l, true); }))
          : el('p', { class: 'modal-desc', text: 'Nenhum lançamento ligado a esta missão ainda.' }),
        el('div', { class: 'pasta-acoes' }, [
          UI.botao('Lançar diária', function () { Financeiro.lancar({ tipo: 'entrada', itemId: itemDiaria(), missaoId: m.id, data: UI.hoje() }); }, 'btn-secundario', 'mais'),
          UI.botao('Lançar gasto', function () { Financeiro.lancar({ tipo: 'gasto', missaoId: m.id, data: UI.hoje() }); }, 'btn-secundario', 'mais'),
          UI.botao('Editar missão', function () { editarMissao(m.id); }, 'btn-contorno')
        ])
      ])
    ]);
  }
  function itemDiaria() {
    var i = Dados.db.itens.filter(function (x) { return x.papel === 'diaria' && !x.arquivado; })[0];
    return i ? i.id : null;
  }

  function tabelaSaude() {
    var linhas = [], total = Dados.saldoSaude(ano);
    for (var m = 1; m <= 12; m++) {
      var s = Dados.saldoSaude(ano + '-' + UI.pad(m));
      if (!s.gasto && !s.reembolso) continue; // só os meses com movimento
      linhas.push(el('tr', null, [
        el('td', { text: UI.MESES[m - 1] }),
        el('td', { class: 'num negativo', text: s.gasto ? UI.fmtMoeda(s.gasto) : '—' }),
        el('td', { class: 'num positivo', text: s.reembolso ? UI.fmtMoeda(s.reembolso) : '—' }),
        el('td', { class: 'num ' + (s.saldo >= 0 ? 'positivo' : 'negativo'), text: s.gasto || s.reembolso ? UI.fmtMoeda(s.saldo, true) : '—' })
      ]));
    }
    if (!linhas.length) return el('p', { class: 'modal-desc', text: 'Nenhum gasto de saúde nem Auxílio Saúde lançado em ' + ano + '.' });
    return el('table', { class: 'tabela' }, [
      el('thead', null, el('tr', null, [el('th', { text: 'Mês' }), el('th', { class: 'num', text: 'Gastos com saúde' }), el('th', { class: 'num', text: 'Auxílio Saúde' }), el('th', { class: 'num', text: 'Saldo' })])),
      el('tbody', null, linhas),
      el('tfoot', null, el('tr', null, [
        el('td', { text: 'Total de ' + ano }),
        el('td', { class: 'num negativo', text: UI.fmtMoeda(total.gasto) }),
        el('td', { class: 'num positivo', text: UI.fmtMoeda(total.reembolso) }),
        el('td', { class: 'num ' + (total.saldo >= 0 ? 'positivo' : 'negativo'), text: UI.fmtMoeda(total.saldo, true) })
      ]))
    ]);
  }

  function render(raiz) {
    var missoes = Dados.missoes();
    var geral = missoes.reduce(function (t, m) { var s = Dados.saldoDaMissao(m.id); t.recebido += s.recebido; t.gasto += s.gasto; return t; }, { recebido: 0, gasto: 0 });
    var saude = Dados.saldoSaude(ano);

    raiz.appendChild(el('div', { class: 'pagina-topo' }, [
      el('div', null, [
        el('h1', { class: 'pagina-titulo', text: 'Missões e Saúde' }),
        el('div', { class: 'pagina-subtitulo', text: 'O que você recebeu comparado com o que gastou.' })
      ]),
      el('div', { class: 'pagina-acoes' }, UI.botao('Nova missão', function () { editarMissao(); }, 'btn-primario', 'mais'))
    ]));

    raiz.appendChild(el('div', { class: 'cartoes cartoes-fin' }, [
      el('div', { class: 'cartao cartao-comparacao' }, Financeiro.comparacao('Todas as missões', geral.recebido, geral.gasto, geral.recebido - geral.gasto, 'Diárias', 'Gastos')),
      el('div', { class: 'cartao cartao-comparacao' }, Financeiro.comparacao('Saúde em ' + ano, saude.reembolso, saude.gasto, saude.saldo, 'Auxílio', 'Gastos'))
    ]));

    raiz.appendChild(el('h2', { class: 'secao-titulo titulo-manual', text: 'Missões' }));
    if (missoes.length) raiz.appendChild(el('div', { class: 'lista-missoes' }, missoes.map(cartaoMissao)));
    else raiz.appendChild(el('div', { class: 'vazio' }, [
      el('p', { class: 'vazio-destaque', text: 'Nenhuma missão cadastrada' }),
      el('p', { text: 'Crie uma missão para cada viagem a serviço. Ao lançar a diária e os gastos da viagem, escolha a missão: o programa mostra se sobrou ou faltou dinheiro.' }),
      el('div', { class: 'vazio-acoes' }, UI.botao('Criar missão', function () { editarMissao(); }, 'btn-primario'))
    ]));

    var anoAtual = UI.hoje().slice(0, 4);
    raiz.appendChild(el('section', { class: 'painel painel-saude' }, [
      el('div', { class: 'painel-lado-topo' }, [
        el('h2', { class: 'secao-titulo', text: 'Saúde: gastos × Auxílio Saúde' }),
        el('div', { class: 'seletor-mes' }, [
          el('button', { type: 'button', class: 'btn-icone btn-mes', title: 'Ano anterior', onclick: function () { ano = String(Number(ano) - 1); App.atualizar(); } }, UI.icone('anterior')),
          el('strong', { text: ano }),
          el('button', { type: 'button', class: 'btn-icone btn-mes', title: 'Próximo ano', disabled: ano >= anoAtual, onclick: function () { ano = String(Number(ano) + 1); App.atualizar(); } }, UI.icone('proximo'))
        ])
      ]),
      tabelaSaude(),
      el('p', { class: 'campo-ajuda', text: 'Entram os gastos pagos da categoria marcada como saúde e as entradas do item Auxílio Saúde (ajustável em Configurações).' })
    ]));
  }

  return { render: render, editarMissao: editarMissao };
})();
