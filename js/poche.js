/* ============================================================
   LES POCHES D'OUBLI

   Le modele de donnees, et rien d'autre : pas de carte, pas
   d'ecran, pas d'expiration ni de depot pour l'instant. Ce
   fichier sait fabriquer une poche et compter ce qu'on y a mis.

   Une poche n'est pas une arene. Les arenes s'appellent
   "donjons" dans le code (js/lieux.js) ; une poche peut se poser
   sur l'une d'elles, c'est tout.

   DEROGATION VOULUE A LA REGLE DE js/fragments.js : la-bas, un
   fragment ne sert qu'a son espece et rien ne le convertit. Une
   poche, elle, additionne des fragments de toutes especes. Elle
   les CONSOMME, elle ne les convertit en rien : aucun point n'en
   ressort. Le detail est dans la section LES POCHES D'OUBLI de
   js/config.js.

   Ne depend que de js/config.js (dont distanceMetres). Ne connait
   ni le DOM, ni localStorage, ni l'horloge : les poches ne sont
   pas encore enregistrees, et "maintenant" est TOUJOURS un
   parametre.

   LE DEPOT (deposerFragment)
     - Il MUTE la poche et la gourde, en tout ou rien, comme
       monterConscience() dans js/fragments.js : tout est verifie
       d'abord, et un refus ne touche a rien.
     - Il n'enregistre RIEN. Apres un depot reussi, c'est
       l'APPELANT qui doit sauvegarder la gourde (sauverJoueur()).
     - La source des fragments est VOLONTAIREMENT LIMITEE, pour
       l'instant, a la gourde : les especes pas encore assimilees.
       Les fragments d'un Echo assimile (collection[espece].fragments)
       ne se deposent pas. C'est une decision PROVISOIRE, a revoir
       (par exemple pour le surplus des Echos a conscience maximale).
       Elle tient tout entiere dans retirerFragmentSource() : c'est
       le seul endroit a changer.
     - joueur_id est LOCAL pour l'instant : il n'y a qu'un joueur
       par appareil. Le co-op reel (etat de la poche partage cote
       serveur) viendra plus tard ; le format d'un depot
       { joueur_id, espece, valeur, type, timestamp } ne devra PAS
       changer a ce moment-la.

   BRANCHEMENT FUTUR DU GATE BREAK (rien n'est branche aujourd'hui)
   malusGateBreak() est exposee, mais aucun combat ne l'appelle.
   Le jour ou on la branche :
     1. js/combat.js, niveauAdversaire(donjon) (ligne 83 au moment
        d'ecrire ces lignes) : y ajouter
          + malusGateBreak(donjon, poches, maintenant)
        C'est l'entonnoir unique : l'infobulle et le bandeau de la
        carte (js/carte.js), l'adversaire du combat (adversaireDe)
        et le butin (butinDeKo) suivront d'eux-memes.
     2. LE BUTIN : finDeCombat recalcule niveauAdversaire() A LA
        FIN du combat (butinDeKo(niveauAdversaire(d))). Si l'effet
        s'eteint pendant la rencontre, le butin ne correspondrait
        plus a l'adversaire affronte. Il faut figer le malus au
        debut du combat, dans l'objet combat (demarrerCombat), ou
        lire combat.adversaire.niveau a la place.
     3. Il faudra une liste GLOBALE des poches (elle n'existe pas
        encore), et c'est l'APPELANT qui lit Date.now() et le passe
        en "maintenant" -- jamais ce fichier.
     4. En option, ligneDifficulte() dans js/carte.js pourra dire
        que l'Oubli deborde sur ce lieu.

   Une poche :
     {
       id:                   "poche/leger/48.85660,2.35220/1700000000000",
       niveau:               "leger" | "profond" | "critique",
       lieu:                 { lat, lon, arene_id },  // arene_id : id d'un donjon, ou null
       fragments_deposes:    [ { joueur_id, espece, valeur, type, timestamp } ],
       seuil_total:          points a atteindre (cout_fragments du niveau),
       statut:               "ouvert" | "rempli" | "expire" | "ferme",
       timestamp_creation:   millisecondes,
       timestamp_expiration: millisecondes
     }
   ============================================================ */

var POCHE_STATUTS = ["ouvert", "rempli", "expire", "ferme"];

/* L'instant est passe en parametre, il n'est pas lu de l'horloge
   ici : meme idee que noterJour(jour) dans js/fragments.js, pour
   pouvoir fabriquer une poche dans un test a une date choisie.

   Rend null si le niveau est inconnu ou le lieu inutilisable :
   une poche mal formee ne doit jamais entrer dans le jeu. */
function creerPoche(niveau, lieu, maintenant) {
  var reglage = POCHES_NIVEAUX[niveau];
  if (!Object.prototype.hasOwnProperty.call(POCHES_NIVEAUX, niveau) || !reglage) return null;
  if (!lieu || !isFinite(lieu.lat) || !isFinite(lieu.lon)) return null;
  if (!isFinite(maintenant)) return null;

  // Une poche critique n'a pas de duree de vie, seulement un
  // temps de formation : c'est lui qui fixe son expiration.
  var minutes = reglage.timer_minutes !== undefined
    ? reglage.timer_minutes
    : reglage.timer_formation_minutes;

  var lat = Number(lieu.lat), lon = Number(lieu.lon);

  return {
    // Determine par le niveau, le lieu et l'instant : pas de
    // hasard, donc deux appels identiques donnent le meme id.
    id: "poche/" + niveau + "/" + lat.toFixed(5) + "," + lon.toFixed(5) + "/" + maintenant,
    niveau: niveau,
    lieu: {
      lat: lat,
      lon: lon,
      arene_id: typeof lieu.arene_id === "string" ? lieu.arene_id : null
    },
    fragments_deposes: [],
    seuil_total: reglage.cout_fragments,
    statut: "ouvert",
    timestamp_creation: maintenant,
    timestamp_expiration: maintenant + minutes * 60 * 1000
  };
}

/* La somme des points deposes. Elle lit la valeur de chaque
   depot telle qu'elle a ete enregistree, et ignore ce qui est
   abime (valeur absente, negative, pas un nombre) plutot que de
   planter. Refuser un fragment complet est le travail du depot,
   pas de cette fonction. */
function calculerSommeFragments(poche) {
  if (!poche || !poche.fragments_deposes || typeof poche.fragments_deposes.length !== "number") {
    return 0;
  }

  var somme = 0;
  for (var i = 0; i < poche.fragments_deposes.length; i++) {
    var d = poche.fragments_deposes[i];
    if (!d || typeof d.valeur !== "number" || !isFinite(d.valeur) || d.valeur < 0) continue;
    somme += d.valeur;
  }
  return somme;
}

/* Le statut qu'a la poche a l'instant "maintenant". Rend une
   simple chaine et NE MODIFIE PAS la poche : c'est l'appelant qui
   decide de l'ecrire, comme pour palierFigement() ou butinDeKo().
   Une copie obligerait a recopier fragments_deposes a chaque
   controle, pour rien.

   Dans cet ordre :
     - un statut final (rempli, ferme, expire) ne change plus ;
     - seuil atteint : "rempli", ou "ferme" si le niveau a
       fermeture_immediate (plus aucun depot accepte) ;
     - echeance atteinte (maintenant >= timestamp_expiration) :
       "expire" ;
     - sinon : "ouvert".

   Une poche remplie mais controlee APRES son echeance compte
   comme remplie : le seuil passe avant l'heure. Refuser un depot
   fait apres l'echeance est le travail du depot, pas de cette
   fonction. */
function verifierExpirationPoche(poche, maintenant) {
  if (!poche) return "";
  if (poche.statut === "rempli" || poche.statut === "ferme" || poche.statut === "expire") {
    return poche.statut;
  }

  if (calculerSommeFragments(poche) >= poche.seuil_total) {
    var reglage = POCHES_NIVEAUX[poche.niveau];
    return reglage && reglage.fermeture_immediate ? "ferme" : "rempli";
  }

  if (maintenant >= poche.timestamp_expiration) return "expire";
  return "ouvert";
}

/* Le malus de difficulte, en niveaux d'adversaire, que l'Oubli
   impose a une arene (un element de donjons) a l'instant
   "maintenant".

   Une poche compte si, a cet instant :
     - elle est expiree (statut RECALCULE par verifierExpirationPoche :
       une poche dont le champ n'a pas encore ete mis a jour compte
       quand meme) ;
     - son effet dure encore : maintenant < expiration + duree ;
     - l'arene est dans son rayon (distanceMetres, bord compris).

   Plusieurs poches : on garde la PLUS FORTE, on n'additionne pas.
   Voir GATE_BREAK dans js/config.js. Rend 0 si rien ne s'applique,
   et ne plante jamais sur une arene ou une poche abimee. */
function malusGateBreak(arene, poches, maintenant) {
  if (!arene || !isFinite(arene.lat) || !isFinite(arene.lon)) return 0;
  if (!poches || typeof poches.length !== "number") return 0;

  var malus = 0;

  for (var i = 0; i < poches.length; i++) {
    var p = poches[i];
    if (!p || !p.lieu) continue;

    var effet = Object.prototype.hasOwnProperty.call(GATE_BREAK, p.niveau) ? GATE_BREAK[p.niveau] : null;
    if (!effet) continue;
    if (verifierExpirationPoche(p, maintenant) !== "expire") continue;
    if (!(maintenant < p.timestamp_expiration + effet.duree_minutes * 60 * 1000)) continue;

    var dist = distanceMetres(arene.lat, arene.lon, p.lieu.lat, p.lieu.lon);
    if (!(dist <= effet.rayon_metres)) continue;

    malus = Math.max(malus, effet.malus);
  }

  return malus;
}


/* ------------------------------------------------------------
   LE DEPOT DE FRAGMENTS
   ------------------------------------------------------------ */

/* Les raisons de refus, du plus general au plus precis : c'est
   l'ordre dans lequel deposerFragment les teste. Des codes
   stables, pas des phrases : le futur message au joueur les
   traduira, dans la langue courante. */
var POCHE_REFUS = [
  "poche_invalide",        // poche ou gourde absente
  "joueur_absent",         // joueur_id vide ou pas une chaine
  "poche_expiree",
  "poche_remplie",
  "poche_fermee",
  "fragment_complet",      // le complet ne se depose JAMAIS
  "taille_non_deposable",  // toute autre taille hors FRAGMENTS_DEPOSABLES
  "espece_inconnue",
  "aucun_fragment"         // rien de cette taille pour cette espece
];

/* LA SOURCE des fragments deposables : le seul endroit qui sait
   d'ou ils viennent. Aujourd'hui la gourde seule (decision
   provisoire, voir l'en-tete). Elargir la source, c'est changer
   cette fonction et rien d'autre.

   Retire UN fragment et rend true, ou ne touche a rien et rend
   false s'il n'y en a pas. Comme c'est la seule etape du depot
   qui puisse encore echouer apres les controles, deposerFragment
   l'appelle en dernier : le tout ou rien en decoule. */
function retirerFragmentSource(gourde, espece, taille) {
  if (!Object.prototype.hasOwnProperty.call(gourde, espece)) return false;

  var sac = gourde[espece];
  if (!sac || !(sac[taille] >= 1)) return false;

  sac[taille] -= 1;
  return true;
}

/* Depose UN fragment de la source dans la poche.

   MUTE la poche et la gourde, en tout ou rien (voir l'en-tete).
   L'appelant sauvegarde la gourde apres un succes.

   Rend :
     succes  { ok: true, raison: "", depot, somme, seuil_total, statut, franchi }
     refus   { ok: false, raison, statut }

   franchi vaut true si c'est CE depot qui a atteint le seuil.

   Depasser le seuil : le depot qui le franchit est accepte en
   entier, sans rien rendre. Juste apres, verifierExpirationPoche
   rend "rempli" (ou "ferme" pour une critique, fermeture_immediate)
   et tout depot suivant est refuse. Aucun calcul de monnaie. */
function deposerFragment(poche, gourde, joueur_id, espece, taille, maintenant) {
  if (!poche || !gourde || typeof gourde !== "object" ||
      !poche.fragments_deposes || typeof poche.fragments_deposes.push !== "function") {
    return refusDepot("poche_invalide", poche ? poche.statut : "");
  }
  var statut = verifierExpirationPoche(poche, maintenant);

  if (typeof joueur_id !== "string" || joueur_id === "") return refusDepot("joueur_absent", statut);

  if (statut === "expire") return refusDepot("poche_expiree", statut);
  if (statut === "rempli") return refusDepot("poche_remplie", statut);
  if (statut === "ferme")  return refusDepot("poche_fermee", statut);
  if (statut !== "ouvert") return refusDepot("poche_invalide", statut);

  if (taille === "complet") return refusDepot("fragment_complet", statut);
  if (FRAGMENTS_DEPOSABLES.indexOf(taille) === -1) return refusDepot("taille_non_deposable", statut);

  if (typeof espece !== "string" || !Object.prototype.hasOwnProperty.call(ESPECES, espece)) {
    return refusDepot("espece_inconnue", statut);
  }

  // Derniere etape qui peut echouer : rien n'a ete touche avant.
  if (!retirerFragmentSource(gourde, espece, taille)) return refusDepot("aucun_fragment", statut);

  var depot = {
    joueur_id: joueur_id,
    espece: espece,
    valeur: FRAGMENT_VALEURS[taille],
    type: taille,
    timestamp: maintenant
  };
  poche.fragments_deposes.push(depot);
  poche.statut = verifierExpirationPoche(poche, maintenant);

  return {
    ok: true,
    raison: "",
    depot: depot,
    somme: calculerSommeFragments(poche),
    seuil_total: poche.seuil_total,
    statut: poche.statut,
    franchi: poche.statut !== "ouvert"
  };
}

function refusDepot(raison, statut) {
  return { ok: false, raison: raison, statut: statut || "" };
}

/* Qui a mis quoi dans la poche, pour le futur "Souvenir de X" du
   Grimoire. Pure : rend un objet neuf et ne touche pas la poche.
   Ignore les depots abimes, avec la meme regle que
   calculerSommeFragments.

     { j1: { points: 7, fragments: 3,
             especes: { peng: { points: 4, fragments: 2 }, ... } } } */
function contributionsParJoueur(poche) {
  var parJoueur = {};
  if (!poche || !poche.fragments_deposes || typeof poche.fragments_deposes.length !== "number") {
    return parJoueur;
  }

  for (var i = 0; i < poche.fragments_deposes.length; i++) {
    var d = poche.fragments_deposes[i];
    if (!d || typeof d.valeur !== "number" || !isFinite(d.valeur) || d.valeur < 0) continue;
    if (typeof d.joueur_id !== "string" || typeof d.espece !== "string") continue;

    if (!Object.prototype.hasOwnProperty.call(parJoueur, d.joueur_id)) {
      parJoueur[d.joueur_id] = { points: 0, fragments: 0, especes: {} };
    }
    var j = parJoueur[d.joueur_id];

    if (!Object.prototype.hasOwnProperty.call(j.especes, d.espece)) {
      j.especes[d.espece] = { points: 0, fragments: 0 };
    }

    j.points += d.valeur;
    j.fragments += 1;
    j.especes[d.espece].points += d.valeur;
    j.especes[d.espece].fragments += 1;
  }

  return parJoueur;
}
