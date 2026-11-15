// Camada de dados: tudo que o programa guarda passa por aqui.
// Os dados ficam no localStorage (cópia rápida), no arquivo da pasta de dados e na nuvem.
//
// O programa era também de controle financeiro. Esses campos (categorias, itens, lancamentos, formas, faturasPagas,
// missoes) não são mais usados, mas continuam guardados como estavam: nada é apagado dos dados antigos.
var Dados = (function () {
  var CHAVE = 'life-control';
  var VERSAO = 2;

  function vazio() {
    return {
      versao: VERSAO,
      app: 'life-control',
      perfil: { nome: '', foto: null },   // foto: imagem enviada, em data URL
      // Treinos cadastrados. Musculação: exercícios com séries em % da carga principal (a série de 100%).
      treinos: [],      // { id, nome, tipo: 'musculacao'|'corrida', ordem, arquivado, criadoEm,
                        //   exercicios: [{ id, nome, carga, descanso (min), obs, series: [{ rotulo, pct, reps }] }] }
      // Treinos feitos. fim null = treino em andamento (continua em qualquer aparelho).
      registros: [],    // { id, treinoId, nomeTreino, tipo, data, inicio, fim, exercicios: [{ exercicioId, nome, carga, reps, concluidoEm }],
                        //   corrida: { km }, obs }
      // Metas recorrentes. periodo 'dia': vale nos dias da semana de `dias` (0 = segunda … 6 = domingo);
      // 'semana' / 'mes': fazer `vezes` vezes no período. feitos: os dias em que foi cumprida.
      // treino: true = é marcada sozinha quando um treino é finalizado.
      habitos: [],      // { id, titulo, periodo, dias, vezes, desde, treino, feitos: { 'AAAA-MM-DD': 1 }, criadoEm }
      // tipo 'dia': data (+hora); 'prazo': de inicio até fim; 'aberto': até concluir.
      lembretes: [],    // { id, titulo, detalhe, tipo, data, hora, inicio, fim, relevancia, concluido, dataConclusao, criadoEm }
      metas: [],        // { id, area, titulo, descricao, dificuldade, prazo, concluida, dataConclusao, criadoEm }
      configurado: false // vira true quando o perfil é alterado (dados "não vazios" para a sincronização)
    };
  }

  // Áreas antigas das metas (do tempo do financeiro) passam para as novas.
  var AREA_ANTIGA = { financeiro: 'habitos', fisico: 'treino', geral: 'habitos' };

  // Completa o que faltar (dados antigos, importados ou vindos da nuvem).
  function normalizar(d) {
    var v = vazio();
    if (!d || typeof d !== 'object') return v;
    ['treinos', 'registros', 'lembretes', 'metas', 'habitos'].forEach(function (k) { if (!Array.isArray(d[k])) d[k] = []; });
    d.habitos.forEach(function (h) { if (!h.feitos || typeof h.feitos !== 'object') h.feitos = {}; if (!Array.isArray(h.dias)) h.dias = []; });
    d.treinos.forEach(function (t) {
      if (!Array.isArray(t.exercicios)) t.exercicios = [];
      t.exercicios.forEach(function (e) { if (!Array.isArray(e.series)) e.series = []; });
    });
    d.registros.forEach(function (r) { if (!Array.isArray(r.exercicios)) r.exercicios = []; });
    d.metas.forEach(function (m) { if (AREA_ANTIGA[m.area]) m.area = AREA_ANTIGA[m.area]; });
    if (!d.perfil || typeof d.perfil !== 'object') d.perfil = v.perfil;
    d.app = 'life-control';
    d.versao = VERSAO;
    return d;
  }
  // Para a pasta de dados, a nuvem e a importação: reconhece os dados deste programa (inclusive os antigos).
  function ehDoPrograma(d) { return !!(d && typeof d === 'object' && (d.app === 'life-control' || Array.isArray(d.lancamentos) || Array.isArray(d.treinos))); }

  function carregar() {
    try {
      var texto = localStorage.getItem(CHAVE);
      if (texto) return normalizar(JSON.parse(texto));
    } catch (e) { console.error('Falha ao carregar dados', e); }
    return vazio();
  }

  var db = carregar();

  // Salva no navegador (cópia rápida) e avisa a pasta de dados e a nuvem para gravarem também.
  function salvar() {
    db.atualizadoEm = Date.now();
    gravarNoNavegador();
    if (window.Armazenamento) Armazenamento.agendar();
    if (window.Nuvem) Nuvem.agendar();
  }
  function gravarNoNavegador() {
    try { localStorage.setItem(CHAVE, JSON.stringify(db)); } catch (e) {
      console.error('Falha ao salvar', e);
      if (window.UI) UI.aviso('Não foi possível salvar neste navegador (espaço cheio?).');
    }
  }
  function substituir(dados, origem) {
    db = normalizar(dados);
    gravarNoNavegador();
    if (origem !== 'arquivo' && window.Armazenamento) Armazenamento.agendar();
    if (origem !== 'nuvem' && window.Nuvem) Nuvem.agendar();
  }
  function exportar() { return JSON.stringify(db, null, 2); }
  function importar(texto) {
    var d = JSON.parse(texto);
    if (!ehDoPrograma(d)) throw new Error('Arquivo não parece ser um backup deste programa.');
    db = normalizar(d);
    salvar();
  }
  function limpar() { db = vazio(); salvar(); }
  // Sem nada guardado (para a sincronização: dados vazios nunca vencem dados preenchidos).
  // Conta também os lançamentos antigos do financeiro, para dados antigos nunca serem tratados como vazios.
  function semDados(d) {
    d = d || db;
    if (!d) return true;
    return !d.configurado && !['treinos', 'registros', 'lembretes', 'metas', 'habitos', 'lancamentos'].some(function (k) { return Array.isArray(d[k]) && d[k].length; });
  }

  function novoId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function porOrdem(a, b) { return (a.ordem || 0) - (b.ordem || 0); }
  function proximaOrdem(lista) { return lista.reduce(function (m, x) { return Math.max(m, x.ordem || 0); }, 0) + 1; }
  function buscar(lista, id) {
    for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i];
    return null;
  }
  function texto(v) { return String(v == null ? '' : v).trim(); }
  function numero(v, min, max, padrao) {
    var n = typeof v === 'number' ? v : (window.UI ? UI.lerValor(v) : parseFloat(v));
    if (!isFinite(n)) return padrao;
    return Math.max(min, Math.min(max, n));
  }
  function diasNoMes(mes) { var p = mes.split('-'); return new Date(Number(p[0]), Number(p[1]), 0).getDate(); }

  // ---------- Perfil ----------
  function atualizarPerfil(campos) {
    if (campos.nome != null) db.perfil.nome = texto(campos.nome);
    if (campos.foto !== undefined) db.perfil.foto = campos.foto || null;
    db.configurado = true;
    salvar();
  }

  // ---------- Treinos (cadastro) ----------
  var TIPOS_TREINO = [['musculacao', 'Musculação'], ['corrida', 'Corrida']];
  var ROTULOS_SERIE = [['aquecimento', 'Aquecimento'], ['normal', 'Série'], ['falha', 'Até a falha']];
  // Três séries padrão: aquecimento a 50%, 75% e a principal (100%) até a falha.
  var SERIES_PADRAO = [{ rotulo: 'aquecimento', pct: 50, reps: '' }, { rotulo: 'normal', pct: 75, reps: '' }, { rotulo: 'falha', pct: 100, reps: '' }];

  function treino(id) { return buscar(db.treinos, id); }
  function treinos(comArquivados) { return db.treinos.filter(function (t) { return comArquivados || !t.arquivado; }).sort(porOrdem); }
  function salvarTreino(campos, id) {
    var t = id ? treino(id) : null;
    if (!t) { t = { id: novoId(), ordem: proximaOrdem(db.treinos), arquivado: false, exercicios: [], criadoEm: Date.now() }; db.treinos.push(t); }
    t.nome = texto(campos.nome) || 'Treino';
    if (campos.tipo) t.tipo = campos.tipo === 'corrida' ? 'corrida' : 'musculacao';
    if (!t.tipo) t.tipo = 'musculacao';
    salvar();
    return t;
  }
  // Treino que já foi feito é arquivado (some das listas, o histórico continua); nunca feito, é excluído.
  function excluirTreino(id) {
    var feito = db.registros.some(function (r) { return r.treinoId === id; });
    if (feito) treino(id).arquivado = true; else db.treinos = db.treinos.filter(function (t) { return t.id !== id; });
    salvar();
    return feito ? 'arquivado' : 'excluido';
  }
  // Troca a posição de um item com o vizinho (delta -1 = sobe, +1 = desce) numa lista com `ordem`.
  function mover(lista, item, delta) {
    var ordenada = lista.slice().sort(porOrdem), i = ordenada.indexOf(item), j = i + delta;
    if (i < 0 || j < 0 || j >= ordenada.length) return;
    ordenada.splice(i, 1);
    ordenada.splice(j, 0, item);
    ordenada.forEach(function (x, k) { x.ordem = k + 1; });
  }
  function moverTreino(id, delta) { mover(treinos(), treino(id), delta); salvar(); }

  function exercicio(treinoId, exId) { var t = treino(treinoId); return t ? buscar(t.exercicios, exId) : null; }
  function exercicios(treinoId) { var t = treino(treinoId); return t ? t.exercicios.slice().sort(porOrdem) : []; }
  function salvarExercicio(treinoId, campos, exId) {
    var t = treino(treinoId), e = exId ? buscar(t.exercicios, exId) : null;
    if (!e) { e = { id: novoId(), ordem: proximaOrdem(t.exercicios) }; t.exercicios.push(e); }
    e.nome = texto(campos.nome) || 'Exercício';
    e.carga = numero(campos.carga, 0, 1000, 0);
    e.descanso = numero(campos.descanso, 0, 30, 0);
    e.obs = texto(campos.obs);
    var series = (campos.series || []).map(function (s) {
      return { rotulo: ROTULOS_SERIE.some(function (r) { return r[0] === s.rotulo; }) ? s.rotulo : 'normal', pct: numero(s.pct, 0, 200, 100), reps: texto(s.reps) };
    });
    e.series = series.length ? series : SERIES_PADRAO.map(function (s) { return Object.assign({}, s); });
    salvar();
    return e;
  }
  function excluirExercicio(treinoId, exId) {
    var t = treino(treinoId);
    t.exercicios = t.exercicios.filter(function (e) { return e.id !== exId; });
    salvar();
  }
  function moverExercicio(treinoId, exId, delta) { var t = treino(treinoId); mover(t.exercicios, buscar(t.exercicios, exId), delta); salvar(); }

  // Carga de uma série: % da carga principal, arredondada para múltiplos de 1 kg.
  function cargaDaSerie(carga, serie) { return Math.round((Number(carga) || 0) * (Number(serie.pct) || 0) / 100); }

  // ---------- Registro dos treinos ----------
  function registro(id) { return buscar(db.registros, id); }
  function treinoEmAndamento() { return db.registros.filter(function (r) { return !r.fim; })[0] || null; }
  // Treinos já finalizados, do mais recente para o mais antigo (opcional: só os de um treino).
  function historico(treinoId) {
    return db.registros.filter(function (r) { return r.fim && (!treinoId || r.treinoId === treinoId); })
      .sort(function (a, b) { return (b.inicio || 0) - (a.inicio || 0); });
  }
  function iniciarTreino(treinoId) {
    var atual = treinoEmAndamento();
    if (atual) return atual;
    var t = treino(treinoId);
    var r = { id: novoId(), treinoId: t.id, nomeTreino: t.nome, tipo: t.tipo, data: UI.hoje(), inicio: Date.now(), fim: null, exercicios: [], corrida: null, obs: '' };
    db.registros.push(r);
    salvar();
    return r;
  }
  function feitoNoRegistro(r, exId) { return r ? buscar(r.exercicios.map(function (x) { return Object.assign({ id: x.exercicioId }, x); }), exId) : null; }
  // Concluir um exercício: guarda carga e repetições da última série, e a carga vira a principal do próximo treino.
  function concluirExercicio(registroId, exId, carga, reps) {
    var r = registro(registroId), e = exercicio(r.treinoId, exId);
    var item = { exercicioId: exId, nome: e ? e.nome : '', carga: numero(carga, 0, 1000, 0), reps: Math.round(numero(reps, 0, 999, 0)), concluidoEm: Date.now() };
    r.exercicios = r.exercicios.filter(function (x) { return x.exercicioId !== exId; }).concat([item]);
    if (e && item.carga > 0) e.carga = item.carga;
    salvar();
    return item;
  }
  function desfazerExercicio(registroId, exId) {
    var r = registro(registroId);
    r.exercicios = r.exercicios.filter(function (x) { return x.exercicioId !== exId; });
    salvar();
  }
  // Finaliza o treino e marca o dia nas metas recorrentes ligadas a treino. Devolve os nomes das metas marcadas.
  function finalizarTreino(registroId, extra) {
    var r = registro(registroId);
    extra = extra || {};
    r.fim = Date.now();
    if (extra.km != null && r.tipo === 'corrida') r.corrida = { km: numero(extra.km, 0, 500, 0) };
    if (extra.obs != null) r.obs = texto(extra.obs);
    var marcadas = [];
    db.habitos.forEach(function (h) {
      if (!h.treino || !habitoValeNoDia(h, r.data) || h.feitos[r.data]) return;
      h.feitos[r.data] = 1;
      marcadas.push(h.titulo);
    });
    salvar();
    return marcadas;
  }
  function cancelarTreino(registroId) { db.registros = db.registros.filter(function (r) { return r.id !== registroId; }); salvar(); }
  function excluirRegistro(id) { cancelarTreino(id); }
  function duracaoSeg(r) { return Math.max(0, Math.round(((r.fim || Date.now()) - (r.inicio || Date.now())) / 1000)); }
  // Último resultado de um exercício em treinos já finalizados: { carga, reps, data }.
  function ultimoResultado(exId) {
    var h = historico();
    for (var i = 0; i < h.length; i++) {
      var x = h[i].exercicios.filter(function (e) { return e.exercicioId === exId; })[0];
      if (x) return { carga: x.carga, reps: x.reps, data: h[i].data };
    }
    return null;
  }
  var XP_TREINO = { base: 50, exercicio: 10 };
  function xpDoRegistro(r) { return XP_TREINO.base + XP_TREINO.exercicio * r.exercicios.length; }
  function xpDosTreinos(hoje) {
    var r = { xp: 0, hoje: 0, feitos: 0 };
    historico().forEach(function (x) {
      var v = xpDoRegistro(x);
      r.xp += v; r.feitos++;
      if (x.data === hoje) r.hoje += v;
    });
    return r;
  }

  // ---------- Lembretes ----------
  var PESO = { alta: 0, media: 1, baixa: 2 };
  function lembrete(id) { return buscar(db.lembretes, id); }
  function salvarLembrete(campos, id) {
    var l = id ? lembrete(id) : null;
    if (!l) { l = { id: novoId(), criadoEm: Date.now(), concluido: false, dataConclusao: null }; db.lembretes.push(l); }
    l.titulo = texto(campos.titulo) || 'Lembrete';
    l.detalhe = texto(campos.detalhe);
    l.tipo = ['dia', 'prazo', 'aberto'].indexOf(campos.tipo) >= 0 ? campos.tipo : 'aberto';
    l.data = l.tipo === 'dia' ? campos.data || UI.hoje() : null;
    l.hora = l.tipo === 'dia' ? campos.hora || null : null;
    l.inicio = l.tipo === 'prazo' ? campos.inicio || UI.hoje() : null;
    l.fim = l.tipo === 'prazo' ? campos.fim || l.inicio : null;
    if (l.tipo === 'prazo' && l.fim < l.inicio) l.fim = l.inicio;
    l.relevancia = PESO[campos.relevancia] != null ? campos.relevancia : 'media';
    salvar();
    return l;
  }
  function concluirLembrete(id, feito) {
    var l = lembrete(id);
    if (!l) return;
    l.concluido = feito !== false;
    l.dataConclusao = l.concluido ? UI.hoje() : null;
    salvar();
  }
  function excluirLembrete(id) { db.lembretes = db.lembretes.filter(function (l) { return l.id !== id; }); salvar(); }
  // Data que vale para ordenar e para saber se está atrasado: o dia marcado ou o fim do prazo.
  function dataLimite(l) { return l.tipo === 'dia' ? l.data : l.tipo === 'prazo' ? l.fim : null; }
  // 'atrasado' | 'hoje' | 'ativo' (prazo correndo ou sem prazo) | 'futuro' | 'concluido'
  function situacaoLembrete(l, hoje) {
    hoje = hoje || UI.hoje();
    if (l.concluido) return 'concluido';
    if (l.tipo === 'aberto') return 'ativo';
    var limite = dataLimite(l);
    if (limite < hoje) return 'atrasado';
    if (limite === hoje) return 'hoje';
    if (l.tipo === 'prazo' && l.inicio <= hoje) return 'ativo';
    return 'futuro';
  }
  function ordemLembrete(a, b) {
    var p = PESO[a.relevancia] - PESO[b.relevancia];
    if (p) return p;
    var da = dataLimite(a) || '9999', dbb = dataLimite(b) || '9999';
    if (da !== dbb) return da < dbb ? -1 : 1;
    return (a.hora || '') < (b.hora || '') ? -1 : (a.hora || '') > (b.hora || '') ? 1 : (a.criadoEm || 0) - (b.criadoEm || 0);
  }
  // Pendentes que pedem atenção agora: atrasados, de hoje, prazos correndo e os sem prazo.
  function lembretesAtivos() {
    var hoje = UI.hoje();
    return db.lembretes.filter(function (l) { var s = situacaoLembrete(l, hoje); return s === 'atrasado' || s === 'hoje' || s === 'ativo'; }).sort(ordemLembrete);
  }

  // ---------- Metas de longo prazo ----------
  var AREAS = [['estudos', 'Estudos'], ['treino', 'Treino'], ['dieta', 'Dieta'], ['habitos', 'Hábitos']];
  var DIFICULDADES = [['facil', 'Fácil', 100], ['media', 'Média', 250], ['dificil', 'Difícil', 600], ['epica', 'Épica', 1500]];
  function meta(id) { return buscar(db.metas, id); }
  function salvarMeta(campos, id) {
    var m = id ? meta(id) : null;
    if (!m) { m = { id: novoId(), criadoEm: Date.now(), concluida: false, dataConclusao: null }; db.metas.push(m); }
    m.titulo = texto(campos.titulo) || 'Meta';
    m.descricao = texto(campos.descricao);
    m.area = AREAS.some(function (a) { return a[0] === campos.area; }) ? campos.area : 'habitos';
    m.dificuldade = DIFICULDADES.some(function (d) { return d[0] === campos.dificuldade; }) ? campos.dificuldade : 'media';
    m.prazo = campos.prazo || null;
    salvar();
    return m;
  }
  function concluirMeta(id, feita) {
    var m = meta(id);
    if (!m) return;
    m.concluida = feita !== false;
    m.dataConclusao = m.concluida ? UI.hoje() : null;
    salvar();
  }
  function excluirMeta(id) { db.metas = db.metas.filter(function (m) { return m.id !== id; }); salvar(); }
  function xpDaMeta(m) {
    var d = DIFICULDADES.filter(function (x) { return x[0] === m.dificuldade; })[0];
    return d ? d[2] : 250;
  }

  // ---------- Metas recorrentes (diárias, semanais e mensais) ----------
  var PERIODOS = [['dia', 'Diária'], ['semana', 'Semanal'], ['mes', 'Mensal']];
  var XP_HABITO = { dia: 10, semana: 50, mes: 150 }; // por dia cumprido / por semana ou mês em que o alvo foi atingido
  function habito(id) { return buscar(db.habitos, id); }
  function habitos() {
    var ordem = { dia: 0, semana: 1, mes: 2 };
    return db.habitos.slice().sort(function (a, b) { return ordem[a.periodo] - ordem[b.periodo] || (a.criadoEm || 0) - (b.criadoEm || 0); });
  }
  function salvarHabito(campos, id) {
    var h = id ? habito(id) : null;
    if (!h) { h = { id: novoId(), criadoEm: Date.now(), desde: UI.hoje(), feitos: {} }; db.habitos.push(h); }
    h.titulo = texto(campos.titulo) || 'Meta';
    h.periodo = PERIODOS.some(function (p) { return p[0] === campos.periodo; }) ? campos.periodo : 'dia';
    var dias = (campos.dias || []).map(Number).filter(function (d) { return d >= 0 && d <= 6; });
    h.dias = h.periodo === 'dia' ? (dias.length ? dias : [0, 1, 2, 3, 4, 5, 6]) : [];
    h.vezes = h.periodo === 'dia' ? 1 : Math.max(1, Math.min(h.periodo === 'semana' ? 7 : 31, Math.round(campos.vezes) || 1));
    if (campos.treino !== undefined) h.treino = !!campos.treino;
    salvar();
    return h;
  }
  function excluirHabito(id) { db.habitos = db.habitos.filter(function (h) { return h.id !== id; }); salvar(); }
  function marcarHabito(id, iso, feito) {
    var h = habito(id);
    if (!h) return;
    if (feito) h.feitos[iso] = 1; else delete h.feitos[iso];
    salvar();
  }
  function diaDaSemana(iso) { return (new Date(iso + 'T00:00:00').getDay() + 6) % 7; } // 0 = segunda
  // A meta diária vale nos dias da semana escolhidos; as semanais e mensais podem ser cumpridas em qualquer dia.
  function habitoValeNoDia(h, iso) { return h.periodo !== 'dia' || h.dias.indexOf(diaDaSemana(iso)) >= 0; }
  function periodoDoHabito(h, iso) {
    if (h.periodo === 'semana') { var ini = UI.somarDias(iso, -diaDaSemana(iso)); return { inicio: ini, fim: UI.somarDias(ini, 6) }; }
    if (h.periodo === 'mes') return { inicio: iso.slice(0, 7) + '-01', fim: iso.slice(0, 7) + '-' + UI.pad(diasNoMes(iso.slice(0, 7))) };
    return { inicio: iso, fim: iso };
  }
  // Quantas vezes foi cumprida no período (semana ou mês) que contém o dia, e o alvo.
  function progressoHabito(h, iso) {
    var p = periodoDoHabito(h, iso), n = 0;
    Object.keys(h.feitos).forEach(function (d) { if (d >= p.inicio && d <= p.fim) n++; });
    return { feitas: n, alvo: h.vezes || 1, completo: n >= (h.vezes || 1), periodo: p };
  }
  // Dias seguidos (entre os dias em que a meta vale) cumprindo a meta diária; hoje ainda em aberto não quebra a sequência.
  function sequenciaHabito(h) {
    var d = UI.hoje(), n = 0;
    for (var i = 0; i < 400; i++, d = UI.somarDias(d, -1)) {
      if (d < h.desde && !h.feitos[d]) break;
      if (!habitoValeNoDia(h, d)) continue;
      if (h.feitos[d]) n++; else if (i > 0) break;
    }
    return n;
  }
  // XP das metas recorrentes: cada dia cumprido (diárias) e cada semana ou mês em que o alvo foi atingido.
  function xpDosHabitos(hoje) {
    var r = { xp: 0, hoje: 0, cumpridas: 0 };
    db.habitos.forEach(function (h) {
      if (h.periodo === 'dia') {
        var n = Object.keys(h.feitos).length;
        r.xp += n * XP_HABITO.dia; r.cumpridas += n;
        if (h.feitos[hoje]) r.hoje += XP_HABITO.dia;
        return;
      }
      var grupos = {};
      Object.keys(h.feitos).forEach(function (d) { var k = periodoDoHabito(h, d).inicio; grupos[k] = (grupos[k] || 0) + 1; });
      Object.keys(grupos).forEach(function (k) {
        if (grupos[k] < (h.vezes || 1)) return;
        r.xp += XP_HABITO[h.periodo]; r.cumpridas++;
        if (k === periodoDoHabito(h, hoje).inicio && h.feitos[hoje] && grupos[k] === (h.vezes || 1)) r.hoje += XP_HABITO[h.periodo];
      });
    });
    return r;
  }

  return {
    get db() { return db; },
    salvar: salvar, substituir: substituir, exportar: exportar, importar: importar, limpar: limpar, semDados: semDados, ehDoPrograma: ehDoPrograma,
    atualizarPerfil: atualizarPerfil,
    TIPOS_TREINO: TIPOS_TREINO, ROTULOS_SERIE: ROTULOS_SERIE, SERIES_PADRAO: SERIES_PADRAO,
    treino: treino, treinos: treinos, salvarTreino: salvarTreino, excluirTreino: excluirTreino, moverTreino: moverTreino,
    exercicio: exercicio, exercicios: exercicios, salvarExercicio: salvarExercicio, excluirExercicio: excluirExercicio, moverExercicio: moverExercicio,
    cargaDaSerie: cargaDaSerie,
    registro: registro, treinoEmAndamento: treinoEmAndamento, historico: historico, iniciarTreino: iniciarTreino, feitoNoRegistro: feitoNoRegistro,
    concluirExercicio: concluirExercicio, desfazerExercicio: desfazerExercicio, finalizarTreino: finalizarTreino, cancelarTreino: cancelarTreino,
    excluirRegistro: excluirRegistro, duracaoSeg: duracaoSeg, ultimoResultado: ultimoResultado, XP_TREINO: XP_TREINO, xpDoRegistro: xpDoRegistro, xpDosTreinos: xpDosTreinos,
    lembrete: lembrete, salvarLembrete: salvarLembrete, concluirLembrete: concluirLembrete, excluirLembrete: excluirLembrete,
    dataLimite: dataLimite, situacaoLembrete: situacaoLembrete, lembretesAtivos: lembretesAtivos, ordemLembrete: ordemLembrete,
    AREAS: AREAS, DIFICULDADES: DIFICULDADES, meta: meta, salvarMeta: salvarMeta, concluirMeta: concluirMeta, excluirMeta: excluirMeta, xpDaMeta: xpDaMeta,
    PERIODOS: PERIODOS, XP_HABITO: XP_HABITO, habito: habito, habitos: habitos, salvarHabito: salvarHabito, excluirHabito: excluirHabito,
    marcarHabito: marcarHabito, habitoValeNoDia: habitoValeNoDia, progressoHabito: progressoHabito, sequenciaHabito: sequenciaHabito,
    xpDosHabitos: xpDosHabitos, diaDaSemana: diaDaSemana
  };
})();
