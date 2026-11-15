// Dieta: registro das refeições (seguiu a dieta ou comeu outra coisa), plano alimentar e evolução semanal
// (peso em jejum, medidas e fotos aos domingos). Rotas: #/dieta, #/dieta/plano, #/dieta/evolucao.
var Dieta = (function () {
  var el = UI.el;
  var diaAberto = null;           // dia mostrado no registro (null = hoje)
  var ANGULOS = [['frente', 'Frente'], ['lateral', 'Lateral'], ['costas', 'Costas']];
  var MEDIDAS = [['peso', 'Peso em jejum', 'kg'], ['braco', 'Braço', 'cm'], ['coxa', 'Coxa', 'cm'], ['panturrilha', 'Panturrilha', 'cm']];

  function fmtNum(v, casas) { return v == null ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas == null ? 1 : casas, maximumFractionDigits: 1 }); }
  function nomeDia(iso) {
    var dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    var hoje = UI.hoje();
    if (iso === hoje) return 'Hoje';
    if (iso === UI.somarDias(hoje, -1)) return 'Ontem';
    return dias[new Date(iso + 'T00:00:00').getDay()] + ', ' + UI.fmtDiaMes(iso);
  }

  // ---------- Registro de uma refeição ----------
  function registrarOutra(iso, r) {
    var atual = Dados.registroRefeicao(iso, r.id);
    var desc = el('textarea', { rows: 3, value: atual && atual.tipo === 'outro' ? atual.descricao : '', placeholder: 'Ex.: pizza com os amigos' });
    UI.modal('Comi outra coisa', [
      el('p', { class: 'modal-desc', text: r.nome + (r.horario ? ' (' + r.horario + ')' : '') + ' · ' + nomeDia(iso) + '. Trocar a refeição não rende pontos, mas registrar evita a perda por refeição não registrada.' }),
      UI.campo('O que você comeu?', desc)
    ], [
      { texto: 'Cancelar', classe: 'btn-secundario' },
      { texto: 'Registrar', classe: 'btn-primario', acao: function () { Dados.registrarRefeicao(iso, r.id, { tipo: 'outro', descricao: desc.value }); App.atualizar(); } }
    ], { icone: 'prato' });
  }

  function verRefeicao(r) {
    UI.modal(r.nome + (r.horario ? ' · ' + r.horario : ''), [
      tabelaItens(r),
      r.obs ? el('p', { class: 'refeicao-obs', text: r.obs }) : null,
      r.soTreino ? el('p', { class: 'campo-ajuda', text: 'Só conta nos dias em que você treina.' }) : null
    ], [{ texto: 'Fechar', classe: 'btn-primario' }], { icone: 'prato' });
  }

  function tabelaItens(r) {
    if (!r.itens.length) return el('p', { class: 'modal-desc', text: 'Sem alimentos cadastrados.' });
    return el('div', { class: 'itens-refeicao' }, r.itens.map(function (i) {
      return el('div', { class: 'item-refeicao' }, [
        el('div', { class: 'item-topo' }, [el('strong', { text: i.alimento }), el('span', { class: 'item-qtd', text: i.quantidade })]),
        i.substituicao ? el('div', { class: 'item-subst', text: 'ou ' + i.substituicao }) : null
      ]);
    }));
  }

  function linhaRefeicao(iso, r, conta) {
    var x = Dados.registroRefeicao(iso, r.id), hoje = UI.hoje();
    var estado = x ? x.tipo : (conta && iso < hoje ? 'perdida' : 'aberta');
    var resumo = r.itens.map(function (i) { return i.alimento; }).join(', ');
    return el('div', { class: 'refeicao ' + estado }, [
      el('button', { type: 'button', class: 'refeicao-corpo', title: 'Ver os alimentos', onclick: function () { verRefeicao(r); } }, [
        el('span', { class: 'refeicao-topo' }, [
          r.horario ? el('span', { class: 'refeicao-hora', text: r.horario }) : null,
          el('span', { class: 'refeicao-nome', text: r.nome })
        ]),
        el('span', { class: 'refeicao-itens', text: x && x.tipo === 'outro' ? 'Comeu: ' + (x.descricao || 'outra coisa') : resumo }),
        estado === 'perdida' ? el('span', { class: 'refeicao-alerta', text: 'Não registrada · ' + Dados.XP_DIETA.perdida + ' XP' }) : null
      ]),
      x ? el('div', { class: 'refeicao-acoes' }, [
        el('span', { class: 'refeicao-selo ' + x.tipo, text: x.tipo === 'dieta' ? '✓ Dieta · +' + Dados.XP_DIETA.refeicao : 'Outra' }),
        el('button', { type: 'button', class: 'btn-icone', title: 'Desfazer', onclick: function () { Dados.desfazerRefeicao(iso, r.id); App.atualizar(); } }, UI.icone('historico'))
      ]) : el('div', { class: 'refeicao-acoes' }, [
        UI.botao('Dieta', function () { Dados.registrarRefeicao(iso, r.id, { tipo: 'dieta' }); UI.aviso(r.nome + ' na dieta · +' + Dados.XP_DIETA.refeicao + ' XP'); App.atualizar(); }, 'btn-primario btn-mini', 'check'),
        UI.botao('Outra', function () { registrarOutra(iso, r); }, 'btn-secundario btn-mini')
      ])
    ]);
  }

  // Lista das refeições de um dia (Página Inicial e aba Dieta).
  function painelDia(iso, opcoes) {
    opcoes = opcoes || {};
    var lista = Dados.refeicoesDoDia(iso), s = Dados.resumoDieta(iso), inicio = Dados.inicioDaDieta();
    var conta = !!(inicio && iso >= inicio);
    var cab = el('div', { class: 'painel-lado-topo' }, [
      el('h2', { class: 'secao-titulo' }, [UI.icone('prato'), opcoes.titulo || 'Alimentação',
        lista.length ? el('span', { class: 'secao-contagem' + (s.dieta === s.total && s.total ? ' completa' : ''), text: (s.dieta + s.outro) + '/' + s.total }) : null]),
      opcoes.navegar ? el('div', { class: 'seletor-dia' }, [
        el('button', { type: 'button', class: 'btn-icone btn-mes', title: 'Dia anterior', onclick: function () { diaAberto = UI.somarDias(iso, -1); App.atualizar(); } }, UI.icone('anterior')),
        el('strong', { text: nomeDia(iso) }),
        el('button', { type: 'button', class: 'btn-icone btn-mes', title: 'Próximo dia', disabled: iso >= UI.hoje(), onclick: function () { diaAberto = UI.somarDias(iso, 1); App.atualizar(); } }, UI.icone('proximo'))
      ]) : el('a', { class: 'link', href: '#/dieta', text: 'Ver dieta' })
    ]);
    if (!Dados.refeicoes().length) return el('section', { class: 'painel' }, [cab,
      el('p', { class: 'modal-desc', text: 'Cadastre seu plano alimentar na aba Dieta para registrar aqui cada refeição.' }),
      el('a', { class: 'btn btn-secundario', href: '#/dieta/plano', text: 'Cadastrar o plano' })]);
    var aviso = !conta && inicio ? el('p', { class: 'campo-ajuda', text: 'O acompanhamento começa em ' + UI.fmtData(inicio) + '. Antes disso, refeições não registradas não tiram pontos.' }) : null;
    var placar = el('div', { class: 'placar-dieta' }, [
      el('span', { class: 'positivo', text: s.dieta + ' na dieta' }),
      s.outro ? el('span', { class: 'neutro', text: s.outro + ' trocada' + (s.outro > 1 ? 's' : '') }) : null,
      s.faltam ? el('span', { class: s.perdeu ? 'negativo' : 'neutro', text: s.faltam + (s.perdeu ? ' não registrada' + (s.faltam > 1 ? 's' : '') : ' em aberto') }) : null,
      el('span', { class: 'placar-xp ' + (s.xp >= 0 ? 'positivo' : 'negativo'), text: (s.xp >= 0 ? '+' : '') + s.xp + ' XP' })
    ]);
    return el('section', { class: 'painel painel-dieta' }, [cab, placar, aviso,
      el('div', { class: 'lista-refeicoes' }, lista.map(function (r) { return linhaRefeicao(iso, r, conta); }))]);
  }

  // ---------- Registro semanal: peso, medidas e fotos ----------
  function abrirMedidas(data, id) {
    var m = id ? Dados.medida(id) : Dados.medidaDoDia(data);
    data = m ? m.data : data;
    var anterior = Dados.medidas().filter(function (x) { return x.data < data; })[0] || null;
    var campos = {};
    var linhas = MEDIDAS.map(function (x) {
      var inp = el('input', { type: 'text', inputMode: 'decimal', value: m && m[x[0]] != null ? String(m[x[0]]).replace('.', ',') : '', placeholder: anterior && anterior[x[0]] != null ? 'antes: ' + fmtNum(anterior[x[0]]) : x[2] });
      campos[x[0]] = inp;
      return UI.campo(x[1] + ' (' + x[2] + ')', inp);
    });
    var dataInp = el('input', { type: 'date', value: data, max: UI.hoje() });
    var obs = el('textarea', { rows: 2, value: m ? m.obs || '' : '', placeholder: 'Como foi a semana? (opcional)' });
    var novas = {}, removidas = {};
    var fotos = el('div', { class: 'fotos-envio' }, ANGULOS.map(function (a) {
      var atual = m && m.fotos ? m.fotos[a[0]] : null;
      var previa = Fotos.imagem(atual, 'previa', a[1]);
      var arquivo = el('input', { type: 'file', accept: 'image/*', hidden: true, onchange: function () {
        var f = arquivo.files[0];
        if (!f) return;
        Fotos.reduzir(f).then(function (url) { novas[a[0]] = url; previa.src = url; previa.classList.remove('vazia', 'indisponivel'); }, function (e) { UI.aviso(e.message); });
      } });
      return el('div', { class: 'foto-envio' }, [
        el('button', { type: 'button', class: 'foto-botao', title: 'Escolher ou tirar a foto', onclick: function () { arquivo.click(); } }, [previa, el('span', { text: a[1] })]),
        arquivo,
        atual ? el('button', { type: 'button', class: 'link', text: 'tirar foto', onclick: function () { removidas[a[0]] = true; previa.src = Fotos.VAZIA; previa.classList.add('vazia'); delete novas[a[0]]; } }) : null
      ]);
    }));

    var botoes = [{ texto: 'Cancelar', classe: 'btn-secundario' }, { texto: 'Salvar', classe: 'btn-primario', acao: function () {
      var valores = { data: dataInp.value || data, obs: obs.value, fotos: {} };
      MEDIDAS.forEach(function (x) { valores[x[0]] = campos[x[0]].value; });
      if (!campos.peso.value.trim()) { UI.aviso('Informe pelo menos o peso.'); campos.peso.focus(); return false; }
      var tarefas = ANGULOS.map(function (a) {
        var k = a[0], antigo = m && m.fotos ? m.fotos[k] : null;
        if (novas[k]) return Fotos.salvar(novas[k]).then(function (fid) { valores.fotos[k] = fid; if (antigo) Fotos.remover(antigo); });
        if (removidas[k]) { valores.fotos[k] = null; if (antigo) Fotos.remover(antigo); }
        return Promise.resolve();
      });
      Promise.all(tarefas).then(function () {
        var salvo = Dados.salvarMedida(valores, m ? m.id : null);
        var faltaFoto = ANGULOS.filter(function (a) { return !salvo.fotos[a[0]]; }).length;
        UI.aviso('Registro semanal salvo' + (m ? '' : ' · +' + Dados.XP_DIETA.medidas + ' XP') + (faltaFoto ? ' · faltam ' + faltaFoto + (faltaFoto > 1 ? ' fotos' : ' foto') : ''));
        App.atualizar();
      });
    } }];
    if (m) botoes.unshift({ texto: 'Excluir', classe: 'btn-perigo btn-esquerda', acao: function () {
      UI.confirmar('Excluir o registro de ' + UI.fmtData(m.data) + ', com as fotos?', function () {
        ANGULOS.forEach(function (a) { if (m.fotos[a[0]]) Fotos.remover(m.fotos[a[0]]); });
        Dados.excluirMedida(m.id); App.atualizar();
      });
    } });
    UI.modal(m ? 'Registro semanal' : 'Registro semanal de domingo', [
      el('p', { class: 'modal-desc', text: 'Peso em jejum, medidas em cm e as fotos de frente, lateral e costas. Tente sempre o mesmo horário e a mesma luz para comparar.' }),
      UI.campo('Data', dataInp),
      el('div', { class: 'grade-medidas' }, linhas),
      el('div', { class: 'campo' }, [el('span', { class: 'campo-rotulo', text: 'Fotos' }), fotos, el('span', { class: 'campo-ajuda', text: 'No celular, toque para tirar a foto na hora.' })]),
      UI.campo('Anotação', obs)
    ], botoes, { icone: 'balanca', subtitulo: UI.fmtData(data) + (anterior ? ' · anterior em ' + UI.fmtData(anterior.data) : ' · ponto de partida') });
  }

  // Cartão na Página Inicial quando o registro do domingo está pendente.
  function painelPendente() {
    var dom = Dados.medidaPendente();
    if (!dom) return null;
    var primeiro = !Dados.medidas().length;
    return el('section', { class: 'painel painel-semanal' }, [
      el('div', { class: 'painel-semanal-icone' }, UI.icone('balanca')),
      el('div', { class: 'painel-semanal-texto' }, [
        el('strong', { text: primeiro ? 'Registre seu ponto de partida' : dom === UI.hoje() ? 'Hoje é dia do registro semanal' : 'Registro de domingo pendente' }),
        el('span', { text: 'Peso em jejum, braço, coxa e panturrilha, e fotos de frente, lateral e costas · +' + Dados.XP_DIETA.medidas + ' XP' })
      ]),
      UI.botao('Registrar', function () { abrirMedidas(dom); }, 'btn-primario')
    ]);
  }

  // ---------- Plano alimentar ----------
  function editarRefeicao(id) {
    var r = id ? Dados.refeicao(id) : null;
    var nome = el('input', { type: 'text', value: r ? r.nome : '', placeholder: 'Ex.: Café da manhã', maxLength: 50 });
    var hora = el('input', { type: 'time', value: r ? r.horario : '' });
    var soTreino = el('input', { type: 'checkbox', checked: !!(r && r.soTreino) });
    var obs = el('textarea', { rows: 3, value: r ? r.obs || '' : '', placeholder: 'Sugestões e observações (opcional)' });
    var itens = (r ? r.itens : []).map(function (i) { return Object.assign({}, i); });
    if (!itens.length) itens.push({ alimento: '', quantidade: '', substituicao: '' });
    var caixa = el('div', { class: 'editor-itens' });
    function desenhar() {
      caixa.innerHTML = '';
      itens.forEach(function (i, k) {
        function inp(campo, ph) { var x = el('input', { type: 'text', value: i[campo], placeholder: ph, maxLength: 200, oninput: function () { i[campo] = x.value; } }); return x; }
        caixa.appendChild(el('div', { class: 'item-editor' }, [
          inp('alimento', 'Alimento'), inp('quantidade', 'Quantidade'), inp('substituicao', 'Substituição (opcional)'),
          el('button', { type: 'button', class: 'btn-icone', title: 'Tirar', onclick: function () { itens.splice(k, 1); desenhar(); } }, UI.icone('lixo'))
        ]));
      });
    }
    desenhar();
    var botoes = [{ texto: 'Cancelar', classe: 'btn-secundario' }, { texto: 'Salvar', classe: 'btn-primario', acao: function () {
      if (!nome.value.trim()) { nome.focus(); return false; }
      Dados.salvarRefeicao({ nome: nome.value, horario: hora.value, soTreino: soTreino.checked, obs: obs.value, itens: itens }, id);
      App.atualizar();
    } }];
    if (r) botoes.unshift({ texto: 'Excluir', classe: 'btn-perigo btn-esquerda', acao: function () {
      UI.confirmar('Tirar "' + r.nome + '" do plano? Os registros antigos dela continuam.', function () { Dados.excluirRefeicao(r.id); App.atualizar(); });
    } });
    UI.modal(r ? 'Editar refeição' : 'Nova refeição', [
      el('div', { class: 'campos-linha' }, [UI.campo('Refeição', nome), UI.campo('Horário', hora)]),
      el('div', { class: 'campo' }, [el('span', { class: 'campo-rotulo', text: 'Alimentos' }), caixa,
        UI.botao('+ Alimento', function () { itens.push({ alimento: '', quantidade: '', substituicao: '' }); desenhar(); }, 'btn-secundario btn-mini')]),
      UI.campo('Observações', obs),
      el('label', { class: 'campo-check' }, [soTreino, el('span', { text: 'Só conta nos dias em que eu treinar (ex.: pós-treino)' })])
    ], botoes, { icone: 'prato' });
  }

  function importarArquivo() {
    var arquivo = el('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: function () {
      var f = arquivo.files[0];
      if (!f) return;
      var leitor = new FileReader();
      leitor.onload = function () {
        var plano;
        try { plano = JSON.parse(leitor.result); } catch (e) { alert('Arquivo inválido.'); return; }
        var desde = el('input', { type: 'date', value: Dados.inicioDaDieta() || Dados.proximaSegunda(UI.hoje()) });
        UI.modal('Importar plano alimentar', [
          el('p', { class: 'modal-desc', text: (plano.nome || f.name) + ': ' + (plano.refeicoes || []).length + ' refeições' + (plano.frutas && plano.frutas.length ? ' e tabela de frutas' : '') + '. As refeições atuais do plano serão trocadas por estas (os registros já feitos continuam).' }),
          UI.campo('Começar o acompanhamento em', desde, 'A partir desta data, cada refeição não registrada tira ' + (-Dados.XP_DIETA.perdida) + ' XP.')
        ], [
          { texto: 'Cancelar', classe: 'btn-secundario' },
          { texto: 'Importar', classe: 'btn-primario', acao: function () {
            try { Dados.importarPlano(plano, desde.value); UI.aviso('Plano alimentar importado'); App.atualizar(); }
            catch (e) { alert(e.message); return false; }
          } }
        ], { icone: 'prato' });
      };
      leitor.readAsText(f);
    } });
    document.body.appendChild(arquivo);
    arquivo.click();
    setTimeout(function () { arquivo.remove(); }, 60000);
  }

  function renderPlano(raiz) {
    var lista = Dados.refeicoes(), d = Dados.db.dieta;
    raiz.appendChild(el('div', { class: 'pagina-acoes acoes-plano' }, [
      UI.botao('Nova refeição', function () { editarRefeicao(); }, 'btn-primario', 'mais'),
      UI.botao('Importar plano (.json)', importarArquivo, 'btn-secundario')
    ]));
    if (!lista.length) { raiz.appendChild(el('div', { class: 'vazio' }, [
      el('p', { class: 'vazio-destaque', text: 'Nenhuma refeição no plano' }),
      el('p', { text: 'Cadastre cada refeição com os alimentos, a quantidade e a substituição, ou importe o arquivo do plano.' })
    ])); return; }
    var inicio = el('input', { type: 'date', value: d.desde || '', onchange: function () { Dados.definirInicioDaDieta(inicio.value); UI.aviso('Início do acompanhamento: ' + UI.fmtData(inicio.value)); } });
    raiz.appendChild(el('section', { class: 'painel painel-inicio-dieta' }, [
      UI.campo('Início do acompanhamento', inicio, 'A partir desta data, refeição não registrada tira ' + (-Dados.XP_DIETA.perdida) + ' XP. Seguir a dieta rende +' + Dados.XP_DIETA.refeicao + ' XP por refeição; comer outra coisa, 0.')
    ]));
    raiz.appendChild(el('div', { class: 'lista-plano' }, lista.map(function (r) {
      return el('section', { class: 'painel plano-refeicao' }, [
        el('div', { class: 'painel-lado-topo' }, [
          el('h2', { class: 'secao-titulo' }, [r.horario ? el('span', { class: 'refeicao-hora', text: r.horario }) : null, r.nome, r.soTreino ? UI.selo('Dia de treino', 'info') : null]),
          el('div', { class: 'treino-cartao-acoes' }, [
            el('button', { type: 'button', class: 'btn-icone', title: 'Subir', onclick: function () { Dados.moverRefeicao(r.id, -1); App.atualizar(); } }, UI.icone('subir')),
            el('button', { type: 'button', class: 'btn-icone', title: 'Descer', onclick: function () { Dados.moverRefeicao(r.id, 1); App.atualizar(); } }, UI.icone('descer')),
            el('button', { type: 'button', class: 'btn-icone', title: 'Editar', onclick: function () { editarRefeicao(r.id); } }, UI.icone('lapis'))
          ])
        ]),
        tabelaItens(r),
        r.obs ? el('p', { class: 'refeicao-obs', text: r.obs }) : null
      ]);
    })));
    if (d.frutas.length) raiz.appendChild(el('section', { class: 'painel' }, [
      el('h2', { class: 'secao-titulo', text: 'Tabela de frutas (1 porção)' }),
      el('div', { class: 'tabela-frutas' }, d.frutas.map(function (f) {
        return el('div', { class: 'fruta' }, [el('strong', { text: f.fruta }), el('span', { text: f.peso + (f.quantidade ? ' · ' + f.quantidade : '') })]);
      }))
    ]));
    if (d.orientacoes) raiz.appendChild(el('section', { class: 'painel' }, [
      el('h2', { class: 'secao-titulo', text: 'Orientações gerais' }),
      el('div', { class: 'orientacoes', text: d.orientacoes })
    ]));
  }

  // ---------- Evolução ----------
  function diferenca(a, b) {
    if (a == null || b == null) return null;
    return Math.round((a - b) * 10) / 10;
  }
  function textoDif(v, un) {
    if (v == null) return '';
    return (v > 0 ? '+' : v < 0 ? '−' : '±') + fmtNum(Math.abs(v)) + ' ' + un;
  }

  function comparadorFotos(lista) {
    var comFoto = lista.filter(function (m) { return ANGULOS.some(function (a) { return m.fotos[a[0]]; }); });
    if (!comFoto.length) return el('section', { class: 'painel' }, [el('h2', { class: 'secao-titulo', text: 'Comparar fotos' }), el('p', { class: 'modal-desc', text: 'As fotos dos registros de domingo aparecem aqui para comparar.' })]);
    function seletor(padrao) {
      return el('select', null, comFoto.map(function (m) { return el('option', { value: m.id, text: UI.fmtData(m.data), selected: m.id === padrao }); }));
    }
    var antes = seletor(comFoto[comFoto.length - 1].id), depois = seletor(comFoto[0].id), angulo = 'frente';
    var botoesAng = ANGULOS.map(function (a) {
      return el('button', { type: 'button', class: a[0] === angulo ? 'ativo' : '', text: a[1], onclick: function () {
        angulo = a[0]; botoesAng.forEach(function (b, i) { b.classList.toggle('ativo', ANGULOS[i][0] === angulo); }); desenhar();
      } });
    });
    var area = el('div', { class: 'fotos-comparar' });
    function desenhar() {
      area.innerHTML = '';
      [antes, depois].forEach(function (s) {
        var m = Dados.medida(s.value);
        area.appendChild(el('figure', { class: 'foto-comparar' }, [Fotos.imagem(m.fotos[angulo], 'grande', angulo), el('figcaption', { text: UI.fmtData(m.data) + (m.peso ? ' · ' + fmtNum(m.peso) + ' kg' : '') })]));
      });
    }
    antes.addEventListener('change', desenhar);
    depois.addEventListener('change', desenhar);
    desenhar();
    return el('section', { class: 'painel' }, [
      el('div', { class: 'painel-lado-topo' }, [el('h2', { class: 'secao-titulo', text: 'Comparar fotos' }), el('div', { class: 'segmentado' }, botoesAng)]),
      el('div', { class: 'campos-linha' }, [UI.campo('Antes', antes), UI.campo('Depois', depois)]),
      area
    ]);
  }

  function renderEvolucao(raiz) {
    var lista = Dados.medidas(), pend = Dados.medidaPendente();
    raiz.appendChild(el('div', { class: 'pagina-acoes acoes-plano' }, [
      UI.botao(pend ? 'Fazer o registro de ' + UI.fmtDiaMes(pend) : 'Novo registro', function () { abrirMedidas(pend || Dados.domingoDaSemana(UI.hoje())); }, 'btn-primario', 'mais')
    ]));
    if (!lista.length) { raiz.appendChild(el('div', { class: 'vazio' }, [
      el('p', { class: 'vazio-destaque', text: 'Nenhum registro ainda' }),
      el('p', { text: 'Todo domingo: peso em jejum, medidas de braço, coxa e panturrilha, e fotos de frente, lateral e costas. O primeiro registro é o ponto de partida.' })
    ])); return; }
    var inicial = lista[lista.length - 1], atual = lista[0];
    raiz.appendChild(el('div', { class: 'cartoes-evolucao' }, MEDIDAS.map(function (x) {
      var d = diferenca(atual[x[0]], inicial[x[0]]);
      return el('div', { class: 'cartao-evolucao' }, [
        el('span', { class: 'cartao-rotulo', text: x[1] }),
        el('strong', { class: 'cartao-valor', text: atual[x[0]] != null ? fmtNum(atual[x[0]]) + ' ' + x[2] : '—' }),
        el('span', { class: 'cartao-detalhe', text: lista.length > 1 && d != null ? textoDif(d, x[2]) + ' desde ' + UI.fmtDiaMes(inicial.data) : 'ponto de partida' })
      ]);
    })));
    raiz.appendChild(el('section', { class: 'painel' }, [
      el('h2', { class: 'secao-titulo', text: 'Semana a semana' }),
      el('div', { class: 'tabela-rolagem' }, el('table', { class: 'tabela-evolucao' }, [
        el('thead', null, el('tr', null, [el('th', { text: 'Data' })].concat(MEDIDAS.map(function (x) { return el('th', { text: x[1].replace(' em jejum', '') + ' (' + x[2] + ')' }); })).concat([el('th', { text: 'Fotos' }), el('th')]))),
        el('tbody', null, lista.map(function (m, i) {
          var ant = lista[i + 1];
          return el('tr', null, [el('td', { text: UI.fmtData(m.data) })].concat(MEDIDAS.map(function (x) {
            var d = ant ? diferenca(m[x[0]], ant[x[0]]) : null;
            return el('td', null, [el('span', { text: fmtNum(m[x[0]]) }), d != null ? el('small', { class: 'dif', text: textoDif(d, '') }) : null]);
          })).concat([
            el('td', { text: ANGULOS.filter(function (a) { return m.fotos[a[0]]; }).length + '/3' }),
            el('td', null, el('button', { type: 'button', class: 'btn-icone', title: 'Editar', onclick: function () { abrirMedidas(m.data, m.id); } }, UI.icone('lapis')))
          ]));
        }))
      ]))
    ]));
    raiz.appendChild(comparadorFotos(lista));
  }

  // ---------- Página ----------
  function renderRegistro(raiz) {
    var hoje = UI.hoje(), iso = diaAberto && diaAberto <= hoje ? diaAberto : hoje;
    var pend = painelPendente();
    if (pend) raiz.appendChild(pend);
    raiz.appendChild(painelDia(iso, { navegar: true, titulo: 'Refeições' }));
    // Semana atual e as anteriores (segunda a domingo).
    var semanas = [];
    for (var i = 0; i < 4; i++) semanas.push(Dados.semanaDieta(UI.somarDias(hoje, -7 * i)));
    raiz.appendChild(el('section', { class: 'painel' }, [
      el('h2', { class: 'secao-titulo', text: 'Semanas' }),
      el('div', { class: 'lista-semanas' }, semanas.map(function (s) {
        var feitas = s.dieta + s.outro, pct = s.total ? Math.round(s.dieta / s.total * 100) : 0;
        return el('div', { class: 'semana-linha' }, [
          el('span', { class: 'semana-datas', text: UI.fmtDiaMes(s.inicio) + ' a ' + UI.fmtDiaMes(s.fim) }),
          el('div', { class: 'semana-barra' }, UI.barra(pct)),
          el('span', { class: 'semana-num', text: s.total ? pct + '% na dieta' : '—' }),
          el('span', { class: 'semana-det', text: s.total ? feitas + '/' + s.total + ' registradas' : '' })
        ]);
      }))
    ]));
  }

  function render(raiz, partes) {
    var aba = partes && partes[0] === 'plano' ? 'plano' : partes && partes[0] === 'evolucao' ? 'evolucao' : 'registro';
    raiz.appendChild(el('div', { class: 'pagina-topo' }, el('div', null, [
      el('h1', { class: 'pagina-titulo', text: 'Dieta' }),
      el('div', { class: 'pagina-subtitulo', text: 'Seguir o plano rende pontos; refeição não registrada tira pontos.' })
    ])));
    raiz.appendChild(el('div', { class: 'segmentado segmentado-areas' }, [['registro', 'Registro', '#/dieta'], ['plano', 'Plano alimentar', '#/dieta/plano'], ['evolucao', 'Evolução', '#/dieta/evolucao']].map(function (x) {
      return el('button', { type: 'button', class: aba === x[0] ? 'ativo' : '', text: x[1], onclick: function () { location.hash = x[2]; } });
    })));
    if (aba === 'plano') renderPlano(raiz);
    else if (aba === 'evolucao') renderEvolucao(raiz);
    else renderRegistro(raiz);
  }

  return { render: render, painelDia: painelDia, painelPendente: painelPendente, abrirMedidas: abrirMedidas, MEDIDAS: MEDIDAS };
})();
