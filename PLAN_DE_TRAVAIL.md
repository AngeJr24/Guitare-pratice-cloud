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
- Petit relook visuel / polish design du composant audio.
- Préparation du TP3 à partir du sujet donné.
- Mise à jour des captures / traces finales si nécessaire.

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

### À venir
- Reprendre le sujet TP3.
- Vérifier les objectifs exacts demandés.
- Implémenter ou finaliser les améliorations prévues selon le sujet.
- Préparer la prochaine session sur la base des consignes du TP3 et des validations TP2 déjà faites.

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

### Prochaine session
- Reprendre le sujet TP3.
- Lire les consignes du TP3 et la structure des améliorations attendues.
- Appliquer les changements demandés sans casser le TP2 déjà validé.
- Mettre à jour ce fichier après chaque avancée.

---

## Prompts IA utilisés

### TP1
- “Explique-moi l’architecture du projet et les points clés pour démarrer le TP.”
- “Explique-moi le flux Angular → service → API → MongoDB du TP1.”

### TP2
- “Explique-moi le TP2, les endpoints backend déjà fournis, et ce qu’il faut compléter côté Angular pour la pagination, l’upload et la lecture audio.”

---

## Tâches manuelles restantes

- [x] Ouvrir le navigateur et tester le flux TP2 de bout en bout.
- [x] Vérifier le Network pour la pagination et l’upload.
- [x] Vérifier la lecture audio en mode Blob / ObjectURL.
- [ ] Préparer les captures finales si nécessaires.
- [x] Finaliser le rapport IA TP2 avec les preuves de validation.
- [ ] Reprendre le TP3 quand le sujet est donné et la prochaine session démarre.

---

## Notes de projet
- Les modifications principales sont dans le frontend Angular, dans `frontend-starter`.
- Le backend ne doit pas être modifié pour les missions principales du TP2.
- Les preuves de validation passent par build, tests et vérification dans le navigateur.
- Il faut toujours conserver des traces dans le rapport IA pour garder la logique de travail visible.
