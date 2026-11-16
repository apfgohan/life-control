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

  // ---------- Exercícios (biblioteca por grupamento) ----------
  var grupoAtual = 'todos';
  function kg(v) { return (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' kg'; }
  function textoPR(pr) { return !pr ? 'sem registro' : pr.semCarga ? pr.reps + ' reps' : kg(pr.carga) + ' × ' + pr.reps; }
  function nomeGrupo(g) { var x = Dados.GRUPOS.filter(function (y) { return y[0] === g; })[0]; return x ? x[1] : ''; }

  function segmentado(opcoes, atual, aoEscolher) {
    var botoes = opcoes.map(function (o) {
      return el('button', { type: 'button', class: o[0] === atual ? 'ativo' : '', text: o[1], onclick: function () {
        botoes.forEach(function (b, i) { b.classList.toggle('ativo', opcoes[i][0] === o[0]); });
        aoEscolher(o[0]);
      } });
    });
    return el('div', { class: 'segmentado' }, botoes);
  }

  // Cadastro de um exercício da biblioteca. aoSalvar(b) é chamado depois de salvar (usado pelo editor de treino).
  function editarExercicio(id, grupoPadrao, aoSalvar) {
    var b = Dados.base(id);
    var grupo = b ? b.grupo : (grupoPadrao && grupoPadrao !== 'todos' ? grupoPadrao : 'torso'), equipamento = b ? b.equipamento : 'livre';
    var nome = el('input', { type: 'text', value: b ? b.nome : '', placeholder: 'Ex.: Supino reto', maxLength: 60 });
    var obs = el('input', { type: 'text', value: b ? b.obs || '' : '', placeholder: 'Ex.: pegada fechada, banco 30° (opcional)', maxLength: 120 });
    var pr = b ? Dados.prDaBase(b.id) : null;
    var usado = b ? Dados.treinosComBase(b.id) : [];
    var botoes = [{ texto: 'Cancelar', classe: 'btn-secundario' }, { texto: 'Salvar', classe: 'btn-primario', acao: function () {
      if (!nome.value.trim()) { nome.focus(); return false; }
      var repetido = Dados.biblioteca(null, true).filter(function (x) { return x.id !== id && x.nome.trim().toLowerCase() === nome.value.trim().toLowerCase(); })[0];
      if (repetido) { UI.aviso('Já existe "' + repetido.nome + '" na biblioteca.'); nome.focus(); return false; }
      var salvo = Dados.salvarBase({ nome: nome.value, grupo: grupo, equipamento: equipamento, obs: obs.value }, id);
      if (aoSalvar) aoSalvar(salvo); else App.atualizar();
    } }];
    if (b) botoes.unshift({ texto: 'Excluir', classe: 'btn-perigo btn-esquerda', acao: function () {
      if (usado.length) { setTimeout(function () { UI.aviso('"' + b.nome + '" está em ' + usado.map(function (t) { return t.nome; }).join(', ') + '. Tire do treino antes de excluir.'); }, 0); return; }
      UI.confirmar('Excluir "' + b.nome + '" da biblioteca?' + (pr ? ' Ele já tem registros: sai das listas, mas o histórico e o PR continuam guardados.' : ''), function () {
        Dados.excluirBase(b.id); App.atualizar();
      });
    } });
    UI.modal(b ? 'Editar exercício' : 'Novo exercício', [
      UI.campo('Nome', nome),
      el('div', { class: 'campo' }, [el('span', { class: 'campo-rotulo', text: 'Grupamento' }), segmentado(Dados.GRUPOS, grupo, function (v) { grupo = v; })]),
      el('div', { class: 'campo' }, [el('span', { class: 'campo-rotulo', text: 'Equipamento' }), segmentado(Dados.EQUIPAMENTOS, equipamento, function (v) { equipamento = v; }),
        el('span', { class: 'campo-ajuda', text: 'Máquina: cargas de ' + Dados.PASSO_MAQUINA + ' em ' + Dados.PASSO_MAQUINA + ' kg, arredondadas para baixo. Peso do corpo: só repetições.' })]),
      UI.campo('Observação', obs),
      b ? el('div', { class: 'registro-resumo' }, [
        UI.metrica('Recorde (PR)', textoPR(pr)),
        UI.metrica('Nos treinos', usado.length ? usado.map(function (t) { return t.nome; }).join(', ') : 'nenhum')
      ]) : null
    ], botoes, { icone: 'halter', subtitulo: 'Cadastre uma vez e use em qualquer treino. O PR vem de todos os treinos registrados.' });
    if (!b) nome.focus();
  }

  function painelExercicios() {
    var todos = Dados.biblioteca();
    var lista = todos.filter(function (b) { return grupoAtual === 'todos' || b.grupo === grupoAtual; });
    var filtros = el('div', { class: 'segmentado' }, [['todos', 'Todos']].concat(Dados.GRUPOS).map(function (g) {
      var n = todos.filter(function (b) { return g[0] === 'todos' || b.grupo === g[0]; }).length;
      return el('button', { type: 'button', class: grupoAtual === g[0] ? 'ativo' : '', onclick: function () { grupoAtual = g[0]; App.atualizar(); } }, [g[1], n ? el('span', { class: 'secao-contagem', text: n }) : null]);
    }));
    function linha(b) {
      var pr = Dados.prDaBase(b.id), usado = Dados.treinosComBase(b.id);
      return el('button', { type: 'button', class: 'biblioteca-linha', title: 'Editar', onclick: function () { editarExercicio(b.id); } }, [
        el('span', { class: 'biblioteca-texto' }, [
          el('span', { class: 'exercicio-nome', text: b.nome }),
          el('span', { class: 'exercicio-meta', text: [Dados.EQUIPAMENTOS.filter(function (q) { return q[0] === b.equipamento; })[0][1],
            usado.length ? usado.map(function (t) { return t.nome; }).join(', ') : 'em nenhum treino'].filter(Boolean).join(' · ') })
        ]),
        el('span', { class: 'biblioteca-pr' + (pr ? '' : ' vazio-pr') }, [UI.icone('trofeu'), el('span', { text: pr ? textoPR(pr) : '—' })])
      ]);
    }
    var corpo;
    if (!lista.length) corpo = el('p', { class: 'modal-desc', text: todos.length ? 'Nenhum exercício neste grupamento.' : 'Cadastre os exercícios uma vez (por grupamento) e escolha-os ao montar os treinos.' });
    else if (grupoAtual === 'todos') corpo = el('div', { class: 'biblioteca-grupos' }, Dados.GRUPOS.map(function (g) {
      var doGrupo = lista.filter(function (b) { return b.grupo === g[0]; });
      return doGrupo.length ? el('div', { class: 'biblioteca-grupo' }, [el('div', { class: 'habitos-grupo-titulo', text: g[1] }), el('div', { class: 'lista-biblioteca' }, doGrupo.map(linha))]) : null;
    }));
    else corpo = el('div', { class: 'lista-biblioteca' }, lista.map(linha));
    return el('section', { class: 'painel' }, [
      el('div', { class: 'painel-lado-topo' }, [
        el('h2', { class: 'secao-titulo' }, ['Exercícios', todos.length ? el('span', { class: 'secao-contagem', text: todos.length }) : null]),
        UI.botao('Novo exercício', function () { editarExercicio(null, grupoAtual); }, 'btn-primario btn-mini', 'mais')
      ]),
      todos.length ? filtros : null,
      corpo
    ]);
  }

  function render(raiz) {
    raiz.appendChild(el('div', { class: 'pagina-topo' }, el('div', null, [
      el('h1', { class: 'pagina-titulo', text: 'Configurações' }),
      el('div', { class: 'pagina-subtitulo', text: 'Perfil, exercícios e padrões dos treinos.' })
    ])));
    raiz.appendChild(painelPerfil());
    raiz.appendChild(painelExercicios());
    raiz.appendChild(painelSeries());
  }

  return { render: render, editarExercicio: editarExercicio, textoPR: textoPR, nomeGrupo: nomeGrupo };
})();
