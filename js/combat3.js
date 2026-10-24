/* ============================================================
   LE COMBAT A PLUSIEURS (LE MOTEUR DE REGLES)

   Jusqu'a 3 Echos contre 1 a 3 adversaires, au tour par tour :
   chaque monstre joue a son tour, du plus rapide au plus lent.
   Ce fichier ne contient QUE les regles : ni DOM, ni affichage,
   ni sauvegarde, ni Math.random(), ni Date.now(). Le hasard est
   un generateur passe par l'appelant (alea : une fonction qui rend
   un nombre dans [0, 1[), pour que les tests rejouent tout a
   l'identique.

   AUCUN ECRAN NE S'EN SERT ENCORE. Le combat 1 contre 1 de
   js/combat.js est intact et reste celui du jeu. Ce fichier se
   charge apres lui et reutilise ses regles sans les recopier :
     degats(), degatsAjustes(), multiplicateurAffinite(),
     aptitudesConnues(), assimilable(), chanceAssimilation()
   plus statsAuNiveau() (js/especes.js). Seul l'EFFET des
   aptitudes est reecrit (cmAppliquerAptitude) : employerAptitude()
   de js/combat.js vise forcement l'adversaire unique du combat
   global et tire son propre hasard.

   LA CONVENTION
     - Les fonctions de regles (boostSauvage, vitesseAuNiveau,
       ordreDesTours, acteurCourant, ciblesValides, actionAdverse,
       issueCombatMulti) rendent une valeur et ne mutent rien.
     - jouerActionMulti() MUTE le combat, en tout ou rien : tout
       est verifie d'abord, et un refus ne touche a rien. Elle rend
       { ok: true, evenements: [...], issue } ou { ok: false, refus }.
     - Les codes de refus sont stables (l'ecran s'en servira) :
         equipe_invalide, adversaires_invalides  (creation)
         combat_fini, alea_invalide, action_inconnue,
         action_interdite, cible_invalide, aptitude_inconnue,
         aptitude_en_recharge, deja_assimile, inassimilable
     - Les evenements sont des DONNEES (qui, quoi, combien), pas des
       phrases : le texte viendra avec l'ecran.

   LE DEROULEMENT
     - Un "tour de table" : chaque monstre encore en jeu agit une
       fois. L'ordre est recalcule au debut de chacun (ordreDesTours).
     - Egalite de vitesse : ton camp d'abord, puis l'ordre des
       places (1, 2, 3). Deterministe, sans hasard.
     - Un monstre a 0 PV est KO, un adversaire assimile s'en va :
       les deux sortent de l'ordre aussitot, meme en plein tour.
     - Un monstre immobilise (Frappe lourde) perd son tour suivant :
       le moteur le saute tout seul (evenement "repos").
     - Fin d'un tour de table : recharges, Rempart et Sceau
       descendent d'un cran, et le bonus de Defendre s'ouvre pour
       le tour suivant (comme finDeTour() dans js/combat.js).
     - Victoire : tous les adversaires KO ou assimiles. Defaite :
       tous tes Echos KO. Fuite : reussie, elle termine le combat.

   POINTS D'ACCROCHE FUTURS (rien de tout ca n'est fait ici)
     1. L'ASSIMILATION. Le moteur n'ecrit pas dans la collection :
        son compte rendu donne { espece, niveau } avec
        niveau = ASSIMILATION_NIVEAU_ENTREE (1). L'ecran appellera
          ajouterAlaCollection(espece, ASSIMILATION_NIVEAU_ENTREE)
        ce qui CHANGERA le comportement actuel : js/combat.js
        ajoute l'Echo au niveau de base du lieu (donjon.niveau).
        Decision a confirmer au prompt de l'affichage.
     2. LA SAUVEGARDE. C'est l'ecran qui devra sauver apres le
        combat (sauverJoueur, et le donjon s'il est assimile),
        comme finDeCombat() le fait aujourd'hui, en respectant le
        combat d'essai (estCombatFictif). L'experience et le butin
        ne sont pas calcules ici non plus.
     3. LE GATE BREAK. options.malusGateBreak (en niveaux, 0 par
        defaut) est recopie dans le combat a sa creation et ajoute
        au niveau de combat de chaque adversaire : il est FIGE, comme
        le demande l'en-tete de js/poche.js. Personne n'appelle
        encore malusGateBreak() : l'appelant passera la valeur.
     4. IDEE NON IMPLEMENTEE : un rattrapage d'experience pour les
        Echos de bas niveau (un Echo assimile arrive au niveau 1,
        loin derriere le reste de l'equipe).
   ============================================================ */


/* ------------------------------------------------------------
   1. LES REGLES PURES
   ------------------------------------------------------------ */

// Les multiplicateurs pleins (contre 3 Echos), ou null.
function boostSauvage(nbAdversaires) {
  return Object.prototype.hasOwnProperty.call(BOOST_SAUVAGE, nbAdversaires)
    ? BOOST_SAUVAGE[nbAdversaires] : null;
}

/* Le boost reellement applique : module par le nombre de tes Echos
   debout. 1 + (boost - 1) x (debout / EQUIPE_MAX). Voir config.js. */
function boostEffectif(nbAdversaires, nbEchosDebout) {
  var b = boostSauvage(nbAdversaires);
  if (!b) return { pv: 1, atq: 1 };
  var part = Math.max(0, Math.min(EQUIPE_MAX, nbEchosDebout)) / EQUIPE_MAX;
  // L'arrondi evite les 1.4000000000000001 dans les tests et les PV.
  return {
    pv:  Math.round((1 + (b.pv - 1) * part) * 10000) / 10000,
    atq: Math.round((1 + (b.atq - 1) * part) * 10000) / 10000
  };
}

function vitesseAuNiveau(especeId, niveau) {
  var e = ESPECES[especeId];
  var base = (e && e.vit) || 0;
  return Math.round(base * (1 + (niveau - 1) * VITESSE_CROISSANCE) * 100) / 100;
}

function cmEnJeu(u) { return u.pv > 0 && !u.assimile; }

function cmTous(combat) { return combat.equipe.concat(combat.adversaires); }

function cmTrouver(combat, id) {
  var tous = cmTous(combat);
  for (var i = 0; i < tous.length; i++) if (tous[i].id === id) return tous[i];
  return null;
}

/* L'ordre du tour de table : les monstres encore en jeu, du plus
   rapide au plus lent. Egalite : ton camp d'abord, puis la place. */
function ordreDesTours(combat) {
  return cmTous(combat).filter(cmEnJeu).sort(function (a, b) {
    if (a.vit !== b.vit) return b.vit - a.vit;
    if (a.camp !== b.camp) return a.camp === "joueur" ? -1 : 1;
    return a.place - b.place;
  });
}

/* A qui c'est le tour : le premier de l'ordre qui n'a pas encore
   agi dans ce tour de table. Au premier tour d'un combat
   preemptif, les adversaires sont sautes. null si le combat est
   fini. */
function acteurCourant(combat) {
  if (issueCombatMulti(combat)) return null;
  var ordre = ordreDesTours(combat);
  for (var i = 0; i < ordre.length; i++) {
    var u = ordre[i];
    if (combat.ontJoue.indexOf(u.id) !== -1) continue;
    if (combat.preemptif && combat.tour === 1 && u.camp === "adverse") continue;
    return u;
  }
  return null;
}

// "fuite", "victoire", "defaite" ou null tant que ca continue.
function issueCombatMulti(combat) {
  if (combat.fuite) return "fuite";
  if (!combat.adversaires.some(cmEnJeu)) return "victoire";
  if (!combat.equipe.some(function (u) { return u.pv > 0; })) return "defaite";
  return null;
}

/* Les identifiants des cibles possibles pour ce type d'action.
   Attaque, aptitude offensive, Sceau et Assimiler visent un
   adversaire en jeu du camp d'en face. */
function ciblesValides(combat, acteur, type) {
  if (!acteur) return [];
  if (type !== "attaque" && type !== "aptitude" && type !== "assimiler") return [];
  var enFace = acteur.camp === "joueur" ? combat.adversaires : combat.equipe;
  return enFace.filter(cmEnJeu).map(function (u) { return u.id; });
}

/* Ce que fait l'adversaire dont c'est le tour : il frappe un de tes
   Echos debout, tire au hasard avec alea. Ne mute rien ; rend null
   si ce n'est pas le tour d'un adversaire. */
function actionAdverse(combat, alea) {
  var a = acteurCourant(combat);
  if (!a || a.camp !== "adverse" || typeof alea !== "function") return null;
  var debout = combat.equipe.filter(cmEnJeu);
  if (debout.length === 0) return null;
  var i = Math.min(debout.length - 1, Math.floor(alea() * debout.length));
  return { type: "attaque", cible: debout[i].id };
}


/* ------------------------------------------------------------
   2. LA CREATION
   ------------------------------------------------------------ */

function cmUnite(camp, place, espece, niveau, s, vit) {
  return {
    id: (camp === "joueur" ? "j" : "a") + place,
    camp: camp, place: place,
    espece: espece, niveau: niveau,
    pv: s.pvMax, pvMax: s.pvMax, atq: s.atq, def: s.def, vit: vit,

    recharges: {},     // { cleAptitude: tours restants }
    immobilise: 0,     // tours a sauter (les siens)
    garde: 1,          // Rempart : multiplicateur des degats subis
    gardeTours: 0,
    enDefense: false,  // Defendre : jusqu'a son prochain tour
    sceau: 1,          // Sceau : multiplicateur de son ATQ
    sceauTours: 0,
    assimile: false
  };
}

function cmDescripteurValide(d) {
  return !!d && Object.prototype.hasOwnProperty.call(ESPECES, d.espece) &&
         isFinite(d.niveau) && d.niveau >= 1;
}

/* monEquipe   : [{ espece, niveau }], 1 a EQUIPE_MAX (les entrees de
                 la collection conviennent : elles sont recopiees,
                 jamais modifiees).
   adversaires : [{ espece, niveau, rang?, sauvage? }], 1 a
                 ADVERSAIRES_MAX. niveau = celui que donne
                 niveauAdversaire(donjon) ; sauvage vaut true par
                 defaut.
   options     : { preemptif, malusGateBreak, palier } */
function creerCombatMulti(monEquipe, adversaires, options) {
  options = options || {};

  if (!monEquipe || !(monEquipe.length >= 1 && monEquipe.length <= EQUIPE_MAX) ||
      !monEquipe.every(cmDescripteurValide)) {
    return { ok: false, refus: "equipe_invalide" };
  }
  if (!adversaires || !(adversaires.length >= 1 && adversaires.length <= ADVERSAIRES_MAX) ||
      !adversaires.every(cmDescripteurValide)) {
    return { ok: false, refus: "adversaires_invalides" };
  }

  var malus = Number(options.malusGateBreak);
  malus = isFinite(malus) && malus > 0 ? Math.round(malus) : 0;

  var palier = Number(options.palier);
  palier = isFinite(palier) ? Math.max(0, Math.min(FIGEMENT_PALIER_MAX, Math.round(palier))) : 0;

  var equipeC = monEquipe.map(function (d, i) {
    var n = Math.round(d.niveau);
    return cmUnite("joueur", i, d.espece, n, statsAuNiveau(d.espece, n), vitesseAuNiveau(d.espece, n));
  });

  // Tous tes Echos sont debout au depart : le boost est fige ici.
  var boost = boostEffectif(adversaires.length, equipeC.length);

  var adversairesC = adversaires.map(function (d, i) {
    var n = Math.max(1, Math.round(d.niveau) + malus);
    var s = statsAuNiveau(d.espece, n);
    var u = cmUnite("adverse", i, d.espece, n, s, vitesseAuNiveau(d.espece, n));
    u.sauvage = d.sauvage !== false;
    u.rang = d.rang || null;
    if (u.sauvage) {
      u.pv = u.pvMax = Math.round(s.pvMax * boost.pv);
      u.atq = Math.round(s.atq * boost.atq);
    }
    return u;
  });

  return {
    ok: true,
    combat: {
      equipe: equipeC,
      adversaires: adversairesC,
      tour: 1,                 // le numero du tour de table
      ontJoue: [],             // les id qui ont deja agi dans ce tour
      preemptif: !!options.preemptif,
      malusGateBreak: malus,   // fige : ne bouge plus jusqu'a la fin
      palier: palier,
      boost: boost,
      bonusAppel: 0,
      bonusDefense: 0,
      defenseEnAttente: false,
      tentatives: 0,
      assimile: null,          // { id, espece, niveau } : un seul par combat
      fuite: false
    }
  };
}


/* ------------------------------------------------------------
   3. JOUER UNE ACTION
   ------------------------------------------------------------ */

// Rempart et Defendre ne se cumulent pas : le plus protecteur gagne.
function cmGarde(u) {
  return Math.min(u.garde, u.enDefense ? DEFENDRE_REDUCTION : 1);
}

// Un coup : degats() puis degatsAjustes() (js/combat.js), puis la garde.
function cmCoup(combat, acteur, cible, multi, defense, alea) {
  var brut = degats(Math.round(acteur.atq * acteur.sceau), defense, alea());
  var d = degatsAjustes(Math.round(brut * multi), acteur.espece, cible.espece, combat.palier);
  d = Math.max(1, Math.round(d * cmGarde(cible)));
  cible.pv = Math.max(0, cible.pv - d);
  return d;
}

function cmNoterKo(cible, evenements) {
  if (cible.pv <= 0) evenements.push({ type: "ko", cible: cible.id });
}

/* Ce qu'une aptitude demande comme cible : "adverse" (un adversaire
   precis) ou "aucune" (elle agit sur soi ou sur tout le combat). */
function cmCibleAptitude(a) {
  return (a.soin || a.garde || a.bonusAssimilation) ? "aucune" : "adverse";
}

function cmAppliquerAptitude(combat, acteur, cle, cible, alea, evenements) {
  var a = APTITUDES[cle];
  var ev = { type: "aptitude", acteur: acteur.id, cle: cle };
  acteur.recharges[cle] = APTITUDE_RECHARGE;

  if (a.soin) {
    var rendu = Math.max(1, Math.round(acteur.pvMax * a.soin));
    acteur.pv = Math.min(acteur.pvMax, acteur.pv + rendu);
    ev.soin = rendu;
  } else if (a.garde) {
    acteur.garde = a.garde;
    acteur.gardeTours = a.tours;
  } else if (a.bonusAssimilation) {
    combat.bonusAppel += a.bonusAssimilation;
    ev.bonusAssimilation = a.bonusAssimilation;
  } else if (a.affaiblit) {
    cible.sceau = a.affaiblit;
    cible.sceauTours = a.tours;
    ev.cible = cible.id;
  } else {
    var multi = a.multi;
    if (a.multiAvantage && multiplicateurAffinite(acteur.espece, cible.espece) > AFFINITE_NEUTRE) {
      multi = a.multiAvantage;
    }
    var defense = a.ignoreDef ? 0 : cible.def;
    var coups = a.coups || 1, total = 0;
    for (var i = 0; i < coups && cible.pv > 0; i++) total += cmCoup(combat, acteur, cible, multi, defense, alea);
    if (a.immobilise) acteur.immobilise = a.immobilise;
    ev.cible = cible.id;
    ev.degats = total;
    ev.affinite = multiplicateurAffinite(acteur.espece, cible.espece);
  }

  evenements.push(ev);
  if (cible) cmNoterKo(cible, evenements);
}

/* Tout ce qui peut faire refuser l'action, SANS RIEN TOUCHER.
   Rend un code de refus, ou null si l'action est jouable. */
function cmRefus(combat, acteur, action) {
  if (!action || typeof action.type !== "string") return "action_inconnue";
  var t = action.type;
  if (["attaque", "aptitude", "assimiler", "defendre", "fuir"].indexOf(t) === -1) return "action_inconnue";

  // Un adversaire ne fait qu'attaquer.
  if (acteur.camp === "adverse" && t !== "attaque") return "action_interdite";

  var cible = action.cible !== undefined ? cmTrouver(combat, action.cible) : null;
  var cibleOk = !!cible && ciblesValides(combat, acteur, t === "defendre" || t === "fuir" ? "" : t)
                             .indexOf(cible.id) !== -1;

  if (t === "attaque") return cibleOk ? null : "cible_invalide";

  if (t === "aptitude") {
    if (!Object.prototype.hasOwnProperty.call(APTITUDES, action.cle) ||
        aptitudesConnues(acteur.espece, acteur.niveau).indexOf(action.cle) === -1) return "aptitude_inconnue";
    if (rechargeRestante(acteur, action.cle) > 0) return "aptitude_en_recharge";
    if (cmCibleAptitude(APTITUDES[action.cle]) === "adverse" && !cibleOk) return "cible_invalide";
    return null;
  }

  if (t === "assimiler") {
    if (!cibleOk) return "cible_invalide";
    if (combat.assimile) return "deja_assimile";
    if (!assimilable({ espece: cible.espece, rang: cible.rang })) return "inassimilable";
    return null;
  }

  return null;   // defendre, fuir
}

/* La fin d'un tour de table : comme finDeTour() dans js/combat.js. */
function cmFinTourDeTable(combat, evenements) {
  cmTous(combat).forEach(function (u) {
    for (var cle in u.recharges) if (u.recharges[cle] > 0) u.recharges[cle]--;
    if (u.gardeTours > 0) { u.gardeTours--; if (u.gardeTours === 0) u.garde = 1; }
    if (u.sceauTours > 0) { u.sceauTours--; if (u.sceauTours === 0) u.sceau = 1; }
  });
  combat.bonusDefense = combat.defenseEnAttente ? DEFENDRE_BONUS_ASSIMILATION : 0;
  combat.defenseEnAttente = false;
  evenements.push({ type: "finTour", tour: combat.tour });
  combat.tour++;
  combat.ontJoue = [];
}

/* Apres une action : on avance jusqu'au prochain monstre qui peut
   VRAIMENT agir. Les immobilises perdent leur tour au passage, et
   les tours de table se bouclent. */
function cmAvancer(combat, evenements) {
  for (var garde = 0; garde < 50; garde++) {
    if (issueCombatMulti(combat)) return;
    var u = acteurCourant(combat);
    if (!u) { cmFinTourDeTable(combat, evenements); continue; }
    if (u.immobilise <= 0) return;
    u.immobilise--;
    u.enDefense = false;
    combat.ontJoue.push(u.id);
    evenements.push({ type: "repos", acteur: u.id });
  }
}

/* Joue l'action du monstre dont c'est le tour (acteurCourant).
   action : { type: "attaque", cible }
            { type: "aptitude", cle, cible? }
            { type: "assimiler", cible }
            { type: "defendre" }  { type: "fuir" }
   alea   : le generateur de hasard, fourni par l'appelant. */
function jouerActionMulti(combat, action, alea) {
  if (issueCombatMulti(combat)) return { ok: false, refus: "combat_fini" };
  if (typeof alea !== "function") return { ok: false, refus: "alea_invalide" };

  var acteur = acteurCourant(combat);
  if (!acteur) return { ok: false, refus: "combat_fini" };

  var refus = cmRefus(combat, acteur, action);
  if (refus) return { ok: false, refus: refus };

  // --- A partir d'ici, plus aucun refus : on mute. ---
  var evenements = [];
  var cible = action.cible !== undefined ? cmTrouver(combat, action.cible) : null;

  acteur.enDefense = false;     // sa garde de Defendre tombe : c'est son tour

  if (action.type === "attaque") {
    var d = cmCoup(combat, acteur, cible, 1, cible.def, alea);
    evenements.push({ type: "attaque", acteur: acteur.id, cible: cible.id, degats: d,
                      affinite: multiplicateurAffinite(acteur.espece, cible.espece) });
    cmNoterKo(cible, evenements);

  } else if (action.type === "aptitude") {
    var a = APTITUDES[action.cle];
    cmAppliquerAptitude(combat, acteur, action.cle,
                        cmCibleAptitude(a) === "adverse" ? cible : null, alea, evenements);

  } else if (action.type === "assimiler") {
    // La formule du combat 1 contre 1, sur la cible choisie.
    var chance = chanceAssimilation({
      adversaire: cible, equipe: combat.equipe,
      bonusAppel: combat.bonusAppel, bonusDefense: combat.bonusDefense
    });
    combat.tentatives++;
    var reussi = alea() * 100 < chance;
    var ev = { type: "assimilation", acteur: acteur.id, cible: cible.id, chance: chance, reussi: reussi };
    if (reussi) {
      cible.assimile = true;
      combat.assimile = { id: cible.id, espece: cible.espece, niveau: ASSIMILATION_NIVEAU_ENTREE };
      ev.espece = cible.espece;
      ev.niveau = ASSIMILATION_NIVEAU_ENTREE;
    }
    evenements.push(ev);

  } else if (action.type === "defendre") {
    acteur.enDefense = true;
    combat.defenseEnAttente = true;
    evenements.push({ type: "defense", acteur: acteur.id });

  } else if (action.type === "fuir") {
    var moyenne = 0;
    combat.equipe.forEach(function (u) { moyenne += u.niveau; });
    moyenne = moyenne / combat.equipe.length;
    var plusHaut = 0;
    combat.adversaires.filter(cmEnJeu).forEach(function (u) { plusHaut = Math.max(plusHaut, u.niveau); });
    var chanceFuite = FUITE_BASE + (moyenne - plusHaut) * FUITE_PAR_NIVEAU;
    var ok = alea() < chanceFuite;
    if (ok) combat.fuite = true;
    evenements.push({ type: "fuite", acteur: acteur.id, chance: chanceFuite, reussi: ok });
  }

  combat.ontJoue.push(acteur.id);
  cmAvancer(combat, evenements);

  return { ok: true, evenements: evenements, issue: issueCombatMulti(combat) };
}
