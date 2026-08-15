/* ============================================================
   LE COMBAT
   Une rencontre, son deroulement tour par tour, et les deux
   facons d'en sortir : l'assimilation ou la dissipation.
   ============================================================ */

var combat = null;

function degats(atq, def, alea) {
  var base = atq - def / 2;
  return Math.max(1, Math.round(base * (0.85 + alea * 0.3)));
}

// Chance d'assimiler l'Echo, en pourcentage
function chanceAssimilation(c) {
  var a = c.adversaire;

  // Plus il est affaibli, plus il ecoute
  var affaibli = 1 - Math.max(0, a.pv) / a.pvMax;

  var moyenneEquipe = 0;
  for (var i = 0; i < c.equipe.length; i++) moyenneEquipe += c.equipe[i].niveau;
  moyenneEquipe = moyenneEquipe / c.equipe.length;

  var p = 8;                                   // socle
  p += affaibli * 55;                          // jusqu'a +55 s'il est exsangue
  p += (moyenneEquipe - a.niveau) * 5;         // ecart de niveau
  p += (c.equipe.length - 1) * 6;              // le nombre impressionne
  p -= c.tentatives * 4;                       // il se mefie a chaque essai

  return Math.max(2, Math.min(95, Math.round(p)));
}

function combattantsEquipe() {
  var liste = [];
  for (var i = 0; i < equipe.length; i++) {
    var e = collection[equipe[i]];
    if (!e) continue;
    var s = statsAuNiveau(e.espece, e.niveau);
    liste.push({
      espece: e.espece, niveau: e.niveau,
      pv: s.pvMax, pvMax: s.pvMax, atq: s.atq, def: s.def
    });
  }
  return liste;
}

function adversaireDe(donjon, tailleEquipe) {
  var s = statsAuNiveau(donjon.espece, donjon.niveau);

  // Il se renforce a mesure que ton equipe grandit : seul contre un,
  // il reste abordable ; face a trois, il doit tenir trois attaques par tour.
  var facteurPv  = 1 + (tailleEquipe - 1) * 0.7;
  var facteurAtq = 1 + (tailleEquipe - 1) * 0.15;

  return {
    espece: donjon.espece, niveau: donjon.niveau,
    pv:    Math.round(s.pvMax * facteurPv),
    pvMax: Math.round(s.pvMax * facteurPv),
    atq:   Math.round(s.atq * facteurAtq),
    def:   s.def
  };
}


/* ------------------------------------------------------------
   LE FIGEMENT ET LES AFFINITES

   Deux multiplicateurs, appliques APRES la formule de degats.
   La fonction degats() plus haut n'est jamais touchee : on prend
   ce qu'elle rend et on le module. L'ordre est toujours

     degatsFinaux = arrondi(degatsDeBase x affinite x figement)
     minimum 1

   Tous les nombres viennent de config.js.
   ------------------------------------------------------------ */

/* Le Figement de depart du lieu.

   Si le lieu porte deja la valeur, on la respecte. Sinon on la
   retrouve a partir de son identifiant OSM, avec la graine qui a
   deja servi a tirer son espece et son niveau (voir lieux.js) :
   c'est le troisieme tirage de la meme suite. Meme lieu, meme
   Figement, sur tous les appareils, et rien de plus a stocker. */
function figementDuLieu(donjon) {
  if (!donjon) return 0;

  if (typeof donjon.figement === "number" && isFinite(donjon.figement)) {
    return Math.max(0, Math.min(FIGEMENT_MAX, Math.round(donjon.figement)));
  }

  if (!donjon.id) return 0;

  var a = tirageAleatoire(grainePourTexte(donjon.id));
  a();                                        // 1er tirage : l'espece
  a();                                        // 2e  tirage : le niveau
  return Math.floor(a() * (FIGEMENT_MAX + 1));
}

// Le compteur va de 0 a 100, le palier de 0 a 10.
function palierFigement(valeur) {
  var p = Math.floor(valeur / FIGEMENT_PAR_PALIER);
  return Math.max(0, Math.min(FIGEMENT_PALIER_MAX, p));
}

/* Multiplicateur de l'ATTAQUANT, joueur comme adversaire.
   L'arrondi a deux decimales n'est pas cosmetique : sans lui,
   0.05 x 5 donne 0.2500000000000001 et l'organique se retrouve
   a 0.9999 au palier 5, la ou il doit valoir exactement 1. */
function multiplicateurFigement(especeId, palier) {
  var e = ESPECES[especeId];
  var n = (e && FIGEMENT_NATURES[e.nature]) || FIGEMENT_NATURES.hybride;
  return Math.round((n.base + n.pas * palier) * 100) / 100;
}

// Le triangle : matiere bat recit, recit bat oubli, oubli bat matiere.
function multiplicateurAffinite(especeAttaquant, especeCible) {
  var a = ESPECES[especeAttaquant], c = ESPECES[especeCible];
  if (!a || !c || !a.affinite || !c.affinite) return AFFINITE_NEUTRE;

  if (AFFINITE_BAT[a.affinite] === c.affinite) return AFFINITE_AVANTAGE;
  if (AFFINITE_BAT[c.affinite] === a.affinite) return AFFINITE_DESAVANTAGE;
  return AFFINITE_NEUTRE;
}

// Le seul endroit ou les deux multiplicateurs se rencontrent.
function degatsAjustes(base, especeAttaquant, especeCible, palier) {
  var m = multiplicateurAffinite(especeAttaquant, especeCible) *
          multiplicateurFigement(especeAttaquant, palier);
  return Math.max(1, Math.round(base * m));
}

// Le lieu se mecanise d'un palier a la fin de chaque tour.
function avancerFigement() {
  if (!combat) return;
  combat.figement = Math.min(FIGEMENT_MAX,
                             combat.figement + VITESSE_FIGEMENT * FIGEMENT_PAR_PALIER);
}


/* ------------------------------------------------------------
   AFFICHAGE
   ------------------------------------------------------------ */

function message(t) { elem("combat-message").innerHTML = t; }

/* La fleche d'un combattant : montante s'il est avantage par le
   Figement en cours, descendante s'il est desavantage, rien s'il
   est hybride ou pile a l'equilibre. Aucun chiffre. */
function flecheFigement(especeId, palier) {
  var m = multiplicateurFigement(especeId, palier);
  if (m > 1) return ' <span class="fleche-haut">&#9650;</span>';
  if (m < 1) return ' <span class="fleche-bas">&#9660;</span>';
  return "";
}

/* Ce que le joueur lit sous le seuil : une impression, pas un chiffre. */
function libelleFigement(palier) {
  for (var i = 0; i < LIBELLES_FIGEMENT.length; i++) {
    if (palier <= LIBELLES_FIGEMENT[i].jusqua) return LIBELLES_FIGEMENT[i].texte;
  }
  return LIBELLES_FIGEMENT[LIBELLES_FIGEMENT.length - 1].texte;
}

/* La barre de Figement. Au-dessus du seuil de lecture, le joueur
   voit la valeur exacte ; en dessous, seulement la phrase. */
function majFigement(valeur, palier) {
  elem("f-jauge").style.width = Math.round(valeur / FIGEMENT_MAX * 100) + "%";

  if (niveauDuJoueur() >= SEUIL_LECTURE_FIGEMENT) {
    elem("f-libelle").textContent = "Figement";
    elem("f-val").textContent = Math.round(valeur) + " % — palier " + palier;
  } else {
    elem("f-libelle").textContent = libelleFigement(palier);
    elem("f-val").textContent = "";
  }
}

/* Une mention courte dans le journal quand l'affinite joue.
   Rien du tout quand elle est neutre : le journal reste lisible. */
function mentionAffinite(especeAttaquant, especeCible) {
  var m = multiplicateurAffinite(especeAttaquant, especeCible);

  if (m > AFFINITE_NEUTRE) {
    return ' <span class="affinite-plus">&mdash; ' +
           LIBELLES_AFFINITE[ESPECES[especeAttaquant].affinite] + ' domine</span>';
  }
  if (m < AFFINITE_NEUTRE) {
    return ' <span class="affinite-moins">&mdash; ' +
           LIBELLES_AFFINITE[ESPECES[especeCible].affinite] + ' resiste</span>';
  }
  return "";
}

function majAffichageCombat() {
  var a = combat.adversaire;
  var palier = palierFigement(combat.figement);

  majFigement(combat.figement, palier);
  elem("m-fleche").innerHTML = flecheFigement(a.espece, palier);

  elem("m-pv").textContent = Math.max(0, a.pv) + "/" + a.pvMax;
  var pc = Math.max(0, a.pv) / a.pvMax * 100;
  var jm = elem("m-jauge");
  jm.style.width = pc + "%";
  jm.className = pc < 20 ? "danger" : (pc < 50 ? "bas" : "");

  // Jauge d'emprise
  var chance = chanceAssimilation(combat);
  elem("a-val").textContent = chance + " %";
  elem("a-jauge").style.width = chance + "%";
  elem("assimilation-bloc").classList.add("visible");

  // Cartes de l'equipe
  var html = "";
  for (var i = 0; i < combat.equipe.length; i++) {
    var c = combat.equipe[i];
    var e = ESPECES[c.espece];
    var pct = Math.max(0, c.pv) / c.pvMax * 100;
    html += '<div class="carte-echo' + (c.pv <= 0 ? " ko" : "") + '">' +
            '<b>' + e.nom + flecheFigement(c.espece, palier) + '</b>' +
            'niv. ' + c.niveau + ' &middot; ' + Math.max(0, c.pv) + ' PV' +
            '<div class="mini-jauge"><span style="width:' + pct + '%"></span></div>' +
            '</div>';
  }
  elem("equipe-combat").innerHTML = html;
}

function boutonsActifs(a) {
  elem("btn-attaquer").disabled = !a;
  elem("btn-assimiler").disabled = !a;
  elem("btn-fuir").disabled = !a;
}


/* ------------------------------------------------------------
   DEROULEMENT
   ------------------------------------------------------------ */

function demarrerCombat(donjon, preemptif) {
  var mesEchos = combattantsEquipe();

  combat = {
    donjon: donjon,
    adversaire: adversaireDe(donjon, mesEchos.length),
    equipe: mesEchos,
    tentatives: 0,
    fini: false,
    preemptif: preemptif,
    figement: figementDuLieu(donjon)   // 0 a 100, monte a chaque tour
  };

  var e = ESPECES[donjon.espece];

  elem("combat-lieu").textContent = donjon.nom.toUpperCase();
  elem("m-nom").textContent = e.nom + " (niv. " + donjon.niveau + ")";

  var img = elem("monstre-img"), vide = elem("monstre-vide");
  img.style.display = "none";
  vide.style.display = "flex";
  img.onload = function () { img.style.display = "block"; vide.style.display = "none"; };
  img.onerror = function () { img.style.display = "none"; vide.style.display = "flex"; };
  img.src = DOSSIER_MONSTRES + e.img + ".png";

  elem("combat-actions").innerHTML =
    '<button id="btn-attaquer">Attaquer</button>' +
    '<button id="btn-assimiler" class="assimilation">Assimiler</button>' +
    '<button id="btn-fuir">Fuir</button>';
  brancherBoutonsCombat();
  boutonsActifs(true);

  majAffichageCombat();

  message("<b>" + e.nom + "</b>, " + e.titre + ", se manifeste." +
          (preemptif ? "<br><span style='color:#b455d4'>Tu l'as surpris : il perd son premier tour.</span>" : ""));

  elem("combat").classList.add("actif");
}

function equipeDebout() {
  for (var i = 0; i < combat.equipe.length; i++) if (combat.equipe[i].pv > 0) return true;
  return false;
}

function actionAttaquer() {
  boutonsActifs(false);

  var lignes = [];
  var palier = palierFigement(combat.figement);

  for (var i = 0; i < combat.equipe.length; i++) {
    var c = combat.equipe[i];
    if (c.pv <= 0) continue;

    // degats() reste la formule d'origine ; les multiplicateurs
    // viennent apres, dans degatsAjustes().
    var brut = degats(c.atq, combat.adversaire.def, Math.random());
    var d = degatsAjustes(brut, c.espece, combat.adversaire.espece, palier);

    combat.adversaire.pv -= d;
    lignes.push(ESPECES[c.espece].nom + " frappe : " + d +
                mentionAffinite(c.espece, combat.adversaire.espece));

    if (combat.adversaire.pv <= 0) break;
  }

  elem("scene").classList.add("secoue");
  setTimeout(function () { elem("scene").classList.remove("secoue"); }, 300);

  message(lignes.join("<br>"));
  majAffichageCombat();

  if (combat.adversaire.pv <= 0) { setTimeout(dissipation, 800); return; }
  setTimeout(tourAdverse, 900);
}

function actionAssimiler() {
  boutonsActifs(false);

  var chance = chanceAssimilation(combat);
  combat.tentatives++;

  var e = ESPECES[combat.donjon.espece];

  if (Math.random() * 100 < chance) {
    message("Le savoir de <b>" + e.nom + "</b> se laisse enfin saisir.");
    setTimeout(capture, 800);
    return;
  }

  message("Tu tentes d'assimiler <b>" + e.nom + "</b> (" + chance + " %).<br>Le savoir se dérobe.");
  majAffichageCombat();
  setTimeout(tourAdverse, 900);
}

function actionFuir() {
  boutonsActifs(false);

  var moyenne = 0;
  for (var i = 0; i < combat.equipe.length; i++) moyenne += combat.equipe[i].niveau;
  moyenne = moyenne / combat.equipe.length;

  var chance = 0.5 + (moyenne - combat.adversaire.niveau) * 0.07;

  if (Math.random() < chance) {
    message("Tu rappelles tes échos et t'éloignes.<br>Le lieu garde le sien.");
    finDeCombat();
    return;
  }

  message("L'écho te barre le passage !");
  setTimeout(tourAdverse, 900);
}

function tourAdverse() {
  if (!combat || combat.fini) return;

  // Tour d'ouverture offert par l'approche discrete
  if (combat.preemptif) {
    combat.preemptif = false;
    finDeTour();
    return;
  }

  // Il frappe l'Echo debout le plus avance
  var cible = null;
  for (var i = 0; i < combat.equipe.length; i++) {
    if (combat.equipe[i].pv > 0) { cible = combat.equipe[i]; break; }
  }

  if (!cible) { defaite(); return; }

  var brut = degats(combat.adversaire.atq, cible.def, Math.random());
  var d = degatsAjustes(brut, combat.adversaire.espece, cible.espece,
                        palierFigement(combat.figement));
  cible.pv -= d;

  var txt = "<b>" + ESPECES[combat.donjon.espece].nom + "</b> frappe " +
            ESPECES[cible.espece].nom + " : " + d + " dégâts." +
            mentionAffinite(combat.adversaire.espece, cible.espece);

  if (cible.pv <= 0) {
    cible.pv = 0;
    txt += "<br>" + ESPECES[cible.espece].nom + " se dissout.";
  }

  message(txt);
  majAffichageCombat();

  if (!equipeDebout()) { setTimeout(defaite, 800); return; }
  finDeTour();
}

/* Le tour est termine : le lieu se fige d'un cran, l'affichage
   suit, et la main revient au joueur. */
function finDeTour() {
  avancerFigement();
  majAffichageCombat();
  boutonsActifs(true);
}


/* ------------------------------------------------------------
   ISSUES DE LA RENCONTRE
   ------------------------------------------------------------ */

// Recompense commune a la capture et a la dissipation
function distribuerXp(bonusFortune) {
  var gain = 6 + combat.donjon.niveau * 5;
  if (bonusFortune) gain *= 2;

  var lignes = [];
  for (var i = 0; i < combat.equipe.length; i++) {
    var c = combat.equipe[i];
    var montees = gagnerXp(c.espece, gain);
    if (montees > 0) {
      lignes.push(ESPECES[c.espece].nom + " atteint le niveau " + collection[c.espece].niveau + " !");
    }
  }

  return { gain: gain, lignes: lignes };
}

function capture() {
  var d = combat.donjon;
  var e = ESPECES[d.espece];

  // Jin Chan double les gains s'il est dans l'equipe
  var fortune = equipe.indexOf("jinchan") !== -1;
  var r = distribuerXp(fortune);

  var issue = ajouterAlaCollection(d.espece, d.niveau);
  var txt;

  if (issue === "nouveau") {
    txt = "<b>" + e.nom + "</b> est assimilé. Son savoir rejoint ton grimoire.";
  } else if (issue === "renforce") {
    txt = "Le savoir de <b>" + e.nom + "</b> niveau " + d.niveau + " supplante celui que tu détenais.";
  } else {
    txt = "<b>" + e.nom + "</b> se livre, mais tu en savais déjà davantage.";
  }

  txt += "<br>+" + r.gain + " points d'écho" + (fortune ? " (Fortune)" : "") + ".";
  if (r.lignes.length) txt += "<br>" + r.lignes.join("<br>");

  d.capture = true;
  rafraichirMarqueur(d);
  sauvegarder();

  message(txt);
  finDeCombat();
}

function dissipation() {
  var e = ESPECES[combat.donjon.espece];
  var fortune = equipe.indexOf("jinchan") !== -1;
  var r = distribuerXp(fortune);

  var txt = "<b>" + e.nom + "</b> se disloque et disparaît.<br>" +
            "<span style='color:#d4554a'>Son savoir est perdu à jamais.</span><br>" +
            "+" + r.gain + " points d'écho.";
  if (r.lignes.length) txt += "<br>" + r.lignes.join("<br>");

  combat.donjon.dissipe = true;
  rafraichirMarqueur(combat.donjon);
  sauvegarder();

  message(txt);
  finDeCombat();
}

function defaite() {
  message("Tes échos sont épuisés.<br>Tu recules. Le lieu garde le sien.");
  finDeCombat();
}

function finDeCombat() {
  combat.fini = true;

  // Les Echos se remettent entre deux rencontres
  for (var id in collection) {
    collection[id].pv = statsAuNiveau(id, collection[id].niveau).pvMax;
  }

  sauverJoueur();
  majFiche();

  elem("combat-actions").innerHTML =
    '<button class="sortie" id="btn-sortir">Revenir à la carte</button>';

  elem("btn-sortir").addEventListener("click", function () {
    elem("combat").classList.remove("actif");
    combat = null;
    if (dernierePosition) mettreAJourHud(dernierePosition[0], dernierePosition[1]);
  });
}

function brancherBoutonsCombat() {
  elem("btn-attaquer").addEventListener("click", actionAttaquer);
  elem("btn-assimiler").addEventListener("click", actionAssimiler);
  elem("btn-fuir").addEventListener("click", actionFuir);
}


/* ------------------------------------------------------------
   OUTIL DE CONSOLE
   Ouvre la console et tape :   Combat.testerFigement()
   Le tableau sort les multiplicateurs palier par palier, plus
   un exemple chiffre sur une frappe de base a 10 degats, pour
   voir d'un coup d'oeil si l'equilibrage tient.
   ------------------------------------------------------------ */

function testerFigement(degatsDeBase) {
  var base = degatsDeBase || 10;
  var natures = ["organique", "mecanique", "hybride"];

  function colonne(t, largeur) {
    t = String(t);
    while (t.length < largeur) t += " ";
    return t;
  }

  console.log("FIGEMENT — multiplicateur de l'attaquant, par palier");
  console.log("(entre parentheses : degats finaux pour une frappe de base a " + base + ")");
  console.log("");
  console.log(colonne("palier", 8) + natures.map(function (n) {
    return colonne(n, 20);
  }).join(""));

  for (var p = 0; p <= FIGEMENT_PALIER_MAX; p++) {
    var ligne = colonne(p, 8);
    for (var i = 0; i < natures.length; i++) {
      // On passe par une espece reelle de chaque nature : c'est le
      // meme chemin de code que le combat, pas une formule recopiee.
      var espece = especeDeNature(natures[i]);
      var m = multiplicateurFigement(espece, p);
      var d = Math.max(1, Math.round(base * m));
      ligne += colonne(m.toFixed(2) + "   (" + d + ")", 20);
    }
    console.log(ligne);
  }

  console.log("");
  console.log("AFFINITES — matiere bat recit, recit bat oubli, oubli bat matiere");
  console.log("  avantage " + AFFINITE_AVANTAGE +
              "   neutre " + AFFINITE_NEUTRE +
              "   desavantage " + AFFINITE_DESAVANTAGE);
  console.log("");
  console.log("Vitesse : +" + VITESSE_FIGEMENT + " palier par tour" +
              "   |   chiffre exact affiche a partir du niveau " + SEUIL_LECTURE_FIGEMENT);
}

// La premiere espece du bestiaire qui porte cette nature.
function especeDeNature(nature) {
  for (var id in ESPECES) if (ESPECES[id].nature === nature) return id;
  return null;
}

/* Le seul global que ce fichier expose. Le reste du jeu continue
   d'appeler les fonctions directement, rien n'a change pour lui. */
window.Combat = {
  testerFigement: testerFigement,
  figementDuLieu: figementDuLieu,
  palierFigement: palierFigement,
  multiplicateurFigement: multiplicateurFigement,
  multiplicateurAffinite: multiplicateurAffinite,
  degatsAjustes: degatsAjustes
};
