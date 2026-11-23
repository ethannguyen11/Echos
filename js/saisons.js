/* ============================================================
   LES SAISONS DES BRECHES PERMANENTES (DONNEES SEULEMENT)

   Correspondance de vocabulaire : "breche" est le mot du joueur.
   Les "poches d'Oubli" de js/poche.js sont un autre systeme.

   Une saison dure un mois. Elle dit, pour chaque famille de lieu
   (temple, parc, metro, monument : les memes mots que
   ESPECES[x].famille et que la categorie d'une arene), quels
   monstres gardent les breches :
     a      le boss des jours 1 a 3
     b      le boss des jours 4 a 6, de la meme famille
     final  le boss du jour 7, le plus fort et le plus rare

   AJOUTER UNE SAISON ne demande aucun changement de code : on
   ajoute un objet a ce tableau. Les regles (verifier/breches.js)
   controlent que :
     - "mois" est de la forme "AAAA-MM" et n'apparait qu'une fois ;
     - chaque espece existe dans js/especes.js et appartient bien
       a la famille ou elle est rangee ;
     - a, b et final sont trois especes differentes ;
     - le rang ne descend pas : a <= b <= final (ECHELLE_RANGS) ;
     - "nom" a un texte en francais (l'anglais est facultatif :
       le francais sert de repli, comme pour txt()).
   Une famille absente d'une saison veut dire : pas de breche dans
   ce type de lieu ce mois-la.

   UN MOIS SANS SAISON n'est pas une erreur : le jeu reprend les
   saisons de ce tableau a tour de role (saisonDuMois dans
   js/breches.js). Le joueur a donc toujours des breches, meme si
   personne n'a ecrit la saison du mois.

   Les especes sans image prennent le visuel de secours habituel.
   ============================================================ */

var SAISONS_BRECHES = [
  {
    mois: "2026-11",
    nom: { fr: "Saison des Gardiens", en: "Season of the Guardians" },
    familles: {
      temple:   { a: "chiguo",    b: "sunwukong",  final: "komainu" },
      metro:    { a: "teketeke",  b: "baku",       final: "mechadrill" },
      monument: { a: "vinci",     b: "eiffel",     final: "tortuedragon" },
      parc:     { a: "hinezumi",  b: "penghou",    final: "peng" }
    }
  },
  {
    mois: "2026-12",
    nom: { fr: "Saison des Machines", en: "Season of the Machines" },
    familles: {
      temple:   { a: "palantir",   b: "chiguo",     final: "sunwukong" },
      metro:    { a: "zhanxiyuan", b: "teketeke",   final: "baku" },
      monument: { a: "eiffel",     b: "hephaistos", final: "tortuedragon" },
      parc:     { a: "jinchan",    b: "hinezumi",   final: "peng" }
    }
  }
];
