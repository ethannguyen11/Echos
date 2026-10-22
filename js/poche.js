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

   Ne depend que de js/config.js. Ne connait ni le DOM ni
   localStorage : les poches ne sont pas encore enregistrees.

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
