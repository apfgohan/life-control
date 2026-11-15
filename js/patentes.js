// Patentes e XP (tema: cavaleiros medievais). Nada disso é gravado: o resultado é recalculado a partir
// das metas e dos lembretes concluídos. Assim, reabrir ou excluir algo corrige tudo, em qualquer aparelho.
var Patentes = (function () {
  var el = UI.el;

  // [nome, XP mínimo, grupo (define a cor do escudo), descrição]
  var LISTA = [
    ['Aldeão', 0, 'povo', 'Todo cavaleiro começa de algum lugar.'],
    ['Pajem', 200, 'povo', 'Aprendendo os costumes do castelo.'],
    ['Escudeiro', 600, 'povo', 'Carrega o escudo e treina todos os dias.'],
    ['Homem de Armas', 1200, 'armas', 'Já luta nas fileiras.'],
    ['Sargento', 2000, 'armas', 'Lidera pelo exemplo.'],
    ['Cavaleiro', 3200, 'cavalaria', 'Sagrado cavaleiro: disciplina virou hábito.'],
    ['Cavaleiro Bannerete', 5000, 'cavalaria', 'Leva o próprio estandarte ao campo.'],
    ['Barão', 7500, 'nobreza', 'Senhor das próprias terras.'],
    ['Visconde', 10500, 'nobreza', 'Administra com mão firme.'],
    ['Conde', 14500, 'nobreza', 'Sua palavra pesa no conselho.'],
    ['Marquês', 19500, 'nobreza', 'Guarda as fronteiras do reino.'],
    ['Duque', 26000, 'realeza', 'Abaixo apenas da coroa.'],
    ['Príncipe', 34000, 'realeza', 'Herdeiro do trono.'],
    ['Rei', 45000, 'realeza', 'Soberano da própria vida.']
  ].map(function (p, i) { return { indice: i, nome: p[0], xp: p[1], grupo: p[2], descricao: p[3] }; });

  var XP_LEMBRETE = { alta: 20, media: 10, baixa: 5 };
  var CHAVE_VISTA = 'life-control.patente-vista';

  function xpDoLembrete(l) { return XP_LEMBRETE[l.relevancia] || 10; }

  function calcular() {
    var db = Dados.db, r = { xp: 0, fontes: { metas: 0, lembretes: 0, habitos: 0, treinos: 0, dieta: 0 }, qtd: { metas: 0, lembretes: 0, habitos: 0, treinos: 0, dieta: 0, perdidas: 0 }, xpHoje: 0 }, hoje = UI.hoje();
    db.metas.forEach(function (m) {
      if (!m.concluida) return;
      var x = Dados.xpDaMeta(m);
      r.fontes.metas += x; r.qtd.metas++;
      if (m.dataConclusao === hoje) r.xpHoje += x;
    });
    db.lembretes.forEach(function (l) {
      if (!l.concluido) return;
      var x = xpDoLembrete(l);
      r.fontes.lembretes += x; r.qtd.lembretes++;
      if (l.dataConclusao === hoje) r.xpHoje += x;
    });
    var h = Dados.xpDosHabitos(hoje);
    r.fontes.habitos = h.xp; r.qtd.habitos = h.cumpridas; r.xpHoje += h.hoje;
    var t = Dados.xpDosTreinos(hoje);
    r.fontes.treinos = t.xp; r.qtd.treinos = t.feitos; r.xpHoje += t.hoje;
    var di = Dados.xpDaDieta(hoje);
    r.fontes.dieta = di.xp; r.qtd.dieta = di.seguidas; r.qtd.perdidas = di.perdidas; r.xpHoje += di.hoje;
    // Os pontos perdidos na dieta podem levar o total abaixo de zero; a patente mínima continua sendo a primeira.
    r.xp = Math.max(0, r.fontes.metas + r.fontes.lembretes + r.fontes.habitos + r.fontes.treinos + r.fontes.dieta);
    var i = 0;
    while (i + 1 < LISTA.length && r.xp >= LISTA[i + 1].xp) i++;
    r.indice = i;
    r.patente = LISTA[i];
    r.proxima = LISTA[i + 1] || null;
    r.falta = r.proxima ? r.proxima.xp - r.xp : 0;
    r.pct = r.proxima ? (r.xp - r.patente.xp) / (r.proxima.xp - r.patente.xp) * 100 : 100;
    return r;
  }

  // ---------- Insígnia: escudo com a cor do grupo e marcas que aumentam dentro do grupo ----------
  var CORES = {
    povo: ['#8b6f4e', '#c9a77c'], armas: ['#6f7b91', '#c3cbdb'], cavalaria: ['#2a74d6', '#9cc8ff'],
    nobreza: ['#7a4fd0', '#d3bcff'], realeza: ['#c9941f', '#ffe08a']
  };
  function insignia(indice, classe) {
    var p = LISTA[indice] || LISTA[0], cor = CORES[p.grupo];
    var posicao = LISTA.slice(0, indice).filter(function (x) { return x.grupo === p.grupo; }).length; // 0, 1, 2… dentro do grupo
    var marcas = '';
    for (var i = 0; i <= posicao && i < 4; i++) {
      var y = 21 - i * 4.2;
      marcas += '<polyline points="10.5 ' + y + ' 16 ' + (y - 3.2) + ' 21.5 ' + y + '" fill="none" stroke="' + cor[1] + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>';
    }
    var coroa = p.grupo === 'nobreza' || p.grupo === 'realeza'
      ? '<path d="M10.5 6.8l2.2 1.9 3.3-3.4 3.3 3.4 2.2-1.9-.8 4.4h-9.4z" fill="' + cor[1] + '"/>' : '';
    var estrela = p.grupo === 'cavalaria' ? '<circle cx="16" cy="8.2" r="1.7" fill="' + cor[1] + '"/>' : '';
    var svg = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2.5l11 4v8.6c0 6.6-4.5 11.6-11 14.4C9.5 26.700 5 21.700 5 15.100V6.500z" fill="' + cor[0] + '" stroke="' + cor[1] + '" stroke-width="1.6" stroke-linejoin="round"/>' + coroa + estrela + marcas + '</svg>';
    return el('span', { class: 'insignia grupo-' + p.grupo + ' ' + (classe || ''), title: p.nome, html: svg });
  }

  // ---------- Tela "Minha patente" ----------
  function abrir() {
    var r = calcular();
    UI.modal('Minha patente', [
      el('div', { class: 'patente-atual' }, [
        insignia(r.indice, 'grande'),
        el('div', { class: 'patente-atual-texto' }, [
          el('div', { class: 'patente-nome', text: r.patente.nome }),
          el('div', { class: 'modal-desc', text: r.patente.descricao }),
          UI.barra(r.pct),
          el('div', { class: 'campo-ajuda', text: UI.fmtNum(r.xp) + ' XP' + (r.proxima ? ' · faltam ' + UI.fmtNum(r.falta) + ' para ' + r.proxima.nome : ' · patente máxima') })
        ])
      ]),
      el('div', { class: 'patente-fontes' }, [
        UI.metrica('Metas concluídas', r.qtd.metas + ' · ' + UI.fmtNum(r.fontes.metas) + ' XP'),
        UI.metrica('Treinos feitos', r.qtd.treinos + ' · ' + UI.fmtNum(r.fontes.treinos) + ' XP'),
        UI.metrica('Dieta', r.qtd.dieta + ' refeições' + (r.qtd.perdidas ? ', ' + r.qtd.perdidas + ' perdidas' : '') + ' · ' + UI.fmtNum(r.fontes.dieta) + ' XP', r.fontes.dieta < 0 ? 'alerta' : ''),
        UI.metrica('Metas recorrentes', r.qtd.habitos + ' · ' + UI.fmtNum(r.fontes.habitos) + ' XP'),
        UI.metrica('Lembretes concluídos', r.qtd.lembretes + ' · ' + UI.fmtNum(r.fontes.lembretes) + ' XP'),
        UI.metrica('Hoje', '+' + UI.fmtNum(r.xpHoje) + ' XP', r.xpHoje ? 'completo' : '')
      ]),
      el('div', { class: 'campo-ajuda', text: 'Metas rendem ' + Dados.DIFICULDADES.map(function (d) { return d[2] + ' (' + d[1].toLowerCase() + ')'; }).join(', ') + ' XP. Cada treino finalizado rende ' + Dados.XP_TREINO.base + ' XP + ' + Dados.XP_TREINO.exercicio + ' por exercício feito. Na dieta, cada refeição seguida rende ' + Dados.XP_DIETA.refeicao + ' XP, cada refeição não registrada tira ' + (-Dados.XP_DIETA.perdida) + ' e o registro de domingo rende ' + Dados.XP_DIETA.medidas + '. Cada meta diária cumprida rende ' + Dados.XP_HABITO.dia + ' XP; bater a meta da semana, ' + Dados.XP_HABITO.semana + '; a do mês, ' + Dados.XP_HABITO.mes + '. Lembretes concluídos rendem 5, 10 ou 20 XP conforme a relevância.' }),
      el('div', { class: 'escada' }, LISTA.map(function (p) {
        return el('div', { class: 'degrau' + (p.indice === r.indice ? ' atual' : p.indice < r.indice ? ' passado' : '') }, [
          insignia(p.indice, 'media'),
          el('span', { class: 'degrau-nome', text: p.nome }),
          el('span', { class: 'degrau-xp', text: UI.fmtNum(p.xp) + ' XP' })
        ]);
      }))
    ], [{ texto: 'Ver metas', classe: 'btn-secundario', acao: function () { location.hash = '#/metas'; } }, { texto: 'Fechar', classe: 'btn-primario' }]);
  }

  // Mostra o aviso de promoção quando a patente sobe (a última vista fica guardada neste aparelho).
  function conferirPromocao() {
    var r = calcular(), vista = null;
    try { vista = localStorage.getItem(CHAVE_VISTA); } catch (e) { return; }
    function guardar() { try { localStorage.setItem(CHAVE_VISTA, String(r.indice)); } catch (e) { /* preferência */ } }
    if (vista == null) { guardar(); return; }
    if (r.indice === Number(vista)) return;
    var subiu = r.indice > Number(vista);
    guardar();
    if (!subiu || document.querySelector('.modal-fundo')) return;
    UI.modal('Promoção!', el('div', { class: 'promocao' }, [
      insignia(r.indice, 'enorme'),
      el('div', { class: 'promocao-texto', text: 'Você agora é' }),
      el('div', { class: 'patente-nome', text: r.patente.nome }),
      el('div', { class: 'modal-desc', text: r.patente.descricao })
    ]), [{ texto: 'Continuar', classe: 'btn-primario' }]);
  }

  return { LISTA: LISTA, calcular: calcular, insignia: insignia, abrir: abrir, conferirPromocao: conferirPromocao, xpDoLembrete: xpDoLembrete };
})();
