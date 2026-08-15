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
   AFFICHAGE
   ------------------------------------------------------------ */

function message(t) { elem("combat-message").innerHTML = t; }

function majAffichageCombat() {
  var a = combat.adversaire;

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
            '<b>' + e.nom + '</b>' +
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
    preemptif: preemptif
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
  for (var i = 0; i < combat.equipe.length; i++) {
    var c = combat.equipe[i];
    if (c.pv <= 0) continue;

    var d = degats(c.atq, combat.adversaire.def, Math.random());
    combat.adversaire.pv -= d;
    lignes.push(ESPECES[c.espece].nom + " frappe : " + d);

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
    boutonsActifs(true);
    return;
  }

  // Il frappe l'Echo debout le plus avance
  var cible = null;
  for (var i = 0; i < combat.equipe.length; i++) {
    if (combat.equipe[i].pv > 0) { cible = combat.equipe[i]; break; }
  }

  if (!cible) { defaite(); return; }

  var d = degats(combat.adversaire.atq, cible.def, Math.random());
  cible.pv -= d;

  var txt = "<b>" + ESPECES[combat.donjon.espece].nom + "</b> frappe " +
            ESPECES[cible.espece].nom + " : " + d + " dégâts.";

  if (cible.pv <= 0) {
    cible.pv = 0;
    txt += "<br>" + ESPECES[cible.espece].nom + " se dissout.";
  }

  message(txt);
  majAffichageCombat();

  if (!equipeDebout()) { setTimeout(defaite, 800); return; }
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
