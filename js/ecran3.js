/* ============================================================
   L'ECRAN DU COMBAT A PLUSIEURS
   Jusqu'a 3 Echos contre 1 a 3 adversaires, en 2D. Les regles
   vivent dans js/combat3.js (le moteur) ; ce fichier ne fait que
   les montrer, demander au joueur ce qu'il veut faire, et
   distribuer les recompenses a la fin.

   QUAND IL S'OUVRE. Seulement si COMBAT_MULTI_ACTIF vaut true
   (js/config.js), ou si l'interrupteur "Combat a plusieurs" du
   mode test est sur Oui. Sinon, lancer() appelle demarrerCombat()
   et c'est le combat 1 contre 1 de js/combat.js, intact, qui
   s'ouvre. js/combat.js n'a pas ete modifie : le choix se fait
   ici, appele par le bouton "Approcher" (js/jeu.js).

   LE HASARD. Une seule fonction, alea (Math.random), passee au
   moteur pour chaque action. Le moteur, lui, ne tire jamais rien.

   LA FIN DU COMBAT reprend celle de js/combat.js :
     - victoire : butin de KO (fragments) pour chaque adversaire
       KO, une fois chacun ;
     - XP : une part par adversaire vaincu (KO ou assimile). LA
       FORMULE EST RECOPIEE de distribuerXp() (gainXpParAdversaire
       ci-dessous), parce que distribuerXp lit la variable combat
       de l'ancien ecran. Un test de verifier/parcours.js verifie
       qu'elles donnent le meme chiffre. A UNIFIER quand l'ancien
       ecran disparaitra ;
     - assimilation : ajouterAlaCollection(espece,
       ASSIMILATION_NIVEAU_ENTREE), donc au niveau 1 (le combat
       1 contre 1 garde donjon.niveau). Un Echo assimile est garde
       meme si le combat finit ensuite en defaite ou en fuite, et
       le lieu passe a capture ;
     - defaite, fuite : ni butin ni XP de KO, les PV sont rendus ;
     - sauvegarde : comme finDeCombat(). Le combat d'essai du mode
       test (donjon.fictif) n'ecrit RIEN : chargerJoueur() relit la
       vraie partie.

   POINT D'ACCROCHE DU RENDU 3D. Chaque carte d'adversaire a son
   conteneur visuel (classe c3-visuel, fabrique par poserVisuel).
   C'est la que Rendu3D (js/rendu3d.js) posera son canvas, avec
   l'image 2D et le visuel de secours actuels comme repli. Rien
   n'est branche aujourd'hui.

   Ce fichier expose un seul global : window.Ecran3.
   ============================================================ */

window.Ecran3 = (function () {

var alea = Math.random;     // le seul hasard de l'ecran

/* L'etat du combat en cours, ou null. Remis a zero a chaque
   rencontre. La phase dit ce que le joueur peut toucher :
     "intro"      le journal annonce les adversaires
     "commande"   c'est a un de tes Echos : les 5 commandes
     "aptitudes"  le menu d'aptitudes est ouvert
     "ciblage"    on attend que tu touches un adversaire
     "occupe"     le journal defile ou un adversaire joue
     "fin"        le combat est fini */
var etat = null;
var branche = false;
var verrou = false;         // l'appui qui fait avancer le journal


/* ------------------------------------------------------------
   1. QUEL ECRAN ?
   ------------------------------------------------------------ */

function choisi() {
  if (COMBAT_MULTI_ACTIF) return true;
  return typeof ModeTest !== "undefined" && ModeTest.combatMulti();
}

function enCours() { return etat !== null; }

// Le seul point d'entree du bouton "Approcher".
function lancer(donjon, preemptif) {
  if (choisi()) return demarrer(donjon, preemptif);
  demarrerCombat(donjon, preemptif);
  return true;
}

/* Combien d'adversaires : COMBAT_MULTI_ADVERSAIRES_LIEU pour une
   arene, le selecteur du mode test pour le terrain d'essai.
   POINT D'ACCROCHE : une poche d'Oubli passera ici son propre
   nombre (profond 2, critique 3). */
function nombreAdversaires(donjon) {
  var n = COMBAT_MULTI_ADVERSAIRES_LIEU;
  if (donjon && donjon.fictif && typeof ModeTest !== "undefined" && ModeTest.actif()) {
    n = ModeTest.reglages.adversaires;
  }
  n = Math.round(Number(n));
  if (!(n >= 1)) n = 1;
  return Math.min(n, ADVERSAIRES_MAX);
}


/* ------------------------------------------------------------
   2. LE DEMARRAGE
   ------------------------------------------------------------ */

function demarrer(donjon, preemptif) {
  if (!donjon || etat) return false;

  var monEquipe = [];
  for (var i = 0; i < equipe.length; i++) {
    var e = collection[equipe[i]];
    if (e) monEquipe.push({ espece: e.espece, niveau: e.niveau });
  }

  // Les adversaires 2 et 3 sont des copies de l'Echo du lieu, au
  // meme niveau : assimiler l'un d'eux, c'est assimiler le lieu.
  var n = nombreAdversaires(donjon);
  var adversaires = [];
  for (var j = 0; j < n; j++) {
    adversaires.push({ espece: donjon.espece, niveau: niveauAdversaire(donjon), rang: donjon.rang });
  }

  // Le gate break, fige pour tout le combat. L'heure est lue ICI :
  // ni js/poche.js ni le moteur ne lisent l'horloge.
  var malus = malusGateBreak(donjon, poches, Date.now());

  var r = creerCombatMulti(monEquipe, adversaires, {
    preemptif: !!preemptif,
    malusGateBreak: malus,
    palier: palierFigement(figementDuLieu(donjon))
  });
  if (!r.ok) return false;

  etat = {
    donjon: donjon, combat: r.combat, phase: "intro",
    intention: null, cibles: [],
    fil: [], journal: [], historique: [], minuteur: null, apres: null,
    attente: null, issue: null, sortiePrete: false,
    cartes: {}, cmd: null, boutonsApt: {}
  };

  brancher();
  construire();
  dessinerJournal();
  majAffichage();
  elem("combat3").classList.add("actif");

  var esp = ESPECES[donjon.espece];
  var lignes = [n > 1
    ? txt("c3.apparition.plusieurs", { nombre: n, nom: esp.nom, titre: esp.titre })
    : txt("c3.apparition.un", { nom: esp.nom, titre: esp.titre })];
  if (r.combat.malusGateBreak > 0) lignes.push(txt("c3.gateBreak", { malus: r.combat.malusGateBreak }));
  if (preemptif) {
    lignes.push('<span class="c3-surprise">' +
                txt(n > 1 ? "c3.preemptif.plusieurs" : "c3.preemptif.un") + '</span>');
  }
  raconter(lignes, enchainer);
  return true;
}

// Un appui n'importe ou fait avancer le journal. Branche une fois :
// #combat3 reste le meme element toute la partie.
function brancher() {
  if (branche) return;
  elem("combat3").addEventListener("click", avancerJournal);
  branche = true;
}


/* ------------------------------------------------------------
   3. LES CARTES, L'ORDRE, LES COMMANDES
   ------------------------------------------------------------ */

function creer(tag, classe, parent) {
  var e = document.createElement(tag);
  if (classe) e.className = classe;
  if (parent) parent.appendChild(e);
  return e;
}

function vider(n) {
  while (n.firstChild) n.removeChild(n.firstChild);
  n.innerHTML = "";
}

/* Le nom affiche d'un monstre. Quand deux adversaires portent la
   meme espece (ou qu'un de tes Echos la porte aussi), ils prennent
   une lettre : "Komainu A", "Komainu B". Sinon le journal dirait
   "Komainu frappe Komainu". */
function nomUnite(u) {
  var nom = (ESPECES[u.espece] || {}).nom || u.espece;
  if (u.camp !== "adverse") return nom;
  var c = etat.combat;
  var memes = c.adversaires.filter(function (a) { return a.espece === u.espece; }).length > 1 ||
              c.equipe.some(function (e) { return e.espece === u.espece; });
  return memes ? nom + " " + "ABC".charAt(u.place) : nom;
}

/* L'image de l'espece, ou son visuel de secours : comme
   afficherAdversaire() dans js/combat.js, mais pour une carte
   parmi trois. Le secours est pose AVANT l'image.
   POINT D'ACCROCHE 3D : boite est le conteneur ou Rendu3D posera
   son canvas. */
function poserVisuel(boite, especeId) {
  var vide = creer("div", "c3-secours", boite);
  poserSecours(vide, especeId);
  vide.style.display = "flex";

  var e = ESPECES[especeId];
  if (!e || !e.image) return;

  var img = creer("img", "c3-img", boite);
  img.alt = "";
  img.style.display = "none";
  img.onload = function () { img.style.display = "block"; vide.style.display = "none"; };
  img.onerror = function () { img.style.display = "none"; vide.style.display = "flex"; };
  img.src = DOSSIER_MONSTRES + e.image;
}

// Une carte : un bouton pour un adversaire (on le touche pour le
// cibler), un simple bloc pour un de tes Echos.
function carte(u, parent) {
  var adverse = u.camp === "adverse";
  var racine = creer(adverse ? "button" : "div", "", parent);
  var n = { racine: racine };

  if (adverse) {
    racine.type = "button";
    n.visuel = creer("div", "c3-visuel", racine);
    poserVisuel(n.visuel, u.espece);
    racine.addEventListener("click", function () { toucherCarte(u.id); });
  }

  n.nom = creer("div", "c3-nom", racine);
  n.nom.textContent = nomUnite(u);
  n.info = creer("div", "c3-info", racine);
  n.jauge = creer("div", "c3-jauge", racine);
  n.barre = creer("span", "", n.jauge);
  n.affinite = creer("div", "c3-affinite", racine);
  n.affinite.innerHTML = pastilleAffinite(u.espece);
  n.chance = creer("div", "c3-chance", racine);
  return n;
}

function bouton(parent, cle, classe, action) {
  var b = creer("button", classe, parent);
  b.type = "button";
  b.textContent = txt(cle);
  b.addEventListener("click", function () {
    if (b.disabled) return;
    action();
  });
  return b;
}

function construire() {
  var c = etat.combat;
  elem("c3-lieu").textContent = String(etat.donjon.nom || "").toUpperCase();

  var zoneAdv = elem("c3-adversaires");
  vider(zoneAdv);
  c.adversaires.forEach(function (u) { etat.cartes[u.id] = carte(u, zoneAdv); });

  var zoneEq = elem("c3-equipe");
  vider(zoneEq);
  c.equipe.forEach(function (u) { etat.cartes[u.id] = carte(u, zoneEq); });

  // Les 5 commandes, toujours les memes, toujours au meme endroit.
  var zone = elem("c3-commandes");
  vider(zone);
  var k = etat.cmd = {};
  k.grille    = creer("div", "c3-grille", zone);
  k.attaquer  = bouton(k.grille, "c3.cmd.attaquer", "", function () { cibler("attaque"); });
  k.aptitude  = bouton(k.grille, "c3.cmd.aptitude", "", ouvrirAptitudes);
  k.assimiler = bouton(k.grille, "c3.cmd.assimiler", "c3-assimiler", function () { cibler("assimiler"); });
  k.defendre  = bouton(k.grille, "c3.cmd.defendre", "", function () { jouer({ type: "defendre" }); });
  k.fuir      = bouton(k.grille, "c3.cmd.fuir", "c3-fuir", function () { jouer({ type: "fuir" }); });

  k.ciblage   = creer("div", "c3-ciblage", zone);
  k.consigne  = creer("div", "c3-consigne", k.ciblage);
  k.consigne.textContent = txt("c3.consigne");
  k.annuler   = bouton(k.ciblage, "c3.cmd.annuler", "", annulerCiblage);

  k.sortie    = bouton(zone, "c3.cmd.sortir", "c3-sortie", sortir);

  fermerAptitudes();
}

// La chance d'assimiler CETTE cible : la formule du moteur.
function chanceSur(u) {
  var c = etat.combat;
  return chanceAssimilation({
    adversaire: u, equipe: c.equipe,
    bonusAppel: c.bonusAppel, bonusDefense: c.bonusDefense
  });
}

// Les cibles possibles : celles du moteur, et pour Assimiler,
// seulement celles qui ecoutent.
function ciblesPour(type, acteur) {
  var c = etat.combat;
  var ids = ciblesValides(c, acteur, type);
  if (type !== "assimiler") return ids;
  return ids.filter(function (id) {
    var u = cmTrouver(c, id);
    return assimilable({ espece: u.espece, rang: u.rang });
  });
}

function majAffichage() {
  if (!etat) return;
  var c = etat.combat;
  var acteur = acteurCourant(c);
  var ciblage = etat.phase === "ciblage";

  c.adversaires.concat(c.equipe).forEach(function (u) {
    var n = etat.cartes[u.id];
    if (!n) return;

    var cls = "c3-carte " + (u.camp === "adverse" ? "c3-adverse" : "c3-allie");
    if (u.assimile) cls += " c3-assimile";
    else if (u.pv <= 0) cls += " c3-ko";
    if (acteur && acteur.id === u.id) cls += " c3-actif";
    var visee = ciblage && etat.cibles.indexOf(u.id) !== -1;
    if (visee) cls += " c3-ciblable";
    n.racine.className = cls;

    var etatPv = u.assimile ? txt("c3.assimile") : (u.pv <= 0 ? txt("c3.ko") : u.pv + "/" + u.pvMax);
    n.info.textContent = txt("c3.niveau", { n: u.niveau }) + " \u00b7 " + etatPv;

    var pc = Math.max(0, u.pv) / u.pvMax * 100;
    n.barre.style.width = pc + "%";
    n.barre.className = pc < 20 ? "danger" : (pc < 50 ? "bas" : "");

    n.chance.textContent = visee && etat.intention.type === "assimiler" ? chanceSur(u) + " %" : "";
  });

  dessinerOrdre(acteur);
  majCommandes(acteur);
}

// La barre d'ordre : qui joue, dans quel ordre, ce tour de table.
function dessinerOrdre(acteur) {
  var c = etat.combat;
  var zone = elem("c3-ordre");
  vider(zone);
  etat.jetons = [];

  var t = creer("span", "c3-tour", zone);
  t.textContent = txt("c3.tour", { n: c.tour });

  ordreDesTours(c).forEach(function (u) {
    var cls = "c3-jeton " + (u.camp === "joueur" ? "c3-joueur" : "c3-ennemi");
    if (c.ontJoue.indexOf(u.id) !== -1) cls += " c3-joue";
    if (acteur && acteur.id === u.id) cls += " c3-actif";
    var j = creer("span", cls, zone);
    j.textContent = nomUnite(u);
    etat.jetons.push(j);
  });
}

function majCommandes(acteur) {
  var k = etat.cmd, p = etat.phase, c = etat.combat;

  k.grille.style.display  = (p === "ciblage" || p === "fin") ? "none" : "";
  k.ciblage.style.display = p === "ciblage" ? "" : "none";
  k.sortie.style.display  = p === "fin" && etat.sortiePrete ? "" : "none";

  var main = p === "commande" && !!acteur && acteur.camp === "joueur";
  k.attaquer.disabled = !main;
  k.defendre.disabled = !main;
  k.fuir.disabled     = !main;
  k.aptitude.disabled = !main || aptitudesConnues(acteur.espece, acteur.niveau).length === 0;

  // Le taux se lit sur le bouton quand il n'y a qu'une cible ; avec
  // plusieurs, il s'affiche sur chaque carte pendant le ciblage.
  if (!assimilable({ espece: etat.donjon.espece, rang: etat.donjon.rang })) {
    k.assimiler.textContent = txt("c3.cmd.sourd");
    k.assimiler.disabled = true;
    return;
  }
  var cibles = main && !c.assimile ? ciblesPour("assimiler", acteur) : [];
  k.assimiler.textContent = cibles.length === 1
    ? txt("c3.cmd.assimilerChance", { chance: chanceSur(cmTrouver(c, cibles[0])) })
    : txt("c3.cmd.assimiler");
  k.assimiler.disabled = cibles.length === 0;
}


/* ------------------------------------------------------------
   4. LE CIBLAGE ET LES ACTIONS DU JOUEUR
   ------------------------------------------------------------ */

function monTour() {
  var a = etat && acteurCourant(etat.combat);
  return a && a.camp === "joueur" ? a : null;
}

function action(type, cle, cible) {
  var a = { type: type };
  if (cle) a.cle = cle;
  if (cible !== undefined) a.cible = cible;
  return a;
}

/* Attaquer, Aptitude offensive, Assimiler : une cible. Une seule
   possible, elle est prise d'office ; plusieurs, les cartes
   s'allument et on attend le doigt du joueur. */
function cibler(type, cle) {
  if (!etat || (etat.phase !== "commande" && etat.phase !== "aptitudes")) return;
  var acteur = monTour();
  if (!acteur) return;

  var cibles = ciblesPour(type, acteur);
  if (cibles.length === 0) return;
  if (cibles.length === 1) { jouer(action(type, cle, cibles[0])); return; }

  etat.phase = "ciblage";
  etat.intention = { type: type, cle: cle || null };
  etat.cibles = cibles;
  majAffichage();
}

function toucherCarte(id) {
  if (!etat || etat.phase !== "ciblage") return;
  if (etat.cibles.indexOf(id) === -1) return;
  jouer(action(etat.intention.type, etat.intention.cle, id));
}

function annulerCiblage() {
  if (!etat || etat.phase !== "ciblage") return;
  etat.phase = "commande";
  etat.intention = null;
  etat.cibles = [];
  majAffichage();
}

/* Le seul endroit ou le joueur agit. La phase passe a "occupe"
   AVANT tout le reste : un deuxieme appui (le clic fantome du
   tactile) trouve la porte fermee. */
function jouer(a) {
  if (!etat) return;
  var p = etat.phase;
  if (p !== "commande" && p !== "ciblage" && p !== "aptitudes") return;
  if (!monTour()) return;

  var r = jouerActionMulti(etat.combat, a, alea);
  etat.intention = null;
  etat.cibles = [];
  fermerAptitudes();

  if (!r.ok) { etat.phase = "commande"; majAffichage(); return; }

  etat.phase = "occupe";
  majAffichage();
  if (a.type === "attaque" || a.type === "aptitude") secouer();
  raconter(phrases(r.evenements), enchainer);
}

function secouer() {
  var z = elem("c3-adversaires");
  z.classList.add("secoue");
  setTimeout(function () { z.classList.remove("secoue"); }, 300);
}

/* Apres chaque action : la fin, le tour d'un adversaire (apres une
   courte pause), ou la main au joueur. */
function enchainer() {
  if (!etat) return;
  var c = etat.combat;
  var issue = issueCombatMulti(c);
  if (issue) { terminer(issue); return; }

  var a = acteurCourant(c);
  if (a && a.camp === "adverse") {
    etat.phase = "occupe";
    majAffichage();
    etat.attente = setTimeout(tourAdverse, COMBAT3_DELAI_ADVERSE);
    return;
  }

  etat.phase = "commande";
  majAffichage();
}

function tourAdverse() {
  if (!etat) return;
  etat.attente = null;

  var a = actionAdverse(etat.combat, alea);
  var r = a ? jouerActionMulti(etat.combat, a, alea) : null;
  if (!r || !r.ok) { etat.phase = "commande"; majAffichage(); return; }   // garde-fou

  majAffichage();
  raconter(phrases(r.evenements), enchainer);
}


/* ------------------------------------------------------------
   5. LE MENU D'APTITUDES
   Les aptitudes du seul Echo dont c'est le tour : dans ce combat,
   chacun joue pour soi.
   ------------------------------------------------------------ */

function ouvrirAptitudes() {
  if (!etat || etat.phase !== "commande") return;
  var acteur = monTour();
  if (!acteur) return;

  var boite = elem("c3-aptitudes");
  vider(boite);
  etat.boutonsApt = {};

  var titre = creer("div", "apt-echo", boite);
  titre.textContent = txt("c3.apt.titre", { nom: nomUnite(acteur) });

  var connues = aptitudesConnues(acteur.espece, acteur.niveau);
  if (connues.length === 0) {
    creer("div", "apt-echo", boite).textContent = txt("c3.apt.aucune");
  }

  connues.forEach(function (cle) {
    var a = APTITUDES[cle];
    var reste = rechargeRestante(acteur, cle);
    var b = creer("button", "apt-ligne", boite);
    b.type = "button";
    b.disabled = reste > 0;
    b.innerHTML = '<span class="apt-nom">' + a.nom +
                  (reste > 0 ? ' <span class="apt-attente">' +
                    txt(reste > 1 ? "c3.apt.tours.plusieurs" : "c3.apt.tours.un", { n: reste }) +
                    '</span>' : '') +
                  '</span><span class="apt-texte">' + a.texte + '</span>';
    b.addEventListener("click", function () {
      if (b.disabled) return;
      choisirAptitude(cle);
    });
    etat.boutonsApt[cle] = b;
  });

  etat.boutonRetourApt = bouton(boite, "c3.cmd.retour", "c3-retour", function () {
    fermerAptitudes();
    majAffichage();
  });

  etat.phase = "aptitudes";
  boite.classList.add("c3-ouvert");
  majAffichage();
}

function fermerAptitudes() {
  elem("c3-aptitudes").classList.remove("c3-ouvert");
  if (etat && etat.phase === "aptitudes") etat.phase = "commande";
}

function choisirAptitude(cle) {
  if (!etat || etat.phase !== "aptitudes") return;
  if (cmCibleAptitude(APTITUDES[cle]) === "adverse") {
    cibler("aptitude", cle);        // ferme le menu en jouant ou en ciblant
    if (etat && etat.phase === "ciblage") fermerAptitudes();
    return;
  }
  jouer(action("aptitude", cle));
}


/* ------------------------------------------------------------
   6. LE JOURNAL
   Le meme que celui de js/combat.js (memes reglages, meme style),
   sur son propre cadre : celui de l'ancien ecran allume ses
   propres boutons a la fin de chaque recit.
   ------------------------------------------------------------ */

function dessinerJournal() {
  var html = "";
  for (var i = 0; i < etat.journal.length; i++) {
    var age = etat.journal.length - 1 - i;
    var opacite = JOURNAL_OPACITES[age];
    if (opacite === undefined) opacite = JOURNAL_OPACITES[JOURNAL_OPACITES.length - 1];
    html += '<div class="journal-ligne" style="opacity:' + opacite + '">' + etat.journal[i] + '</div>';
  }

  var boite = elem("c3-journal");
  boite.innerHTML = html;

  // Aucune ligne coupee : les plus anciennes partent entieres.
  while (boite.firstChild && boite.scrollHeight > boite.clientHeight) {
    boite.removeChild(boite.firstChild);
  }
}

function defilerJournal() {
  if (!etat) return;

  if (etat.fil.length === 0) {
    etat.minuteur = null;
    var suite = etat.apres;
    etat.apres = null;
    if (suite) suite();
    return;
  }

  var l = etat.fil.shift();
  etat.journal.push(l);
  while (etat.journal.length > JOURNAL_LIGNES) etat.journal.shift();
  etat.historique.push({ quand: Date.now(), ligne: l });
  dessinerJournal();
  etat.minuteur = setTimeout(defilerJournal, DELAI_JOURNAL);
}

function raconter(lignes, suite) {
  etat.fil = etat.fil.concat(lignes.filter(function (l) { return !!l; }));
  etat.apres = suite || null;
  if (!etat.minuteur) defilerJournal();
}

/* Un appui hors des boutons sort la ligne suivante tout de suite.
   Les boutons (commandes et cartes) sont exclus : sinon l'appui
   qui lance une action ferait aussi sauter sa premiere ligne. */
function avancerJournal(ev) {
  if (!etat || verrou || !etat.minuteur) return;
  var t = ev && ev.target;
  if (t && t.closest && t.closest("button")) return;

  verrou = true;
  clearTimeout(etat.minuteur);
  etat.minuteur = null;
  defilerJournal();
  setTimeout(function () { verrou = false; }, DELAI_APPUI);
}


/* ------------------------------------------------------------
   7. LES PHRASES
   Le moteur rend des evenements (des donnees) ; ici on les met en
   mots, dans la langue courante. Une ligne par evenement.
   ------------------------------------------------------------ */

// Comme mentionAffinite() : les mots decrivent le coup, la couleur
// dit qui en profite (vert : toi, orange : l'adversaire).
function mention(m, joueurAttaque) {
  if (typeof m !== "number" || m === AFFINITE_NEUTRE) return "";
  var renforce = m > AFFINITE_NEUTRE;
  var joueurEnProfite = renforce ? joueurAttaque : !joueurAttaque;
  return ' <span class="' + (joueurEnProfite ? "affinite-plus" : "affinite-moins") + '">' +
         txt(renforce ? "c3.affinite.renforce" : "c3.affinite.attenue") + '</span>';
}

function phrase(ev) {
  var c = etat.combat;
  var acteur = ev.acteur ? cmTrouver(c, ev.acteur) : null;
  var cible  = ev.cible  ? cmTrouver(c, ev.cible)  : null;
  var A = acteur ? nomUnite(acteur) : "";
  var C = cible  ? nomUnite(cible)  : "";
  var duJoueur = !!acteur && acteur.camp === "joueur";

  switch (ev.type) {
    case "attaque":
      return txt("c3.attaque", { acteur: A, cible: C, degats: ev.degats }) + mention(ev.affinite, duJoueur);

    case "aptitude":
      var apt = (APTITUDES[ev.cle] || {}).nom || ev.cle;
      if (typeof ev.degats === "number") {
        return txt("c3.apt.degats", { acteur: A, apt: apt, cible: C, degats: ev.degats }) +
               mention(ev.affinite, duJoueur);
      }
      if (ev.soin) return txt("c3.apt.soin", { acteur: A, apt: apt, soin: ev.soin });
      if (ev.bonusAssimilation) return txt("c3.apt.appel", { acteur: A, apt: apt });
      if (cible) return txt("c3.apt.sceau", { acteur: A, apt: apt, cible: C });
      return txt("c3.apt.garde", { acteur: A, apt: apt });

    case "ko":
      return txt(cible && cible.camp === "joueur" ? "c3.ko.echo" : "c3.ko.adverse", { cible: C });

    case "assimilation":
      return txt(ev.reussi ? "c3.assim.reussie" : "c3.assim.ratee", { cible: C });

    case "defense":
      return txt("c3.defense", { acteur: A });

    case "fuite":
      return txt(ev.reussi ? "c3.fuite.reussie" : "c3.fuite.ratee");

    case "repos":
      return txt("c3.repos", { acteur: A });

    case "finTour":
      return txt("c3.finTour", { n: ev.tour + 1 });
  }
  return "";
}

function phrases(evenements) {
  return evenements.map(phrase).filter(function (l) { return !!l; });
}

var CLES_FRAGMENT = {
  mince:   ["c3.fragment.mince.un",   "c3.fragment.mince.plusieurs"],
  grand:   ["c3.fragment.grand.un",   "c3.fragment.grand.plusieurs"],
  complet: ["c3.fragment.complet.un", "c3.fragment.complet.plusieurs"]
};

// libelleFragments() de js/fragments.js, dans la langue courante.
function libelleFragments3(taille, nombre) {
  var cles = CLES_FRAGMENT[taille];
  if (!cles) return "";
  return nombre + " " + txt(cles[nombre > 1 ? 1 : 0]);
}

function libelleSac3(sac) {
  var bouts = [];
  FRAGMENT_TAILLES.forEach(function (t) {
    var n = (sac && sac[t]) || 0;
    if (n > 0) bouts.push(libelleFragments3(t, n));
  });
  if (bouts.length <= 1) return bouts.join("");
  return bouts.slice(0, -1).join(", ") + txt("c3.et") + bouts[bouts.length - 1];
}


/* ------------------------------------------------------------
   8. LA FIN DU COMBAT
   ------------------------------------------------------------ */

/* L'XP d'UN adversaire vaincu. RECOPIEE de distribuerXp()
   (js/combat.js) : meme base, meme multiplicateur du lieu, meme
   Fortune. Un test verifie que les deux donnent le meme chiffre ;
   a unifier quand l'ancien ecran disparaitra. */
function gainXpParAdversaire(donjon, fortune) {
  var gain = 6 + donjon.niveau * 5;
  gain = Math.round(gain * multiplicateurXp(donjon));
  if (fortune) gain *= 2;
  return gain;
}

// Une part par adversaire vaincu, versee en une fois a chaque Echo.
function donnerXp(donjon, fortune, parts) {
  var total = gainXpParAdversaire(donjon, fortune) * parts;
  var lignes = [txt(fortune ? "c3.xp.fortune" : "c3.xp", { gain: total })];

  etat.combat.equipe.forEach(function (u) {
    var montees = gagnerXp(u.espece, total);
    if (montees > 0) {
      lignes.push(txt("c3.montee", { nom: ESPECES[u.espece].nom, niveau: collection[u.espece].niveau }));
    }
  });
  return lignes;
}

/* Le butin d'un adversaire KO : butinDeKo() au niveau AUQUEL IL
   S'EST BATTU (gate break compris, fige au debut du combat), puis
   donnerFragment(). Les memes phrases que lignesButin(). */
function lignesButin(u) {
  var nom = ESPECES[u.espece].nom;
  var butin = butinDeKo(u.niveau);
  var res = donnerFragment(u.espece, butin.taille, butin.nombre);
  var lignes = [];

  if (res.recus > 0) {
    var pluriel = res.recus > 1;
    lignes.push(txt("c3.butin", { fragments: libelleFragments3(res.taille, res.recus), nom: nom }));
    lignes.push(res.ou === "echo"
      ? txt(pluriel ? "c3.butin.echo.plusieurs" : "c3.butin.echo.un")
      : txt(pluriel ? "c3.butin.gourde.plusieurs" : "c3.butin.gourde.un", {
          total: totalFragments(fragmentsEnGourde(u.espece)), capacite: res.capacite }));
  }
  if (res.perdus > 0) {
    lignes.push('<span class="affinite-moins">' +
                txt(res.perdus > 1 ? "c3.butin.perdu.plusieurs" : "c3.butin.perdu.un",
                    { fragments: libelleFragments3(res.taille, res.perdus) }) + '</span>');
  }
  return lignes;
}

/* L'Echo assimile entre dans la collection au niveau
   ASSIMILATION_NIVEAU_ENTREE. Une espece deja possedee ne bouge
   pas ("connu"). Le lieu passe a capture. */
function assimilerAuGrimoire(donjon, assimile) {
  var nom = ESPECES[assimile.espece].nom;

  // Lu AVANT : ajouterAlaCollection vide la gourde (voir capture()).
  var libelleAttente = libelleSac3(fragmentsEnGourde(assimile.espece));

  var issue = ajouterAlaCollection(assimile.espece, ASSIMILATION_NIVEAU_ENTREE);
  var lignes = [];
  if (issue === "nouveau") {
    lignes.push(txt("c3.assim.nouveau", { nom: nom, niveau: ASSIMILATION_NIVEAU_ENTREE }));
    if (libelleAttente) lignes.push(txt("c3.gourde", { fragments: libelleAttente, nom: nom }));
  } else if (issue === "renforce") {
    lignes.push(txt("c3.assim.renforce", { nom: nom, niveau: ASSIMILATION_NIVEAU_ENTREE }));
  } else {
    lignes.push(txt("c3.assim.connu", { nom: nom }));
  }

  donjon.capture = true;
  if (!donjon.fictif) { rafraichirMarqueur(donjon); sauvegarder(); }
  return lignes;
}

function terminer(issue) {
  var c = etat.combat, d = etat.donjon;
  etat.phase = "fin";
  etat.issue = issue;

  // Comme distribuerXp : Fortune se lit sur l'equipe, avant tout changement.
  var fortune = equipe.indexOf("jinchan") !== -1;

  var lignes = [];
  if (issue === "victoire") lignes.push(txt("c3.victoire"));
  if (issue === "defaite") lignes.push(txt("c3.defaite"));
  if (issue !== "victoire" && !c.assimile) lignes.push(txt("c3.lieuGarde"));

  // L'assimilation est acquise, quelle que soit l'issue.
  var parts = 0;
  if (c.assimile) {
    lignes = lignes.concat(assimilerAuGrimoire(d, c.assimile));
    parts++;
  }

  // Le butin et l'XP des KO : a la victoire seulement, une fois par adversaire.
  if (issue === "victoire") {
    c.adversaires.forEach(function (u) {
      if (u.assimile) return;
      lignes = lignes.concat(lignesButin(u));
      parts++;
    });
  }
  if (parts > 0) lignes = lignes.concat(donnerXp(d, fortune, parts));

  // La sauvegarde : la meme regle que finDeCombat().
  if (d.fictif) {
    chargerJoueur();             // combat d'essai : rien n'est ecrit
  } else {
    for (var id in collection) collection[id].pv = statsAuNiveau(id, collection[id].niveau).pvMax;
    sauverJoueur();
    majFiche();
  }

  majAffichage();
  raconter(lignes, function () {
    if (!etat) return;
    etat.sortiePrete = true;
    majAffichage();
  });
}

function sortir() {
  if (!etat || etat.phase !== "fin") return;
  if (etat.minuteur) clearTimeout(etat.minuteur);
  if (etat.attente) clearTimeout(etat.attente);
  fermerAptitudes();
  elem("combat3").classList.remove("actif");
  etat = null;
  if (dernierePosition) mettreAJourHud(dernierePosition[0], dernierePosition[1]);
}


return {
  choisi: choisi,
  enCours: enCours,
  lancer: lancer,
  demarrer: demarrer,
  gainXpParAdversaire: gainXpParAdversaire,

  // Pour verifier/parcours.js seulement : lire l'etat, fixer le hasard.
  pourTests: {
    etat: function () { return etat; },
    reglerAlea: function (f) { alea = typeof f === "function" ? f : Math.random; }
  }
};

})();
