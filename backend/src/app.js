import express from "express";
import cors from "cors";
import multer from "multer";
import jwt from "jsonwebtoken";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { User } from "./models/User.js";
import { Track } from "./models/Track.js";
import { Post } from "./models/Post.js";
import { Comment } from "./models/Comment.js";
import { Message } from "./models/Message.js";
import { Playlist } from "./models/Playlist.js";

// Les fichiers audio restent sur le disque du serveur dans ce TP.
// MongoDB ne conserve que leurs métadonnées : titre, nom, taille, etc.
const DATA_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../data",
);
const UPLOADS = path.join(DATA_DIRECTORY, "uploads");
const MEDIA_UPLOADS = path.join(DATA_DIRECTORY, "media");
const PROFILE_PHOTOS = path.join(DATA_DIRECTORY, "profile-photos");

try {
  // mkdirSync est utilisé au démarrage : l'application doit disposer de ce
  // dossier avant de pouvoir accepter le premier upload.
  fs.mkdirSync(UPLOADS, { recursive: true });
  fs.mkdirSync(MEDIA_UPLOADS, { recursive: true });
  fs.mkdirSync(PROFILE_PHOTOS, { recursive: true });
  console.log(`[startup] Dossier des uploads prêt : ${UPLOADS}`);
} catch (error) {
  console.error("[startup] Impossible de créer le dossier des uploads", error);
  throw error;
}

// Ce secret reste côté serveur. Il ne doit jamais être copié dans Angular.
const SECRET = process.env.JWT_SECRET || "tp1-development-secret";

// Les sons et médias de publication sont limités à 25 Mo par fichier.
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_PROFILE_PHOTO_SIZE = 5 * 1024 * 1024;
const POST_REACTIONS = ["like", "love", "haha", "wow", "sad", "angry"];

// Les types MIME autorisés correspondent aux formats demandés dans le sujet.
const allowed = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
]);

/**
 * Crée un jeton JWT contenant uniquement l'identité nécessaire à l'API.
 * Le mot de passe n'est jamais placé dans le token. `sub` signifie subject
 * et contient l'identifiant MongoDB de l'utilisateur.
 */
function token(user) {
  console.log(`[auth] Création d'un token pour l'utilisateur ${user.id}`);
  return jwt.sign({ sub: user.id, email: user.email }, SECRET, {
    expiresIn: "2h",
  });
}

/** Middleware Express qui protège les routes privées. */
function auth(req, res, next) {
  const raw = req.headers.authorization;

  // Le token est transmis dans l'en-tête Authorization sous la forme
    // "Authorization: Bearer <token>". Le préfixe "Bearer " est obligatoire pour que
    // le middleware sache qu'il s'agit d'un JWT et non d'un autre type de jeton.
  if (!raw?.startsWith("Bearer ")) {
    console.warn(`[auth] Authorization absente pour ${req.method} ${req.path}`);
    return res.status(401).json({ message: "Authentification requise" });
  }

  try {
    // jwt.verify vérifie la signature et la date d'expiration du token.
    // On ne logue jamais sa valeur, car un JWT permettrait une usurpation.
    req.auth = jwt.verify(raw.slice(7), SECRET);
    console.log(`[auth] Token accepté pour ${req.auth.sub}`);
    next();
  } catch (error) {
    console.error("[auth] Token invalide ou expiré", error);
    return res.status(401).json({ message: "Jeton invalide ou expiré" });
  }
}

/*
 * Multer transforme une requête HTTP multipart/form-data en données exploitables
 * par Express et traite les fichiers envoyés par un formulaire HTML.
 * Documentation officielle : https://github.com/expressjs/multer
 *
 * diskStorage indique que Multer écrit directement le fichier sur disque.
 * Chaque callback doit appeler cb(error, value) : null signifie qu'il n'y a
 * pas d'erreur. Le nom aléatoire évite les collisions entre utilisateurs.
 */
const storage = multer.diskStorage({
  destination: (_request, _file, callback) => {
    console.debug(`[multer] Destination sélectionnée : ${UPLOADS}`);
    callback(null, UPLOADS);
  },
  filename: (_request, file, callback) => {
    const filename =
      crypto.randomUUID() + path.extname(file.originalname).toLowerCase();
    console.log(`[multer] Nom de stockage généré pour ${file.originalname}`);
    callback(null, filename);
  },
});

/*
 * limits.fileSize protège le serveur contre les fichiers trop volumineux.
 * fileFilter est appelé avant l'enregistrement : accepter le fichier appelle
 * callback(null, true), le refuser transmet une vraie Error à Express.
 */
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_request, file, callback) => {
    // Seuls les types MIME audio demandés dans le sujet sont acceptés.
    if (allowed.has(file.mimetype)) {
      console.log(`[multer] Type accepté : ${file.mimetype}`);
      return callback(null, true);
    }

    const error = new Error("Format audio non accepté");
    console.error(`[multer] Type refusé : ${file.mimetype}`, error);
    return callback(error);
  },
});

const allowedPostMedia = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
]);
const postMediaUpload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => callback(null, MEDIA_UPLOADS),
    filename: (_request, file, callback) => {
      callback(
        null,
        crypto.randomUUID() + path.extname(file.originalname).toLowerCase(),
      );
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE, files: 5 },
  fileFilter: (_request, file, callback) => {
    if (allowedPostMedia.has(file.mimetype)) {
      return callback(null, true);
    }
    return callback(new Error("Format média non accepté"));
  },
});
const allowedProfilePhotoTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const profilePhotoUpload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) =>
      callback(null, PROFILE_PHOTOS),
    filename: (_request, file, callback) =>
      callback(
        null,
        crypto.randomUUID() + path.extname(file.originalname).toLowerCase(),
      ),
  }),
  limits: { fileSize: MAX_PROFILE_PHOTO_SIZE, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (allowedProfilePhotoTypes.has(file.mimetype)) {
      return callback(null, true);
    }
    return callback(new Error("Format de photo non accepté"));
  },
});

function publicPost(post, viewerId) {
  const author = post.authorId;
  const reactions =
    post.reactions instanceof Map
      ? Object.fromEntries(post.reactions)
      : post.reactions ?? {};
  return {
    id: String(post._id ?? post.id),
    author: publicMember(author),
    content: post.content || "",
    visibility: post.visibility || "public",
    audio: post.audio
      ? {
          id: String(post._id ?? post.id),
          originalName: post.audio.originalName,
          mimeType: post.audio.mimeType,
          size: post.audio.size,
        }
      : null,
    media: (post.media ?? []).map((media) => ({
      id: String(media._id ?? media.id),
      originalName: media.originalName,
      mimeType: media.mimeType,
      size: media.size,
    })),
    reactionCounts: Object.fromEntries(
      POST_REACTIONS.map((type) => [
        type,
        Object.values(reactions).filter((reaction) => reaction === type).length,
      ]),
    ),
    myReaction: reactions[String(viewerId)] ?? null,
    createdAt: post.createdAt,
  };
}

function publicComment(comment) {
  const author = comment.authorId;
  return {
    id: String(comment._id ?? comment.id),
    author: {
      id: String(author?._id ?? author),
      name: author?.name ?? "",
    },
    content: comment.content,
    createdAt: comment.createdAt,
  };
}

function publicMember(member) {
  return {
    id: String(member?._id ?? member?.id ?? member),
    name: member?.name ?? "",
    profilePhoto: member?.profilePhoto
      ? {
          mimeType: member.profilePhoto.mimeType,
          size: member.profilePhoto.size,
        }
      : null,
  };
}

function readablePostFilter(postId, userId) {
  return {
    _id: postId,
    $or: [{ visibility: { $ne: "private" } }, { authorId: userId }],
  };
}

function publicPlaylist(playlist, includeTracks = false) {
  const owner = playlist.ownerId;
  const result = {
    id: String(playlist._id ?? playlist.id),
    name: playlist.name,
    visibility: playlist.visibility,
    owner: {
      id: String(owner?._id ?? owner),
      name: owner?.name ?? "",
    },
    trackCount: playlist.tracks?.length ?? 0,
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt,
  };

  if (includeTracks) {
    result.tracks = (playlist.tracks ?? [])
      .filter((entry) => entry.trackId)
      .map((entry) => {
        const track = entry.trackId;
        return {
          track: {
            id: String(track._id ?? track.id),
            title: track.title,
            originalName: track.originalName,
            mimeType: track.mimeType,
            size: track.size,
          },
          addedBy: String(entry.addedBy?._id ?? entry.addedBy),
          addedAt: entry.addedAt,
        };
      });
  }

  return result;
}

function validObjectId(value) {
  return mongoose.isValidObjectId(value);
}

async function cleanupPostMedia(files = []) {
  for (const file of files) {
    try {
      await fsPromises.unlink(path.join(MEDIA_UPLOADS, file.filename));
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("[posts] Impossible de supprimer un média incomplet", error);
        throw error;
      }
    }
  }
}

async function removeProfilePhotoFile(filename) {
  if (!filename) {
    return;
  }
  try {
    await fsPromises.unlink(path.join(PROFILE_PHOTOS, filename));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

/**
 * Construit l'application Express sans ouvrir de port.
 * Cette séparation permet au serveur réel et aux tests de créer la même
 * application. Le port est ouvert uniquement dans server.js.
 */
export function createApp() {
  const app = express();

  // Journaliser la fin de chaque requête permet de suivre méthode, URL,
  // statut et durée sans exposer les corps contenant des mots de passe.
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      console.log(
        `[http] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - startedAt} ms)`,
      );
    });
    next();
  });

  // CORS est nécessaire pour que le frontend Angular puisse appeler l'API.
  // C'est-à-dire que le navigateur autorise les requêtes cross-origin depuis localhost:4200.
  // Dans un vrai projet, il est recommandé de limiter les origines autorisées.
  app.use(cors());

  // Express ne gère pas nativement le JSON : ce middleware transforme le corps JSON en objet JavaScript 
  // accessible via req.body.
  // Il est placé avant les routes pour que toutes les requêtes JSON soient traitées.
  app.use(express.json());

  /** Endpoint public utilisé pour vérifier que l'API répond. */
  app.get("/api/health", (_req, res) => {
    console.log("[health] Vérification de l'API");
    res.json({ status: "ok" });
  });

  /** Requête POST pour "insertion" de donnée.
   * Inscrit un utilisateur et renvoie un token avec ses données publiques. 
   * @param {Object} req - La requête HTTP.
   * @param {Object} res - La réponse HTTP.
   * @param {Function} next - La fonction de middleware suivante.
   */
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const { name, email, password } = req.body || {};
      console.log(`[auth] Tentative d'inscription pour ${email || "email absent"}`);

      if (!name || !email || !password || password.length < 8) {
        console.warn("[auth] Inscription refusée : données invalides ou incomplètes");
        return res.status(400).json({
          message: "Nom, email et mot de passe de 8 caractères requis",
        });
      }

      // Vérifie si l'email est déjà utilisé avant de créer un nouvel utilisateur.
      if (await User.exists({ email: String(email).toLowerCase() })) {
        console.warn(`[auth] Email déjà utilisé : ${email}`);
        return res.status(409).json({ message: "Email déjà utilisé" });
      }

      // Crée l'utilisateur et le stocke dans MongoDB. Le mot de passe est haché
      // par le hook pre('validate') défini dans le schéma Mongoose.
      const user = await User.create({ name, email, password });
      console.log(`[auth] Utilisateur créé : ${user.id}`);
      res.status(201).json({ token: token(user), user: user.toPublic() });
    } catch (error) {
      console.error("[auth] Erreur pendant l'inscription", error);
      next(error);
    }
  });

  /** Vérifie les identifiants et ouvre une session JWT. Les identifiants sont envoyés dans le corps de la 
   * requête par un HTTP POST. */
  app.post("/api/auth/login", async (req, res, next) => {
    try {
        // req.body est déjà un objet JavaScript grâce au middleware express.json() placé plus haut.
        // il contient les champs email et password envoyés par le frontend Angular.
      const email = String(req.body?.email || "").toLowerCase();
      console.log(`[auth] Tentative de connexion pour ${email || "email absent"}`);

      // Sélectionne le mot de passe haché pour vérifier les identifiants.
      // User est un modèle Mongoose qui correspond au schéma défini dans models/User.js.
      // on envoie les requête à MongoDB via cet objet. Le mot de passe haché est stocké dans 
      // passwordHash, mais il n'est pas renvoyé par défaut dans les requêtes pour 
      // des raisons de sécurité.
      const user = await User.findOne({ email }).select("+passwordHash");

      if (!user || !(await user.verifyPassword(req.body?.password || ""))) {
        console.warn(`[auth] Identifiants incorrects pour ${email}`);
        return res.status(401).json({ message: "Identifiants incorrects" });
      }

      console.log(`[auth] Connexion réussie : ${user.id}`);
      res.json({ token: token(user), user: user.toPublic() });
    } catch (error) {
      console.error("[auth] Erreur pendant la connexion", error);
      next(error);
    }
  });

  /** Retourne le profil public de l'utilisateur identifié par le JWT. 
   * Les paramètres sont :
   * @param auth - Le middleware qui vérifie le JWT et ajoute req.auth. 
   * @param {Object} req - La requête HTTP.
   * @param {Object} res - La réponse HTTP.
   * @param {Function} next - La fonction de middleware suivante.
  */
  app.get("/api/users/me", auth, async (req, res, next) => {
    try {
        // req.auth.sub contient l'identifiant MongoDB de l'utilisateur 
        // extrait du JWT par le middleware auth. ici req.auth est un objet ajouté par le middleware 
        // auth à la requête, et sub est la propriété qui contient l'identifiant de l'utilisateur.
      const user = await User.findById(req.auth.sub);
      if (!user) {
        console.warn(`[user] Profil introuvable : ${req.auth.sub}`);
        return res.status(404).json({ message: "Utilisateur inconnu" });
      }

      console.log(`[user] Profil envoyé : ${user.id}`);
      res.json(user.toPublic());
    } catch (error) {
      console.error("[user] Erreur de lecture du profil", error);
      next(error);
    }
  });

  /** Modifie uniquement le nom de l'utilisateur connecté. */
  app.put("/api/users/me", auth, async (req, res, next) => {
    try {
      const user = await User.findByIdAndUpdate(
        req.auth.sub,
        { $set: { name: req.body?.name } },
        { new: true, runValidators: true },
      );

      if (!user) {
        console.warn(`[user] Mise à jour impossible : ${req.auth.sub}`);
        return res.status(404).json({ message: "Utilisateur inconnu" });
      }

      console.log(`[user] Nom mis à jour : ${user.id}`);
      res.json(user.toPublic());
    } catch (error) {
      console.error("[user] Erreur de mise à jour du profil", error);
      next(error);
    }
  });

  app.post(
    "/api/users/me/photo",
    auth,
    profilePhotoUpload.single("photo"),
    async (req, res, next) => {
      if (!req.file) {
        return res.status(400).json({ message: "Photo de profil requise" });
      }

      let user;
      let previousFilename;
      try {
        user = await User.findById(req.auth.sub).select(
          "+profilePhoto.storedName",
        );
        if (!user) {
          await removeProfilePhotoFile(req.file.filename);
          return res.status(404).json({ message: "Utilisateur inconnu" });
        }

        previousFilename = user.profilePhoto?.storedName;
        user.profilePhoto = {
          storedName: req.file.filename,
          mimeType: req.file.mimetype,
          size: req.file.size,
        };
        await user.save();
      } catch (error) {
        console.error("[user] Erreur d'enregistrement de la photo de profil", error);
        try {
          await removeProfilePhotoFile(req.file.filename);
        } catch (cleanupError) {
          console.error("[user] Photo temporaire non supprimée", cleanupError);
        }
        next(error);
        return;
      }

      try {
        await removeProfilePhotoFile(previousFilename);
      } catch (error) {
        console.error("[user] Ancienne photo de profil non supprimée", error);
        return res.status(500).json({
          message: "Photo remplacée, mais l’ancienne photo n’a pas pu être supprimée",
        });
      }
      res.json(user.toPublic());
    },
  );

  app.get("/api/users/me/photo", auth, async (req, res, next) => {
    try {
      const user = await User.findById(req.auth.sub).select(
        "+profilePhoto.storedName",
      );
      if (!user?.profilePhoto?.storedName) {
        return res.status(404).json({ message: "Photo de profil introuvable" });
      }

      res.type(user.profilePhoto.mimeType);
      res.setHeader("Content-Disposition", "inline");
      res.sendFile(
        path.join(PROFILE_PHOTOS, user.profilePhoto.storedName),
        (error) => {
          if (error) {
            console.error("[user] Photo de profil non envoyée", error);
            if (!res.headersSent) {
              next(error);
            }
          }
        },
      );
    } catch (error) {
      console.error("[user] Erreur de lecture de la photo de profil", error);
      next(error);
    }
  });

  app.delete("/api/users/me/photo", auth, async (req, res, next) => {
    try {
      const user = await User.findById(req.auth.sub).select(
        "+profilePhoto.storedName",
      );
      if (!user) {
        return res.status(404).json({ message: "Utilisateur inconnu" });
      }

      const previousFilename = user.profilePhoto?.storedName;
      if (!previousFilename) {
        return res.status(204).end();
      }

      user.profilePhoto = null;
      await user.save();
      await removeProfilePhotoFile(previousFilename);
      res.status(204).end();
    } catch (error) {
      console.error("[user] Erreur de suppression de la photo de profil", error);
      next(error);
    }
  });

  app.get("/api/members/:memberId/photo", auth, async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.memberId)) {
        return res.status(400).json({ message: "Identifiant de membre invalide" });
      }

      const member = await User.findById(req.params.memberId).select(
        "+profilePhoto.storedName",
      );
      if (!member?.profilePhoto?.storedName) {
        return res.status(404).json({ message: "Photo de profil introuvable" });
      }

      res.type(member.profilePhoto.mimeType);
      res.setHeader("Content-Disposition", "inline");
      res.sendFile(
        path.join(PROFILE_PHOTOS, member.profilePhoto.storedName),
        (error) => {
          if (error) {
            console.error("[members] Photo de profil non envoyée", error);
            if (!res.headersSent) {
              next(error);
            }
          }
        },
      );
    } catch (error) {
      console.error("[members] Erreur de lecture de la photo de profil", error);
      next(error);
    }
  });

  app.get("/api/users", auth, async (req, res, next) => {
    try {
      const users = await User.find({ _id: { $ne: req.auth.sub } })
        .select("name profilePhoto.mimeType profilePhoto.size")
        .sort({ name: 1 })
        .limit(100)
        .lean();
      res.json(users.map(publicMember));
    } catch (error) {
      console.error("[users] Erreur de lecture des membres", error);
      next(error);
    }
  });

  app.get("/api/messages/unread-counts", auth, async (req, res, next) => {
    try {
      const unreadBySender = await Message.aggregate([
        {
          $match: {
            recipientId: new mongoose.Types.ObjectId(req.auth.sub),
            readAt: null,
          },
        },
        { $group: { _id: "$senderId", count: { $sum: 1 } } },
      ]);
      const bySender = unreadBySender.map((item) => ({
        senderId: String(item._id),
        count: item.count,
      }));
      res.json({
        total: bySender.reduce((total, item) => total + item.count, 0),
        bySender,
      });
    } catch (error) {
      console.error("[messages] Erreur de lecture des compteurs non lus", error);
      next(error);
    }
  });

  app.get("/api/messages/:userId", auth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      if (!mongoose.isValidObjectId(userId) || userId === req.auth.sub) {
        return res.status(400).json({ message: "Destinataire invalide" });
      }
      const recipient = await User.findById(userId)
        .select("name profilePhoto.mimeType profilePhoto.size")
        .lean();
      if (!recipient) {
        return res.status(404).json({ message: "Membre introuvable" });
      }

      await Message.updateMany(
        {
          senderId: userId,
          recipientId: req.auth.sub,
          readAt: null,
        },
        { $set: { readAt: new Date() } },
      );

      const messages = await Message.find({
        $or: [
          { senderId: req.auth.sub, recipientId: userId },
          { senderId: userId, recipientId: req.auth.sub },
        ],
      })
        .populate("senderId", "name profilePhoto.mimeType profilePhoto.size")
        .populate("recipientId", "name profilePhoto.mimeType profilePhoto.size")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      res.json({
        member: publicMember(recipient),
        items: messages.reverse().map((message) => ({
          id: String(message._id),
          sender: publicMember(message.senderId),
          recipient: publicMember(message.recipientId),
          content: message.content,
          createdAt: message.createdAt,
        })),
      });
    } catch (error) {
      console.error("[messages] Erreur de lecture de la conversation", error);
      next(error);
    }
  });

  app.post("/api/messages/:userId", auth, async (req, res, next) => {
    try {
      const { userId } = req.params;
      const content =
        typeof req.body?.content === "string" ? req.body.content.trim() : "";
      if (!mongoose.isValidObjectId(userId) || userId === req.auth.sub) {
        return res.status(400).json({ message: "Destinataire invalide" });
      }
      if (!content || content.length > 2000) {
        return res.status(400).json({
          message: "Le message doit contenir de 1 à 2000 caractères",
        });
      }
      if (!(await User.exists({ _id: userId }))) {
        return res.status(404).json({ message: "Membre introuvable" });
      }

      const message = await Message.create({
        senderId: req.auth.sub,
        recipientId: userId,
        content,
        readAt: null,
      });
      await message.populate([
        {
          path: "senderId",
          select: "name profilePhoto.mimeType profilePhoto.size",
        },
        {
          path: "recipientId",
          select: "name profilePhoto.mimeType profilePhoto.size",
        },
      ]);
      res.status(201).json({
        id: message.id,
        sender: publicMember(message.senderId),
        recipient: publicMember(message.recipientId),
        content: message.content,
        createdAt: message.createdAt,
      });
    } catch (error) {
      console.error("[messages] Erreur d’envoi", error);
      next(error);
    }
  });

  app.get("/api/posts", auth, async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 10));
      const scope = req.query.scope ?? "recent";
      const visibility = req.query.visibility ?? "all";
      if (scope !== "recent" && scope !== "mine") {
        return res.status(400).json({ message: "Filtre de publications invalide" });
      }
      if (!["all", "public", "private"].includes(visibility)) {
        return res.status(400).json({ message: "Filtre de visibilité invalide" });
      }

      const scopeFilter =
        scope === "mine"
          ? { authorId: req.auth.sub }
          : {
              $or: [
                { visibility: { $ne: "private" } },
                { authorId: req.auth.sub },
              ],
            };
      const filter =
        visibility === "all"
          ? scopeFilter
          : { $and: [scopeFilter, { visibility }] };
      const [items, total] = await Promise.all([
        Post.find(filter)
          .populate("authorId", "name profilePhoto.mimeType profilePhoto.size")
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Post.countDocuments(filter),
      ]);
      const visibleItems =
        scope === "mine"
          ? items.filter(
              (post) =>
                String(post.authorId?._id ?? post.authorId) ===
                String(req.auth.sub),
            )
          : items;

      res.json({
        items: visibleItems.map((post) => publicPost(post, req.auth.sub)),
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      });
    } catch (error) {
      console.error("[posts] Erreur de lecture du fil", error);
      next(error);
    }
  });

  app.post(
    "/api/posts",
    auth,
    postMediaUpload.array("media", 5),
    async (req, res, next) => {
    try {
      const content =
        typeof req.body?.content === "string" ? req.body.content.trim() : "";
      const visibility = req.body?.visibility ?? "public";
      const hasContent = content.length > 0;
      const trackId =
        typeof req.body?.trackId === "string" ? req.body.trackId.trim() : "";
      const files = req.files ?? [];

      if (trackId) {
        await cleanupPostMedia(files);
        return res.status(400).json({
          message: "Les publications audio ne sont pas disponibles pour le moment",
        });
      }
      if (!hasContent && files.length === 0) {
        await cleanupPostMedia(files);
        return res.status(400).json({
          message: "Ajoutez un texte, une photo ou une vidéo à la publication",
        });
      }
      if (hasContent && content.length > 2000) {
        await cleanupPostMedia(files);
        return res.status(400).json({
          message: "Le texte de la publication doit contenir de 1 à 2000 caractères",
        });
      }
      if (visibility !== "public" && visibility !== "private") {
        await cleanupPostMedia(files);
        return res.status(400).json({ message: "Visibilité invalide" });
      }

      const postData = {
        authorId: req.auth.sub,
        content: content || "",
        visibility,
      };

      postData.media = files.map((file) => ({
        originalName: file.originalname,
        storedName: file.filename,
        mimeType: file.mimetype,
        size: file.size,
      }));

      const post = await Post.create(postData);
      await post.populate(
        "authorId",
        "name profilePhoto.mimeType profilePhoto.size",
      );
      res.status(201).json(publicPost(post, req.auth.sub));
    } catch (error) {
      console.error("[posts] Erreur de création", error);
      try {
        await cleanupPostMedia(req.files ?? []);
      } catch (cleanupError) {
        console.error("[posts] Nettoyage des médias incomplets échoué", cleanupError);
      }
      next(error);
    }
  });

  app.patch("/api/posts/:id", auth, async (req, res, next) => {
    try {
      const content =
        typeof req.body?.content === "string" ? req.body.content.trim() : "";
      const visibility = req.body?.visibility;
      if (content.length > 2000) {
        return res.status(400).json({
          message: "Le texte de la publication doit contenir de 1 à 2000 caractères",
        });
      }
      if (!content) {
        const existingPost = await Post.findOne({
          _id: req.params.id,
          authorId: req.auth.sub,
        });
        if (!existingPost || (!existingPost.audio && !existingPost.media?.length)) {
          return res.status(400).json({
            message: "Une publication sans média doit contenir un texte",
          });
        }
      }
      if (visibility !== "public" && visibility !== "private") {
        return res.status(400).json({ message: "Visibilité invalide" });
      }

      const post = await Post.findOneAndUpdate(
        { _id: req.params.id, authorId: req.auth.sub },
        { $set: { content, visibility } },
        { new: true },
      ).populate(
        "authorId",
        "name profilePhoto.mimeType profilePhoto.size",
      );

      if (!post) {
        return res.status(404).json({ message: "Publication introuvable" });
      }

      res.json(publicPost(post, req.auth.sub));
    } catch (error) {
      console.error("[posts] Erreur de modification", error);
      next(error);
    }
  });

  app.put("/api/posts/:id/reaction", auth, async (req, res, next) => {
    try {
      const { reaction } = req.body ?? {};
      if (reaction !== null && !POST_REACTIONS.includes(reaction)) {
        return res.status(400).json({ message: "Réaction invalide" });
      }

      const update = reaction
        ? { $set: { [`reactions.${req.auth.sub}`]: reaction } }
        : { $unset: { [`reactions.${req.auth.sub}`]: 1 } };
      const post = await Post.findOneAndUpdate(
        readablePostFilter(req.params.id, req.auth.sub),
        update,
        { new: true },
      ).populate(
        "authorId",
        "name profilePhoto.mimeType profilePhoto.size",
      );

      if (!post) {
        return res.status(404).json({ message: "Publication introuvable" });
      }
      res.json(publicPost(post, req.auth.sub));
    } catch (error) {
      console.error("[posts] Erreur d'enregistrement de la réaction", error);
      next(error);
    }
  });

  app.get("/api/posts/:id/comments", auth, async (req, res, next) => {
    try {
      const post = await Post.exists(
        readablePostFilter(req.params.id, req.auth.sub),
      );
      if (!post) {
        return res.status(404).json({ message: "Publication introuvable" });
      }

      const comments = await Comment.find({ postId: req.params.id })
        .populate("authorId", "name")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
      res.json(comments.reverse().map(publicComment));
    } catch (error) {
      console.error("[posts] Erreur de lecture des commentaires", error);
      next(error);
    }
  });

  app.post("/api/posts/:id/comments", auth, async (req, res, next) => {
    try {
      const content =
        typeof req.body?.content === "string" ? req.body.content.trim() : "";
      if (!content || content.length > 1000) {
        return res.status(400).json({
          message: "Un commentaire doit contenir de 1 à 1000 caractères",
        });
      }

      const post = await Post.exists(
        readablePostFilter(req.params.id, req.auth.sub),
      );
      if (!post) {
        return res.status(404).json({ message: "Publication introuvable" });
      }

      const comment = await Comment.create({
        postId: req.params.id,
        authorId: req.auth.sub,
        content,
      });
      await comment.populate("authorId", "name");
      res.status(201).json(publicComment(comment));
    } catch (error) {
      console.error("[posts] Erreur de création du commentaire", error);
      next(error);
    }
  });

  app.get("/api/posts/:id/audio", auth, async (req, res, next) => {
    try {
      const post = await Post.findOne({
        _id: req.params.id,
        $or: [{ visibility: { $ne: "private" } }, { authorId: req.auth.sub }],
      }).select("+audio.storedName");

      if (!post || !post.audio) {
        return res.status(404).json({ message: "Audio introuvable" });
      }

      const audioPath = path.join(UPLOADS, post.audio.storedName);
      res.type(post.audio.mimeType);
      res.sendFile(audioPath, (error) => {
        if (error) {
          console.error(`[posts] Audio non envoyé : ${post.id}`, error);
          if (!res.headersSent) {
            next(error);
          }
          return;
        }
        console.log(`[posts] Audio de publication envoyé : ${post.id}`);
      });
    } catch (error) {
      console.error("[posts] Erreur de lecture audio", error);
      next(error);
    }
  });

  app.get("/api/posts/:id/media/:mediaId", auth, async (req, res, next) => {
    try {
      const post = await Post.findOne({
        _id: req.params.id,
        $or: [{ visibility: { $ne: "private" } }, { authorId: req.auth.sub }],
      }).select("+media.storedName");
      const media = post?.media.find(
        (item) => String(item._id) === req.params.mediaId,
      );
      if (!media) {
        return res.status(404).json({ message: "Média introuvable" });
      }

      res.type(media.mimeType);
      res.setHeader("Content-Disposition", "inline");
      res.sendFile(path.join(MEDIA_UPLOADS, media.storedName), (error) => {
        if (error) {
          console.error(`[posts] Média non envoyé : ${post.id}/${media.id}`, error);
          if (!res.headersSent) next(error);
        }
      });
    } catch (error) {
      console.error("[posts] Erreur de lecture du média", error);
      next(error);
    }
  });

  app.delete("/api/posts/:id", auth, async (req, res, next) => {
    try {
      const post = await Post.findOneAndDelete({
        _id: req.params.id,
        authorId: req.auth.sub,
      }).select("+audio.storedName +media.storedName");
      if (!post) {
        return res.status(404).json({ message: "Publication introuvable" });
      }

      if (post.audio?.storedName && !post.audio.sourceTrackId) {
        const audioPath = path.join(UPLOADS, post.audio.storedName);
        try {
          await fsPromises.unlink(audioPath);
          console.log(`[posts] Fichier audio supprimé : ${audioPath}`);
        } catch (error) {
          console.error(`[posts] Fichier audio non supprimé : ${audioPath}`, error);
          return res.status(500).json({ message: "Publication supprimée, mais fichier audio non supprimé" });
        }
      }

      for (const media of post.media ?? []) {
        try {
          await fsPromises.unlink(path.join(MEDIA_UPLOADS, media.storedName));
        } catch (error) {
          console.error(`[posts] Média non supprimé : ${media.storedName}`, error);
          return res.status(500).json({
            message: "Publication supprimée, mais un média n’a pas pu être supprimé",
          });
        }
      }

      try {
        await Comment.deleteMany({ postId: post._id });
      } catch (error) {
        console.error(`[posts] Commentaires non supprimés : ${post.id}`, error);
        return res.status(500).json({
          message: "Publication supprimée, mais les commentaires n’ont pas pu être supprimés",
        });
      }

      res.status(204).end();
    } catch (error) {
      console.error("[posts] Erreur de suppression", error);
      next(error);
    }
  });

  app.get("/api/playlists", auth, async (req, res, next) => {
    try {
      const playlists = await Playlist.find({
        $or: [
          { ownerId: req.auth.sub },
          { visibility: { $in: ["public", "collaborative"] } },
        ],
      })
        .populate("ownerId", "name")
        .sort({ updatedAt: -1 })
        .lean();

      res.json(playlists.map((playlist) => publicPlaylist(playlist)));
    } catch (error) {
      console.error("[playlists] Erreur de lecture des playlists", error);
      next(error);
    }
  });

  app.post("/api/playlists", auth, async (req, res, next) => {
    try {
      const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
      const visibility = req.body?.visibility ?? "private";
      if (!name || name.length > 80) {
        return res.status(400).json({
          message: "Le nom de la playlist doit contenir de 1 à 80 caractères",
        });
      }
      if (!["private", "public", "collaborative"].includes(visibility)) {
        return res.status(400).json({ message: "Visibilité de playlist invalide" });
      }

      const playlist = await Playlist.create({
        ownerId: req.auth.sub,
        name,
        visibility,
      });
      const populated = await Playlist.findById(playlist.id)
        .populate("ownerId", "name")
        .lean();
      res.status(201).json(publicPlaylist(populated));
    } catch (error) {
      console.error("[playlists] Erreur de création", error);
      next(error);
    }
  });

  app.get("/api/playlists/:id", auth, async (req, res, next) => {
    try {
      if (!validObjectId(req.params.id)) {
        return res.status(400).json({ message: "Identifiant de playlist invalide" });
      }
      const playlist = await Playlist.findById(req.params.id)
        .populate("ownerId", "name")
        .populate("tracks.trackId", "title originalName mimeType size ownerId")
        .lean();

      if (
        !playlist ||
        (playlist.visibility === "private" &&
          String(playlist.ownerId?._id ?? playlist.ownerId) !== req.auth.sub)
      ) {
        return res.status(404).json({ message: "Playlist inconnue" });
      }

      res.json(publicPlaylist(playlist, true));
    } catch (error) {
      console.error("[playlists] Erreur de lecture", error);
      next(error);
    }
  });

  app.patch("/api/playlists/:id", auth, async (req, res, next) => {
    try {
      if (!validObjectId(req.params.id)) {
        return res.status(400).json({ message: "Identifiant de playlist invalide" });
      }
      const updates = {};
      if (Object.hasOwn(req.body ?? {}, "name")) {
        const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
        if (!name || name.length > 80) {
          return res.status(400).json({
            message: "Le nom de la playlist doit contenir de 1 à 80 caractères",
          });
        }
        updates.name = name;
      }
      if (Object.hasOwn(req.body ?? {}, "visibility")) {
        if (!["private", "public", "collaborative"].includes(req.body.visibility)) {
          return res.status(400).json({ message: "Visibilité de playlist invalide" });
        }
        updates.visibility = req.body.visibility;
      }
      if (!Object.keys(updates).length) {
        return res.status(400).json({ message: "Aucune modification à enregistrer" });
      }

      const playlist = await Playlist.findOneAndUpdate(
        { _id: req.params.id, ownerId: req.auth.sub },
        { $set: updates },
        { new: true, runValidators: true },
      )
        .populate("ownerId", "name")
        .lean();
      if (!playlist) {
        return res.status(404).json({ message: "Playlist inconnue" });
      }
      res.json(publicPlaylist(playlist));
    } catch (error) {
      console.error("[playlists] Erreur de modification", error);
      next(error);
    }
  });

  app.delete("/api/playlists/:id", auth, async (req, res, next) => {
    try {
      if (!validObjectId(req.params.id)) {
        return res.status(400).json({ message: "Identifiant de playlist invalide" });
      }
      const playlist = await Playlist.findOneAndDelete({
        _id: req.params.id,
        ownerId: req.auth.sub,
      });
      if (!playlist) {
        return res.status(404).json({ message: "Playlist inconnue" });
      }
      res.status(204).end();
    } catch (error) {
      console.error("[playlists] Erreur de suppression", error);
      next(error);
    }
  });

  app.post("/api/playlists/:id/tracks", auth, async (req, res, next) => {
    try {
      const { id } = req.params;
      const trackId = req.body?.trackId;
      if (!validObjectId(id) || !validObjectId(trackId)) {
        return res.status(400).json({ message: "Identifiant de playlist ou de piste invalide" });
      }

      const playlist = await Playlist.findById(id);
      if (!playlist) {
        return res.status(404).json({ message: "Playlist inconnue" });
      }
      const isOwner = String(playlist.ownerId) === req.auth.sub;
      if (!isOwner && playlist.visibility !== "collaborative") {
        return res.status(404).json({ message: "Playlist inconnue" });
      }

      const track = await Track.findOne({ _id: trackId, ownerId: req.auth.sub });
      if (!track) {
        return res.status(404).json({ message: "Piste inconnue" });
      }
      const result = await Playlist.updateOne(
        { _id: id, "tracks.trackId": { $ne: track._id } },
        {
          $push: {
            tracks: { trackId: track._id, addedBy: req.auth.sub },
          },
        },
      );
      if (result.matchedCount === 0) {
        return res.status(409).json({ message: "Cette piste est déjà dans la playlist" });
      }

      const updated = await Playlist.findById(id)
        .populate("ownerId", "name")
        .populate("tracks.trackId", "title originalName mimeType size ownerId")
        .lean();
      res.status(200).json(publicPlaylist(updated, true));
    } catch (error) {
      console.error("[playlists] Erreur d’ajout de piste", error);
      next(error);
    }
  });

  app.delete("/api/playlists/:id/tracks/:trackId", auth, async (req, res, next) => {
    try {
      const { id, trackId } = req.params;
      if (!validObjectId(id) || !validObjectId(trackId)) {
        return res.status(400).json({ message: "Identifiant de playlist ou de piste invalide" });
      }

      const playlist = await Playlist.findById(id);
      if (!playlist) {
        return res.status(404).json({ message: "Playlist inconnue" });
      }
      const isOwner = String(playlist.ownerId) === req.auth.sub;
      const contribution = playlist.tracks.find(
        (entry) => String(entry.trackId) === trackId,
      );
      if (!contribution) {
        return res.status(404).json({ message: "Piste inconnue dans cette playlist" });
      }
      if (
        !isOwner &&
        (playlist.visibility !== "collaborative" ||
          String(contribution.addedBy) !== req.auth.sub)
      ) {
        return res.status(404).json({ message: "Piste inconnue dans cette playlist" });
      }

      const filter = { _id: id };
      if (!isOwner) {
        filter.tracks = {
          $elemMatch: { trackId, addedBy: req.auth.sub },
        };
      }
      const result = await Playlist.updateOne(filter, {
        $pull: { tracks: { trackId } },
      });
      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "Piste inconnue dans cette playlist" });
      }

      const updated = await Playlist.findById(id)
        .populate("ownerId", "name")
        .populate("tracks.trackId", "title originalName mimeType size ownerId")
        .lean();
      res.json(publicPlaylist(updated, true));
    } catch (error) {
      console.error("[playlists] Erreur de retrait de piste", error);
      next(error);
    }
  });

  app.get("/api/playlists/:id/tracks/:trackId/audio", auth, async (req, res, next) => {
    try {
      const { id, trackId } = req.params;
      if (!validObjectId(id) || !validObjectId(trackId)) {
        return res.status(400).json({ message: "Identifiant de playlist ou de piste invalide" });
      }
      const playlist = await Playlist.findById(id).lean();
      const canView = playlist &&
        (playlist.visibility !== "private" || String(playlist.ownerId) === req.auth.sub);
      const containsTrack = playlist?.tracks.some(
        (entry) => String(entry.trackId) === trackId,
      );
      if (!canView || !containsTrack) {
        return res.status(404).json({ message: "Piste inconnue dans cette playlist" });
      }

      const track = await Track.findById(trackId).select("+storedName");
      if (!track) {
        return res.status(404).json({ message: "Piste inconnue dans cette playlist" });
      }

      res.type(track.mimeType);
      res.sendFile(path.join(UPLOADS, track.storedName), (error) => {
        if (error) {
          console.error(`[playlists] Erreur d’envoi audio ${track.id}`, error);
          if (!res.headersSent) next(error);
          return;
        }
        console.log(`[playlists] Audio envoyé : ${track.id}`);
      });
    } catch (error) {
      console.error("[playlists] Erreur de préparation du flux audio", error);
      next(error);
    }
  });

  app.get("/api/tracklists", auth, async (req, res, next) => {
    try {
      const tracks = await Track.find({
        ownerId: req.auth.sub,
        $or: [{ category: "uploaded" }, { category: { $exists: false } }],
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      res.json(
        tracks.map((track) => ({
          ...track,
          id: String(track._id),
          _id: undefined,
        })),
      );
    } catch (error) {
      console.error("[tracklists] Erreur de lecture des listes", error);
      next(error);
    }
  });

  /** Retourne une page des pistes appartenant exclusivement à l'utilisateur. */
  app.get("/api/tracks", auth, async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 5));
      const filter = {
        ownerId: req.auth.sub,
        $or: [{ category: "uploaded" }, { category: { $exists: false } }],
      };

      console.log(`[tracks] Lecture page=${page}, limit=${limit}, user=${req.auth.sub}`);

      const [items, total] = await Promise.all([
        Track.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .select("-storedName")
          .lean(),
        Track.countDocuments(filter),
      ]);

      const publicItems = items.map((track) => ({
        ...track,
        id: String(track._id),
        _id: undefined,
      }));

      res.json({
        items: publicItems,
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      });
    } catch (error) {
      console.error("[tracks] Erreur de pagination", error);
      next(error);
    }
  });

  /**
   * Reçoit le champ multipart audio et le champ texte title.
   * upload.single("audio") traite un seul fichier et le place dans req.file,
   * tandis que req.body.title contient le champ texte associé.
   * C'est ici qu'est fait l'upload de fichiers sur le serveur. 
   * Le middleware auth vérifie le JWT avant d'accepter l'upload.
   * Le middleware upload.single("audio") traite le fichier audio envoyé dans le champ "audio" du formulaire
   * ou de l'appel depuis le frontend avec un objet FormData.
   * Si le fichier est accepté, il est stocké sur le disque et ses métadonnées sont enregistrées 
   * dans MongoDB.
   */
  app.post(
    "/api/tracks",
    auth,
    upload.single("audio"),
    async (req, res, next) => {
      try {
        if (!req.file) {
          console.warn(`[tracks] Upload sans fichier par ${req.auth.sub}`);
          return res.status(400).json({ message: "Fichier audio requis" });
        }

        const track = await Track.create({
          ownerId: req.auth.sub,
          title: req.body.title || req.file.originalname,
          originalName: req.file.originalname,
          storedName: req.file.filename,
          mimeType: req.file.mimetype,
          size: req.file.size,
          category: "uploaded",
        });

        console.log(`[tracks] Upload enregistré : ${track.id}`);
        res.status(201).json(track.toPublic());
      } catch (error) {
        console.error("[tracks] Erreur après l'enregistrement du fichier", error);

        if (req.file) {
          const uploadedPath = path.join(UPLOADS, req.file.filename);
          try {
            await fsPromises.unlink(uploadedPath);
            console.log(`[tracks] Fichier temporaire supprimé : ${uploadedPath}`);
          } catch (cleanupError) {
            console.error(
              `[tracks] Impossible de supprimer le fichier temporaire ${uploadedPath}`,
              cleanupError,
            );
          }
        }
        next(error);
      }
    },
  );

  /** Envoie le contenu binaire d'une piste après vérification de sa propriété. */
  app.get("/api/tracks/:id/audio", auth, async (req, res, next) => {
    try {
      const track = await Track.findOne({
        _id: req.params.id,
        ownerId: req.auth.sub,
      }).select("+storedName");

      if (!track) {
        console.warn(`[tracks] Audio introuvable ou interdit : ${req.params.id}`);
        return res.status(404).json({ message: "Piste inconnue" });
      }

      const audioPath = path.join(UPLOADS, track.storedName);
      res.type(track.mimeType);
      // Ce callback permet de loguer le succès ou l'erreur du transfert.
      res.sendFile(audioPath, (error) => {
        if (error) {
          console.error(`[tracks] Erreur d'envoi audio ${track.id}`, error);
          if (!res.headersSent) next(error);
          return;
        }
        console.log(`[tracks] Audio envoyé : ${track.id}`);
      });
    } catch (error) {
      console.error("[tracks] Erreur de préparation du flux audio", error);
      next(error);
    }
  });

  /** Supprime la métadonnée et le fichier physique correspondant. */
  app.delete("/api/tracks/:id", auth, async (req, res, next) => {
    try {
      const postUsingTrack = await Post.exists({
        "audio.sourceTrackId": req.params.id,
      });
      if (postUsingTrack) {
        return res.status(409).json({
          message: "Cette piste est liée à une publication. Supprimez d’abord la publication.",
        });
      }

      const playlistUsingTrack = await Playlist.exists({
        "tracks.trackId": req.params.id,
      });
      if (playlistUsingTrack) {
        return res.status(409).json({
          message: "Cette piste est dans une playlist. Retirez-la d’abord de ses playlists.",
        });
      }

      const track = await Track.findOneAndDelete({
        _id: req.params.id,
        ownerId: req.auth.sub,
      }).select("+storedName");

      if (!track) {
        console.warn(`[tracks] Suppression impossible : ${req.params.id}`);
        return res.status(404).json({ message: "Piste inconnue" });
      }

      const audioPath = path.join(UPLOADS, track.storedName);
      try {
        await fsPromises.unlink(audioPath);
        console.log(`[tracks] Fichier supprimé : ${audioPath}`);
      } catch (error) {
        // L'exception n'est volontairement pas ignorée : l'administrateur doit
        // voir ce fichier orphelin si sa suppression échoue.
        console.error(`[tracks] Fichier audio non supprimé : ${audioPath}`, error);
        return res.status(500).json({
          message: "Métadonnée supprimée, mais fichier audio non supprimé",
        });
      }

      res.status(204).end();
    } catch (error) {
      console.error("[tracks] Erreur de suppression", error);
      next(error);
    }
  });

  /** Gestionnaire central des erreurs connues de l'application. */
  app.use((error, _req, res, next) => {
    console.error("[error] Erreur reçue par le gestionnaire central", error);

    if (
      error instanceof multer.MulterError ||
      error?.message === "Format audio non accepté" ||
      error?.message === "Format média non accepté" ||
      error?.message === "Format de photo non accepté"
    ) {
      return res.status(400).json({ message: error.message });
    }
    if (error?.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    if (error?.name === "CastError") {
      return res.status(404).json({ message: "Ressource inconnue" });
    }

    next(error);
  });

  return app;
}
