/* ============================================================
   LES LANGUES
   Tout le texte que le joueur lit passe par ici.

   Le principe tient en une phrase : le code ne contient jamais
   de phrase, il contient des CLES. La phrase, elle, vit dans la
   table TEXTES ci-dessous, une fois par langue.

   Ce fichier est charge juste apres js/config.js et avant tous
   les autres : n'importe quel fichier du jeu peut appeler txt()
   des son chargement.

   Il expose quatre choses, en global comme js/joueur.js :
     TEXTES                    la table, lue par verifier.js
     txt(cle, remplacements)   la phrase, dans la langue courante
     langueCourante()          "fr" ou "en"
     definirLangue(c)          change la langue et l'enregistre

   Elle s'appelle txt() et non t(), qui serait plus court.
   Trois fichiers declarent deja une variable locale nommee t :
   js/intro.js (echapper), js/lieux.js et js/combat.js. Une
   fonction globale t() y serait MASQUEE, silencieusement : le
   jour ou l'on voudrait traduire une ligne de combat.js, l'appel
   tomberait sur un entier et non sur cette fonction. Une lettre
   de plus coute moins cher qu'un bug invisible.
   ============================================================ */


/* ------------------------------------------------------------
   1. LA TABLE

   Les cles sont PLATES et lisibles : "intro.eveil.pasDormi",
   pas un objet imbrique. Une cle plate se cherche d'un coup au
   grep, se compare d'un coup entre deux langues, et ne peut pas
   se casser sur un niveau d'imbrication oublie.

   Deux marqueurs traversent la table sans etre touches ici :

     {nom}, {voie}   remplaces plus tard, par le fichier appelant
     [m|f|n]         accord de genre

   Le second demande une attention particuliere. En francais il
   porte un accord d'adjectif ("seul[|e|·e]" donne seul / seule /
   seul·e). En anglais il n'y a pas d'accord : la meme fente
   sert aux PRONOMS (he / she / they). La syntaxe ne change pas,
   sa resolution non plus -- c'est toujours Intro.formater qui
   s'en charge, APRES txt(), jamais avant.

   ---- CE QUI MANQUE EN ANGLAIS ----
   Une cle absente de "en" n'est pas un bug : txt() retombe sur le
   francais. C'est voulu. Le recit et les repliques d'Ico ne sont
   pas encore traduits parce que les traduire demande une
   decision d'ecriture, pas une traduction. La liste des cles a
   rediger est dans le message qui accompagne ce fichier.
   ------------------------------------------------------------ */

var TEXTES = {

  fr: {

    /* --- L'ecran de choix de la langue --- */
    /* Ces deux-la sont identiques dans les deux tables : chaque
       langue s'annonce toujours dans sa propre langue. */
    "intro.langue.fr": "Français",
    "intro.langue.en": "English",

    /* --- Scene 1 : le reveil --- */
    "intro.eveil.pasDormi":              "Tu ne dormais pas.",
    "intro.eveil.pasReveille":           "Tu n'étais pas réveillé[|e|·e] non plus.",
    "intro.eveil.simplementLa":          "Tu étais simplement là, sans savoir depuis combien de temps.",
    "intro.eveil.nomRevenu":             "Puis le nom du lieu t'est revenu.",
    "intro.eveil.chercheNom":            "Puis tu as cherché le nom du lieu.",
    "intro.eveil.pasVenu":               "Il n'est pas venu.",
    "intro.eveil.tuLeConnaissais":       "Tu le connaissais. Tu es sûr[|e|·e] de l'avoir connu.",
    "intro.eveil.quelqueChoseManquait":  "Mais quelque chose manquait autour. Quelque chose qui aurait dû être là et qui ne l'était plus.",

    /* --- Scene 2 : Ico --- */
    "intro.apparition.quelquun":         "Il y avait quelqu'un.",
    "intro.ico.ah":                      "Ah.",
    "intro.ico.entenduAussi":            "Tu l'as entendu, toi aussi.",
    "intro.ico.neCherchePas":            "Ne cherche pas d'où ça venait. Ça ne vient de nulle part. Ça reste, c'est tout.",
    "intro.ico.appelleEcho":             "Les gens appellent ça un écho. Faute de mieux.",
    "intro.ico.lieuApprend":             "Un lieu apprend des choses. Pendant des siècles, parfois. Et puis on cesse de venir, on cesse de raconter, et ce qu'il savait commence à s'effacer.",
    "intro.ico.dernierMorceau":          "Ce que tu entends, c'est ce qui reste. Le dernier morceau.",
    "intro.ico.neSeRallumePas":          "Quand il s'éteint, il ne se rallume pas.",

    /* --- Scene 3 : le nom --- */
    "intro.nom.tuPeuxEntendre":          "Tu peux encore les entendre. C'est rare.",
    "intro.nom.aQuiJeParle":             "Alors autant que je sache à qui je parle.",
    "intro.nom.echo":                    "{nom}.",
    "intro.nom.jeLeRetiendrai":          "Bien. Je le retiendrai plus longtemps que la plupart.",

    /* --- Scene 4 : le genre --- */
    "intro.genre.noterQuelquePart":      "Il faudra bien que je le note quelque part.",
    "intro.genre.masculin":              "Il est venu.",
    "intro.genre.feminin":               "Elle est venue.",
    "intro.genre.neutre":                "Quelqu'un est venu.",
    "intro.genre.cestNote":              "C'est noté.",

    /* --- Scene 5 : les trois questions --- */
    "intro.voies.troisQuestions":        "Trois questions. Réponds vite, ne réfléchis pas.",

    "intro.voies.q1":                    "Un lieu que tu aimais va disparaître demain. Tu as une nuit.",
    "intro.voies.q1.archiviste":         "J'écris tout ce que j'en sais.",
    "intro.voies.q1.arpenteur":          "J'y retourne une dernière fois.",
    "intro.voies.q1.gardien":            "Je préviens les gens.",

    "intro.voies.q2":                    "Tu trouves un carnet. L'écriture est illisible, mais elle parle d'un endroit que personne ne connaît.",
    "intro.voies.q2.archiviste":         "Je le recopie avant qu'il ne s'abîme.",
    "intro.voies.q2.arpenteur":          "Je pars le chercher.",
    "intro.voies.q2.gardien":            "Je le mets à l'abri.",

    "intro.voies.q3":                    "Dernière. Un écho s'éteint devant toi. Tu ne peux pas l'arrêter.",
    "intro.voies.q3.archiviste":         "Je retiens tout ce que j'entends.",
    "intro.voies.q3.arpenteur":          "Je vais voir d'où il venait.",
    "intro.voies.q3.gardien":            "Je reste jusqu'à la fin.",

    "intro.voies.voila":                 "Voilà.",
    "intro.voies.resultat":              "Tu es un[|e|·e] {voie}. Ça se voyait déjà, mais maintenant c'est dit.",

    /* --- Scene 6 : le premier Echo --- */
    "intro.echo.pasSeul":                "Tu n'iras pas seul[|e|·e].",
    "intro.echo.traineIci":              "Celui-là traîne ici depuis longtemps. Il a survécu à trois temples et à deux villes. Ne te fie pas à son allure.",
    "intro.echo.tEcoutera":              "Il t'écoutera. Pas toujours, mais souvent.",
    "intro.echo.leResteDehors":          "Le reste, tu l'apprendras dehors.",
    "intro.echo.vaVersLieux":            "Va vers les lieux. Écoute ce qu'ils ont encore à dire.",
    "intro.echo.adieu":                  "Et {nom} — ce que tu n'assimiles pas, personne ne le fera après toi.",

    /* --- La carte de l'Echo de depart --- */
    "intro.echoDepart.niveau":           "niveau {niveau}"
  },


  en: {

    /* Chaque langue s'annonce dans sa propre langue : ces deux
       valeurs sont volontairement les memes qu'en francais. */
    "intro.langue.fr": "Français",
    "intro.langue.en": "English",

    /* Ce qui suit ne demande aucune decision d'ecriture : une
       interjection, un pseudo suivi d'un point, trois reponses
       factuelles et un libelle de niveau. Tout le reste est
       absent -- volontairement -- et retombe sur le francais. */
    "intro.ico.ah":            "Ah.",
    "intro.nom.echo":          "{nom}.",

    "intro.genre.masculin":    "He came.",
    "intro.genre.feminin":     "She came.",
    "intro.genre.neutre":      "Someone came.",

    "intro.echoDepart.niveau": "level {niveau}"
  }

};


/* ------------------------------------------------------------
   2. LA LANGUE COURANTE

   Elle vit dans sa PROPRE cle de stockage, echos_langue, a cote
   de la sauvegarde et jamais dedans.

   Deux raisons. D'abord, effacer sa partie ne doit pas
   redemander la langue : on ne rejoue pas un reglage d'interface
   parce qu'on recommence une aventure. Ensuite, la sauvegarde a
   un numero de version et des migrations ; y ajouter un champ
   aurait voulu dire une v5 et une migration de plus, pour un
   reglage qui n'a rien a voir avec la progression du joueur.
   ------------------------------------------------------------ */

var langue = LANGUE_DEFAUT;

function langueCourante() { return langue; }

function langueValide(code) {
  return LANGUES.indexOf(code) !== -1;
}

function chargerLangue() {
  try {
    var lu = localStorage.getItem(CLE_LANGUE);
    if (langueValide(lu)) langue = lu;
  } catch (e) {}
  return langue;
}

function definirLangue(code) {
  if (!langueValide(code)) return langue;
  langue = code;
  try { localStorage.setItem(CLE_LANGUE, code); } catch (e) {}
  return langue;
}


/* ------------------------------------------------------------
   3. txt()

   Trois etages, dans cet ordre :

     1. la langue courante ;
     2. si la cle y manque, le FRANCAIS -- pas la cle brute.
        Une traduction en retard doit se voir comme une phrase
        francaise au milieu de l'anglais, pas comme
        "intro.eveil.pasDormi" affiche a l'ecran ;
     3. si la cle manque partout, la cle elle-meme : c'est un
        cas de faute de frappe, et il vaut mieux le voir.
        verifier/tests.js le rend d'ailleurs impossible pour le
        script de l'intro.

   Les remplacements se font par JETONS NOMMES, {nom} et non
   une concatenation. Une concatenation impose l'ordre des mots
   du francais a toutes les langues ; un jeton nomme laisse
   chaque langue placer la valeur ou sa grammaire l'exige.

   Un jeton pour lequel on ne fournit rien est laisse INTACT.
   C'est ce qui permet a {nom} et {voie} de traverser txt() sans
   etre touches et d'arriver jusqu'a Intro.formater, qui les
   resout apres avoir resolu les accords.
   ------------------------------------------------------------ */

function txt(cle, remplacements) {
  var table = TEXTES[langue];
  var s = table ? table[cle] : undefined;

  if (typeof s !== "string" && TEXTES[LANGUE_DEFAUT]) s = TEXTES[LANGUE_DEFAUT][cle];
  if (typeof s !== "string") return String(cle);

  if (!remplacements) return s;

  return s.replace(/\{([a-zA-Z0-9_]+)\}/g, function (tout, jeton) {
    return Object.prototype.hasOwnProperty.call(remplacements, jeton)
      ? String(remplacements[jeton])
      : tout;
  });
}


chargerLangue();
