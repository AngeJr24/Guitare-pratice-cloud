# Guitar Practice Cloud

Application de bibliothèque audio personnelle et de réseau social musical :
partage de publications texte/photo/vidéo/son et messagerie privée entre membres.

## Prérequis

- Node.js 22 ou plus récent ;
- un compte MongoDB Atlas ;
- Git et un navigateur récent.

Consultez [ATLAS_SETUP.md](ATLAS_SETUP.md) pour configurer MongoDB.

## Démarrer le backend

Dans `backend/`, créez `.env` à partir de `.env.example`, puis renseignez l’URI
MongoDB et le secret JWT. Ne publiez jamais ce fichier.

```powershell
cd backend
npm install
npm start
```

Le backend écoute normalement sur `http://localhost:3000`.

## Démarrer le frontend

Dans un autre terminal :

```powershell
cd frontend-starter
npm install
npm start
```

Ouvrir `http://localhost:4200`. Le compte de démonstration est
`demo@example.com` / `Demo1234!`.

## Valider le projet

```powershell
cd backend
npm test
```

Dans un autre terminal :

```powershell
cd frontend-starter
npm test
npm run build
```

Les sons sont conservés dans `backend/data/uploads/` et les médias du fil dans
`backend/data/media/` ; MongoDB contient leurs métadonnées. Lire
[API_CONTRACT.md](API_CONTRACT.md) pour les limites de fichiers et les droits
d’accès.

## Documents du projet

- [PROJET.md](PROJET.md) : périmètre et état actuels du réseau social musical ;
- [API_CONTRACT.md](API_CONTRACT.md) : routes, authentification et formats ;
- [PLAN_DE_TRAVAIL.md](PLAN_DE_TRAVAIL.md) : journal de progression ;
- [RAPPORT_IA_MODELE.md](RAPPORT_IA_MODELE.md) : compte rendu de travail ;
- [SUJET_ETUDIANT_TP1.md](SUJET_ETUDIANT_TP1.md),
  [SUJET_ETUDIANT_TP2.md](SUJET_ETUDIANT_TP2.md) et
  [SUJET_ETUDIANT_TP3.md](SUJET_ETUDIANT_TP3.md) : sujets des TP.
