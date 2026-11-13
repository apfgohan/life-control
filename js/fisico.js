// Página "Físico": treinamento e alimentação. Ainda não especificada; por enquanto só mostra as metas da área.
var Fisico = (function () {
  var el = UI.el;

  function render(raiz) {
    var abertas = Dados.db.metas.filter(function (m) { return m.area === 'fisico' && !m.concluida; }).length;
    raiz.appendChild(el('div', { class: 'pagina-topo' }, el('div', null, [
      el('h1', { class: 'pagina-titulo', text: 'Físico' }),
      el('div', { class: 'pagina-subtitulo', text: 'Treinamento e alimentação.' })
    ])));
    raiz.appendChild(el('div', { class: 'vazio' }, [
      el('p', { class: 'vazio-destaque', text: 'Em construção' }),
      el('p', { text: 'O controle de treinos e de alimentação entra numa próxima versão. Enquanto isso, as metas da área Físico já contam XP' + (abertas ? ' (' + abertas + (abertas === 1 ? ' em aberto).' : ' em aberto).') : '.') }),
      el('div', { class: 'vazio-acoes' }, [
        UI.botao('Nova meta física', function () { Metas.editar(null, 'fisico'); }, 'btn-primario'),
        el('a', { class: 'btn btn-secundario', href: '#/metas', text: 'Ver metas' })
      ])
    ]));
  }

  return { render: render };
})();
