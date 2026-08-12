# Échos — Cinématique d'ouverture

Script intégral. Le moteur (`js/intro.js`) doit reprendre ces répliques **mot pour mot**.

**Conventions d'écriture :**
- `récit` — texte narratif : italique, gris, centré
- `Ico` — réplique parlée : romain, blanc, aligné à gauche
- `{nom}` — pseudo saisi par le joueur
- `{voie}` — voie calculée
- `[m|f|n]` — accord de genre, dans l'ordre masculin / féminin / neutre
- `— pause Xs —` — attente automatique, sans tap
- `— lieu —` — insertion du nom réel du lieu (`lieuZero`), avec effet de tremblement
- `— repli —` — ligne de substitution si le GPS ou Overpass n'a rien donné

---

## Scène 1 — Le réveil

*Écran noir. Le GPS est lancé en arrière-plan dès la première ligne.*

— pause 2s —

récit : *Tu ne dormais pas.*

récit : *Tu n'étais pas réveillé[|e|·e] non plus.*

récit : *Tu étais simplement là, sans savoir depuis combien de temps.*

— pause 1,5s —

récit : *Puis le nom du lieu t'est revenu.*

— lieu —
**{lieuZero}**

— repli —
récit : *Puis tu as cherché le nom du lieu.*
récit : *Il n'est pas venu.*

— pause 2s —

récit : *Tu le connaissais. Tu es sûr[|e|·e] de l'avoir connu.*

récit : *Mais quelque chose manquait autour. Quelque chose qui aurait dû être là et qui ne l'était plus.*

---

## Scène 2 — Ico

— apparition —

récit : *Il y avait quelqu'un.*

Ico : Ah.

Ico : Tu l'as entendu, toi aussi.

— pause 1s —

Ico : Ne cherche pas d'où ça venait. Ça ne vient de nulle part. Ça reste, c'est tout.

Ico : Les gens appellent ça un écho. Faute de mieux.

— pause 1s —

Ico : Un lieu apprend des choses. Pendant des siècles, parfois. Et puis on cesse de venir, on cesse de raconter, et ce qu'il savait commence à s'effacer.

Ico : Ce que tu entends, c'est ce qui reste. Le dernier morceau.

Ico : Quand il s'éteint, il ne se rallume pas.

---

## Scène 3 — Le nom

Ico : Tu peux encore les entendre. C'est rare.

Ico : Alors autant que je sache à qui je parle.

— saisie : nom (16 caractères maximum) —

Ico : {nom}.

Ico : Bien. Je le retiendrai plus longtemps que la plupart.

---

## Scène 4 — Le genre

*Ico se tourne à demi, comme s'il parlait à quelqu'un d'autre — ou à personne.*

Ico : Il faudra bien que je le note quelque part.

— choix : genre —
- « Il est venu. » → `m`
- « Elle est venue. » → `f`
- « Quelqu'un est venu. » → `n`

Ico : C'est noté.

---

## Scène 5 — Les trois questions

Ico : Trois questions. Réponds vite, ne réfléchis pas.

— pause 1s —

### Question 1

Ico : Un lieu que tu aimais va disparaître demain. Tu as une nuit.

— choix : voie1 —
- « J'écris tout ce que j'en sais. » → `archiviste`
- « J'y retourne une dernière fois. » → `arpenteur`
- « Je préviens les gens. » → `gardien`

### Question 2

Ico : Tu trouves un carnet. L'écriture est illisible, mais elle parle d'un endroit que personne ne connaît.

— choix : voie2 —
- « Je le recopie avant qu'il ne s'abîme. » → `archiviste`
- « Je pars le chercher. » → `arpenteur`
- « Je le mets à l'abri. » → `gardien`

### Question 3

Ico : Dernière. Un écho s'éteint devant toi. Tu ne peux pas l'arrêter.

— choix : voie3 —
- « Je retiens tout ce que j'entends. » → `archiviste`
- « Je vais voir d'où il venait. » → `arpenteur`
- « Je reste jusqu'à la fin. » → `gardien`

— calculVoie —

— pause 1,5s —

Ico : Voilà.

Ico : Tu es un[|e|·e] {voie}. Ça se voyait déjà, mais maintenant c'est dit.

---

## Scène 6 — Le premier Écho

Ico : Tu n'iras pas seul[|e|·e].

Ico : Celui-là traîne ici depuis longtemps. Il a survécu à trois temples et à deux villes. Ne te fie pas à son allure.

— echoDepart —

Ico : Il t'écoutera. Pas toujours, mais souvent.

— pause 1s —

Ico : Le reste, tu l'apprendras dehors.

Ico : Va vers les lieux. Écoute ce qu'ils ont encore à dire.

Ico : Et {nom} — ce que tu n'assimiles pas, personne ne le fera après toi.

— fin —

---

## Notes pour le moteur

1. **Un tap = une ligne.** Les répliques d'Ico séparées par une ligne vide sont des étapes distinctes.
2. Les `— pause Xs —` s'écoulent seules, sans attendre de tap, mais un tap doit pouvoir les abréger.
3. La ligne `{lieuZero}` s'affiche **plus grande et centrée**, avec un léger tremblement, et non comme une réplique ordinaire.
4. Si le GPS échoue, remplacer la totalité du bloc `— lieu —` par le bloc `— repli —` : deux lignes de récit au lieu de l'affichage du nom.
5. Les accords `[|e|·e]` apparaissent dans quatre lignes : Scène 1 (deux fois), Scène 5 (une fois), Scène 6 (une fois). Vérifier les trois genres sur chacune.
6. Le mot `{voie}` s'écrit en minuscules : *archiviste*, *arpenteur*, *gardien*.
