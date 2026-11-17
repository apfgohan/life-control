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

  // XP de cada mês vezes o multiplicador do índice daquele mês (% de metas batidas). O mês corrente usa o índice de agora.
  function calcular() {
    var db = Dados.db, r = { xp: 0, fontes: { metas: 0, lembretes: 0, habitos: 0, treinos: 0, dieta: 0, bonus: 0 }, qtd: { metas: 0, lembretes: 0, habitos: 0, treinos: 0, dieta: 0, perdidas: 0 }, xpHoje: 0, meses: [] }, hoje = UI.hoje();
    var porMes = {};
    function somar(mapa) { Object.keys(mapa).forEach(function (k) { porMes[k] = (porMes[k] || 0) + mapa[k]; }); }
    function noMes(iso, v) { if (iso) porMes[iso.slice(0, 7)] = (porMes[iso.slice(0, 7)] || 0) + v; }
    db.metas.forEach(function (m) {
      if (!m.concluida || Dados.antesDoInicio(m.dataConclusao || hoje)) return;
      var x = Dados.xpDaMeta(m);
      r.fontes.metas += x; r.qtd.metas++; noMes(m.dataConclusao || hoje, x);
      if (m.dataConclusao === hoje) r.xpHoje += x;
    });
    db.lembretes.forEach(function (l) {
      if (!l.concluido || Dados.antesDoInicio(l.dataConclusao || hoje)) return;
      var x = xpDoLembrete(l);
      r.fontes.lembretes += x; r.qtd.lembretes++; noMes(l.dataConclusao || hoje, x);
      if (l.dataConclusao === hoje) r.xpHoje += x;
    });
    var h = Dados.xpDosHabitos(hoje);
    r.fontes.habitos = h.xp; r.qtd.habitos = h.cumpridas; r.xpHoje += h.hoje; somar(h.porMes);
    var t = Dados.xpDosTreinos(hoje);
    r.fontes.treinos = t.xp; r.qtd.treinos = t.feitos; r.xpHoje += t.hoje; somar(t.porMes);
    var di = Dados.xpDaDieta(hoje);
    r.fontes.dieta = di.xp; r.qtd.dieta = di.seguidas; r.qtd.perdidas = di.perdidas; r.xpHoje += di.hoje; somar(di.porMes);
    // O multiplicador só vale quando o mês termina (o mês corrente fica ×1 até lá), e só sobre saldo positivo
    // (um mês negativo pela dieta não fica ainda pior com o bônus).
    var base = 0, total = 0, mesAtual = hoje.slice(0, 7);
    Object.keys(porMes).sort().forEach(function (k) {
      var v = porMes[k], s = Dados.resumoDoMes(k, hoje), fechado = k < mesAtual, mult = fechado && v > 0 ? s.multiplicador : 1;
      base += v; total += v * mult;
      r.meses.push({ mes: k, xp: v, multiplicador: mult, faixa: s.faixa, resumo: s, fechado: fechado, final: Math.round(v * mult) });
    });
    r.mesAtual = Dados.resumoDoMes(mesAtual, hoje);
    r.fontes.bonus = Math.round(total - base);
    // Os pontos perdidos na dieta podem levar o total abaixo de zero; a patente mínima continua sendo a primeira.
    r.xp = Math.max(0, Math.round(total));
    var i = 0;
    while (i + 1 < LISTA.length && r.xp >= LISTA[i + 1].xp) i++;
    r.indice = i;
    r.patente = LISTA[i];
    r.proxima = LISTA[i + 1] || null;
    r.falta = r.proxima ? r.proxima.xp - r.xp : 0;
    r.pct = r.proxima ? (r.xp - r.patente.xp) / (r.proxima.xp - r.patente.xp) * 100 : 100;
    return r;
  }

  // ---------- Insígnia: o retrato do personagem da patente (js/retratos.js) ----------
  function insignia(indice, classe) {
    var p = LISTA[indice] || LISTA[0];
    return el('span', { class: 'insignia grupo-' + p.grupo + ' ' + (classe || ''), title: p.nome, role: 'img', 'aria-label': p.nome, html: Retratos.svg(p.indice) });
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
        UI.metrica('Índice dos meses', (r.fontes.bonus >= 0 ? '+' : '−') + UI.fmtNum(Math.abs(r.fontes.bonus)) + ' XP', r.fontes.bonus < 0 ? 'alerta' : r.fontes.bonus > 0 ? 'completo' : ''),
        UI.metrica('Hoje', '+' + UI.fmtNum(r.xpHoje) + ' XP', r.xpHoje ? 'completo' : '')
      ]),
      el('div', { class: 'campo-ajuda', text: 'Metas rendem ' + Dados.DIFICULDADES.map(function (d) { return d[2] + ' (' + d[1].toLowerCase() + ')'; }).join(', ') + ' XP. Cada treino finalizado rende ' + Dados.XP_TREINO.base + ' XP + ' + Dados.XP_TREINO.exercicio + ' por exercício feito. Na dieta, cada refeição seguida rende ' + Dados.XP_DIETA.refeicao + ' XP, cada refeição não registrada tira ' + (-Dados.XP_DIETA.perdida) + ' e o registro de domingo rende ' + Dados.XP_DIETA.medidas + '. Metas recorrentes cumpridas: ' + Dados.XP_PERIODO.dia + ' XP por dia, ' + Dados.XP_PERIODO.semana + ' por semana e ' + Dados.XP_PERIODO.mes + ' por mês, vezes 1, 1,5 ou 2 conforme a dificuldade. Lembretes concluídos rendem 5, 10 ou 20 XP conforme a relevância. Quando o mês termina, o XP dele é multiplicado pelo índice do mês (% das metas batidas): ' + Dados.FAIXAS_MES.map(function (f) { return f.nome + (f.min ? ' (' + f.min + '%)' : ' (abaixo disso)') + ' ×' + String(f.mult).replace('.', ','); }).join(', ') + '.' }),
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

  // ---------- Fechamento do mês ----------
  // Na primeira abertura depois da virada do mês, mostra o índice do mês que terminou e o bônus (ou a perda) de XP.
  var CHAVE_MES = 'life-control.mes-visto';
  var MENSAGENS = {
    lendario: ['Mês lendário!', 'Você bateu todas as metas do mês. Os bardos vão cantar sobre isso: seus pontos dobraram.'],
    heroico: ['Mês heroico!', 'Quase tudo cumprido. Um feito digno de um herói: seus pontos cresceram 50%.'],
    valoroso: ['Mês valoroso!', 'Mostrou valor em batalha. Seus pontos cresceram 25%.'],
    bronze: ['Mês de bronze', 'Firme, mas sem bônus. Mais um pouco de disciplina e o próximo mês rende pontos extras.'],
    ferro: ['Mês de ferro', 'Você segurou a linha, sem bônus e sem perdas. No próximo mês, mire no Valoroso.'],
    derrotado: ['Derrota neste mês', 'As metas venceram desta vez e o mês custou 10% dos pontos. Levante o escudo: um novo mês começa hoje.']
  };
  function conferirFechamento() {
    var hoje = UI.hoje(), mesAtual = hoje.slice(0, 7), visto = null;
    try { visto = localStorage.getItem(CHAVE_MES); } catch (e) { return false; }
    function guardar() { try { localStorage.setItem(CHAVE_MES, mesAtual); } catch (e) { /* preferência */ } }
    if (!visto) { guardar(); return false; }
    if (visto >= mesAtual) return false;
    if (document.querySelector('.modal-fundo')) return false; // tenta de novo na próxima tela
    guardar();
    // O mês que acabou de fechar (o anterior ao atual).
    var anterior = UI.somarMeses(mesAtual, -1), r = calcular();
    var m = r.meses.filter(function (x) { return x.mes === anterior; })[0], s = m ? m.resumo : Dados.resumoDoMes(anterior, hoje);
    if (!s.faixa) return false; // mês sem metas decididas: nada para mostrar
    var bonus = m ? m.final - m.xp : 0, msg = MENSAGENS[s.faixa.id] || ['Fim do mês', ''];
    var nome = UI.nomeMes(anterior).split(' ')[0];
    UI.modal('Fechamento de ' + nome.toLowerCase(), el('div', { class: 'promocao fechamento faixa-' + s.faixa.id }, [
      el('span', { class: 'mes-escudo grande' }, UI.icone('escudo')),
      el('div', { class: 'patente-nome', text: s.faixa.nome + ' · ×' + String(s.faixa.mult).replace('.', ',') }),
      el('div', { class: 'promocao-texto', text: msg[0] }),
      el('p', { class: 'modal-desc', text: msg[1] }),
      el('div', { class: 'registro-resumo' }, [
        UI.metrica('Metas batidas', s.batidas + ' de ' + (s.batidas + s.falharam) + ' (' + Math.floor(s.pct) + '%)'),
        UI.metrica('XP do mês', UI.fmtNum(m ? m.xp : 0)),
        UI.metrica(bonus >= 0 ? 'Bônus' : 'Perda', (bonus > 0 ? '+' : bonus < 0 ? '−' : '') + UI.fmtNum(Math.abs(bonus)) + ' XP', bonus > 0 ? 'completo' : bonus < 0 ? 'alerta' : '')
      ])
    ]), [{ texto: 'Começar ' + UI.nomeMes(mesAtual).split(' ')[0].toLowerCase(), classe: 'btn-primario' }]);
    return true;
  }

  return { LISTA: LISTA, calcular: calcular, insignia: insignia, abrir: abrir, conferirPromocao: conferirPromocao, conferirFechamento: conferirFechamento, xpDoLembrete: xpDoLembrete };
})();
