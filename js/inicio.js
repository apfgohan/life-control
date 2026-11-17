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
    return el('div', { class: 'pagina-topo' }, [
      el('div', null, [
        el('h1', { class: 'pagina-titulo', text: s + (nome ? ', ' + nome : '') }),
        el('div', { class: 'pagina-subtitulo', text: dias[d.getDay()].charAt(0).toUpperCase() + dias[d.getDay()].slice(1) + ', ' + UI.fmtData(UI.hoje()) })
      ]),
      seloProjeto()
    ]);
  }

  // "Dia 12 do projeto · desde 16/11/2026" (antes do início: quantos dias faltam).
  function seloProjeto() {
    var n = Dados.diaDoProjeto(), inicio = Dados.inicioProjeto();
    var grande = n >= 1 ? 'Dia ' + n : n === 0 ? 'Amanhã' : 'Em ' + (1 - n) + ' dias';
    var texto = n >= 1 ? 'do projeto · desde ' + UI.fmtData(inicio) : 'começa o projeto · ' + UI.fmtData(inicio);
    return el('a', { class: 'selo-projeto', href: '#/configuracoes', title: 'Início do projeto (muda em Configurações)' }, [
      UI.icone('calendario'),
      el('span', { class: 'selo-projeto-texto' }, [el('strong', { text: grande }), el('span', { text: texto })])
    ]);
  }

  // Contador do mês: metas (cada ocorrência) batidas, que falharam e que faltam, e o índice que multiplica o XP do mês.
  function painelMes() {
    var hoje = UI.hoje(), s = Dados.resumoDoMes(hoje.slice(0, 7), hoje), f = s.faixa;
    var nomeMes = UI.nomeMes(hoje.slice(0, 7)).split(' ')[0].toLowerCase();
    function mult(v) { return '×' + String(v).replace('.', ','); }
    function bloco(rotulo, valor, classe) {
      return el('div', { class: 'mes-numero ' + (classe || '') }, [el('strong', { text: valor }), el('span', { text: rotulo })]);
    }
    // Quantas batidas seguidas (sem falhar) levam à próxima faixa, se ainda der neste mês.
    var dica = null, decididas = s.batidas + s.falharam;
    if (f) {
      var i = Dados.FAIXAS_MES.indexOf(f), prox = i > 0 ? Dados.FAIXAS_MES[i - 1] : null;
      if (prox) {
        var p = prox.min / 100, k = p >= 1 ? (s.falharam ? Infinity : 0) : Math.max(0, Math.ceil((p * decididas - s.batidas) / (1 - p) - 1e-9));
        if (k > 0 && k <= s.faltam) dica = 'Mais ' + k + (k === 1 ? ' meta batida' : ' metas batidas') + ' sem falhar e você chega a ' + prox.nome + ' (' + mult(prox.mult) + ').';
      }
    }
    var partes = [['batidas', s.batidas], ['falharam', s.falharam], ['faltam', s.faltam]].filter(function (x) { return x[1] > 0; });
    return el('section', { class: 'painel painel-mes' + (f ? ' faixa-' + f.id : '') }, [
      el('div', { class: 'painel-lado-topo' }, [
        el('h2', { class: 'secao-titulo' }, [UI.icone('calendario'), 'Metas de ' + nomeMes]),
        el('button', { type: 'button', class: 'link', text: 'Como funciona', onclick: explicarIndice })
      ]),
      s.total ? el('div', { class: 'mes-corpo' }, [
        el('div', { class: 'mes-indice', title: 'Índice do mês' }, [
          el('span', { class: 'mes-escudo' }, UI.icone('escudo')),
          el('div', { class: 'mes-indice-texto' }, [
            el('strong', { class: 'mes-faixa', text: f ? f.nome : 'Sem índice ainda' }),
            el('span', { text: f ? 'Até agora: ' + Math.floor(s.pct) + '% batidas · no fim do mês o XP dele vale ' + mult(f.mult) : 'Aparece quando a primeira meta do mês for decidida.' })
          ])
        ]),
        el('div', { class: 'mes-numeros' }, [
          bloco('metas no mês', s.total),
          bloco('batidas', s.batidas, 'positivo'),
          bloco('falharam', s.falharam, s.falharam ? 'negativo' : ''),
          bloco('faltam', s.faltam)
        ]),
        // Grade única: uma caixinha por meta do mês, em ordem de data. ✓ batida, ✕ falhou, vazia = ainda em jogo.
        (function () {
          var todas = [];
          s.linhas.forEach(function (l, i) { l.caixas.forEach(function (c) { todas.push({ c: c, titulo: l.area === 'longo' ? '' : l.titulo, ordem: i }); }); });
          todas.sort(function (a, b) { return a.c.data !== b.c.data ? (a.c.data < b.c.data ? -1 : 1) : a.ordem - b.ordem; });
          return el('div', { class: 'mes-caixas mes-grade', role: 'img', 'aria-label': s.batidas + ' batidas, ' + s.falharam + ' falharam, ' + s.faltam + ' faltam' }, todas.map(function (x) {
            var c = x.c;
            return el('span', { class: 'caixa ' + c.estado + (c.atual ? ' atual' : ''), title: (x.titulo ? x.titulo + ' · ' : '') + c.rotulo + ' · ' + (c.estado === 'batida' ? 'batida' : c.estado === 'falhou' ? 'falhou' : c.atual ? 'em curso' : 'ainda vai acontecer'), text: c.estado === 'batida' ? '✓' : c.estado === 'falhou' ? '✕' : '' });
          }));
        })(),
        dica ? el('p', { class: 'mes-dica', text: dica }) : null
      ]) : el('p', { class: 'modal-desc', text: 'Crie metas recorrentes ou de longo prazo com prazo neste mês para acompanhar o índice.' })
    ]);
  }

  function explicarIndice() {
    var s = Dados.resumoDoMes(UI.hoje().slice(0, 7));
    UI.modal('Índice do mês', [
      el('p', { class: 'modal-desc', text: 'Cada ocorrência conta como uma meta: cada dia de uma meta diária, cada semana de uma semanal (a semana entra no mês do seu domingo), a meta mensal e as metas de longo prazo com prazo no mês. Falhou = o período acabou sem cumprir; falta = ainda vai acontecer ou está em curso.' }),
      el('p', { class: 'modal-desc', text: 'O índice é a % das metas batidas entre as já decididas (batidas + falharam). Quando o mês termina, ele multiplica todo o XP ganho no mês: treinos, dieta, metas e lembretes. Na virada do mês aparece o fechamento com o bônus (ou a perda).' }),
      el('div', { class: 'faixas-mes' }, Dados.FAIXAS_MES.map(function (f, i) {
        var anterior = Dados.FAIXAS_MES[i - 1];
        return el('div', { class: 'faixa-linha faixa-' + f.id + (s.faixa === f ? ' atual' : '') }, [
          el('span', { class: 'mes-escudo' }, UI.icone('escudo')),
          el('strong', { text: f.nome }),
          el('span', { class: 'faixa-pct', text: f.min === 100 ? '100%' : f.min ? f.min + '% a ' + (anterior.min - 1) + '%' : 'abaixo de ' + anterior.min + '%' }),
          el('span', { class: 'faixa-mult', text: '×' + String(f.mult).replace('.', ',') })
        ]);
      }))
    ], [{ texto: 'Fechar', classe: 'btn-primario' }], { icone: 'escudo' });
  }

  function render(raiz) {
    raiz.appendChild(saudacao());
    raiz.appendChild(Frases.painel());
    raiz.appendChild(painelAvisos());
    raiz.appendChild(painelMes());
    var semanal = Dieta.painelPendente();
    if (semanal) raiz.appendChild(semanal);
    raiz.appendChild(Treinos.painelInicio());
    raiz.appendChild(Dieta.painelDia(UI.hoje(), { titulo: 'Alimentação de hoje' }));
    raiz.appendChild(Habitos.painelHoje());
  }

  return { render: render };
})();
