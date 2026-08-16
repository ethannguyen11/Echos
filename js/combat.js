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

/* Chance d'assimiler l'Echo, en pourcentage.
   Le joueur la lit sur le bouton avant de confirmer : c'est tout
   l'interet du systeme, il choisit son moment. Toutes les valeurs
   viennent de config.js. */
function chanceAssimilation(c) {
  var a = c.adversaire;
  var e = ESPECES[a.espece] || {};

  // Plus il est affaibli, plus il ecoute : 0 a 100 % de PV manquants
  var manquants = (1 - Math.max(0, a.pv) / a.pvMax) * 100;

  // C'est le plus avance des Echos debout qui mene l'appel
  var meilleur = 0;
  for (var i = 0; i < c.equipe.length; i++) {
    if (c.equipe[i].pv > 0 && c.equipe[i].niveau > meilleur) meilleur = c.equipe[i].niveau;
  }

  var ecart = (meilleur - a.niveau) * ASSIMILATION_POIDS_NIVEAU;
  ecart = Math.max(-ASSIMILATION_ECART_MAX, Math.min(ASSIMILATION_ECART_MAX, ecart));

  var taux = ASSIMILATION_SOCLE
           + manquants * ASSIMILATION_POIDS_PV
           + ecart
           + (c.bonusAppel || 0)                       // aptitude Appel
           + (c.bonusDefense || 0)                     // Defendre au tour precedent
           - (ASSIMILATION_MALUS_RANG[e.rang] || 0);   // plus il est rare, moins il cede

  return Math.max(ASSIMILATION_MIN, Math.min(ASSIMILATION_MAX, Math.round(taux)));
}

/* Les Gardiens de donjon et les Echos de rang X n'ecoutent personne.
   POINT D'ACCROCHE : aucune espece ne porte X aujourd'hui, et rien
   ne pose encore rang: "X" sur un lieu. Le jour ou les Gardiens
   arriveront, il n'y aura rien a changer ici. */
function assimilable(donjon) {
  if (!donjon) return false;
  if (donjon.rang === RANG_INASSIMILABLE) return false;
  var e = ESPECES[donjon.espece];
  return !!e && e.rang !== RANG_INASSIMILABLE;
}

function combattantsEquipe() {
  var liste = [];
  for (var i = 0; i < equipe.length; i++) {
    var e = collection[equipe[i]];
    if (!e) continue;
    var s = statsAuNiveau(e.espece, e.niveau);
    liste.push({
      espece: e.espece, niveau: e.niveau,
      pv: s.pvMax, pvMax: s.pvMax, atq: s.atq, def: s.def,

      // L'etat de combat de cet Echo, remis a zero a chaque rencontre
      recharges: {},      // { cleAptitude: tours restants }
      immobilise: 0,      // tours pendant lesquels il ne peut plus agir
      garde: 1,           // multiplicateur des degats qu'il subit
      gardeTours: 0
    });
  }
  return liste;
}

/* Le niveau auquel l'adversaire se bat.

   Un lieu fige renforce ce qu'il abrite : +1 niveau tous les deux
   paliers, donc de +0 a +5. C'est un niveau de COMBAT seulement :
   capture(), lui, garde toujours donjon.niveau, le niveau de base.
   Un debutant qui l'emporte ici repart avec une espece rare, pas
   avec un Echo surpuissant. */
function niveauAdversaire(donjon) {
  if (!donjon) return 1;
  var palier = palierFigement(figementDuLieu(donjon));
  var bonus = Math.floor(palier / FIGEMENT_PALIERS_PAR_NIVEAU);
  return Math.max(1, donjon.niveau + bonus);
}

// De combien l'experience est multipliee dans ce lieu : x1.00 a x1.50
function multiplicateurXp(donjon) {
  var palier = palierFigement(figementDuLieu(donjon));
  return 1 + palier * FIGEMENT_BONUS_XP_PAR_PALIER;
}

function adversaireDe(donjon, tailleEquipe) {
  var niveau = niveauAdversaire(donjon);
  var s = statsAuNiveau(donjon.espece, niveau);

  // Il se renforce a mesure que ton equipe grandit : seul contre un,
  // il reste abordable ; face a trois, il doit tenir trois attaques par tour.
  var facteurPv  = 1 + (tailleEquipe - 1) * 0.7;
  var facteurAtq = 1 + (tailleEquipe - 1) * 0.15;

  return {
    espece: donjon.espece, niveau: niveau,
    pv:    Math.round(s.pvMax * facteurPv),
    pvMax: Math.round(s.pvMax * facteurPv),
    atq:   Math.round(s.atq * facteurAtq),
    def:   s.def,

    sceau: 1,        // multiplicateur de son ATQ, pose par l'aptitude Sceau
    sceauTours: 0
  };
}


/* ------------------------------------------------------------
   LES APTITUDES

   Huit archetypes definis dans config.js, trois par espece.
   Elles se DEDUISENT de l'espece et du niveau : rien n'est jamais
   ecrit dans la sauvegarde, et normaliserCollection() n'a pas
   bouge d'une ligne.
   ------------------------------------------------------------ */

/* Les aptitudes que cette espece connait a ce niveau.
   La premiere s'ouvre au niveau 5, la deuxieme a 10, la troisieme
   a 15 (APTITUDE_NIVEAUX). En dessous de 5 : aucune. */
function aptitudesConnues(especeId, niveau) {
  var e = ESPECES[especeId];
  if (!e || !e.aptitudes) return [];

  var connues = [];
  for (var i = 0; i < e.aptitudes.length; i++) {
    if (niveau >= APTITUDE_NIVEAUX[i]) connues.push(e.aptitudes[i]);
  }
  return connues;
}

// Tours restants avant de pouvoir relancer cette aptitude.
function rechargeRestante(combattant, cle) {
  return (combattant.recharges && combattant.recharges[cle]) || 0;
}

function aptitudeDisponible(combattant, cle) {
  return combattant.pv > 0 &&
         combattant.immobilise <= 0 &&
         rechargeRestante(combattant, cle) === 0;
}

/* Ce qu'une aptitude fait au moment ou on l'emploie.
   Elle rend les lignes a ecrire dans le journal. Les degats
   passent toujours par degats() puis degatsAjustes() : la formule
   de base n'est jamais recalculee ici. */
function employerAptitude(combattant, cle, palier) {
  var a = APTITUDES[cle];
  var nom = ESPECES[combattant.espece].nom;
  var adv = combat.adversaire;
  var lignes = [];

  combattant.recharges[cle] = APTITUDE_RECHARGE;

  // --- Les aptitudes qui ne frappent pas ---

  if (a.soin) {
    var rendu = Math.max(1, Math.round(combattant.pvMax * a.soin));
    combattant.pv = Math.min(combattant.pvMax, combattant.pv + rendu);
    lignes.push(nom + " emploie <b>" + a.nom + "</b> : +" + rendu + " PV.");
    return lignes;
  }

  if (a.garde) {
    combattant.garde = a.garde;
    combattant.gardeTours = a.tours;
    lignes.push(nom + " emploie <b>" + a.nom + "</b> : il encaisse beaucoup moins.");
    return lignes;
  }

  if (a.affaiblit) {
    adv.sceau = a.affaiblit;
    adv.sceauTours = a.tours;
    lignes.push(nom + " emploie <b>" + a.nom + "</b> : l'adversaire frappe moins fort.");
    return lignes;
  }

  if (a.bonusAssimilation) {
    combat.bonusAppel += a.bonusAssimilation;
    lignes.push(nom + " emploie <b>" + a.nom + "</b> : l'adversaire tend l'oreille.");
    return lignes;
  }

  // --- Les aptitudes qui frappent ---

  var multi = a.multi;
  if (a.multiAvantage &&
      multiplicateurAffinite(combattant.espece, adv.espece) > AFFINITE_NEUTRE) {
    multi = a.multiAvantage;
  }

  var defense = a.ignoreDef ? 0 : adv.def;
  var coups = a.coups || 1;
  var total = 0;

  for (var i = 0; i < coups && adv.pv > 0; i++) {
    var brut = degats(combattant.atq, defense, Math.random());
    var d = degatsAjustes(Math.round(brut * multi), combattant.espece, adv.espece, palier);
    adv.pv -= d;
    total += d;
  }

  if (a.immobilise) combattant.immobilise = a.immobilise + 1;   // +1 : le tour en cours ne compte pas

  lignes.push(nom + " emploie <b>" + a.nom + "</b> : " + total +
              (coups > 1 ? " en " + coups + " coups" : "") +
              mentionAffinite(combattant.espece, adv.espece));
  return lignes;
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

/* Les deux interrupteurs du Figement.

   Tout le code qui suit reste en place et continue de fonctionner ;
   ces deux fonctions decident seulement s'il pese sur le combat et
   s'il se voit. Elles sont le seul endroit a consulter pour savoir
   pourquoi la mecanique est muette. */

// Le Figement ne pese sur les degats que si le compteur avance.
function figementActif() { return VITESSE_FIGEMENT > 0; }

// La barre et les fleches ne s'affichent que si la mecanique tourne
// ET qu'on a demande a la voir.
function figementVisible() { return AFFICHER_BARRE_FIGEMENT && figementActif(); }


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
  if (!figementActif()) return 1;      // mecanique en sommeil : aucun effet

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
  if (!figementVisible()) return "";   // mecanique en sommeil : aucune fleche

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
  // En sommeil, le bloc entier reste hors de l'ecran de combat.
  elem("figement-bloc").classList[figementVisible() ? "add" : "remove"]("visible");
  if (!figementVisible()) return;

  elem("f-jauge").style.width = Math.round(valeur / FIGEMENT_MAX * 100) + "%";

  if (experienceDuGardien() >= SEUIL_LECTURE_FIGEMENT) {
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

  // Le taux d'Assimilation se lit sur le bouton, nulle part ailleurs.
  majBoutonAssimiler();

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

/* A la fin du combat, les quatre boutons sont remplaces par un seul :
   d'ou les gardes. elem() rend null si le bouton n'est plus la. */
function boutonsActifs(a) {
  function regler(id, actif) {
    var b = elem(id);
    if (b) b.disabled = !actif;
  }

  regler("btn-attaquer", a);
  regler("btn-defendre", a);
  regler("btn-fuir", a);

  // Ces deux-la ont leurs propres raisons d'etre grises
  regler("btn-aptitude", a && aptitudesJouables().length > 0);
  regler("btn-assimiler", a && assimilable(combat.donjon));
}

/* Le taux d'Assimilation, sur le bouton, avant confirmation.
   Un Echo qui n'ecoutera jamais le dit franchement. */
function majBoutonAssimiler() {
  var b = elem("btn-assimiler");
  if (!b) return;

  if (!assimilable(combat.donjon)) {
    b.textContent = "Il ne t'écoutera pas.";
    return;
  }
  b.textContent = "Assimiler " + chanceAssimilation(combat) + " %";
}

/* Toutes les aptitudes que l'equipe peut employer maintenant :
   celles de TOUS les Echos debout, pas seulement du premier.
   Rend une liste plate de { indice, cle, pret, restant }. */
function aptitudesJouables() {
  var liste = [];
  if (!combat) return liste;

  for (var i = 0; i < combat.equipe.length; i++) {
    var c = combat.equipe[i];
    if (c.pv <= 0) continue;

    var connues = aptitudesConnues(c.espece, c.niveau);
    for (var j = 0; j < connues.length; j++) {
      liste.push({
        indice: i, cle: connues[j],
        pret: aptitudeDisponible(c, connues[j]),
        restant: rechargeRestante(c, connues[j])
      });
    }
  }
  return liste;
}

/* Le menu d'aptitudes : une ligne par aptitude, groupee par Echo.
   Une aptitude en recharge reste visible, mais grisee et chiffree :
   le joueur doit voir combien de tours il lui reste a attendre. */
function ouvrirAptitudes() {
  var liste = aptitudesJouables();
  var html = "";
  var dernierIndice = -1;

  for (var i = 0; i < liste.length; i++) {
    var it = liste[i];
    var c = combat.equipe[it.indice];
    var a = APTITUDES[it.cle];

    if (it.indice !== dernierIndice) {
      dernierIndice = it.indice;
      html += '<div class="apt-echo">' + ESPECES[c.espece].nom +
              (c.immobilise > 0 ? " <span class=\"apt-attente\">immobilisé</span>" : "") +
              '</div>';
    }

    html += '<button class="apt-ligne" data-indice="' + it.indice +
            '" data-cle="' + it.cle + '"' + (it.pret ? "" : " disabled") + '>' +
            '<span class="apt-nom">' + a.nom +
            (it.pret ? "" : ' <span class="apt-attente">' +
              (it.restant > 0 ? it.restant + " tour" + (it.restant > 1 ? "s" : "") : "indisponible") +
              '</span>') +
            '</span>' +
            '<span class="apt-texte">' + a.texte + '</span>' +
            '</button>';
  }

  if (!html) html = '<div class="apt-echo">Aucune aptitude connue</div>';

  elem("liste-aptitudes").innerHTML = html;

  var boutons = document.querySelectorAll(".apt-ligne");
  for (var k = 0; k < boutons.length; k++) {
    boutons[k].addEventListener("click", function () {
      if (this.disabled) return;
      actionAptitude(Number(this.getAttribute("data-indice")), this.getAttribute("data-cle"));
    });
  }

  elem("aptitudes").classList.add("actif");
}

function fermerAptitudes() {
  elem("aptitudes").classList.remove("actif");
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
    figement: figementDuLieu(donjon),  // 0 a 100, en sommeil par defaut

    bonusAppel: 0,          // cumule par l'aptitude Appel, jusqu'a la fin
    bonusDefense: 0,        // ouvert par Defendre, le temps d'un tour
    defenseEnAttente: false
  };

  var e = ESPECES[donjon.espece];

  elem("combat-lieu").textContent = donjon.nom.toUpperCase();

  // Le niveau annonce est celui auquel il se bat, renfort du lieu compris.
  elem("m-nom").textContent = e.nom + " (niv. " + combat.adversaire.niveau + ")";

  var img = elem("monstre-img"), vide = elem("monstre-vide");
  img.style.display = "none";
  vide.style.display = "flex";
  img.onload = function () { img.style.display = "block"; vide.style.display = "none"; };
  img.onerror = function () { img.style.display = "none"; vide.style.display = "flex"; };
  img.src = DOSSIER_MONSTRES + e.img + ".png";

  // Les quatre commandes, toujours les memes, toujours au meme endroit.
  elem("combat-actions").innerHTML =
    '<button id="btn-attaquer">Attaquer</button>' +
    '<button id="btn-aptitude">Aptitude</button>' +
    '<button id="btn-assimiler" class="assimilation">Assimiler</button>' +
    '<button id="btn-defendre">Défendre</button>' +
    '<button id="btn-fuir" class="discret">Fuir</button>';
  fermerAptitudes();
  brancherBoutonsCombat();

  majAffichageCombat();
  boutonsActifs(true);

  message("<b>" + e.nom + "</b>, " + e.titre + ", se manifeste." +
          (preemptif ? "<br><span style='color:#b455d4'>Tu l'as surpris : il perd son premier tour.</span>" : ""));

  elem("combat").classList.add("actif");
}

/* Un combat d'essai ne doit laisser aucune trace sur le disque :
   ni le donjon fictif, ni l'Echo capture, ni l'experience gagnee.
   Les trois points de sauvegarde consultent cette fonction. */
function estCombatFictif() {
  return !!(combat && combat.donjon && combat.donjon.fictif);
}

function equipeDebout() {
  for (var i = 0; i < combat.equipe.length; i++) if (combat.equipe[i].pv > 0) return true;
  return false;
}

/* Le tour de l'equipe.

   Les trois Echos agissent, comme avant. La seule nouveaute : l'un
   d'eux peut employer une aptitude AU LIEU de son attaque de base.
   Les deux autres frappent normalement. C'est pour ca que le menu
   d'aptitudes liste tous les Echos debout et pas seulement le
   premier : sinon les Echos 2 et 3 n'en emploieraient jamais.

   choix vaut null (tout le monde attaque) ou { indice, cle }. */
function tourEquipe(choix) {
  boutonsActifs(false);

  var lignes = [];
  var palier = palierFigement(combat.figement);

  for (var i = 0; i < combat.equipe.length; i++) {
    var c = combat.equipe[i];
    if (c.pv <= 0) continue;

    if (c.immobilise > 0) {
      lignes.push(ESPECES[c.espece].nom + " reprend son souffle.");
      continue;
    }

    if (choix && choix.indice === i) {
      lignes = lignes.concat(employerAptitude(c, choix.cle, palier));
    } else {
      // degats() reste la formule d'origine ; les multiplicateurs
      // viennent apres, dans degatsAjustes().
      var brut = degats(c.atq, combat.adversaire.def, Math.random());
      var d = degatsAjustes(brut, c.espece, combat.adversaire.espece, palier);

      combat.adversaire.pv -= d;
      lignes.push(ESPECES[c.espece].nom + " frappe : " + d +
                  mentionAffinite(c.espece, combat.adversaire.espece));
    }

    if (combat.adversaire.pv <= 0) break;
  }

  elem("scene").classList.add("secoue");
  setTimeout(function () { elem("scene").classList.remove("secoue"); }, 300);

  message(lignes.join("<br>"));
  majAffichageCombat();

  if (combat.adversaire.pv <= 0) { setTimeout(dissipation, 800); return; }
  setTimeout(tourAdverse, 900);
}

function actionAttaquer() { tourEquipe(null); }

/* Le menu grise deja ce qui n'est pas jouable, mais on revalide ici :
   c'est le seul point d'entree, et une aptitude employee par erreur
   partirait en recharge pour rien. */
function actionAptitude(indice, cle) {
  var c = combat && combat.equipe[indice];
  if (!c) return;
  if (aptitudesConnues(c.espece, c.niveau).indexOf(cle) === -1) return;
  if (!aptitudeDisponible(c, cle)) return;

  fermerAptitudes();
  tourEquipe({ indice: indice, cle: cle });
}

/* Defendre : toute l'equipe se couvre ce tour-ci, et l'adversaire
   se laisse un peu plus approcher au tour suivant. */
function actionDefendre() {
  boutonsActifs(false);

  for (var i = 0; i < combat.equipe.length; i++) {
    var c = combat.equipe[i];
    if (c.pv <= 0) continue;
    c.garde = DEFENDRE_REDUCTION;
    c.gardeTours = 1;
  }

  combat.defenseEnAttente = true;   // le bonus s'ouvre a la fin du tour

  message("Ton équipe se met en garde.");
  majAffichageCombat();
  setTimeout(tourAdverse, 900);
}

function actionAssimiler() {
  if (!assimilable(combat.donjon)) return;
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

/* Fuir est la cinquieme commande, en dessous des quatre autres et
   volontairement plus discrete : elle doit rester trouvable sans
   attirer l'oeil. Pas d'appui long, c'est indecouvrable sur mobile. */
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

  // Le Sceau reduit son ATQ avant le calcul ; la formule elle-meme
  // ne change pas, elle recoit seulement une ATQ diminuee.
  var atq = Math.round(combat.adversaire.atq * combat.adversaire.sceau);

  var brut = degats(atq, cible.def, Math.random());
  var d = degatsAjustes(brut, combat.adversaire.espece, cible.espece,
                        palierFigement(combat.figement));

  // Rempart et Defendre s'appliquent en dernier, sur ce qui arrive.
  d = Math.max(1, Math.round(d * cible.garde));

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

/* Le tour est termine : les compteurs descendent d'un cran, le lieu
   se fige (s'il est actif), l'affichage suit, et la main revient au
   joueur. C'est le seul endroit ou le temps passe. */
function finDeTour() {
  for (var i = 0; i < combat.equipe.length; i++) {
    var c = combat.equipe[i];

    for (var cle in c.recharges) {
      if (c.recharges[cle] > 0) c.recharges[cle]--;
    }

    if (c.immobilise > 0) c.immobilise--;

    if (c.gardeTours > 0) {
      c.gardeTours--;
      if (c.gardeTours === 0) c.garde = 1;
    }
  }

  var adv = combat.adversaire;
  if (adv.sceauTours > 0) {
    adv.sceauTours--;
    if (adv.sceauTours === 0) adv.sceau = 1;
  }

  // Le bonus de Defendre ne s'ouvre qu'au tour suivant, puis retombe.
  combat.bonusDefense = combat.defenseEnAttente ? DEFENDRE_BONUS_ASSIMILATION : 0;
  combat.defenseEnAttente = false;

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

  // Un lieu fige rend davantage : c'est ce qui rend le risque payant.
  gain = Math.round(gain * multiplicateurXp(combat.donjon));

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
  if (!estCombatFictif()) { rafraichirMarqueur(d); sauvegarder(); }

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
  if (!estCombatFictif()) { rafraichirMarqueur(combat.donjon); sauvegarder(); }

  message(txt);
  finDeCombat();
}

function defaite() {
  message("Tes échos sont épuisés.<br>Tu recules. Le lieu garde le sien.");
  finDeCombat();
}

function finDeCombat() {
  combat.fini = true;

  if (estCombatFictif()) {
    /* Combat d'essai : au lieu d'enregistrer, on relit la sauvegarde
       reelle. L'Echo eventuellement capture et l'experience gagnee
       pendant l'essai disparaissent, la vraie partie est intacte. */
    chargerJoueur();
  } else {
    // Les Echos se remettent entre deux rencontres
    for (var id in collection) {
      collection[id].pv = statsAuNiveau(id, collection[id].niveau).pvMax;
    }

    sauverJoueur();
    majFiche();
  }

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
  elem("btn-aptitude").addEventListener("click", ouvrirAptitudes);
  elem("btn-assimiler").addEventListener("click", actionAssimiler);
  elem("btn-defendre").addEventListener("click", actionDefendre);
  elem("btn-fuir").addEventListener("click", actionFuir);
  elem("btn-fermer-aptitudes").addEventListener("click", fermerAptitudes);
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
              "   |   chiffre exact affiche a partir de " + SEUIL_LECTURE_FIGEMENT +
              " especes assimilees");
}

// La premiere espece du bestiaire qui porte cette nature.
function especeDeNature(nature) {
  for (var id in ESPECES) if (ESPECES[id].nature === nature) return id;
  return null;
}

// La premiere espece du bestiaire qui porte ce rang.
function especeDeRang(rang) {
  for (var id in ESPECES) if (ESPECES[id].rang === rang) return id;
  return null;
}

/* Combat.testerAssimilation()
   Le taux obtenu pour quelques cas types : la cible a pleine vie,
   a moitie, a 10 % de PV, croisee avec les cinq rangs. */
function testerAssimilation(niveauEquipe, niveauCible) {
  var nivEquipe = niveauEquipe || 10;
  var nivCible  = niveauCible  || 10;
  var rangs = ["D", "C", "B", "A", "S"];
  var etats = [["pleine vie", 1], ["a moitie", 0.5], ["a 10 % de PV", 0.1]];

  function colonne(t, largeur) {
    t = String(t);
    while (t.length < largeur) t += " ";
    return t;
  }

  // On passe par la vraie fonction du jeu, pas par une formule recopiee.
  function taux(rang, part, bonusAppel, bonusDefense) {
    return chanceAssimilation({
      adversaire: { espece: especeDeRang(rang), niveau: nivCible,
                    pv: Math.round(100 * part), pvMax: 100 },
      equipe: [{ niveau: nivEquipe, pv: 1 }],
      bonusAppel: bonusAppel || 0,
      bonusDefense: bonusDefense || 0
    });
  }

  console.log("ASSIMILATION — taux en %, equipe niveau " + nivEquipe +
              " contre une cible niveau " + nivCible);
  console.log("");
  console.log(colonne("cible", 16) + rangs.map(function (r) {
    return colonne("rang " + r, 9);
  }).join(""));

  etats.forEach(function (e) {
    console.log(colonne(e[0], 16) + rangs.map(function (r) {
      return colonne(taux(r, e[1]), 9);
    }).join(""));
  });

  console.log("");
  console.log("Effet des bonus, sur une cible de rang B a moitie vie :");
  console.log("  seul                 " + taux("B", 0.5));
  console.log("  apres Appel (+20)    " + taux("B", 0.5, APTITUDES.appel.bonusAssimilation, 0));
  console.log("  apres Defendre (+10) " + taux("B", 0.5, 0, DEFENDRE_BONUS_ASSIMILATION));
  console.log("  les deux             " + taux("B", 0.5, APTITUDES.appel.bonusAssimilation,
                                               DEFENDRE_BONUS_ASSIMILATION));
  console.log("");
  console.log("Bornes : jamais moins de " + ASSIMILATION_MIN +
              " %, jamais plus de " + ASSIMILATION_MAX + " %.");
}

/* Le seul global que ce fichier expose. Le reste du jeu continue
   d'appeler les fonctions directement, rien n'a change pour lui. */
window.Combat = {
  testerFigement: testerFigement,
  testerAssimilation: testerAssimilation,
  figementDuLieu: figementDuLieu,
  aptitudesConnues: aptitudesConnues,
  chanceAssimilation: chanceAssimilation,
  assimilable: assimilable,
  palierFigement: palierFigement,
  multiplicateurFigement: multiplicateurFigement,
  multiplicateurAffinite: multiplicateurAffinite,
  degatsAjustes: degatsAjustes
};
