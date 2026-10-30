# Contrat HTTP

Toutes les routes sont préfixées par `/api`. Sauf inscription, connexion et
vérification de santé, elles exigent `Authorization: Bearer <JWT>`.

MongoDB conserve les comptes, les métadonnées des pistes, publications et
messages. Les octets des pistes audio restent dans `backend/data/uploads/` ;
les photos et vidéos du fil restent dans `backend/data/media/`.

| Méthode | Route | Auth. | Requête | Réponse principale |
|---|---|---|---|---|
| GET | `/health` | Non | — | `200 { "status": "ok" }` |
| POST | `/auth/register` | Non | JSON `{name,email,password}` | `201 {token,user}` |
| POST | `/auth/login` | Non | JSON `{email,password}` | `200 {token,user}` |
| GET | `/users/me` | Oui | — | `200 User` |
| PUT | `/users/me` | Oui | JSON `{name}` | `200 User` |
| GET | `/users` | Oui | — | `200 SocialMember[]` (100 membres maximum, sauf soi-même) |
| GET | `/tracks?page=1&limit=5` | Oui | — | `200 Page<Track>` |
| POST | `/tracks` | Oui | multipart `audio`, `title` | `201 Track` |
| GET | `/tracks/:id/audio` | Oui, propriétaire | — | Flux audio |
| DELETE | `/tracks/:id` | Oui, propriétaire | — | `204`, ou `409` si une publication référence la piste |
| GET | `/tracklists` | Oui | — | `200 Track[]` (bibliothèque audio personnelle) |
| GET | `/posts?page=1&limit=10` | Oui | — | `200 Page<Post>` |
| POST | `/posts` | Oui | multipart `content?`, `visibility?`, `trackId?`, `media*` | `201 Post` |
| GET | `/posts/:id/audio` | Oui, membre autorisé | — | Flux audio |
| GET | `/posts/:id/media/:mediaId` | Oui, membre autorisé | — | Flux image ou vidéo |
| PATCH | `/posts/:id` | Oui, auteur | JSON `{content,visibility}` | `200 Post` |
| DELETE | `/posts/:id` | Oui, auteur | — | `204` |
| GET | `/messages/unread-counts` | Oui | — | `200 {total,bySender}` |
| GET | `/messages/:userId` | Oui, participant | — | `200 {member,items}` |
| POST | `/messages/:userId` | Oui | JSON `{content}` | `201 DirectMessage` |

`Page<T>` contient `items`, `page`, `limit`, `total` et `pages`. Les pistes
acceptées dans la bibliothèque personnelle sont MP3, WAV, OGG et M4A, jusqu’à
25 Mo. Les anciennes catégories de pistes téléchargées depuis une publication
ne sont plus proposées ni renvoyées ; les fichiers et documents historiques ne
sont pas supprimés automatiquement.

## Publications et médias

Une publication accepte au moins un élément parmi :

- un texte de 1 à 2000 caractères ;
- une piste (`trackId`) déjà présente dans la bibliothèque audio de l’auteur ;
- jusqu’à cinq photos ou vidéos jointes dans les champs multipart `media`.

Le texte peut être vide si une piste ou un média est joint. Types de médias
acceptés : JPEG, PNG, WebP, GIF, MP4 et WebM. Chaque média est limité à 25 Mo.
Le serveur génère le nom de stockage ; le nom technique n’est jamais renvoyé à
l’interface. Les flux audio et médias exigent un JWT et respectent la
visibilité : les publications publiques sont accessibles aux membres connectés,
les publications privées uniquement à leur auteur.

`GET /posts` retourne les publications publiques et celles de l’auteur
authentifié, les plus récentes d’abord. La limite par défaut est 10 et le
maximum 20. Chaque publication renvoie `id`, `author` (`id`, `name`), `content`,
`visibility`, `audio` ou `null`, `media[]` (métadonnées uniquement) et
`createdAt`.

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
- `404` : piste, média, publication ou membre absent/non accessible.
- `409` : email déjà utilisé ou suppression d’une piste encore référencée.

Pour `POST /tracks`, le statut `201` confirme l’écriture du fichier et de ses
métadonnées. `POST /posts` avec des médias confirme l’enregistrement des
fichiers et de la publication ; les fichiers incomplets sont nettoyés en cas
d’échec de création. Les publications et messages ne sont considérés réussis
qu’après la réponse `201`.
