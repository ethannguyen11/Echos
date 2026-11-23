/* ============================================================
   LES BRECHES PERMANENTES (LES REGLES)

   Correspondance de vocabulaire : "breche" est le mot du joueur et
   celui de ce fichier. Les "poches d'Oubli" de js/poche.js (poche,
   poches, creerPoche...) sont un AUTRE systeme : des breches
   sporadiques a minuteur. Elles seront rebaptisees plus tard.

   Ce fichier ne connait ni le DOM ni l'horloge, et ne tire jamais
   au hasard : "le jour" est TOUJOURS un parametre, et c'est
   l'appelant (js/brechesjeu.js) qui lit Date.now(). Les donnees des
   saisons viennent de js/saisons.js, les reglages de js/config.js.

   Depend de js/config.js, js/especes.js et js/saisons.js.
   ============================================================ */


/* ------------------------------------------------------------
   1. LES SAISONS : CONTROLE DES DONNEES

   Rend la liste des fautes de js/saisons.js, vide si tout va bien.
   Des phrases courtes, pour le developpeur : le joueur ne les voit
   jamais. Ne leve jamais d'exception, meme sur n'importe quoi.
   ------------------------------------------------------------ */

var BRECHES_ROLES = ["a", "b", "final"];

function moisValide(mois) {
  if (typeof mois !== "string" || !/^\d{4}-\d{2}$/.test(mois)) return false;
  var m = Number(mois.slice(5, 7));
  return m >= 1 && m <= 12;
}

function validerSaisons(saisons) {
  var fautes = [];
  if (!saisons || typeof saisons.length !== "number") return ["la liste des saisons est absente"];
  if (saisons.length === 0) fautes.push("aucune saison");

  var vus = {};
  for (var i = 0; i < saisons.length; i++) {
    var s = saisons[i];
    var ici = "saison " + i;
    if (!s || typeof s !== "object") { fautes.push(ici + " : pas un objet"); continue; }

    if (!moisValide(s.mois)) fautes.push(ici + " : mois invalide (" + s.mois + ")");
    else {
      ici = "saison " + s.mois;
      if (Object.prototype.hasOwnProperty.call(vus, s.mois)) fautes.push(ici + " : mois en double");
      vus[s.mois] = true;
    }

    if (!s.nom || typeof s.nom.fr !== "string" || s.nom.fr === "") fautes.push(ici + " : nom francais absent");

    var familles = s.familles;
    if (!familles || typeof familles !== "object" || Object.keys(familles).length === 0) {
      fautes.push(ici + " : aucune famille");
      continue;
    }

    for (var fam in familles) {
      var trio = familles[fam];
      var lieu = ici + "/" + fam;
      if (!trio || typeof trio !== "object") { fautes.push(lieu + " : pas un objet"); continue; }

      var rangs = [];
      BRECHES_ROLES.forEach(function (role) {
        var id = trio[role];
        if (typeof id !== "string" || !Object.prototype.hasOwnProperty.call(ESPECES, id)) {
          fautes.push(lieu + "." + role + " : espece inconnue (" + id + ")");
          return;
        }
        if (ESPECES[id].famille !== fam) {
          fautes.push(lieu + "." + role + " : " + id + " est de la famille " + ESPECES[id].famille);
        }
        rangs.push(ECHELLE_RANGS.indexOf(ESPECES[id].rang));
      });

      if (trio.a === trio.b || trio.b === trio.final || trio.a === trio.final) {
        fautes.push(lieu + " : a, b et final doivent etre trois especes differentes");
      }
      if (rangs.length === 3 && !(rangs[0] <= rangs[1] && rangs[1] <= rangs[2])) {
        fautes.push(lieu + " : le rang descend (a <= b <= final attendu)");
      }
    }
  }
  return fautes;
}


/* ------------------------------------------------------------
   2. LE CALENDRIER

   Un "jour" est un NUMERO DE JOUR LOCAL : le nombre de jours
   depuis le 1er janvier 1970, compte a l'heure du joueur. Le
   lendemain, c'est jour + 1, quel que soit le mois.

   jourCalendaire(instant, decalageMinutes)
     instant          millisecondes (Date.now() chez l'appelant)
     decalageMinutes  la convention de Date.getTimezoneOffset() :
                      UTC moins l'heure locale, en minutes. Paris
                      l'hiver : -60, l'ete : -120. Taipei : -480.
   L'appelant lit le decalage DE CET INSTANT-LA
   (new Date(instant).getTimezoneOffset()) : c'est ce qui rend le
   changement d'heure exact sans rien savoir des fuseaux ici.

   Les conversions jour <-> date sont du calcul pur (l'algorithme
   "days from civil" de H. Hinnant), sans objet Date : ce fichier
   ne doit pas dependre de l'horloge, meme indirectement.
   ------------------------------------------------------------ */

var MS_PAR_JOUR = 86400000;

function brecheNombre(v) { return typeof v === "number" && isFinite(v); }
function brecheEntier(v) { return brecheNombre(v) && Math.floor(v) === v; }

function jourCalendaire(instant, decalageMinutes) {
  if (!brecheNombre(instant) || !brecheNombre(decalageMinutes)) return NaN;
  return Math.floor((instant - decalageMinutes * 60000) / MS_PAR_JOUR);
}

// Le numero du jour d'une date du calendrier (mois de 1 a 12).
function jourDeLaDate(annee, mois, quantieme) {
  var y = mois <= 2 ? annee - 1 : annee;
  var ere = Math.floor(y / 400);
  var ae = y - ere * 400;
  var mp = mois > 2 ? mois - 3 : mois + 9;
  var ja = Math.floor((153 * mp + 2) / 5) + quantieme - 1;
  var je = ae * 365 + Math.floor(ae / 4) - Math.floor(ae / 100) + ja;
  return ere * 146097 + je - 719468;
}

// L'inverse : { annee, mois (1 a 12), quantieme }.
function dateDuJour(jour) {
  var z = jour + 719468;
  var ere = Math.floor(z / 146097);
  var je = z - ere * 146097;
  var ae = Math.floor((je - Math.floor(je / 1460) + Math.floor(je / 36524) - Math.floor(je / 146096)) / 365);
  var ja = je - (365 * ae + Math.floor(ae / 4) - Math.floor(ae / 100));
  var mp = Math.floor((5 * ja + 2) / 153);
  var mois = mp < 10 ? mp + 3 : mp - 9;
  return {
    annee: ae + ere * 400 + (mois <= 2 ? 1 : 0),
    mois: mois,
    quantieme: ja - Math.floor((153 * mp + 2) / 5) + 1
  };
}

// "2026-11" : l'identifiant de la saison qui contient ce jour.
function moisDuJour(jour) {
  if (!brecheEntier(jour)) return "";
  var d = dateDuJour(jour);
  return d.annee + "-" + (d.mois < 10 ? "0" : "") + d.mois;
}

// Le 1er du mois suivant (pour le mode test : "saison suivante").
function premierJourDuMoisSuivant(jour) {
  var d = dateDuJour(jour);
  return d.mois === 12 ? jourDeLaDate(d.annee + 1, 1, 1) : jourDeLaDate(d.annee, d.mois + 1, 1);
}


/* ------------------------------------------------------------
   3. QUELLE SAISON, QUELLES ARENES

   saisonDuMois : la saison ecrite pour ce mois dans js/saisons.js.
   Un mois sans saison reprend les saisons du tableau a tour de
   role : le joueur a toujours des breches. null seulement si le
   mois est illisible ou le tableau vide.

   estAreneBreche : cette arene porte-t-elle une breche ce mois-ci ?
   Il faut que la saison ait un trio pour sa categorie, et que le
   tirage deterministe (grainePourTexte de js/lieux.js, l'id et le
   mois) tombe sur 0 modulo BRECHES_UNE_ARENE_SUR.
   ------------------------------------------------------------ */

function saisonDuMois(mois, saisons) {
  if (!moisValide(mois) || !saisons || !(saisons.length > 0)) return null;
  for (var i = 0; i < saisons.length; i++) {
    if (saisons[i] && saisons[i].mois === mois) return saisons[i];
  }
  var rang = Number(mois.slice(0, 4)) * 12 + Number(mois.slice(5, 7)) - 1;
  return saisons[rang % saisons.length] || null;
}

function trioDuMois(mois, categorie, saisons) {
  var s = saisonDuMois(mois, saisons);
  if (!s || !s.familles || !Object.prototype.hasOwnProperty.call(s.familles, categorie)) return null;
  return s.familles[categorie] || null;
}

function estAreneBreche(areneId, categorie, mois, saisons) {
  if (typeof areneId !== "string" || areneId === "") return false;
  if (!trioDuMois(mois, categorie, saisons)) return false;
  return grainePourTexte("breche/" + mois + "/" + areneId) % BRECHES_UNE_ARENE_SUR === 0;
}


/* ------------------------------------------------------------
   4. LE CYCLE D'UNE BRECHE

   Une breche (seules les breches COMMENCEES sont enregistrees) :
     {
       arene_id:        "way/123456"   l'id de l'arene (js/lieux.js)
       categorie:       "temple"       la famille de ses boss
       saison:          "2026-11"      le mois ou elle a ete commencee
       cran:            0 a 7          la prochaine marche a gravir
                                       (7 : le cycle est fini)
       dernier_jour:    numero de jour de la derniere victoire, ou null
       possedee:        true apres la victoire du jour 7
       jour_possession: numero de jour de cette victoire, ou null
       victoires:       combien de victoires en tout
     }

   Les crans : 0, 1, 2 = boss A (crans 1 a 3) ; 3, 4, 5 = boss B
   (crans 1 a 3) ; 6 = boss final.

   LE CRAN DU JOUR SE CALCULE, il ne se stocke pas : chaque jour
   manque fait reculer d'un cran, plancher 0 (le jour 1 de la
   breche). Manquer un jour, c'est ne pas avoir gagne la veille.

   LES STATUTS (statutBreche) :
     "possedee"    le boss final est battu : il ne se passe plus rien
     "eteinte"     deja gagnee aujourd'hui, revient demain. Aussi
                   quand l'horloge recule avant la derniere victoire :
                   changer l'heure du telephone ne donne jamais une
                   seconde victoire.
     "active"      commencee, son boss du jour attend
     "disponible"  pas commencee (ou retombee au jour 1)
     "plafond"     pas commencee, mais BRECHES_ACTIVES_MAX breches
                   sont deja en cours : on ne peut pas l'ouvrir

   Une breche est ACTIVE au sens du plafond si elle n'est pas
   possedee et que son cran du jour est au-dessus de 0. Une breche
   retombee au jour 1 par absence libere donc sa place.

   Toutes ces fonctions sont pures : elles ne modifient rien et
   rendent des objets neufs.
   ------------------------------------------------------------ */

function etapeDuCran(cran) {
  if (!brecheEntier(cran) || cran < 0 || cran >= BRECHES_CYCLE_JOURS) return null;
  var n = BRECHES_CRANS_PAR_BOSS;
  if (cran < n) return { role: "a", cranDuRole: cran + 1, jourDuCycle: cran + 1 };
  if (cran < 2 * n) return { role: "b", cranDuRole: cran - n + 1, jourDuCycle: cran + 1 };
  return { role: "final", cranDuRole: 1, jourDuCycle: cran + 1 };
}

// La force du boss a ce cran, ou 0 si le cran n'existe pas.
function multiplicateurDuCran(cran) {
  var e = etapeDuCran(cran);
  if (!e) return 0;
  var m = BRECHES_MULT_ROLE[e.role] * (e.role === "final" ? 1 : BRECHES_MULT_CRAN[e.cranDuRole - 1]);
  return Math.round(m * 10000) / 10000;
}

function creerBreche(areneId, categorie, mois) {
  return {
    arene_id: areneId, categorie: categorie, saison: mois,
    cran: 0, dernier_jour: null, possedee: false, jour_possession: null, victoires: 0
  };
}

function copieBreche(b) {
  return {
    arene_id: b.arene_id, categorie: b.categorie, saison: b.saison,
    cran: b.cran, dernier_jour: b.dernier_jour, possedee: b.possedee,
    jour_possession: b.jour_possession, victoires: b.victoires
  };
}

function cranDuJour(breche, jour) {
  if (breche.dernier_jour === null) return 0;
  if (jour <= breche.dernier_jour) return breche.cran;
  var manques = jour - breche.dernier_jour - 1;
  return Math.max(0, breche.cran - manques);
}

// Les breches en cours ce jour-la, sans compter celle de areneId.
function compterActives(breches, jour, saufAreneId) {
  var n = 0;
  for (var i = 0; i < (breches || []).length; i++) {
    var b = breches[i];
    if (!b || b.arene_id === saufAreneId || b.possedee) continue;
    if (cranDuJour(b, jour) > 0) n++;
  }
  return n;
}

function statutBreche(breche, jour, breches) {
  if (breche.possedee) return "possedee";
  if (breche.dernier_jour !== null && jour <= breche.dernier_jour) return "eteinte";
  if (cranDuJour(breche, jour) > 0) return "active";
  return compterActives(breches, jour, breche.arene_id) >= BRECHES_ACTIVES_MAX ? "plafond" : "disponible";
}

/* Le boss qu'on affronterait ce jour-la :
     { espece, role, cran, cranDuRole, jourDuCycle, multiplicateur }
   ou null (breche possedee, ou saison sans trio pour ce lieu).
   Ne dit pas si le combat est permis : c'est le role du statut. */
function bossDuJour(breche, jour, saisons) {
  if (breche.possedee) return null;
  var cran = cranDuJour(breche, jour);
  var e = etapeDuCran(cran);
  var trio = trioDuMois(breche.saison, breche.categorie, saisons);
  if (!e || !trio) return null;
  return {
    espece: trio[e.role], role: e.role, cran: cran, cranDuRole: e.cranDuRole,
    jourDuCycle: e.jourDuCycle, multiplicateur: multiplicateurDuCran(cran)
  };
}

/* La victoire du jour. Pure : la breche passee n'est pas touchee.
   Rend
     succes  { ok: true, raison: "", breche (neuve), entree, trophee }
     refus   { ok: false, raison }
   raisons : "jour_invalide", "possedee", "eteinte", "plafond",
   "sans_boss" (la saison n'a pas de trio pour ce lieu).

   entree  la ligne du journal historique :
           { saison, arene_id, jour, cran, role, espece, multiplicateur }
   trophee { id, type: "victoire" | "possession", saison, arene_id,
             jour, espece }. Son id est deterministe : la meme
           victoire donne toujours le meme trophee. */
function gagnerBreche(breche, jour, breches, saisons) {
  if (!brecheEntier(jour)) return { ok: false, raison: "jour_invalide" };

  var statut = statutBreche(breche, jour, breches);
  if (statut === "possedee" || statut === "eteinte" || statut === "plafond") {
    return { ok: false, raison: statut };
  }

  var boss = bossDuJour(breche, jour, saisons);
  if (!boss) return { ok: false, raison: "sans_boss" };

  var b = copieBreche(breche);
  b.cran = boss.cran + 1;
  b.dernier_jour = jour;
  b.victoires += 1;
  if (boss.role === "final") {
    b.possedee = true;
    b.jour_possession = jour;
  }

  return {
    ok: true, raison: "", breche: b,
    entree: {
      saison: b.saison, arene_id: b.arene_id, jour: jour, cran: boss.cran,
      role: boss.role, espece: boss.espece, multiplicateur: boss.multiplicateur
    },
    trophee: {
      id: "breche/" + b.saison + "/" + b.arene_id + "/" + boss.cran,
      type: boss.role === "final" ? "possession" : "victoire",
      saison: b.saison, arene_id: b.arene_id, jour: jour, espece: boss.espece
    }
  };
}


/* ------------------------------------------------------------
   5. LA FORCE DU BOSS DANS LE COMBAT

   Appelee par js/ecran3.js juste apres creerCombatMulti() : les PV
   et l'ATQ de chaque adversaire sont multiplies (arrondis, jamais
   sous 1). MUTE les adversaires recus : c'est un combat tout neuf
   que personne d'autre n'a encore vu. js/combat3.js n'est pas
   touche. Un multiplicateur illisible ou sous 1 ne change rien.
   ------------------------------------------------------------ */

function appliquerForceBoss(adversaires, multiplicateur) {
  if (!brecheNombre(multiplicateur) || multiplicateur < 1 || !adversaires) return;
  for (var i = 0; i < adversaires.length; i++) {
    var u = adversaires[i];
    u.pvMax = Math.max(1, Math.round(u.pvMax * multiplicateur));
    u.pv = u.pvMax;
    u.atq = Math.max(1, Math.round(u.atq * multiplicateur));
  }
}


/* ------------------------------------------------------------
   6. LA SAISON ET SES DONNEES

   Tout ce que le joueur a des breches tient dans UN objet, celui
   que js/brechesjeu.js sauve sous CLE_BRECHES :
     {
       version:          VERSION_BRECHES
       saison:           "2026-11"   le mois en cours
       breches:          [breche]    celles commencees ce mois-ci
       journal:          [entree]    toutes les victoires, toutes saisons
       trophees:         [trophee]   tous, toutes saisons
       saisons_passees:  [bilan]     le bilan de chaque mois fini
     }

   LA BASCULE MENSUELLE (basculerSaison) remet a zero les breches
   du mois, donc le compteur de breches possedees, qui se deduit
   d'elles. Elle CONSERVE le journal, les trophees et le bilan des
   saisons passees. Les Echos assimiles et les glyphes ne sont pas
   ici (echos_joueur_v5) : la bascule ne peut pas y toucher.

   Une horloge qui recule vers un mois deja passe ne rebascule
   PAS : la saison en cours est gardee (un mois ne revient jamais).

   LE BILAN (bilanClassement) est le format prevu pour le futur
   classement : il pourra etre envoye tel quel a un serveur.
     {
       format:     BRECHES_FORMAT_CLASSEMENT
       saison:     "2026-11"
       joueur_id:  "local" aujourd'hui
       possedees:  le nombre de breches possedees ce mois-la
       breches:    [{ arene_id, jour_possession }], du plus ancien
                   au plus recent (puis par arene_id)
     }
   Les arene_id sont les id OpenStreetMap : les memes pour tous les
   joueurs, donc comparables cote serveur.

   Toutes ces fonctions sont pures : elles rendent un objet neuf.
   ------------------------------------------------------------ */

function donneesBrechesVides(mois) {
  return { version: VERSION_BRECHES, saison: mois, breches: [], journal: [], trophees: [], saisons_passees: [] };
}

// Les plus recents seulement, au-dela du plafond.
function garderLesDerniers(liste, max) {
  return liste.length > max ? liste.slice(liste.length - max) : liste.slice();
}

function copieDonnees(d) {
  return {
    version: d.version, saison: d.saison,
    breches: d.breches.map(copieBreche),
    journal: d.journal.slice(), trophees: d.trophees.slice(),
    saisons_passees: d.saisons_passees.slice()
  };
}

function compterPossedees(donnees) {
  return donnees.breches.filter(function (b) { return b.possedee && b.saison === donnees.saison; }).length;
}

function bilanClassement(donnees, joueurId) {
  var possedees = donnees.breches.filter(function (b) { return b.possedee && b.saison === donnees.saison; })
    .map(function (b) { return { arene_id: b.arene_id, jour_possession: b.jour_possession }; })
    .sort(function (x, y) {
      if (x.jour_possession !== y.jour_possession) return x.jour_possession - y.jour_possession;
      return x.arene_id < y.arene_id ? -1 : (x.arene_id > y.arene_id ? 1 : 0);
    });
  return {
    format: BRECHES_FORMAT_CLASSEMENT,
    saison: donnees.saison,
    joueur_id: joueurId,
    possedees: possedees.length,
    breches: possedees
  };
}

/* Rend { change, donnees }. change vaut false (et donnees est
   l'objet recu, intact) si le mois est illisible, le meme, ou plus
   ancien que la saison en cours.

   Au changement : le bilan du mois fini rejoint saisons_passees,
   et un trophee de saison s'ajoute s'il a possede au moins une
   breche : { id: "saison/2026-11", type: "saison", saison,
   possedees }. */
function basculerSaison(donnees, mois, joueurId) {
  if (!moisValide(mois) || mois === donnees.saison) return { change: false, donnees: donnees };
  if (moisValide(donnees.saison) && mois < donnees.saison) return { change: false, donnees: donnees };

  var d = copieDonnees(donnees);
  if (moisValide(donnees.saison)) {
    var bilan = bilanClassement(donnees, joueurId);
    d.saisons_passees = garderLesDerniers(d.saisons_passees.concat([bilan]), BRECHES_SAISONS_PASSEES_MAX);
    if (bilan.possedees > 0) {
      d.trophees = ajouterTrophee(d.trophees, {
        id: "saison/" + bilan.saison, type: "saison", saison: bilan.saison, possedees: bilan.possedees
      });
    }
  }
  d.saison = mois;
  d.breches = [];
  return { change: true, donnees: d };
}

// Un trophee de plus, sauf s'il est deja la (meme id).
function ajouterTrophee(trophees, t) {
  for (var i = 0; i < trophees.length; i++) if (trophees[i].id === t.id) return trophees.slice();
  return garderLesDerniers(trophees.concat([t]), BRECHES_TROPHEES_MAX);
}

/* La breche de cette arene dans les donnees, ou une breche neuve
   (pas encore enregistree) si elle n'a jamais ete commencee. */
function brecheDeLArene(donnees, areneId, categorie) {
  for (var i = 0; i < donnees.breches.length; i++) {
    if (donnees.breches[i].arene_id === areneId) return donnees.breches[i];
  }
  return creerBreche(areneId, categorie, donnees.saison);
}

/* La victoire du jour, inscrite dans les donnees : la breche mise a
   jour (ou ajoutee), une ligne de journal, un trophee. Rend
     { ok: true, raison: "", donnees (neuves), entree, trophee }
     { ok: false, raison }   les raisons de gagnerBreche, plus
                             "autre_saison" : le jour n'est pas dans
                             le mois des donnees (il faut basculer
                             d'abord). */
function inscrireVictoire(donnees, areneId, categorie, jour, saisons) {
  if (!brecheEntier(jour)) return { ok: false, raison: "jour_invalide" };
  if (moisDuJour(jour) !== donnees.saison) return { ok: false, raison: "autre_saison" };

  var breche = brecheDeLArene(donnees, areneId, categorie);
  var r = gagnerBreche(breche, jour, donnees.breches, saisons);
  if (!r.ok) return { ok: false, raison: r.raison };

  var d = copieDonnees(donnees);
  var place = -1;
  for (var i = 0; i < d.breches.length; i++) if (d.breches[i].arene_id === areneId) place = i;
  if (place === -1) d.breches.push(r.breche);
  else d.breches[place] = r.breche;

  d.journal = garderLesDerniers(d.journal.concat([r.entree]), BRECHES_JOURNAL_MAX);
  d.trophees = ajouterTrophee(d.trophees, r.trophee);
  return { ok: true, raison: "", donnees: d, entree: r.entree, trophee: r.trophee };
}
