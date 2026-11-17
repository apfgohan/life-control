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
  // "82 kg × 8" ou, no peso do corpo, "12 repetições".
  function resultado(carga, reps, semCarga, longo) {
    return semCarga ? reps + ' repetições' : kg(carga) + ' × ' + reps + (longo ? ' repetições' : '');
  }
  function textoUltimo(u) { return u ? resultado(u.carga, u.reps, u.semCarga) + ' · ' + UI.fmtDiaMes(u.data) : 'Primeira vez'; }
  function semCarga(e) { return e.equipamento === 'corpo'; }
  function resumoSeries(e) {
    if (semCarga(e)) return e.series.map(function (s) { return nomeRotulo(s.rotulo) + (s.reps ? ' ' + s.reps : ''); }).join(' · ') + ' repetições';
    return e.series.map(function (s) { return s.pct + '% ' + kg(Dados.cargaDaSerie(e.carga, s, e.equipamento)); }).join(' · ');
  }
  function nomeEquip(e) { var x = Dados.EQUIPAMENTOS.filter(function (q) { return q[0] === e.equipamento; })[0]; return x ? x[1] : 'Peso livre'; }
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
    if (!atual && t.tipo === 'tcat') { registrarFeito(t); return; }
    if (!atual && t.tipo === 'musculacao' && !t.exercicios.length) { UI.aviso('Cadastre os exercícios do ' + t.nome + ' primeiro.'); location.hash = '#/treinos/' + t.id; return; }
    Dados.iniciarTreino(treinoId);
    location.hash = '#/treino';
  }

  // Tempo da corrida: "25:40", "1:05:30", "25m40s", "1h05m" ou só minutos ("40").
  function lerDuracao(txt) {
    var s = String(txt || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!s) return NaN;
    var m = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
    if (m) return m[3] != null ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : Number(m[1]) * 60 + Number(m[2]);
    m = s.match(/^(?:(\d+)h)?(?:(\d+)(?:m|min))?(?:(\d+)s)?$/);
    if (m && (m[1] || m[2] || m[3])) return (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0);
    return /^\d+([.,]\d+)?$/.test(s) ? Math.round(parseFloat(s.replace(',', '.')) * 60) : NaN;
  }
  function textoDuracao(seg) {
    seg = Math.round(seg || 0);
    var h = Math.floor(seg / 3600), m = Math.floor(seg % 3600 / 60), s = seg % 60;
    return h ? h + ':' + UI.pad(m) + ':' + UI.pad(s) : m + ':' + UI.pad(s);
  }
  function km(v) { return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' km'; }

  // Campos de distância e tempo da corrida, com o ritmo calculado na hora.
  function camposCorrida(segPadrao) {
    var dist = el('input', { type: 'text', inputMode: 'decimal', placeholder: 'Ex.: 5,2' });
    var tempo = el('input', { type: 'text', value: segPadrao ? textoDuracao(segPadrao) : '', placeholder: 'Ex.: 28:30 ou 1:05:00' });
    var pace = el('strong', { class: 'pace-previa', text: '—' });
    function atualizar() {
      var d = UI.lerValor(dist.value), s = lerDuracao(tempo.value);
      tempo.classList.toggle('invalido', !!tempo.value.trim() && isNaN(s));
      pace.textContent = d > 0 && s > 0 ? ritmo(s, d) : '—';
    }
    dist.addEventListener('input', atualizar); tempo.addEventListener('input', atualizar);
    return {
      dist: dist, tempo: tempo,
      nos: [el('div', { class: 'campos-linha' }, [UI.campo('Distância (km)', dist), UI.campo('Tempo', tempo, 'minutos:segundos ou horas:minutos:segundos')]),
        el('div', { class: 'pace-linha' }, [el('span', { text: 'Ritmo (pace)' }), pace])],
      ler: function () { return { km: UI.lerValor(dist.value), segundos: lerDuracao(tempo.value) }; }
    };
  }
  // Depois de registrar uma corrida: avisa os recordes batidos.
  function avisarRecordes(r, antes, extra) {
    var depois = Dados.recordesCorrida(), novos = [];
    if (depois.pace && depois.pace.registro.id === r.id && antes.pace) novos.push('melhor ritmo (' + ritmo(depois.pace.valor, 1) + ')');
    if (depois.distancia && depois.distancia.registro.id === r.id && antes.distancia) novos.push('maior distância (' + km(depois.distancia.valor) + ')');
    if (novos.length) UI.modal('Novo recorde!', el('div', { class: 'promocao' }, [
      el('div', { class: 'parabens-icone' }, UI.icone('trofeu')),
      el('div', { class: 'patente-nome', text: km(r.corrida.km) + ' em ' + textoDuracao(r.corrida.segundos) }),
      el('p', { class: 'modal-desc', text: 'Recorde de ' + novos.join(' e ') + '.' })
    ]), [{ texto: 'Continuar', classe: 'btn-primario' }]);
    else UI.aviso(extra);
  }

  // TCAT ou corrida feita sem o cronômetro: registra já finalizado.
  function registrarFeito(t) {
    var data = el('input', { type: 'date', value: UI.hoje(), max: UI.hoje() });
    var obs = el('textarea', { rows: 2, placeholder: t.tipo === 'tcat' ? 'Local, armamento, observações (opcional)' : 'Como foi? (opcional)' });
    var c = t.tipo === 'corrida' ? camposCorrida(0) : null;
    UI.modal(t.tipo === 'tcat' ? 'Registrar TCAT' : 'Registrar corrida', [
      t.tipo === 'tcat' ? el('p', { class: 'modal-desc', text: 'Conta como treino do dia: vale para as metas de treino e rende ' + Dados.XP_TREINO.base + ' XP.' }) : null,
      UI.campo('Data', data),
      c ? c.nos : null,
      UI.campo('Anotação', obs)
    ], [{ texto: 'Cancelar', classe: 'btn-secundario' }, { texto: 'Registrar', classe: 'btn-primario', acao: function () {
      var extra = { data: data.value || UI.hoje(), obs: obs.value };
      if (c) {
        var v = c.ler();
        if (!(v.km > 0)) { UI.aviso('Informe a distância.'); c.dist.focus(); return false; }
        if (!(v.segundos > 0)) { UI.aviso('Informe o tempo (ex.: 28:30).'); c.tempo.focus(); return false; }
        extra.km = v.km; extra.segundos = v.segundos;
      }
      var antes = Dados.recordesCorrida();
      var res = Dados.registrarTreinoFeito(t.id, extra);
      var msg = t.nome + ' registrado · +' + Dados.xpDoRegistro(res.registro) + ' XP' + (res.metas.length ? ' · meta "' + res.metas[0] + '" cumprida' : '');
      App.atualizar();
      if (c) avisarRecordes(res.registro, antes, msg); else UI.aviso(msg);
    } }], { icone: t.tipo === 'tcat' ? 'alvo' : 'halter', subtitulo: t.nome });
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
      UI.campo('Tipo', tipo, t ? null : 'Musculação tem exercícios e séries; corrida registra distância, tempo e ritmo; TCAT só marca que houve treino no dia.')
    ], botoes, { icone: 'halter' });
  }

  function cartaoTreino(t) {
    var ultimo = Dados.historico(t.id)[0], atual = Dados.treinoEmAndamento(), emCurso = atual && atual.treinoId === t.id;
    return el('div', { class: 'treino-cartao' + (emCurso ? ' em-curso' : '') }, [
      el('button', { type: 'button', class: 'treino-cartao-corpo', title: t.tipo === 'musculacao' ? 'Editar exercícios' : 'Editar', onclick: function () {
        if (t.tipo === 'musculacao') location.hash = '#/treinos/' + t.id; else editarTreino(t.id);
      } }, [
        el('span', { class: 'treino-cartao-nome', text: t.nome }),
        el('span', { class: 'treino-cartao-meta', text: (t.tipo === 'corrida' ? 'Corrida' : t.tipo === 'tcat' ? 'TCAT · marca o treino do dia' : t.exercicios.length + (t.exercicios.length === 1 ? ' exercício' : ' exercícios'))
          + ' · ' + (ultimo ? 'último em ' + UI.fmtDiaMes(ultimo.data) + (t.tipo === 'tcat' ? '' : t.tipo === 'corrida' && ultimo.corrida && ultimo.corrida.km ? ' (' + km(ultimo.corrida.km) + ')' : ' (' + duracaoCurta(Dados.duracaoSeg(ultimo)) + ')') : 'ainda não feito') })
      ]),
      el('div', { class: 'treino-cartao-acoes' }, [
        el('button', { type: 'button', class: 'btn-icone', title: 'Subir', onclick: function () { Dados.moverTreino(t.id, -1); App.atualizar(); } }, UI.icone('subir')),
        el('button', { type: 'button', class: 'btn-icone', title: 'Descer', onclick: function () { Dados.moverTreino(t.id, 1); App.atualizar(); } }, UI.icone('descer')),
        t.tipo === 'corrida' && !emCurso ? UI.botao('Registrar', function () { registrarFeito(t); }, 'btn-secundario btn-mini') : null,
        t.tipo === 'tcat' ? UI.botao('Registrar', function () { registrarFeito(t); }, 'btn-primario btn-mini', 'check')
          : UI.botao(emCurso ? 'Continuar' : 'Iniciar', function () { iniciar(t.id); }, 'btn-primario btn-mini', 'play')
      ])
    ]);
  }

  function linhaHistorico(r) {
    var corrida = r.tipo === 'corrida', seg = corrida ? Dados.segundosCorrida(r) : Dados.duracaoSeg(r), temKm = corrida && r.corrida && r.corrida.km;
    return el('button', { type: 'button', class: 'historico-linha', title: 'Ver detalhes', onclick: function () { abrirRegistro(r.id); } }, [
      el('span', { class: 'historico-data', text: UI.fmtDiaMes(r.data) }),
      el('span', { class: 'historico-corpo' }, [
        el('span', { class: 'historico-nome', text: r.nomeTreino }),
        el('span', { class: 'historico-meta', text: corrida
          ? (temKm ? km(r.corrida.km) + ' · ' + ritmo(seg, r.corrida.km) : 'Corrida')
          : r.tipo === 'tcat' ? 'TCAT' : r.exercicios.length + (r.exercicios.length === 1 ? ' exercício' : ' exercícios') })
      ]),
      el('span', { class: 'historico-tempo', text: r.tipo === 'tcat' ? '✓' : corrida ? textoDuracao(seg) : duracaoCurta(seg) })
    ]);
  }

  function abrirRegistro(id) {
    var r = Dados.registro(id), corrida = r.tipo === 'corrida', seg = corrida ? Dados.segundosCorrida(r) : Dados.duracaoSeg(r);
    var corpo = [
      el('div', { class: 'registro-resumo' }, r.tipo === 'tcat' ? [UI.metrica('Treino', 'TCAT'), UI.metrica('XP', '+' + Dados.xpDoRegistro(r))] : [
        UI.metrica(corrida ? 'Tempo' : 'Duração', corrida ? textoDuracao(seg) : UI.fmtDuracao(seg)),
        corrida ? UI.metrica('Distância', r.corrida && r.corrida.km ? km(r.corrida.km) : '—') : UI.metrica('Exercícios', String(r.exercicios.length)),
        corrida && r.corrida && r.corrida.km ? UI.metrica('Ritmo', ritmo(seg, r.corrida.km)) : UI.metrica('XP', '+' + Dados.xpDoRegistro(r))
      ])
    ];
    if (r.exercicios.length) corpo.push(el('div', { class: 'lista-feitos' }, r.exercicios.map(function (x) {
      return el('div', { class: 'feito-linha' }, [el('span', { text: x.nome }), el('strong', { text: resultado(x.carga, x.reps, x.semCarga) })]);
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
        el('div', { class: 'pagina-subtitulo', text: 'Cadastre seus treinos de musculação, corrida e TCAT. Para treinar, use Iniciar; corrida feita e TCAT, use Registrar.' })
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

    var rec = Dados.recordesCorrida();
    if (rec.distancia) {
      var cartaoRec = function (rotulo, valor, r) {
        return el('div', { class: 'recorde-corrida' }, [UI.icone('trofeu'), el('span', { class: 'recorde-texto' }, [
          el('span', { class: 'recorde-rotulo', text: rotulo }), el('strong', { text: valor }),
          el('small', { text: r ? UI.fmtData(r.data) + (r.corrida && r.corrida.km ? ' · ' + km(r.corrida.km) + ' em ' + textoDuracao(Dados.segundosCorrida(r)) : '') : '' })])]);
      };
      raiz.appendChild(el('section', { class: 'painel' }, [
        el('h2', { class: 'secao-titulo', text: 'Recordes de corrida' }),
        el('div', { class: 'recordes-corrida' }, [
          cartaoRec('Melhor ritmo', rec.pace ? ritmo(rec.pace.valor, 1) : '—', rec.pace && rec.pace.registro),
          cartaoRec('Maior distância', km(rec.distancia.valor), rec.distancia.registro),
          cartaoRec('Corrida mais longa', rec.tempo ? textoDuracao(rec.tempo.valor) : '—', rec.tempo && rec.tempo.registro)
        ])
      ]));
    }

    if (hist.length) raiz.appendChild(el('section', { class: 'painel' }, [
      el('h2', { class: 'secao-titulo' }, ['Histórico', el('span', { class: 'secao-contagem', text: hist.length })]),
      el('div', { class: 'lista-historico' }, hist.slice(0, 20).map(linhaHistorico))
    ]));
  }

  // ---------- Cadastro: exercícios de um treino ----------
  function editarExercicio(treinoId, exId) {
    var e = exId ? Dados.exercicio(treinoId, exId) : null, t = Dados.treino(treinoId);
    // O exercício vem da biblioteca (Configurações); aqui só se ajustam carga, séries, repetições e descanso.
    var baseId = e ? e.baseId : null;
    var equipamento = (e && e.equipamento) || 'livre';
    var selBase = el('select');
    function preencherBases() {
      selBase.innerHTML = '';
      var noTreino = t.exercicios.filter(function (x) { return x.id !== exId; }).map(function (x) { return x.baseId; });
      selBase.appendChild(el('option', { value: '', text: 'Escolha o exercício…', disabled: true, selected: !baseId }));
      Dados.GRUPOS.forEach(function (g) {
        var doGrupo = Dados.biblioteca(g[0]).filter(function (b) { return noTreino.indexOf(b.id) < 0 || b.id === baseId; });
        if (doGrupo.length) selBase.appendChild(el('optgroup', { label: g[1] }, doGrupo.map(function (b) { return el('option', { value: b.id, text: b.nome, selected: b.id === baseId }); })));
      });
      selBase.appendChild(el('option', { value: '__novo', text: '+ Cadastrar novo exercício…' }));
    }
    function escolher(id) {
      var b = Dados.base(id);
      baseId = b ? b.id : null;
      if (b) {
        equipamento = b.equipamento;
        // Mesma carga que o exercício já tem em outro treino.
        if (!carga.value.trim()) {
          var outro = null;
          Dados.treinos().forEach(function (x) { x.exercicios.forEach(function (y) { if (y.baseId === b.id && y.carga && !outro) outro = y; }); });
          if (outro) carga.value = String(outro.carga).replace('.', ',');
        }
      }
      var pr = b ? Dados.prDaBase(b.id) : null;
      ajudaEquip.textContent = b ? textoEquip() + (pr ? ' · PR: ' + Configuracoes.textoPR(pr) : '') : '';
      desenhar();
    }
    selBase.addEventListener('change', function () {
      if (selBase.value !== '__novo') { escolher(selBase.value); return; }
      selBase.value = baseId || '';
      Configuracoes.editarExercicio(null, null, function (b) { baseId = b.id; preencherBases(); escolher(b.id); });
    });
    function textoEquip() {
      var nome = Dados.EQUIPAMENTOS.filter(function (q) { return q[0] === equipamento; })[0][1];
      if (equipamento === 'corpo') return nome + ': sem carga, você registra só as repetições.';
      return nome + ': ' + (equipamento === 'maquina' ? 'cargas arredondadas para baixo, de ' + Dados.PASSO_MAQUINA + ' em ' + Dados.PASSO_MAQUINA + ' kg (85 kg a 50% = 40 kg).' : 'cargas arredondadas para o kg mais próximo.');
    }
    var ajudaEquip = el('span', { class: 'campo-ajuda' });
    var carga = el('input', { type: 'text', inputMode: 'decimal', value: e && e.carga ? String(e.carga).replace('.', ',') : '', placeholder: 'Ex.: 80' });
    var campoCarga = UI.campo('Carga principal (kg)', carga, 'A série válida (100%). Depois de cada treino, vira a carga que você usou.');
    var cabecalho = el('div', { class: 'serie-cabecalho' });
    var obs = el('input', { type: 'text', value: e ? e.obs : '', placeholder: 'Ex.: pegada fechada, banco 30° (opcional)', maxLength: 120 });
    var series = e ? e.series.map(function (s) { return Object.assign({}, s); }) : Dados.seriesPadrao();
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
      var corpo = equipamento === 'corpo';
      campoCarga.hidden = corpo;
      caixa.classList.toggle('sem-carga', corpo);
      cabecalho.classList.toggle('sem-carga', corpo);
      cabecalho.innerHTML = '';
      (corpo ? ['#', 'Tipo', 'Repetições', ''] : ['#', 'Tipo', '% da carga', 'Carga', 'Reps', '']).forEach(function (x) { cabecalho.appendChild(el('span', { text: x })); });
      caixa.innerHTML = '';
      series.forEach(function (s, i) {
        // Trocar o tipo aplica o padrão daquele tipo (% da carga, repetições e descanso).
        var rot = el('select', { onchange: function () { Object.assign(s, Dados.padraoSerie(rot.value)); desenhar(); } }, Dados.ROTULOS_SERIE.map(function (r) { return el('option', { value: r[0], text: r[1], selected: s.rotulo === r[0] }); }));
        var pct = el('input', { type: 'number', min: 0, max: 200, step: 5, value: s.pct, oninput: function () { s.pct = Number(pct.value) || 0; previa.textContent = kg(Dados.cargaDaSerie(cargaAtual(), s, equipamento)); } });
        var reps = el('input', { type: 'text', value: s.reps, placeholder: 'reps', maxLength: 12, oninput: function () { s.reps = reps.value; } });
        var previa = el('span', { class: 'serie-previa', text: kg(Dados.cargaDaSerie(cargaAtual(), s, equipamento)) });
        caixa.appendChild(el('div', { class: 'serie-editor' }, [
          el('span', { class: 'serie-numero', text: i + 1 }),
          rot,
          corpo ? null : el('label', { class: 'serie-pct' }, [pct, el('span', { text: '%' })]),
          corpo ? null : previa,
          reps,
          el('button', { type: 'button', class: 'btn-icone', title: 'Tirar série', onclick: function () { series.splice(i, 1); desenhar(); } }, UI.icone('lixo'))
        ]));
        caixa.appendChild(campoDescanso(s, i === series.length - 1));
      });
    }
    carga.addEventListener('input', desenhar);
    preencherBases();
    escolher(baseId);

    var botoes = [{ texto: 'Cancelar', classe: 'btn-secundario' }, { texto: 'Salvar', classe: 'btn-primario', acao: function () {
      if (!Dados.base(baseId)) { UI.aviso('Escolha o exercício (ou cadastre um novo).'); selBase.focus(); return false; }
      if (!series.length) { UI.aviso('Coloque pelo menos uma série.'); return false; }
      if (caixa.querySelector('.invalido')) { UI.aviso('Descanso inválido. Use, por exemplo, 45s, 2m ou 1m30s.'); caixa.querySelector('.invalido').focus(); return false; }
      Dados.salvarExercicio(treinoId, { baseId: baseId, carga: carga.value, obs: obs.value, series: series }, exId);
      App.atualizar();
    } }];
    if (e) botoes.unshift({ texto: 'Excluir', classe: 'btn-perigo btn-esquerda', acao: function () {
      UI.confirmar('Tirar "' + e.nome + '" deste treino? Os registros antigos dele continuam no histórico.', function () { Dados.excluirExercicio(treinoId, e.id); App.atualizar(); });
    } });
    UI.modal(e ? 'Editar exercício' : 'Adicionar exercício', [
      el('div', { class: 'campo' }, [el('span', { class: 'campo-rotulo', text: 'Exercício' }), selBase, ajudaEquip,
        el('span', { class: 'campo-ajuda' }, ['Nome, grupamento e equipamento ficam na biblioteca, em ', el('a', { class: 'link', href: '#/configuracoes', text: 'Configurações' }), '.'])]),
      campoCarga,
      UI.campo('Observação neste treino', obs),
      el('div', { class: 'campo' }, [
        el('span', { class: 'campo-rotulo', text: 'Séries' }),
        cabecalho,
        caixa,
        el('div', { class: 'atalhos' }, [
          UI.botao('+ Série', function () { series.push(Dados.padraoSerie('valida')); desenhar(); }, 'btn-secundario btn-mini'),
          UI.botao('Usar padrão', function () { series = Dados.seriesPadrao(); desenhar(); }, 'btn-secundario btn-mini')
        ]),
        el('span', { class: 'campo-ajuda' }, ['Ao trocar o tipo, a série recebe o padrão dele (% , repetições e descanso), que você ajusta em ',
          el('a', { class: 'link', href: '#/configuracoes', text: 'Configurações' }), '. Descanso: escreva 45s, 2m ou 1m30s.'])
      ])
    ], botoes, { icone: 'halter' });
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
        var u = Dados.ultimoResultado(e.id), pr = e.baseId ? Dados.prDaBase(e.baseId) : null;
        return el('div', { class: 'exercicio-cartao' }, [
          el('span', { class: 'exercicio-numero', text: i + 1 }),
          el('button', { type: 'button', class: 'exercicio-corpo', title: 'Editar', onclick: function () { editarExercicio(t.id, e.id); } }, [
            el('span', { class: 'exercicio-nome', text: e.nome }),
            el('span', { class: 'exercicio-meta', text: metaExercicio(e) + ' · último: ' + textoUltimo(u) + (pr ? ' · PR: ' + resultado(pr.carga, pr.reps, pr.semCarga) : '') }),
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
    var c = corrida ? camposCorrida(Dados.duracaoSeg(r)) : null;
    var obs = el('textarea', { rows: 2, placeholder: 'Como foi o treino? (opcional)' });
    UI.modal('Finalizar treino', [
      el('div', { class: 'registro-resumo' }, [
        UI.metrica('Duração', UI.fmtDuracao(Dados.duracaoSeg(r))),
        corrida ? null : UI.metrica('Exercícios feitos', r.exercicios.length + (t ? ' de ' + t.exercicios.length : '')),
        UI.metrica('XP', '+' + Dados.xpDoRegistro(r))
      ]),
      faltam.length ? el('p', { class: 'aviso-falta', text: 'Ficaram de fora: ' + faltam.map(function (e) { return e.nome; }).join(', ') + '.' }) : null,
      c ? c.nos : null,
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
        var extra = { obs: obs.value };
        if (c) {
          var v = c.ler();
          if (!(v.km > 0)) { UI.aviso('Informe a distância.'); c.dist.focus(); return false; }
          if (c.tempo.value.trim() && !(v.segundos > 0)) { UI.aviso('Tempo inválido. Use, por exemplo, 28:30.'); c.tempo.focus(); return false; }
          extra.km = v.km; extra.segundos = v.segundos;
        }
        var antes = corrida ? Dados.recordesCorrida() : null;
        var marcadas = Dados.finalizarTreino(r.id, extra);
        var msg = 'Treino finalizado · +' + Dados.xpDoRegistro(r) + ' XP' + (marcadas.length ? ' · meta "' + marcadas[0] + '" cumprida' : '');
        location.hash = '#/inicio';
        App.atualizar();
        if (corrida) avisarRecordes(r, antes, msg); else UI.aviso(msg);
      } }
    ], { icone: 'halter', subtitulo: r.nomeTreino });
    if (c) c.dist.focus();
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
          el('span', { class: 'exercicio-meta', text: e.series.length + (e.series.length === 1 ? ' série' : ' séries') + ' · ' + nomeEquip(e) + (semCarga(e) ? '' : ' · carga ' + kg(e.carga)) }),
          el('span', { class: 'execucao-ultimo', text: 'Último: ' + textoUltimo(u) }),
          u && Dados.passouDaFaixa(e, u.reps) ? el('span', { class: 'aumentar-carga', text: semCarga(e) ? '▲ Hora de deixar mais difícil' : '▲ Hora de aumentar a carga' }) : null
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
            el('span', { class: 'exercicio-meta', text: resultado(f.carga, f.reps, f.semCarga, true) })
          ])
        ]);
      })));
    }
  }

  // Próximo peso da máquina (de 5 em 5 kg) acima da carga atual.
  function proximoPeso(e) { var p = Dados.PASSO_MAQUINA; return (Math.floor((Number(e.carga) || 0) / p + 1e-9) + 1) * p; }

  // Repetições acima da faixa da série válida: parabéns e sugestão de aumentar a carga.
  // Também comemora um novo recorde (PR) e as metas de recorde batidas agora.
  function parabens(e, carga, reps, faixa, res) {
    res = res || { metas: [] };
    UI.modal(res.novoPR ? 'Novo recorde!' : 'Parabéns!', el('div', { class: 'promocao' }, [
      el('div', { class: 'parabens-icone' }, UI.icone('trofeu')),
      el('div', { class: 'patente-nome', text: resultado(carga, reps, semCarga(e)) }),
      res.novoPR ? el('p', { class: 'modal-desc', text: 'Novo PR em ' + e.nome + '! O anterior era ' + resultado(res.prAnterior.carga, res.prAnterior.reps, res.prAnterior.semCarga) + ' (' + UI.fmtDiaMes(res.prAnterior.data) + ').' }) : null,
      res.metas.map(function (m) { return el('p', { class: 'parabens-meta', text: 'Meta batida: ' + m.titulo + ' · +' + UI.fmtNum(Dados.xpDaMeta(m)) + ' XP' }); }),
      faixa ? el('p', { class: 'modal-desc', text: 'Você passou da faixa de ' + faixa.min + (faixa.max !== faixa.min ? '-' + faixa.max : '') + ' repetições da série válida em ' + e.nome + '.' }) : null,
      faixa ? el('p', { class: 'parabens-dica', text: semCarga(e) ? 'Na próxima vez, deixe mais difícil: uma variação mais pesada ou um peso extra.'
        : 'Na próxima vez, aumente a carga' + (e.equipamento === 'maquina' ? ' para ' + kg(proximoPeso(e)) : '') + '.' }) : null
    ]), [{ texto: 'Continuar', classe: 'btn-primario', acao: function () { location.hash = '#/treino'; } }]);
  }

  function renderExercicio(raiz, r, exId) {
    var e = Dados.exercicio(r.treinoId, exId);
    if (!e) { location.hash = '#/treino'; return; }
    var feito = Dados.feitoNoRegistro(r, e.id), u = Dados.ultimoResultado(e.id);
    // PR sem contar o que já foi registrado neste treino (para comparar com o de hoje).
    var pr = e.baseId ? Dados.resultadosDaBase(e.baseId).filter(function (x) { return !(feito && x.registroId === r.id); })
      .reduce(function (m, x) { return !m || (x.semCarga ? x.reps > m.reps : x.carga > m.carga || (x.carga === m.carga && x.reps > m.reps)) ? x : m; }, null) : null;
    var carga = el('input', { type: 'text', inputMode: 'decimal', value: String(feito ? feito.carga : e.carga || '').replace('.', ','), placeholder: 'kg' });
    var reps = el('input', { type: 'number', inputMode: 'numeric', min: 0, max: 999, value: feito ? feito.reps : '', placeholder: u ? 'último: ' + u.reps : 'reps' });
    var tabela = el('div', { class: 'series-execucao' });
    function desenhar() {
      var base = UI.lerValor(carga.value);
      if (!(base > 0)) base = e.carga || 0;
      tabela.innerHTML = '';
      e.series.forEach(function (s, i) {
        tabela.appendChild(el('div', { class: 'serie-linha rot-' + s.rotulo }, semCarga(e) ? [
          el('span', { class: 'serie-numero', text: i + 1 }),
          el('span', { class: 'serie-tipo', text: nomeRotulo(s.rotulo) }),
          el('strong', { class: 'serie-carga', text: s.reps ? s.reps + ' reps' : '—' })
        ] : [
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
        el('strong', { text: u ? resultado(u.carga, u.reps, u.semCarga, true) : 'Primeira vez' }),
        u ? el('small', { text: UI.fmtData(u.data) }) : null
      ]),
      pr ? el('div', { class: 'ultimo-resultado resultado-pr' }, [
        el('span', null, [UI.icone('trofeu'), ' Recorde (PR)']),
        el('strong', { text: resultado(pr.carga, pr.reps, pr.semCarga, true) }),
        el('small', { text: UI.fmtData(pr.data) })
      ]) : null,
      u && Dados.passouDaFaixa(e, u.reps) ? el('div', { class: 'aumentar-carga destaque' }, [UI.icone('progresso'),
        'Da última vez você passou de ' + Dados.faixaValida(e).max + ' repetições: ' + (semCarga(e) ? 'deixe o exercício mais difícil hoje.'
          : 'aumente a carga hoje' + (e.equipamento === 'maquina' ? ' (próximo peso: ' + kg(proximoPeso(e)) + ').' : '.'))]) : null,
      tabela,
      el('div', { class: 'registrar-serie' }, [
        el('div', { class: 'campos-linha' }, [
          semCarga(e) ? null : UI.campo('Carga da última série (kg)', carga),
          UI.campo('Repetições até a falha', reps)
        ]),
        UI.botao(feito ? 'Salvar correção' : 'Concluir exercício', function () {
          var c = semCarga(e) ? 0 : UI.lerValor(carga.value), n = Number(reps.value);
          if (!semCarga(e) && (!(c >= 0) || carga.value.trim() === '')) { UI.aviso('Informe a carga.'); carga.focus(); return; }
          if (!(n > 0)) { UI.aviso('Informe as repetições.'); reps.focus(); return; }
          var res = Dados.concluirExercicio(r.id, e.id, c, n);
          var faixa = Dados.faixaValida(e), passou = faixa && n > faixa.max;
          if (passou || res.novoPR || res.metas.length) parabens(e, c, n, passou ? faixa : null, res);
          else { UI.aviso(e.nome + ' concluído'); location.hash = '#/treino'; }
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
          el('span', { class: 'iniciar-treino-meta', text: (t.tipo === 'tcat' ? 'Toque para registrar · ' : '') + (ultimo ? 'Último: ' + UI.haQuanto(ultimo.data).toLowerCase() : 'Ainda não feito') })
        ]);
      })) : el('p', { class: 'modal-desc', text: 'Cadastre seus treinos (A, B, C… e corrida) na aba Treinos para registrar aqui o que fizer na academia.' })
    ]);
  }

  return { render: render, renderExecucao: renderExecucao, painelInicio: painelInicio, iniciar: iniciar };
})();
