# Schéma annoté du flux de connexion — TP1

## 1. Vue d’ensemble

Le flux de connexion suit le chemin suivant :

```text
Utilisateur
  ↓
Composant Angular (login/register)
  ↓
AuthService
  ↓
HttpClient
  ↓
POST /api/auth/login
  ↓
API Express
  ↓
Validation des identifiants
  ↓
MongoDB
  ↓
JWT généré par le backend
  ↓
Réponse HTTP avec token + user
  ↓
Angular stocke le JWT dans localStorage
  ↓
Signal token/currentUser mis à jour
  ↓
AuthGuard autorise ou bloque les routes protégées
  ↓
Redirection vers la page d’accueil / page protégée
```

---

## 2. Détail par étape

### Étape 1 — L’utilisateur remplit le formulaire
Le composant de connexion récupère :
- email
- mot de passe

Il ne transmet pas directement les données à MongoDB. Il passe par le service Angular.

### Étape 2 — Le composant appelle le service
Le composant appelle une méthode du service comme :
- `AuthService.login(email, password)`

Le service est responsable de l’appel HTTP.

### Étape 3 — HttpClient envoie la requête HTTP
L’appel est de type :
- `POST /api/auth/login`

Le corps JSON contient :

```json
{
  "email": "demo@example.com",
  "password": "Demo1234!"
}
```

### Étape 4 — Le backend valide les informations
Le backend Express reçoit la requête, vérifie :
- que l’email existe ;
- que le mot de passe correspond ;
- qu’un utilisateur valide est trouvé dans MongoDB.

Si tout est correct, le backend génère un JWT.

### Étape 5 — Le backend renvoie le token
La réponse HTTP ressemble à ceci :

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "name": "Demo",
    "email": "demo@example.com"
  }
}
```

### Étape 6 — Le frontend stocke le token
Le frontend enregistre le token dans `localStorage` :

```ts
localStorage.setItem('gpc_token', response.token);
```

Cela permet de conserver la session même après recharge de la page.

### Étape 7 — Mise à jour de l’état Angular
Le service met aussi à jour les Signals du projet :
- `token`
- `currentUser`

Ce sont des variables réactives Angular, utilisées pour l’interface utilisateur.

### Étape 8 — Le guard vérifie l’accès aux routes
Les routes protégées passent par le guard :
- [frontend-starter/src/app/shared/guards/auth.guard.ts](../frontend-starter/src/app/shared/guards/auth.guard.ts)

Le guard vérifie si le token existe. Si le token est absent, il redirige vers `/login`.

### Étape 9 — Les requêtes suivantes sont authentifiées
L’intercepteur ajoute automatiquement le header :

```http
Authorization: Bearer <token>
```

Voir :
- [frontend-starter/src/app/shared/interceptors/auth.interceptor.ts](../frontend-starter/src/app/shared/interceptors/auth.interceptor.ts)

Cela concerne notamment :
- GET /api/users/me
- PUT /api/users/me
- autres routes protégées

---

## 3. Exemple de flux annoté

```text
[Utilisateur]
    |
    | saisit email + password
    v
[Composant LoginPage]
    |
    | .login(email, password)
    v
[AuthService]
    |
    | HttpClient.post('/api/auth/login', { email, password })
    v
[API Express /api/auth/login]
    |
    | vérifie email + password
    | demande à MongoDB l’utilisateur
    v
[MongoDB]
    |
    | retourne l’utilisateur trouvé
    v
[Backend]
    |
    | génère un JWT
    | renvoie { token, user }
    v
[Frontend]
    |
    | sauvegarde le token dans localStorage
    | met à jour currentUser et token
    v
[AuthGuard]
    |
    | autorise l’accès si le token existe
    v
[Page protégée /tracks ou /profile]
```

---

## 4. Ce que cela montre

Ce schéma illustre trois points fondamentaux du TP1 :

1. La séparation des responsabilités
   - composant : interface
   - service : logique métier / HTTP
   - backend : validation + génération JWT
   - MongoDB : persistance des données

2. L’authentification par token
   - le JWT identifie l’utilisateur
   - le backend l’utilise pour vérifier les accès

3. La protection des routes
   - le guard bloque l’accès sans token
   - l’intercepteur ajoute automatiquement le token aux requêtes protégées

---

## 5. Rôle des fichiers principaux

- [frontend-starter/src/app/shared/services/auth.service.ts](../frontend-starter/src/app/shared/services/auth.service.ts) : logique d’authentification
- [frontend-starter/src/app/shared/interceptors/auth.interceptor.ts](../frontend-starter/src/app/shared/interceptors/auth.interceptor.ts) : ajoute le JWT à chaque requête
- [frontend-starter/src/app/shared/guards/auth.guard.ts](../frontend-starter/src/app/shared/guards/auth.guard.ts) : protège les routes
- [frontend-starter/src/app/routes.ts](../frontend-starter/src/app/routes.ts) : déclaration des routes
- [backend/src/app.js](../backend/src/app.js) : validation backend et génération JWT
- [API_CONTRACT.md](../API_CONTRACT.md) : contrat HTTP de l’API

---

## 6. Conclusion

Le flux de connexion du TP1 est un exemple typique d’architecture web moderne : le front envoie des identifiants, le backend valide et délivre un token, puis le frontend sécurise les accès et les demandes API avec ce token.

Cette logique est la base de presque toutes les applications web authentifiées.
