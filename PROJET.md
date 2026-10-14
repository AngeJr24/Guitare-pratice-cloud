# Projet — Communauté musicale

## L’idée

Faire évoluer la base **Guitar Practice Cloud** en une communauté destinée aux
passionnés de musique, quel que soit leur instrument ou leur style. Les membres
pourront publier des découvertes, des morceaux et des créations, puis réagir et
échanger. Le nom définitif et l’identité visuelle seront choisis plus tard.

La base existante n’est pas abandonnée : les comptes, l’authentification, le
profil et la bibliothèque audio personnelle restent utiles. La communauté
vient s’ajouter à ces fonctions.

## Règle de publication retenue

Une publication peut contenir :

- du texte seul ;
- un fichier audio seul ;
- ou du texte et un fichier audio.

Il faut fournir au moins un des deux. L’audio pourra être accompagné d’un texte
pour donner son contexte, expliquer la découverte ou présenter le morceau.
L’audio reprend les limites déjà appliquées par le projet : formats MP3, WAV,
OGG et M4A, taille maximale de 25 Mo.

Chaque compte est obligatoire pour consulter le fil ou interagir. Les posts
publics seront visibles par les membres connectés. Un post privé ne sera visible
que par son auteur. Le MVP prévoit un fil commun, les likes et les commentaires.
Abonnements, messages privés et playlists sont reportés.

## Comment le travail est organisé

Le projet avance par petits incréments Scrum. Pour chaque incrément, on définit
ce qui doit fonctionner, on implémente une fonctionnalité limitée, puis on lance
les tests et on vérifie le parcours avant de passer à la suivante. Le plan de
travail et le rapport IA consignent les décisions, les changements et les
résultats. Une fonctionnalité n’est pas considérée terminée tant que son
comportement attendu n’a pas été vérifié.

## Ce qui a été fait jusqu’ici

Le premier incrément a posé la base technique du fil et des publications
textuelles. L’audio n’est pas encore pris en charge ; conformément à la décision
de planification, cette partie est reportée au prochain Scrum.

### Backend

- Ajout d’un modèle MongoDB `Post`, lié à l’utilisateur auteur.
- Ajout de `POST /api/posts`, protégé par authentification, qui accepte un texte
  non vide de 2000 caractères maximum.
- Ajout de `GET /api/posts`, protégé par authentification, qui renvoie les posts
  dans l’ordre du plus récent au plus ancien, avec pagination et nom de l’auteur.
- Mise à jour du contrat API pour décrire ces routes dans leur état actuel.

### Frontend

- Ajout d’une page « Communauté » protégée par la connexion.
- Ajout d’un formulaire texte et d’un fil affichant l’auteur, le contenu et la
  date.
- Ajout d’un service Angular chargé des requêtes de création et de lecture.
- Redirection vers la communauté après inscription ou connexion.
- Conservation du lien vers la bibliothèque personnelle.

### Tests effectués sur cette première version

- Backend : 5 tests réussis, couvrant notamment le schéma, l’authentification
  obligatoire et le refus des textes vides ou trop longs.
- Frontend avant le correctif de soumission : 11 tests réussis sur 4 fichiers,
  dont les tests du service ajouté.
- Build Angular : réussie.

Un essai utilisateur a ensuite révélé que le formulaire affichait la page mais
ne déclenchait pas la création du post. La balise `<form>` utilisait
`(ngSubmit)` sans être liée à un `FormGroup`. Le formulaire n’était donc pas
connecté à la directive Angular qui intercepte la soumission : le navigateur
suivait sa soumission HTML native et aucun `POST /api/posts` ne partait.

Le formulaire est maintenant lié explicitement à un `FormGroup`. Un test de
composant vérifie qu’une soumission appelle bien le service avec le texte nettoyé.
Après correction initiale : frontend, 12 tests réussis sur 5 fichiers ; build Angular
réussie. Le parcours a également été vérifié dans le navigateur : réponse
`POST /api/posts` `201`, suivie du rechargement `GET /api/posts` `200`, et le
post est apparu dans le fil.

Le test manuel a créé une publication de diagnostic dans la base configurée :
« Test de publication apres correction du formulaire ». Elle est visible par le
compte utilisé pour le test.

## Comprendre et présenter une publication texte

Cette partie décrit le fonctionnement **réel du code actuel**. Elle peut servir
de support pour expliquer la fonctionnalité pendant une soutenance.

### Parcours complet : du clic à MongoDB

1. Le membre connecté saisit un texte dans la zone « Ton message ». La page
   Communauté affiche le compteur de caractères et désactive le bouton si le
   texte est vide.
2. Le formulaire Angular est relié à un `FormGroup` avec `[formGroup]="form"`.
   Cette liaison est importante : elle permet à Angular de gérer l’événement
   `(ngSubmit)` au lieu de laisser le navigateur effectuer une soumission HTML
   classique. C’était la cause du premier échec : aucun POST ne partait, même
   si le formulaire semblait présent. Un test de composant protège désormais
   cette liaison contre une régression.
3. La méthode `publish()` dans
   `frontend-starter/src/app/components/community-page/community-page.ts`
   enlève les espaces au début et à la fin avec `trim()`, vérifie que le texte
   n’est pas vide et ne dépasse pas 2000 caractères, puis passe l’interface en
   état « publication en cours ».
4. Le composant appelle `CommunityService.create(text)`. Le service, dans
   `frontend-starter/src/app/shared/services/community.service.ts`, envoie une
   requête JSON `POST /api/posts` dont le corps est `{ "content": "..." }`.
5. L’intercepteur d’authentification ajoute le JWT de la session dans l’en-tête
   `Authorization: Bearer ...`. Le navigateur envoie la requête Angular vers
   `/api/posts` ; le proxy du serveur de développement la transmet au backend
   Express sur le port 3000.
6. Le middleware `auth` du backend vérifie le JWT et place son contenu dans
   `req.auth`. Le serveur tire donc l’identité de l’auteur du token vérifié,
   et non d’un identifiant que le navigateur pourrait choisir dans le corps.
7. `POST /api/posts` dans `backend/src/app.js` récupère `content`, vérifie son
   type, applique `trim()`, puis refuse une valeur vide ou supérieure à 2000
   caractères avec une réponse `400`.
8. Si le texte est valide, le backend appelle `Post.create()` avec le contenu
   et `authorId: req.auth.sub`. Mongoose insère alors un document dans MongoDB.
   Le backend récupère ensuite le nom de l’auteur pour construire la réponse
   `201 Created`.
9. Angular reçoit la réponse de création, vide le champ, revient à la première
   page et relit le fil avec `GET /api/posts?page=1&limit=10`. Le nouveau post
   est alors affiché avec son auteur et sa date.

### Où les données sont-elles stockées ?

MongoDB est une base orientée documents : dans ce projet, on parle plutôt de
**collection** que de table. Mongoose crée/utilise la collection `posts` pour
le modèle déclaré par `mongoose.model("Post", schema)` dans
`backend/src/models/Post.js` (nom de collection MongoDB usuel : `posts`).

Le document enregistré actuellement ressemble à ceci :

```json
{
  "_id": "identifiant ObjectId généré par MongoDB",
  "authorId": "ObjectId de l’utilisateur auteur",
  "content": "Test de publication après correction du formulaire",
  "visibility": "public",
  "createdAt": "date de création",
  "updatedAt": "date de dernière mise à jour"
}
```

`_id` et `authorId` sont des identifiants MongoDB de type `ObjectId`, pas des
chaînes littérales comme dans l’exemple. Le schéma précise que `authorId`
référence le modèle `User` (`ref: "User"`). Il ne duplique donc pas le nom dans
chaque document de post. Pour préparer le fil, la requête utilise
`.populate("authorId", "name")` : Mongoose retrouve l’utilisateur correspondant
et ne sélectionne que son nom pour la réponse. Le modèle active aussi
`timestamps`, qui ajoute et met à jour `createdAt` et `updatedAt`.

Le post ne contient actuellement **ni fichier audio ni chemin de fichier**.
Les fichiers de la bibliothèque personnelle existante sont stockés sur le
disque du backend et leurs métadonnées sont conservées dans `tracks`; ce
mécanisme n’est pas encore relié aux publications de la communauté.

### Comment le fil est-il chargé ?

`GET /api/posts` exige également une authentification. Les paramètres `page` et
`limit` contrôlent la pagination : valeurs par défaut `1` et `10`, limite
maximum de `20`. Le backend lance la recherche et le comptage total en parallèle,
trie avec `createdAt: -1` (plus récent d’abord), saute les documents des pages
précédentes, et limite le nombre renvoyé. Il peuple l’auteur puis transforme
les documents MongoDB en objets de réponse plus simples : `id`, `author`,
`content`, `createdAt`. Les métadonnées `page`, `limit`, `total` et `pages`
accompagnent la liste.

Le fil retourne les posts publics et les posts privés appartenant au membre
connecté. Il ne retourne pas les posts privés des autres.

### Modifier, rendre privé/public ou supprimer un post

Les commandes de gestion sont proposées pour les posts dont l’auteur est le
membre connecté. Cette condition d’affichage améliore l’interface, mais la
sécurité est aussi appliquée par le backend :

- `PATCH /api/posts/:id` reçoit le nouveau texte et `visibility`. Le serveur
  valide le contenu, accepte uniquement `public` ou `private`, puis cherche le
  post avec les deux conditions `_id` et `authorId` du JWT. Il renvoie le post
  modifié avec le statut `200`. Si l’utilisateur n’est pas propriétaire ou si
  le post n’existe pas, il renvoie `404`.
- `DELETE /api/posts/:id` cherche également le document avec `_id` et
  `authorId`. Si le propriétaire correspond, le document est supprimé de la
  collection `posts` et le serveur renvoie `204` sans corps. Sinon, il renvoie
  `404`. L’interface demande une confirmation avant d’envoyer cette requête.

Le choix `private` masque un post aux autres membres dans le fil ; l’auteur
continue de le voir et peut le rendre public à nouveau depuis « Modifier ».
Les documents historiques sans champ `visibility` sont considérés publics.

Un changement public/privé ou une modification de texte change le document
MongoDB existant : il ne crée pas un nouveau post. Une suppression retire le
document ; il n’y a pas de corbeille ou d’annulation actuellement.

### Contrôle et gestion des erreurs

- Champ vide ou composé uniquement d’espaces : bouton désactivé côté interface ;
  le backend refuse aussi la requête avec `400` si elle lui parvient.
- Texte de plus de 2000 caractères : limite de formulaire côté interface et
  vérification indépendante côté serveur.
- Absence ou invalidité du JWT : réponse `401` par le middleware `auth`.
- Erreur de base ou erreur inattendue : journalisation côté serveur et
  transmission au gestionnaire d’erreurs Express.
- Erreur de requête côté frontend : message d’échec affiché dans la page et
  erreur journalisée dans la console du navigateur.

La réponse `201` est la confirmation que le backend a créé le document. Un
`GET 304 Not Modified` concerne uniquement la mise en cache d’une lecture ; il
ne confirme pas une création. Pour vérifier une publication, chercher le
`POST /api/posts` et son statut `201` dans l’onglet Network.

### Tests et preuve disponibles

- Test backend du schéma : vérifie la référence vers `User`, le nettoyage du
  texte, la visibilité par défaut et le refus d’un texte composé d’espaces.
- Tests backend des routes : vérifient `401` sans authentification, `400`
  pour les textes ou visibilités invalides, le filtre public/privé du fil et le
  filtrage des actions de modification/suppression par propriétaire. Les tests
  de propriété simulent les appels Mongoose et ne changent pas les données réelles.
- Test Angular de composant : soumet le formulaire, vérifie que le service est
  appelé avec le texte nettoyé et que le fil est rechargé.
- Test Angular du service : vérifie l’URL, la pagination et le corps JSON du
  POST, les requêtes `PATCH` et `DELETE`, et la visibilité transmise.
- Tests Angular de composant : vérifient la soumission, la mise à jour
  texte/visibilité et le retrait d’un post après suppression confirmée.
- Vérification navigateur avec le backend et la base configurée : le
  `POST /api/posts` a répondu `201`, puis le `GET` a répondu `200` et a renvoyé
  le post affiché dans le fil. Cette vérification a écrit le post de diagnostic
  mentionné plus haut dans la base utilisée par le backend.

### Proposition de restitution orale

> « Quand je publie, Angular valide et nettoie le texte puis envoie un POST
> JSON à l’API. L’intercepteur ajoute mon JWT. Le backend vérifie ce token,
> prend l’identifiant de l’auteur dans son contenu vérifié, valide une deuxième
> fois le texte puis crée le document avec Mongoose dans la collection MongoDB
> `posts`. Le document contient l’identifiant de l’auteur, le texte et les
> dates automatiques. L’API confirme la création avec `201`, puis le frontend
> recharge le fil paginé et affiche le post avec le nom de l’auteur. »

Cette explication décrit la version textuelle actuelle ; elle ne doit pas être
présentée comme une fonctionnalité audio déjà réalisée.

### Proposition de restitution orale pour la gestion des posts

> « Chaque publication a une visibilité `public` ou `private`. Le fil est filtré
> par l’API : un membre reçoit les posts publics et les siens privés. Pour
> modifier ou supprimer, le frontend envoie respectivement `PATCH` ou `DELETE`.
> Le serveur ne se fie pas aux boutons de l’interface : il inclut l’identifiant
> du propriétaire extrait du JWT dans la requête MongoDB. Modifier met à jour
> le document existant ; supprimer le retire de la collection. »

Les tests automatisés valident les règles et les requêtes. Le parcours de
l’auteur a aussi été vérifié dans le navigateur : modification d’un post,
passage de privé à public, puis suppression après confirmation d’un post
temporaire. Le post de diagnostic existant a été remis en public et conservé.
La vérification manuelle avec un second compte pour confirmer qu’il ne voit pas
un post privé reste à faire.

## Ce qui manque pour respecter l’idée retenue

Le code actuel n’enregistre pas de fichier audio dans une publication et ne
permet pas de l’écouter depuis le fil. Cette fonctionnalité est reportée au
prochain Scrum. La vision produit reste qu’une publication pourra contenir du
texte seul, un audio seul, ou les deux. Le travail audio comprendra :

1. permettre un envoi multipart avec texte facultatif et audio facultatif ;
2. refuser une publication si texte et audio sont tous deux absents ;
3. enregistrer les métadonnées de l’audio avec le post et réutiliser les
   contrôles de format et de taille du projet ;
4. afficher les publications textuelles et les pièces audio dans le fil ;
5. permettre l’écoute authentifiée de l’audio ;
6. ajouter et réussir les tests ciblés, puis vérifier le parcours avec MongoDB.

La confidentialité publique/privée et la gestion des publications textuelles
sont déjà implémentées ; leur vérification manuelle avec un second compte reste
à faire. Les likes et les commentaires viendront après les prochains incréments.

## Backlog produit

1. **Audio dans les publications — prochain Scrum** : permettre de joindre un
   audio seul ou avec du texte, puis de l’écouter depuis le fil.
2. **Likes** : aimer et retirer son like.
3. **Commentaires** : lire et commenter les publications accessibles.
4. **Présentation** : choisir le nom, l’identité visuelle et préparer la
   démonstration.

## État au 14 octobre 2026

La publication, la modification, la suppression et la visibilité des posts
textuels sont implémentées ; les tests automatisés et le build passent. La
modification, le changement de visibilité et la suppression ont aussi été
vérifiés dans le navigateur avec le compte auteur. La vérification d’un post
privé avec un second compte reste à faire. L’audio est explicitement reporté au
prochain Scrum ; cette planification ne change pas la vision produit finale.
