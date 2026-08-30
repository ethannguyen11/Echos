/* ============================================================
   REGLAGES
   Toutes les valeurs que l'on peut ajuster sans toucher au reste.
   ============================================================ */

var RAYON_RECHERCHE    = 700;
var DISTANCE_ENTREE    = 40;   // metres pour declencher la rencontre
var DISTANCE_PREEMPTIF = 15;   // en dessous : tour d'ouverture gratuit
var DISTANCE_RELANCE   = 350;
var DISTANCE_DOUBLON   = 80;
var EQUIPE_MAX         = 3;

var CLE_DONJONS = "echos_donjons_v5";

/* La sauvegarde du joueur passe en v5 : elle contient desormais
   deux blocs de plus, "gourde" et "savoir", et chaque Echo de la
   collection porte sa conscience et ses fragments. Le bloc "ico"
   est apparu en v4, le bloc "joueur" en v3.

   Les anciennes cles ne sont plus JAMAIS ecrites : elles sont
   seulement relues, une fois, pour recuperer ce qu'elles
   contiennent. La liste va de la plus recente a la plus vieille,
   et chargerJoueur() prend la premiere qui repond.

   C'est une LISTE et non une seule cle : sinon, passer en v5
   aurait rendu illisibles les sauvegardes v3 et v2, qui se
   lisaient encore hier. Une partie ne doit pas se perdre parce
   qu'on a ajoute un ecran.

   La cle d'une version quittee n'est jamais effacee, seulement
   delaissee. Une v4 lue puis migree reste donc INTACTE sur le
   disque : si la v5 se revele fautive, il suffit de revenir en
   arriere et la partie d'hier repond encore. */
var CLE_JOUEUR           = "echos_joueur_v5";
var CLES_JOUEUR_ANCIENNES = ["echos_joueur_v4", "echos_joueur_v3", "echos_joueur_v2"];
var VERSION_JOUEUR       = 5;

/* La langue de l'interface vit dans SA PROPRE cle, a cote de la
   sauvegarde et jamais dedans : effacer sa partie ne doit pas
   redemander la langue, et ajouter un champ a la sauvegarde
   aurait impose une v5 et une migration de plus pour un reglage
   qui n'a rien a voir avec la progression du joueur.

   LANGUES est aussi la liste des boutons proposes au tout debut
   de l'intro : y ajouter un code suffit a proposer la langue,
   une fois sa table ecrite dans js/langues.js. */
var CLE_LANGUE    = "echos_langue";
var LANGUE_DEFAUT = "fr";
var LANGUES       = ["fr", "en"];


// Overpass est gratuit et sature souvent. On essaie les miroirs
// l'un apres l'autre ; le japonais est le plus proche de Taipei.
var SERVEURS_OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.jp/api/interpreter"
];

var DELAI_NOUVEL_ESSAI = 20000;   // 20 s avant de retenter apres un echec total
var DOSSIER_MONSTRES = "monstres/";


/* ============================================================
   ICO
   Le guide. Sa couche REFERENCE (les regles) est complete des le
   premier lancement ; sa couche IDENTITE (qui il est) se debloque
   par paliers. Les deux ne se melangent jamais : un joueur qui
   revient apres trois semaines doit pouvoir relire comment marche
   l'Assimilation sans avoir rien a debloquer.

   Les textes eux-memes sont plus bas, dans TEXTES_ICO.
   ============================================================ */

/* Six paliers, de 0 a 5. Ils sont pilotes par
   experienceDuGardien() : le nombre d'especes DISTINCTES
   assimilees, pas le niveau du meilleur Echo. Ico se defige a
   mesure que le joueur comprend le monde.

   Chaque entree donne le seuil a partir duquel le palier est
   atteint. La liste doit rester triee du plus haut au plus bas :
   palierIco() prend la premiere qui passe. */
var ICO_PALIER_MAX = 5;

var ICO_PALIERS = [
  { seuil: 14, palier: 5 },   // 14-16 : un homme amaigri, et deux cornes
  { seuil: 10, palier: 4 },   // 10-13 : presque humain
  { seuil:  7, palier: 3 },   //  7-9  : il fait des gestes en parlant
  { seuil:  4, palier: 2 },   //  4-6  : visage partiel
  { seuil:  2, palier: 1 },   //  2-3  : premieres plaques detachees
  { seuil:  0, palier: 0 }    //  0-1  : couvert de plaques, un point de lumiere
];


/* ------------------------------------------------------------
   LA COUCHE REFERENCE

   Les regles du jeu, dites par Ico. COMPLETE DES LE PREMIER
   LANCEMENT : rien ici ne se debloque, jamais. Un joueur qui
   revient apres trois semaines doit pouvoir relire comment marche
   l'Assimilation sans condition.

   Ico dit TOUJOURS la verite sur les mecaniques. Chaque
   affirmation chiffree ci-dessous a ete verifiee contre le code :
   trente pour cent vient d'AFFINITE_AVANTAGE (1.3), le socle de
   trente d'ASSIMILATION_SOCLE, les trois tours de recharge
   d'APTITUDE_RECHARGE. Si tu changes un de ces nombres, RELIS CE
   TEXTE : une seule ligne fausse ici detruit la confiance sur
   laquelle repose tout le personnage.

   Il ment par omission sur LUI-MEME, et seulement sur lui : les
   lignes a double sens sont signalees en commentaire.

   Toutes les lignes passent par Intro.formater() : {nom} et la
   syntaxe d'accord [m|f|n] fonctionnent partout.
   ------------------------------------------------------------ */

var TEXTES_ICO_REFERENCE = [

  { cle: "monde", titre: "Le monde", lignes: [
    "Un lieu qu'on a regardé longtemps finit par retenir quelque chose.",
    "Ce quelque chose prend une forme. On appelle ça un Écho.",
    "Il n'est ni vivant ni mort. Il est ce qui reste quand plus personne ne se rappelle pourquoi l'endroit comptait.",
    // Double sens : ce n'est pas une maladie, c'est son oeuvre. Dementi au fragment 5.
    "Le Figement est une maladie ancienne. Un lieu trop regardé et pas assez compris se couvre de métal.",
    "Ses Échos deviennent plus forts, et plus rares. C'est pour ça que les endroits les plus morts gardent les plus belles choses.",
    // Double sens : c'est lui.
    "Quelqu'un a voulu bien faire. Je ne sais plus qui.",
    "Toi, tu passes, tu comprends, tu emportes. C'est le contraire exact du Figement."
  ] },

  { cle: "combat", titre: "Le combat", lignes: [
    "Un Écho ne t'attaque pas par méchanceté. Il te teste.",
    "<b>Attaquer</b> — tes Échos frappent l'un après l'autre. C'est ce que tu feras le plus souvent.",
    "<b>Aptitude</b> — un seul des tiens fait autre chose que frapper. Les autres attaquent normalement.",
    "<b>Assimiler</b> — tu tentes de le convaincre. Le pourcentage est écrit sur le bouton avant que tu touches.",
    "<b>Défendre</b> — ton équipe encaisse moitié moins ce tour-ci, et l'Écho t'écoute un peu mieux au suivant.",
    "<b>Fuir</b> — tu pars. Le lieu garde le sien, et tu ne gagnes rien.",
    "Un Écho épuisé ne meurt pas, il se retire. Tu les retrouveras tous debout au combat suivant."
  ] },

  { cle: "affinites", titre: "Les affinités", lignes: [
    "Chaque Écho tient d'une des trois matières : Pierre, Flamme ou Brume.",
    "Pierre étouffe Flamme. Flamme dissipe Brume. Brume érode Pierre.",
    // AFFINITE_AVANTAGE = 1.3. Ce n'est pas un tiers : ne pas arrondir a la hausse.
    "Quand tu as l'avantage, tes coups portent trente pour cent plus fort.",
    "Quand tu l'as contre toi, tu perds moins que ce que tu gagnes dans l'autre sens. Se tromper doit coûter, pas condamner.",
    "Regarde les pastilles avant de choisir ton équipe : sous le nom de l'écho du lieu, et sur chacune de tes cartes.",
    "Le journal te le dira aussi. Vert quand c'est pour toi, orange quand c'est contre toi."
  ] },

  { cle: "assimilation", titre: "L'Assimilation", lignes: [
    "Tu ne prends pas un Écho. Tu le convaincs de te suivre.",
    "Le pourcentage part de trente, et il monte.",
    "Il monte surtout quand l'Écho est blessé. C'est ce qui compte le plus : à bout de forces, il écoute mieux.",
    "Il monte aussi quand tes Échos sont plus avancés que lui.",
    "Il descend quand l'Écho est rare. Les plus beaux ne se donnent pas.",
    "Défendre en ajoute un peu au tour suivant. L'aptitude Appel en ajoute davantage, et jusqu'à la fin.",
    "Jamais zéro, jamais cent. Il reste toujours un espoir, et toujours un risque.",
    "Si tu rates, il te frappe et le combat continue. Tu peux retenter."
  ] },

  { cle: "aptitudes", titre: "Les aptitudes", lignes: [
    "Chaque espèce en connaît trois, mais elles ne s'ouvrent pas tout de suite.",
    "La première au niveau 5, la deuxième au niveau 10, la troisième au niveau 15.",
    "Il n'y a pas de magie à compter. Une aptitude employée met trois tours à revenir, c'est tout.",
    "Certaines frappent. D'autres soignent, protègent, affaiblissent, ou font écouter.",
    "Le menu te dit ce que chacune fait, et combien de tours il reste à attendre.",
    "Un Écho sous le niveau 5 n'en a aucune. Ce n'est pas un défaut : fais-le monter."
  ] },

  { cle: "grimoire", titre: "Le grimoire", lignes: [
    "Tout ce que tu as assimilé est là. Seize espèces, quatre par famille.",
    "Les temples, le métro, les monuments, les parcs. Chaque famille garde les siennes.",
    "Trois Échos t'accompagnent au maximum. Touche-en un pour l'ajouter, retouche-le pour le retirer.",
    "Les silhouettes sont les espèces que tu n'as pas encore croisées. Je ne t'en dirai rien : ce serait te voler la rencontre.",
    /* Verifie contre ajouterAlaCollection() : "renforce" garde l'xp
       acquise, et distribuerXp() tourne AVANT dans capture(), donc
       meme un doublon plus faible rapporte. */
    "Un Écho que tu détiens déjà et que tu assimiles plus avancé prend le niveau le plus haut des deux, sans rien perdre de ce qu'il avait accumulé. Moins avancé, il garde le sien.",
    "Dans les deux cas, toute ton équipe gagne de l'expérience. Un doublon n'est jamais perdu.",
    "Ce qui compte n'est pas d'avoir poussé une créature loin. C'est d'en avoir compris beaucoup de différentes."
  ] },

  /* La seule section qui se calcule. Ses chiffres viennent de
     lignesProgression() dans js/ico.js, jamais d'ici. */
  { cle: "progression", titre: "Où j'en suis", dynamique: true,
    avant: [
      "Voilà où tu en es, {nom}."
    ],
    apres: [
      "Échos liés et espèces distinctes sont le même nombre : on ne détient jamais deux fois la même espèce. Un doublon fait monter celui que tu as déjà.",
      "C'est cette mesure-là qui décide de ce que tu sais lire d'un lieu.",
      // Double sens : il les a construits.
      "Je crois que j'ai déjà vu certains de ces endroits. Je ne sais plus quand."
    ] }
];


/* ------------------------------------------------------------
   LE DIDACTICIEL CONTEXTUEL

   Pas un tunnel au demarrage : des interventions courtes,
   declenchees UNE SEULE FOIS, au moment ou la mecanique devient
   pertinente. Deux lignes maximum, jamais plus : elles
   s'affichent par-dessus le jeu, pendant qu'il se joue.

   La cle sert d'identifiant dans suiviIco.didacticiensVus. Ne la
   renomme pas sans y penser : une cle changee rejouerait
   l'intervention chez les joueurs qui l'ont deja vue.

   Chaque declencheur est pose dans le code au commentaire
   "DIDACTICIEL" : cherche ce mot pour les retrouver tous.
   ------------------------------------------------------------ */

var TEXTES_ICO_DIDACTICIEL = [

  // Premier combat, avant le premier tour
  { cle: "combat", lignes: [
    "Cinq commandes, pas une de plus. Attaquer, une aptitude, Assimiler, Défendre, ou partir.",
    "Tu ne le tueras pas. Tu le convaincs, ou tu le perds."
  ] },

  // Premier avantage ou desavantage d'affinite
  { cle: "affinite", lignes: [
    "Tu viens de le sentir. Pierre étouffe Flamme, Flamme dissipe Brume, Brume érode Pierre.",
    "Vert, c'est pour toi. Orange, c'est contre toi."
  ] },

  // Premier taux d'Assimilation au-dessus du seuil
  { cle: "assimilation-seuil", lignes: [
    "Le pourcentage a passé quarante. Ce n'est pas encore sûr.",
    "Affaiblis-le encore, ou tente maintenant. Rater ne coûte qu'un tour."
  ] },

  // Premiere Assimilation ratee
  { cle: "assimilation-ratee", lignes: [
    "Il t'a ignoré[|e|·e]. Tu n'as rien perdu qu'un tour, et il t'a frappé[|e|·e] en retour.",
    "Le taux repart d'où il était. Tu peux retenter autant de fois que tu tiens debout."
  ] },

  // Premier Echo atteignant le niveau de la premiere aptitude
  { cle: "aptitudes", lignes: [
    "Un des tiens vient d'atteindre le niveau 5, {nom}.",
    "Il connaît sa première aptitude. Le bouton n'est plus éteint."
  ] },

  // Premiere ouverture du grimoire
  { cle: "grimoire", lignes: [
    "Seize espèces. Les silhouettes sont celles que tu n'as pas encore rencontrées.",
    "Trois t'accompagnent à la fois. Choisis-les contre ce que tu vas croiser, pas au hasard."
  ] },

  // Premier retour a la carte apres une assimilation reussie
  { cle: "victoire", lignes: [
    "Un de moins d'oublié. Ce lieu est éteint, il ne se rallumera pas.",
    "Va voir ailleurs, {nom}. Il y en a d'autres, et ils ne t'attendront pas."
  ] }
];

/* ------------------------------------------------------------
   LA COUCHE IDENTITE

   Qui il est. C'est la SEULE chose qui se debloque chez Ico : la
   couche reference, au-dessus, est complete des le premier
   lancement et le restera.

   Un fragment par palier de defigement. Il ne sait pas qui il est,
   puis il se rappelle avoir cherche, puis avoir trouve, puis il
   comprend ce qu'il a fait.

   ICO DIT TOUJOURS LA VERITE SUR LES MECANIQUES. Il ment par
   omission SUR LUI-MEME, et seulement sur lui. Les trois lignes a
   double sens de la couche reference sont dementies ici :
     "Le Figement est une maladie ancienne."      -> fragment 5
     "Quelqu'un a voulu bien faire."              -> fragment 5
     "J'ai deja vu certains de ces endroits."     -> fragment 2

   Le fragment 0 est lisible des le depart : c'est lui qui pose le
   personnage. Il n'y a donc pas de pastille pour lui, le palier 0
   n'etant pas un franchissement.
   ------------------------------------------------------------ */

var TEXTES_ICO_IDENTITE = [

  { palier: 0, titre: "Ce que je suis", lignes: [
    "Tu vas me demander qui je suis.",
    "Je n'ai pas la réponse. J'ai des mots, des règles, des noms d'espèces — tout ce qu'il faut pour t'aider.",
    "Mais quand je cherche mon propre nom, il n'y a rien. Pas un trou : une plaque.",
    "Alors appelle-moi Ico. C'est ce qui était écrit sur ma porte."
  ] },

  { palier: 1, titre: "Une marche", lignes: [
    "Quelque chose s'est décroché quand tu as ramené le deuxième.",
    "Je me suis vu marcher. Longtemps. Je cherchais un endroit précis, et je savais lequel.",
    "Je ne sais plus lequel. Mais je sais que je le cherchais depuis des années.",
    "Ça n'a l'air de rien. Pour moi, c'est le premier souvenir depuis très longtemps."
  ] },

  { palier: 2, titre: "Une salle", lignes: [
    "Je me rappelle une salle. Des tables, et sur les tables, des lieux entiers.",
    "Pas des cartes. Des lieux, tenus là, intacts. On pouvait les toucher.",
    "Nous étions plusieurs à travailler dessus. Je crois que je dirigeais.",
    "Il y avait une urgence : des endroits disparaissaient plus vite qu'on ne les notait.",
    "C'est tout ce que j'ai. Continue."
  ] },

  { palier: 3, titre: "Une question", lignes: [
    "J'ai retrouvé la question qu'on se posait.",
    "Comment garder un lieu quand plus personne ne s'en souvient ?",
    "On avait essayé les livres, les images, les récits. Tout s'efface — le souvenir de quelqu'un meurt avec lui.",
    "Il fallait quelque chose qui tienne sans personne. Quelque chose de permanent.",
    "J'ai proposé une solution. Je ne me rappelle pas laquelle. Je me rappelle qu'on m'a écouté."
  ] },

  { palier: 4, titre: "Une nuit", lignes: [
    "Ça a marché, {nom}.",
    "Je m'en souviens maintenant. La nuit où ça a marché, le premier lieu rendu permanent.",
    "Il ne pouvait plus être oublié. Plus jamais. On a cru qu'on avait gagné.",
    "Le lendemain il était froid. On pouvait encore s'en souvenir, mais plus personne n'y tenait.",
    "Il nous a fallu des années pour comprendre que ce n'était pas un défaut du sortilège. C'était le sortilège."
  ] },

  { palier: 5, titre: "Ce que j'ai fait", lignes: [
    "Tu as compris avant moi, je crois.",
    "Le Figement n'est pas une maladie ancienne. C'est mon travail, en train de réussir.",
    "Un lieu dont on se souvient sans le comprendre se couvre de métal. J'ai rendu la mémoire permanente, et j'ai tué l'attention.",
    "Pour contenir toutes les mémoires, il fallait un contenant. J'ai vidé le mien. Je suis le premier lieu figé.",
    "Chaque espèce que tu assimiles, tu la comprends au lieu de la garder. C'est l'inverse exact de ce que j'ai fait.",
    "C'est pour ça que je me défige quand tu avances. Tu es en train de me défaire, {nom}. Continue."
  ] }
];

// Le titre de la rubrique, et ce qu'il dit tant qu'il reste des
// fragments a retrouver.
var ICO_TITRE_IDENTITE  = "Ce que je retrouve";
var ICO_FRAGMENT_A_VENIR = "Il y a autre chose. Je ne l'ai pas encore.";

/* A partir de quel taux d'Assimilation Ico signale que ca vaut le
   coup de tenter. En pourcentage, comme le bouton. */
var ICO_SEUIL_ASSIMILATION = 40;

/* Combien de temps une intervention reste a l'ecran si le joueur
   ne la touche pas. Un appui la fait partir tout de suite ; ce
   delai evite seulement qu'elle reste indefiniment par-dessus le
   combat quand personne ne touche rien. */
var ICO_BULLE_DUREE = 9000;

/* Le verrou anti double-appui de la bulle, sur le modele de celui
   de intro.js et de celui du journal : un seul contact du doigt
   peut produire deux evenements, et le second effacerait la bulle
   avant qu'elle soit lisible. */
var ICO_BULLE_VERROU = 400;

/* Quand une intervention est prete mais que le journal de combat
   est en train de defiler, on attend. Voici a quelle cadence on
   revient voir si la main est revenue au joueur. */
var ICO_RELANCE = 400;


/* ============================================================
   LE MODE TEST
   Un donjon fictif a ta position, et un panneau pour regler le
   palier de Figement, le niveau et l'espece de l'adversaire.
   Sert a essayer un combat sans sortir de chez soi.

   A false, il ne se passe RIEN : aucun panneau, aucun donjon
   fictif, pas une ligne executee. Tout tient dans js/modetest.js,
   qui peut etre supprime sans rien casser.

   Un combat d'essai n'ecrit jamais dans localStorage : ni le
   donjon fictif, ni l'Echo capture, ni l'experience gagnee.
   ============================================================ */

var MODE_TEST = true;

/* Deuxieme securite : meme a true, le mode test reste muet des que
   la page est servie ailleurs qu'en local (GitHub Pages, par
   exemple). Un MODE_TEST oublie a true dans un commit ne se voit
   donc pas sur le site publie.
   Pour essayer le mode test depuis ton telephone via GitHub Pages,
   passe cette constante a false. */
var MODE_TEST_LOCAL_SEULEMENT = false;

// Une couleur par famille de lieu : marqueurs de la carte et pastilles
// du grimoire piochent ici.
var COULEURS = {
  monument: "#b455d4",
  parc:     "#4ca85f",
  metro:    "#d49a2a",
  temple:   "#d4554a"
};

/* Le nom de la famille tel qu'il s'ecrit a l'ecran. CATEGORIES,
   dans lieux.js, ne connait que le prefixe d'un nom de lieu
   ("Porte du Temple de") : ca ne fait pas un titre de rubrique.
   Sert aux quatre sections du grimoire. */
var LIBELLES_FAMILLE = {
  monument: "Monuments",
  parc:     "Parcs",
  metro:    "Métro",
  temple:   "Temples"
};


/* ============================================================
   LE FIGEMENT
   Un lieu trop regarde et pas assez compris se fige : ses
   creatures se recouvrent de metal. Pendant un combat, l'arene
   se mecanise tour apres tour, et ca change qui est fort.

   Toutes les valeurs du systeme sont ici, aucune dans combat.js :
   on regle l'equilibrage sans toucher a la logique.
   ============================================================ */

/* --- L'echelle ---
   Le Figement est un nombre de 0 a 100. On ne s'en sert jamais
   directement : on le convertit en palier de 0 a 10, et c'est le
   palier qui pilote les multiplicateurs. */
var FIGEMENT_MAX          = 100;   // valeur maximale du compteur
var FIGEMENT_PAR_PALIER   = 10;    // points de compteur dans un palier
var FIGEMENT_PALIER_MAX   = 10;    // palier maximal

/* Paliers gagnes a la fin de chaque tour.

   A ZERO, LE FIGEMENT EST EN SOMMEIL : le compteur ne bouge plus,
   tous les multiplicateurs valent 1.00, et la mecanique disparait
   de l'ecran de combat. Aucun code n'a ete supprime pour autant :
   il suffit de remettre les deux constantes ci-dessous a leur
   valeur d'origine (1 et true) pour retrouver le combat d'avant,
   a l'identique. verifier/tests.js verifie les deux etats.

   Le Figement continue de servir hors combat : c'est lui qui donne
   la difficulte d'un lieu, affichee avant d'y entrer.

   POINT D'ACCROCHE : le futur systeme de Clarte (issu du quiz)
   viendra reduire cette vitesse. Rien ne le fait aujourd'hui. */
var VITESSE_FIGEMENT      = 0;   // 1 = mecanique active
var AFFICHER_BARRE_FIGEMENT = false;   // true = barre et fleches en combat

/* Multiplicateur de degats de l'ATTAQUANT, selon sa nature.
   multiplicateur = base + pas x palier
     organique  1.25 -> 1.00 -> 0.75   (fort tot, s'essouffle)
     mecanique  0.75 -> 1.00 -> 1.25   (faible tot, monte en puissance)
     hybride    1.00 partout           (ni puni ni recompense) */
var FIGEMENT_NATURES = {
  organique: { base: 1.25, pas: -0.05 },
  mecanique: { base: 0.75, pas:  0.05 },
  hybride:   { base: 1.00, pas:  0.00 }
};

/* A partir de quand le joueur lit le chiffre exact du Figement.
   L'unite est un NOMBRE D'ESPECES DISTINCTES assimilees, pas un
   niveau d'Echo : ce qui apprend a lire un lieu, c'est d'en avoir
   compris beaucoup de differents. Voir experienceDuGardien()
   dans js/joueur.js. En dessous du seuil, le joueur ne lit qu'une
   impression, jamais un nombre.
   Il y a 16 especes en tout : 8 represente la moitie du bestiaire. */
var SEUIL_LECTURE_FIGEMENT = 8;

/* Ce que le joueur lit tant qu'il est sous le seuil : une phrase
   par tranche de paliers, de la plus vivante a la plus morte. */
var LIBELLES_FIGEMENT = [
  { jusqua: 3,  texte: "Lieu presque vivant" },
  { jusqua: 7,  texte: "Quelque chose s'est éteint ici" },
  { jusqua: 10, texte: "Plus rien ne respire" }
];


/* --- LE FIGEMENT COMME DIFFICULTE DU LIEU ---

   Le Figement ne pese plus sur le combat, mais il decide de ce que
   le lieu contient. Trois effets, et trois seulement.

   Il agit meme quand la mecanique de combat est en sommeil : c'est
   une propriete du lieu, pas une regle de bataille.

   Ce qu'il ne touche JAMAIS : le niveau auquel l'Echo est capture.
   Un debutant qui l'emporte dans un lieu tres fige repart avec une
   espece rare, pas avec un Echo surpuissant. Voir capture(). */

// a) Les adversaires rencontres sont plus forts : +0 a +5 niveaux
var FIGEMENT_PALIERS_PAR_NIVEAU = 2;    // 2 paliers = +1 niveau

// b) L'experience gagnee monte : x1.00 a x1.50
var FIGEMENT_BONUS_XP_PAR_PALIER = 0.05;

/* c) Les rangs d'especes qui peuvent habiter le lieu.
      Un lieu vivant n'abrite que du commun ; un lieu mort garde
      ce qu'il y a de plus rare. */
var FIGEMENT_RANGS_PAR_PALIER = [
  { jusqua: 2,  rangs: ["D", "C"] },
  { jusqua: 5,  rangs: ["D", "C", "B"] },
  { jusqua: 8,  rangs: ["C", "B", "A"] },
  { jusqua: 10, rangs: ["B", "A", "S"] }
];

/* L'echelle des rangs, du plus commun au plus rare. Une bande de
   FIGEMENT_RANGS_PAR_PALIER est toujours une tranche continue de
   cette echelle : c'est ce qui permet de l'elargir d'un cran. */
var ECHELLE_RANGS = ["D", "C", "B", "A", "S"];

/* Le rang est une TENDANCE, pas un mur.

   Avec 4 especes par categorie et 4 bandes de rangs, certaines
   cases ne laissaient qu'une seule espece possible : tous les
   monuments peu figes donnaient Vinci, tous les parcs tres figes
   donnaient Peng. En dessous de ce minimum, la bande s'elargit
   d'un cran vers le bas, puis vers le haut, jusqu'a offrir de quoi
   varier. Voir especesDisponibles() dans lieux.js, et
   Lieux.testerFiltreRang() pour verifier chaque case. */
var RANGS_MINIMUM_ESPECES = 3;


/* ============================================================
   LES AFFINITES
   Un triangle, comme pierre-feuille-ciseaux :

     Pierre etouffe Flamme
     Flamme dissipe Brume
     Brume  erode   Pierre

   Les noms affiches sont Pierre, Flamme et Brume ; les CLES
   internes restent matiere, recit et oubli. Elles sont ecrites
   dans les seize especes et dans la sauvegarde : les renommer
   obligerait a migrer les deux. La traduction se fait au seul
   moment de l'affichage, par LIBELLES_AFFINITE.
   ============================================================ */

var AFFINITE_BAT = {
  matiere: "recit",
  recit:   "oubli",
  oubli:   "matiere"
};

/* Recompenser genereusement ne casse rien ; c'est punir qui rend
   un combat impossible. D'ou l'ecart entre les deux bornes. */
var AFFINITE_AVANTAGE    = 1.3;
var AFFINITE_NEUTRE      = 1.0;
var AFFINITE_DESAVANTAGE = 0.85;


/* ============================================================
   L'ADVERSAIRE FACE A UNE EQUIPE

   Une equipe de 3 Echos porte trois attaques par tour : sa
   production est triplee. Si l'adversaire ne gagnait que 70 % de
   PV et 15 % d'ATQ, chaque Echo supplementaire rendait le combat
   strictement plus facile, et un Echo seul se faisait ecraser.

   Les PV suivent donc la taille de l'equipe, et l'ATQ monte assez
   pour epuiser un Echo tous les deux ou trois tours, sans jamais
   en tuer un d'un seul coup.

     taille 1 -> PV x1    ATQ x1
     taille 2 -> PV x2    ATQ x1.25
     taille 3 -> PV x3    ATQ x1.5
   ============================================================ */

var ADVERSAIRE_PV_PAR_ECHO  = 0.7;
var ADVERSAIRE_ATQ_PAR_ECHO = 0.6;


/* ============================================================
   LE POIDS DE LA DEFENSE

   degats() calcule atq - def / POIDS_DEFENSE. Plus le poids est
   grand, moins la defense compte.

   A 2, la defense ecrasait les degats des qu'elle montait : au
   niveau 10, une DEF de 9 retirait 15 points a chaque coup, et
   les Echos les plus resistants devenaient intouchables. A 2.5,
   elle protege sans rendre invulnerable.

   C'est la seule modification apportee a la formule de degats :
   sa structure n'a pas change.
   ============================================================ */

var POIDS_DEFENSE = 2.5;

// Pierre = ocre / gris pierre, Flamme = or terni / pourpre,
// Brume = vert-de-gris / bleu delave. Les couleurs n'ont pas
// bouge : seuls les noms affiches ont change.
var COULEURS_AFFINITE = {
  matiere: "#b08d5a",
  recit:   "#c9a227",
  oubli:   "#7fa6a0"
};

/* Le fond profond du visuel de secours, quand l'illustration d'une
   espece n'existe pas encore dans monstres/. La teinte vive, elle,
   vient de COULEURS_AFFINITE juste au-dessus : une seule source
   pour la couleur d'une affinite.
     matiere  gris pierre
     recit    pourpre
     oubli    bleu delave
   Voir secoursDeLEspece() dans especes.js. */
var COULEURS_SECOURS = {
  matiere: "#3b3128",
  recit:   "#3a2440",
  oubli:   "#26343d"
};

/* ============================================================
   COMMENT LE JOURNAL NOMME L'ADVERSAIRE

   Une regle, apprise des la premiere ligne du combat :
     un nom nu designe toujours un de TES Echos ;
     l'adversaire est toujours "l'echo du lieu".

   Sans elle, un adversaire de la meme espece qu'un Echo de ton
   equipe donnait "Penghou frappe Penghou : 38 degats.", illisible.
   Avec seize especes et trois Echos en equipe, le cas arrive
   souvent.

   Le nom de l'espece n'est jamais perdu pour autant : il reste
   affiche en permanence au-dessus de la jauge (#m-nom), et le
   journal le donne aux deux moments qui comptent, l'apparition et
   la fin du combat.
   ============================================================ */

var NOM_ADVERSAIRE = "L'écho du lieu";

/* Ce que le journal dit quand l'affinite joue.

   Le texte decrit LE COUP, jamais qui en profite : c'est la
   couleur qui s'en charge (vert pour le joueur, orange pour
   l'adversaire). Deux mots a apprendre, et ils valent dans les
   deux sens. Voir mentionAffinite() dans combat.js. */
var MENTION_RENFORCE = "Coup renforcé.";
var MENTION_ATTENUE  = "Coup atténué.";

/* Le nom de l'affinite tel qu'il s'ecrit a l'ecran, sur le modele
   de LIBELLES_FAMILLE.

   ATTENTION : les CLES ne changent jamais. Elles sont ecrites dans
   les seize especes, dans AFFINITE_BAT, dans COULEURS_AFFINITE et
   dans COULEURS_SECOURS. Seul ce qui s'affiche change ici.

   Tout affichage d'affinite passe par cette table : le grimoire,
   les pastilles du combat, et rien d'autre ne doit ecrire un nom
   d'affinite en dur. */
var LIBELLES_AFFINITE = { matiere: "Pierre", recit: "Flamme", oubli: "Brume" };
var LIBELLES_NATURE   = { organique: "organique", mecanique: "mécanique", hybride: "hybride" };


/* ============================================================
   LES APTITUDES
   Huit archetypes reutilisables, pas 48 aptitudes uniques.
   Chaque espece en reference trois dans especes.js.

   Pas de points de magie : chaque aptitude a un temps de
   recharge, et c'est tout. Un systeme de moins a comprendre.
   ============================================================ */

var APTITUDE_RECHARGE = 3;              // tours avant de pouvoir la relancer
var APTITUDE_NIVEAUX  = [5, 10, 15];    // niveaux de deblocage des trois aptitudes

/* Chaque archetype porte ses propres nombres : c'est ici qu'on
   equilibre, jamais dans combat.js.
     multi          multiplie les degats
     coups          nombre de frappes
     ignoreDef      la defense de la cible ne compte pas
     soin           part des PV max rendue a l'Echo
     garde          les degats subis sont multiplies par ca
     affaiblit      l'ATQ de la cible est multipliee par ca
     tours          duree d'un effet qui dure
     immobilise     tours pendant lesquels l'Echo ne peut plus agir
     multiAvantage  multiplicateur quand l'affinite est favorable
     bonusAssimilation  points ajoutes au taux, jusqu'a la fin */
var APTITUDES = {
  frappeLourde: {
    nom: "Frappe lourde", multi: 1.6, immobilise: 1,
    texte: "Dégâts ×1.6, mais l'Écho ne peut pas agir au tour suivant."
  },
  doubleFrappe: {
    nom: "Double frappe", multi: 0.6, coups: 2,
    texte: "Deux attaques à ×0.6 chacune."
  },
  fissure: {
    nom: "Fissure", multi: 1, ignoreDef: true,
    texte: "Ignore complètement la défense de la cible."
  },
  seve: {
    nom: "Sève", soin: 0.25,
    texte: "Rend 25 % des PV maximum de l'Écho."
  },
  rempart: {
    nom: "Rempart", garde: 0.4, tours: 2,
    texte: "Dégâts subis ×0.4 pendant 2 tours."
  },
  sceau: {
    nom: "Sceau", affaiblit: 0.75, tours: 2,
    texte: "ATQ de la cible ×0.75 pendant 2 tours."
  },
  percee: {
    nom: "Percée", multi: 1, multiAvantage: 1.3,
    texte: "Dégâts ×1.3 si avantage d'affinité, ×1.0 sinon."
  },
  appel: {
    nom: "Appel", bonusAssimilation: 20,
    texte: "+20 au taux d'Assimilation jusqu'à la fin du combat."
  }
};


/* ============================================================
   DEFENDRE
   ============================================================ */

var DEFENDRE_REDUCTION          = 0.5;  // degats subis ce tour
var DEFENDRE_BONUS_ASSIMILATION = 10;   // points gagnes au tour suivant


/* ============================================================
   ASSIMILER
   Le taux est visible sur le bouton avant confirmation : le
   joueur voit ses chances monter et choisit son moment.

     taux = socle
          + PV manquants de la cible (en %) x poids
          + (niveau du meilleur Echo debout - niveau cible) x poids
          + bonus d'Appel et de Defense
          - malus de rang de la cible
   ============================================================ */

var ASSIMILATION_SOCLE        = 30;
var ASSIMILATION_POIDS_PV     = 0.4;   // 100 % de PV manquants -> +40
var ASSIMILATION_POIDS_NIVEAU = 3;     // par niveau d'ecart
var ASSIMILATION_ECART_MAX    = 20;    // l'ecart de niveau est borne a +/- 20

// Jamais 0, jamais 100 : il reste toujours un espoir et toujours un risque.
var ASSIMILATION_MIN = 5;
var ASSIMILATION_MAX = 95;

/* Le rang dit a quel point un Echo se laisse convaincre.
   X n'est porte par aucune espece : il est reserve aux futurs
   Gardiens de donjon, qui se poseront sur le LIEU et pas sur
   l'espece. POINT D'ACCROCHE, rien ne le pose aujourd'hui. */
var ASSIMILATION_MALUS_RANG = { D: 0, C: 5, B: 10, A: 15, S: 25 };
var RANG_INASSIMILABLE = "X";


/* ============================================================
   LES FRAGMENTS, LA GOURDE ET LE SAVOIR

   Un fragment n'est pas une monnaie. Il appartient a UNE espece
   et ne sert qu'a elle : huit fragments minces de Komainu ne
   feront jamais monter un Baku. C'est le contraire d'une monnaie,
   et c'est voulu -- ce que tu comprends d'une creature ne se
   depense pas ailleurs.
   ============================================================ */

/* Trois tailles, de la plus commune a la plus rare. L'ordre
   compte : il va du moins au plus precieux, et plusieurs
   fonctions le parcourent dans ce sens. */
var FRAGMENT_TAILLES = ["mince", "grand", "complet"];

/* Quatre paliers de conscience. Un Echo assimile demarre a 1.

   Chaque entree donne le COUT pour quitter ce palier, pas pour
   l'atteindre : CONSCIENCE_COUTS[1] est le prix du passage de 1
   a 2. Le dernier palier n'a pas d'entree, il n'y a rien apres.

   Le fragment complet n'apparait qu'au dernier passage, et il ne
   tombe JAMAIS au combat : il se recoit. Un Echo pleinement
   conscient ne peut donc pas s'obtenir en farmant. */
var CONSCIENCE_MAX = 4;

var CONSCIENCE_COUTS = {
  1: { mince: 8, grand: 0, complet: 0 },
  2: { mince: 5, grand: 2, complet: 0 },
  3: { mince: 0, grand: 3, complet: 1 }
};

/* LA GOURDE

   Elle garde les fragments des especes que le joueur n'a pas
   encore assimilees. Sans elle, trouver un fragment de Peng avant
   d'avoir rencontre un Peng ne voudrait rien dire, et le jeu
   punirait l'ordre dans lequel on explore.

   Sa capacite est comptee PAR ESPECE et toutes tailles
   confondues : dix places veut dire dix fragments de Peng, quelle
   que soit leur taille. Au-dela, le surplus est perdu -- et
   donnerFragment() le dit a l'appelant, qui devra prevenir le
   joueur le jour ou il y aura une interface.

   Ces trois nombres sont un point de depart, pas un equilibrage.
   Ils n'ont encore ete eprouves par aucune partie. */
var GOURDE_CAPACITE_BASE    = 6;    // places par espece au premier jour
var GOURDE_CAPACITE_MAX     = 30;   // plafond absolu, savoir ou pas
var GOURDE_SAVOIR_PAR_PLACE = 20;   // points de savoir pour une place de plus

/* LES POINTS DE SAVOIR

   Ce que le joueur a compris du monde, et non ce qu'il a gagne.
   Les trois sources sont volontairement lentes et non cumulables
   par acharnement : rejouer trente combats dans la meme journee
   au meme endroit rapporte les combats, mais ni le jour ni le
   lieu. La gourde s'agrandit en sortant, pas en restant. */
var SAVOIR_PAR_COMBAT = 1;
var SAVOIR_PAR_JOUR   = 5;    // par journee DISTINCTE de jeu
var SAVOIR_PAR_LIEU   = 3;    // par lieu DISTINCT visite


/* ============================================================
   L'OUTIL D'EQUILIBRAGE
   Combien de combats Combat.rapportEquilibrage() rejoue par case.
   Plus haut = plus stable mais plus lent.
   ============================================================ */

var SIMULATIONS_PAR_CAS = 200;


/* ============================================================
   LE JOURNAL DE COMBAT

   Il accumule les lignes au lieu de les remplacer, et les fait
   defiler une par une : apres un tour a trois Echos, il se passe
   trois choses, et le joueur doit pouvoir les lire.

   Tant que le fil se deroule, les boutons restent eteints : on ne
   doit pas pouvoir jouer par-dessus le recit.
   ============================================================ */

var JOURNAL_LIGNES = 4;      // lignes gardees a l'ecran, la plus recente en bas
var DELAI_JOURNAL  = 900;    // millisecondes entre deux lignes

/* Le joueur n'est pas oblige d'attendre : un appui n'importe ou sur
   l'ecran de combat fait passer a la ligne suivante tout de suite.
   900 ms est donc un rythme de lecture confortable, pas une
   contrainte.

   Apres un appui manuel, on ferme le passage pendant ce delai : un
   seul contact du doigt peut produire deux evenements (le "clic
   fantome" du tactile), et sans ce verrou il consommerait deux
   lignes d'un coup. Meme mecanisme que le verrou de js/intro.js. */
var DELAI_APPUI = 250;

/* Opacite de chaque ligne selon son age : 0 = la plus recente.
   La liste doit compter au moins JOURNAL_LIGNES valeurs. */
var JOURNAL_OPACITES = [1, 0.62, 0.38, 0.22];


/* ============================================================
   OUTILS COMMUNS
   Trois raccourcis dont tous les fichiers se servent.
   ============================================================ */

function distanceMetres(lat1, lon1, lat2, lon2) {
  var R = 6371000, p = Math.PI / 180;
  var dLat = (lat2 - lat1) * p, dLon = (lon2 - lon1) * p;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * p) * Math.cos(lat2 * p) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function elem(id) { return document.getElementById(id); }
function etat(m) { elem("etat").textContent = m; }
