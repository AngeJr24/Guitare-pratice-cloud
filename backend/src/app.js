import express from "express";
import cors from "cors";
import multer from "multer";
import jwt from "jsonwebtoken";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { User } from "./models/User.js";
import { Track } from "./models/Track.js";
import { Post } from "./models/Post.js";
import { Message } from "./models/Message.js";

// Les fichiers audio restent sur le disque du serveur dans ce TP.
// MongoDB ne conserve que leurs métadonnées : titre, nom, taille, etc.
const UPLOADS = path.resolve("data/uploads");
const MEDIA_UPLOADS = path.resolve("data/media");

try {
  // mkdirSync est utilisé au démarrage : l'application doit disposer de ce
  // dossier avant de pouvoir accepter le premier upload.
  fs.mkdirSync(UPLOADS, { recursive: true });
  fs.mkdirSync(MEDIA_UPLOADS, { recursive: true });
  console.log(`[startup] Dossier des uploads prêt : ${UPLOADS}`);
} catch (error) {
  console.error("[startup] Impossible de créer le dossier des uploads", error);
  throw error;
}

// Ce secret reste côté serveur. Il ne doit jamais être copié dans Angular.
const SECRET = process.env.JWT_SECRET || "tp1-development-secret";

// Les sons et médias de publication sont limités à 25 Mo par fichier.
const MAX_FILE_SIZE = 25 * 1024 * 1024;

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

function publicPost(post) {
  const author = post.authorId;
  return {
    id: String(post._id ?? post.id),
    author: {
      id: String(author?._id ?? author),
      name: author?.name ?? "",
    },
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
    createdAt: post.createdAt,
  };
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

  app.get("/api/users", auth, async (req, res, next) => {
    try {
      const users = await User.find({ _id: { $ne: req.auth.sub } })
        .select("name")
        .sort({ name: 1 })
        .limit(100)
        .lean();
      res.json(
        users.map((user) => ({
          id: String(user._id),
          name: user.name,
        })),
      );
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
      const recipient = await User.findById(userId).select("name").lean();
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
        .populate("senderId", "name")
        .populate("recipientId", "name")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      res.json({
        member: { id: String(recipient._id), name: recipient.name },
        items: messages.reverse().map((message) => ({
          id: String(message._id),
          sender: {
            id: String(message.senderId._id),
            name: message.senderId.name,
          },
          recipient: {
            id: String(message.recipientId._id),
            name: message.recipientId.name,
          },
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
        { path: "senderId", select: "name" },
        { path: "recipientId", select: "name" },
      ]);
      res.status(201).json({
        id: message.id,
        sender: { id: message.senderId.id, name: message.senderId.name },
        recipient: {
          id: message.recipientId.id,
          name: message.recipientId.name,
        },
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
      const filter = {
        $or: [{ visibility: { $ne: "private" } }, { authorId: req.auth.sub }],
      };
      const [items, total] = await Promise.all([
        Post.find(filter)
          .populate("authorId", "name")
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Post.countDocuments(filter),
      ]);

      res.json({
        items: items.map(publicPost),
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
      const track = trackId
        ? await Track.findOne({
            _id: trackId,
            ownerId: req.auth.sub,
            $or: [{ category: "uploaded" }, { category: { $exists: false } }],
          }).select("+storedName")
        : null;
      const hasAudio = Boolean(track);
      const files = req.files ?? [];

      if (trackId && !track) {
        await cleanupPostMedia(files);
        return res.status(404).json({
          message: "La piste sélectionnée est introuvable dans votre bibliothèque",
        });
      }
      if (!hasContent && !hasAudio && files.length === 0) {
        await cleanupPostMedia(files);
        return res.status(400).json({
          message: "Ajoutez un texte, une piste audio ou un média à la publication",
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

      if (track) {
        postData.audio = {
          originalName: track.originalName,
          storedName: track.storedName,
          mimeType: track.mimeType,
          size: track.size,
          sourceTrackId: track._id,
        };
      }
      postData.media = files.map((file) => ({
        originalName: file.originalname,
        storedName: file.filename,
        mimeType: file.mimetype,
        size: file.size,
      }));

      const post = await Post.create(postData);
      await post.populate("authorId", "name");
      res.status(201).json(publicPost(post));
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
      ).populate("authorId", "name");

      if (!post) {
        return res.status(404).json({ message: "Publication introuvable" });
      }

      res.json(publicPost(post));
    } catch (error) {
      console.error("[posts] Erreur de modification", error);
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

      res.status(204).end();
    } catch (error) {
      console.error("[posts] Erreur de suppression", error);
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
      error?.message === "Format média non accepté"
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
