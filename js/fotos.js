// Fotos de evolução (frente, lateral, costas). Ficam fora dos dados principais, porque são grandes:
//   - neste aparelho: IndexedDB (banco "life-control-fotos");
//   - na nuvem: usuarios/{uid}/lifecontrol/fotos/{id} (uma por foto), baixada só quando é aberta.
// Sem nuvem no momento, a foto fica marcada como pendente e sobe quando a conexão voltar.
var Fotos = (function () {
  var BANCO = 'life-control-fotos', CHAVE_PENDENTES = 'life-control.fotos-pendentes';
  var LADO = 1000, QUALIDADE = 0.8;
  var cache = {};

  function idb(modo, operacao) {
    return new Promise(function (ok, falha) {
      var req = indexedDB.open(BANCO, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('fotos'); };
      req.onerror = function () { falha(req.error); };
      req.onsuccess = function () {
        var tx = req.result.transaction('fotos', modo);
        var r = operacao(tx.objectStore('fotos'));
        tx.oncomplete = function () { ok(r && r.result); };
        tx.onerror = function () { falha(tx.error); };
      };
    });
  }
  function lerLocal(id) { return idb('readonly', function (st) { return st.get(id); }); }
  function gravarLocal(id, url) { return idb('readwrite', function (st) { return st.put(url, id); }); }
  function apagarLocal(id) { return idb('readwrite', function (st) { return st.delete(id); }); }
  function todasLocais() {
    return new Promise(function (ok, falha) {
      var req = indexedDB.open(BANCO, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('fotos'); };
      req.onerror = function () { falha(req.error); };
      req.onsuccess = function () {
        var st = req.result.transaction('fotos', 'readonly').objectStore('fotos'), lista = [];
        var c = st.openCursor();
        c.onsuccess = function () { var x = c.result; if (x) { lista.push({ id: x.key, dados: x.value }); x.continue(); } else ok(lista); };
        c.onerror = function () { falha(c.error); };
      };
    });
  }

  function pendentes() { try { return JSON.parse(localStorage.getItem(CHAVE_PENDENTES) || '[]'); } catch (e) { return []; } }
  function guardarPendentes(l) { try { localStorage.setItem(CHAVE_PENDENTES, JSON.stringify(l)); } catch (e) { /* sem espaço */ } }
  function marcarPendente(id) { var l = pendentes(); if (l.indexOf(id) < 0) { l.push(id); guardarPendentes(l); } }

  // Reduz a foto (maior lado 1000 px, JPEG) para caber bem no aparelho e na nuvem.
  function reduzir(arquivo) {
    return new Promise(function (ok, falha) {
      var leitor = new FileReader();
      leitor.onerror = function () { falha(leitor.error); };
      leitor.onload = function () {
        var img = new Image();
        img.onerror = function () { falha(new Error('Não foi possível ler a imagem.')); };
        img.onload = function () {
          var f = Math.min(1, LADO / Math.max(img.width, img.height)), c = document.createElement('canvas');
          c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          ok(c.toDataURL('image/jpeg', QUALIDADE));
        };
        img.src = leitor.result;
      };
      leitor.readAsDataURL(arquivo);
    });
  }

  function enviar(id, url) {
    if (!window.Nuvem || !Nuvem.podeGravar()) { marcarPendente(id); return Promise.resolve(false); }
    return Nuvem.salvarFoto(id, { dados: url, em: Date.now() }).then(function () { return true; }, function (e) { console.warn('Foto não enviada', e); marcarPendente(id); return false; });
  }

  // Guarda uma foto nova e devolve o id.
  function salvar(url) {
    var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    cache[id] = url;
    return gravarLocal(id, url).catch(function (e) { console.warn('Foto não guardada neste aparelho', e); }).then(function () { enviar(id, url); return id; });
  }

  function obter(id) {
    if (!id) return Promise.resolve(null);
    if (cache[id]) return Promise.resolve(cache[id]);
    return lerLocal(id).catch(function () { return null; }).then(function (url) {
      if (url) { cache[id] = url; return url; }
      if (!window.Nuvem || !Nuvem.podeGravar()) return null;
      return Nuvem.buscarFoto(id).then(function (rec) {
        if (!rec || !rec.dados) return null;
        cache[id] = rec.dados;
        gravarLocal(id, rec.dados).catch(function () { /* só cache */ });
        return rec.dados;
      }, function () { return null; });
    });
  }

  function remover(id) {
    if (!id) return Promise.resolve();
    delete cache[id];
    guardarPendentes(pendentes().filter(function (x) { return x !== id; }));
    var p = apagarLocal(id).catch(function () {});
    if (window.Nuvem && Nuvem.podeGravar()) Nuvem.apagarFoto(id).catch(function () {});
    return p;
  }

  function enviarPendentes() {
    var l = pendentes();
    if (!l.length || !window.Nuvem || !Nuvem.podeGravar()) return;
    guardarPendentes([]);
    l.forEach(function (id) { lerLocal(id).then(function (url) { if (url) enviar(id, url); }); });
  }

  // Backup manual: as fotos dos registros de medidas vão junto no arquivo.
  function exportarTodas(ids) {
    return Promise.all(ids.map(function (id) { return obter(id).then(function (url) { return url ? { id: id, dados: url } : null; }); }))
      .then(function (l) { return l.filter(Boolean); });
  }
  function importarTodas(lista) {
    return Promise.all((lista || []).map(function (f) { cache[f.id] = f.dados; return gravarLocal(f.id, f.dados).then(function () { return enviar(f.id, f.dados); }); }));
  }

  // Elemento <img> que carrega a foto quando ela chega.
  var VAZIA = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  function imagem(id, classe, alt) {
    var img = UI.el('img', { class: 'foto ' + (classe || ''), alt: alt || '', src: VAZIA });
    if (!id) { img.classList.add('vazia'); return img; }
    obter(id).then(function (url) { if (url) img.src = url; else img.classList.add('indisponivel'); });
    return img;
  }

  return { VAZIA: VAZIA, reduzir: reduzir, salvar: salvar, obter: obter, remover: remover, enviarPendentes: enviarPendentes,
    exportarTodas: exportarTodas, importarTodas: importarTodas, imagem: imagem, todasLocais: todasLocais };
})();
