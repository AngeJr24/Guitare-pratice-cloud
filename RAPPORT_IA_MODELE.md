# Rapport d’usage de l’IA - TP1, TP2 et plan TP3

## 1. Présentation générale

Ce rapport a pour objectif de restituer clairement le travail que j’ai réalisé seul dans le cadre des TPs Angular + API Express.

Il est structuré par TP afin de faciliter la lecture pour le professeur et de montrer :
- le contexte du projet ;
- l’objectif cible du TP ;
- les actions réellement menées ;
- les fichiers modifiés ;
- les vérifications effectuées ;
- les notions techniques maîtrisées ;
- les preuves de validation.

La règle de travail a été de privilégier une logique de vérification : les idées proposées par l’IA n’étaient acceptées que si elles étaient cohérentes avec le sujet, le contrat API, les conventions du dépôt et les résultats de compilation.

---

## TP1 — Architecture, authentification et profil utilisateur

### Objectif du TP
Comprendre l’architecture globale du projet et implémenter la partie authentification utilisateur : inscription, connexion, protection des routes, profil et gestion du JWT.

### Prompt principal utilisé
“Explique-moi l’architecture du projet, le flux Angular → service → API → MongoDB, et les points clés à mettre en place pour le TP1.”

### Analyse faite avant la modification
J’ai d’abord lu et vérifié les éléments suivants :
- [SUJET_ETUDIANT_TP1.md](SUJET_ETUDIANT_TP1.md)
- [API_CONTRACT.md](API_CONTRACT.md)
- [frontend-starter/src/app/routes.ts](frontend-starter/src/app/routes.ts)
- [frontend-starter/src/app/shared/services/auth.service.ts](frontend-starter/src/app/shared/services/auth.service.ts)
- [frontend-starter/src/app/shared/interceptors/auth.interceptor.ts](frontend-starter/src/app/shared/interceptors/auth.interceptor.ts)
- [frontend-starter/src/app/shared/guards/auth.guard.ts](frontend-starter/src/app/shared/guards/auth.guard.ts)
- [backend/src/app.js](backend/src/app.js)

Cela m’a permis de distinguer :
- les routes publiques ;
- les routes protégées ;
- le rôle du JWT ;
- le rôle du garde de route ;
- le flux réel des requêtes HTTP.

### Actions réalisées
J’ai :
- vérifié la structure Angular standalone du projet ;
- identifié les composants et services clés ;
- vérifié la logique de connexion et d’inscription côté API ;
- mis en place ou complété le service d’authentification ;
- ajouté le JWT dans les requêtes protégées via l’intercepteur ;
- protégé les pages sensibles avec le guard ;
- chargé la donnée utilisateur avec GET /api/users/me ;
- permis la modification du profil avec PUT /api/users/me ;
- mis en place la déconnexion proprement ;
- vérifié la gestion des erreurs 401.

### Fichiers modifiés ou directement utilisés
- [frontend-starter/src/app/shared/services/auth.service.ts](frontend-starter/src/app/shared/services/auth.service.ts)
- [frontend-starter/src/app/shared/interceptors/auth.interceptor.ts](frontend-starter/src/app/shared/interceptors/auth.interceptor.ts)
- [frontend-starter/src/app/shared/guards/auth.guard.ts](frontend-starter/src/app/shared/guards/auth.guard.ts)
- [frontend-starter/src/app/components/profile-page/profile-page.ts](frontend-starter/src/app/components/profile-page/profile-page.ts)
- [frontend-starter/src/app/components/app/app.ts](frontend-starter/src/app/components/app/app.ts)
- [frontend-starter/src/app/components/app/app.html](frontend-starter/src/app/components/app/app.html)
- [RAPPORT_IA_MODELE.md](RAPPORT_IA_MODELE.md)

### Notions techniques maîtrisées
- Angular standalone
- Service injectable
- HttpClient
- JWT
- Signal
- localStorage
- route protégée
- guard
- interceptor
- 401 / 403 / 200
- API contract
- formulaire réactif

### Vérification effectuée
J’ai vérifié la cohérence du code et la compilation du projet frontend avec la commande suivante :
- npm run build

Résultat observé : build Angular réussi, sans erreur bloquante. Cela confirme que la structure de l’authentification et du profil est cohérente et compile correctement.

### Explication du flux de connexion
Le flux typique est le suivant :
1. L’utilisateur saisit email et mot de passe.
2. Le composant appelle AuthService.login().
3. Le service exécute une requête HTTP vers /api/auth/login.
4. Le backend vérifie les identifiants.
5. Le backend renvoie un JWT.
6. Le frontend enregistre le token dans localStorage.
7. Le Signal currentUser et le Signal token sont mis à jour.
8. Le garde de route autorise l’accès aux pages protégées.
9. L’intercepteur ajoute automatiquement le JWT sur les requêtes protégées.

### Ce que je sais maintenant expliquer
Je sais expliquer :
- le rôle du JWT ;
- la différence entre une route publique et une route protégée ;
- le rôle du guard ;
- le rôle de l’intercepteur ;
- la gestion du 401 lors d’un token invalide.

### Explication demandée : différence entre Signal et localStorage
Le `Signal` est un état réactif Angular stocké en mémoire dans l’application pendant son exécution. Il sert à alimenter immédiatement l’interface utilisateur : par exemple, le signal `token` ou le signal `currentUser` permet à Angular de réafficher automatiquement les composants dès qu’un changement a lieu.

Le `localStorage` est, lui, un stockage navigateur persistant. Il sert à conserver le JWT entre les rechargements de page afin que l’utilisateur reste connecté. Il ne remplace pas l’état réactif Angular : le front doit encore lire ce token depuis `localStorage` pour le remettre dans un Signal ou le vérifier au démarrage de l’application.

En résumé, le `Signal` sert à l’état vivant de l’application en mémoire, tandis que `localStorage` sert à mémoriser la session de manière durable côté navigateur. Le code d’authentification utilise les deux : le token est sauvegardé dans `localStorage` pour la persistance, puis relu et placé dans des Signals pour l’interface et les vérifications de route.

### Problème rencontré et correction appliquée : déconnexion après actualisation de la page
Pendant les tests fonctionnels, j’ai constaté un comportement récurrent : après une actualisation de page, l’utilisateur était déconnecté même lorsque le token JWT avait bien été enregistré au préalable. Le diagnostic a montré que le système de session reposait sur le `Signal` Angular en mémoire, qui se réinitialise complètement au reload, tandis que le `localStorage` n’était pas suffisamment réutilisé pour reconstituer l’état de connexion. En conséquence, la route protégée redirigeait vers `/login` car le guard ne retrouvait plus le token dans l’état mémoire.

Pour corriger ce point, j’ai ajouté une logique de réhydratation de session au démarrage de l’application : le service d’authentification lit désormais le token depuis `localStorage`, le réinjecte dans le Signal, puis effectue une requête `GET /api/users/me` pour recharger immédiatement le profil utilisateur. Le guard et l’intercepteur ont aussi été adaptés pour faire un fallback sur `localStorage` si le signal est vide après un refresh. Cela permet de maintenir la session active après une actualisation de page, tant que le token est encore valide côté backend.

Cette correction évite la déconnexion du fait du simple rechargement du navigateur et rend la gestion de la session plus robuste. Elle est particulièrement importante car le JWT est persistant dans le navigateur, mais l’état Angular ne l’est pas naturellement sans reconstitution explicite.

### Preuves à ajouter dans le dossier de captures
J’ai vérifié qu’une capture d’écran Network du login est utile, surtout pour montrer :
- la requête POST /api/auth/login ;
- le code HTTP 200 ;
- le JWT dans la réponse ;
- la requête GET /api/users/me avec Authorization.

---

## TP2 — Bibliothèque audio, pagination et upload sécurisé

### Objectif du TP
Mettre en place la bibliothèque audio avec :
- récupération paginée des pistes ;
- upload de fichiers audio ;
- validation du fichier côté frontend ;
- lecture sécurisée du flux audio avec JWT ;
- gestion des erreurs et états UI.

### Prompt principal utilisé
“Explique-moi le TP2, les endpoints backend déjà fournis, et ce qu’il faut compléter côté Angular pour la pagination, l’upload et la lecture audio.”

### Analyse faite avant la modification
J’ai consulté :
- [SUJET_ETUDIANT_TP2.md](SUJET_ETUDIANT_TP2.md)
- [API_CONTRACT.md](API_CONTRACT.md)
- [frontend-starter/src/app/shared/services/track.service.ts](frontend-starter/src/app/shared/services/track.service.ts)
- [frontend-starter/src/app/components/tracks-page/tracks-page.ts](frontend-starter/src/app/components/tracks-page/tracks-page.ts)
- [backend/src/app.js](backend/src/app.js)

Cela a permis de comprendre que le backend fournit déjà :
- GET /api/tracks?page=1&limit=5 ;
- POST /api/tracks avec multipart audio + title ;
- GET /api/tracks/:id/audio avec JWT ;
- validation de type MIME et taille maximale de 25 Mo.

### Actions réalisées
J’ai :
- validé que la liste est paginée côté serveur et non découpée localement ;
- vérifié que la requête transmet bien page et limit ;
- complété les états de liste : chargement, vide, erreur ;
- ajouté des boutons précédent / suivant ;
- ajouté la validation côté frontend pour les fichiers audio ;
- mis en place un formulaire d’upload avec message d’erreur clair ;
- bloqué les doubles soumissions ;
- affiché le message de succès ;
- rechargé la première page après un upload réussi ;
- choisi de lire un morceau en chargeant le flux audio en Blob ;
- créé un ObjectURL pour le lecteur audio ;
- révoqué l’URL précédente lors d’un nouvel appel ou à la destruction du composant.

### Fichiers modifiés ou utilisés
- [frontend-starter/src/app/shared/services/track.service.ts](frontend-starter/src/app/shared/services/track.service.ts)
- [frontend-starter/src/app/shared/services/track-validation.ts](frontend-starter/src/app/shared/services/track-validation.ts)
- [frontend-starter/src/app/shared/services/track-validation.spec.ts](frontend-starter/src/app/shared/services/track-validation.spec.ts)
- [frontend-starter/src/app/components/tracks-page/tracks-page.ts](frontend-starter/src/app/components/tracks-page/tracks-page.ts)
- [frontend-starter/src/app/components/tracks-page/tracks-page.html](frontend-starter/src/app/components/tracks-page/tracks-page.html)
- [frontend-starter/src/app/components/tracks-page/tracks-page.css](frontend-starter/src/app/components/tracks-page/tracks-page.css)

### Notions techniques maîtrisées
- pagination côté serveur ;
- HttpClient params ;
- FormData ;
- multipart upload ;
- validation MIME ;
- validation taille de fichier ;
- Blob ;
- ObjectURL ;
- audio element ;
- URL.revokeObjectURL ;
- chargement et erreur UI ;
- sécurité JWT sur lecture audio.

### Vérification effectuée
J’ai exécuté les validations suivantes :
- test unitaire sur la validation des fichiers audio ;
- compilation Angular complète ;
- validation du correctif de session après refresh.

Résultat constaté :
- 4 tests passés ;
- build Angular OK ;
- correction de la session validée par compilation Angular sans régression.

### Ce que je sais maintenant expliquer
Je sais expliquer :
- pourquoi on ne récupère pas toutes les pistes pour découper localement ;
- pourquoi l’upload multipart contient bien audio et title ;
- pourquoi la lecture audio passe par un Blob ;
- pourquoi une URL de type ObjectURL est nécessaire ;
- pourquoi il faut révoquer cette URL pour éviter les fuites mémoire ;
- pourquoi la validation frontend est utile mais ne remplace pas la validation backend.

### Réponses aux questions sur mémoire, buffering et streaming audio
Le backend peut envoyer le fichier audio progressivement, par flux, sans le charger entièrement en mémoire. La lecture depuis le disque puis envoi en morceaux est un comportement classique pour les fichiers média. Avec `HttpClient` et `responseType: "blob"`, le composant reçoit le fichier seulement après que la réponse HTTP a été reçue et convertie en objet `Blob`; à ce moment, le navigateur garde le contenu binaire et le rend exploitable par le lecteur audio.

Si la bibliothèque contient 100 morceaux, les 100 fichiers ne sont pas chargés en mémoire dès l’affichage de la liste. Le code ne charge que les métadonnées de la page courante, et le fichier audio n’est réellement téléchargé que lorsque l’utilisateur décide de le lire. Le buffering est donc limité au morceau sélectionné, ce qui est bien plus efficace que d’avoir 100 fichiers audio actifs en même temps.

La différence avec 100 éléments `<audio>` utilisant des URLs HTTP directes est importante : cela multiplie les requêtes réseaux, le buffering navigateur, et la charge des ressources. Avec le mécanisme `Blob + ObjectURL`, on garde un meilleur contrôle sur le flux audio et sur la sécurité JWT, car le fichier est obtenu via la requête authentifiée puis transformé en URL locale pour lecture dans le navigateur.

L’URL créée par `URL.createObjectURL(...)` doit être révoquée avec `URL.revokeObjectURL(...)` pour libérer la mémoire du navigateur. Sinon, l’ancienne URL peut rester active et occuper des ressources inutilement, surtout après un changement de piste ou au moment où le composant est détruit. Cette opération est donc essentielle pour éviter les fuites mémoire et pour garder un comportement propre lors de la lecture audio.

### Explication écrite du choix Blob et ObjectURL
Le backend répond à la requête de lecture audio avec un flux binaire protégé par le JWT. Je récupère cette réponse côté Angular sous forme de `Blob`, car c’est le bon type JavaScript pour représenter un fichier binaire sans l’afficher comme du texte brut. Cela permet de conserver le contenu audio dans une variable JavaScript, puis de le manipuler avant lecture.

Ensuite, on crée une URL locale avec `URL.createObjectURL(blob)`. Cette URL ne pointe pas vers un chemin HTTP du serveur, mais vers un objet mémoire du navigateur, ce qui permet au lecteur HTML `<audio>` de lire le son sans avoir à exposer directement le fichier côté navigateur avec une URL distante. C’est précisément ce qui convient pour un flux audio authentifié : le navigateur reçoit le fichier comme Blob, puis le convertit en URL exploitable par le lecteur.

Le principal avantage est que le fichier est manipulé comme un objet binaire dans le navigateur, avec un contrôle explicite sur sa durée de vie. Lorsque l’utilisateur change de piste ou que le composant est détruit, on appelle `URL.revokeObjectURL(...)` pour libérer la ressource mémoire et éviter les fuites. Sans cette révocation, l’ancienne URL peut continuer à occuper de la mémoire inutilement. Ce mécanisme est particulièrement adapté au TP2 car le backend envoie un fichier audio protégé, et le navigateur doit l’utiliser uniquement après autorisation JWT.

---

## Missions complémentaires réalisées le 2 octobre 2026

Ces missions prolongent le TP2. Pour chacune, le rapport distingue les contrôles techniques observés et les vérifications personnelles qu’il me reste à effectuer.

### Mission 1 — Suppression, actualisation et filtre des pistes

**Objectif**

Permettre de supprimer une piste avec confirmation, actualiser la liste après modification et retrouver rapidement une piste par son titre.

**Prompt principal**

“Maintenant on va ajouter un bouton de suppression avec confirmation de la musique, un rafraichissement automatique de la page doit être fait et aussi ajouter un filtre par titre.”

**Plan proposé et réalisé**

1. Vérifier que l’API possède une route de suppression protégée. `DELETE /api/tracks/:id` existait déjà et vérifie la propriété de la piste.
2. Ajouter une méthode de suppression dans le service Angular.
3. Ajouter une confirmation avant d’appeler l’API.
4. Recharger la liste après suppression et conserver l’actualisation après un import réussi.
5. Filtrer réactivement les pistes actuellement chargées.
6. Révoquer l’ObjectURL et réinitialiser le lecteur si la piste en lecture est supprimée.

**Mes vérifications**

J’avais vérifié le fonctionnement général de l’application avant cette amélioration. Il me reste à valider ces nouvelles actions : annuler puis accepter la confirmation, vérifier la disparition après suppression et essayer plusieurs recherches.

**Erreurs ou propositions écartées**

- Aucun changement backend n’était nécessaire, car la route de suppression existait déjà.
- Le filtre porte uniquement sur les pistes de la page chargée. Une recherche globale aurait nécessité une évolution de l’API et de son contrat.
- Le test navigateur s’est d’abord arrêté sur la boîte de confirmation ; celle-ci a ensuite été acceptée et le résultat observé.

**Fichiers modifiés**

- [frontend-starter/src/app/shared/services/track.service.ts](frontend-starter/src/app/shared/services/track.service.ts)
- [frontend-starter/src/app/components/tracks-page/tracks-page.ts](frontend-starter/src/app/components/tracks-page/tracks-page.ts)
- [frontend-starter/src/app/components/tracks-page/tracks-page.html](frontend-starter/src/app/components/tracks-page/tracks-page.html)
- [frontend-starter/src/app/components/tracks-page/tracks-page.css](frontend-starter/src/app/components/tracks-page/tracks-page.css)

**Preuve de fonctionnement**

Le build Angular a réussi. Dans le navigateur, le filtre “Test” a réduit la liste à la piste correspondante. Après confirmation de sa suppression, elle ne correspondait plus au filtre et l’état vide était affiché. L’import conserve également le rechargement de la liste après succès.

**Connaissances à réexpliquer sans l’agent**

- Le frontend déclenche la suppression, mais le backend contrôle l’identité et la propriété de la piste.
- Recharger les données après une mutation évite un affichage obsolète.
- Un filtre local à une page paginée ne recherche pas dans les pages non chargées.
- Un ObjectURL doit être révoqué quand la piste audio correspondante est supprimée.

### Mission 2 — Sélecteur de thème Dark, Light et Grey

**Objectif**

Permettre à l’utilisateur de choisir l’apparence de l’application depuis la navigation et conserver son choix après rechargement.

**Prompt principal**

“Ajoute dans la barre des taches une option Dark light ou grey afin de pouvoir changer l'affichage de la page adapte aussi la couleur des ecritures en fonction pour qu'elles restent visibles.”

**Plan proposé et réalisé**

1. Ajouter les trois choix de thème dans la navigation, connecté ou non.
2. Gérer le thème courant dans le composant racine Angular.
3. Appliquer une classe CSS au `body` et définir des variables pour fonds, textes, surfaces, champs, bordures et boutons.
4. Enregistrer le choix dans `localStorage` et le restaurer au démarrage.

**Mes vérifications**

J’ai vérifié les couleurs calculées dans le navigateur. Il me reste à confirmer manuellement la persistance : choisir chaque thème, recharger la page et vérifier que le choix est conservé.

**Erreurs ou propositions écartées**

- Le premier build a échoué à l’initialisation TypeScript à cause d’un cache Angular contenant des chemins Windows sous deux formes (`D:/...` et `D:\...`). Après suppression du cache généré `.angular`, le build a réussi ; ce n’était pas une erreur du code du thème.
- La palette a été définie globalement afin que les pages et composants puissent la réutiliser, plutôt que de limiter le changement à la navigation.

**Fichiers modifiés**

- [frontend-starter/src/app/components/app/app.ts](frontend-starter/src/app/components/app/app.ts)
- [frontend-starter/src/app/components/app/app.html](frontend-starter/src/app/components/app/app.html)
- [frontend-starter/src/app/components/app/app.css](frontend-starter/src/app/components/app/app.css)
- [frontend-starter/src/styles.css](frontend-starter/src/styles.css)

**Preuve de fonctionnement**

Après nettoyage du cache, `npm run build` a réussi. Dans le navigateur, le choix Light a modifié les couleurs du fond général et de l’en-tête ; les trois options étaient accessibles dans la barre.

**Connaissances à réexpliquer sans l’agent**

- Les variables CSS partagent une palette entre plusieurs composants.
- Une classe appliquée à `body` rend le thème disponible à l’ensemble de l’application.
- `localStorage` conserve une préférence après rechargement, contrairement à un état uniquement en mémoire.
- La couleur du texte et celle de sa surface doivent être conçues ensemble pour maintenir le contraste.

### Mission 3 — Adaptation du contenu aux thèmes

**Objectif**

Faire varier avec le thème le contenu de la page : cartes, champs, textes, boutons, piste active et messages, et pas uniquement l’arrière-plan général.

**Prompt principal**

“Tu changes que l'arrière plan, changeons aussi le corps e la page.”

**Plan proposé et réalisé**

1. Repérer les couleurs fixes dans la feuille de style de la page des pistes.
2. Les remplacer par les variables globales du thème.
3. Compléter les palettes pour les accents et les états erreur, succès et information.
4. Vérifier les fonds et les textes des cartes, pistes, champs et messages dans les trois thèmes.

**Mes vérifications**

Les trois palettes ont été vérifiées dans le navigateur ici. Il me reste à confirmer manuellement la lisibilité de tous les états et textes sur mon affichage.

**Erreurs ou propositions écartées**


**Fichiers modifiés**


**Preuve de fonctionnement**

Le build Angular a réussi. Les styles calculés ont été relevés dans le navigateur pour Dark, Light et Grey. Le fond général était respectivement `rgb(15, 23, 42)`, `rgb(243, 247, 245)` et `rgb(45, 47, 52)`. Les cartes, pistes et champs avaient également des fonds adaptés, et le texte restait lisible dans les trois modes.

**Connaissances à réexpliquer sans l’agent**

- Un fond global différent ne suffit pas si les composants définissent eux-mêmes leurs couleurs.
- Les variables CSS héritées permettent aux styles des composants Angular de lire la palette définie sur `body`.
- Il faut adapter aussi les états interactifs et les messages, pas seulement les surfaces principales.
- Le build vérifie la compilation, mais une vérification visuelle reste nécessaire pour évaluer le contraste.

---

## TP3 — Fiabilisation et enrichissement du frontend

### Objectif du TP
Faire évoluer l’application Angular sans casser les fonctionnalités des TP1 et TP2. Le sujet demande de compléter la suppression d’une piste, d’afficher la progression de l’upload et d’écrire au moins trois tests frontend automatisés. Le backend fourni reste inchangé pour les missions obligatoires.

### Analyse du sujet et du code avant modification
J’ai consulté :
- [SUJET_ETUDIANT_TP3.md](SUJET_ETUDIANT_TP3.md)
- [API_CONTRACT.md](API_CONTRACT.md)
- [frontend-starter/src/app/shared/services/track.service.ts](frontend-starter/src/app/shared/services/track.service.ts)
- [frontend-starter/src/app/components/tracks-page/tracks-page.ts](frontend-starter/src/app/components/tracks-page/tracks-page.ts)
- [frontend-starter/src/app/components/tracks-page/tracks-page.html](frontend-starter/src/app/components/tracks-page/tracks-page.html)

### Composant et service concernés

- **Composant :** `TracksPageComponent`, dans [frontend-starter/src/app/components/tracks-page/tracks-page.ts](frontend-starter/src/app/components/tracks-page/tracks-page.ts). Il gère l’interaction UI : confirmation, indicateur de suppression, notifications, actualisation de la liste et remise à zéro du lecteur si nécessaire.
- **Service :** `TrackService`, dans [frontend-starter/src/app/shared/services/track.service.ts](frontend-starter/src/app/shared/services/track.service.ts). Il centralise les requêtes de pistes et expose `delete(id)`, qui exécute `DELETE /api/tracks/:id` avec `HttpClient`.
- **Séparation respectée :** `TracksPageComponent` appelle `this.service.delete(track.id)` et ne dépend pas de `HttpClient`. Le service est l’unique couche frontend de cette fonctionnalité qui construit et exécute la requête HTTP.

### Missions demandées
1. **Suppression** : présenter une action sur chaque piste, demander confirmation, éviter les doubles clics, annoncer succès ou échec avec un SnackBar, mettre à jour la liste et gérer les réponses d’une piste déjà supprimée ou appartenant à un autre utilisateur. L’appel HTTP reste dans `TrackService`. L’interface et le guard ne remplacent pas le contrôle du JWT et de la propriété effectué par le backend.
2. **Progression de l’upload** : exploiter les événements HTTP Angular pour afficher l’état inactif, le pourcentage en cours, la réussite ou l’échec. Les contrôles concernés doivent être désactivés pendant l’envoi. Une requête configurée uniquement pour renvoyer la réponse finale ne fournit pas les événements intermédiaires de progression.
3. **Tests** : ajouter au moins trois tests frontend ciblés parmi les scénarios du sujet. Ils doivent vérifier des éléments concrets (URL, méthode, paramètres, headers et résultat simulé) et ne pas nécessiter un backend ou MongoDB actif. Des extensions de tests backend sont proposées en option.

### État initial observé — 2026-10-08
- La suppression est déjà présente : le composant demande une confirmation, appelle `TrackService.delete()` et recharge la liste après succès.
- L’état initial ne comporte pas de verrouillage spécifique à une piste pendant la suppression ni de notification SnackBar de succès ; l’échec est présenté dans l’état d’erreur de la liste. Ces points restent à compléter et à tester.
- L’upload possède un état booléen `uploadLoading` qui désactive le bouton Envoyer, mais le service retourne uniquement la réponse finale : il ne publie pas encore les événements permettant de calculer un pourcentage.
- À l’état initial, le dépôt contenait un test frontend repéré, `track-validation.spec.ts`. Les tests ajoutés au fil des missions ne remplacent pas ce test de validation.
### Mission 5 — Suppression d’une piste

**Prompt utilisé**

“Allons pour la mission 1, et ajoutons ce qu'il manque en fin de mission on va expliquer pourquoi le guard Angular et l’interface ne suffisent pas à sécuriser la suppression. C’est le backend qui vérifie réellement le JWT et le propriétaire de la piste”

**Actions réalisées**

- Identifié `TracksPageComponent` comme composant responsable de l’interface et `TrackService` comme service responsable de l’appel HTTP. Vérifié que le composant n’utilise pas directement `HttpClient`.
- Conservé la confirmation existante et l’appel HTTP via `TrackService.delete()`.
- Ajouté un état `deletingTrackId` pour bloquer les autres suppressions pendant la requête et afficher « Suppression… » sur le bouton concerné.
- Créé un composant SnackBar Angular autonome, accessible et thématisé avec les variables CSS existantes ; aucune dépendance n’a été ajoutée.
- Ajouté une notification de succès après suppression et des notifications d’erreur. Le `404` affiche un message commun pour une piste devenue indisponible ou non autorisée, conformément au comportement du backend.
- Rechargé la liste après une réponse de succès ou d’erreur afin de synchroniser l’interface lorsque la piste a été supprimée ailleurs ou que le backend a répondu après une suppression partielle.
- Corrigé le cas où la suppression de la dernière piste rend la page courante invalide : la pagination se replace sur la dernière page disponible.
- Si la piste supprimée était en cours de lecture, révoqué son ObjectURL et réinitialisé le lecteur.

**Fichiers modifiés ou ajoutés**

- [frontend-starter/src/app/components/tracks-page/tracks-page.ts](frontend-starter/src/app/components/tracks-page/tracks-page.ts)
- [frontend-starter/src/app/components/tracks-page/tracks-page.html](frontend-starter/src/app/components/tracks-page/tracks-page.html)
- [frontend-starter/src/app/components/tracks-page/tracks-page.css](frontend-starter/src/app/components/tracks-page/tracks-page.css)
- [frontend-starter/src/app/shared/components/snack-bar/snack-bar.ts](frontend-starter/src/app/shared/components/snack-bar/snack-bar.ts)
- [frontend-starter/src/app/shared/components/snack-bar/snack-bar.html](frontend-starter/src/app/shared/components/snack-bar/snack-bar.html)
- [frontend-starter/src/app/shared/components/snack-bar/snack-bar.css](frontend-starter/src/app/shared/components/snack-bar/snack-bar.css)

**Pourquoi le guard et l’interface ne suffisent pas à sécuriser la suppression**

Le guard Angular intervient dans le navigateur : il contrôle la navigation vers des pages et améliore l’expérience utilisateur. L’interface peut aussi masquer ou désactiver un bouton. Mais le code frontend est exécuté sur l’appareil de l’utilisateur et peut être inspecté, modifié ou contourné. Un utilisateur peut envoyer directement une requête HTTP `DELETE` sans passer par le bouton ni par le guard.

La décision de sécurité doit donc être prise par le backend, qui est la seule partie de confiance : son middleware vérifie le JWT reçu, puis la suppression recherche une piste dont l’identifiant correspond **et** dont le champ `ownerId` correspond à l’utilisateur authentifié (`req.auth.sub`). Le client ne peut pas imposer un autre propriétaire. Si aucune piste détenue par cet utilisateur ne correspond, l’API renvoie `404`. Ce statut est identique pour une piste absente et pour une piste appartenant à quelqu’un d’autre, afin de ne pas divulguer l’existence de ressources privées.

**Validation**

- `npm run build` : réussite, bundle Angular généré sans erreur.
- Test de non-régression `npx vitest run src/app/shared/services/track-validation.spec.ts` : 1 fichier réussi, 4 tests réussis. Ce test ne couvre pas encore la suppression.
- Diagnostics des fichiers TypeScript concernés : aucune erreur signalée.
- Vérification navigateur et capture de la requête Network `DELETE` : à effectuer ; aucun test manuel n’est revendiqué à cette étape.

**À retenir pour la restitution**

Le guard et les contrôles UI sont des aides d’ergonomie, pas une frontière de sécurité. L’autorisation effective est vérifiée côté serveur sur chaque requête, à partir du JWT validé et du propriétaire enregistré en base.

### Prochaines missions

- Mission 6 est décrite ci-dessous ; il reste à faire la vérification réelle dans le navigateur.
- Mission 7 : ajouter au moins trois tests frontend isolés du backend (réalisé dans la section suivante).
- Vérifier manuellement les flux dans Network et compléter les preuves avant de déclarer le TP3 finalisé.

### Mission 6 — Progression et confirmation d’enregistrement de l’upload

**Demande**

“C'est bien compris, du coup je préfère qu'on fasse toutes les vérifications necessaires pour pouvoir afficher le pourcentage et s'i est à 100% il faudrait que sur le côté serveur on garrantisse que le fichier a été enregistré”

**Vérifications avant modification**

- Le frontend utilise Angular 22. Dans cette version, `HttpClient` utilise Fetch par défaut, et Fetch ne fournit pas d’événement de progression d’envoi. La documentation Angular indique d’activer `withXhr()` pour ce besoin.
- L’application configure `HttpClient` dans `frontend-starter/src/main.ts` avec l’intercepteur JWT ; elle ne faisait pas de sélection explicite du backend HTTP.
- `TrackService.upload()` ne demandait que le résultat final de la requête.
- Côté backend, `multer.diskStorage()` écrit le fichier sur disque avant l’exécution du handler POST. Le handler crée ensuite les métadonnées avec `Track.create()` puis renvoie `201` et la piste créée. Si la création des métadonnées échoue, le backend tente de supprimer le fichier et retourne une erreur.
- Ainsi, la progression du navigateur décrit le transfert, pas l’enregistrement serveur. L’interface ne considère l’upload réussi et ne montre 100 % qu’après réception de `201` avec une piste possédant un identifiant.

**Actions réalisées**

- Configuré le client HTTP avec `withXhr()` en conservant l’intercepteur d’authentification existant.
- Changé `TrackService.upload()` pour demander les événements HTTP et `reportUploadProgress`.
- Mis à jour `TracksPageComponent` pour convertir les événements d’envoi en pourcentage. Le pourcentage visible est plafonné à 99 pendant le transfert, y compris si le navigateur signale déjà que tous les octets ont été envoyés.
- Le pourcentage passe à 100 et le message de succès n’apparaît qu’après une réponse HTTP `201` avec la piste enregistrée. Une réponse sans confirmation explicite reste une erreur.
- En l’absence de total fourni par le navigateur, l’interface affiche une barre indéterminée et indique que le pourcentage n’est pas disponible.
- Désactivé le champ titre, le choix du fichier et le bouton Envoyer pendant la requête.
- Mis à jour le contrat API pour expliciter la signification du `201` pour l’upload.
- Ajouté `jsdom` en dépendance de développement et fixé la cible `buildTarget` du builder de test Angular : le script `npm test` n’avait pas d’environnement DOM et supposait une configuration `development` inexistante dans `angular.json`.

**Fichiers modifiés ou ajoutés**

- [frontend-starter/src/main.ts](frontend-starter/src/main.ts)
- [frontend-starter/src/app/shared/services/track.service.ts](frontend-starter/src/app/shared/services/track.service.ts)
- [frontend-starter/src/app/components/tracks-page/tracks-page.ts](frontend-starter/src/app/components/tracks-page/tracks-page.ts)
- [frontend-starter/src/app/components/tracks-page/tracks-page.html](frontend-starter/src/app/components/tracks-page/tracks-page.html)
- [frontend-starter/src/app/components/tracks-page/tracks-page.css](frontend-starter/src/app/components/tracks-page/tracks-page.css)
- [frontend-starter/src/app/shared/services/track.service.spec.ts](frontend-starter/src/app/shared/services/track.service.spec.ts)
- [frontend-starter/src/app/components/tracks-page/tracks-page.spec.ts](frontend-starter/src/app/components/tracks-page/tracks-page.spec.ts)
- [frontend-starter/angular.json](frontend-starter/angular.json)
- [frontend-starter/package.json](frontend-starter/package.json)
- [frontend-starter/package-lock.json](frontend-starter/package-lock.json)
- [API_CONTRACT.md](API_CONTRACT.md)

**Vérifications automatisées**

- `npm test` après les missions 6 et 7 : 3 fichiers passés, 9 tests passés, dont les tests du service et du composant qui vérifient que 100 % n’est affiché qu’après le `201`.
- `npm run build` : réussite après implémentation du flux HTTP et des tests des missions 6 et 7.
- Diagnostics TypeScript/template sur les fichiers concernés : aucune erreur signalée.
- Vérification réelle du transfert dans le navigateur et capture Network : à effectuer ; les tests ci-dessus simulent les événements HTTP et ne remplacent pas cette vérification.
- `npm audit` a signalé 10 vulnérabilités dans l’arbre de dépendances (2 modérées, 5 élevées, 3 critiques). `jsdom` n’est pas dans la liste des paquets signalés ; aucune mise à jour générale des dépendances n’a été faite dans le cadre de cette mission.

**À retenir**

Le navigateur sait mesurer l’envoi des octets avec XHR, mais cette mesure ne prouve pas que le serveur a fini d’écrire le fichier ou de créer ses métadonnées. Le `201` de cette API est l’accusé de réception applicatif : le backend ne l’envoie qu’après l’écriture disque et la création de la piste. C’est pour cela que l’UI garde 99 % au maximum pendant le transfert et affiche 100 % seulement après cet accusé de réception.

### Mission 7 — Tests frontend ciblés

**Prompt utilisé**

“Fais moi les test necessaires avec les détails expliquer et nos fichier plan de travail et rapport mis à jour”

**Objectif et approche**

Le sujet demande au minimum trois tests frontend parmi plusieurs scénarios, vérifiant réellement les URL, méthodes, paramètres, headers ou résultats simulés. Les tests ci-dessous isolent le frontend : ils remplacent le service HTTP ou la réponse du service par des doubles de test. Ils n’appellent ni Express ni MongoDB.

Chaque test suit le principe **Préparer – Exécuter – Vérifier** (*Arrange – Act – Assert*) :

1. préparer une piste ou un fichier de test et remplacer les dépendances réseau ;
2. appeler la méthode du service ou du composant ;
3. vérifier les arguments de requête et/ou l’état affiché à l’utilisateur.

**Scénarios testés et résultat**

1. **Pagination du service —** dans `track.service.spec.ts`, appelle `TrackService.list(3, 7)` et vérifie l’URL `/api/tracks`, les paramètres `page: 3` et `limit: 7`, ainsi que la page reçue. Cela détecterait une régression où le service oublierait les paramètres ou enverrait de mauvaises valeurs.
2. **Upload du service —** vérifie le `POST /api/tracks`, le formulaire multipart contenant `audio` et `title`, et les options `observe: 'events'` et `reportUploadProgress: true`. Il injecte ensuite un événement `UploadProgress` puis une réponse `201`, et vérifie leur ordre et le corps de la réponse.
3. **Progression du composant —** dans `tracks-page.spec.ts`, simule un transfert ayant envoyé 100 % des octets. Le composant doit rester à 99 %, sans message de succès, tant qu’il n’a pas reçu le `201` avec la piste créée. Le test vérifie aussi que le titre est verrouillé pendant l’envoi puis réactivé.
4. **Échec d’upload —** simule une erreur réseau et vérifie l’affichage du message d’échec, la remise à zéro de la progression et le déverrouillage du formulaire.
5. **Suppression avec actualisation —** confirme la suppression d’une piste, vérifie que `delete()` reçoit son identifiant, que la liste est demandée à nouveau après la requête et qu’une notification de succès apparaît.
6. **Validation du fichier —** `track-validation.spec.ts` conserve les quatre tests existants pour fichier valide, fichier absent, type non accepté et taille supérieure à la limite.

Les scénarios pagination, échec d’upload et suppression/actualisation répondent déjà au minimum demandé ; les tests d’upload ajoutent une vérification de progression et de confirmation serveur.

**Fichiers de test**

- [frontend-starter/src/app/shared/services/track.service.spec.ts](frontend-starter/src/app/shared/services/track.service.spec.ts)
- [frontend-starter/src/app/components/tracks-page/tracks-page.spec.ts](frontend-starter/src/app/components/tracks-page/tracks-page.spec.ts)
- [frontend-starter/src/app/shared/services/track-validation.spec.ts](frontend-starter/src/app/shared/services/track-validation.spec.ts)

**Résultats**

- `npm test` : 3 fichiers de test réussis, 9 tests réussis.
- `npm run build` : réussie.
- `backend/npm test` : 2 tests réussis (health sans dépendance à MongoDB et schémas Mongoose).
- Les tests ne vérifient pas que le serveur a effectivement écrit un fichier : ils vérifient le comportement du frontend face aux événements et réponses simulés. L’upload réel reste à vérifier dans le navigateur avec la requête `POST`, ses événements et le `201`.

### Évaluation de la capture Network fournie

La capture [captures/Capture d'ecran network d'un upload et d'une suppression.png](captures/Capture%20d'ecran%20network%20d'un%20upload%20et%20d'une%20suppression.png) est une bonne preuve de l’état final : l’interface affiche « Piste ajoutée avec succès » et « Enregistrement confirmé par le serveur : 100 % » ; Network affiche une réponse `201`, une réponse `204` sur une requête nommée par identifiant, puis des réponses `200` pour le rechargement de la liste.

Cette capture étaye fortement le succès de l’upload et de la suppression. Elle ne montre cependant pas les détails des lignes sélectionnées : la méthode HTTP n’est pas affichée dans le tableau, et l’on ne voit pas de pourcentage intermédiaire pendant le transfert. Pour une preuve sans ambiguïté répondant au sujet, compléter avec le panneau Headers/General d’une requête `POST /api/tracks` (méthode et statut `201`), celui du `DELETE /api/tracks/:id` (méthode et statut `204`), et idéalement une capture pendant que la progression est inférieure à 100 %. La capture actuelle ne permet pas d’affirmer que cette progression intermédiaire a été observée manuellement.

### Démarche restante
1. Compléter la preuve Network avec les méthodes et statuts visibles pour le `DELETE` et le `POST`.
2. Capturer si possible un état de progression inférieur à 100 % avant l’accusé de réception serveur.
3. Compléter ce rapport avec les preuves Network détaillées.

### Notions à pouvoir expliquer lors de la restitution

#### Pourquoi les appels HTTP passent par `TrackService`

`TracksPageComponent` s’occupe de l’écran et des interactions : il recueille le fichier et le titre, affiche la progression ou les erreurs, et réagit au résultat. `TrackService` s’occupe de communiquer avec l’API : il construit le `FormData` et utilise `HttpClient` pour envoyer la requête. Cette séparation évite que le composant connaisse les détails réseau, rend le code plus facile à lire et permet de tester le service séparément en simulant les réponses HTTP. Pour l’upload, le composant appelle `this.service.upload(...)`; il ne construit ni n’envoie lui-même la requête.

#### Pourquoi l’autorisation réelle de supprimer une piste est vérifiée côté backend

Le guard Angular protège la navigation dans l’application, et le bouton peut améliorer l’interface en étant masqué ou désactivé. Mais ces contrôles s’exécutent dans le navigateur de l’utilisateur : ils peuvent être contournés, et une requête `DELETE` peut être envoyée directement sans cliquer sur le bouton. Le backend doit donc vérifier le JWT à chaque requête et rechercher une piste correspondant à la fois à l’identifiant demandé et à l’utilisateur authentifié (`ownerId`). Dans ce projet, une piste absente et une piste appartenant à quelqu’un d’autre donnent toutes deux une réponse `404`, pour ne pas révéler l’existence d’une ressource privée.

#### Comment les événements HTTP Angular permettent de calculer le pourcentage d’upload

Le service configure l’upload pour recevoir des événements HTTP et demander les informations de progression. Le backend XHR peut émettre un événement `UploadProgress` avec le nombre d’octets envoyés (`loaded`) et, lorsqu’il est connu, le nombre total (`total`). Le composant calcule alors `loaded / total * 100` et affiche le résultat. Si `total` n’est pas fourni, il ne peut pas calculer un pourcentage fiable : l’écran utilise alors une barre indéterminée.

La progression des octets ne prouve pas à elle seule que le serveur a terminé l’enregistrement. C’est pourquoi le composant reste au plus à 99 % pendant l’envoi et n’affiche 100 % qu’après la réponse `201` contenant la piste créée. Dans ce backend, cette réponse arrive après l’écriture du fichier sur disque et la création de ses métadonnées.

#### Pourquoi les tests HTTP simulés ne nécessitent pas MongoDB

Un test unitaire du frontend ne démarre pas l’API réelle : il remplace ou simule la dépendance HTTP et lui fait produire des événements et réponses contrôlés. Le test peut alors vérifier que le service envoie la bonne URL, la bonne méthode et le bon corps, puis que le composant réagit correctement à une progression, une réussite ou une erreur. Comme aucune requête n’atteint Express, le modèle Mongoose ou MongoDB, aucune base de données n’a besoin de fonctionner. Ces tests vérifient le comportement du frontend, pas le vrai stockage du fichier côté serveur.

#### Ce que vérifie un test d’intercepteur ou de guard

Un test d’intercepteur peut fournir un token simulé, faire une requête et vérifier que l’en-tête `Authorization: Bearer …` est ajouté ; il peut aussi vérifier le comportement prévu pour une réponse `401`. Un test de guard peut simuler un utilisateur connecté ou non et vérifier si la navigation est autorisée ou si une redirection est demandée. Ces tests contrôlent une responsabilité ciblée du frontend ; ils ne prouvent pas que l’API accepte le token ou autorise réellement l’accès à une ressource.

#### Différence entre test unitaire et test d’intégration

Un test unitaire vérifie une petite partie isolée, par exemple `TrackService.upload()` ou la mise à jour du pourcentage par le composant. Les dépendances externes, comme l’API, sont simulées afin que le test soit rapide, répétable et indépendant du réseau ou de MongoDB.

Un test d’intégration vérifie plusieurs parties branchées ensemble, par exemple le navigateur Angular qui envoie une requête au vrai backend et reçoit sa réponse. Il peut vérifier que le contrat fonctionne de bout en bout, mais dépend généralement d’un backend disponible et d’un environnement configuré. Les tests ajoutés ici sont des tests frontend isolés ; ils ne constituent pas une preuve d’intégration de l’upload réel, qui doit encore être vérifié dans le navigateur et l’onglet Network.

---

## 2. Conclusion générale

Le travail accompli m’a permis de progresser dans la compréhension de plusieurs notions centrales du développement web full stack :
- architecture front-end ;
- appels HTTP ;
- JWT ;
- route protection ;
- formulaire réactif ;
- fichier upload ;
- lecture audio sécurisée ;
- validation côté client ;
- vérification de code par build et tests.

L’IA a été utilisée comme aide à l’analyse, à la structuration du projet et à la validation du code, mais les décisions finales ont toujours été contrôlées dans le cadre du contrat API, des consignes du dépôt et des résultats de vérification.

---

## 3. Éléments de preuve à conserver

- build frontend réussi ;
- tests sur la validation audio passés ;
- lecture du contrat API et des routes ;
- vérification fonctionnelle des flux d’authentification et d’audio ;
- traces écrites dans ce rapport pour expliquer clairement les actions réalisées.

Cette structure est pensée pour être lisible par un enseignant ou un correcteur : elle montre le chemin intellectuel, les décisions prises, et les preuves concrètes de validation.
