/* ============================================================
   LE TRACE DES SORTS (LA RECONNAISSANCE)

   Reconnait un signe trace au doigt parmi une bibliotheque de
   glyphes (GLYPHES, js/config.js), et dit a quel point il leur
   ressemble : un SCORE de 0 a 1 pour chacun.

   AUCUN ECRAN DU JEU NE S'EN SERT ENCORE. Seul le banc de trace du
   mode test (js/modetest.js) l'appelle. Rien n'est branche dans le
   combat, la capture, les breches ou la sauvegarde.

   L'ALGORITHME est de la famille "$P" (Vatavu, Anthony, Wobbrock,
   2012), ecrit a la main :
     1. reechantillonner : tous les traits, bout a bout, ramenes a
        TRACE_POINTS points egalement espaces le long du trace ;
     2. normaliser : echelle uniforme (le plus grand cote du cadre
        vaut 1, les proportions restent), puis le centre de gravite
        a l'origine ;
     3. comparer : chaque point du trace prend le point libre le plus
        proche du modele, les premiers comptent plus ; on essaie
        plusieurs points de depart, dans les deux sens, et on garde
        la plus petite distance.
   Un trace est donc un NUAGE de points : ni le sens du trace, ni le
   nombre de traits ne comptent (la croix se fait en deux traits).
   La rotation, elle, compte : un eclair couche n'est plus un eclair.

   LA CONVENTION : toutes les fonctions sont pures. Ni DOM, ni
   horloge, ni Math.random : le meme trace donne toujours le meme
   resultat. Un point est { x, y } ; un trace est une liste de
   traits, chaque trait une liste de points (l'ecran donne des
   pixels, les modeles de config.js des [x, y] de 0 a 100).

   Ce fichier expose un seul global : window.Trace.
   ============================================================ */

window.Trace = (function () {

function estNombre(v) { return typeof v === "number" && isFinite(v); }

function distance(a, b) {
  var dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/* Les traits recus, nettoyes : seuls les points lisibles restent,
   en { x, y }. Accepte [x, y] (les modeles) ou { x, y } (l'ecran). */
function nettoyer(traits) {
  var propres = [];
  if (!traits || typeof traits.length !== "number") return propres;
  for (var i = 0; i < traits.length; i++) {
    var t = traits[i], trait = [];
    if (!t || typeof t.length !== "number") continue;
    for (var j = 0; j < t.length; j++) {
      var p = t[j];
      if (!p) continue;
      var x = typeof p.length === "number" ? p[0] : p.x;
      var y = typeof p.length === "number" ? p[1] : p.y;
      if (estNombre(x) && estNombre(y)) trait.push({ x: x, y: y });
    }
    if (trait.length) propres.push(trait);
  }
  return propres;
}

function longueurTrait(trait) {
  var l = 0;
  for (var i = 1; i < trait.length; i++) l += distance(trait[i - 1], trait[i]);
  return l;
}

/* 1. LE REECHANTILLONNAGE. n points egalement espaces le long des
   traits mis bout a bout (le saut entre deux traits ne compte pas :
   il n'a pas ete dessine). Rend [] si le trace n'a pas de longueur. */
function reechantillonner(traits, n) {
  var total = 0;
  for (var i = 0; i < traits.length; i++) total += longueurTrait(traits[i]);
  if (!(total > 0) || n < 2) return [];

  var pas = total / (n - 1);
  var points = [{ x: traits[0][0].x, y: traits[0][0].y }];
  var reste = 0;    // distance parcourue depuis le dernier point pose

  for (var t = 0; t < traits.length; t++) {
    var trait = traits[t];
    var precedent = trait[0];
    for (var k = 1; k < trait.length; k++) {
      var courant = trait[k];
      var d = distance(precedent, courant);
      while (d > 0 && reste + d >= pas && points.length < n) {
        var f = (pas - reste) / d;
        var p = { x: precedent.x + f * (courant.x - precedent.x),
                  y: precedent.y + f * (courant.y - precedent.y) };
        points.push(p);
        precedent = p;
        d = distance(precedent, courant);
        reste = 0;
      }
      reste += d;
      precedent = courant;
    }
  }

  // Les arrondis peuvent laisser le dernier point de cote.
  var dernierTrait = traits[traits.length - 1];
  var fin = dernierTrait[dernierTrait.length - 1];
  while (points.length < n) points.push({ x: fin.x, y: fin.y });
  return points;
}

/* 2. LA NORMALISATION. Echelle uniforme (le plus grand cote du cadre
   vaut 1), puis centre de gravite a l'origine. */
function normaliser(points) {
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  points.forEach(function (p) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  });
  var cote = Math.max(maxX - minX, maxY - minY) || 1;

  var cx = 0, cy = 0;
  var echelles = points.map(function (p) {
    var q = { x: (p.x - minX) / cote, y: (p.y - minY) / cote };
    cx += q.x; cy += q.y;
    return q;
  });
  cx /= points.length; cy /= points.length;
  return echelles.map(function (q) { return { x: q.x - cx, y: q.y - cy }; });
}

/* 3. LA COMPARAISON. L'appariement glouton de $P, depuis le point
   "debut" de a : chaque point prend le plus proche encore libre de b.
   Le poids va de 1 (premier appariement) vers 0 : les premiers choix,
   les plus surs, comptent le plus. */
function distanceNuage(a, b, debut) {
  var n = a.length, pris = [], somme = 0;
  for (var k = 0; k < n; k++) pris.push(false);
  var i = debut;
  do {
    var meilleur = -1, min = Infinity;
    for (var j = 0; j < n; j++) {
      if (pris[j]) continue;
      var d = distance(a[i], b[j]);
      if (d < min) { min = d; meilleur = j; }
    }
    pris[meilleur] = true;
    var poids = 1 - ((i - debut + n) % n) / n;
    somme += poids * min;
    i = (i + 1) % n;
  } while (i !== debut);
  return somme;
}

/* La distance $P entre deux nuages de meme taille, ramenee a une
   distance MOYENNE par point (divisee par la somme des poids) : elle
   ne depend plus de TRACE_POINTS, et 0.1 veut dire "un dixieme du
   cadre en moyenne". */
function distanceTraces(a, b) {
  var n = a.length;
  var pas = Math.max(1, Math.floor(Math.pow(n, 1 - TRACE_EPSILON)));
  var min = Infinity;
  for (var i = 0; i < n; i += pas) {
    min = Math.min(min, distanceNuage(a, b, i), distanceNuage(b, a, i));
  }
  return min / ((n + 1) / 2);
}

/* LE CHEMIN, pour les glyphes "ordre: true" (la spirale). Un nuage
   ne suffit pas pour eux : un gribouillis qui couvre le cadre
   ressemble, point pour point, a une spirale. On compare donc aussi
   les points DANS L'ORDRE du trace : le i-eme avec le i-eme, dans un
   sens puis dans l'autre (on peut partir du centre ou du bord). Rend
   la distance moyenne par point, comme distanceTraces. */
function distanceChemin(a, b) {
  var n = a.length, avant = 0, arriere = 0;
  for (var i = 0; i < n; i++) {
    avant += distance(a[i], b[i]);
    arriere += distance(a[i], b[n - 1 - i]);
  }
  return Math.min(avant, arriere) / n;
}

// Le modele vu dans un miroir (gauche-droite), deja normalise.
function miroir(points) {
  return points.map(function (p) { return { x: -p.x, y: p.y }; });
}

/* La distance entre le trace et UN glyphe : le nuage ; plus le
   chemin si le glyphe a "ordre" ; et son reflet s'il a "miroir" (une
   spirale peut tourner dans les deux sens). La plus petite gagne. */
function distanceGlyphe(a, g, b) {
  var modeles = g.miroir ? [b, miroir(b)] : [b];
  var min = Infinity;
  modeles.forEach(function (m) {
    var d = distanceTraces(a, m);
    if (g.ordre) d = Math.max(d, distanceChemin(a, m));
    min = Math.min(min, d);
  });
  return min;
}

// Le nuage normalise d'un trace, ou null s'il est inutilisable.
function nuage(traits) {
  var propres = nettoyer(traits);
  if (!propres.length) return null;
  var points = reechantillonner(propres, TRACE_POINTS);
  return points.length === TRACE_POINTS ? normaliser(points) : null;
}

/* Le trace est-il assez grand et assez long pour etre lu ? Rend ""
   ou la raison du refus. Les seuils sont en pixels d'ecran. */
function refusTrace(propres) {
  var nb = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  propres.forEach(function (t) {
    t.forEach(function (p) {
      nb++;
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
  });
  if (nb < TRACE_POINTS_MIN) return "trop_court";
  if (Math.max(maxX - minX, maxY - minY) < TRACE_TAILLE_MIN) return "trop_court";
  return "";
}

// Le score d'une distance pour un glyphe : 1 - d / tolerance, borne.
function scoreDe(d, tolerance) {
  var s = 1 - d / tolerance;
  return Math.round(Math.max(0, Math.min(1, s)) * 1000) / 1000;
}

/* LE POINT D'ENTREE.

   traits   : [[{x, y}, ...], ...] (les pixels de l'ecran)
   glyphes  : la bibliotheque (GLYPHES par defaut)

   Rend
     { ok: true, raison: "", glyphe, score, scores }
       glyphe  l'id du glyphe le plus ressemblant, ou null si son
               score est sous TRACE_SEUIL_RECONNU ;
       score   le meilleur score (0 a 1), meme quand glyphe est null ;
       scores  { id: score } pour CHAQUE glyphe, dans l'ordre de la
               bibliotheque.
     { ok: false, raison: "trop_court" | "illisible" | "sans_glyphe",
       glyphe: null, score: 0, scores: {} } */
function reconnaitre(traits, glyphes) {
  glyphes = glyphes || GLYPHES;
  var vide = function (raison) { return { ok: false, raison: raison, glyphe: null, score: 0, scores: {} }; };

  var propres = nettoyer(traits);
  if (!propres.length) return vide("illisible");
  var refus = refusTrace(propres);
  if (refus) return vide(refus);

  var a = nuage(propres);
  if (!a) return vide("illisible");
  if (!glyphes || !glyphes.length) return vide("sans_glyphe");

  var scores = {}, meilleur = null, meilleurScore = -1;
  for (var i = 0; i < glyphes.length; i++) {
    var g = glyphes[i];
    var b = nuage(g.traits);
    if (!b) continue;
    var s = scoreDe(distanceGlyphe(a, g, b), g.tolerance);
    scores[g.id] = s;
    if (s > meilleurScore) { meilleurScore = s; meilleur = g.id; }
  }
  if (meilleur === null) return vide("sans_glyphe");

  return {
    ok: true, raison: "",
    glyphe: meilleurScore >= TRACE_SEUIL_RECONNU ? meilleur : null,
    score: meilleurScore,
    scores: scores
  };
}

/* L'historique du banc : pour chaque glyphe, combien de traces l'ont
   reconnu et leur score moyen, plus les traces non reconnus.
   historique : [{ glyphe, score }] (le resultat de reconnaitre). */
function resumeHistorique(historique, glyphes) {
  glyphes = glyphes || GLYPHES;
  var parGlyphe = {};
  glyphes.forEach(function (g) { parGlyphe[g.id] = { nombre: 0, moyenne: 0 }; });
  var inconnus = 0;

  (historique || []).forEach(function (h) {
    if (!h || !h.glyphe || !parGlyphe[h.glyphe]) { inconnus++; return; }
    var r = parGlyphe[h.glyphe];
    r.moyenne = (r.moyenne * r.nombre + h.score) / (r.nombre + 1);
    r.nombre++;
  });
  for (var id in parGlyphe) parGlyphe[id].moyenne = Math.round(parGlyphe[id].moyenne * 1000) / 1000;
  return { parGlyphe: parGlyphe, inconnus: inconnus };
}

return {
  reconnaitre: reconnaitre,
  resumeHistorique: resumeHistorique,

  // Les etapes, pour verifier/trace.js.
  nettoyer: nettoyer,
  reechantillonner: reechantillonner,
  normaliser: normaliser,
  distanceTraces: distanceTraces,
  distanceChemin: distanceChemin,
  distanceGlyphe: distanceGlyphe,
  nuage: nuage,
  scoreDe: scoreDe
};

})();
