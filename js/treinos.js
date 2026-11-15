// Treinos: cadastro (#/treinos, #/treinos/<id>) e execução do treino em andamento (#/treino, #/treino/<exercício>).
//
// Na execução, todos os exercícios aparecem numa lista e podem ser feitos em qualquer ordem (aparelho ocupado).
// Ao abrir um exercício, o programa mostra as séries com a carga de cada uma (em % da carga principal) e o último
// resultado. No fim, informa-se a carga da última série e as repetições até a falha; essa carga vira a principal
// do próximo treino. O treino pode ser finalizado a qualquer momento.
var Treinos = (function () {
  var el = UI.el;

  // ---------- Utilidades ----------
  function kg(v) { return (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' kg'; }
  function nomeRotulo(r) { var x = Dados.ROTULOS_SERIE.filter(function (s) { return s[0] === r; })[0]; return x ? x[1] : 'Série'; }
  function duracaoCurta(seg) {
    var h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60);
    return h ? h + 'h' + UI.pad(m) : m + ' min';
  }
  function textoUltimo(u) { return u ? kg(u.carga) + ' × ' + u.reps + ' · ' + UI.fmtDiaMes(u.data) : 'Primeira vez'; }
  function resumoSeries(e) {
    return e.series.map(function (s) { return s.pct + '% ' + kg(Dados.cargaDaSerie(e.carga, s, e.equipamento)); }).join(' · ');
  }
  function nomeEquip(e) { return e.equipamento === 'maquina' ? 'Máquina' : 'Peso livre'; }
  // "3 séries · Máquina · descansos 45 s / 2 min"
  function metaExercicio(e) {
    var d = e.series.map(function (s) { return s.descanso || 0; }).filter(function (x, i) { return x && i < e.series.length - 1; });
    return e.series.length + (e.series.length === 1 ? ' série' : ' séries') + ' · ' + nomeEquip(e) + (d.length ? ' · descanso ' + d.map(UI.fmtTempo).join(' / ') : '');
  }

  // Cronômetro: qualquer elemento com data-desde (timestamp) mostra o tempo decorrido, atualizado a cada segundo.
  function cronometro(inicio, classe) { return el('span', { class: 'cronometro ' + (classe || ''), 'data-desde': inicio, text: UI.fmtDuracao((Date.now() - inicio) / 1000) }); }
  setInterval(function () {
    document.querySelectorAll('[data-desde]').forEach(function (n) { n.textContent = UI.fmtDuracao((Date.now() - Number(n.getAttribute('data-desde'))) / 1000); });
  }, 1000);

  // ---------- Iniciar ----------
  function iniciar(treinoId) {
    var atual = Dados.treinoEmAndamento();
    if (atual && atual.treinoId !== treinoId) {
      UI.confirmar('O ' + atual.nomeTreino + ' ainda está em andamento. Finalize ou cancele esse treino antes de começar outro.', function () { location.hash = '#/treino'; }, 'Ir para o treino');
      return;
    }
    var t = Dados.treino(treinoId);
    if (!atual && t.tipo === 'musculacao' && !t.exercicios.length) { UI.aviso('Cadastre os exercícios do ' + t.nome + ' primeiro.'); location.hash = '#/treinos/' + t.id; return; }
    Dados.iniciarTreino(treinoId);
    location.hash = '#/treino';
  }

  // ---------- Cadastro: lista de treinos ----------
  function editarTreino(id) {
    var t = id ? Dados.treino(id) : null;
    var nome = el('input', { type: 'text', value: t ? t.nome : '', placeholder: 'Ex.: Treino A – Torso', maxLength: 60 });
    var tipo = el('select', { disabled: !!t }, Dados.TIPOS_TREINO.map(function (x) { return el('option', { value: x[0], text: x[1], selected: (t ? t.tipo : 'musculacao') === x[0] }); }));
    var botoes = [{ texto: 'Cancelar', classe: 'btn-secundario' }, { texto: t ? 'Salvar' : 'Criar treino', classe: 'btn-primario', acao: function () {
      if (!nome.value.trim()) { nome.focus(); return false; }
      var novo = Dados.salvarTreino({ nome: nome.value, tipo: tipo.value }, id);
      if (!t && novo.tipo === 'musculacao') location.hash = '#/treinos/' + novo.id; else App.atualizar();
    } }];
    if (t) botoes.unshift({ texto: 'Excluir', classe: 'btn-perigo btn-esquerda', acao: function () {
      UI.confirmar('Excluir o "' + t.nome + '"? Se ele já foi feito, só sai das listas e o histórico continua.', function () {
        UI.aviso(Dados.excluirTreino(t.id) === 'arquivado' ? 'Treino arquivado (o histórico foi mantido)' : 'Treino excluído');
        location.hash = '#/treinos';
        App.atualizar();
      });
    } });
    UI.modal(t ? 'Editar treino' : 'Novo treino', [
      UI.campo('Nome', nome),
      UI.campo('Tipo', tipo, t ? null : 'Musculação tem exercícios e séries; corrida registra distância e tempo.')
    ], botoes, { icone: 'halter' });
  }

  function cartaoTreino(t) {
    var ultimo = Dados.historico(t.id)[0], atual = Dados.treinoEmAndamento(), emCurso = atual && atual.treinoId === t.id;
    return el('div', { class: 'treino-cartao' + (emCurso ? ' em-curso' : '') }, [
      el('button', { type: 'button', class: 'treino-cartao-corpo', title: t.tipo === 'musculacao' ? 'Editar exercícios' : 'Editar', onclick: function () {
        if (t.tipo === 'musculacao') location.hash = '#/treinos/' + t.id; else editarTreino(t.id);
      } }, [
        el('span', { class: 'treino-cartao-nome', text: t.nome }),
        el('span', { class: 'treino-cartao-meta', text: (t.tipo === 'corrida' ? 'Corrida' : t.exercicios.length + (t.exercicios.length === 1 ? ' exercício' : ' exercícios'))
          + ' · ' + (ultimo ? 'último em ' + UI.fmtDiaMes(ultimo.data) + ' (' + duracaoCurta(Dados.duracaoSeg(ultimo)) + ')' : 'ainda não feito') })
      ]),
      el('div', { class: 'treino-cartao-acoes' }, [
        el('button', { type: 'button', class: 'btn-icone', title: 'Subir', onclick: function () { Dados.moverTreino(t.id, -1); App.atualizar(); } }, UI.icone('subir')),
        el('button', { type: 'button', class: 'btn-icone', title: 'Descer', onclick: function () { Dados.moverTreino(t.id, 1); App.atualizar(); } }, UI.icone('descer')),
        UI.botao(emCurso ? 'Continuar' : 'Iniciar', function () { iniciar(t.id); }, 'btn-primario btn-mini', 'play')
      ])
    ]);
  }

  function linhaHistorico(r) {
    var seg = Dados.duracaoSeg(r);
    return el('button', { type: 'button', class: 'historico-linha', title: 'Ver detalhes', onclick: function () { abrirRegistro(r.id); } }, [
      el('span', { class: 'historico-data', text: UI.fmtDiaMes(r.data) }),
      el('span', { class: 'historico-corpo' }, [
        el('span', { class: 'historico-nome', text: r.nomeTreino }),
        el('span', { class: 'historico-meta', text: r.tipo === 'corrida'
          ? (r.corrida && r.corrida.km ? r.corrida.km.toLocaleString('pt-BR') + ' km' : 'Corrida')
          : r.exercicios.length + (r.exercicios.length === 1 ? ' exercício' : ' exercícios') })
      ]),
      el('span', { class: 'historico-tempo', text: duracaoCurta(seg) })
    ]);
  }

  function abrirRegistro(id) {
    var r = Dados.registro(id), seg = Dados.duracaoSeg(r);
    var corpo = [
      el('div', { class: 'registro-resumo' }, [
        UI.metrica('Duração', UI.fmtDuracao(seg)),
        r.tipo === 'corrida' ? UI.metrica('Distância', r.corrida && r.corrida.km ? r.corrida.km.toLocaleString('pt-BR') + ' km' : '—') : UI.metrica('Exercícios', String(r.exercicios.length)),
        r.tipo === 'corrida' && r.corrida && r.corrida.km ? UI.metrica('Ritmo', ritmo(seg, r.corrida.km)) : UI.metrica('XP', '+' + Dados.xpDoRegistro(r))
      ])
    ];
    if (r.exercicios.length) corpo.push(el('div', { class: 'lista-feitos' }, r.exercicios.map(function (x) {
      return el('div', { class: 'feito-linha' }, [el('span', { text: x.nome }), el('strong', { text: kg(x.carga) + ' × ' + x.reps })]);
    })));
    if (r.obs) corpo.push(el('p', { class: 'modal-desc', text: r.obs }));
    UI.modal(r.nomeTreino, corpo, [
      { texto: 'Excluir registro', classe: 'btn-perigo btn-esquerda', acao: function () {
        UI.confirmar('Excluir o registro do ' + r.nomeTreino + ' de ' + UI.fmtData(r.data) + '? O XP dele também sai.', function () { Dados.excluirRegistro(r.id); App.atualizar(); });
      } },
      { texto: 'Fechar', classe: 'btn-primario' }
    ], { icone: 'halter', subtitulo: UI.fmtData(r.data) + ' · ' + new Date(r.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) });
  }
  function ritmo(seg, km) {
    if (!km) return '—';
    var s = Math.round(seg / km);
    return Math.floor(s / 60) + ':' + UI.pad(s % 60) + ' /km';
  }

  function renderLista(raiz) {
    var lista = Dados.treinos(), hist = Dados.historico(), atual = Dados.treinoEmAndamento();
    raiz.appendChild(el('div', { class: 'pagina-topo' }, [
      el('div', null, [
        el('h1', { class: 'pagina-titulo', text: 'Treinos' }),
        el('div', { class: 'pagina-subtitulo', text: 'Cadastre seus treinos de musculação e corrida. Para treinar, use Iniciar.' })
      ]),
      el('div', { class: 'pagina-acoes' }, UI.botao('Novo treino', function () { editarTreino(); }, 'btn-primario', 'mais'))
    ]));
    if (atual) raiz.appendChild(cartaoEmAndamento(atual));
    if (!lista.length) raiz.appendChild(el('div', { class: 'vazio' }, [
      el('p', { class: 'vazio-destaque', text: 'Nenhum treino cadastrado' }),
      el('p', { text: 'Crie o Treino A, B, C… com os exercícios, as séries e a carga de cada uma, e um treino de corrida se quiser.' }),
      el('div', { class: 'vazio-acoes' }, UI.botao('Criar o primeiro treino', function () { editarTreino(); }, 'btn-primario'))
    ]));
    else raiz.appendChild(el('div', { class: 'lista-treinos' }, lista.map(cartaoTreino)));

    if (hist.length) raiz.appendChild(el('section', { class: 'painel' }, [
      el('h2', { class: 'secao-titulo' }, ['Histórico', el('span', { class: 'secao-contagem', text: hist.length })]),
      el('div', { class: 'lista-historico' }, hist.slice(0, 20).map(linhaHistorico))
    ]));
  }

  // ---------- Cadastro: exercícios de um treino ----------
  function editarExercicio(treinoId, exId) {
    var e = exId ? Dados.exercicio(treinoId, exId) : null;
    var nome = el('input', { type: 'text', value: e ? e.nome : '', placeholder: 'Ex.: T-Bar Row', maxLength: 60 });
    var equipamento = (e && e.equipamento) || 'livre';
    var botoesEquip = Dados.EQUIPAMENTOS.map(function (x) {
      return el('button', { type: 'button', class: equipamento === x[0] ? 'ativo' : '', text: x[1], onclick: function () {
        equipamento = x[0];
        botoesEquip.forEach(function (b, i) { b.classList.toggle('ativo', Dados.EQUIPAMENTOS[i][0] === equipamento); });
        ajudaEquip.textContent = textoEquip();
        desenhar();
      } });
    });
    function textoEquip() { return equipamento === 'maquina' ? 'Cargas arredondadas para baixo, de ' + Dados.PASSO_MAQUINA + ' em ' + Dados.PASSO_MAQUINA + ' kg (85 kg a 50% = 40 kg).' : 'Cargas arredondadas para o kg mais próximo.'; }
    var ajudaEquip = el('span', { class: 'campo-ajuda', text: textoEquip() });
    var carga = el('input', { type: 'text', inputMode: 'decimal', value: e && e.carga ? String(e.carga).replace('.', ',') : '', placeholder: 'Ex.: 80' });
    var obs = el('input', { type: 'text', value: e ? e.obs : '', placeholder: 'Ex.: pegada fechada, banco 30° (opcional)', maxLength: 120 });
    var series = (e ? e.series : Dados.SERIES_PADRAO).map(function (s) { return Object.assign({}, s); });
    var caixa = el('div', { class: 'editor-series' });

    function cargaAtual() { var v = UI.lerValor(carga.value); return v > 0 ? v : 0; }
    function campoDescanso(s, ultima) {
      var inp = el('input', { type: 'text', value: UI.campoTempo(s.descanso), placeholder: ultima ? 'opcional' : 'ex.: 45s', maxLength: 10 });
      inp.addEventListener('input', function () {
        var v = UI.lerTempo(inp.value);
        inp.classList.toggle('invalido', isNaN(v));
        if (!isNaN(v)) s.descanso = v;
      });
      return el('label', { class: 'descanso-editor' + (ultima ? ' ultima' : '') }, [
        UI.icone('relogio'),
        el('span', { text: ultima ? 'Descanso antes do próximo exercício' : 'Descanso' }),
        inp
      ]);
    }
    function desenhar() {
      caixa.innerHTML = '';
      series.forEach(function (s, i) {
        var rot = el('select', { onchange: function () { s.rotulo = rot.value; } }, Dados.ROTULOS_SERIE.map(function (r) { return el('option', { value: r[0], text: r[1], selected: s.rotulo === r[0] }); }));
        var pct = el('input', { type: 'number', min: 0, max: 200, step: 5, value: s.pct, oninput: function () { s.pct = Number(pct.value) || 0; previa.textContent = kg(Dados.cargaDaSerie(cargaAtual(), s, equipamento)); } });
        var reps = el('input', { type: 'text', value: s.reps, placeholder: 'reps', maxLength: 12, oninput: function () { s.reps = reps.value; } });
        var previa = el('span', { class: 'serie-previa', text: kg(Dados.cargaDaSerie(cargaAtual(), s, equipamento)) });
        caixa.appendChild(el('div', { class: 'serie-editor' }, [
          el('span', { class: 'serie-numero', text: i + 1 }),
          rot,
          el('label', { class: 'serie-pct' }, [pct, el('span', { text: '%' })]),
          previa,
          reps,
          el('button', { type: 'button', class: 'btn-icone', title: 'Tirar série', onclick: function () { series.splice(i, 1); desenhar(); } }, UI.icone('lixo'))
        ]));
        caixa.appendChild(campoDescanso(s, i === series.length - 1));
      });
    }
    carga.addEventListener('input', desenhar);
    desenhar();

    var botoes = [{ texto: 'Cancelar', classe: 'btn-secundario' }, { texto: 'Salvar', classe: 'btn-primario', acao: function () {
      if (!nome.value.trim()) { nome.focus(); return false; }
      if (!series.length) { UI.aviso('Coloque pelo menos uma série.'); return false; }
      if (caixa.querySelector('.invalido')) { UI.aviso('Descanso inválido. Use, por exemplo, 45s, 2m ou 1m30s.'); caixa.querySelector('.invalido').focus(); return false; }
      Dados.salvarExercicio(treinoId, { nome: nome.value, equipamento: equipamento, carga: carga.value, obs: obs.value, series: series }, exId);
      App.atualizar();
    } }];
    if (e) botoes.unshift({ texto: 'Excluir', classe: 'btn-perigo btn-esquerda', acao: function () {
      UI.confirmar('Tirar "' + e.nome + '" deste treino? Os registros antigos dele continuam no histórico.', function () { Dados.excluirExercicio(treinoId, e.id); App.atualizar(); });
    } });
    UI.modal(e ? 'Editar exercício' : 'Novo exercício', [
      UI.campo('Exercício', nome),
      el('div', { class: 'campo' }, [el('span', { class: 'campo-rotulo', text: 'Equipamento' }), el('div', { class: 'segmentado' }, botoesEquip), ajudaEquip]),
      UI.campo('Carga principal (kg)', carga, 'A série válida (100%). Depois de cada treino, vira a carga que você usou.'),
      UI.campo('Observação', obs),
      el('div', { class: 'campo' }, [
        el('span', { class: 'campo-rotulo', text: 'Séries' }),
        el('div', { class: 'serie-cabecalho' }, [el('span', { text: '#' }), el('span', { text: 'Tipo' }), el('span', { text: '% da carga' }), el('span', { text: 'Carga' }), el('span', { text: 'Reps' }), el('span')]),
        caixa,
        el('div', { class: 'atalhos' }, [
          UI.botao('+ Série', function () { var u = series[series.length - 1]; series.push({ rotulo: 'valida', pct: u ? u.pct : 100, reps: '', descanso: u ? u.descanso : 0 }); desenhar(); }, 'btn-secundario btn-mini'),
          UI.botao('Usar padrão 50/75/100%', function () { series = Dados.SERIES_PADRAO.map(function (s) { return Object.assign({}, s); }); desenhar(); }, 'btn-secundario btn-mini')
        ]),
        el('span', { class: 'campo-ajuda', text: 'Descanso: escreva 45s, 2m ou 1m30s.' })
      ])
    ], botoes, { icone: 'halter' });
    if (!e) nome.focus();
  }

  function renderTreino(raiz, id) {
    var t = Dados.treino(id);
    if (!t) { location.hash = '#/treinos'; return; }
    var exs = Dados.exercicios(t.id);
    raiz.appendChild(el('a', { class: 'link voltar-link', href: '#/treinos', text: '‹ Treinos' }));
    raiz.appendChild(el('div', { class: 'pagina-topo' }, [
      el('div', null, [
        el('h1', { class: 'pagina-titulo', text: t.nome }),
        el('div', { class: 'pagina-subtitulo', text: exs.length + (exs.length === 1 ? ' exercício' : ' exercícios') })
      ]),
      el('div', { class: 'pagina-acoes' }, [
        UI.botao('Renomear', function () { editarTreino(t.id); }, 'btn-secundario'),
        UI.botao('Iniciar treino', function () { iniciar(t.id); }, 'btn-primario', 'play')
      ])
    ]));
    if (!exs.length) raiz.appendChild(el('div', { class: 'vazio' }, [
      el('p', { class: 'vazio-destaque', text: 'Nenhum exercício ainda' }),
      el('p', { text: 'Para cada exercício: a carga principal (série de 100%) e as séries em % dela, como 50% de aquecimento, 75% e 100% até a falha.' }),
      el('div', { class: 'vazio-acoes' }, UI.botao('Adicionar exercício', function () { editarExercicio(t.id); }, 'btn-primario'))
    ]));
    else {
      raiz.appendChild(el('div', { class: 'lista-exercicios' }, exs.map(function (e, i) {
        var u = Dados.ultimoResultado(e.id);
        return el('div', { class: 'exercicio-cartao' }, [
          el('span', { class: 'exercicio-numero', text: i + 1 }),
          el('button', { type: 'button', class: 'exercicio-corpo', title: 'Editar', onclick: function () { editarExercicio(t.id, e.id); } }, [
            el('span', { class: 'exercicio-nome', text: e.nome }),
            el('span', { class: 'exercicio-meta', text: metaExercicio(e) + ' · último: ' + textoUltimo(u) }),
            el('span', { class: 'exercicio-series', text: resumoSeries(e) })
          ]),
          el('div', { class: 'treino-cartao-acoes' }, [
            el('button', { type: 'button', class: 'btn-icone', title: 'Subir', onclick: function () { Dados.moverExercicio(t.id, e.id, -1); App.atualizar(); } }, UI.icone('subir')),
            el('button', { type: 'button', class: 'btn-icone', title: 'Descer', onclick: function () { Dados.moverExercicio(t.id, e.id, 1); App.atualizar(); } }, UI.icone('descer'))
          ])
        ]);
      })));
      raiz.appendChild(el('button', { type: 'button', class: 'btn-adicionar-linha', onclick: function () { editarExercicio(t.id); } }, '+ Adicionar exercício'));
    }
  }

  function render(raiz, partes) {
    if (partes && partes[0]) renderTreino(raiz, partes[0]); else renderLista(raiz);
  }

  // ---------- Execução ----------
  // Cartão do treino em andamento (Página Inicial e lista de treinos).
  function cartaoEmAndamento(r) {
    var t = Dados.treino(r.treinoId), total = t && t.tipo === 'musculacao' ? t.exercicios.length : 0;
    return el('a', { class: 'painel treino-andamento', href: '#/treino' }, [
      el('div', { class: 'treino-andamento-texto' }, [
        el('span', { class: 'treino-andamento-rotulo', text: 'Treino em andamento' }),
        el('span', { class: 'treino-andamento-nome', text: r.nomeTreino }),
        total ? el('span', { class: 'treino-andamento-meta', text: r.exercicios.length + ' de ' + total + ' exercícios feitos' }) : null
      ]),
      cronometro(r.inicio, 'grande'),
      el('span', { class: 'btn btn-primario', text: 'Continuar' })
    ]);
  }

  function finalizar(r) {
    var t = Dados.treino(r.treinoId), corrida = r.tipo === 'corrida';
    var faltam = !corrida && t ? t.exercicios.filter(function (e) { return !Dados.feitoNoRegistro(r, e.id); }) : [];
    var km = el('input', { type: 'text', inputMode: 'decimal', placeholder: 'Ex.: 5,2' });
    var obs = el('textarea', { rows: 2, placeholder: 'Como foi o treino? (opcional)' });
    UI.modal('Finalizar treino', [
      el('div', { class: 'registro-resumo' }, [
        UI.metrica('Duração', UI.fmtDuracao(Dados.duracaoSeg(r))),
        corrida ? null : UI.metrica('Exercícios feitos', r.exercicios.length + (t ? ' de ' + t.exercicios.length : '')),
        UI.metrica('XP', '+' + Dados.xpDoRegistro(r))
      ]),
      faltam.length ? el('p', { class: 'aviso-falta', text: 'Ficaram de fora: ' + faltam.map(function (e) { return e.nome; }).join(', ') + '.' }) : null,
      corrida ? UI.campo('Distância (km)', km) : null,
      UI.campo('Anotação', obs)
    ], [
      { texto: 'Cancelar treino', classe: 'btn-perigo btn-esquerda', acao: function () {
        setTimeout(function () {
          UI.confirmar('Cancelar o treino? Nada dele é registrado e as cargas que você já informou continuam como carga principal.', function () {
            Dados.cancelarTreino(r.id); location.hash = '#/inicio'; App.atualizar();
          }, 'Cancelar treino');
        }, 0);
      } },
      { texto: 'Continuar treinando', classe: 'btn-secundario' },
      { texto: 'Finalizar', classe: 'btn-primario', acao: function () {
        var marcadas = Dados.finalizarTreino(r.id, { km: corrida ? km.value : null, obs: obs.value });
        UI.aviso('Treino finalizado · +' + Dados.xpDoRegistro(r) + ' XP' + (marcadas.length ? ' · meta "' + marcadas[0] + '" marcada' : ''));
        location.hash = '#/inicio';
        App.atualizar();
      } }
    ], { icone: 'halter', subtitulo: r.nomeTreino });
    if (corrida) km.focus();
  }

  function topoExecucao(r) {
    return el('div', { class: 'execucao-topo' }, [
      el('div', { class: 'execucao-titulo' }, [
        el('span', { class: 'treino-andamento-rotulo', text: 'Em andamento' }),
        el('h1', { class: 'pagina-titulo', text: r.nomeTreino })
      ]),
      cronometro(r.inicio, 'grande'),
      UI.botao('Finalizar', function () { finalizar(r); }, 'btn-primario')
    ]);
  }

  function renderListaExecucao(raiz, r) {
    var t = Dados.treino(r.treinoId);
    raiz.appendChild(topoExecucao(r));
    if (r.tipo === 'corrida' || !t) {
      raiz.appendChild(el('section', { class: 'painel execucao-corrida' }, [
        el('p', { class: 'modal-desc', text: 'O tempo está contando. Quando terminar, toque em Finalizar e informe a distância.' }),
        UI.botao('Terminei a corrida', function () { finalizar(r); }, 'btn-primario btn-grande')
      ]));
      return;
    }
    var exs = Dados.exercicios(t.id);
    var abertos = exs.filter(function (e) { return !Dados.feitoNoRegistro(r, e.id); });
    var feitos = exs.filter(function (e) { return Dados.feitoNoRegistro(r, e.id); });
    raiz.appendChild(el('div', { class: 'execucao-progresso' }, [
      UI.barra(exs.length ? feitos.length / exs.length * 100 : 0),
      el('span', { text: feitos.length + ' de ' + exs.length + ' exercícios' })
    ]));
    if (abertos.length) raiz.appendChild(el('h2', { class: 'secao-titulo titulo-manual', text: 'Escolha o próximo' }));
    else raiz.appendChild(el('div', { class: 'execucao-fim' }, [
      el('p', { class: 'vazio-destaque', text: 'Todos os exercícios feitos!' }),
      UI.botao('Finalizar treino', function () { finalizar(r); }, 'btn-primario btn-grande')
    ]));
    raiz.appendChild(el('div', { class: 'lista-execucao' }, abertos.map(function (e) {
      var u = Dados.ultimoResultado(e.id);
      return el('a', { class: 'execucao-item', href: '#/treino/' + e.id }, [
        el('span', { class: 'execucao-item-texto' }, [
          el('span', { class: 'exercicio-nome', text: e.nome }),
          el('span', { class: 'exercicio-meta', text: e.series.length + (e.series.length === 1 ? ' série' : ' séries') + ' · ' + nomeEquip(e) + ' · carga ' + kg(e.carga) }),
          el('span', { class: 'execucao-ultimo', text: 'Último: ' + textoUltimo(u) })
        ]),
        UI.icone('proximo')
      ]);
    })));
    if (feitos.length) {
      raiz.appendChild(el('h2', { class: 'secao-titulo titulo-manual', text: 'Feitos' }));
      raiz.appendChild(el('div', { class: 'lista-execucao' }, feitos.map(function (e) {
        var f = Dados.feitoNoRegistro(r, e.id);
        return el('a', { class: 'execucao-item feito', href: '#/treino/' + e.id, title: 'Corrigir' }, [
          el('span', { class: 'execucao-item-check' }, UI.icone('check')),
          el('span', { class: 'execucao-item-texto' }, [
            el('span', { class: 'exercicio-nome', text: e.nome }),
            el('span', { class: 'exercicio-meta', text: kg(f.carga) + ' × ' + f.reps + ' repetições' })
          ])
        ]);
      })));
    }
  }

  function renderExercicio(raiz, r, exId) {
    var e = Dados.exercicio(r.treinoId, exId);
    if (!e) { location.hash = '#/treino'; return; }
    var feito = Dados.feitoNoRegistro(r, e.id), u = Dados.ultimoResultado(e.id);
    var carga = el('input', { type: 'text', inputMode: 'decimal', value: String(feito ? feito.carga : e.carga || '').replace('.', ','), placeholder: 'kg' });
    var reps = el('input', { type: 'number', inputMode: 'numeric', min: 0, max: 999, value: feito ? feito.reps : '', placeholder: u ? 'último: ' + u.reps : 'reps' });
    var tabela = el('div', { class: 'series-execucao' });
    function desenhar() {
      var base = UI.lerValor(carga.value);
      if (!(base > 0)) base = e.carga || 0;
      tabela.innerHTML = '';
      e.series.forEach(function (s, i) {
        tabela.appendChild(el('div', { class: 'serie-linha rot-' + s.rotulo }, [
          el('span', { class: 'serie-numero', text: i + 1 }),
          el('span', { class: 'serie-tipo' }, [nomeRotulo(s.rotulo), el('small', { text: s.pct + '%' + (s.reps ? ' · ' + s.reps + ' reps' : '') })]),
          el('strong', { class: 'serie-carga', text: kg(Dados.cargaDaSerie(base, s, e.equipamento)) })
        ]));
        if (s.descanso) tabela.appendChild(el('div', { class: 'descanso-linha' }, [UI.icone('relogio'),
          (i < e.series.length - 1 ? 'Descanso ' : 'Descanso antes do próximo exercício: ') + UI.fmtTempo(s.descanso)]));
      });
    }
    carga.addEventListener('input', desenhar);
    desenhar();

    raiz.appendChild(topoExecucao(r));
    raiz.appendChild(el('a', { class: 'link voltar-link', href: '#/treino', text: '‹ Todos os exercícios' }));
    raiz.appendChild(el('section', { class: 'painel exercicio-execucao' }, [
      el('h2', { class: 'exercicio-titulo', text: e.nome }),
      el('div', { class: 'exercicio-meta', text: e.series.length + (e.series.length === 1 ? ' série' : ' séries') + ' · ' + nomeEquip(e) }),
      e.obs ? el('div', { class: 'exercicio-obs', text: e.obs }) : null,
      el('div', { class: 'ultimo-resultado' }, [
        el('span', { text: 'Último treino' }),
        el('strong', { text: u ? kg(u.carga) + ' × ' + u.reps + ' repetições' : 'Primeira vez' }),
        u ? el('small', { text: UI.fmtData(u.data) }) : null
      ]),
      tabela,
      el('div', { class: 'registrar-serie' }, [
        el('div', { class: 'campos-linha' }, [
          UI.campo('Carga da última série (kg)', carga),
          UI.campo('Repetições até a falha', reps)
        ]),
        UI.botao(feito ? 'Salvar correção' : 'Concluir exercício', function () {
          var c = UI.lerValor(carga.value), n = Number(reps.value);
          if (!(c >= 0) || carga.value.trim() === '') { UI.aviso('Informe a carga.'); carga.focus(); return; }
          if (!(n > 0)) { UI.aviso('Informe as repetições.'); reps.focus(); return; }
          Dados.concluirExercicio(r.id, e.id, c, n);
          UI.aviso(e.nome + ' concluído');
          location.hash = '#/treino';
        }, 'btn-primario btn-grande', 'check'),
        feito ? UI.botao('Desmarcar como feito', function () { Dados.desfazerExercicio(r.id, e.id); location.hash = '#/treino'; }, 'btn-secundario') : null
      ])
    ]));
    if (!feito) reps.focus();
  }

  function renderExecucao(raiz, partes) {
    var r = Dados.treinoEmAndamento();
    if (!r) {
      raiz.appendChild(el('div', { class: 'vazio' }, [
        el('p', { class: 'vazio-destaque', text: 'Nenhum treino em andamento' }),
        el('p', { text: 'Escolha um treino para começar.' }),
        el('div', { class: 'vazio-acoes' }, el('a', { class: 'btn btn-primario', href: '#/inicio', text: 'Ir para a Página Inicial' }))
      ]));
      return;
    }
    if (partes && partes[0]) renderExercicio(raiz, r, partes[0]); else renderListaExecucao(raiz, r);
  }

  // Painel da Página Inicial: treino em andamento ou botões para iniciar.
  function painelInicio() {
    var atual = Dados.treinoEmAndamento();
    if (atual) return cartaoEmAndamento(atual);
    var lista = Dados.treinos();
    return el('section', { class: 'painel' }, [
      el('div', { class: 'painel-lado-topo' }, [
        el('h2', { class: 'secao-titulo' }, [UI.icone('halter'), 'Treinar agora']),
        el('a', { class: 'link', href: '#/treinos', text: lista.length ? 'Editar treinos' : 'Cadastrar treinos' })
      ]),
      lista.length ? el('div', { class: 'grade-iniciar' }, lista.map(function (t) {
        var ultimo = Dados.historico(t.id)[0];
        return el('button', { type: 'button', class: 'iniciar-treino', onclick: function () { iniciar(t.id); } }, [
          el('span', { class: 'iniciar-treino-nome', text: t.nome }),
          el('span', { class: 'iniciar-treino-meta', text: ultimo ? 'Último: ' + UI.haQuanto(ultimo.data).toLowerCase() : 'Ainda não feito' })
        ]);
      })) : el('p', { class: 'modal-desc', text: 'Cadastre seus treinos (A, B, C… e corrida) na aba Treinos para registrar aqui o que fizer na academia.' })
    ]);
  }

  return { render: render, renderExecucao: renderExecucao, painelInicio: painelInicio, iniciar: iniciar };
})();
