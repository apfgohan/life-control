// Camada de dados: tudo que o programa guarda passa por aqui.
// Os dados ficam no localStorage (cópia rápida), no arquivo da pasta de dados e na nuvem.
var Dados = (function () {
  var CHAVE = 'life-control';
  var VERSAO = 1;

  function vazio() {
    var d = {
      versao: VERSAO,
      perfil: { nome: '', foto: null },   // foto: imagem enviada, em data URL
      // papel 'saude': os gastos da categoria são comparados com o Auxílio Saúde.
      categorias: [],   // { id, nome, tipo: 'gasto'|'entrada', cor, ordem, papel }
      // papel 'diaria' / 'auxilio-saude' (só entradas). fixo: conta que se repete todo mês a partir de `desde`.
      itens: [],        // { id, categoriaId, nome, ordem, papel, arquivado, fixo: null | { valor, dia, desde: 'AAAA-MM' } }
      // valor sempre positivo (o tipo vem da categoria do item). mesFixo: mês da conta fixa que este lançamento quita;
      // pulado: a conta fixa não vale naquele mês.
      lancamentos: [],  // { id, data, itemId, valor, descricao, status: 'realizado'|'previsto', missaoId, mesFixo, pulado, criadoEm }
      missoes: [],      // { id, nome, destino, inicio, fim, criadoEm }
      // tipo 'dia': data (+hora); 'prazo': de inicio até fim; 'aberto': até concluir.
      lembretes: [],    // { id, titulo, detalhe, tipo, data, hora, inicio, fim, relevancia, concluido, dataConclusao, criadoEm }
      metas: [],        // { id, area, titulo, descricao, dificuldade, prazo, concluida, dataConclusao, criadoEm }
      configurado: false // vira true quando categorias ou perfil são alterados (dados "não vazios" para a sincronização)
    };
    semente(d);
    return d;
  }

  // Categorias e itens iniciais. Os ids são fixos para todos os aparelhos começarem iguais.
  function semente(d) {
    var cats = [
      ['entradas', 'Entradas', 'entrada', '#3ecf7c', null, [['salario', 'Salário'], ['diarias', 'Diárias', 'diaria'], ['auxilio-saude', 'Auxílio Saúde', 'auxilio-saude'], ['outras-entradas', 'Outras entradas']]],
      ['casa', 'Casa', 'gasto', '#3b8cf0', null, [['aluguel', 'Aluguel'], ['energia', 'Conta de Energia'], ['agua', 'Conta de Água'], ['gas', 'Conta de Gás'], ['internet', 'Internet']]],
      ['transporte', 'Transporte', 'gasto', '#f2b33d', null, [['uber', 'Uber'], ['gasolina', 'Gasolina'], ['passagens', 'Passagens']]],
      ['alimentacao', 'Alimentação', 'gasto', '#f3a24b', null, [['mercado', 'Mercado'], ['restaurante', 'Restaurante e delivery']]],
      ['saude', 'Saúde', 'gasto', '#f2607a', 'saude', [['consultas', 'Consultas e exames'], ['farmacia', 'Farmácia'], ['plano', 'Plano de saúde']]],
      ['hospedagem', 'Hospedagem', 'gasto', '#45cdbd', null, [['hotel', 'Hotel']]],
      ['lazer', 'Lazer', 'gasto', '#c7a8ff', null, [['lazer', 'Lazer']]],
      ['outros', 'Outros', 'gasto', '#a9b0c4', null, [['outros', 'Outros gastos']]]
    ];
    cats.forEach(function (c, i) {
      d.categorias.push({ id: 'cat-' + c[0], nome: c[1], tipo: c[2], cor: c[3], ordem: i + 1, papel: c[4] });
      c[5].forEach(function (it, j) {
        d.itens.push({ id: 'item-' + it[0], categoriaId: 'cat-' + c[0], nome: it[1], ordem: j + 1, papel: it[2] || null, arquivado: false, fixo: null });
      });
    });
  }

  // Completa o que faltar (dados antigos, importados ou vindos da nuvem).
  function normalizar(d) {
    var v = vazio();
    if (!d || typeof d !== 'object') return v;
    ['categorias', 'itens', 'lancamentos', 'missoes', 'lembretes', 'metas'].forEach(function (k) {
      if (!Array.isArray(d[k])) d[k] = k === 'categorias' || k === 'itens' ? v[k] : [];
    });
    if (!d.perfil || typeof d.perfil !== 'object') d.perfil = v.perfil;
    d.versao = VERSAO;
    return d;
  }

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
    if (!d || !Array.isArray(d.lancamentos)) throw new Error('Arquivo não parece ser um backup deste programa.');
    db = normalizar(d);
    salvar();
  }
  function limpar() { db = vazio(); salvar(); }
  // Sem nada lançado (para a sincronização: dados vazios nunca vencem dados preenchidos).
  function semDados(d) {
    d = d || db;
    if (!d) return true;
    return !d.configurado && !['lancamentos', 'missoes', 'lembretes', 'metas'].some(function (k) { return Array.isArray(d[k]) && d[k].length; });
  }

  function novoId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function porOrdem(a, b) { return (a.ordem || 0) - (b.ordem || 0); }
  function proximaOrdem(lista) { return lista.reduce(function (m, x) { return Math.max(m, x.ordem || 0); }, 0) + 1; }
  function buscar(lista, id) {
    for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i];
    return null;
  }
  function texto(v) { return String(v == null ? '' : v).trim(); }

  // ---------- Perfil ----------
  function atualizarPerfil(campos) {
    if (campos.nome != null) db.perfil.nome = texto(campos.nome);
    if (campos.foto !== undefined) db.perfil.foto = campos.foto || null;
    db.configurado = true;
    salvar();
  }

  // ---------- Categorias e itens ----------
  function categoria(id) { return buscar(db.categorias, id); }
  function item(id) { return buscar(db.itens, id); }
  function categorias(tipo) { return db.categorias.filter(function (c) { return !tipo || c.tipo === tipo; }).sort(porOrdem); }
  function itensDa(categoriaId, comArquivados) {
    return db.itens.filter(function (i) { return i.categoriaId === categoriaId && (comArquivados || !i.arquivado); }).sort(porOrdem);
  }
  function categoriaDoItem(itemId) { var i = item(itemId); return i ? categoria(i.categoriaId) : null; }
  function tipoDoItem(itemId) { var c = categoriaDoItem(itemId); return c ? c.tipo : 'gasto'; }
  function nomeDoItem(itemId) { var i = item(itemId); return i ? i.nome : '(item removido)'; }
  function corDoItem(itemId) { var c = categoriaDoItem(itemId); return c ? c.cor : '#727b93'; }

  function salvarCategoria(campos, id) {
    var c = id ? categoria(id) : null;
    if (!c) { c = { id: novoId(), tipo: campos.tipo === 'entrada' ? 'entrada' : 'gasto', ordem: proximaOrdem(db.categorias), papel: null }; db.categorias.push(c); }
    c.nome = texto(campos.nome) || 'Categoria';
    c.cor = campos.cor || c.cor || '#3b8cf0';
    if (campos.papel !== undefined) c.papel = c.tipo === 'gasto' && campos.papel === 'saude' ? 'saude' : null;
    db.configurado = true;
    salvar();
    return c;
  }
  // Categoria com lançamentos não pode ser excluída (perderia o histórico).
  function excluirCategoria(id) {
    var ids = db.itens.filter(function (i) { return i.categoriaId === id; }).map(function (i) { return i.id; });
    if (db.lancamentos.some(function (l) { return ids.indexOf(l.itemId) >= 0; })) return false;
    db.itens = db.itens.filter(function (i) { return i.categoriaId !== id; });
    db.categorias = db.categorias.filter(function (c) { return c.id !== id; });
    db.configurado = true;
    salvar();
    return true;
  }
  // campos.fixo: null ou { valor, dia }. O mês de início de uma conta fixa nova é o mês atual.
  function salvarItem(campos, id) {
    var i = id ? item(id) : null;
    if (!i) {
      i = { id: novoId(), categoriaId: campos.categoriaId, ordem: proximaOrdem(itensDa(campos.categoriaId, true)), papel: null, arquivado: false, fixo: null };
      db.itens.push(i);
    }
    i.nome = texto(campos.nome) || 'Item';
    if (campos.papel !== undefined) i.papel = tipoDoItem(i.id) === 'entrada' && (campos.papel === 'diaria' || campos.papel === 'auxilio-saude') ? campos.papel : null;
    if (campos.fixo !== undefined) {
      if (campos.fixo && campos.fixo.valor > 0) {
        i.fixo = { valor: campos.fixo.valor, dia: Math.max(1, Math.min(31, Math.round(campos.fixo.dia) || 1)), desde: (i.fixo && i.fixo.desde) || UI.hoje().slice(0, 7) };
      } else i.fixo = null;
    }
    if (campos.arquivado !== undefined) i.arquivado = !!campos.arquivado;
    db.configurado = true;
    salvar();
    return i;
  }
  // Item com lançamentos é arquivado (some das listas, mas o histórico continua); sem lançamentos, é excluído.
  function excluirItem(id) {
    var usado = db.lancamentos.some(function (l) { return l.itemId === id; });
    if (usado) { var i = item(id); i.arquivado = true; i.fixo = null; }
    else db.itens = db.itens.filter(function (x) { return x.id !== id; });
    db.configurado = true;
    salvar();
    return usado ? 'arquivado' : 'excluido';
  }

  // ---------- Lançamentos ----------
  function lancamento(id) { return buscar(db.lancamentos, id); }
  function salvarLancamento(campos, id) {
    var l = id ? lancamento(id) : null;
    if (!l) { l = { id: novoId(), criadoEm: Date.now(), mesFixo: null, pulado: false }; db.lancamentos.push(l); }
    l.data = campos.data;
    l.itemId = campos.itemId;
    l.valor = Math.abs(Number(campos.valor) || 0);
    l.descricao = texto(campos.descricao);
    l.status = campos.status === 'previsto' ? 'previsto' : 'realizado';
    l.missaoId = campos.missaoId || null;
    if (campos.mesFixo !== undefined) l.mesFixo = campos.mesFixo || null;
    if (campos.pulado !== undefined) l.pulado = !!campos.pulado;
    salvar();
    return l;
  }
  function excluirLancamento(id) {
    db.lancamentos = db.lancamentos.filter(function (l) { return l.id !== id; });
    salvar();
  }

  function diasNoMes(mes) { var p = mes.split('-'); return new Date(Number(p[0]), Number(p[1]), 0).getDate(); }

  // Tudo o que cai num mês ('AAAA-MM'): lançamentos reais + contas fixas ainda em aberto (virtuais, não gravadas).
  // Uma conta fixa deixa de aparecer como prevista quando existe lançamento com `mesFixo` daquele mês.
  function lancamentosDoMes(mes) {
    var lista = db.lancamentos.filter(function (l) { return l.data && l.data.slice(0, 7) === mes && !l.pulado; });
    var quitados = {};
    db.lancamentos.forEach(function (l) { if (l.mesFixo === mes) quitados[l.itemId] = true; });
    db.itens.forEach(function (i) {
      if (!i.fixo || i.arquivado || quitados[i.id] || mes < i.fixo.desde) return;
      var dia = Math.min(i.fixo.dia, diasNoMes(mes));
      lista.push({ id: null, virtual: true, data: mes + '-' + UI.pad(dia), itemId: i.id, valor: i.fixo.valor, descricao: '', status: 'previsto', missaoId: null, mesFixo: mes });
    });
    return lista.sort(function (a, b) { return a.data === b.data ? (a.criadoEm || 0) - (b.criadoEm || 0) : (a.data < b.data ? -1 : 1); });
  }

  // Totais do mês: realizado e previsto (o que ainda falta pagar/receber), por tipo e por categoria.
  function resumoDoMes(mes) {
    var r = { entradas: 0, gastos: 0, entradasPrevistas: 0, gastosPrevistos: 0, categorias: {}, itens: {} };
    lancamentosDoMes(mes).forEach(function (l) {
      var tipo = tipoDoItem(l.itemId), previsto = l.status === 'previsto';
      if (tipo === 'entrada') r[previsto ? 'entradasPrevistas' : 'entradas'] += l.valor;
      else r[previsto ? 'gastosPrevistos' : 'gastos'] += l.valor;
      var c = categoriaDoItem(l.itemId), cid = c ? c.id : '?';
      var rc = r.categorias[cid] || (r.categorias[cid] = { realizado: 0, previsto: 0 });
      var ri = r.itens[l.itemId] || (r.itens[l.itemId] = { realizado: 0, previsto: 0 });
      rc[previsto ? 'previsto' : 'realizado'] += l.valor;
      ri[previsto ? 'previsto' : 'realizado'] += l.valor;
    });
    r.saldo = r.entradas - r.gastos;
    r.saldoPrevisto = r.saldo + r.entradasPrevistas - r.gastosPrevistos;
    return r;
  }

  // ---------- Missões (diárias × gastos fora da circunscrição) ----------
  function missao(id) { return buscar(db.missoes, id); }
  function missoes() {
    return db.missoes.slice().sort(function (a, b) { return (b.inicio || '') < (a.inicio || '') ? -1 : (b.inicio || '') > (a.inicio || '') ? 1 : (b.criadoEm || 0) - (a.criadoEm || 0); });
  }
  function salvarMissao(campos, id) {
    var m = id ? missao(id) : null;
    if (!m) { m = { id: novoId(), criadoEm: Date.now() }; db.missoes.push(m); }
    m.nome = texto(campos.nome) || 'Missão';
    m.destino = texto(campos.destino);
    m.inicio = campos.inicio || null;
    m.fim = campos.fim || null;
    salvar();
    return m;
  }
  // Os lançamentos continuam existindo, só deixam de pertencer à missão.
  function excluirMissao(id) {
    db.lancamentos.forEach(function (l) { if (l.missaoId === id) l.missaoId = null; });
    db.missoes = db.missoes.filter(function (m) { return m.id !== id; });
    salvar();
  }
  // filtro (opcional): função que recebe o lançamento e diz se ele entra na conta (ex.: só os de um mês).
  function saldoDaMissao(id, filtro) {
    var r = { recebido: 0, gasto: 0, aReceber: 0, aGastar: 0, lancamentos: [] };
    db.lancamentos.forEach(function (l) {
      if (l.missaoId !== id || l.pulado || (filtro && !filtro(l))) return;
      var entrada = tipoDoItem(l.itemId) === 'entrada', previsto = l.status === 'previsto';
      if (entrada) r[previsto ? 'aReceber' : 'recebido'] += l.valor; else r[previsto ? 'aGastar' : 'gasto'] += l.valor;
      r.lancamentos.push(l);
    });
    r.lancamentos.sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
    r.saldo = r.recebido - r.gasto;
    return r;
  }

  // ---------- Saúde (gastos × Auxílio Saúde) ----------
  function ehGastoSaude(l) { var c = categoriaDoItem(l.itemId); return !!(c && c.tipo === 'gasto' && c.papel === 'saude'); }
  function ehAuxilioSaude(l) { var i = item(l.itemId); return !!(i && i.papel === 'auxilio-saude'); }
  // prefixo: 'AAAA-MM' (um mês) ou 'AAAA' (um ano). Conta só o que já foi pago/recebido.
  function saldoSaude(prefixo) {
    var r = { gasto: 0, reembolso: 0 };
    db.lancamentos.forEach(function (l) {
      if (l.pulado || l.status === 'previsto' || !l.data || l.data.indexOf(prefixo) !== 0) return;
      if (ehGastoSaude(l)) r.gasto += l.valor; else if (ehAuxilioSaude(l)) r.reembolso += l.valor;
    });
    r.saldo = r.reembolso - r.gasto;
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
  // Lembretes que aparecem num dia do calendário: os daquele dia e os prazos que vencem nele.
  function lembretesDoDia(iso) {
    return db.lembretes.filter(function (l) { return dataLimite(l) === iso; }).sort(ordemLembrete);
  }

  // ---------- Metas ----------
  var AREAS = [['financeiro', 'Financeiro'], ['fisico', 'Físico'], ['geral', 'Geral']];
  var DIFICULDADES = [['facil', 'Fácil', 100], ['media', 'Média', 250], ['dificil', 'Difícil', 600], ['epica', 'Épica', 1500]];
  function meta(id) { return buscar(db.metas, id); }
  function salvarMeta(campos, id) {
    var m = id ? meta(id) : null;
    if (!m) { m = { id: novoId(), criadoEm: Date.now(), concluida: false, dataConclusao: null }; db.metas.push(m); }
    m.titulo = texto(campos.titulo) || 'Meta';
    m.descricao = texto(campos.descricao);
    m.area = AREAS.some(function (a) { return a[0] === campos.area; }) ? campos.area : 'geral';
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

  return {
    get db() { return db; },
    salvar: salvar, substituir: substituir, exportar: exportar, importar: importar, limpar: limpar, semDados: semDados,
    atualizarPerfil: atualizarPerfil,
    categoria: categoria, item: item, categorias: categorias, itensDa: itensDa, categoriaDoItem: categoriaDoItem,
    tipoDoItem: tipoDoItem, nomeDoItem: nomeDoItem, corDoItem: corDoItem,
    salvarCategoria: salvarCategoria, excluirCategoria: excluirCategoria, salvarItem: salvarItem, excluirItem: excluirItem,
    lancamento: lancamento, salvarLancamento: salvarLancamento, excluirLancamento: excluirLancamento,
    lancamentosDoMes: lancamentosDoMes, resumoDoMes: resumoDoMes, diasNoMes: diasNoMes,
    missao: missao, missoes: missoes, salvarMissao: salvarMissao, excluirMissao: excluirMissao, saldoDaMissao: saldoDaMissao,
    saldoSaude: saldoSaude, ehGastoSaude: ehGastoSaude, ehAuxilioSaude: ehAuxilioSaude,
    lembrete: lembrete, salvarLembrete: salvarLembrete, concluirLembrete: concluirLembrete, excluirLembrete: excluirLembrete,
    dataLimite: dataLimite, situacaoLembrete: situacaoLembrete, lembretesAtivos: lembretesAtivos, lembretesDoDia: lembretesDoDia, ordemLembrete: ordemLembrete,
    AREAS: AREAS, DIFICULDADES: DIFICULDADES, meta: meta, salvarMeta: salvarMeta, concluirMeta: concluirMeta, excluirMeta: excluirMeta, xpDaMeta: xpDaMeta
  };
})();
