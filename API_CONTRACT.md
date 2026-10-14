# Contrat HTTP - TP1

Base : `/api`. Sauf inscription et connexion, envoyer `Authorization: Bearer <token>`.

Le contrat HTTP ne dépend pas du choix de persistance : le backend fourni utilise Mongoose et MongoDB. MongoDB conserve les utilisateurs et métadonnées ; les octets des fichiers audio restent sur le disque du serveur.

| Méthode | Route | Requête | Réponse principale |
|---|---|---|---|
| GET | `/health` | - | `{ "status": "ok" }` |
| POST | `/auth/register` | `{name,email,password}` | `201 {token,user}` |
| POST | `/auth/login` | `{email,password}` | `200 {token,user}` |
| GET | `/users/me` | JWT | `200 User` |
| PUT | `/users/me` | `{name}` + JWT | `200 User` |
| GET | `/tracks?page=1&limit=5` | JWT | `Page<Track>` |
| POST | `/tracks` | multipart : `audio`, `title` | `201 Track` |
| GET | `/tracks/:id/audio` | JWT | flux audio |
| DELETE | `/tracks/:id` | JWT | `204` (bonus) |
| GET | `/posts?page=1&limit=10` | JWT | `Page<Post>` |
| POST | `/posts` | `{content,visibility?}` + JWT | `201 Post` |
| PATCH | `/posts/:id` | `{content,visibility}` + JWT (auteur uniquement) | `200 Post` |
| DELETE | `/posts/:id` | JWT (auteur uniquement) | `204` |

`Page<Track>` contient `items`, `page`, `limit`, `total` et `pages`. Formats acceptés : MP3, WAV, OGG et M4A, 25 Mo maximum.

Erreurs courantes : `400` validation, `401` authentification, `404` ressource, `409` email déjà utilisé.

Pour `POST /tracks`, le statut `201` confirme que le fichier a été écrit dans le stockage du serveur et que ses métadonnées ont été créées. Le backend n’envoie cette réponse qu’après ces opérations. Si la création des métadonnées échoue après l’écriture du fichier, le backend tente de supprimer le fichier et renvoie une erreur ; le frontend ne doit donc considérer l’upload comme réussi qu’après la réponse `201` contenant la piste créée.

## Communauté — incréments 1 et 2

Les routes `/posts` exigent un JWT. Les publications sont actuellement
uniquement textuelles. Le corps de `POST /posts` contient `content`, une chaîne
non vide après suppression des espaces, de 2000 caractères maximum, et un
champ `visibility` facultatif (`public` par défaut). Une réponse `201` contient
`id`, `author` (`id` et `name`), `content`, `visibility` et `createdAt`.

`GET /posts` retourne `items`, `page`, `limit`, `total` et `pages`. Chaque
élément contient `id`, `author`, `content`, `visibility` et `createdAt`. La
limite par défaut est de 10 éléments et le maximum est de 20. Le fil renvoie
toutes les publications publiques ainsi que les publications privées de
l'utilisateur authentifié. Les anciens documents sans champ `visibility` sont
considérés comme publics.

`PATCH /posts/:id` modifie le texte et la visibilité. Il exige un texte non vide
de 2000 caractères maximum et une visibilité égale à `public` ou `private`.
Seul l'auteur peut modifier son post ; un post absent ou appartenant à un autre
utilisateur renvoie `404`, sans révéler s'il existe. `DELETE /posts/:id` supprime
un post uniquement si l'utilisateur authentifié en est l'auteur ; succès :
`204`, post absent ou non détenu : `404`.

Réponses d'erreur : `400` si le texte ou la visibilité est invalide et `401`
sans authentification. Les fichiers audio, les likes et les commentaires restent
à décrire lorsqu'ils seront implémentés.
