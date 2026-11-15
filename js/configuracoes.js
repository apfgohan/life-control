// Página "Configurações": perfil (nome e foto).
var Configuracoes = (function () {
  var el = UI.el;

  // A foto é reduzida para 256px e guardada junto com os dados (assim aparece em qualquer aparelho).
  function reduzirFoto(arquivo, pronto) {
    var leitor = new FileReader();
    leitor.onload = function () {
      var img = new Image();
      img.onload = function () {
        var lado = Math.min(img.width, img.height), tam = 256, c = document.createElement('canvas');
        c.width = c.height = tam;
        c.getContext('2d').drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, tam, tam);
        pronto(c.toDataURL('image/jpeg', 0.88));
      };
      img.onerror = function () { UI.aviso('Não foi possível ler a imagem.'); };
      img.src = leitor.result;
    };
    leitor.readAsDataURL(arquivo);
  }

  function painelPerfil() {
    var p = Dados.db.perfil;
    var nome = el('input', { type: 'text', value: p.nome || '', placeholder: 'Seu nome', maxLength: 60 });
    var arquivo = el('input', { type: 'file', accept: 'image/*', hidden: true, onchange: function () {
      if (arquivo.files[0]) reduzirFoto(arquivo.files[0], function (url) { Dados.atualizarPerfil({ foto: url }); App.atualizar(); });
    } });
    return el('section', { class: 'painel' }, [
      el('h2', { class: 'secao-titulo', text: 'Perfil' }),
      el('div', { class: 'perfil-edicao' }, [
        App.fotoPerfil(p),
        el('div', { class: 'perfil-campos' }, [
          UI.campo('Nome', nome),
          el('div', { class: 'pasta-acoes' }, [
            UI.botao('Salvar nome', function () { Dados.atualizarPerfil({ nome: nome.value }); App.atualizar(); UI.aviso('Perfil salvo'); }, 'btn-primario'),
            UI.botao('Trocar foto…', function () { arquivo.click(); }, 'btn-secundario'),
            p.foto ? UI.botao('Remover foto', function () { Dados.atualizarPerfil({ foto: null }); App.atualizar(); }, 'btn-contorno') : null,
            arquivo
          ])
        ])
      ])
    ]);
  }

  function render(raiz) {
    raiz.appendChild(el('div', { class: 'pagina-topo' }, el('div', null, [
      el('h1', { class: 'pagina-titulo', text: 'Configurações' }),
      el('div', { class: 'pagina-subtitulo', text: 'Seu perfil.' })
    ])));
    raiz.appendChild(painelPerfil());
  }

  return { render: render };
})();
