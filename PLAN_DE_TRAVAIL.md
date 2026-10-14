# Plan de travail — TP1 / TP2 / TP3

## Objectif
Ce fichier sert à garder une trace claire de l’avancement du projet, des validations faites, des prompts IA utilisés, et des étapes restantes. Il permet de reprendre le travail facilement à une prochaine session sans perdre le fil.

---

## État actuel

### Dernière vérification réussie
- TP1 : authentification et profil validés au niveau code et build.
- TP2 : validation audio, pagination, upload et lecture audio sécurisée validées côté code et compile Angular.
- Date de dernière validation : 2026-10-02
- Commande de preuve exécutée :
  - `cd "d:\KRA Ange\MASTER 1\Composants Logiciel\Web\AngularM1_Miage_2026_2027_TP123-main\frontend-starter"; npx vitest run src/app/shared/services/track-validation.spec.ts; npm run build`
- Résultat : 1 test suite OK, 4 tests OK, build Angular OK.

### Vérification manuelle confirmée
- Pagination : paramètres `page` et `limit` vérifiés dans le flux HTTP.
- Upload multipart : `audio` et `title` présents dans le `FormData`.
- Lecture audio : flux protégé avec JWT, réponse `Blob` et `ObjectURL` fonctionnels.
- Cas invalide : validation frontend détecte les fichiers non acceptés.
- UI TP2 : l’application fonctionne correctement et la logique est stabilisée.

### À venir
- Terminer, si nécessaire, les preuves Network manquantes du TP3.
- Vérifier manuellement l’incrément 1 avec MongoDB avant de commencer l’incrément 2.
- Choisir le nom et l’identité visuelle lorsque le MVP fonctionnel sera avancé.

---

## TP1 — État

### Fait
- Architecture du projet comprise.
- Flux Angular → service → API → MongoDB compris.
- Authentification implémentée et validée.
- JWT géré côté frontend.
- Routes protégées avec guard.
- Profil utilisateur récupéré et modifiable.
- Rapport IA TP1 structuré.
- Schéma de flux de connexion créé dans `traces-tp1/schema-flux-connexion-tp1.md`.

### À revoir / à consolider
- Vérifier et éventuellement ajouter une capture Network plus propre si nécessaire.
- Vérifier le wording final du rapport IA pour qu’il soit très lisible pour le professeur.
- Vérifier la cohérence entre le rapport IA et les fichiers de code réellement créés.

---

## TP2 — État

### Fait
- Base TP2 mise en place côté frontend.
- Service de pistes validé.
- Pagination de base fonctionnelle.
- Validation des fichiers audio en frontend ajoutée.
- Messages d’erreur et succès ajoutés.
- Upload audio validé côté logique.
- Lecture audio via Blob + ObjectURL ajoutée.
- Build Angular validée.
- Tests de validation audio passés.

### Vérifié
- Le changement de page modifie bien les paramètres `page` et `limit`.
- Le multipart upload contient `audio` et `title`.
- Le flux de lecture audio est bien un blob audio protégé par JWT.
- Le cas de fichier invalide est géré par validation frontend.
- La piste est bien lue uniquement dans le contexte autorisé du frontend connecté.

### À finaliser
- Captures finales ou preuve visuelle si besoin pour le rendu.
- Expliquer clairement le mécanisme Blob / ObjectURL pour le rapport.
- Ajouter les traces IA correspondantes dans le rapport IA.

---

## TP3 — État

### Objectif
Fiabiliser le frontend sans régression des TP1 et TP2, en traitant trois missions :
- suppression de piste avec confirmation, état dédié, notification et actualisation de la liste ;
- progression de l’upload avec états inactif, en cours (pourcentage), réussite et échec ;
- au moins trois tests frontend automatisés, indépendants du backend et de MongoDB.

Le backend fourni reste inchangé pour les missions obligatoires. Consulter `SUJET_ETUDIANT_TP3.md` et `API_CONTRACT.md` avant les modifications.

### Avancement au 2026-10-08
- Sujet TP3 lu et objectifs clarifiés.
- La suppression est déjà reliée au bouton de chaque piste et passe par `TrackService.delete()`. Une confirmation et un rechargement de la liste existent.
- Composant concerné identifié : `TracksPageComponent` gère la confirmation et les états UI ; service concerné : `TrackService` centralise le `DELETE /api/tracks/:id`. Le composant ne dépend pas directement de `HttpClient`.
- Mission 5 complétée côté code : état de suppression qui bloque les doubles clics, SnackBar Angular de succès/erreur, messages adaptés aux erreurs et rechargement après succès comme après échec. Le rechargement revient aussi à la dernière page valide si la suppression vide la page courante.
- Le backend renvoie `404` pour une piste supprimée ou non détenue par l’utilisateur ; le message frontend ne distingue volontairement pas ces cas.
- Compilation Angular après les changements : `npm run build` réussie. Capture combinée fournie et examinée : elle montre l’état final d’upload, les statuts Network `201` et `204`, puis le rechargement de la liste. Les méthodes HTTP ne sont toutefois pas visibles dans la liste des requêtes.
- À l’état initial du TP3, le frontend ne comportait que `track-validation.spec.ts` avec 4 tests ; ce test de validation audio ne couvre pas la suppression.
- Mission 6 : `TrackService.upload()` transmet les événements HTTP et demande le suivi de progression. Angular 22 utilisant Fetch par défaut (sans progression d’upload), `provideHttpClient()` est configuré avec `withXhr()`.
- Le formulaire montre une progression indéterminée si le navigateur ne fournit pas le total ; sinon elle est plafonnée à 99 % pendant le transfert et n’atteint 100 % qu’après le `201` serveur avec l’identifiant de la piste.
- Le backend écrit d’abord le fichier via Multer/diskStorage, crée ensuite les métadonnées, puis répond `201`. En cas d’échec lors de la création des métadonnées, il tente de nettoyer le fichier et renvoie une erreur. Ce contrat est documenté dans `API_CONTRACT.md`.
- Les champs du titre et du fichier ainsi que le bouton sont désactivés pendant l’upload.
- Tests frontend après missions 6 et 7 : `npm test` — 3 fichiers, 9 tests réussis. Les assertions couvrent pagination, upload/progression, erreurs, suppression et actualisation de la liste.
- Pour rendre le script `npm test` exécutable, ajout de `jsdom` comme dépendance de développement et configuration explicite de sa cible de build Angular.
- Build Angular après mission 6 : `npm run build` réussie.
- Capture d’écran du flux réel présente dans `captures/Capture d'ecran network d'un upload et d'une suppression.png`. Elle confirme l’affichage final « Enregistrement confirmé par le serveur : 100 % », un `201`, un `204` et des requêtes de liste ultérieures. Pour rendre la preuve entièrement explicite, garder également une capture du détail des requêtes (méthodes `POST`/`DELETE`) et, si possible, de la progression avant la réponse finale.
- Mission 7 complétée par des tests pour la pagination (`page` et `limit`), la gestion d’échec d’upload et la suppression confirmée suivie du rechargement. Les tests de progression couvrent en plus les options HTTP et l’attente du `201`.
- À la première lecture du sujet, aucun changement TP3 ni aucune validation TP3 n’étaient encore déclarés (historique).

### Prochaines étapes
1. Vérifier dans le navigateur la confirmation, l’état en cours, le SnackBar et la disparition après suppression ; garder une preuve Network.
2. Vérifier l’upload réel dans le navigateur/Network, dont l’événement de progression et la réponse `201`.
3. Compléter la preuve Network avec les méthodes `POST`/`DELETE` visibles et si possible une capture de progression avant 100 %.
4. Compléter le rapport IA avec les résultats et preuves des vérifications manuelles.

---

## Journal de travail

### Session du 2026-10-02
- Analyse du TP1 et du TP2.
- Validation des livrables frontend.
- Structuration du rapport IA.
- Création du schéma annoté du flux de connexion TP1.
- Ajout d’une trace de travail dans le fichier de rapport IA.
- Validation des tests et build Angular pour le frontend.
- Vérification du TP2 dans le navigateur et validé.
- Ajout d’un petit polish design sur la page de bibliothèque audio.

### Session du 2026-10-08 — TP3
- Complétion de la suppression (mission 5) avec état d’attente, SnackBar et gestion des réponses API.
- Ajout du suivi de progression de l’upload (mission 6), confirmation `201` avant 100 % et tests dédiés.
- Ajout des scénarios frontend de pagination, erreur d’upload et suppression/actualisation (mission 7).
- Vérification : `npm test` (3 fichiers, 9 tests) et `npm run build` réussis.
- Capture Network examinée : résultat final d’upload et statuts `201`/`204` visibles ; méthodes et progression intermédiaire à rendre plus explicites.
- Tests backend `npm test` : 2 tests réussis (health sans MongoDB et schémas Mongoose).

### Prochaine session
- Valider manuellement les missions 5 et 6 dans le navigateur et réaliser les captures Network.
- Exécuter les tests backend disponibles si l’environnement est prêt.
- Compléter ce plan et le rapport IA avec les preuves obtenues.

---

## Prompts IA utilisés

### TP1
- “Explique-moi l’architecture du projet et les points clés pour démarrer le TP.”
- “Explique-moi le flux Angular → service → API → MongoDB du TP1.”

### TP2
- “Explique-moi le TP2, les endpoints backend déjà fournis, et ce qu’il faut compléter côté Angular pour la pagination, l’upload et la lecture audio.”

### TP3
- “On va bosser aujourd'hui sur le tp3, déjà commence par m'expliquer ce qu'il faut faire, et on va compléter progressivement nos fichier plan de travail et rapport ia modele”
- “Fais moi les test necessaires avec les détails expliquer et nos fichier plan de travail et rapport mis à jour”

---

## Tâches manuelles restantes

- [x] Ouvrir le navigateur et tester le flux TP2 de bout en bout.
- [x] Vérifier le Network pour la pagination et l’upload.
- [x] Vérifier la lecture audio en mode Blob / ObjectURL.
- [ ] Préparer les captures finales si nécessaires.
- [x] Finaliser le rapport IA TP2 avec les preuves de validation.
- [x] Lire le sujet TP3 et relever l’état initial des missions dans le code.
- [x] Compléter la suppression avec état en cours, notifications et gestion d’erreur.
- [x] Fournir une capture Network combinant upload et suppression.
- [ ] Rendre les méthodes `POST`/`DELETE` visibles dans Network et capturer la progression avant la réponse finale.
- [x] Ajouter l’affichage de progression de l’upload, le verrouillage des contrôles et la confirmation `201` avant 100 %.
- [ ] Vérifier l’upload réel dans le navigateur/Network et conserver une preuve.
- [x] Ajouter au moins trois tests frontend ciblés, indépendants du backend.
- [x] Exécuter `npm test` (3 fichiers, 9 tests) et `npm run build`.
- [x] Exécuter les tests backend disponibles : 2 tests réussis.
- [ ] Compléter les preuves Network détaillées de suppression et d’upload progressif.
- [ ] Compléter le rapport IA TP3 avec les résultats des vérifications manuelles.

---

## Notes de projet
- Les modifications principales sont dans le frontend Angular, dans `frontend-starter`.
- Le backend ne doit pas être modifié pour les missions principales du TP2.
- Les preuves de validation passent par build, tests et vérification dans le navigateur.
- Il faut toujours conserver des traces dans le rapport IA pour garder la logique de travail visible.

---

## Projet libre — Communauté musicale (Scrum)

### Vision produit
Faire évoluer Guitar Practice Cloud en une communauté ouverte à tous les styles
de musique, et pas seulement à la guitare. Les membres pourront partager des
publications textuelles et audio, découvrir celles des autres et échanger autour
de la musique. Le nom et l’identité visuelle du projet seront choisis plus tard.

### Décisions prises le 2026-10-14
- Chaque personne doit avoir un compte pour accéder à la communauté et interagir.
- Les publications pourront contenir du texte, un audio, ou les deux.
- Une publication pourra être publique ou privée.
- Les publications publiques seront visibles uniquement par les membres connectés.
- Une publication privée ne sera visible que par son auteur.
- Le MVP inclura un fil commun, les likes et les commentaires.
- Les abonnements, messages privés et playlists sont reportés après le MVP.
- La bibliothèque privée existante est conservée.
- La publication audio est reportée au prochain Scrum ; la fonctionnalité texte
  reste la priorité de l’incrément actuel.
- Le développement se fera progressivement : une fonctionnalité à la fois, tests
  et validation avant de commencer la suivante.

### Règles Scrum retenues
- Découper le produit en incréments verticaux utilisables, de l’API jusqu’à l’écran.
- Pour chaque incrément : préciser les critères d’acceptation, analyser les fichiers
  concernés, implémenter uniquement le périmètre choisi, puis tester.
- Corriger les échecs et faire valider le résultat avant de passer au prochain incrément.
- Mettre à jour ce plan et le rapport IA après chaque fonctionnalité.
- Ne pas considérer une fonctionnalité terminée sans ses tests et une vérification
  du parcours utilisateur correspondant.

### Definition of Done pour chaque fonctionnalité
- Les critères d’acceptation sont satisfaits.
- Les règles d’accès et la validation des entrées sont vérifiées côté backend.
- Les tests ciblés concernés passent ; le build frontend passe si le frontend est touché.
- Le parcours est vérifié manuellement lorsque cela est pertinent.
- Les erreurs sont affichées clairement et aucune fonctionnalité existante ne régresse.
- Le contrat API et le rapport IA sont mis à jour si la fonctionnalité les concerne.

### Backlog produit priorisé

| Ordre | Fonctionnalité | Critères d’acceptation résumés | État |
|---|---|---|---|
| 1 | Fil multimédia et publication | Un membre connecté peut publier texte seul, audio seul ou les deux, et consulter un fil paginé avec auteur, date et écoute audio. | Partie texte réalisée ; audio explicitement reporté au prochain Scrum |
| 2 | Gestion et visibilité des publications texte | L’auteur modifie ou supprime son post et choisit public/privé ; les autres ne voient que les posts publics. | Implémenté ; tests automatisés et parcours navigateur de l’auteur OK ; isolation à confirmer avec deux comptes |
| 3 | Likes | Un membre peut aimer puis retirer son like ; le compteur et son état sont cohérents. | À faire |
| 4 | Commentaires | Un membre peut lire et ajouter un commentaire sur un post auquel il a accès. | À faire |
| 5 | Identité et présentation | Choisir un nom, adapter l’identité de l’application et préparer une démonstration complète. | À faire |

### Incrément 1 — Fil et publications texte (audio reporté au prochain Scrum)
**Objectif produit corrigé le 2026-10-14 :** un membre connecté peut publier du
texte seul, un audio seul, ou les deux. Il faut fournir au moins l’un des deux.
Le fil affiche l’auteur et la date, et permet d’écouter l’audio. L’audio doit
réutiliser les formats et la limite de 25 Mo déjà appliqués à la bibliothèque.
Dans le périmètre initial, les posts étaient publics aux membres connectés ;
la confidentialité a ensuite été ajoutée dans l’incrément 2.

**Déjà implémenté :** modèle MongoDB `Post` lié à l’auteur ; `POST /api/posts`
pour les textes ; `GET /api/posts` paginé et trié du plus récent au plus ancien ;
écran Angular de publication textuelle et fil avec auteur/date.

**Correctif de publication (2026-10-14) :** le formulaire Angular associait
`(ngSubmit)` à une balise `<form>` qui n’était pas reliée à un `FormGroup`. La
soumission native du navigateur rechargeait la page sans appeler `publish()` ;
aucun `POST` n’était donc envoyé. La balise est maintenant liée au groupe
réactif. Le test navigateur a confirmé `POST /api/posts` en `201`, puis le
rechargement `GET /api/posts` en `200` avec le post affiché.

**Décision de planification :** l’audio des publications ne sera pas développé
dans le Scrum actuel ; il est reporté au prochain Scrum. Cette décision décale
la réalisation de l’objectif multimédia, sans changer la vision produit : à
terme, une publication pourra contenir du texte, un audio, ou les deux.

**Reste à faire au prochain Scrum :** audio associé aux publications, possibilité
de publier un audio seul, endpoint de lecture audio communautaire et tests
automatisés et manuels correspondants. Les fonctionnalités de gestion et de
visibilité du texte sont déjà implémentées dans l’incrément séparé ci-dessous.

**Fichiers principaux :** `backend/src/models/Post.js`, `backend/src/app.js`,
`backend/test/api.test.js`, `API_CONTRACT.md`,
`frontend-starter/src/app/components/community-page/`,
`frontend-starter/src/app/shared/models/community-post.model.ts` et
`frontend-starter/src/app/shared/services/community.service.ts`.

**Tests automatisés :**
- `npm --prefix backend test` — 5 tests réussis, dont schéma, authentification
  obligatoire et refus des textes vides/trop longs ;
- `npm --prefix frontend-starter test` — 5 fichiers et 12 tests réussis, incluant
  un test de régression pour la soumission du formulaire ;
- `npm --prefix frontend-starter run build` — build Angular réussie.

**Vérification manuelle effectuée :** publication d’un texte dans le navigateur,
réponse `201`, rechargement du fil en `200` et post visible après insertion dans
la base configurée. Le test a créé le post de diagnostic « Test de publication
apres correction du formulaire » pour le compte connecté. L’accès non connecté
est protégé par le guard ; la validation manuelle des autres parcours reste à
faire.

**Statut de la partie texte :** backend, 5 tests réussis ; frontend, 5 fichiers
/ 12 tests réussis ; build Angular réussie ; publication navigateur confirmée.
Cela ne valide pas encore la fonctionnalité audio.

**Prochain Scrum :** cadrer puis implémenter l’audio des publications : texte et
audio facultatifs (au moins l’un requis), stockage et lecture authentifiée,
tests ciblés, puis validation du parcours multimédia dans le navigateur.

### Incrément 2 — Modifier, supprimer et choisir la visibilité (texte)
**Périmètre :** l’auteur peut modifier le texte de son post, le rendre public ou
privé, et supprimer son post après confirmation. Les autres membres ne voient
que les posts publics ; chaque auteur voit également ses propres posts privés.
Les règles de propriété sont contrôlées par l’API, pas seulement par l’interface.

**Tests automatisés :** `npm --prefix backend test` — 9 tests réussis, dont
authentification, validation de visibilité, filtre du fil selon l’utilisateur
et vérification que modification/suppression incluent l’auteur dans le filtre
MongoDB. `npm --prefix frontend-starter test` — 5 fichiers, 16 tests réussis.
`npm --prefix frontend-starter run build` — réussie.

**Vérification navigateur :** l’auteur a modifié un post, l’a rendu privé puis
public à nouveau, et a supprimé un post temporaire après confirmation. La
publication de diagnostic existante a été remise en public ; le post temporaire
créé pour tester la suppression a bien disparu. Le test avec un second compte
pour vérifier l’isolation d’un post privé reste à faire. La suppression efface
le document dans MongoDB et ne peut être annulée.
