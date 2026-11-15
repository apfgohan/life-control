// Horas de estudo lidas do Controle de Estudos.
//
// Os dois programas usam o mesmo projeto Firebase e a mesma conta Google: o Controle de Estudos grava em
// usuarios/{uid}/dados (texto JSON) e o Life Control só LÊ esse nó. Soma o tempo de todas as sessões, de todas as fases
// (Pré-Edital e concursos), inclusive o Anki. O resultado (segundos por dia) fica guardado neste aparelho, para
// funcionar sem internet, e é atualizado sempre que o Controle de Estudos gravar algo.
var Estudos = (function () {
  var CHAVE = 'life-control.estudos';
  var cache = carregar();       // { porDia: { 'AAAA-MM-DD': segundos }, atualizadoEm, lidoEm }
  var ligadoUid = null, refDados = null, refQuando = null;
  var estado = 'desligado';     // 'desligado' | 'lendo' | 'ok' | 'erro'
  var erro = '';

  function carregar() {
    try { var c = JSON.parse(localStorage.getItem(CHAVE) || 'null'); if (c && c.porDia) return c; } catch (e) { /* sem cache */ }
    return { porDia: {}, atualizadoEm: 0, lidoEm: 0 };
  }
  function guardar() { try { localStorage.setItem(CHAVE, JSON.stringify(cache)); } catch (e) { /* sem espaço */ } }

  // Junta as sessões do espaço ativo e dos outros espaços (fases) do Controle de Estudos.
  function somarSessoes(d) {
    var porDia = {};
    function somar(lista) {
      (lista || []).forEach(function (s) {
        if (!s || !s.data) return;
        porDia[s.data] = (porDia[s.data] || 0) + Math.max(0, Number(s.segundos) || 0);
      });
    }
    somar(d.sessoes);
    var esp = d.espacos || {};
    Object.keys(esp).forEach(function (k) { if (esp[k]) somar(esp[k].sessoes); });
    return porDia;
  }

  function aplicar(texto, quando) {
    var d;
    try { d = typeof texto === 'string' ? JSON.parse(texto) : texto; } catch (e) { estado = 'erro'; erro = 'Dados do Controle de Estudos ilegíveis.'; return; }
    if (!d) { estado = 'ok'; return; }
    cache = { porDia: somarSessoes(d), atualizadoEm: quando || d.atualizadoEm || 0, lidoEm: Date.now() };
    guardar();
    estado = 'ok';
    if (window.App && !document.querySelector('.modal-fundo')) App.atualizar();
  }

  function ler() {
    estado = 'lendo';
    return refDados.once('value').then(function (s) {
      return refQuando.once('value').then(function (q) { aplicar(s.val(), q.val()); });
    }).catch(function (e) { estado = 'erro'; erro = e && e.message ? e.message : String(e); console.warn('Controle de Estudos não lido', e); });
  }

  // Liga quando a nuvem do Life Control estiver conectada (mesma conta).
  function conferirConexao() {
    var n = window.Nuvem ? Nuvem.info() : null;
    var uid = n && n.uid && (n.estado === 'sincronizado' || n.estado === 'offline') ? n.uid : null;
    if (uid === ligadoUid) return;
    if (refQuando) refQuando.off();
    ligadoUid = uid; refDados = refQuando = null;
    if (!uid) { estado = 'desligado'; return; }
    var base = firebase.database().ref('usuarios/' + uid);
    refDados = base.child('dados');
    refQuando = base.child('atualizadoEm');
    refQuando.on('value', function (q) { if ((q.val() || 0) !== cache.atualizadoEm || !cache.lidoEm) ler(); }, function (e) { estado = 'erro'; erro = e.message; });
  }
  if (window.Nuvem) Nuvem.aoMudar(conferirConexao);

  // Segundos estudados de `inicio` a `fim` (datas inclusivas).
  function segundosEntre(inicio, fim) {
    var t = 0, p = cache.porDia;
    Object.keys(p).forEach(function (d) { if (d >= inicio && d <= fim) t += p[d]; });
    return t;
  }
  function horasEntre(inicio, fim) { return segundosEntre(inicio, fim) / 3600; }

  return {
    horasEntre: horasEntre, segundosEntre: segundosEntre, atualizar: function () { if (refDados) return ler(); return Promise.resolve(); },
    info: function () { return { estado: estado, erro: erro, lidoEm: cache.lidoEm, temDados: Object.keys(cache.porDia).length > 0, conectado: !!ligadoUid }; },
    // Para testes e para carregar um backup do Controle de Estudos à mão.
    aplicar: aplicar
  };
})();
