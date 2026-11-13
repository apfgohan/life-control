// Página "Configurações": perfil, categorias e itens (com as contas fixas de todo mês).
var Configuracoes = (function () {
  var el = UI.el;

  // ---------- Perfil ----------
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

  // ---------- Categorias e itens ----------
  function editarCategoria(id, tipo) {
    var c = id ? Dados.categoria(id) : null;
    tipo = c ? c.tipo : tipo;
    var nome = el('input', { type: 'text', value: c ? c.nome : '', placeholder: tipo === 'gasto' ? 'Ex.: Educação' : 'Ex.: Rendimentos', maxLength: 50 });
    var cor = el('input', { type: 'color', value: c ? c.cor : '#3b8cf0' });
    var saude = el('input', { type: 'checkbox', checked: !!(c && c.papel === 'saude') });
    var botoes = [{ texto: 'Cancelar', classe: 'btn-secundario' }, { texto: 'Salvar', classe: 'btn-primario', acao: function () {
      if (!nome.value.trim()) { nome.focus(); return false; }
      Dados.salvarCategoria({ nome: nome.value, cor: cor.value, tipo: tipo, papel: saude.checked ? 'saude' : null }, id);
      App.atualizar();
    } }];
    if (c) botoes.unshift({ texto: 'Excluir', classe: 'btn-perigo btn-esquerda', acao: function () {
      UI.confirmar('Excluir a categoria "' + c.nome + '" e os itens dela?', function () {
        if (!Dados.excluirCategoria(c.id)) UI.aviso('Há lançamentos nesta categoria: ela não pode ser excluída.');
        App.atualizar();
      });
    } });
    UI.modal(c ? 'Editar categoria' : 'Nova categoria de ' + (tipo === 'gasto' ? 'gasto' : 'entrada'), [
      el('div', { class: 'campos-linha' }, [UI.campo('Nome', nome), UI.campo('Cor', cor)]),
      tipo === 'gasto' ? el('label', { class: 'campo-check' }, [saude, el('span', { text: 'Gastos de saúde (comparar com o Auxílio Saúde)' })]) : null
    ], botoes);
  }

  function editarItem(id, categoriaId) {
    var i = id ? Dados.item(id) : null;
    var c = Dados.categoria(i ? i.categoriaId : categoriaId), entrada = c.tipo === 'entrada';
    var nome = el('input', { type: 'text', value: i ? i.nome : '', placeholder: entrada ? 'Ex.: Aluguel recebido' : 'Ex.: Condomínio', maxLength: 60 });
    var fixo = el('input', { type: 'checkbox', checked: !!(i && i.fixo) });
    var valor = el('input', { type: 'text', inputMode: 'decimal', placeholder: '0,00', value: i && i.fixo ? UI.campoValor(i.fixo.valor) : '' });
    var dia = el('input', { type: 'number', min: 1, max: 31, value: i && i.fixo ? i.fixo.dia : 5 });
    var papel = el('select', null, [['', 'Entrada comum'], ['diaria', 'Diária de missão'], ['auxilio-saude', 'Auxílio Saúde (reembolso)']].map(function (o) {
      return el('option', { value: o[0], text: o[1], selected: ((i && i.papel) || '') === o[0] });
    }));
    var linhaFixo = el('div', { class: 'campos-linha' }, [UI.campo('Valor de todo mês (R$)', valor), UI.campo(entrada ? 'Dia do recebimento' : 'Dia do vencimento', dia)]);
    function ajustar() { linhaFixo.hidden = !fixo.checked; }
    fixo.addEventListener('change', ajustar);
    ajustar();

    var botoes = [{ texto: 'Cancelar', classe: 'btn-secundario' }, { texto: 'Salvar', classe: 'btn-primario', acao: function () {
      if (!nome.value.trim()) { nome.focus(); return false; }
      var v = UI.lerValor(valor.value);
      if (fixo.checked && !(v > 0)) { UI.aviso('Informe o valor de todo mês.'); valor.focus(); return false; }
      Dados.salvarItem({ nome: nome.value, categoriaId: c.id, papel: entrada ? papel.value : null, fixo: fixo.checked ? { valor: v, dia: Number(dia.value) || 1 } : null }, id);
      App.atualizar();
    } }];
    if (i) botoes.unshift({ texto: 'Excluir', classe: 'btn-perigo btn-esquerda', acao: function () {
      UI.confirmar('Excluir o item "' + i.nome + '"? Se já houver lançamentos, ele só sai das listas e o histórico continua.', function () {
        UI.aviso(Dados.excluirItem(i.id) === 'arquivado' ? 'Item arquivado (o histórico foi mantido)' : 'Item excluído');
        App.atualizar();
      });
    } });
    UI.modal(i ? 'Editar item' : 'Novo item em ' + c.nome, [
      UI.campo('Nome', nome),
      entrada ? UI.campo('Tipo', papel, 'Diárias e Auxílio Saúde entram nas comparações da página Missões e Saúde.') : null,
      el('label', { class: 'campo-check' }, [fixo, el('span', { text: entrada ? 'Entrada fixa: repete todo mês' : 'Conta fixa: repete todo mês' })]),
      linhaFixo,
      el('span', { class: 'campo-ajuda', text: 'Itens fixos aparecem como previstos no calendário, no dia marcado, até você confirmar o pagamento ou recebimento.' })
    ], botoes);
  }

  function blocoCategoria(c) {
    var itens = Dados.itensDa(c.id);
    return el('div', { class: 'cfg-categoria', style: { borderLeftColor: c.cor } }, [
      el('div', { class: 'cfg-categoria-topo' }, [
        el('span', { class: 'cfg-categoria-nome', text: c.nome }),
        c.papel === 'saude' ? UI.selo('Saúde', 'info') : null,
        el('span', { class: 'cfg-espaco' }),
        el('button', { type: 'button', class: 'btn-icone', title: 'Editar categoria', onclick: function () { editarCategoria(c.id); } }, UI.icone('lapis'))
      ]),
      el('div', { class: 'cfg-itens' }, itens.map(function (i) {
        return el('button', { type: 'button', class: 'cfg-item', title: 'Editar item', onclick: function () { editarItem(i.id); } }, [
          el('span', { text: i.nome }),
          i.papel === 'diaria' ? UI.selo('Diária', 'info') : i.papel === 'auxilio-saude' ? UI.selo('Auxílio Saúde', 'info') : null,
          i.fixo ? el('span', { class: 'cfg-fixo', text: UI.fmtMoeda(i.fixo.valor) + ' · todo dia ' + i.fixo.dia }) : null
        ]);
      }).concat([el('button', { type: 'button', class: 'cfg-item cfg-novo', onclick: function () { editarItem(null, c.id); } }, [UI.icone('mais'), 'Novo item'])]))
    ]);
  }

  function painelCategorias(tipo, titulo, ajuda) {
    return el('section', { class: 'painel' }, [
      el('div', { class: 'painel-lado-topo' }, [
        el('h2', { class: 'secao-titulo', text: titulo }),
        UI.botao('Nova categoria', function () { editarCategoria(null, tipo); }, 'btn-secundario btn-mini', 'mais')
      ]),
      el('p', { class: 'modal-desc cfg-ajuda', text: ajuda }),
      el('div', { class: 'cfg-lista' }, Dados.categorias(tipo).map(blocoCategoria))
    ]);
  }

  function render(raiz) {
    raiz.appendChild(el('div', { class: 'pagina-topo' }, el('div', null, [
      el('h1', { class: 'pagina-titulo', text: 'Configurações' }),
      el('div', { class: 'pagina-subtitulo', text: 'Perfil, categorias e contas fixas.' })
    ])));
    raiz.appendChild(painelPerfil());
    raiz.appendChild(painelCategorias('entrada', 'Entradas (fontes de renda)', 'Marque o salário como entrada fixa para ele aparecer todo mês no calendário.'));
    raiz.appendChild(painelCategorias('gasto', 'Gastos', 'Clique num item para renomear ou marcar como conta fixa (aluguel, internet…), com valor e dia do vencimento.'));
  }

  return { render: render };
})();
