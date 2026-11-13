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
      // Compra no cartão: formaId de um cartão + parcelas + primeiraFatura (vencimento da 1ª parcela). A compra aparece
      // no dia em que foi feita, mas o gasto entra nas faturas (uma parcela por mês a partir de primeiraFatura).
      lancamentos: [],  // { id, data, itemId, valor, descricao, status: 'realizado'|'previsto', missaoId, mesFixo, pulado, formaId, parcelas, primeiraFatura, criadoEm }
      // Formas de pagamento. Cartão: dia do fechamento e dia do vencimento da fatura.
      formas: [],       // { id, nome, tipo: 'avista'|'cartao', fechamento, vencimento, ordem, arquivado }
      faturasPagas: {}, // 'formaId|AAAA-MM-DD' (vencimento) -> data em que a fatura foi paga
      // Metas recorrentes. periodo 'dia': vale nos dias da semana de `dias` (0 = segunda … 6 = domingo);
      // 'semana' / 'mes': fazer `vezes` vezes no período. feitos: os dias em que foi cumprida.
      habitos: [],      // { id, titulo, periodo, dias, vezes, desde, feitos: { 'AAAA-MM-DD': 1 }, criadoEm }
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
    // Os dias de fechamento e vencimento dos cartões são só um ponto de partida: ajuste em Configurações.
    [['pix', 'PIX', 'avista'], ['debito', 'Cartão de Débito', 'avista'], ['dinheiro', 'Dinheiro', 'avista'],
      ['credito-btg', 'Cartão de Crédito BTG', 'cartao'], ['credito-santander', 'Cartão de Crédito Santander', 'cartao']].forEach(function (f, i) {
      d.formas.push({ id: 'forma-' + f[0], nome: f[1], tipo: f[2], fechamento: f[2] === 'cartao' ? 3 : null, vencimento: f[2] === 'cartao' ? 10 : null, ordem: i + 1, arquivado: false });
    });
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
    ['categorias', 'itens', 'formas', 'lancamentos', 'missoes', 'lembretes', 'metas', 'habitos'].forEach(function (k) {
      if (!Array.isArray(d[k])) d[k] = k === 'categorias' || k === 'itens' || k === 'formas' ? v[k] : [];
    });
    if (!d.faturasPagas || typeof d.faturasPagas !== 'object') d.faturasPagas = {};
    d.habitos.forEach(function (h) { if (!h.feitos || typeof h.feitos !== 'object') h.feitos = {}; if (!Array.isArray(h.dias)) h.dias = []; });
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
    return !d.configurado && !['lancamentos', 'missoes', 'lembretes', 'metas', 'habitos'].some(function (k) { return Array.isArray(d[k]) && d[k].length; });
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
    if (campos.formaId !== undefined) {
      var f = campos.formaId ? forma(campos.formaId) : null;
      l.formaId = f && tipoDoItem(l.itemId) === 'gasto' ? f.id : null;
      if (l.formaId && f.tipo === 'cartao') {
        l.parcelas = Math.max(1, Math.min(48, Math.round(campos.parcelas) || 1));
        l.primeiraFatura = campos.primeiraFatura || vencimentoPadrao(f, l.data);
        l.status = 'realizado'; // a compra já aconteceu; o que fica em aberto é a fatura
      } else { l.parcelas = null; l.primeiraFatura = null; }
    }
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

  // ---------- Formas de pagamento e cartões ----------
  function forma(id) { return buscar(db.formas, id); }
  function formas(comArquivadas) { return db.formas.filter(function (f) { return comArquivadas || !f.arquivado; }).sort(porOrdem); }
  function nomeDaForma(id) { var f = forma(id); return f ? f.nome : ''; }
  function diaValido(v, padrao) { v = Math.round(Number(v)); return v >= 1 && v <= 31 ? v : padrao; }
  function salvarForma(campos, id) {
    var f = id ? forma(id) : null;
    if (!f) { f = { id: novoId(), ordem: proximaOrdem(db.formas), arquivado: false }; db.formas.push(f); }
    f.nome = texto(campos.nome) || 'Forma de pagamento';
    f.tipo = campos.tipo === 'cartao' ? 'cartao' : 'avista';
    f.fechamento = f.tipo === 'cartao' ? diaValido(campos.fechamento, 1) : null;
    f.vencimento = f.tipo === 'cartao' ? diaValido(campos.vencimento, 10) : null;
    db.configurado = true;
    salvar();
    return f;
  }
  // Forma já usada é arquivada (some das listas; o histórico e as faturas continuam).
  function excluirForma(id) {
    var usada = db.lancamentos.some(function (l) { return l.formaId === id; });
    if (usada) forma(id).arquivado = true; else db.formas = db.formas.filter(function (f) { return f.id !== id; });
    db.configurado = true;
    salvar();
    return usada ? 'arquivado' : 'excluido';
  }
  // m = ano * 12 + (mês - 1). O dia é limitado ao tamanho do mês (dia 31 em fevereiro vira 28).
  function dataNoMes(m, dia) {
    var mes = Math.floor(m / 12) + '-' + UI.pad(m % 12 + 1);
    return mes + '-' + UI.pad(Math.min(dia, diasNoMes(mes)));
  }
  function somarMesesData(iso, n) { var p = iso.split('-'); return dataNoMes(Number(p[0]) * 12 + Number(p[1]) - 1 + n, Number(p[2])); }
  // Vencimento da fatura em que cai uma compra feita em `dataCompra`: compras até o dia do fechamento entram
  // na fatura que fecha naquele mês; depois dele, na do mês seguinte.
  function vencimentoPadrao(f, dataCompra) {
    var p = dataCompra.split('-'), m = Number(p[0]) * 12 + Number(p[1]) - 1;
    if (Number(p[2]) > f.fechamento) m++;
    if (f.vencimento <= f.fechamento) m++; // a fatura vence no mês seguinte ao do fechamento
    return dataNoMes(m, f.vencimento);
  }
  function ehCompraCartao(l) { return !!(l && l.primeiraFatura); }
  // Parcelas de uma compra no cartão: [{ numero, de, data (vencimento), valor }]. A última leva os centavos que sobram.
  function parcelasDe(l) {
    var n = l.parcelas || 1, base = Math.floor(l.valor * 100 / n) / 100, lista = [];
    for (var k = 0; k < n; k++) {
      lista.push({ l: l, numero: k + 1, de: n, data: somarMesesData(l.primeiraFatura, k), valor: k < n - 1 ? base : Math.round((l.valor - base * (n - 1)) * 100) / 100 });
    }
    return lista;
  }
  function chaveFatura(formaId, data) { return formaId + '|' + data; }
  // Faturas de cartão: filtro(dataDeVencimento) diz quais interessam. Cada uma soma as parcelas que vencem naquele dia.
  function faturas(filtro) {
    var mapa = {};
    db.lancamentos.forEach(function (l) {
      if (!ehCompraCartao(l) || l.pulado) return;
      parcelasDe(l).forEach(function (p) {
        if (filtro && !filtro(p.data)) return;
        var chave = chaveFatura(l.formaId, p.data);
        var f = mapa[chave] || (mapa[chave] = { fatura: true, id: null, chave: chave, formaId: l.formaId, data: p.data, valor: 0, parcelas: [],
          pagaEm: db.faturasPagas[chave] || null });
        f.valor = Math.round((f.valor + p.valor) * 100) / 100;
        f.parcelas.push(p);
      });
    });
    return Object.keys(mapa).map(function (k) { var f = mapa[k]; f.status = f.pagaEm ? 'realizado' : 'previsto'; return f; })
      .sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
  }
  function marcarFatura(chave, paga) {
    if (paga) db.faturasPagas[chave] = UI.hoje(); else delete db.faturasPagas[chave];
    salvar();
  }

  // Tudo o que cai num mês ('AAAA-MM'): lançamentos reais (as compras no cartão aparecem no dia da compra, mas não
  // contam como gasto), faturas de cartão que vencem no mês e contas fixas ainda em aberto (virtuais, não gravadas).
  // Uma conta fixa deixa de aparecer como prevista quando existe lançamento com `mesFixo` daquele mês.
  function lancamentosDoMes(mes) {
    var lista = db.lancamentos.filter(function (l) { return l.data && l.data.slice(0, 7) === mes && !l.pulado; });
    lista = lista.concat(faturas(function (data) { return data.slice(0, 7) === mes; }));
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
    var r = { entradas: 0, gastos: 0, entradasPrevistas: 0, gastosPrevistos: 0, comprasNoCartao: 0, categorias: {}, itens: {} };
    function somar(itemId, valor, previsto) {
      if (tipoDoItem(itemId) === 'entrada') r[previsto ? 'entradasPrevistas' : 'entradas'] += valor;
      else r[previsto ? 'gastosPrevistos' : 'gastos'] += valor;
      var c = categoriaDoItem(itemId), cid = c ? c.id : '?';
      var rc = r.categorias[cid] || (r.categorias[cid] = { realizado: 0, previsto: 0 });
      var ri = r.itens[itemId] || (r.itens[itemId] = { realizado: 0, previsto: 0 });
      rc[previsto ? 'previsto' : 'realizado'] += valor;
      ri[previsto ? 'previsto' : 'realizado'] += valor;
    }
    lancamentosDoMes(mes).forEach(function (l) {
      // Fatura: cada parcela conta na categoria da compra, no mês em que a fatura vence.
      if (l.fatura) l.parcelas.forEach(function (p) { somar(p.l.itemId, p.valor, !l.pagaEm); });
      else if (ehCompraCartao(l)) r.comprasNoCartao += l.valor; // o gasto entra pelas faturas
      else somar(l.itemId, l.valor, l.status === 'previsto');
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
  // Metas diárias de um dia: { total, feitas } (para o calendário). Só conta dias a partir da criação da meta.
  function resumoHabitosDoDia(iso) {
    var r = { total: 0, feitas: 0 };
    db.habitos.forEach(function (h) {
      if (h.periodo !== 'dia' || !habitoValeNoDia(h, iso) || (iso < h.desde && !h.feitos[iso])) return;
      r.total++;
      if (h.feitos[iso]) r.feitas++;
    });
    return r;
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
    forma: forma, formas: formas, nomeDaForma: nomeDaForma, salvarForma: salvarForma, excluirForma: excluirForma,
    vencimentoPadrao: vencimentoPadrao, ehCompraCartao: ehCompraCartao, parcelasDe: parcelasDe, faturas: faturas, marcarFatura: marcarFatura,
    PERIODOS: PERIODOS, XP_HABITO: XP_HABITO, habito: habito, habitos: habitos, salvarHabito: salvarHabito, excluirHabito: excluirHabito,
    marcarHabito: marcarHabito, habitoValeNoDia: habitoValeNoDia, progressoHabito: progressoHabito, sequenciaHabito: sequenciaHabito,
    resumoHabitosDoDia: resumoHabitosDoDia, xpDosHabitos: xpDosHabitos, diaDaSemana: diaDaSemana,
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
