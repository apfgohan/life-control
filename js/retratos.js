// Retratos das patentes: o personagem de cada patente, que vai de franzino (Aldeão) a forte, até o Rei-Sol.
// Cada retrato é um SVG montado aqui (ids únicos por desenho, para vários na mesma tela).
var Retratos = (function () {
  var PATENTES = [
    ['Aldeão', 0, 'povo'], ['Pajem', 200, 'povo'], ['Escudeiro', 600, 'povo'],
    ['Homem de Armas', 1200, 'armas'], ['Sargento', 2000, 'armas'],
    ['Cavaleiro', 3200, 'cavalaria'], ['Cavaleiro Bannerete', 5000, 'cavalaria'],
    ['Barão', 7500, 'nobreza'], ['Visconde', 10500, 'nobreza'], ['Conde', 14500, 'nobreza'], ['Marquês', 19500, 'nobreza'],
    ['Duque', 26000, 'realeza'], ['Príncipe', 34000, 'realeza'], ['Rei', 45000, 'realeza']
  ];
  var GRUPO = {
    povo: { anel: '#c9a77c', fundo: '#3a2e22' }, armas: { anel: '#b7c1d6', fundo: '#252b38' },
    cavalaria: { anel: '#7db8ff', fundo: '#16264a' }, nobreza: { anel: '#c7a8ff', fundo: '#2a1d48' }, realeza: { anel: '#ffd86b', fundo: '#3b2f12' }
  };
  var O = '#241d2e', PELE = '#f1c6a0', PELE_S = '#d9a47c';
  var AL = 'stroke="' + O + '" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"';
  var uid = 0;
  function posNoGrupo(i) { var g = PATENTES[i][2], n = 0; for (var k = 0; k < i; k++) if (PATENTES[k][2] === g) n++; return n; }
  function r(v) { return Math.round(v * 100) / 100; }
  
  // ---------- Físico: t de 0 (franzino) a 1 (forte) ----------
  function fisico(t, heroico) {
    var a = heroico ? { w: [12.5, 27], nk: [2.6, 6.2], s: [47, 40.5], jw: [4.6, 9], hw: [8.6, 10.2] }
                    : { w: [14.5, 23.5], nk: [2.8, 5], s: [46, 42], jw: [5, 8], hw: [8.8, 9.8] };
    function L(p) { return a[p][0] + (a[p][1] - a[p][0]) * t; }
    return { t: t, w: L('w'), nk: L('nk'), s: L('s'), jw: L('jw'), hw: L('hw'), heroico: heroico };
  }
  // Tronco: ombros, trapézio e (com força) deltoides e peitoral desenhados.
  function tronco(f, cor, extra) {
    var w = f.w, s = f.s, nk = f.nk, trap = 2 + f.t * (f.heroico ? 5 : 3);
    var d = 'M' + r(32 - w - 2) + ' 68 L' + r(32 - w) + ' ' + r(s + 9) + ' C' + r(32 - w) + ' ' + r(s + 2) + ' ' + r(32 - w + 4) + ' ' + r(s) + ' ' + r(32 - nk - trap) + ' ' + r(s - 1) +
      ' Q' + r(32 - nk) + ' ' + r(s - 2) + ' ' + r(32 - nk) + ' ' + r(s - 4) + ' L' + r(32 + nk) + ' ' + r(s - 4) + ' Q' + r(32 + nk) + ' ' + r(s - 2) + ' ' + r(32 + nk + trap) + ' ' + r(s - 1) +
      ' C' + r(32 + w - 4) + ' ' + r(s) + ' ' + r(32 + w) + ' ' + r(s + 2) + ' ' + r(32 + w) + ' ' + r(s + 9) + ' L' + r(32 + w + 2) + ' 68z';
    var linhas = '';
    if (f.t > 0.3) { // deltoides
      var op = Math.min(0.55, (f.t - 0.3) * 1.2);
      linhas += '<path d="M' + r(32 - w + 1) + ' ' + r(s + 10) + ' C' + r(32 - w + 4) + ' ' + r(s + 6) + ' ' + r(32 - w + 6) + ' ' + r(s + 5) + ' ' + r(32 - w + 7) + ' ' + r(s + 1) + 'M' + r(32 + w - 1) + ' ' + r(s + 10) + ' C' + r(32 + w - 4) + ' ' + r(s + 6) + ' ' + r(32 + w - 6) + ' ' + r(s + 5) + ' ' + r(32 + w - 7) + ' ' + r(s + 1) + '" fill="none" stroke="' + O + '" stroke-opacity="' + op + '" stroke-width="1.2"/>';
    }
    if (f.t > 0.45) { // peitoral
      var op2 = Math.min(0.5, (f.t - 0.45) * 1.3), pw = w * 0.62;
      linhas += '<path d="M32 ' + r(s + 4) + ' V' + r(s + 11) + ' M32 ' + r(s + 11) + ' Q' + r(32 - pw * 0.6) + ' ' + r(s + 14) + ' ' + r(32 - pw) + ' ' + r(s + 9) + ' M32 ' + r(s + 11) + ' Q' + r(32 + pw * 0.6) + ' ' + r(s + 14) + ' ' + r(32 + pw) + ' ' + r(s + 9) + '" fill="none" stroke="' + O + '" stroke-opacity="' + op2 + '" stroke-width="1.2"/>';
    }
    var pescoco = '<path d="M' + r(32 - nk) + ' 31 V' + r(s - 2) + ' Q32 ' + r(s + 1) + ' ' + r(32 + nk) + ' ' + r(s - 2) + ' V31z" fill="' + PELE + '" ' + AL + '/>' +
      (f.t > 0.5 ? '<path d="M' + r(32 - nk + 1) + ' 33 L' + r(32 - 1) + ' ' + r(s - 2) + 'M' + r(32 + nk - 1) + ' 33 L' + r(32 + 1) + ' ' + r(s - 2) + '" stroke="' + PELE_S + '" stroke-width="1"/>' : '');
    return pescoco + '<path d="' + d + '" fill="' + cor + '" ' + AL + '/>' + (extra ? extra(f) : '') + linhas;
  }
  // Metade direita do tronco (para roupas de duas cores).
  function metadeDireita(f, cor) {
    var w = f.w, s = f.s, nk = f.nk, trap = 2 + f.t * (f.heroico ? 5 : 3);
    return '<path d="M32 68 V' + r(s - 1.5) + ' L' + r(32 + nk + trap) + ' ' + r(s - 1) + ' C' + r(32 + w - 4) + ' ' + r(s) + ' ' + r(32 + w) + ' ' + r(s + 2) + ' ' + r(32 + w) + ' ' + r(s + 9) + ' L' + r(32 + w + 2) + ' 68z" fill="' + cor + '" ' + AL + '/>';
  }
  // Rosto: magro e de queixo fino no começo; largo, queixo quadrado e sobrancelha firme no fim.
  function rosto(f, o) {
    o = o || {};
    var hw = f.hw, jw = f.jw, t = f.t, queixo = 37.5 + (1 - t) * 0.6;
    var d = 'M' + r(32 - hw) + ' 26 C' + r(32 - hw) + ' 15 ' + r(32 + hw) + ' 15 ' + r(32 + hw) + ' 26 C' + r(32 + hw) + ' 30 ' + r(32 + jw + 1) + ' 33 ' + r(32 + jw) + ' 34.5 Q' + r(32 + jw * 0.4) + ' ' + r(queixo) + ' 32 ' + r(queixo) + ' Q' + r(32 - jw * 0.4) + ' ' + r(queixo) + ' ' + r(32 - jw) + ' 34.5 C' + r(32 - jw - 1) + ' 33 ' + r(32 - hw) + ' 30 ' + r(32 - hw) + ' 26z';
    var s = '<ellipse cx="' + r(32 - hw - .3) + '" cy="27.5" rx="1.6" ry="2.4" fill="' + PELE + '" ' + AL + '/><ellipse cx="' + r(32 + hw + .3) + '" cy="27.5" rx="1.6" ry="2.4" fill="' + PELE + '" ' + AL + '/>';
    s += '<path d="' + d + '" fill="' + (o.pele || PELE) + '" ' + AL + '/>';
    if (t < 0.25) s += '<path d="M' + r(32 - hw + 2) + ' 30.5 q1 1.6 2.4 2.2M' + r(32 + hw - 2) + ' 30.5 q-1 1.6 -2.4 2.2" stroke="' + PELE_S + '" stroke-width="1" fill="none"/>'; // bochecha funda
    var bw = 1 + t * 1.1, inc = t * 1.2, ey = 27;
    s += '<path d="M' + r(29.6) + ' ' + r(24 + inc) + ' L' + r(25.6) + ' ' + r(23.6) + 'M' + r(34.4) + ' ' + r(24 + inc) + ' L' + r(38.4) + ' ' + r(23.6) + '" stroke="' + (o.sobrancelha || '#3b2a1e') + '" stroke-width="' + r(bw) + '" stroke-linecap="round"/>';
    if (o.olhoBrilho) s += '<circle cx="28.3" cy="' + ey + '" r="1.9" fill="' + o.olhoBrilho + '" opacity=".55"/><circle cx="35.7" cy="' + ey + '" r="1.9" fill="' + o.olhoBrilho + '" opacity=".55"/>';
    s += '<ellipse cx="28.3" cy="' + ey + '" rx="1.15" ry="' + r(1.2 - t * .2) + '" fill="' + (o.olho || O) + '"/><ellipse cx="35.7" cy="' + ey + '" rx="1.15" ry="' + r(1.2 - t * .2) + '" fill="' + (o.olho || O) + '"/>';
    s += '<path d="M32 28.5 L31 31.6 H33" fill="none" stroke="' + PELE_S + '" stroke-width="1"/>';
    s += '<path d="M' + r(30 - t * .6) + ' 34 Q32 ' + r(o.sorriso ? 35.4 : 34.6 - t * .3) + ' ' + r(34 + t * .6) + ' 34" fill="none" stroke="' + O + '" stroke-width="1.1" stroke-linecap="round"/>';
    return s;
  }
  function barba(f, cor, comprida) {
    var hw = f.hw, jw = f.jw, fundo = 39.5 + (comprida || 0);
    return '<path d="M' + r(32 - hw + .4) + ' 27 C' + r(32 - hw) + ' 33 ' + r(32 - jw - .5) + ' 37 32 ' + r(fundo) + ' C' + r(32 + jw + .5) + ' 37 ' + r(32 + hw) + ' 33 ' + r(32 + hw - .4) + ' 27 C' + r(32 + hw - 2) + ' 31 35 32 32 32 C29 32 ' + r(32 - hw + 2) + ' 31 ' + r(32 - hw + .4) + ' 27z" fill="' + cor + '" ' + AL + '/>' +
      '<path d="M29.4 32.4 Q32 31.2 34.6 32.4" fill="none" stroke="' + cor + '" stroke-width="2.2" stroke-linecap="round"/>' +
      '<path d="M30.3 34.2 Q32 35.2 33.7 34.2" fill="none" stroke="' + O + '" stroke-width="1" stroke-linecap="round"/>';
  }
  function cabelo(f, cor) { var hw = f.hw; return '<path d="M' + r(32 - hw - .6) + ' 27 C' + r(32 - hw - 2) + ' 17 ' + r(32 - 4) + ' 13.5 32 13.5 S' + r(32 + hw + 2) + ' 17 ' + r(32 + hw + .6) + ' 27 C' + r(32 + hw - 1.5) + ' 22 ' + r(32 + 3) + ' 20 32 20.5 S' + r(32 - hw + 1.5) + ' 22 ' + r(32 - hw - .6) + ' 27z" fill="' + cor + '" ' + AL + '/>'; }
  function arminho(f, y) {
    var w = f.w * 0.92;
    return '<path d="M' + r(32 - w) + ' ' + r(y + 3) + ' C' + r(32 - w * 0.5) + ' ' + r(y - 2) + ' ' + r(32 + w * 0.5) + ' ' + r(y - 2) + ' ' + r(32 + w) + ' ' + r(y + 3) + ' v4 C' + r(32 + w * 0.5) + ' ' + r(y + 2) + ' ' + r(32 - w * 0.5) + ' ' + r(y + 2) + ' ' + r(32 - w) + ' ' + r(y + 7) + 'z" fill="#f7f4ee" ' + AL + '/>' +
      '<path d="M' + r(32 - w * .55) + ' ' + r(y + 2) + 'v2M32 ' + r(y) + 'v2M' + r(32 + w * .55) + ' ' + r(y + 2) + 'v2" stroke="' + O + '" stroke-width="1.3"/>';
  }
  function coroinha(pontas, cor, joia, alto, larg) {
    var w = larg || 22, x0 = 32 - w / 2, y = 17.5, h = alto || 6, d = 'M' + x0 + ' ' + (y + 4);
    for (var k = 0; k <= pontas; k++) { var x = x0 + w * k / pontas; d += ' L' + r(x) + ' ' + (y - h) + (k < pontas ? ' L' + r(x + w / pontas / 2) + ' ' + (y - 1) : ''); }
    d += ' L' + (x0 + w) + ' ' + (y + 4) + 'z';
    var bolas = ''; for (k = 0; k <= pontas; k++) bolas += '<circle cx="' + r(x0 + w * k / pontas) + '" cy="' + (y - h - 1) + '" r="1.5" fill="#f7f4ee" ' + AL + '/>';
    return '<path d="' + d + '" fill="' + cor + '" ' + AL + '/>' + bolas + (joia ? '<circle cx="32" cy="' + (y + 1) + '" r="1.6" fill="' + joia + '"/>' : '');
  }
  function ombreiras(f, cor) {
    var rr = 4 + f.t * (f.heroico ? 4.5 : 3);
    return '<path d="M' + r(32 - f.w - 1.5) + ' ' + r(f.s + 8) + ' a' + rr + ' ' + rr + ' 0 0 1 ' + r(rr * 1.9) + ' ' + r(-rr * .9) + ' l1 ' + r(rr * 1.2) + 'z" fill="' + cor + '" ' + AL + '/>' +
      '<path d="M' + r(32 + f.w + 1.5) + ' ' + r(f.s + 8) + ' a' + rr + ' ' + rr + ' 0 0 0 ' + r(-rr * 1.9) + ' ' + r(-rr * .9) + ' l-1 ' + r(rr * 1.2) + 'z" fill="' + cor + '" ' + AL + '/>';
  }
  function elmoFechado(cor, pluma) {
    return (pluma ? '<path d="M33 11c5-6 12-6 15-2-4 0-8 2-10 6z" fill="#e0453a" ' + AL + '/>' : '') +
      '<path d="M21 22c0-8 5-12 11-12s11 4 11 12v14c0 2-1 3-3 3H24c-2 0-3-1-3-3z" fill="' + cor + '" ' + AL + '/><path d="M23 25.5h18" stroke="' + O + '" stroke-width="2.4" stroke-linecap="round"/><path d="M32 28v9M28 32h8" stroke="' + O + '" stroke-width="1.4"/>' +
      (pluma ? '<path d="M21 21.5h22" stroke="#f2c14e" stroke-width="1.6"/>' : '');
  }
  
  // Personagens 0 a 12 (o Rei tem opções à parte). Cada um recebe o físico f.
  var PERSONAGENS = [
    function (f) { return tronco(f, '#8a6a45', function (f) { return '<path d="M32 ' + r(f.s - 1) + 'v20" stroke="#6b4f30" stroke-width="1.3"/>'; }) + rosto(f) + cabelo(f, '#6b4a2b') + '<ellipse cx="32" cy="19" rx="16" ry="3.4" fill="#e3c27a" ' + AL + '/><path d="M23.5 19c0-6 4-9 8.5-9s8.5 3 8.5 9z" fill="#e8cc86" ' + AL + '/><path d="M23.9 17h16.2" stroke="#b5452f" stroke-width="2"/>'; },
    function (f) { return tronco(f, '#c0392b', function (f) { return metadeDireita(f, '#f2c14e'); }) + rosto(f) + cabelo(f, '#a0683a') + '<path d="M20 20c2-6 7-8 12-8s11 2 13 6c-6 3-17 4-25 2z" fill="#3b6fd4" ' + AL + '/><path d="M40 15c4-6 9-7 12-5-4 1-7 4-9 7z" fill="#f4efe2" ' + AL + '/>'; },
    function (f) { return tronco(f, '#a0784a', function (f) { var l = ''; for (var k = -2; k <= 2; k++) l += 'M' + r(32 + k * f.w * .38) + ' ' + r(f.s + 1) + 'v20'; return '<path d="' + l + '" stroke="#7d5a33" stroke-width="1.1"/>'; }) + rosto(f) + '<path d="M21 30c-2-11 4-17 11-17s13 6 11 17c-1-5-4-8-11-8s-10 3-11 8z" fill="#7d5a33" ' + AL + '/>'; },
    function (f) { return tronco(f, '#8e98a8', function (f) { return '<path d="M' + r(32 - f.w) + ' ' + r(f.s + 6) + 'h' + r(f.w * 2) + 'M' + r(32 - f.w) + ' ' + r(f.s + 10) + 'h' + r(f.w * 2) + 'M' + r(32 - f.w) + ' ' + r(f.s + 14) + 'h' + r(f.w * 2) + '" stroke="#6f7b91" stroke-width="1.2" stroke-dasharray="1.5 1.5"/>'; }) + rosto(f) + '<path d="M24 21c0-6 3.5-9 8-9s8 3 8 9z" fill="#a9b1c4" ' + AL + '/><ellipse cx="32" cy="21" rx="15" ry="3.2" fill="#8e98a8" ' + AL + '/>'; },
    function (f) { return tronco(f, '#b5452f', function (f) { return '<path d="M28 ' + r(f.s - 1) + 'h8v22h-8z" fill="#f2c14e" stroke="' + O + '" stroke-width="1.1"/>'; }) + ombreiras(f, '#a9b1c4') + rosto(f) + barba(f, '#5a3a22') + '<path d="M21 25c0-9 5-14 11-14s11 5 11 14z" fill="#a9b1c4" ' + AL + '/><rect x="30.6" y="24" width="2.8" height="7" rx="1" fill="#a9b1c4" ' + AL + '/>'; },
    function (f) { return tronco(f, '#2a62c9', function (f) { return '<path d="M25 ' + r(f.s) + 'h14l-2 22H27z" fill="#f4efe2" stroke="' + O + '" stroke-width="1.1"/><path d="M32 ' + r(f.s + 3) + 'v10M28 ' + r(f.s + 7) + 'h8" stroke="#c0392b" stroke-width="2.4"/>'; }) + ombreiras(f, '#a9b1c4') + elmoFechado('#a9b1c4'); },
    function (f) { return tronco(f, '#2a62c9', function (f) { return '<path d="M25 ' + r(f.s) + 'h14l-2 22H27z" fill="#f2c14e" stroke="' + O + '" stroke-width="1.1"/>'; }) + ombreiras(f, '#c3cad8') + elmoFechado('#c3cad8', true); },
    function (f) { return tronco(f, '#2f7d55', function (f) { return '<path d="M' + r(32 - f.w * .45) + ' ' + r(f.s + 1) + 'c3 6 6 8 ' + r(f.w * .45) + ' 8s' + r(f.w * .45 - 3) + '-2 ' + r(f.w * .45) + '-8" fill="none" stroke="#f2c14e" stroke-width="2" stroke-dasharray="2 1.2"/><circle cx="32" cy="' + r(f.s + 9) + '" r="2.2" fill="#f2c14e" ' + AL + '/>'; }) + rosto(f) + barba(f, '#6b4a2b') + cabelo(f, '#6b4a2b') + '<path d="M19 19c2-7 7-9 13-9s12 2 13 8c-4 2-9 3-14 3s-9-1-12-2z" fill="#6d3fa8" ' + AL + '/>'; },
    function (f) { return tronco(f, '#6d3fa8', function (f) { return arminho(f, f.s - 1); }) + rosto(f) + cabelo(f, '#3b2a1e') + barba(f, '#3b2a1e') + '<path d="M21.5 17h21v3.6h-21z" fill="#f2c14e" ' + AL + '/><circle cx="25" cy="15.6" r="1.5" fill="#f7f4ee" ' + AL + '/><circle cx="32" cy="15.6" r="1.5" fill="#f7f4ee" ' + AL + '/><circle cx="39" cy="15.6" r="1.5" fill="#f7f4ee" ' + AL + '/>'; },
    function (f) { return tronco(f, '#a32a3a', function (f) { return arminho(f, f.s - 1); }) + rosto(f) + cabelo(f, '#a0683a') + barba(f, '#a0683a') + coroinha(4, '#f2c14e', '#e0453a', 5); },
    function (f) { return tronco(f, '#3a2e6e', function (f) { return arminho(f, f.s - 1); }) + rosto(f) + cabelo(f, '#4a3526') + barba(f, '#4a3526', 1) + coroinha(5, '#f2c14e', '#3b8cf0', 7); },
    function (f) { return tronco(f, '#8e1f2f', function (f) { return arminho(f, f.s - 1); }) + ombreiras(f, '#f2c14e') + rosto(f) + cabelo(f, '#6b4a2b') + barba(f, '#6b4a2b', 1) + '<path d="M22 17c1-6 5-9 10-9s9 3 10 9z" fill="#b5182a" ' + AL + '/>' + coroinha(3, '#f2c14e', '#3ecf7c', 6); },
    function (f) { return tronco(f, '#2a62c9', function (f) { return arminho(f, f.s - 1); }) + ombreiras(f, '#f2c14e') + rosto(f) + cabelo(f, '#d9a25a') + coroinha(4, '#f2c14e', '#e0453a', 8); }
  ];
  
  // ---------- Três opções de Rei (aparência divina) ----------
  function raios(cx, cy, n, r1, r2, cor, op) {
    var s = '';
    for (var k = 0; k < n; k++) { var a = Math.PI * 2 * k / n, b = a + Math.PI / n * .55;
      s += '<path d="M' + r(cx + Math.cos(a) * r1) + ' ' + r(cy + Math.sin(a) * r1) + ' L' + r(cx + Math.cos(a) * r2) + ' ' + r(cy + Math.sin(a) * r2) + ' L' + r(cx + Math.cos(b) * r2) + ' ' + r(cy + Math.sin(b) * r2) + 'z" fill="' + cor + '" opacity="' + op + '"/>'; }
    return s;
  }
  function cabeloLongo(f, cor, brilho) {
    var hw = f.hw;
    return '<path d="M' + r(32 - hw - 1) + ' 26 C' + r(32 - hw - 4) + ' 14 ' + r(32 + hw + 4) + ' 14 ' + r(32 + hw + 1) + ' 26 C' + r(32 + hw + 3) + ' 34 ' + r(32 + hw + 6) + ' 40 ' + r(32 + hw + 4) + ' 46 C' + r(32 + hw) + ' 44 ' + r(32 + hw - 1) + ' 38 ' + r(32 + hw - .5) + ' 30 C' + r(32 + hw - 2) + ' 22 ' + r(32 + 3) + ' 20 32 20.5 C' + r(32 - 3) + ' 20 ' + r(32 - hw + 2) + ' 22 ' + r(32 - hw + .5) + ' 30 C' + r(32 - hw + 1) + ' 38 ' + r(32 - hw) + ' 44 ' + r(32 - hw - 4) + ' 46 C' + r(32 - hw - 6) + ' 40 ' + r(32 - hw - 3) + ' 34 ' + r(32 - hw - 1) + ' 26z" fill="' + cor + '" ' + AL + '/>' +
      (brilho ? '<path d="M' + r(32 - 5) + ' 16.5 Q32 15 ' + r(32 + 5) + ' 16.5" stroke="' + brilho + '" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M' + r(32 + hw + 2.6) + ' 33 q1.5 5 .6 9M' + r(32 - hw - 2.6) + ' 33 q-1.5 5 -.6 9" stroke="' + brilho + '" stroke-width="1" fill="none"/>' : '');
  }
  var REIS = [
    { nome: 'Rei-Sol', desc: 'Raios dourados atrás da cabeça, cabelo e barba dourados, coroa alta de ouro, manto branco e dourado com capa vermelha. Luminoso e majestoso.',
      fundo: ['#fff1b8', '#f2b33d', '#8a5a12'],
      fn: function (f) {
        return raios(32, 24, 16, 9, 34, '#fff3c4', .55) + '<circle cx="32" cy="24" r="15" fill="#fff6d6" opacity=".35"/>' +
          tronco(f, '#f4efe2', function (f) { return '<path d="M' + r(32 - f.w - 3) + ' 68 L' + r(32 - f.w) + ' ' + r(f.s + 6) + ' L' + r(32 - f.w * .45) + ' 68z M' + r(32 + f.w + 3) + ' 68 L' + r(32 + f.w) + ' ' + r(f.s + 6) + ' L' + r(32 + f.w * .45) + ' 68z" fill="#b5182a" ' + AL + '/><path d="M32 ' + r(f.s - 1) + 'v22" stroke="#f2c14e" stroke-width="3"/><path d="M' + r(32 - f.w * .7) + ' ' + r(f.s + 2) + ' Q32 ' + r(f.s + 7) + ' ' + r(32 + f.w * .7) + ' ' + r(f.s + 2) + '" fill="none" stroke="#f2c14e" stroke-width="2"/>'; }) +
          ombreiras(f, '#f2c14e') + cabeloLongo(f, '#e9b949', '#fff3c4') + rosto(f, { olhoBrilho: '#ffe9a0', olho: '#6b4310', sorriso: true }) + barba(f, '#e3ad3c', 1) +
          coroinha(5, '#f2c14e', '#e0453a', 9, 23) + '<circle cx="32" cy="7" r="1.8" fill="#3b8cf0" ' + AL + '/>';
      } },
  ];
  // ---------- Medalha ----------
  function medalha(i, miolo, fundoRei) {
    var g = GRUPO[PATENTES[i][2]], p = posNoGrupo(i), id = 'm' + (uid++), est = '';
    for (var k = 0; k <= p; k++) { var x = 32 + (k - p / 2) * 6; est += '<circle cx="' + x + '" cy="59" r="2.3" fill="' + g.anel + '" stroke="' + g.fundo + '" stroke-width="1.2"/>'; }
    var fundo = fundoRei
      ? '<defs><radialGradient id="g' + id + '" cx="50%" cy="38%" r="65%"><stop offset="0" stop-color="' + fundoRei[0] + '"/><stop offset=".45" stop-color="' + fundoRei[1] + '"/><stop offset="1" stop-color="' + fundoRei[2] + '"/></radialGradient></defs><circle cx="32" cy="31" r="28" fill="url(#g' + id + ')"/>'
      : '<circle cx="32" cy="31" r="28" fill="' + g.fundo + '"/>';
    return '<svg viewBox="0 0 64 64">' + fundo + '<defs><clipPath id="c' + id + '"><circle cx="32" cy="31" r="26.8"/></clipPath></defs><g clip-path="url(#c' + id + ')"><g transform="translate(32 9) scale(.8) translate(-32 -6)">' + miolo + '</g></g>' +
      '<circle cx="32" cy="31" r="28" fill="none" stroke="' + g.anel + '" stroke-width="2.4"/>' + est + '</svg>';
  }
  // Retrato da patente (evolução heroica; o Rei é o Rei-Sol).
  function retrato(i) {
    var f = fisico(i / 13, true);
    if (i === 13) { var R = REIS[0]; return medalha(i, R.fn(f), R.fundo); }
    return medalha(i, PERSONAGENS[i](f));
  }

  return { svg: retrato };
})();
