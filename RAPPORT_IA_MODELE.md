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

## TP3 — plan de travail à venir

### Objectif du TP
Compléter la partie avancée du projet : amélioration du front, gestion des erreurs, amélioration responsive, éventuellement fonctionnalités bonus comme suppression, filtres, couverture d’album.

### Suite attendue
La finalisation dépendra du sujet exact donné pour le TP3 et des capacités de l’application.

Les axes principaux sont :
- amélioration de l’ergonomie globale ;
- finition des cartes audio ;
- gestion avancée des erreurs ;
- vérification du flux Network complet ;
- fonctionnalités bonus non indispensables.

### Ce que j’ai déjà assimilé avant d’attaquer le TP3
- architecture Angular ;
- service + API + JWT ;
- pagination et upload ;
- lecture audio sécurisée ;
- importance des tests et de la validation.

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



