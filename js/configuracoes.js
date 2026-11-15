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

  // Padrão de cada tipo de série (usado em exercícios novos, no "Usar padrão" e ao trocar o tipo de uma série).
  function painelSeries() {
    var campos = {};
    var linhas = Dados.ROTULOS_SERIE.map(function (r) {
      var p = Dados.padraoSerie(r[0]);
      var pct = el('input', { type: 'number', min: 0, max: 200, step: 5, value: p.pct });
      var reps = el('input', { type: 'text', value: p.reps, placeholder: 'ex.: 5-9', maxLength: 12 });
      var desc = el('input', { type: 'text', value: UI.campoTempo(p.descanso), placeholder: 'ex.: 1m30s', maxLength: 10 });
      campos[r[0]] = { pct: pct, reps: reps, descanso: desc };
      return el('div', { class: 'padrao-linha' }, [
        el('span', { class: 'padrao-nome', text: r[1] }),
        UI.campo('% da carga', pct), UI.campo('Repetições', reps), UI.campo('Descanso depois', desc)
      ]);
    });
    return el('section', { class: 'painel' }, [
      el('div', { class: 'painel-lado-topo' }, [el('h2', { class: 'secao-titulo', text: 'Padrão das séries de musculação' })]),
      el('p', { class: 'modal-desc cfg-ajuda', text: 'Vale para exercícios novos, para o botão "Usar padrão" e quando você troca o tipo de uma série. Os exercícios já cadastrados mantêm os valores deles. Na série válida, use uma faixa (ex.: 5-9): passar do máximo mostra os parabéns e a sugestão de aumentar a carga.' }),
      el('div', { class: 'padroes-series' }, linhas),
      el('div', { class: 'pasta-acoes' }, [
        UI.botao('Salvar padrão', function () {
          var dados = {}, erro = null;
          Object.keys(campos).forEach(function (k) {
            var d = UI.lerTempo(campos[k].descanso.value);
            if (isNaN(d)) erro = campos[k].descanso;
            dados[k] = { pct: Number(campos[k].pct.value), reps: campos[k].reps.value, descanso: d };
          });
          if (erro) { UI.aviso('Descanso inválido. Use, por exemplo, 45s, 2m ou 1m30s.'); erro.focus(); return; }
          Dados.salvarPadroesSerie(dados);
          UI.aviso('Padrão das séries salvo');
          App.atualizar();
        }, 'btn-primario'),
        UI.botao('Voltar ao padrão original', function () { Dados.restaurarPadroesSerie(); App.atualizar(); }, 'btn-contorno')
      ])
    ]);
  }

  function render(raiz) {
    raiz.appendChild(el('div', { class: 'pagina-topo' }, el('div', null, [
      el('h1', { class: 'pagina-titulo', text: 'Configurações' }),
      el('div', { class: 'pagina-subtitulo', text: 'Perfil e padrões dos treinos.' })
    ])));
    raiz.appendChild(painelPerfil());
    raiz.appendChild(painelSeries());
  }

  return { render: render };
})();
