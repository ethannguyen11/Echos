/* ============================================================
   LES FRAGMENTS, LA GOURDE ET LE SAVOIR

   js/joueur.js tient l'ETAT (collection, gourde, savoir) et sait
   l'ecrire sur le disque. Ce fichier-ci tient les REGLES : ce
   qu'un fragment rapporte, ou il atterrit, ce qu'il coute, et ce
   que le joueur perd quand sa gourde deborde.

   Il est charge apres js/joueur.js. Les deux s'appellent l'un
   l'autre, mais jamais au chargement : uniquement a l'execution,
   quand tout est en place.

   Le principe qui gouverne tout le fichier : UN FRAGMENT N'EST
   PAS UNE MONNAIE. Il appartient a une espece et ne sert qu'a
   elle. Aucune fonction ici ne convertit, n'echange ni ne
   transfere entre especes -- et si un jour l'une d'elles le fait,
   c'est que la regle aura change, pas qu'on aura optimise.

   Ce fichier n'affiche rien. Il ne connait pas le DOM.
   ============================================================ */


/* ------------------------------------------------------------
   1. LE SAVOIR

   Trois compteurs, une seule valeur qui en sort. Les trois
   sources sont distinctes exprès : les combats recompensent
   l'acharnement, les jours recompensent la duree, les lieux
   recompensent le deplacement. Un joueur qui ne fait que l'une
   des trois avance, mais lentement.

   Les trois fonctions de notation ci-dessous n'ont AUCUN
   appelant pour l'instant. Elles sont les points d'accroche du
   commit suivant :
     noterCombat()      a brancher en fin de combat
     noterJour(jour)    a brancher au chargement du jeu
     noterLieu(id)      a brancher a l'entree dans un lieu
   Chacune rend true si elle a vraiment compte quelque chose.
   ------------------------------------------------------------ */

function pointsDeSavoir() {
  return savoir.combats * SAVOIR_PAR_COMBAT +
         savoir.jours.length * SAVOIR_PAR_JOUR +
         savoir.lieux.length * SAVOIR_PAR_LIEU;
}

function noterCombat() {
  savoir.combats++;
  return true;
}

/* Le jour est passe en parametre, il n'est pas lu de l'horloge
   ici : c'est ce qui permet de rejouer un enchainement de
   journees dans un test sans toucher a la date du systeme.
   jourDuJour() donne la valeur du jour reel a l'appelant. */
function noterJour(jour) {
  if (typeof jour !== "string" || jour === "") return false;
  if (savoir.jours.indexOf(jour) !== -1) return false;
  savoir.jours.push(jour);
  return true;
}

function noterLieu(id) {
  if (typeof id !== "string" || id === "") return false;
  if (savoir.lieux.indexOf(id) !== -1) return false;
  savoir.lieux.push(id);
  return true;
}

function jourDuJour() {
  try {
    return new Date().toISOString().slice(0, 10);   // "AAAA-MM-JJ"
  } catch (e) {
    return "";
  }
}


/* ------------------------------------------------------------
   2. LA GOURDE

   Sa capacite est comptee PAR ESPECE et toutes tailles
   confondues. Elle part de GOURDE_CAPACITE_BASE et grandit avec
   le savoir, jusqu'a GOURDE_CAPACITE_MAX.

   Le plafond absolu n'est pas une precaution technique : sans
   lui, un joueur ancien pourrait tout stocker et la gourde
   cesserait d'etre un choix.
   ------------------------------------------------------------ */

function capaciteGourde() {
  var places = GOURDE_CAPACITE_BASE +
               Math.floor(pointsDeSavoir() / GOURDE_SAVOIR_PAR_PLACE);
  return Math.min(places, GOURDE_CAPACITE_MAX);
}

function totalFragments(sac) {
  if (!sac) return 0;
  var total = 0;
  FRAGMENT_TAILLES.forEach(function (t) { total += sac[t] || 0; });
  return total;
}

// Ce que la gourde retient pour une espece, meme si elle n'y a
// encore rien. Rend toujours un sac complet, jamais undefined.
function fragmentsEnGourde(especeId) {
  return gourde[especeId] || fragmentsVides();
}

/* L'espece vient d'entrer au Grimoire : ce que la gourde gardait
   pour elle lui revient d'un coup, et la place se libere.

   Appele par ajouterAlaCollection, et seulement par elle. */
function viderGourdeVers(especeId) {
  var sac = gourde[especeId];
  var echo = collection[especeId];
  if (!sac || !echo) return null;

  FRAGMENT_TAILLES.forEach(function (t) { echo.fragments[t] += sac[t] || 0; });
  delete gourde[especeId];

  return sac;
}


/* ------------------------------------------------------------
   3. DONNER UN FRAGMENT

   Un seul chemin d'entree pour tout le jeu. Il repond toujours la
   meme chose, que le fragment aille dans l'Echo ou dans la
   gourde :

     { espece, taille, ou, recus, perdus, capacite }

     ou       "echo" si l'espece est assimilee, "gourde" sinon
     recus    ce qui est effectivement rentre
     perdus   ce que la gourde n'a pas pu prendre

   perdus > 0 est le cas dont le joueur DOIT etre averti. Aucune
   interface n'existe encore pour le lui dire : c'est a l'appelant
   de le faire, et c'est pour ca que la valeur remonte au lieu
   d'etre avalee ici.

   Un Echo deja assimile n'a pas de plafond. La gourde est une
   salle d'attente, pas un coffre : c'est elle qu'on limite, pas
   ce que le joueur a compris.
   ------------------------------------------------------------ */

function donnerFragment(especeId, taille, nombre) {
  var rien = { espece: especeId, taille: taille, ou: null,
               recus: 0, perdus: 0, capacite: capaciteGourde() };

  if (!ESPECES[especeId]) return rien;
  if (FRAGMENT_TAILLES.indexOf(taille) === -1) return rien;

  var combien = Math.round(Number(nombre));
  if (!(combien > 0)) combien = 1;

  var echo = collection[especeId];

  if (echo) {
    echo.fragments[taille] += combien;
    return { espece: especeId, taille: taille, ou: "echo",
             recus: combien, perdus: 0, capacite: capaciteGourde() };
  }

  if (!gourde[especeId]) gourde[especeId] = fragmentsVides();
  var sac = gourde[especeId];

  var capacite = capaciteGourde();
  var libre = capacite - totalFragments(sac);
  if (libre < 0) libre = 0;              // gourde deja trop pleine : voir normaliserGourde

  var recus = Math.min(combien, libre);
  sac[taille] += recus;

  return { espece: especeId, taille: taille, ou: "gourde",
           recus: recus, perdus: combien - recus, capacite: capacite };
}

/* LE FRAGMENT COMPLET

   Il ne tombe jamais au combat. Il se recoit : un lieu rendu a
   lui-meme, une quete, un palier de langage. Aucune de ces trois
   sources n'existe encore -- cette fonction n'a donc aujourd'hui
   aucun appelant, et c'est normal.

   Elle passe par donnerFragment plutot que d'ecrire dans le sac
   elle-meme : un fragment complet recu pour une espece inconnue
   doit aller en gourde et compter contre la capacite, exactement
   comme les autres. La rarete est dans la SOURCE, pas dans le
   traitement. */
function donnerFragmentComplet(especeId) {
  return donnerFragment(especeId, "complet", 1);
}


/* ------------------------------------------------------------
   4. LA CONSCIENCE

   Quatre paliers. Un Echo assimile demarre a 1, et chaque montee
   consomme des fragments qui lui appartiennent en propre.

   Le cout est lu dans CONSCIENCE_COUTS[palier actuel] : c'est le
   prix pour QUITTER ce palier. Le dernier n'a pas d'entree, donc
   coutConscience rend null et tout le reste s'arrete la, sans cas
   particulier a ecrire.
   ------------------------------------------------------------ */

function coutConscience(niveau) {
  var cout = CONSCIENCE_COUTS[niveau];
  if (!cout) return null;                 // dernier palier, ou niveau absurde
  return cout;
}

/* Ce qui manque encore pour la prochaine montee, taille par
   taille. Rend un sac de zeros quand tout est reuni, et null
   quand il n'y a plus rien a monter.

   C'est cette fonction que l'interface lira plus tard : elle dit
   a la fois si l'on peut monter (tout a zero) et ce qu'il reste a
   trouver. */
function manquePourConscience(especeId) {
  var echo = collection[especeId];
  if (!echo) return null;

  var cout = coutConscience(echo.conscience);
  if (!cout) return null;

  var manque = fragmentsVides();
  FRAGMENT_TAILLES.forEach(function (t) {
    var reste = (cout[t] || 0) - echo.fragments[t];
    manque[t] = reste > 0 ? reste : 0;
  });

  return manque;
}

function peutMonterConscience(especeId) {
  var manque = manquePourConscience(especeId);
  return manque !== null && totalFragments(manque) === 0;
}

/* La depense. Tout ou rien : si un seul fragment manque, on ne
   prend rien du tout. Un paiement partiel laisserait l'Echo sans
   ses fragments ET sans son palier, et le joueur n'aurait aucun
   moyen de comprendre ce qui s'est passe.

   Rend le nouveau palier, ou null si la montee n'a pas eu lieu. */
function monterConscience(especeId) {
  if (!peutMonterConscience(especeId)) return null;

  var echo = collection[especeId];
  var cout = coutConscience(echo.conscience);

  FRAGMENT_TAILLES.forEach(function (t) { echo.fragments[t] -= (cout[t] || 0); });
  echo.conscience++;

  return echo.conscience;
}
