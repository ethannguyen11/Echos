/* ============================================================
   LES TESTS DU TRACE DES SORTS
   Lances par node verifier.js (section 8). Ne tournent pas dans
   le navigateur.

   Chaque test doit pouvoir ECHOUER : verifier/mutations-trace.js
   abime une ligne du jeu a la fois et controle qu'au moins un test
   d'ici passe au rouge :
     node verifier/mutations-trace.js

   Les traces "humains" sont fabriques ici, avec un hasard A GRAINE
   (le meme a chaque lancement) : le moteur, lui, n'en a pas.
   ============================================================ */

var parcours = require("./parcours.js");
var fs = require("fs"), path = require("path");

function lancerTestsTrace(options) {
  options = options || {};
  var resultats = [];
  var section = "";

  function bloc(t) { section = t; }
  function verifie(quoi, ok, detail) {
    resultats.push({ section: section, quoi: quoi, ok: !!ok, detail: ok ? null : detail });
  }
  function monde(stockage) {
    return parcours.creerMonde({ stockage: stockage || {}, transformer: options.transformer });
  }
  function source(f) {
    var s = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
    return options.transformer ? options.transformer(f, s) : s;
  }

  try {
    testerMoteur(monde, bloc, verifie, source);
    testerBanc(monde, bloc, verifie);
  } catch (e) {
    verifie("les tests du trace vont au bout sans exception", false,
            String(e && e.stack || e).split(/\r?\n/).slice(0, 3).join(" "));
  }
  return resultats;
}


/* ------------------------------------------------------------
   LES TRACES DE SYNTHESE
   ------------------------------------------------------------ */

function graine(g) {
  var e = g;
  return function () {
    e = (e + 0x6D2B79F5) | 0;
    var t = Math.imul(e ^ (e >>> 15), 1 | e);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Un glyphe trace "a la main" : le modele (0 a 100) densifie, a
   l'echelle 3 (300 pixels), decale de (40, 70). bruit : l'amplitude
   en pixels d'un tremblement LENT (deux ondulations douces) plus
   2 pixels de grain, comme un doigt. inverse : trace a l'envers. */
function aLaMain(glyphe, bruit, al, inverse) {
  return glyphe.traits.map(function (trait) {
    var pts = [];
    for (var i = 1; i < trait.length; i++) {
      for (var k = 0; k < 6; k++) {
        var f = k / 6;
        pts.push([trait[i - 1][0] + f * (trait[i][0] - trait[i - 1][0]),
                  trait[i - 1][1] + f * (trait[i][1] - trait[i - 1][1])]);
      }
    }
    pts.push(trait[trait.length - 1]);
    if (inverse) pts.reverse();
    var p1 = al() * 6.28, p2 = al() * 6.28, w = 0.05 + al() * 0.05;
    var grain = bruit > 0 ? 4 : 0;
    return pts.map(function (p, n) {
      return { x: 40 + p[0] * 3 + bruit / 2 * Math.sin(n * w + p1) + (al() - 0.5) * grain,
               y: 70 + p[1] * 3 + bruit / 2 * Math.sin(n * w * 1.3 + p2) + (al() - 0.5) * grain };
    });
  });
}

// Un gribouillis : des points au hasard dans un cadre de 300 pixels.
function gribouillis(al) {
  var n = 20 + Math.floor(al() * 40), pts = [];
  for (var i = 0; i < n; i++) pts.push({ x: al() * 300, y: al() * 300 });
  return [pts];
}

function transformer(traits, f) {
  return traits.map(function (t) { return t.map(f); });
}


/* ------------------------------------------------------------
   LE MOTEUR
   ------------------------------------------------------------ */

function testerMoteur(monde, bloc, verifie, source) {
  bloc("Trace : la bibliotheque");

  var X = monde().ctx;
  var T = X.Trace, G = X.GLYPHES;

  var ids = G.map(function (g) { return g.id; });
  verifie("6 glyphes : cercle, triangle, eclair, spirale, croix, vague",
          JSON.stringify(ids) === JSON.stringify(["cercle", "triangle", "eclair", "spirale", "croix", "vague"]),
          JSON.stringify(ids));

  var fautes = [];
  G.forEach(function (g) {
    if (!(typeof g.tolerance === "number" && g.tolerance > 0)) fautes.push(g.id + ".tolerance");
    if (typeof g.ordre !== "boolean" || typeof g.miroir !== "boolean") fautes.push(g.id + ".ordre/miroir");
    if (!Object.prototype.hasOwnProperty.call(g, "deblocage")) fautes.push(g.id + ".deblocage");
    if (!g.traits || !g.traits.length || !g.traits.every(function (t) { return t.length >= 2; })) fautes.push(g.id + ".traits");
    if (!T.nuage(g.traits)) fautes.push(g.id + " : modele illisible");
  });
  verifie("chaque glyphe a une tolerance, ordre, miroir, un champ deblocage et un modele lisible",
          fautes.length === 0, fautes.join(", "));
  verifie("la spirale est plus tolerante que le cercle (elle est plus dure)",
          G[3].tolerance > G[0].tolerance);

  var brutes = [];
  ["fr", "en"].forEach(function (langue) {
    X.definirLangue(langue);
    G.forEach(function (g) {
      var t = X.txt(g.cleNom);
      if (t === g.cleNom || typeof X.TEXTES[langue][g.cleNom] !== "string") brutes.push(langue + ":" + g.cleNom);
    });
    ["trace.titre", "trace.consigne", "trace.effacer", "trace.fermer", "trace.reconnu", "trace.inconnu",
     "trace.tropCourt", "trace.historique", "trace.moyenne"].forEach(function (c) {
      if (typeof X.TEXTES[langue][c] !== "string") brutes.push(langue + ":" + c);
    });
  });
  X.definirLangue("fr");
  verifie("noms des glyphes et textes du banc : presents en francais ET en anglais",
          brutes.length === 0, brutes.join(", "));
  verifie("les noms anglais sont bien de l'anglais",
          X.TEXTES.en["trace.glyphe.eclair"] === "Lightning" && X.TEXTES.fr["trace.glyphe.eclair"] === "Éclair");


  bloc("Trace : la reconnaissance");

  // Parfait : chaque glyphe, sans tremblement.
  var parfaits = G.map(function (g) {
    var r = T.reconnaitre(aLaMain(g, 0, graine(1)));
    return { id: g.id, r: r };
  });
  verifie("trace parfait : chaque glyphe se reconnait, score >= 0.9",
          parfaits.every(function (p) { return p.r.ok && p.r.glyphe === p.id && p.r.score >= 0.9; }),
          parfaits.map(function (p) { return p.id + "->" + p.r.glyphe + " " + p.r.score; }).join(", "));
  verifie("trace parfait : chaque autre glyphe a un score nettement plus bas (< 0.6)",
          parfaits.every(function (p) {
            return Object.keys(p.r.scores).every(function (k) { return k === p.id || p.r.scores[k] < 0.6; });
          }));
  verifie("le resultat donne un score pour CHACUN des 6 glyphes, entre 0 et 1",
          parfaits.every(function (p) {
            var ks = Object.keys(p.r.scores);
            return ks.length === 6 && ks.every(function (k) { return p.r.scores[k] >= 0 && p.r.scores[k] <= 1; });
          }));

  // Bruite : 5 mains differentes par glyphe, une sur deux a l'envers.
  var rates = [], plusBas = true;
  G.forEach(function (g, gi) {
    var parfait = parfaits[gi].r.score;
    for (var s = 1; s <= 5; s++) {
      var r = T.reconnaitre(aLaMain(g, 30, graine(100 * gi + s), s % 2 === 0));
      if (r.glyphe !== g.id) rates.push(g.id + "#" + s + "->" + r.glyphe + " " + r.score);
      if (!(r.score < parfait)) plusBas = false;
    }
  });
  verifie("trace tremblant (dans les deux sens) : 30 sur 30 reconnus", rates.length === 0, rates.join(", "));
  verifie("trace tremblant : un score plus bas que le trace parfait", plusBas);

  var hasard = [], pire = 0;
  for (var k = 1; k <= 12; k++) {
    var rh = T.reconnaitre(gribouillis(graine(1000 + k)));
    pire = Math.max(pire, rh.score);
    if (rh.glyphe !== null) hasard.push(k + "->" + rh.glyphe + " " + rh.score);
  }
  verifie("gribouillis au hasard : jamais reconnu, score bas (< 0.3)",
          hasard.length === 0 && pire < 0.3, hasard.join(", ") + " pire " + pire);

  // Invariance a l'echelle et a la position.
  var ecarts = [];
  G.forEach(function (g) {
    var base = aLaMain(g, 30, graine(7));
    var r0 = T.reconnaitre(base);
    [[0.5, 0, 0], [3, 0, 0], [1, 500, -200], [2, -80, 900]].forEach(function (m) {
      var r = T.reconnaitre(transformer(base, function (p) { return { x: p.x * m[0] + m[1], y: p.y * m[0] + m[2] }; }));
      Object.keys(r0.scores).forEach(function (id) {
        if (Math.abs(r.scores[id] - r0.scores[id]) > 0.002) ecarts.push(g.id + "/" + id + " x" + m[0]);
      });
    });
  });
  verifie("meme score a toutes les echelles (x0.5 a x3) et a toutes les positions",
          ecarts.length === 0, ecarts.slice(0, 5).join(", "));

  verifie("les proportions comptent : une vague ecrasee en hauteur n'est plus la meme",
          (function () {
            var v = aLaMain(G[5], 0, graine(1));
            var haute = T.reconnaitre(transformer(v, function (p) { return { x: p.x, y: p.y * 4 }; }));
            return haute.scores.vague < 0.6;
          })());

  verifie("la rotation compte : un eclair couche n'est plus un eclair",
          (function () {
            var e = aLaMain(G[2], 0, graine(1));
            var couche = T.reconnaitre(transformer(e, function (p) { return { x: p.y, y: -p.x + 600 }; }));
            return couche.glyphe !== "eclair" && couche.scores.eclair < 0.5;
          })());

  verifie("la croix en deux traits, dans n'importe quel ordre et sens",
          (function () {
            var c = aLaMain(G[4], 0, graine(1));
            var autre = [c[1].slice().reverse(), c[0].slice().reverse()];
            var r1 = T.reconnaitre(c), r2 = T.reconnaitre(autre);
            return r1.glyphe === "croix" && r2.glyphe === "croix" && Math.abs(r1.score - r2.score) < 0.05;
          })());

  verifie("la spirale tourne dans les deux sens (miroir), et se trace du centre ou du bord",
          (function () {
            var sp = aLaMain(G[3], 0, graine(1));
            var reflet = transformer(sp, function (p) { return { x: 700 - p.x, y: p.y }; });
            var envers = aLaMain(G[3], 0, graine(1), true);
            return T.reconnaitre(reflet).glyphe === "spirale" && T.reconnaitre(envers).glyphe === "spirale";
          })());

  verifie("un gribouillis qui couvre le cadre n'est pas une spirale (le chemin compte)",
          (function () {
            var g = gribouillis(graine(2024));
            var nuageSeul = T.distanceTraces(T.nuage(g), T.nuage(G[3].traits));
            return nuageSeul < 0.15 && T.reconnaitre(g).scores.spirale < 0.1;
          })());

  bloc("Trace : refus et determinisme");

  verifie("trace trop court : moins de TRACE_POINTS_MIN points, refuse",
          T.reconnaitre([[{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 200, y: 0 }]]).raison === "trop_court");
  verifie("trace trop petit : un tapotement de quelques pixels, refuse",
          T.reconnaitre(transformer(aLaMain(G[0], 0, graine(1)), function (p) {
            return { x: p.x / 20, y: p.y / 20 };
          })).raison === "trop_court");
  var refus = [T.reconnaitre(null), T.reconnaitre([]), T.reconnaitre("cercle"), T.reconnaitre([[{ x: "a" }], [null]])];
  verifie("trace vide ou illisible : refuse, sans exception, avec des scores vides",
          refus.every(function (r) { return !r.ok && r.raison === "illisible" && r.glyphe === null && r.score === 0 &&
                                            Object.keys(r.scores).length === 0; }));
  verifie("un trace sans longueur (le meme point repete) est illisible",
          T.reconnaitre([[{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 },
                          { x: 0, y: 0 }, { x: 0, y: 0 }]]).ok === false);
  verifie("bibliotheque vide : refus sans_glyphe",
          T.reconnaitre(aLaMain(G[0], 0, graine(1)), []).raison === "sans_glyphe");
  verifie("un trace refuse a un score : TRACE_SEUIL_RECONNU donne null mais garde le score",
          (function () {
            var r = T.reconnaitre(gribouillis(graine(1001)));
            return r.ok && r.glyphe === null && r.score > 0 && r.score < X.TRACE_SEUIL_RECONNU;
          })());

  var entree = aLaMain(G[1], 30, graine(3));
  var copie = JSON.stringify(entree);
  var a = JSON.stringify(T.reconnaitre(entree)), b = JSON.stringify(T.reconnaitre(entree));
  var X2 = monde().ctx;
  var c = JSON.stringify(X2.Trace.reconnaitre(JSON.parse(copie)));
  verifie("deterministe : le meme trace donne exactement le meme resultat, partout",
          a === b && a === c);
  verifie("reconnaitre ne modifie pas le trace recu", JSON.stringify(entree) === copie);

  var code = source("js/trace.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  verifie("js/trace.js ne lit ni l'horloge, ni le hasard, ni la page",
          !/\bDate\b/.test(code) && !/Math\.random/.test(code) && !/document|localStorage|elem\(/.test(code));

  verifie("reechantillonner : exactement TRACE_POINTS points, egalement espaces",
          (function () {
            var p = T.reechantillonner(T.nettoyer([[[0, 0], [310, 0]]]), X.TRACE_POINTS);
            var pas = p[1].x - p[0].x;
            return p.length === X.TRACE_POINTS && Math.abs(pas - 10) < 1e-9 &&
                   Math.abs(p[p.length - 1].x - 310) < 1e-9;
          })());
  verifie("normaliser : centre de gravite a l'origine, plus grand cote = 1",
          (function () {
            var n = T.normaliser([{ x: 10, y: 10 }, { x: 210, y: 10 }, { x: 210, y: 110 }, { x: 10, y: 110 }]);
            var cx = 0, cy = 0;
            n.forEach(function (p) { cx += p.x; cy += p.y; });
            return Math.abs(cx) < 1e-9 && Math.abs(cy) < 1e-9 && Math.abs(n[1].x - n[0].x - 1) < 1e-9 &&
                   Math.abs(n[2].y - n[1].y - 0.5) < 1e-9;
          })());
  // Deux nuages qui ne se ressemblent qu'a moitie : un cercle et un triangle tremblants.
  var na = T.nuage(aLaMain(G[0], 30, graine(21))), nb = T.nuage(aLaMain(G[1], 30, graine(22)));
  verifie("la distance est symetrique : d(trace, modele) = d(modele, trace)",
          Math.abs(T.distanceTraces(na, nb) - T.distanceTraces(nb, na)) < 1e-12);
  verifie("la distance garde le meilleur appariement : tous les departs, dans les deux sens",
          (function () {
            var n = na.length, pas = Math.max(1, Math.floor(Math.pow(n, 1 - X.TRACE_EPSILON))), min = Infinity;
            for (var i = 0; i < n; i += pas) min = Math.min(min, T.distanceNuage(na, nb, i), T.distanceNuage(nb, na, i));
            return pas > 1 && Math.abs(T.distanceTraces(na, nb) - min / ((n + 1) / 2)) < 1e-12 &&
                   T.distanceTraces(na, nb) < T.distanceNuage(na, nb, 0) / ((n + 1) / 2);
          })());
  verifie("le score : 1 a distance nulle, 0 a la tolerance et au-dela",
          T.scoreDe(0, 0.2) === 1 && T.scoreDe(0.1, 0.2) === 0.5 && T.scoreDe(0.2, 0.2) === 0 && T.scoreDe(5, 0.2) === 0);

  var res = T.resumeHistorique([{ glyphe: "cercle", score: 0.8 }, { glyphe: "cercle", score: 0.6 },
                                { glyphe: null, score: 0.2 }, { glyphe: "croix", score: 0.9 }]);
  verifie("le resume de l'historique : nombre et moyenne par glyphe, et les non reconnus",
          res.parGlyphe.cercle.nombre === 2 && res.parGlyphe.cercle.moyenne === 0.7 &&
          res.parGlyphe.croix.nombre === 1 && res.parGlyphe.vague.nombre === 0 && res.inconnus === 1,
          JSON.stringify(res));
}


/* ------------------------------------------------------------
   LE BANC DU MODE TEST
   Un faux canvas et de faux evenements pointer : on dessine
   vraiment, du doigt pose au doigt leve.
   ------------------------------------------------------------ */

function testerBanc(monde, bloc, verifie) {
  bloc("Trace : le banc du mode test");

  var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  var idsPage = [];
  html.replace(/\bid="([^"]+)"/g, function (t, id) { idsPage.push(id); });

  function mondeBanc(modeTest) {
    var m = monde({});
    idsPage.forEach(function (id) {
      if (m.statiques[id]) return;
      m.statiques[id] = parcours.creerElement("div");
      m.statiques[id].id = id;
    });
    m.statiques["mt-chapitre"].options = [parcours.creerElement("option")];
    var dessins = { traits: 0, efface: 0 };
    var cadre = m.statiques["banc-trace-cadre"];
    cadre.getBoundingClientRect = function () { return { left: 10, top: 20, width: 300, height: 300 }; };
    cadre.getContext = function () {
      return {
        setTransform: function () {}, clearRect: function () { dessins.efface++; },
        beginPath: function () {}, moveTo: function () {}, lineTo: function () {},
        stroke: function () { dessins.traits++; }
      };
    };
    m.dessins = dessins;
    m.ctx.MODE_TEST = modeTest !== false;
    return m;
  }

  // Le doigt : pose, glisse, leve. Les points sont des pixels du cadre.
  function dessiner(m, traits, pause) {
    var c = m.statiques["banc-trace-cadre"];
    traits.forEach(function (t) {
      c.declencher("pointerdown", { pointerId: 1, clientX: t[0].x + 10, clientY: t[0].y + 20, preventDefault: function () {} });
      for (var i = 1; i < t.length; i++) {
        c.declencher("pointermove", { pointerId: 1, clientX: t[i].x + 10, clientY: t[i].y + 20, preventDefault: function () {} });
      }
      c.declencher("pointerup", { pointerId: 1 });
      m.horloge.avancer(pause || 100);     // entre deux traits : moins que TRACE_DELAI_FIN
    });
  }
  function texte(m, id) { return m.statiques[id].textContent || m.statiques[id].innerHTML; }

  var m = mondeBanc();
  var X = m.ctx, S = m.statiques;
  X.ModeTest.preparerPanneau();
  S["btn-banc-trace"].declencher("click");
  verifie("le bouton Banc de trace ouvre l'ecran, textes en place",
          S["banc-trace"].classList.contains("actif") && S["banc-trace-titre"].textContent === "Banc de tracé" &&
          S["btn-trace-effacer"].textContent === "Effacer" && S["btn-trace-fermer"].textContent === "Fermer");

  var G = X.GLYPHES;
  var cercle = aLaMain(G[0], 20, graine(11));
  // Le banc travaille dans un cadre de 300 pixels : on y ramene le trace.
  function dansLeCadre(traits) { return transformer(traits, function (p) { return { x: (p.x - 40) * 0.9, y: (p.y - 70) * 0.9 }; }); }

  dessiner(m, [dansLeCadre(cercle)[0].slice(0, 20)]);
  var traitsPendant = m.dessins.traits;
  verifie("le trait se dessine pendant qu'on trace, avant tout resultat",
          traitsPendant > 10 && S["banc-trace-resultat"].textContent === "");
  S["btn-trace-effacer"].declencher("click");
  verifie("Effacer vide le cadre et le trace en cours",
          X.ModeTest.pourTestsTrace().traits.length === 0 && S["banc-trace-resultat"].textContent === "");

  dessiner(m, dansLeCadre(cercle));
  m.horloge.avancer(X.TRACE_DELAI_FIN);
  verifie("doigt leve : le glyphe reconnu et son score en pourcentage",
          /^Cercle · \d+ %$/.test(S["banc-trace-resultat"].textContent), S["banc-trace-resultat"].textContent);
  verifie("... et le score des six glyphes, le meilleur en evidence",
          G.every(function (g) { return texte(m, "banc-trace-scores").indexOf(X.txt(g.cleNom) + " ") !== -1; }) &&
          S["banc-trace-scores"].innerHTML.indexOf('<span class="trace-meilleur">Cercle') !== -1,
          S["banc-trace-scores"].innerHTML);

  // La croix en deux traits, separes de moins que TRACE_DELAI_FIN.
  var croix = dansLeCadre(aLaMain(G[4], 20, graine(12)));
  dessiner(m, croix, X.TRACE_DELAI_FIN - 200);
  m.horloge.avancer(X.TRACE_DELAI_FIN);
  verifie("la croix en deux traits donne UN seul resultat : croix",
          S["banc-trace-resultat"].textContent.indexOf("Croix") === 0 && X.ModeTest.pourTestsTrace().historique.length === 2,
          S["banc-trace-resultat"].textContent);

  dessiner(m, [[{ x: 5, y: 5 }, { x: 8, y: 6 }, { x: 9, y: 9 }]]);
  m.horloge.avancer(X.TRACE_DELAI_FIN);
  verifie("un tapotement : 'trop court', et il n'entre pas dans l'historique",
          S["banc-trace-resultat"].textContent === X.txt("trace.tropCourt") &&
          X.ModeTest.pourTestsTrace().historique.length === 2);

  dessiner(m, [[{ x: 10, y: 10 }, { x: 290, y: 280 }, { x: 20, y: 250 }, { x: 260, y: 15 }, { x: 150, y: 290 },
                { x: 30, y: 120 }, { x: 280, y: 160 }, { x: 60, y: 30 }]]);
  m.horloge.avancer(X.TRACE_DELAI_FIN);
  verifie("un gribouillis : 'non reconnu', avec le meilleur score quand meme",
          S["banc-trace-resultat"].textContent.indexOf("Signe non reconnu · meilleur : ") === 0,
          S["banc-trace-resultat"].textContent);

  for (var i = 0; i < 25; i++) {
    dessiner(m, dansLeCadre(aLaMain(G[i % 2 ? 1 : 5], 20, graine(50 + i))));
    m.horloge.avancer(X.TRACE_DELAI_FIN);
  }
  var hist = X.ModeTest.pourTestsTrace().historique;
  verifie("l'historique garde les 20 derniers traces seulement", hist.length === X.TRACE_HISTORIQUE_MAX && hist.length === 20);
  verifie("l'historique affiche nombre et moyenne par glyphe",
          texte(m, "banc-trace-historique").indexOf("20 derniers tracés") === 0 &&
          /Triangle : 10 × · moyenne \d+ %/.test(texte(m, "banc-trace-historique")) &&
          /Vague : 10 × · moyenne \d+ %/.test(texte(m, "banc-trace-historique")),
          texte(m, "banc-trace-historique"));

  S["btn-trace-fermer"].declencher("click");
  verifie("Fermer cache l'ecran et garde l'historique en memoire",
          !S["banc-trace"].classList.contains("actif") && X.ModeTest.pourTestsTrace().historique.length === 20);
  verifie("rien n'est sauvegarde : aucune cle ecrite par le banc", Object.keys(m.stockage).length === 0,
          Object.keys(m.stockage).join(","));

  // En anglais : aucun texte brut.
  X.definirLangue("en");
  S["btn-banc-trace"].declencher("click");
  dessiner(m, dansLeCadre(cercle));
  m.horloge.avancer(X.TRACE_DELAI_FIN);
  var tout = [S["banc-trace-titre"].textContent, S["banc-trace-consigne"].textContent,
              S["banc-trace-resultat"].textContent, texte(m, "banc-trace-scores"), texte(m, "banc-trace-historique"),
              S["btn-trace-effacer"].textContent].join(" | ");
  verifie("en anglais : tout est traduit, aucune cle brute, aucun {jeton}",
          tout.indexOf("Tracing bench") !== -1 && tout.indexOf("Circle") !== -1 && tout.indexOf("Clear") !== -1 &&
          !/trace\.|\{|\}|undefined|NaN/.test(tout), tout);

  // Mode test eteint : le bouton ne fait rien.
  var mo = mondeBanc(false);
  mo.ctx.ModeTest.preparerPanneau();
  mo.statiques["btn-banc-trace"].declencher("click");
  verifie("mode test eteint : pas de banc de trace",
          !mo.statiques["banc-trace"].classList.contains("actif") && !mo.ctx.ModeTest.actif());

  verifie("aucun branchement dans le jeu : seul js/modetest.js appelle Trace",
          ["js/combat.js", "js/combat3.js", "js/ecran3.js", "js/carte.js", "js/joueur.js", "js/brechesjeu.js",
           "js/breches.js", "js/poche.js", "js/jeu.js"].every(function (f) {
            return !/\bTrace\.|GLYPHES/.test(fs.readFileSync(path.join(__dirname, "..", f), "utf8"));
          }));
}


module.exports = { lancerTestsTrace: lancerTestsTrace };
