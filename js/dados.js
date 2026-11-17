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
      // Biblioteca de exercícios (Configurações), por grupamento. Os treinos usam exercícios daqui (baseId),
      // e o recorde pessoal (PR) de cada um é calculado de todos os treinos registrados.
      exercicios: [],   // { id, nome, grupo: 'bracos'|'torso'|'pernas', equipamento, obs, arquivado, criadoEm }
      treinos: [],      // { id, nome, tipo: 'musculacao'|'corrida', ordem, arquivado, criadoEm,
                        //   exercicios: [{ id, baseId, nome, equipamento: 'maquina'|'livre', carga, obs,
                        //                  series: [{ rotulo, pct, reps, descanso (segundos depois desta série) }] }] }
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
      // Plano alimentar: refeições com os alimentos (quantidade e substituição; comer a substituição também é seguir a dieta).
      // desde: a partir de quando as refeições não registradas tiram pontos. refeicao.desde: quando ela entrou no plano.
      // soTreino: a refeição só conta nos dias com treino (ex.: pós-treino). frutas: tabela de porções equivalentes.
      dieta: { desde: null, refeicoes: [], frutas: [], orientacoes: '' },
      // refeicoes: [{ id, nome, horario, ordem, desde, soTreino, obs, itens: [{ alimento, quantidade, substituicao }] }]
      // Registro das refeições por dia: 'AAAA-MM-DD' -> { refeicaoId: { tipo: 'dieta'|'outro', opcaoId, descricao, em } }
      alimentacao: {},
      // Registro semanal (domingo): peso em jejum e medidas em cm. As fotos ficam à parte (js/fotos.js), aqui só os ids.
      medidas: [],      // { id, data, peso, braco, coxa, panturrilha, obs, fotos: { frente, lateral, costas }, criadoEm }
      configurado: false // vira true quando o perfil é alterado (dados "não vazios" para a sincronização)
    };
  }

  var ROTULO_ANTIGO = { normal: 'preparacao', falha: 'valida' };
  // Áreas antigas das metas (do tempo do financeiro) passam para as novas.
  var AREA_ANTIGA = { financeiro: 'habitos', fisico: 'treino', geral: 'habitos' };

  // Completa o que faltar (dados antigos, importados ou vindos da nuvem).
  function normalizar(d) {
    var v = vazio();
    if (!d || typeof d !== 'object') return v;
    ['exercicios', 'treinos', 'registros', 'lembretes', 'metas', 'habitos', 'medidas'].forEach(function (k) { if (!Array.isArray(d[k])) d[k] = []; });
    if (!d.dieta || typeof d.dieta !== 'object') d.dieta = { desde: null, refeicoes: [] };
    if (!Array.isArray(d.dieta.refeicoes)) d.dieta.refeicoes = [];
    if (!Array.isArray(d.dieta.frutas)) d.dieta.frutas = [];
    if (typeof d.dieta.orientacoes !== 'string') d.dieta.orientacoes = '';
    d.dieta.refeicoes.forEach(function (r) { if (!Array.isArray(r.itens)) r.itens = []; });
    if (!d.alimentacao || typeof d.alimentacao !== 'object') d.alimentacao = {};
    d.medidas.forEach(function (m) { if (!m.fotos || typeof m.fotos !== 'object') m.fotos = {}; });
    d.habitos.forEach(normalizarHabito);
    d.treinos.forEach(function (t) {
      if (!Array.isArray(t.exercicios)) t.exercicios = [];
      t.exercicios.forEach(function (e) {
        if (!Array.isArray(e.series)) e.series = [];
        if (!e.equipamento) e.equipamento = 'livre';
        // Versão anterior: um descanso só por exercício (em minutos) e séries "normal" / "falha".
        var antigo = typeof e.descanso === 'number' ? Math.round(e.descanso * 60) : 0;
        e.series.forEach(function (s, i) {
          if (ROTULO_ANTIGO[s.rotulo]) s.rotulo = ROTULO_ANTIGO[s.rotulo];
          if (typeof s.descanso !== 'number') s.descanso = i < e.series.length - 1 ? antigo : 0;
        });
        delete e.descanso;
      });
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
  // Depois de carregar (ou trocar) os dados: monta a biblioteca de exercícios a partir dos treinos antigos
  // e recalcula as metas de recorde. A primeira chamada fica no fim do arquivo, quando as constantes já existem.
  function preparar() { migrarBiblioteca(); sincronizarMetasPR(); }

  // Salva no navegador (cópia rápida) e avisa a pasta de dados e a nuvem para gravarem também.
  function salvar() {
    db.atualizadoEm = Date.now();
    gravarNoNavegador();
    if (window.Armazenamento) Armazenamento.agendar();
    if (window.Nuvem) Nuvem.agendar();
  }
  function gravarNoNavegador() {
    cacheMes = {}; // os dados mudaram: o resumo dos meses é refeito
    try { localStorage.setItem(CHAVE, JSON.stringify(db)); } catch (e) {
      console.error('Falha ao salvar', e);
      if (window.UI) UI.aviso('Não foi possível salvar neste navegador (espaço cheio?).');
    }
  }
  function substituir(dados, origem) {
    db = normalizar(dados);
    preparar();
    gravarNoNavegador();
    if (origem !== 'arquivo' && window.Armazenamento) Armazenamento.agendar();
    if (origem !== 'nuvem' && window.Nuvem) Nuvem.agendar();
  }
  function exportar() { return JSON.stringify(db, null, 2); }
  function importar(texto) {
    var d = JSON.parse(texto);
    if (!ehDoPrograma(d)) throw new Error('Arquivo não parece ser um backup deste programa.');
    db = normalizar(d);
    preparar();
    salvar();
  }
  function limpar() { db = vazio(); salvar(); }
  // Sem nada guardado (para a sincronização: dados vazios nunca vencem dados preenchidos).
  // Conta também os lançamentos antigos do financeiro, para dados antigos nunca serem tratados como vazios.
  function semDados(d) {
    d = d || db;
    if (!d) return true;
    return !d.configurado && !['exercicios', 'treinos', 'registros', 'lembretes', 'metas', 'habitos', 'medidas', 'lancamentos'].some(function (k) { return Array.isArray(d[k]) && d[k].length; })
      && !(d.dieta && Array.isArray(d.dieta.refeicoes) && d.dieta.refeicoes.length);
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
  function somarMes(mapa, iso, v) { if (!iso) return; var k = iso.slice(0, 7); mapa[k] = (mapa[k] || 0) + v; }
  function diasNoMes(mes) { var p = mes.split('-'); return new Date(Number(p[0]), Number(p[1]), 0).getDate(); }

  // ---------- Perfil ----------
  // Início do projeto (quando a rotina começou a valer); muda em Configurações.
  var INICIO_PADRAO = '2026-11-16';
  function inicioProjeto() { return db.perfil.inicio || INICIO_PADRAO; }
  // Dia do projeto: 1 no dia do início. Antes dele, negativo/zero (quantos dias faltam).
  function diaDoProjeto(hoje) { return UI.diasEntre(inicioProjeto(), hoje || UI.hoje()) + 1; }
  // Nada antes do início do projeto conta: nem XP, nem metas cumpridas ou falhadas.
  function antesDoInicio(iso) { return !iso || iso < inicioProjeto(); }
  function maior(a, b) { return a > b ? a : b; }
  function atualizarPerfil(campos) {
    if (campos.inicio !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(campos.inicio || '')) db.perfil.inicio = campos.inicio;
    if (campos.nome != null) db.perfil.nome = texto(campos.nome);
    if (campos.foto !== undefined) db.perfil.foto = campos.foto || null;
    db.configurado = true;
    salvar();
  }

  // ---------- Treinos (cadastro) ----------
  // tcat: Treinamento de Tiro Continuado (obrigatório no serviço). Só marca que houve treino no dia.
  var TIPOS_TREINO = [['musculacao', 'Musculação'], ['corrida', 'Corrida'], ['tcat', 'TCAT (Tiro Continuado)']];
  var ROTULOS_SERIE = [['aquecimento', 'Aquecimento'], ['preparacao', 'Preparação'], ['valida', 'Válida']];
  var EQUIPAMENTOS = [['livre', 'Peso livre'], ['maquina', 'Máquina'], ['corpo', 'Peso do corpo']]; // corpo: sem carga, só repetições
  var PASSO_MAQUINA = 5; // nas máquinas o peso sobe de 5 em 5 kg
  // Padrão de cada tipo de série: % da carga, repetições e descanso depois dela. Ajustável em Configurações
  // (fica em db.padroesSerie); vale para exercícios novos, para "Usar padrão" e ao trocar o tipo de uma série.
  var PADRAO_SERIE = {
    aquecimento: { pct: 50, reps: '10', descanso: 60 },
    preparacao: { pct: 75, reps: '5', descanso: 90 },
    valida: { pct: 100, reps: '5-9', descanso: 120 }
  };
  function padraoSerie(rotulo) {
    var base = PADRAO_SERIE[rotulo] || PADRAO_SERIE.preparacao, meu = (db.padroesSerie || {})[rotulo] || {};
    return { rotulo: rotulo, pct: typeof meu.pct === 'number' ? meu.pct : base.pct, reps: typeof meu.reps === 'string' ? meu.reps : base.reps,
      descanso: typeof meu.descanso === 'number' ? meu.descanso : base.descanso };
  }
  function seriesPadrao() { return ['aquecimento', 'preparacao', 'valida'].map(padraoSerie); }
  function salvarPadroesSerie(campos) {
    db.padroesSerie = {};
    Object.keys(PADRAO_SERIE).forEach(function (r) {
      var c = campos[r] || {}, d = Number(c.descanso);
      db.padroesSerie[r] = { pct: numero(c.pct, 0, 200, PADRAO_SERIE[r].pct), reps: texto(c.reps), descanso: isFinite(d) ? Math.max(0, Math.min(3600, Math.round(d))) : PADRAO_SERIE[r].descanso };
    });
    db.configurado = true;
    salvar();
  }
  function restaurarPadroesSerie() { delete db.padroesSerie; salvar(); }
  // Faixa de repetições escrita na série ("5-9", "5 a 9", "10") → { min, max }, ou null.
  function faixaReps(texto) {
    var m = String(texto || '').match(/(\d+)\s*(?:-|–|a|até)\s*(\d+)/i);
    if (m) return { min: Number(m[1]), max: Number(m[2]) };
    m = String(texto || '').match(/^\s*(\d+)\s*$/);
    return m ? { min: Number(m[1]), max: Number(m[1]) } : null;
  }
  // Faixa da série válida do exercício (a última série válida); sem faixa escrita, null.
  function faixaValida(e) {
    var v = (e.series || []).filter(function (s) { return s.rotulo === 'valida'; });
    return v.length ? faixaReps(v[v.length - 1].reps) : null;
  }
  // Repetições acima da faixa da série válida: hora de aumentar a carga.
  function passouDaFaixa(e, reps) { var f = faixaValida(e); return !!(f && reps > f.max); }

  function treino(id) { return buscar(db.treinos, id); }
  function treinos(comArquivados) { return db.treinos.filter(function (t) { return comArquivados || !t.arquivado; }).sort(porOrdem); }
  function salvarTreino(campos, id) {
    var t = id ? treino(id) : null;
    if (!t) { t = { id: novoId(), ordem: proximaOrdem(db.treinos), arquivado: false, exercicios: [], criadoEm: Date.now() }; db.treinos.push(t); }
    t.nome = texto(campos.nome) || 'Treino';
    if (campos.tipo) t.tipo = campos.tipo === 'corrida' || campos.tipo === 'tcat' ? campos.tipo : 'musculacao';
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
    // O exercício vem da biblioteca: nome e equipamento são os dela.
    var b = base(campos.baseId);
    if (b) { e.baseId = b.id; e.nome = b.nome; e.equipamento = b.equipamento; }
    else {
      e.nome = texto(campos.nome) || 'Exercício';
      e.equipamento = campos.equipamento === 'maquina' || campos.equipamento === 'corpo' ? campos.equipamento : 'livre';
    }
    e.carga = e.equipamento === 'corpo' ? 0 : numero(campos.carga, 0, 1000, 0);
    delete e.descanso;
    e.obs = texto(campos.obs);
    var series = (campos.series || []).map(function (s) {
      var d = Number(s.descanso);
      return { rotulo: ROTULOS_SERIE.some(function (r) { return r[0] === s.rotulo; }) ? s.rotulo : 'preparacao', pct: numero(s.pct, 0, 200, 100), reps: texto(s.reps),
        descanso: isFinite(d) ? Math.max(0, Math.min(3600, Math.round(d))) : 0 };
    });
    e.series = series.length ? series : seriesPadrao();
    salvar();
    return e;
  }
  function excluirExercicio(treinoId, exId) {
    var t = treino(treinoId);
    t.exercicios = t.exercicios.filter(function (e) { return e.id !== exId; });
    salvar();
  }
  function moverExercicio(treinoId, exId, delta) { var t = treino(treinoId); mover(t.exercicios, buscar(t.exercicios, exId), delta); salvar(); }

  // Carga de uma série: % da carga principal. Peso livre: arredondada para o kg mais próximo.
  // Máquina: arredondada para baixo, para o múltiplo de 5 kg (85 kg a 50% = 42,5 → 40 kg).
  function cargaDaSerie(carga, serie, equipamento) {
    if (equipamento === 'corpo') return 0;
    var v = (Number(carga) || 0) * (Number(serie.pct) || 0) / 100;
    if (equipamento === 'maquina') return Math.floor(v / PASSO_MAQUINA + 1e-9) * PASSO_MAQUINA;
    return Math.round(v);
  }

  // ---------- Biblioteca de exercícios e recordes (PR) ----------
  var GRUPOS = [['bracos', 'Braços'], ['torso', 'Torso'], ['pernas', 'Pernas']];
  function semAcento(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
  // Para os exercícios que já existiam: um palpite do grupamento pelo nome (dá para trocar em Configurações).
  function adivinharGrupo(nome) {
    var n = semAcento(nome);
    if (/agach|squat|leg|stiff|panturr|gemeo|extensora|flexora|afundo|passada|lunge|bulgar|hack|glute|abdutor|adutor|coxa|terra|elevacao pelvica|hip thrust|cadeira|mesa flex/.test(n)) return 'pernas';
    if (/rosca|bicep|tricep|martelo|antebraco|scott|curl|frances|testa|punho/.test(n)) return 'bracos';
    return 'torso';
  }
  function base(id) { return id ? buscar(db.exercicios, id) : null; }
  function biblioteca(grupo, comArquivados) {
    return db.exercicios.filter(function (b) { return (comArquivados || !b.arquivado) && (!grupo || b.grupo === grupo); })
      .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
  }
  function novaBase(nome, grupo, equipamento) {
    var b = { id: novoId(), nome: texto(nome) || 'Exercício', grupo: GRUPOS.some(function (g) { return g[0] === grupo; }) ? grupo : adivinharGrupo(nome),
      equipamento: equipamento === 'maquina' || equipamento === 'corpo' ? equipamento : 'livre', obs: '', arquivado: false, criadoEm: Date.now() };
    db.exercicios.push(b);
    return b;
  }
  function salvarBase(campos, id) {
    var b = base(id);
    if (!b) b = novaBase(campos.nome, campos.grupo, campos.equipamento);
    b.nome = texto(campos.nome) || b.nome;
    if (GRUPOS.some(function (g) { return g[0] === campos.grupo; })) b.grupo = campos.grupo;
    if (campos.equipamento) b.equipamento = campos.equipamento === 'maquina' || campos.equipamento === 'corpo' ? campos.equipamento : 'livre';
    b.obs = texto(campos.obs);
    b.arquivado = false;
    // Os treinos que usam este exercício passam a mostrar o nome e o equipamento novos.
    db.treinos.forEach(function (t) { t.exercicios.forEach(function (e) { if (e.baseId === b.id) { e.nome = b.nome; e.equipamento = b.equipamento; if (b.equipamento === 'corpo') e.carga = 0; } }); });
    salvar();
    return b;
  }
  // Treinos (não arquivados) que usam o exercício.
  function treinosComBase(id) { return treinos().filter(function (t) { return t.exercicios.some(function (e) { return e.baseId === id; }); }); }
  // Com histórico: arquiva (o PR continua). Sem: exclui. Exercício em uso num treino não pode sair.
  function excluirBase(id) {
    if (treinosComBase(id).length) return 'em-uso';
    var feito = db.registros.some(function (r) { return r.exercicios.some(function (x) { return x.baseId === id; }); })
      || db.treinos.some(function (t) { return t.exercicios.some(function (e) { return e.baseId === id; }); }); // treinos arquivados
    if (feito) base(id).arquivado = true; else db.exercicios = db.exercicios.filter(function (b) { return b.id !== id; });
    salvar();
    return feito ? 'arquivado' : 'excluido';
  }
  // Exercício de treino → id dele na biblioteca.
  function baseDoExercicio(exId) {
    for (var i = 0; i < db.treinos.length; i++) {
      var e = buscar(db.treinos[i].exercicios, exId);
      if (e) return e.baseId || null;
    }
    return null;
  }
  // Monta a biblioteca com os exercícios dos treinos que ainda não têm baseId (mesmo nome = mesmo exercício)
  // e liga os registros antigos a ela.
  function migrarBiblioteca() {
    var mudou = false;
    function porNome(nome, equipamento) {
      var n = semAcento(nome);
      return db.exercicios.filter(function (b) { return semAcento(b.nome) === n; })[0] || (mudou = true, novaBase(nome, null, equipamento));
    }
    db.treinos.forEach(function (t) {
      t.exercicios.forEach(function (e) {
        if (e.baseId && base(e.baseId)) return;
        e.baseId = porNome(e.nome, e.equipamento).id;
        mudou = true;
      });
    });
    db.registros.forEach(function (r) {
      r.exercicios.forEach(function (x) {
        if (x.baseId && base(x.baseId)) return;
        x.baseId = baseDoExercicio(x.exercicioId) || porNome(x.nome, x.semCarga ? 'corpo' : 'livre').id;
        mudou = true;
      });
    });
    if (mudou) gravarNoNavegador();
  }
  // Todos os resultados de um exercício da biblioteca (inclusive do treino em andamento), do mais antigo ao mais novo.
  function resultadosDaBase(baseId) {
    var l = [];
    db.registros.forEach(function (r) {
      r.exercicios.forEach(function (x) { if (x.baseId === baseId) l.push({ carga: x.carga, reps: x.reps, semCarga: !!x.semCarga, data: r.data, em: x.concluidoEm || r.inicio || 0, registroId: r.id }); });
    });
    return l.sort(function (a, b) { return a.data !== b.data ? (a.data < b.data ? -1 : 1) : a.em - b.em; });
  }
  // a é melhor que b? Com carga: mais carga e, na mesma carga, mais repetições. Peso do corpo: mais repetições.
  function melhorQue(a, b) {
    if (!b) return true;
    if (a.semCarga || b.semCarga) return a.reps > b.reps;
    return a.carga > b.carga + 1e-9 || (Math.abs(a.carga - b.carga) < 1e-9 && a.reps > b.reps);
  }
  function prDaBase(baseId, ignorar) {
    var pr = null;
    resultadosDaBase(baseId).forEach(function (x) { if (x !== ignorar && melhorQue(x, pr)) pr = x; });
    return pr;
  }

  // ---------- Registro dos treinos ----------
  function registro(id) { return buscar(db.registros, id); }
  function treinoEmAndamento() { return db.registros.filter(function (r) { return !r.fim; })[0] || null; }
  // Treinos já finalizados, do mais recente para o mais antigo (opcional: só os de um treino).
  function historico(treinoId) {
    return db.registros.filter(function (r) { return r.fim && (!treinoId || r.treinoId === treinoId); })
      .sort(function (a, b) { return a.data !== b.data ? (a.data < b.data ? 1 : -1) : (b.inicio || 0) - (a.inicio || 0); });
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
  // Concluir um exercício: guarda carga e repetições da última série, e a carga vira a principal do próximo treino
  // (em todos os treinos que usam o exercício). Devolve { item, novoPR, prAnterior, metas: metas de recorde batidas agora }.
  function concluirExercicio(registroId, exId, carga, reps) {
    var r = registro(registroId), e = exercicio(r.treinoId, exId);
    var semCarga = !!(e && e.equipamento === 'corpo'), baseId = e ? e.baseId || null : null;
    var item = { exercicioId: exId, baseId: baseId, nome: e ? e.nome : '', semCarga: semCarga, carga: semCarga ? 0 : numero(carga, 0, 1000, 0), reps: Math.round(numero(reps, 0, 999, 0)), concluidoEm: Date.now() };
    r.exercicios = r.exercicios.filter(function (x) { return x.exercicioId !== exId; }).concat([item]);
    // O PR anterior é o melhor resultado sem contar este.
    var anterior = baseId ? resultadosDaBase(baseId).filter(function (x) { return !(x.registroId === r.id && x.em === item.concluidoEm); })
      .reduce(function (m, x) { return melhorQue(x, m) ? x : m; }, null) : null;
    if (item.carga > 0) {
      if (e) e.carga = item.carga;
      if (baseId) db.treinos.forEach(function (t) { t.exercicios.forEach(function (x) { if (x.baseId === baseId) x.carga = item.carga; }); });
    }
    var metas = sincronizarMetasPR();
    salvar();
    return { item: item, novoPR: !!(baseId && anterior && melhorQue(Object.assign({}, item), anterior)), prAnterior: anterior, primeiro: !anterior, metas: metas };
  }
  function desfazerExercicio(registroId, exId) {
    var r = registro(registroId);
    r.exercicios = r.exercicios.filter(function (x) { return x.exercicioId !== exId; });
    sincronizarMetasPR();
    salvar();
  }
  // Finaliza o treino. Devolve os nomes das metas de treino que este treino fez bater (as metas são calculadas).
  function finalizarTreino(registroId, extra) {
    var r = registro(registroId);
    extra = extra || {};
    var antes = db.habitos.filter(function (h) { return h.medida === 'treinos' && !progressoHabito(h, r.data).completo; });
    r.fim = Date.now();
    if (r.tipo === 'corrida') r.corrida = dadosCorrida(extra, duracaoSeg(r));
    if (extra.obs != null) r.obs = texto(extra.obs);
    salvar();
    return antes.filter(function (h) { return progressoHabito(h, r.data).completo; }).map(function (h) { return h.titulo; });
  }
  // Corrida: distância (km) e tempo informado (segundos); sem tempo, vale o do cronômetro.
  function dadosCorrida(extra, cronometro) {
    var s = Number(extra.segundos);
    return { km: numero(extra.km, 0, 500, 0), segundos: isFinite(s) && s > 0 ? Math.round(s) : cronometro || 0 };
  }
  // Treino registrado direto, já finalizado (TCAT, ou uma corrida feita sem o cronômetro).
  function registrarTreinoFeito(treinoId, extra) {
    var t = treino(treinoId);
    extra = extra || {};
    var data = extra.data || UI.hoje();
    var antes = db.habitos.filter(function (h) { return h.medida === 'treinos' && !progressoHabito(h, data).completo; });
    var agora = Date.now(), seg = t.tipo === 'corrida' ? Math.max(0, Math.round(Number(extra.segundos) || 0)) : 0;
    var r = { id: novoId(), treinoId: t.id, nomeTreino: t.nome, tipo: t.tipo, data: data, inicio: agora - seg * 1000, fim: agora, exercicios: [], corrida: null, obs: texto(extra.obs), avulso: true };
    if (t.tipo === 'corrida') r.corrida = dadosCorrida(extra, 0);
    db.registros.push(r);
    salvar();
    return { registro: r, metas: antes.filter(function (h) { return progressoHabito(h, data).completo; }).map(function (h) { return h.titulo; }) };
  }
  function segundosCorrida(r) { return r.corrida && r.corrida.segundos ? r.corrida.segundos : duracaoSeg(r); }
  // Recordes de corrida: melhor ritmo (corridas de 1 km ou mais) e maior distância. ignorar: id de um registro.
  function recordesCorrida(ignorar) {
    var rec = { pace: null, distancia: null, tempo: null };
    historico().forEach(function (r) {
      if (r.tipo !== 'corrida' || r.id === ignorar || !r.corrida || !(r.corrida.km > 0)) return;
      var seg = segundosCorrida(r), p = seg / r.corrida.km;
      if (r.corrida.km >= 1 && seg > 0 && (!rec.pace || p < rec.pace.valor)) rec.pace = { valor: p, registro: r };
      if (!rec.distancia || r.corrida.km > rec.distancia.valor) rec.distancia = { valor: r.corrida.km, registro: r };
      if (seg > 0 && (!rec.tempo || seg > rec.tempo.valor)) rec.tempo = { valor: seg, registro: r };
    });
    return rec;
  }
  function cancelarTreino(registroId) { db.registros = db.registros.filter(function (r) { return r.id !== registroId; }); sincronizarMetasPR(); salvar(); }
  function excluirRegistro(id) { cancelarTreino(id); }
  function duracaoSeg(r) { return Math.max(0, Math.round(((r.fim || Date.now()) - (r.inicio || Date.now())) / 1000)); }
  // Último resultado de um exercício em treinos já finalizados: { carga, reps, data }.
  // Vale o mesmo exercício da biblioteca, mesmo que feito em outro treino.
  function ultimoResultado(exId) {
    var h = historico(), b = baseDoExercicio(exId);
    for (var i = 0; i < h.length; i++) {
      var x = h[i].exercicios.filter(function (e) { return e.exercicioId === exId || (b && e.baseId === b); })[0];
      if (x) return { carga: x.carga, reps: x.reps, semCarga: !!x.semCarga, data: h[i].data };
    }
    return null;
  }
  var XP_TREINO = { base: 50, exercicio: 10 };
  function xpDoRegistro(r) { return XP_TREINO.base + XP_TREINO.exercicio * r.exercicios.length; }
  function xpDosTreinos(hoje) {
    var r = { xp: 0, hoje: 0, feitos: 0, porMes: {} };
    historico().forEach(function (x) {
      if (antesDoInicio(x.data)) return;
      var v = xpDoRegistro(x);
      r.xp += v; r.feitos++;
      somarMes(r.porMes, x.data, v);
      if (x.data === hoje) r.hoje += v;
    });
    return r;
  }

  // ---------- Dieta ----------
  var XP_DIETA = { refeicao: 10, perdida: -15, medidas: 30 };
  function refeicoes() { return db.dieta.refeicoes.slice().sort(porOrdem); }
  function moverRefeicao(id, delta) { mover(db.dieta.refeicoes, refeicao(id), delta); salvar(); }
  function refeicao(id) { return buscar(db.dieta.refeicoes, id); }
  // Próxima segunda-feira (a semana vai de segunda a domingo).
  function proximaSegunda(iso) { var d = diaDaSemana(iso); return UI.somarDias(iso, d === 0 ? 7 : 7 - d); }
  function inicioDaDieta() { return db.dieta.desde; }
  function definirInicioDaDieta(iso) { db.dieta.desde = iso || null; salvar(); }
  function limparItens(lista) {
    return (lista || []).map(function (i) { return { alimento: texto(i.alimento), quantidade: texto(i.quantidade), substituicao: texto(i.substituicao) }; })
      .filter(function (i) { return i.alimento; });
  }
  function salvarRefeicao(campos, id) {
    var r = id ? refeicao(id) : null;
    if (!r) {
      r = { id: novoId(), ordem: proximaOrdem(db.dieta.refeicoes), desde: UI.hoje(), itens: [] };
      db.dieta.refeicoes.push(r);
      if (!db.dieta.desde) db.dieta.desde = proximaSegunda(UI.hoje());
    }
    r.nome = texto(campos.nome) || 'Refeição';
    r.horario = /^\d{2}:\d{2}$/.test(campos.horario || '') ? campos.horario : '';
    r.soTreino = !!campos.soTreino;
    r.obs = texto(campos.obs);
    r.itens = limparItens(campos.itens);
    salvar();
    return r;
  }
  function excluirRefeicao(id) { db.dieta.refeicoes = db.dieta.refeicoes.filter(function (r) { return r.id !== id; }); salvar(); }
  // Importa um plano alimentar (arquivo .json): substitui as refeições, a tabela de frutas e as orientações.
  // As refeições passam a contar a partir de `desde` (padrão: próxima segunda-feira). Os registros antigos ficam.
  function importarPlano(plano, desde) {
    if (!plano || !Array.isArray(plano.refeicoes) || !plano.refeicoes.length) throw new Error('O arquivo não tem as refeições do plano.');
    var inicio = desde || proximaSegunda(UI.hoje());
    // As refeições já aparecem hoje (para registrar); só tiram pontos a partir do início do acompanhamento.
    var aparece = inicio < UI.hoje() ? inicio : UI.hoje();
    db.dieta.refeicoes = plano.refeicoes.map(function (r, i) {
      return { id: novoId(), ordem: i + 1, desde: aparece, nome: texto(r.nome) || 'Refeição ' + (i + 1), horario: /^\d{2}:\d{2}$/.test(r.horario || '') ? r.horario : '',
        soTreino: !!r.soTreino, obs: texto(r.obs), itens: limparItens(r.itens) };
    });
    db.dieta.frutas = (plano.frutas || []).map(function (f) { return { fruta: texto(f.fruta), peso: texto(f.peso), quantidade: texto(f.quantidade) }; }).filter(function (f) { return f.fruta; });
    db.dieta.orientacoes = texto(plano.orientacoes);
    db.dieta.desde = inicio;
    salvar();
  }
  // Houve treino neste dia (finalizado, ou em andamento hoje)?
  function treinouNoDia(iso) { return db.registros.some(function (r) { return r.data === iso; }); }
  // Refeições que contam num dia: as do plano que já existiam naquele dia (as "só em dia de treino", só se treinou).
  function refeicoesDoDia(iso) {
    var treinou = null;
    return refeicoes().filter(function (r) {
      if (r.desde && r.desde > iso) return false;
      if (!r.soTreino) return true;
      if (treinou === null) treinou = treinouNoDia(iso);
      return treinou || !!registroRefeicao(iso, r.id);
    });
  }
  function registroRefeicao(iso, refId) { var d = db.alimentacao[iso]; return d ? d[refId] || null : null; }
  function registrarRefeicao(iso, refId, campos) {
    var d = db.alimentacao[iso] || (db.alimentacao[iso] = {});
    d[refId] = { tipo: campos.tipo === 'outro' ? 'outro' : 'dieta', descricao: texto(campos.descricao), em: Date.now() };
    salvar();
  }
  function desfazerRefeicao(iso, refId) {
    var d = db.alimentacao[iso];
    if (!d) return;
    delete d[refId];
    if (!Object.keys(d).length) delete db.alimentacao[iso];
    salvar();
  }
  // Situação de um dia: refeições na dieta, trocadas, não registradas e os pontos.
  // Hoje (e dias futuros) não perdem pontos: a refeição ainda pode ser registrada.
  function resumoDieta(iso, hoje) {
    hoje = hoje || UI.hoje();
    var lista = refeicoesDoDia(iso), r = { total: lista.length, dieta: 0, outro: 0, faltam: 0, xp: 0 };
    var conta = db.dieta.desde && iso >= db.dieta.desde && iso < hoje;
    lista.forEach(function (ref) {
      var x = registroRefeicao(iso, ref.id);
      if (x && x.tipo === 'dieta') { r.dieta++; r.xp += XP_DIETA.refeicao; }
      else if (x) r.outro++;
      else { r.faltam++; if (conta) r.xp += XP_DIETA.perdida; }
    });
    // Registros de refeições que saíram do plano ainda contam como seguidos, se foram na dieta.
    Object.keys(db.alimentacao[iso] || {}).forEach(function (id) {
      if (!lista.some(function (ref) { return ref.id === id; }) && db.alimentacao[iso][id].tipo === 'dieta') r.xp += XP_DIETA.refeicao;
    });
    r.perdeu = conta && r.faltam > 0;
    return r;
  }
  // Pontos da dieta: refeições seguidas, refeições não registradas (dias já encerrados) e o registro semanal.
  function xpDaDieta(hoje) {
    var r = { xp: 0, hoje: 0, seguidas: 0, perdidas: 0, medidas: db.medidas.length, porMes: {} };
    var dias = {};
    Object.keys(db.alimentacao).forEach(function (d) { dias[d] = 1; });
    if (db.dieta.desde && db.dieta.refeicoes.length) {
      for (var d = db.dieta.desde, i = 0; d < hoje && i < 3660; d = UI.somarDias(d, 1), i++) dias[d] = 1;
    }
    Object.keys(dias).forEach(function (d) {
      if (antesDoInicio(d)) return;
      var s = resumoDieta(d, hoje);
      r.xp += s.xp; r.seguidas += s.dieta;
      somarMes(r.porMes, d, s.xp);
      if (s.perdeu) r.perdidas += s.faltam;
      if (d === hoje) r.hoje += s.xp;
    });
    db.medidas.forEach(function (m) { if (antesDoInicio(m.data)) return; r.xp += XP_DIETA.medidas; somarMes(r.porMes, m.data, XP_DIETA.medidas); if (m.data === hoje) r.hoje += XP_DIETA.medidas; });
    return r;
  }
  // Adesão de uma semana (segunda a domingo) que contém o dia.
  function semanaDieta(iso) {
    var ini = UI.somarDias(iso, -diaDaSemana(iso)), r = { inicio: ini, fim: UI.somarDias(ini, 6), total: 0, dieta: 0, outro: 0, faltam: 0 };
    for (var i = 0; i < 7; i++) {
      var d = UI.somarDias(ini, i);
      if (d > UI.hoje()) break;
      var s = resumoDieta(d);
      r.total += s.total; r.dieta += s.dieta; r.outro += s.outro; r.faltam += s.faltam;
    }
    return r;
  }

  // ---------- Medidas semanais ----------
  function medida(id) { return buscar(db.medidas, id); }
  function medidas() { return db.medidas.slice().sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : 0; }); }
  function medidaDoDia(iso) { return db.medidas.filter(function (m) { return m.data === iso; })[0] || null; }
  function salvarMedida(campos, id) {
    var m = id ? medida(id) : medidaDoDia(campos.data);
    if (!m) { m = { id: novoId(), criadoEm: Date.now(), fotos: {} }; db.medidas.push(m); }
    m.data = campos.data || UI.hoje();
    ['peso', 'braco', 'coxa', 'panturrilha'].forEach(function (k) { var v = numero(campos[k], 0, 500, NaN); m[k] = isFinite(v) && v > 0 ? v : null; });
    m.obs = texto(campos.obs);
    if (campos.fotos) Object.keys(campos.fotos).forEach(function (k) { if (campos.fotos[k] !== undefined) m.fotos[k] = campos.fotos[k] || null; });
    sincronizarMetasPR(); // metas de medida (ex.: chegar a 70 kg); as batidas agora ficam em metasRecemBatidas()
    salvar();
    return m;
  }
  function excluirMedida(id) { db.medidas = db.medidas.filter(function (m) { return m.id !== id; }); sincronizarMetasPR(); salvar(); }
  // Domingo do registro semanal: hoje, se for domingo; senão, o último domingo.
  function domingoDaSemana(iso) { var d = diaDaSemana(iso); return d === 6 ? iso : UI.somarDias(iso, -(d + 1)); }
  // O registro do domingo mais recente está pendente? (Só depois que há plano alimentar ou algum registro.)
  function medidaPendente(hoje) {
    hoje = hoje || UI.hoje();
    var dom = domingoDaSemana(hoje);
    if (medidaDoDia(dom)) return null;
    // Vale também registrar na segunda de manhã o domingo que passou; depois disso, espera o próximo domingo.
    if (dom !== hoje && UI.diasEntre(dom, hoje) > 1) return null;
    return dom;
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
    var eraPR = m.tipo === 'pr';
    m.titulo = texto(campos.titulo) || 'Meta';
    m.descricao = texto(campos.descricao);
    m.area = AREAS.some(function (a) { return a[0] === campos.area; }) ? campos.area : 'habitos';
    m.dificuldade = DIFICULDADES.some(function (d) { return d[0] === campos.dificuldade; }) ? campos.dificuldade : 'media';
    m.prazo = campos.prazo || null;
    // Meta de recorde: batida sozinha quando um treino registra o exercício com a carga (e as repetições) do alvo.
    if (campos.tipo === 'pr' && base(campos.exercicioId)) {
      var b = base(campos.exercicioId);
      m.tipo = 'pr';
      m.area = 'treino';
      m.exercicioId = b.id;
      m.alvoCarga = b.equipamento === 'corpo' ? 0 : numero(campos.alvoCarga, 0, 1000, 0);
      m.alvoReps = Math.max(1, Math.round(numero(campos.alvoReps, 1, 999, 1)));
    } else if (campos.tipo === 'medida' && CAMPOS_MEDIDA.some(function (c) { return c[0] === campos.campo; })) {
      // Meta de medida (peso, braço, coxa, panturrilha): batida sozinha no registro semanal que chegar ao alvo.
      var mudouCampo = m.tipo !== 'medida' || m.campo !== campos.campo;
      m.tipo = 'medida';
      m.area = 'dieta';
      m.campo = campos.campo;
      m.alvoMedida = numero(campos.alvoMedida, 0, 500, 0);
      if (mudouCampo || !m.desde) { m.desde = UI.hoje(); m.inicial = valorAtual(m.campo); }
      m.sentido = campos.sentido === 'descer' ? 'descer' : 'subir';
      delete m.exercicioId; delete m.alvoCarga; delete m.alvoReps;
    } else {
      if (eraPR || m.tipo === 'medida') { m.concluida = false; m.dataConclusao = null; }
      m.tipo = 'livre';
      delete m.exercicioId; delete m.alvoCarga; delete m.alvoReps;
      delete m.campo; delete m.alvoMedida; delete m.sentido; delete m.desde; delete m.inicial;
    }
    if (m.tipo === 'pr') { delete m.campo; delete m.alvoMedida; delete m.sentido; delete m.desde; delete m.inicial; }
    sincronizarMetasPR();
    salvar();
    return m;
  }
  // Primeiro resultado que bate a meta de recorde (ou null).
  function bateAlvo(m, x) {
    var b = base(m.exercicioId), corpo = b ? b.equipamento === 'corpo' : x.semCarga;
    return x.reps >= (m.alvoReps || 1) && (corpo || x.carga >= (m.alvoCarga || 0) - 1e-9);
  }
  function resultadoQueBateu(m) { return resultadosDaBase(m.exercicioId).filter(function (x) { return bateAlvo(m, x); })[0] || null; }
  // ---------- Metas de medida ----------
  var CAMPOS_MEDIDA = [['peso', 'Peso', 'kg'], ['braco', 'Braço', 'cm'], ['coxa', 'Coxa', 'cm'], ['panturrilha', 'Panturrilha', 'cm']];
  function campoMedida(id) { return CAMPOS_MEDIDA.filter(function (c) { return c[0] === id; })[0] || CAMPOS_MEDIDA[0]; }
  // Último valor registrado de uma medida (ou null) e a data.
  function ultimaMedida(campo) {
    var l = medidas().filter(function (x) { return x[campo] != null; });
    return l.length ? { valor: l[0][campo], data: l[0].data } : null;
  }
  function valorAtual(campo) { var u = ultimaMedida(campo); return u ? u.valor : null; }
  function bateMedida(m, v) { return v != null && (m.sentido === 'descer' ? v <= m.alvoMedida + 1e-9 : v >= m.alvoMedida - 1e-9); }
  // Primeiro registro (a partir da criação da meta) que chega ao alvo.
  function medidaQueBateu(m) {
    return medidas().slice().reverse().filter(function (x) { return x.data >= (m.desde || '') && bateMedida(m, x[m.campo]); })[0] || null;
  }
  function progressoMetaMedida(m) {
    var c = campoMedida(m.campo), u = ultimaMedida(m.campo), ini = m.inicial;
    var pct = 0;
    if (m.concluida) pct = 100;
    else if (u && ini != null && Math.abs(m.alvoMedida - ini) > 1e-9) pct = Math.max(0, Math.min(99, (u.valor - ini) / (m.alvoMedida - ini) * 100));
    return { campo: c, atual: u, inicial: ini, pct: pct };
  }

  // Atualiza as metas automáticas (recorde e medida) a partir dos registros. Devolve as que acabaram de ser batidas.
  var recemBatidas = [];
  function sincronizarMetasPR() {
    var novas = [];
    db.metas.forEach(function (m) {
      if (m.tipo !== 'pr' && m.tipo !== 'medida') return;
      var antes = !!m.concluida, data = null;
      if (m.tipo === 'pr') { var x = resultadoQueBateu(m); data = x ? x.data : null; }
      else { var r = medidaQueBateu(m); data = r ? r.data : null; }
      m.concluida = !!data;
      m.dataConclusao = data;
      if (m.concluida && !antes) novas.push(m);
    });
    recemBatidas = novas;
    return novas;
  }
  function metasRecemBatidas() { return recemBatidas.slice(); }
  // Progresso da meta de recorde: o PR atual comparado ao alvo.
  function progressoMetaPR(m) {
    var b = base(m.exercicioId), pr = b ? prDaBase(b.id) : null, corpo = b && b.equipamento === 'corpo';
    var pct = !pr ? 0 : corpo ? pr.reps / (m.alvoReps || 1) * 100 : m.alvoCarga ? pr.carga / m.alvoCarga * 100 : 0;
    if (m.concluida) pct = 100; else pct = Math.min(99, pct);
    return { base: b, pr: pr, corpo: corpo, pct: pct };
  }
  function concluirMeta(id, feita) {
    var m = meta(id);
    if (!m || m.tipo === 'pr' || m.tipo === 'medida') return; // essas se marcam sozinhas
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
  // Cada meta tem área, período, o que mede e um alvo. Treino, Dieta e Estudo são calculados dos registros;
  // Hábito é marcado à mão (h.feitos). Pontos: base do período × dificuldade, por período cumprido.
  var PERIODOS = [['dia', 'Diária'], ['semana', 'Semanal'], ['mes', 'Mensal']];
  var AREAS_HABITO = [['estudo', 'Estudo'], ['treino', 'Treino'], ['dieta', 'Dieta'], ['habito', 'Hábito']];
  // [id, área, nome, unidade (singular, plural)]
  var MEDIDAS_HABITO = [
    ['horas', 'estudo', 'Horas de estudo', 'h', 'h'],
    ['treinos', 'treino', 'Treinos feitos', 'treino', 'treinos'],
    ['dias100', 'dieta', 'Dias 100% na dieta', 'dia', 'dias'],
    ['refeicoes', 'dieta', 'Refeições na dieta', 'refeição', 'refeições'],
    ['manual', 'habito', 'Marcar quando fizer', 'vez', 'vezes']
  ];
  var XP_PERIODO = { dia: 10, semana: 60, mes: 250 };
  var DIFICULDADE_HABITO = [['facil', 'Fácil', 1], ['media', 'Média', 1.5], ['dificil', 'Difícil', 2]];
  var XP_HABITO = XP_PERIODO; // compatibilidade

  function medidaHabito(id) { return MEDIDAS_HABITO.filter(function (m) { return m[0] === id; })[0] || MEDIDAS_HABITO[4]; }
  function xpDoHabito(h) {
    var d = DIFICULDADE_HABITO.filter(function (x) { return x[0] === h.dificuldade; })[0] || DIFICULDADE_HABITO[0];
    return Math.round(XP_PERIODO[h.periodo] * d[2]);
  }
  // Metas antigas (só manuais, com "marcar ao treinar") viram o modelo novo.
  function normalizarHabito(h) {
    if (!h.feitos || typeof h.feitos !== 'object') h.feitos = {};
    if (!Array.isArray(h.dias)) h.dias = [];
    if (!h.area) {
      if (h.treino) { h.area = 'treino'; h.medida = 'treinos'; }
      else { h.area = 'habito'; h.medida = 'manual'; }
      h.alvo = h.periodo === 'dia' ? 1 : (h.vezes || 1);
      delete h.treino; delete h.vezes;
    }
    if (!h.medida) h.medida = medidaHabito(null)[0];
    if (!(h.alvo > 0)) h.alvo = 1;
    if (!h.dificuldade) h.dificuldade = 'facil';
    if (h.periodo === 'dia' && !h.dias.length) h.dias = [0, 1, 2, 3, 4, 5, 6];
    return h;
  }
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
    h.area = AREAS_HABITO.some(function (a) { return a[0] === campos.area; }) ? campos.area : 'habito';
    var m = MEDIDAS_HABITO.filter(function (x) { return x[0] === campos.medida && x[1] === h.area; })[0] || MEDIDAS_HABITO.filter(function (x) { return x[1] === h.area; })[0];
    h.medida = m[0];
    var dias = (campos.dias || []).map(Number).filter(function (d) { return d >= 0 && d <= 6; });
    h.dias = h.periodo === 'dia' ? (dias.length ? dias : [0, 1, 2, 3, 4, 5, 6]) : [];
    h.alvo = numero(campos.alvo, 0.1, 10000, 1);
    if (h.medida !== 'horas') h.alvo = Math.max(1, Math.round(h.alvo));
    if (h.medida === 'manual' && h.periodo === 'dia') h.alvo = 1;
    h.dificuldade = DIFICULDADE_HABITO.some(function (d) { return d[0] === campos.dificuldade; }) ? campos.dificuldade : 'facil';
    delete h.treino; delete h.vezes;
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
  // A meta diária vale nos dias da semana escolhidos; as semanais e mensais, em qualquer dia.
  function habitoValeNoDia(h, iso) { return h.periodo !== 'dia' || h.dias.indexOf(diaDaSemana(iso)) >= 0; }
  function periodoDoHabito(h, iso) {
    if (h.periodo === 'semana') { var ini = UI.somarDias(iso, -diaDaSemana(iso)); return { inicio: ini, fim: UI.somarDias(ini, 6) }; }
    if (h.periodo === 'mes') return { inicio: iso.slice(0, 7) + '-01', fim: iso.slice(0, 7) + '-' + UI.pad(diasNoMes(iso.slice(0, 7))) };
    return { inicio: iso, fim: iso };
  }
  // Valor medido entre duas datas (inclusivas), até hoje.
  function medir(h, inicio, fim) {
    var hoje = UI.hoje();
    if (fim > hoje) fim = hoje;
    if (fim < inicio) return 0;
    if (h.medida === 'horas') return window.Estudos ? Estudos.horasEntre(inicio, fim) : 0;
    if (h.medida === 'treinos') return db.registros.filter(function (r) { return r.fim && r.data >= inicio && r.data <= fim; }).length;
    if (h.medida === 'manual') return Object.keys(h.feitos).filter(function (d) { return d >= inicio && d <= fim; }).length;
    var n = 0;
    for (var d = inicio, i = 0; d <= fim && i < 400; d = UI.somarDias(d, 1), i++) {
      var s = resumoDieta(d, hoje);
      if (h.medida === 'refeicoes') n += s.dieta;
      else if (s.total && s.dieta === s.total) n++;
    }
    return n;
  }
  // Progresso no período (dia, semana ou mês) que contém o dia.
  function progressoHabito(h, iso) {
    // Só conta o que foi feito a partir do início do projeto (um mês que começou antes conta a partir dele).
    var p = periodoDoHabito(h, iso), v = medir(h, maior(p.inicio, inicioProjeto()), p.fim);
    return { feitas: v, alvo: h.alvo || 1, completo: v >= (h.alvo || 1) - 1e-9, periodo: p, pct: Math.min(100, v / (h.alvo || 1) * 100) };
  }
  function habitoCumpridoNoDia(h, iso) { return progressoHabito(h, iso).completo; }
  // Dias seguidos cumprindo a meta diária (só os dias em que ela vale); hoje ainda em aberto não quebra a sequência.
  function sequenciaHabito(h) {
    if (h.periodo !== 'dia') return 0;
    var d = UI.hoje(), n = 0;
    for (var i = 0; i < 400; i++, d = UI.somarDias(d, -1)) {
      if (d < h.desde || antesDoInicio(d)) break;
      if (!habitoValeNoDia(h, d)) continue;
      if (habitoCumpridoNoDia(h, d)) n++; else if (i > 0) break;
    }
    return n;
  }
  // Inícios dos períodos de uma meta, da criação até hoje.
  function periodosAteHoje(h) {
    var hoje = UI.hoje(), l = [], d = periodoDoHabito(h, maior(h.desde || hoje, inicioProjeto())).inicio;
    for (var i = 0; d <= hoje && i < 3700; i++) {
      if (h.periodo === 'dia') { if (habitoValeNoDia(h, d)) l.push(d); d = UI.somarDias(d, 1); }
      else if (h.periodo === 'semana') { l.push(d); d = UI.somarDias(d, 7); }
      else { l.push(d); d = UI.somarMeses(d.slice(0, 7), 1) + '-01'; }
    }
    return l;
  }
  // XP das metas recorrentes: cada período cumprido (o atual conta assim que o alvo é atingido).
  function xpDosHabitos(hoje) {
    var r = { xp: 0, hoje: 0, cumpridas: 0, porMes: {} };
    db.habitos.forEach(function (h) {
      var valor = xpDoHabito(h);
      periodosAteHoje(h).forEach(function (ini) {
        if (!progressoHabito(h, ini).completo) return;
        r.xp += valor; r.cumpridas++;
        somarMes(r.porMes, mesDoPeriodo(h, ini), valor);
        if (ini === periodoDoHabito(h, hoje).inicio) r.hoje += valor;
      });
    });
    return r;
  }
  // Mês a que um período pertence (a semana fica no mês do seu domingo). Devolve um dia desse mês.
  function mesDoPeriodo(h, ini) { return h.periodo === 'semana' ? UI.somarDias(ini, 6) : ini; }

  // ---------- Contador do mês e índice (multiplicador de XP) ----------
  // [mínimo %, nome, multiplicador, id]
  var FAIXAS_MES = [
    [100, 'Lendário', 2, 'lendario'],
    [90, 'Heroico', 1.5, 'heroico'],
    [80, 'Valoroso', 1.25, 'valoroso'],
    [75, 'Bronze', 1, 'bronze'],
    [70, 'Ferro', 1, 'ferro'],
    [0, 'Derrotado', 0.9, 'derrotado']
  ].map(function (f) { return { min: f[0], nome: f[1], mult: f[2], id: f[3] }; });
  function faixaDoPct(pct) {
    if (pct == null) return null;
    for (var i = 0; i < FAIXAS_MES.length; i++) if (pct >= FAIXAS_MES[i].min - 1e-9) return FAIXAS_MES[i];
    return FAIXAS_MES[FAIXAS_MES.length - 1];
  }
  var cacheMes = {};
  // Cada ocorrência de meta no mês: cada dia de uma meta diária, cada semana (pelo domingo) de uma semanal,
  // o mês de uma mensal e as metas de longo prazo com prazo (ou concluídas) no mês.
  // batida | falhou (o período acabou sem cumprir) | falta (ainda vai acontecer ou está em curso).
  // O índice usa as já decididas: batidas / (batidas + falharam).
  function resumoDoMes(mes, hoje) {
    hoje = hoje || UI.hoje();
    var chave = mes + '|' + hoje + '|' + (window.Estudos ? Estudos.info().lidoEm || 0 : 0);
    if (cacheMes[mes] && cacheMes[mes].chave === chave) return cacheMes[mes].r;
    var ini = mes + '-01', fim = mes + '-' + UI.pad(diasNoMes(mes));
    var r = { mes: mes, total: 0, batidas: 0, falharam: 0, faltam: 0, porArea: {}, linhas: [] };
    // linhas: uma por meta, com uma caixinha por ocorrência ({ estado, rotulo, data, hoje }).
    function contar(area, estado, linha, rotulo, data, pFim) {
      if (linha) linha.caixas.push({ estado: estado, rotulo: rotulo, data: data, atual: data <= hoje && (pFim || data) >= hoje });
      r.total++;
      r[estado === 'batida' ? 'batidas' : estado === 'falhou' ? 'falharam' : 'faltam']++;
      var a = r.porArea[area] || (r.porArea[area] = { total: 0, batidas: 0, falharam: 0, faltam: 0 });
      a.total++; a[estado === 'batida' ? 'batidas' : estado === 'falhou' ? 'falharam' : 'faltam']++;
    }
    function estado(h, pIni, pFim) {
      if (pIni > hoje) return 'falta';
      var ok = progressoHabito(h, pIni).completo;
      return ok ? 'batida' : pFim < hoje ? 'falhou' : 'falta';
    }
    habitos().forEach(function (h) {
      var desde = maior(h.desde || ini, inicioProjeto());
      var linha = { titulo: h.titulo, area: h.area, periodo: h.periodo, caixas: [] };
      if (h.periodo === 'dia') {
        for (var d = ini; d <= fim; d = UI.somarDias(d, 1)) {
          if (d < desde || !habitoValeNoDia(h, d)) continue;
          contar(h.area, estado(h, d, d), linha, UI.fmtDiaMes(d), d);
        }
      } else if (h.periodo === 'semana') {
        var seg = UI.somarDias(ini, -diaDaSemana(ini));
        if (UI.somarDias(seg, 6) < ini) seg = UI.somarDias(seg, 7);
        for (; UI.somarDias(seg, 6) <= fim; seg = UI.somarDias(seg, 7)) {
          var dom = UI.somarDias(seg, 6), est = estado(h, seg, dom);
          // Semana pela metade (a meta foi criada no meio dela) não conta como falha.
          if (dom < desde || (seg < desde && est === 'falhou')) continue;
          contar(h.area, est, linha, 'Semana de ' + UI.fmtDiaMes(seg) + ' a ' + UI.fmtDiaMes(dom), seg, dom);
        }
      } else if (fim >= desde) {
        var estMes = estado(h, ini, fim);
        if (ini >= desde || estMes !== 'falhou') contar(h.area, estMes, linha, UI.nomeMes(mes), ini, fim); // mês pela metade não conta como falha
      }
      if (linha.caixas.length) r.linhas.push(linha);
    });
    var longo = { titulo: 'Metas de longo prazo', area: 'longo', periodo: 'longo', caixas: [] };
    db.metas.forEach(function (m) {
      var data = m.concluida ? m.dataConclusao : m.prazo;
      if (!data || data.slice(0, 7) !== mes || antesDoInicio(data)) return;
      var area = m.tipo === 'pr' ? 'pr' : m.tipo === 'medida' ? 'medida' : m.area === 'estudos' ? 'estudo' : m.area === 'habitos' ? 'habito' : m.area;
      contar(area, m.concluida ? 'batida' : m.prazo < hoje ? 'falhou' : 'falta', longo, m.titulo + ' · ' + UI.fmtDiaMes(data), data);
    });
    if (longo.caixas.length) r.linhas.push(longo);
    var decididas = r.batidas + r.falharam;
    r.pct = decididas ? r.batidas / decididas * 100 : null;
    r.faixa = faixaDoPct(r.pct);
    r.multiplicador = r.faixa ? r.faixa.mult : 1;
    cacheMes[mes] = { chave: chave, r: r };
    return r;
  }

  // Para o Dashboard: metas cumpridas sobre as possíveis numa semana (diárias: cada dia; semanais: a semana).
  function cumprimentoNaSemana(seg) {
    var hoje = UI.hoje(), r = { feitas: 0, possiveis: 0 };
    db.habitos.forEach(function (h) {
      if (h.periodo === 'dia') {
        for (var i = 0; i < 7; i++) {
          var d = UI.somarDias(seg, i);
          if (d > hoje || d < h.desde || antesDoInicio(d) || !habitoValeNoDia(h, d)) continue;
          r.possiveis++;
          if (habitoCumpridoNoDia(h, d)) r.feitas++;
        }
      } else if (h.periodo === 'semana') {
        if (UI.somarDias(seg, 6) < h.desde || seg > hoje) return;
        r.possiveis++;
        if (progressoHabito(h, seg).completo) r.feitas++;
      }
    });
    r.pct = r.possiveis ? Math.round(r.feitas / r.possiveis * 100) : null;
    return r;
  }

  preparar();

  return {
    get db() { return db; },
    salvar: salvar, substituir: substituir, exportar: exportar, importar: importar, limpar: limpar, semDados: semDados, ehDoPrograma: ehDoPrograma,
    atualizarPerfil: atualizarPerfil, inicioProjeto: inicioProjeto, diaDoProjeto: diaDoProjeto, antesDoInicio: antesDoInicio,
    TIPOS_TREINO: TIPOS_TREINO, ROTULOS_SERIE: ROTULOS_SERIE, seriesPadrao: seriesPadrao, padraoSerie: padraoSerie, salvarPadroesSerie: salvarPadroesSerie, restaurarPadroesSerie: restaurarPadroesSerie, faixaValida: faixaValida, passouDaFaixa: passouDaFaixa, EQUIPAMENTOS: EQUIPAMENTOS, PASSO_MAQUINA: PASSO_MAQUINA,
    treino: treino, treinos: treinos, salvarTreino: salvarTreino, excluirTreino: excluirTreino, moverTreino: moverTreino,
    exercicio: exercicio, exercicios: exercicios, salvarExercicio: salvarExercicio, excluirExercicio: excluirExercicio, moverExercicio: moverExercicio,
    cargaDaSerie: cargaDaSerie,
    registro: registro, treinoEmAndamento: treinoEmAndamento, historico: historico, iniciarTreino: iniciarTreino, feitoNoRegistro: feitoNoRegistro,
    concluirExercicio: concluirExercicio, desfazerExercicio: desfazerExercicio, finalizarTreino: finalizarTreino, cancelarTreino: cancelarTreino,
    excluirRegistro: excluirRegistro, duracaoSeg: duracaoSeg, registrarTreinoFeito: registrarTreinoFeito, segundosCorrida: segundosCorrida, recordesCorrida: recordesCorrida, ultimoResultado: ultimoResultado, XP_TREINO: XP_TREINO, xpDoRegistro: xpDoRegistro, xpDosTreinos: xpDosTreinos,
    XP_DIETA: XP_DIETA, refeicoes: refeicoes, refeicao: refeicao, salvarRefeicao: salvarRefeicao, excluirRefeicao: excluirRefeicao,
    moverRefeicao: moverRefeicao, importarPlano: importarPlano, treinouNoDia: treinouNoDia,
    refeicoesDoDia: refeicoesDoDia, registroRefeicao: registroRefeicao, registrarRefeicao: registrarRefeicao, desfazerRefeicao: desfazerRefeicao,
    resumoDieta: resumoDieta, xpDaDieta: xpDaDieta, semanaDieta: semanaDieta, inicioDaDieta: inicioDaDieta, definirInicioDaDieta: definirInicioDaDieta,
    proximaSegunda: proximaSegunda,
    medida: medida, medidas: medidas, medidaDoDia: medidaDoDia, salvarMedida: salvarMedida, excluirMedida: excluirMedida,
    domingoDaSemana: domingoDaSemana, medidaPendente: medidaPendente,
    lembrete: lembrete, salvarLembrete: salvarLembrete, concluirLembrete: concluirLembrete, excluirLembrete: excluirLembrete,
    dataLimite: dataLimite, situacaoLembrete: situacaoLembrete, lembretesAtivos: lembretesAtivos, ordemLembrete: ordemLembrete,
    AREAS: AREAS, DIFICULDADES: DIFICULDADES, meta: meta, salvarMeta: salvarMeta, concluirMeta: concluirMeta, excluirMeta: excluirMeta, xpDaMeta: xpDaMeta,
    PERIODOS: PERIODOS, XP_HABITO: XP_HABITO, AREAS_HABITO: AREAS_HABITO, MEDIDAS_HABITO: MEDIDAS_HABITO, XP_PERIODO: XP_PERIODO,
    DIFICULDADE_HABITO: DIFICULDADE_HABITO, medidaHabito: medidaHabito, xpDoHabito: xpDoHabito, habitoCumpridoNoDia: habitoCumpridoNoDia,
    cumprimentoNaSemana: cumprimentoNaSemana, habito: habito, habitos: habitos, salvarHabito: salvarHabito, excluirHabito: excluirHabito,
    marcarHabito: marcarHabito, habitoValeNoDia: habitoValeNoDia, progressoHabito: progressoHabito, sequenciaHabito: sequenciaHabito,
    xpDosHabitos: xpDosHabitos, diaDaSemana: diaDaSemana,
    GRUPOS: GRUPOS, base: base, biblioteca: biblioteca, salvarBase: salvarBase, excluirBase: excluirBase, treinosComBase: treinosComBase,
    baseDoExercicio: baseDoExercicio, resultadosDaBase: resultadosDaBase, prDaBase: prDaBase, progressoMetaPR: progressoMetaPR,
    CAMPOS_MEDIDA: CAMPOS_MEDIDA, campoMedida: campoMedida, ultimaMedida: ultimaMedida, progressoMetaMedida: progressoMetaMedida, metasRecemBatidas: metasRecemBatidas,
    FAIXAS_MES: FAIXAS_MES, faixaDoPct: faixaDoPct, resumoDoMes: resumoDoMes
  };
})();
