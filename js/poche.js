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
