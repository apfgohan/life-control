// Dashboard: acompanhamento das metas, treinos e dieta semana a semana (segunda a domingo) e a evolução do corpo.
// Os gráficos são SVG simples, numa cor só por gráfico; passar o mouse (ou tocar) numa barra ou ponto mostra o valor.
var Dashboard = (function () {
  var el = UI.el, NS = 'http://www.w3.org/2000/svg';
  var SEMANAS = 8;

  function svg(tag, attrs, filhos) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    (filhos || []).forEach(function (f) { if (f) n.appendChild(f); });
    return n;
  }
  function titulo(texto) { var t = document.createElementNS(NS, 'title'); t.textContent = texto; return t; }
  function fmt(v, casas) { return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: casas == null ? 1 : casas }); }

  // Segundas-feiras das últimas N semanas (da mais antiga para a atual).
  function semanas(n) {
    var hoje = UI.hoje(), ini = UI.somarDias(hoje, -Dados.diaDaSemana(hoje)), l = [];
    for (var i = n - 1; i >= 0; i--) l.push(UI.somarDias(ini, -7 * i));
    return l;
  }
  function rotuloSemana(seg) { return UI.fmtDiaMes(seg); }

  // ---------- Números por semana ----------
  function treinosNaSemana(seg) {
    var fim = UI.somarDias(seg, 6);
    return Dados.historico().filter(function (r) { return r.data >= seg && r.data <= fim; }).length;
  }
  function minutosNaSemana(seg) {
    var fim = UI.somarDias(seg, 6);
    return Math.round(Dados.historico().filter(function (r) { return r.data >= seg && r.data <= fim; }).reduce(function (s, r) { return s + Dados.duracaoSeg(r); }, 0) / 60);
  }
  // Metas recorrentes: dias cumpridos das metas diárias + metas semanais batidas, sobre o possível até hoje.
  function metasNaSemana(seg) {
    var hoje = UI.hoje(), r = { feitas: 0, possiveis: 0 };
    Dados.db.habitos.forEach(function (h) {
      if (h.periodo === 'dia') {
        for (var i = 0; i < 7; i++) {
          var d = UI.somarDias(seg, i);
          if (d > hoje || (d < h.desde && !h.feitos[d]) || !Dados.habitoValeNoDia(h, d)) continue;
          r.possiveis++;
          if (h.feitos[d]) r.feitas++;
        }
      } else if (h.periodo === 'semana') {
        if (UI.somarDias(seg, 6) < h.desde) return;
        r.possiveis++;
        if (Dados.progressoHabito(h, seg).completo) r.feitas++;
      }
    });
    r.pct = r.possiveis ? Math.round(r.feitas / r.possiveis * 100) : null;
    return r;
  }
  function dietaNaSemana(seg) {
    var s = Dados.semanaDieta(seg);
    s.pct = s.total ? Math.round(s.dieta / s.total * 100) : null;
    return s;
  }

  // ---------- Gráficos ----------
  // Barras verticais, uma por semana. dados: [{ rotulo, valor (null = sem dado), dica }]. max: topo da escala.
  function barras(dados, max, sufixo, classe) {
    var L = 320, A = 150, base = 120, topo = 14, larg = L / dados.length, barra = Math.min(26, larg * 0.6);
    max = Math.max(max || 0, 1);
    var g = [svg('line', { x1: 0, x2: L, y1: base, y2: base, class: 'eixo' })];
    [0.5, 1].forEach(function (f) { g.push(svg('line', { x1: 0, x2: L, y1: base - (base - topo) * f, y2: base - (base - topo) * f, class: 'grade' })); });
    dados.forEach(function (d, i) {
      var x = i * larg + (larg - barra) / 2, cx = i * larg + larg / 2;
      var h = d.valor == null ? 0 : Math.max(d.valor > 0 ? 3 : 0, (base - topo) * Math.min(1, d.valor / max));
      var atual = i === dados.length - 1;
      var grupo = svg('g', { class: 'barra-grupo' + (atual ? ' atual' : '') }, [
        titulo(d.dica || (d.rotulo + ': ' + (d.valor == null ? 'sem dados' : fmt(d.valor) + sufixo))),
        svg('rect', { x: i * larg, y: 0, width: larg, height: A, class: 'alvo' }),
        h ? svg('path', { d: barraArredondada(x, base, barra, h), class: 'barra ' + (classe || '') }) : svg('line', { x1: x, x2: x + barra, y1: base - 1, y2: base - 1, class: 'barra-vazia' }),
        svg('text', { x: cx, y: A - 12, class: 'rotulo-x', 'text-anchor': 'middle' })
      ]);
      grupo.lastChild.textContent = d.rotulo;
      if (atual && d.valor != null) {
        var t = svg('text', { x: cx, y: base - h - 5, class: 'rotulo-valor', 'text-anchor': 'middle' });
        t.textContent = fmt(d.valor) + sufixo;
        grupo.appendChild(t);
      }
      g.push(grupo);
    });
    return svg('svg', { viewBox: '0 0 ' + L + ' ' + A, class: 'grafico', role: 'img' }, g);
  }
  function barraArredondada(x, base, w, h) {
    var r = Math.min(4, h, w / 2), y = base - h;
    return 'M' + x + ',' + base + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + base + 'Z';
  }

  // Linha no tempo. pontos: [{ data, valor }] em ordem. Escala com folga em volta dos valores.
  function linha(pontos, unidade) {
    var L = 320, A = 150, esq = 34, dir = 12, topo = 14, base = 120;
    if (!pontos.length) return el('p', { class: 'modal-desc', text: 'Sem registros ainda.' });
    var vals = pontos.map(function (p) { return p.valor; }), min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var folga = Math.max((max - min) * 0.2, max * 0.01, 0.5);
    min -= folga; max += folga;
    function x(i) { return pontos.length === 1 ? (esq + L - dir) / 2 : esq + (L - esq - dir) * i / (pontos.length - 1); }
    function y(v) { return base - (base - topo) * (v - min) / (max - min); }
    var g = [svg('line', { x1: esq, x2: L - dir, y1: base, y2: base, class: 'eixo' })];
    [min + folga, max - folga].forEach(function (v) {
      g.push(svg('line', { x1: esq, x2: L - dir, y1: y(v), y2: y(v), class: 'grade' }));
      var t = svg('text', { x: esq - 6, y: y(v) + 4, class: 'rotulo-y', 'text-anchor': 'end' }); t.textContent = fmt(v); g.push(t);
    });
    if (pontos.length > 1) g.push(svg('polyline', { points: pontos.map(function (p, i) { return x(i) + ',' + y(p.valor); }).join(' '), class: 'linha' }));
    pontos.forEach(function (p, i) {
      var ultimo = i === pontos.length - 1;
      var grupo = svg('g', { class: 'ponto-grupo' }, [
        titulo(UI.fmtData(p.data) + ': ' + fmt(p.valor) + ' ' + unidade),
        svg('circle', { cx: x(i), cy: y(p.valor), r: 14, class: 'alvo' }),
        svg('circle', { cx: x(i), cy: y(p.valor), r: ultimo ? 5 : 4, class: 'ponto' + (ultimo ? ' atual' : '') })
      ]);
      if (i === 0 || ultimo) {
        var t = svg('text', { x: x(i), y: A - 12, class: 'rotulo-x', 'text-anchor': i === 0 && pontos.length > 1 ? 'start' : ultimo && pontos.length > 1 ? 'end' : 'middle' });
        t.textContent = UI.fmtDiaMes(p.data);
        grupo.appendChild(t);
      }
      g.push(grupo);
    });
    return svg('svg', { viewBox: '0 0 ' + L + ' ' + A, class: 'grafico', role: 'img' }, g);
  }

  // ---------- Peças da página ----------
  function kpi(rotulo, valor, detalhe, classe) {
    return el('div', { class: 'kpi' }, [
      el('span', { class: 'kpi-rotulo', text: rotulo }),
      el('strong', { class: 'kpi-valor', text: valor }),
      detalhe ? el('span', { class: 'kpi-detalhe ' + (classe || ''), text: detalhe }) : null
    ]);
  }
  function variacao(atual, anterior, sufixo) {
    if (atual == null || anterior == null) return { texto: null, classe: '' };
    var d = atual - anterior;
    return { texto: (d > 0 ? '▲ ' : d < 0 ? '▼ ' : '= ') + fmt(Math.abs(d)) + sufixo + ' vs semana passada', classe: d > 0 ? 'positivo' : d < 0 ? 'negativo' : 'neutro' };
  }

  function cartaoGrafico(tituloTexto, sub, grafico, tabela) {
    var verTabela = false, area = el('div', { class: 'grafico-area' }, grafico);
    var botao = el('button', { type: 'button', class: 'link', text: 'Ver tabela', onclick: function () {
      verTabela = !verTabela;
      area.innerHTML = '';
      area.appendChild(verTabela ? tabela : grafico);
      botao.textContent = verTabela ? 'Ver gráfico' : 'Ver tabela';
    } });
    return el('section', { class: 'painel cartao-grafico' }, [
      el('div', { class: 'painel-lado-topo' }, [el('div', null, [el('h2', { class: 'secao-titulo', text: tituloTexto }), sub ? el('div', { class: 'campo-ajuda', text: sub }) : null]), tabela ? botao : null]),
      area
    ]);
  }
  function tabelaSimples(cab, linhas) {
    return el('table', { class: 'tabela-evolucao tabela-dash' }, [
      el('thead', null, el('tr', null, cab.map(function (c) { return el('th', { text: c }); }))),
      el('tbody', null, linhas.map(function (l) { return el('tr', null, l.map(function (c) { return el('td', { text: c }); })); }))
    ]);
  }

  // Evolução das cargas: primeiro e último resultado de cada exercício.
  function progressoExercicios() {
    var linhas = [];
    Dados.treinos().forEach(function (t) {
      Dados.exercicios(t.id).forEach(function (e) {
        var hist = Dados.historico().slice().reverse(), primeiro = null, ultimo = null, vezes = 0;
        hist.forEach(function (r) {
          var x = r.exercicios.filter(function (y) { return y.exercicioId === e.id; })[0];
          if (!x) return;
          vezes++;
          if (!primeiro) primeiro = { x: x, data: r.data };
          ultimo = { x: x, data: r.data };
        });
        if (primeiro) linhas.push({ treino: t.nome, e: e, primeiro: primeiro, ultimo: ultimo, vezes: vezes });
      });
    });
    if (!linhas.length) return el('p', { class: 'modal-desc', text: 'Aparece aqui depois dos primeiros treinos registrados.' });
    function res(x) { return x.semCarga ? x.reps + ' reps' : fmt(x.carga) + ' kg × ' + x.reps; }
    return el('div', { class: 'tabela-rolagem' }, el('table', { class: 'tabela-evolucao tabela-dash' }, [
      el('thead', null, el('tr', null, ['Exercício', 'Primeiro', 'Último', 'Evolução', 'Vezes'].map(function (c) { return el('th', { text: c }); }))),
      el('tbody', null, linhas.map(function (l) {
        var semCarga = l.ultimo.x.semCarga, d = semCarga ? l.ultimo.x.reps - l.primeiro.x.reps : l.ultimo.x.carga - l.primeiro.x.carga;
        return el('tr', null, [
          el('td', null, [el('strong', { text: l.e.nome }), el('small', { class: 'dif', text: l.treino })]),
          el('td', { text: res(l.primeiro.x) }),
          el('td', { text: res(l.ultimo.x) }),
          el('td', { class: d > 0 ? 'positivo' : d < 0 ? 'negativo' : 'neutro', text: (d > 0 ? '+' : d < 0 ? '−' : '') + fmt(Math.abs(d)) + (semCarga ? ' reps' : ' kg') }),
          el('td', { text: String(l.vezes) })
        ]);
      }))
    ]));
  }

  function render(raiz) {
    var segs = semanas(SEMANAS), atual = segs[segs.length - 1], anterior = segs[segs.length - 2];
    var p = Patentes.calcular();
    var tAtual = treinosNaSemana(atual), tAnt = treinosNaSemana(anterior);
    var dAtual = dietaNaSemana(atual), dAnt = dietaNaSemana(anterior);
    var mAtual = metasNaSemana(atual), mAnt = metasNaSemana(anterior);
    var medidas = Dados.medidas().slice().reverse(); // da mais antiga para a mais recente
    var ultimaM = medidas[medidas.length - 1], primeiraM = medidas[0];

    raiz.appendChild(el('div', { class: 'pagina-topo' }, el('div', null, [
      el('h1', { class: 'pagina-titulo', text: 'Dashboard' }),
      el('div', { class: 'pagina-subtitulo', text: 'Semana de ' + UI.fmtDiaMes(atual) + ' a ' + UI.fmtDiaMes(UI.somarDias(atual, 6)) + ', comparada com as anteriores.' })
    ])));

    var vT = variacao(tAtual, tAnt, ''), vD = variacao(dAtual.pct, dAnt.pct, ' p.p.'), vM = variacao(mAtual.pct, mAnt.pct, ' p.p.');
    var detalheDieta = dAtual.total ? dAtual.dieta + ' de ' + dAtual.total + ' refeições' + (dAtual.faltam ? ' · ' + dAtual.faltam + ' sem registro' : '') + (vD.texto ? ' · ' + vD.texto : '') : 'sem plano';
    raiz.appendChild(el('div', { class: 'grade-kpi' }, [
      kpi('Patente', p.patente.nome, UI.fmtNum(p.xp) + ' XP' + (p.proxima ? ' · faltam ' + UI.fmtNum(p.falta) : '')),
      kpi('Treinos na semana', String(tAtual), vT.texto, vT.classe),
      kpi('Dieta na semana', dAtual.pct == null ? '—' : dAtual.pct + '%', detalheDieta, vD.classe),
      kpi('Metas recorrentes', mAtual.pct == null ? '—' : mAtual.pct + '%', mAtual.possiveis ? mAtual.feitas + ' de ' + mAtual.possiveis + (vM.texto ? ' · ' + vM.texto : '') : 'nenhuma meta', vM.classe),
      kpi('Peso', ultimaM && ultimaM.peso != null ? fmt(ultimaM.peso) + ' kg' : '—',
        ultimaM && primeiraM && ultimaM !== primeiraM && ultimaM.peso != null && primeiraM.peso != null ? (ultimaM.peso - primeiraM.peso >= 0 ? '+' : '−') + fmt(Math.abs(ultimaM.peso - primeiraM.peso)) + ' kg desde ' + UI.fmtDiaMes(primeiraM.data) : (ultimaM ? 'ponto de partida' : 'registre no domingo'))
    ]));

    var dadosTreino = segs.map(function (s) { var n = treinosNaSemana(s), m = minutosNaSemana(s); return { rotulo: rotuloSemana(s), valor: n, dica: 'Semana de ' + UI.fmtDiaMes(s) + ': ' + n + (n === 1 ? ' treino' : ' treinos') + (m ? ' · ' + m + ' min' : '') }; });
    var dadosDieta = segs.map(function (s) { var d = dietaNaSemana(s); return { rotulo: rotuloSemana(s), valor: d.pct, dica: 'Semana de ' + UI.fmtDiaMes(s) + ': ' + (d.pct == null ? 'sem dados' : d.pct + '% na dieta (' + d.dieta + '/' + d.total + ', ' + d.faltam + ' sem registro)') }; });
    var dadosMetas = segs.map(function (s) { var m = metasNaSemana(s); return { rotulo: rotuloSemana(s), valor: m.pct, dica: 'Semana de ' + UI.fmtDiaMes(s) + ': ' + (m.pct == null ? 'sem metas' : m.pct + '% (' + m.feitas + '/' + m.possiveis + ')') }; });
    var maxTreino = Math.max(5, Math.max.apply(null, dadosTreino.map(function (d) { return d.valor; })));

    raiz.appendChild(el('div', { class: 'grade-graficos-dash' }, [
      cartaoGrafico('Treinos por semana', 'Treinos finalizados, de segunda a domingo', barras(dadosTreino, maxTreino, '', 'cor-treino'),
        tabelaSimples(['Semana', 'Treinos', 'Minutos'], segs.slice().reverse().map(function (s) { return [UI.fmtDiaMes(s), String(treinosNaSemana(s)), String(minutosNaSemana(s))]; }))),
      cartaoGrafico('Dieta seguida', '% das refeições do plano feitas na dieta', barras(dadosDieta, 100, '%', 'cor-dieta'),
        tabelaSimples(['Semana', 'Na dieta', 'Trocadas', 'Sem registro', '%'], segs.slice().reverse().map(function (s) { var d = dietaNaSemana(s); return [UI.fmtDiaMes(s), String(d.dieta), String(d.outro), String(d.faltam), d.pct == null ? '—' : d.pct + '%']; }))),
      cartaoGrafico('Metas recorrentes cumpridas', 'Metas diárias e semanais', barras(dadosMetas, 100, '%', 'cor-metas'),
        tabelaSimples(['Semana', 'Cumpridas', 'Possíveis', '%'], segs.slice().reverse().map(function (s) { var m = metasNaSemana(s); return [UI.fmtDiaMes(s), String(m.feitas), String(m.possiveis), m.pct == null ? '—' : m.pct + '%']; })))
    ]));

    // Evolução do corpo: um gráfico por medida (escalas diferentes não dividem eixo).
    raiz.appendChild(el('h2', { class: 'secao-titulo titulo-manual', text: 'Evolução do corpo' }));
    raiz.appendChild(el('div', { class: 'grade-graficos-dash' }, Dieta.MEDIDAS.map(function (x) {
      var pts = medidas.filter(function (m) { return m[x[0]] != null; }).map(function (m) { return { data: m.data, valor: m[x[0]] }; });
      var ult = pts[pts.length - 1], pri = pts[0];
      var sub = ult ? fmt(ult.valor) + ' ' + x[2] + (pts.length > 1 ? ' · ' + (ult.valor - pri.valor >= 0 ? '+' : '−') + fmt(Math.abs(ult.valor - pri.valor)) + ' ' + x[2] + ' desde ' + UI.fmtDiaMes(pri.data) : '') : 'sem registros';
      return cartaoGrafico(x[1], sub, linha(pts, x[2]), tabelaSimples(['Data', x[1] + ' (' + x[2] + ')'], pts.slice().reverse().map(function (q) { return [UI.fmtData(q.data), fmt(q.valor)]; })));
    })));
    raiz.appendChild(el('div', { class: 'pagina-acoes acoes-plano' }, el('a', { class: 'btn btn-secundario', href: '#/dieta/evolucao', text: 'Ver fotos e todos os registros' })));

    raiz.appendChild(el('section', { class: 'painel' }, [el('h2', { class: 'secao-titulo', text: 'Evolução nos exercícios' }), progressoExercicios()]));

    // Metas de longo prazo.
    var metas = Dados.db.metas, feitas = metas.filter(function (m) { return m.concluida; }), abertas = metas.filter(function (m) { return !m.concluida; })
      .sort(function (a, b) { return (a.prazo || '9999') < (b.prazo || '9999') ? -1 : 1; });
    raiz.appendChild(el('section', { class: 'painel' }, [
      el('div', { class: 'painel-lado-topo' }, [el('h2', { class: 'secao-titulo', text: 'Metas de longo prazo' }), el('a', { class: 'link', href: '#/metas', text: 'Ver metas' })]),
      el('div', { class: 'placar-dieta' }, [el('span', { class: 'positivo', text: feitas.length + ' concluídas' }), el('span', { class: 'neutro', text: abertas.length + ' em aberto' })]),
      abertas.length ? el('div', { class: 'lista-feitos' }, abertas.slice(0, 5).map(function (m) {
        var atrasada = m.prazo && m.prazo < UI.hoje();
        return el('div', { class: 'feito-linha' }, [el('span', { text: m.titulo }), el('strong', { class: atrasada ? 'negativo' : 'neutro', text: m.prazo ? (atrasada ? 'venceu ' : 'até ') + UI.fmtData(m.prazo) : 'sem prazo' })]);
      })) : null
    ]));
  }

  return { render: render };
})();
