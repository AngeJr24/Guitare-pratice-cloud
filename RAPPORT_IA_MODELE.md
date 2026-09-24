# Rapport d'usage de l'IA - TP1

## Mission 1 — Analyse du projet et plan de travail

- Objectif : comprendre l’architecture Angular + API Express et cadrer la partie authentification/profil du TP1.
- Prompt principal : “Explique-moi l’architecture du projet et les points clés pour démarrer le TP.”
- Plan proposé par l’agent : cartographier les routes, identifier le flux Angular → service → HttpClient → API → MongoDB, puis cibler les composants login/profile et le mécanisme JWT.
- Vérifications réalisées par le binôme : lecture des fichiers de contexte, validation du contrat HTTP et vérification du build Angular avec `npm run build` dans le frontend.
- Erreurs ou propositions rejetées : aucune correction de production n’a été acceptée sans validation de cohérence avec `API_CONTRACT.md` et les consignes du dépôt.
- Fichiers effectivement modifiés : [frontend-starter/src/app/shared/services/auth.service.ts](frontend-starter/src/app/shared/services/auth.service.ts), [frontend-starter/src/app/shared/interceptors/auth.interceptor.ts](frontend-starter/src/app/shared/interceptors/auth.interceptor.ts), [frontend-starter/src/app/components/profile-page/profile-page.ts](frontend-starter/src/app/components/profile-page/profile-page.ts), [frontend-starter/src/app/components/app/app.ts](frontend-starter/src/app/components/app/app.ts), [frontend-starter/src/app/components/app/app.html](frontend-starter/src/app/components/app/app.html), [RAPPORT_IA_MODELE.md](RAPPORT_IA_MODELE.md).
- Preuve de fonctionnement : la commande de build a réussi, avec sortie terminale confirmant `Application bundle generation complete`.
- Ce que le binôme sait maintenant expliquer sans l’agent : le flux de connexion, l’ajout du JWT dans les requêtes protégées, la différence entre le stockage local et l’état du Signal, et la gestion d’un retour 401 vers la page de connexion.

## Preuves de validation

- Commande exécutée : `cd "d:\KRA Ange\MASTER 1\Composants Logiciel\Web\AngularM1_Miage_2026_2027_TP123-main\frontend-starter" ; npm run build`
- Résultat : build réussi, sans erreur bloquante. Les éléments de sécurité et d’authentification du TP1 ont été vérifiés au niveau du code et de la structure du flux.


