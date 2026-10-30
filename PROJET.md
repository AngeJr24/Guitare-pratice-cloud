# Projet — réseau social musical

## Vision

Faire évoluer Guitar Practice Cloud en un réseau social où les membres peuvent
garder leurs sons dans une bibliothèque personnelle, partager des publications
multimédias et discuter entre eux. La bibliothèque audio et l’authentification
existantes restent au cœur du projet ; les fonctions sociales viennent s’y
ajouter.

## Périmètre retenu

### Bibliothèque audio

- Chaque membre conserve sa bibliothèque personnelle de sons.
- L’import, l’écoute authentifiée, la pagination et la suppression des pistes
  restent disponibles.
- Un membre peut joindre à une publication une piste qu’il a déjà importée.
- Il n’existe plus de fonction de copie/téléchargement d’un son depuis une
  publication vers sa bibliothèque.

### Publications

- Les membres connectés peuvent publier du texte seul, un son de leur
  bibliothèque, des photos, des vidéos, ou une combinaison de ces éléments.
- Une publication peut joindre au maximum cinq photos/vidéos : JPEG, PNG,
  WebP, GIF, MP4 ou WebM, 25 Mo maximum par fichier.
- Le texte est limité à 2000 caractères et peut être omis lorsqu’un son ou un
  média est joint.
- Les publications sont publiques ou privées. Une publication privée et ses
  fichiers ne sont accessibles qu’à son auteur.
- Les membres peuvent modifier la légende/visibilité ou supprimer leurs
  propres publications.

### Messagerie

- Un membre connecté peut choisir un autre membre pour ouvrir une conversation
  privée et lui envoyer un message de 1 à 2000 caractères.
- Les conversations sont chargées entre les deux participants uniquement ;
  l’expéditeur est déduit du JWT et ne peut pas être choisi par le navigateur.
- Les messages entrants non lus sont comptés dans la navigation et à côté du
  nom de leur expéditeur ; ouvrir une conversation les marque comme lus.
- Les compteurs et la conversation ouverte sont actualisés périodiquement
  (toutes les 15 secondes).

## Stockage des données

MongoDB conserve les comptes, les métadonnées des pistes, les publications et
les messages. Les octets des sons sont dans `backend/data/uploads/` et les
photos/vidéos dans `backend/data/media/`. Les flux de médias vérifient le JWT et
la visibilité de la publication.

Le retrait de la fonction « téléchargements communautaires » concerne le
produit, son interface et ses routes API. Les documents de base et fichiers
historiques éventuellement créés par cette ancienne fonction ne sont pas
effacés automatiquement : une suppression de données existantes serait une
opération distincte et irréversible.

## État de la mise en œuvre — 29 octobre 2026

- Authentification, profil et bibliothèque audio préservés.
- Fil protégé avec création, lecture, modification et suppression des posts.
- Publication de texte, audio déjà importé et médias photo/vidéo.
- Lecture audio et médias par flux HTTP authentifié.
- Messagerie privée : choix d’un membre, historique récent, envoi de messages.
- Suppression de l’ancienne catégorie « Mes téléchargements » et de la route
  communautaire de copie audio.
- Contrat API et tests actualisés ; les essais manuels multi-comptes restent à
  effectuer avec une base MongoDB configurée.

## Suite envisagée

1. Vérifier dans le navigateur l’import et l’affichage d’images/vidéos ainsi que
   les contrôles d’accès aux publications privées.
2. Vérifier un échange de messages avec deux comptes distincts et confirmer
   qu’un tiers ne peut pas lire la conversation.
3. Envisager ensuite les likes, commentaires et notifications, sans les
   considérer comme déjà implémentés.

## Documents

- [API_CONTRACT.md](API_CONTRACT.md) décrit les routes et formats actuels.
- [PLAN_DE_TRAVAIL.md](PLAN_DE_TRAVAIL.md) conserve le journal des travaux et
  les validations effectuées.
- [RAPPORT_IA_MODELE.md](RAPPORT_IA_MODELE.md) conserve le compte rendu du
  travail assisté et ses validations.
