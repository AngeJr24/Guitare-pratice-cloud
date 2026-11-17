# Contrat HTTP

Toutes les routes sont préfixées par `/api`. Sauf inscription, connexion et
vérification de santé, elles exigent `Authorization: Bearer <JWT>`.

MongoDB conserve les comptes, les métadonnées des pistes, publications,
messages et playlists. Les octets des pistes audio restent dans `backend/data/uploads/` ;
les photos et vidéos du fil restent dans `backend/data/media/`.

| Méthode | Route | Auth. | Requête | Réponse principale |
|---|---|---|---|---|
| GET | `/health` | Non | — | `200 { "status": "ok" }` |
| POST | `/auth/register` | Non | JSON `{name,email,password}` | `201 {token,user}` |
| POST | `/auth/login` | Non | JSON `{email,password}` | `200 {token,user}` |
| GET | `/users/me` | Oui | — | `200 User` |
| PUT | `/users/me` | Oui | JSON `{name}` | `200 User` |
| GET | `/users/me/photo` | Oui, propriétaire | — | Flux image |
| POST | `/users/me/photo` | Oui, propriétaire | multipart `photo` (JPEG, PNG ou WebP, max. 5 Mo) | `200 User` |
| DELETE | `/users/me/photo` | Oui, propriétaire | — | `204` |
| GET | `/members/:memberId/photo` | Oui, membre connecté | — | Flux image |
| GET | `/users` | Oui | — | `200 SocialMember[]` avec métadonnées de photo (100 membres maximum, sauf soi-même) |
| GET | `/tracks?page=1&limit=5` | Oui | — | `200 Page<Track>` |
| POST | `/tracks` | Oui | multipart `audio`, `title` | `201 Track` |
| GET | `/tracks/:id/audio` | Oui, propriétaire | — | Flux audio |
| DELETE | `/tracks/:id` | Oui, propriétaire | — | `204`, ou `409` si une publication ou playlist référence la piste |
| GET | `/tracklists` | Oui | — | `200 Track[]` (bibliothèque audio personnelle) |
| GET | `/playlists` | Oui | — | `200 PlaylistSummary[]` (privées personnelles et publiques/collaboratives) |
| POST | `/playlists` | Oui | JSON `{name,visibility?}` | `201 PlaylistSummary` |
| GET | `/playlists/:id` | Oui | — | `200 Playlist` ; playlist privée réservée à son créateur |
| PATCH | `/playlists/:id` | Oui, créateur | JSON `{name?,visibility?}` | `200 PlaylistSummary` |
| DELETE | `/playlists/:id` | Oui, créateur | — | `204` |
| POST | `/playlists/:id/tracks` | Oui, créateur ou membre si collaborative | JSON `{trackId}` (piste personnelle) | `200 Playlist` |
| DELETE | `/playlists/:id/tracks/:trackId` | Oui, créateur ou contributeur autorisé | — | `200 Playlist` mise à jour |
| GET | `/playlists/:id/tracks/:trackId/audio` | Oui, membre autorisé | — | Flux audio si playlist consultable et piste présente |
| GET | `/posts?page=1&limit=10` | Oui | — | `200 Page<Post>` |
| POST | `/posts` | Oui | multipart `content?`, `visibility?`, `media*` | `201 Post` |
| GET | `/posts/:id/audio` | Oui, membre autorisé | — | Flux audio |
| GET | `/posts/:id/media/:mediaId` | Oui, membre autorisé | — | Flux image ou vidéo |
| PATCH | `/posts/:id` | Oui, auteur | JSON `{content,visibility}` | `200 Post` |
| PUT | `/posts/:id/reaction` | Oui, membre autorisé | JSON `{reaction}` (`like`, `love`, `haha`, `wow`, `sad`, `angry`, ou `null`) | `200 Post` mis à jour |
| GET | `/posts/:id/comments` | Oui, membre autorisé | — | `200 Comment[]` (100 derniers) |
| POST | `/posts/:id/comments` | Oui, membre autorisé | JSON `{content}` (1 à 1000 caractères) | `201 Comment` |
| DELETE | `/posts/:id` | Oui, auteur | — | `204` |
| GET | `/messages/unread-counts` | Oui | — | `200 {total,bySender}` |
| GET | `/messages/:userId` | Oui, participant | — | `200 {member,items}` |
| POST | `/messages/:userId` | Oui | JSON `{content}` | `201 DirectMessage` |

`Page<T>` contient `items`, `page`, `limit`, `total` et `pages`. Les pistes
acceptées dans la bibliothèque personnelle sont MP3, WAV, OGG et M4A, jusqu’à
25 Mo. Les anciennes catégories de pistes téléchargées depuis une publication
ne sont plus proposées ni renvoyées ; les fichiers et documents historiques ne
sont pas supprimés automatiquement.

La photo de profil est conservée dans `backend/data/profile-photos/`, tandis
que MongoDB ne conserve que son nom de stockage généré par le serveur, son type
MIME et sa taille. Le nom de stockage n’est jamais renvoyé au client. La route
`/users/me/photo` est réservée au propriétaire ; `/members/:memberId/photo`
permet aux membres authentifiés de voir les avatars dans la messagerie. Un
nouvel upload remplace la photo précédente ; `DELETE /users/me/photo` la
supprime. Les types acceptés sont JPEG, PNG et WebP, avec une taille maximale
de 5 Mo.

`SocialMember` contient `id`, `name` et `profilePhoto` (`mimeType`, `size`, ou
`null`). Les messages et les conversations renvoient les mêmes métadonnées
publiques pour chaque membre, sans exposer le nom de stockage.

## Playlists

`PlaylistSummary` contient `id`, `name`, `visibility`, `owner` (`id`, `name`),
`trackCount`, `createdAt` et `updatedAt`. Une réponse `Playlist` ajoute
`tracks[]` ; chaque entrée contient `track` (`id`, `title`, `originalName`,
`mimeType`, `size`), `addedBy` (identifiant du membre) et `addedAt`. Les noms
techniques des fichiers ne sont jamais exposés.

Les visibilités acceptées sont `private`, `public` et `collaborative`. Toutes
les routes exigent un membre connecté : « public » signifie visible et
consultable par tous les membres connectés. Une playlist privée n’est visible
que par son créateur. Celui-ci peut modifier le nom et la visibilité, supprimer
la playlist définitivement, et ajouter ou retirer n’importe quelle piste. Une
playlist publique est en lecture seule pour les autres membres. Dans une
playlist collaborative, chaque membre connecté peut ajouter une piste qu’il a
lui-même importée dans sa bibliothèque et ne peut retirer que les pistes qu’il
y a ajoutées ; le créateur conserve tous les droits de gestion.

Une piste ne peut être ajoutée qu’une fois par playlist. Les pistes restent
dans la bibliothèque de leur propriétaire ; elles ne sont ni copiées ni
téléchargées par cette fonctionnalité. Pour éviter une playlist cassée, une
piste référencée ne peut pas être supprimée de sa bibliothèque (`409`) avant
d’être retirée de ses playlists. L’écoute passe par la route audio de la
playlist, qui vérifie l’accès à celle-ci ainsi que la présence de la piste. Le
nom est nettoyé et limité à 80 caractères.

## Publications et médias

Une nouvelle publication accepte au moins un élément parmi :

- un texte de 1 à 2000 caractères ;
- jusqu’à cinq photos ou vidéos jointes dans les champs multipart `media`.

Le texte peut être vide si un média est joint. Les publications audio ne sont
pas disponibles pour le moment. Types de médias acceptés : JPEG, PNG, WebP, GIF,
MP4 et WebM. Chaque média est limité à 25 Mo.
Le serveur génère le nom de stockage ; le nom technique n’est jamais renvoyé à
l’interface. Les flux audio et médias exigent un JWT et respectent la
visibilité : les publications publiques sont accessibles aux membres connectés,
les publications privées uniquement à leur auteur.

`GET /posts` retourne les publications publiques et celles de l’auteur
authentifié, les plus récentes d’abord. La limite par défaut est 10 et le
maximum 20. Chaque publication renvoie `id`, `author` (métadonnées du membre,
y compris `profilePhoto`), `content`, `visibility`, `audio` ou `null`,
`media[]` (métadonnées uniquement) et
`createdAt`, les compteurs `reactionCounts` et la réaction `myReaction` du
membre connecté (ou `null`).

Les réactions sont limitées à une par membre et par publication ; choisir une
autre réaction la remplace, et envoyer `null` retire la sienne. Les commentaires
sont conservés séparément, attribués au membre authentifié et limités à 1000
caractères. Les routes de commentaires et de réactions respectent la visibilité
des publications : les posts privés ne sont accessibles qu’à leur auteur.
Supprimer un post supprime aussi ses commentaires.

`PATCH /posts/:id` modifie le texte et la visibilité. Le texte peut rester vide
uniquement si la publication possède déjà une piste ou un média. Les valeurs de
visibilité admises sont `public` et `private`. La suppression d’une publication
par son auteur supprime aussi les fichiers photo/vidéo qu’elle contient, mais
ne supprime pas une piste audio personnelle qu’elle référence.

## Messagerie privée

`GET /users` renvoie les noms et identifiants des 100 premiers autres membres
par ordre alphabétique, sans exposer leurs emails. `GET /messages/:userId`
renvoie au plus les 100 derniers messages échangés entre le membre connecté et
le destinataire, dans l’ordre chronologique, et marque comme lus les messages
entrants de cette conversation. `GET /messages/unread-counts` retourne la somme
des messages entrants non lus et les nombres groupés par `senderId`.
`POST /messages/:userId` accepte un texte nettoyé de 1 à 2000 caractères ;
l’expéditeur est toujours déduit du JWT. Un membre ne peut pas s’envoyer un
message à lui-même. Le frontend actualise les compteurs toutes les 15 secondes
et actualise une conversation ouverte au même intervalle. Les messages anciens
sans `readAt` sont comptés comme non lus afin qu’ils ne disparaissent pas lors
de l’activation de cette fonctionnalité ; ouvrir leur conversation les marque
comme lus.

## Erreurs et confirmations

- `400` : données invalides, format de média refusé, fichier trop volumineux,
  trop de médias ou identifiant de destinataire invalide.
- `401` : JWT absent, invalide ou expiré.
- `404` : piste, playlist, média, publication ou membre absent/non accessible.
- `409` : email déjà utilisé, piste déjà présente dans une playlist ou piste
  encore référencée par une publication ou une playlist.

Pour `POST /tracks`, le statut `201` confirme l’écriture du fichier et de ses
métadonnées. `POST /posts` avec des médias confirme l’enregistrement des
fichiers et de la publication ; les fichiers incomplets sont nettoyés en cas
d’échec de création. Les publications et messages ne sont considérés réussis
qu’après la réponse `201`.
