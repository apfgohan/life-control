// Frases motivacionais da Página Inicial: uma por dia (a mesma o dia todo, em qualquer aparelho),
// e o botão de trocar mostra outra. [texto, autor, fonte (ou ''), atribuida: a autoria não é comprovada]
var Frases = (function () {
  var el = UI.el;
  var LISTA = [
    // Alexandre, o Grande
    ['Para mim, guardo a esperança.', 'Alexandre, o Grande', 'Plutarco, Vida de Alexandre'],
    ['Viver no luxo é coisa de escravos; trabalhar duro é coisa de reis.', 'Alexandre, o Grande', 'Plutarco, Vida de Alexandre'],
    ['Não temo um exército de leões liderado por uma ovelha; temo um exército de ovelhas liderado por um leão.', 'Alexandre, o Grande', '', true],
    // Napoleão
    ['A vitória pertence ao mais perseverante.', 'Napoleão Bonaparte', '', true],
    ['Impossível é uma palavra que só se encontra no dicionário dos tolos.', 'Napoleão Bonaparte', '', true],
    ['A coragem é como o amor: precisa de esperança para se alimentar.', 'Napoleão Bonaparte', '', true],
    // Júlio César
    ['Vim, vi, venci.', 'Júlio César', 'Suetônio, Vida dos Césares'],
    ['A sorte está lançada.', 'Júlio César', 'Suetônio, Vida dos Césares'],
    ['Os homens acreditam de boa vontade naquilo que desejam.', 'Júlio César', 'A Guerra das Gálias'],
    // Marco Aurélio
    ['O que impede a ação faz a ação avançar. O que está no caminho torna-se o caminho.', 'Marco Aurélio', 'Meditações'],
    ['Não percas mais tempo discutindo como deve ser um homem bom. Sê um.', 'Marco Aurélio', 'Meditações'],
    ['A alma tinge-se da cor dos seus pensamentos.', 'Marco Aurélio', 'Meditações'],
    ['De manhã, quando custar levantar, pensa: levanto-me para fazer o trabalho de um ser humano.', 'Marco Aurélio', 'Meditações'],
    ['Faz cada coisa como se fosse a última da tua vida.', 'Marco Aurélio', 'Meditações'],
    // Churchill
    ['Nunca ceda. Nunca, nunca, nunca.', 'Winston Churchill', 'Discurso em Harrow, 1941'],
    ['Se você está atravessando o inferno, continue andando.', 'Winston Churchill', '', true],
    ['O sucesso não é definitivo, o fracasso não é fatal: o que conta é a coragem de continuar.', 'Winston Churchill', '', true],
    // Aristóteles
    ['Tornamo-nos justos praticando atos justos, moderados praticando a moderação e corajosos praticando atos de coragem.', 'Aristóteles', 'Ética a Nicômaco'],
    ['Somos o que fazemos repetidamente. A excelência, portanto, não é um ato, mas um hábito.', 'Aristóteles', 'na síntese de Will Durant'],
    ['Considero mais corajoso quem vence os seus desejos do que quem vence os seus inimigos.', 'Aristóteles', '', true],
    // Sócrates e Platão
    ['Uma vida sem exame não vale a pena ser vivida.', 'Sócrates', 'Platão, Apologia'],
    ['É uma vergonha envelhecer sem conhecer a beleza e a força de que o próprio corpo é capaz.', 'Sócrates', 'Xenofonte, Memoráveis'],
    ['A primeira e a melhor das vitórias é a vitória sobre si mesmo.', 'Platão', 'As Leis'],
    ['O começo é a parte mais importante do trabalho.', 'Platão', 'A República'],
    // Miyamoto Musashi
    ['Mil dias de treino para forjar, dez mil dias de treino para polir.', 'Miyamoto Musashi', 'O Livro dos Cinco Anéis'],
    ['Hoje é a vitória sobre quem você foi ontem.', 'Miyamoto Musashi', 'O Livro dos Cinco Anéis'],
    ['Não faça nada que não tenha utilidade.', 'Miyamoto Musashi', 'O Livro dos Cinco Anéis'],
    // Dostoiévski
    ['O segredo da existência humana não está só em viver, mas em saber para que se vive.', 'Dostoiévski', 'Os Irmãos Karamázov'],
    ['Dar um passo novo, dizer uma palavra nova: é disso que as pessoas mais têm medo.', 'Dostoiévski', 'Crime e Castigo'],
    ['Acima de tudo, não minta para si mesmo.', 'Dostoiévski', 'Os Irmãos Karamázov'],
    // Tolkien (poucas falas curtas: a obra ainda tem direitos autorais)
    ['Tudo o que temos de decidir é o que fazer com o tempo que nos é dado.', 'Gandalf', 'Tolkien, O Senhor dos Anéis'],
    ['Nem todos os que vagueiam estão perdidos.', 'Tolkien', 'O Senhor dos Anéis'],
    // Tolstói
    ['Os dois guerreiros mais poderosos são a paciência e o tempo.', 'Tolstói', 'Guerra e Paz'],
    ['Não há grandeza onde não há simplicidade, bondade e verdade.', 'Tolstói', 'Guerra e Paz'],
    ['Todos pensam em mudar o mundo, mas ninguém pensa em mudar a si mesmo.', 'Tolstói', '', true],
    // Shakespeare
    ['Nossas dúvidas são traidoras: fazem-nos perder o bem que poderíamos conquistar, por medo de tentar.', 'Shakespeare', 'Medida por Medida'],
    ['Todas as coisas estão prontas, se a nossa mente estiver.', 'Shakespeare', 'Henrique V'],
    ['Os covardes morrem muitas vezes antes da morte; o valente só prova a morte uma vez.', 'Shakespeare', 'Júlio César'],
    ['Nós, poucos; nós, felizes poucos; nós, bando de irmãos.', 'Shakespeare', 'Henrique V'],
    // Homero
    ['Aguenta, coração: já aguentaste coisas piores.', 'Homero', 'Odisseia'],
    ['Ser sempre o melhor e superar os outros.', 'Homero', 'Ilíada']
  ].map(function (f) { return { texto: f[0], autor: f[1], fonte: f[2] || '', atribuida: !!f[3] }; });

  var desvio = 0; // quantas vezes trocou hoje (só nesta aba)

  // A frase do dia: muda à meia-noite e não repete enquanto não passar pela lista toda.
  function doDia(iso) {
    var dias = Math.floor(new Date((iso || UI.hoje()) + 'T12:00:00').getTime() / 86400000);
    var i = ((dias * 7 + desvio) % LISTA.length + LISTA.length) % LISTA.length; // 7 e o tamanho da lista não têm divisor comum: percorre todas
    return LISTA[i];
  }

  function painel() {
    var f = doDia();
    var caixa = el('section', { class: 'frase-dia' });
    function desenhar() {
      f = doDia();
      caixa.innerHTML = '';
      caixa.appendChild(el('span', { class: 'frase-aspas', text: '“' }));
      caixa.appendChild(el('div', { class: 'frase-corpo' }, [
        el('blockquote', { class: 'frase-texto', text: f.texto }),
        el('div', { class: 'frase-autor' }, [
          el('strong', { text: (f.atribuida ? 'Atribuída a ' : '') + f.autor }),
          f.fonte ? el('span', { text: f.fonte }) : null
        ])
      ]));
      caixa.appendChild(el('button', { type: 'button', class: 'btn-icone frase-trocar', title: 'Outra frase', 'aria-label': 'Outra frase', onclick: function () { desvio++; desenhar(); } }, UI.icone('trocar')));
    }
    desenhar();
    return caixa;
  }

  return { LISTA: LISTA, doDia: doDia, painel: painel };
})();
