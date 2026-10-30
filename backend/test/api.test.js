import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { Track } from "../src/models/Track.js";
import { Post } from "../src/models/Post.js";
import { Message } from "../src/models/Message.js";

let server, base;

test.before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

test("health sans dépendre de MongoDB", async () => {
  const r = await fetch(base + "/api/health");
  assert.equal(r.status, 200);
  assert.equal((await r.json()).status, "ok");
});

test("schémas Mongoose et relation", () => {
  const u = new User({
    name: "Test",
    email: "TEST@example.com",
    password: "12345678",
  });

  assert.equal(u.email, "test@example.com");
  const t = new Track({
    ownerId: new mongoose.Types.ObjectId(),
    title: "Blues",
    originalName: "b.mp3",
    storedName: "x.mp3",
    mimeType: "audio/mpeg",
    size: 42,
  });
  
  assert.equal(t.title, "Blues");
  assert.equal(Track.schema.path("ownerId").options.ref, "User");
});

test("schéma Post requiert un texte de 1 à 2000 caractères et un auteur", async () => {
  const post = new Post({
    authorId: new mongoose.Types.ObjectId(),
    content: "  Une découverte musicale  ",
  });

  await post.validate();
  assert.equal(post.content, "Une découverte musicale");
  assert.equal(post.visibility, "public");
  assert.equal(Post.schema.path("authorId").options.ref, "User");

  const invalidPost = new Post({
    authorId: new mongoose.Types.ObjectId(),
    content: "  ",
  });
  await assert.rejects(invalidPost.validate());
});

test("schéma Post autorise un média sans texte", async () => {
  const post = new Post({
    authorId: new mongoose.Types.ObjectId(),
    content: "",
    media: [{
      originalName: "photo.png",
      storedName: "stored-photo.png",
      mimeType: "image/png",
      size: 42,
    }],
  });

  await post.validate();
  assert.equal(post.media.length, 1);
});

test("schéma Message exige un auteur, un destinataire et un texte", async () => {
  const message = new Message({
    senderId: new mongoose.Types.ObjectId(),
    recipientId: new mongoose.Types.ObjectId(),
    content: "  Salut  ",
  });

  await message.validate();
  assert.equal(message.content, "Salut");
  assert.equal(message.readAt, null);
  assert.equal(Message.schema.path("senderId").options.ref, "User");
  assert.equal(Message.schema.path("recipientId").options.ref, "User");
  await assert.rejects(new Message({
    senderId: new mongoose.Types.ObjectId(),
    recipientId: new mongoose.Types.ObjectId(),
    content: " ",
  }).validate());
});

test("routes du fil et des médias exigent une authentification", async () => {
  const [listResponse, createResponse, mediaResponse] = await Promise.all([
    fetch(`${base}/api/posts`),
    fetch(`${base}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Bonjour" }),
    }),
    fetch(
      `${base}/api/posts/${new mongoose.Types.ObjectId()}/media/${new mongoose.Types.ObjectId()}`,
    ),
  ]);

  assert.equal(listResponse.status, 401);
  assert.equal(createResponse.status, 401);
  assert.equal(mediaResponse.status, 401);
  const patchResponse = await fetch(
    `${base}/api/posts/${new mongoose.Types.ObjectId()}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Modification", visibility: "private" }),
    },
  );
  const deleteResponse = await fetch(
    `${base}/api/posts/${new mongoose.Types.ObjectId()}`,
    { method: "DELETE" },
  );
  assert.equal(patchResponse.status, 401);
  assert.equal(deleteResponse.status, 401);
});

test("API refuse les publications vides ou trop longues", async () => {
  const token = jwt.sign(
    { sub: new mongoose.Types.ObjectId().toString() },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const [emptyResponse, oversizedResponse] = await Promise.all([
    fetch(`${base}/api/posts`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content: "   " }),
    }),
    fetch(`${base}/api/posts`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content: "x".repeat(2001) }),
    }),
  ]);

  assert.equal(emptyResponse.status, 400);
  assert.equal(oversizedResponse.status, 400);
});

test("API refuse les visibilités inconnues à la création et à la modification", async () => {
  const token = jwt.sign(
    { sub: new mongoose.Types.ObjectId().toString() },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const postId = new mongoose.Types.ObjectId().toString();
  const [createResponse, updateResponse] = await Promise.all([
    fetch(`${base}/api/posts`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content: "Texte", visibility: "friends" }),
    }),
    fetch(`${base}/api/posts/${postId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ content: "Texte", visibility: "friends" }),
    }),
  ]);

  assert.equal(createResponse.status, 400);
  assert.equal(updateResponse.status, 400);
});

test("la modification filtre le post sur l'identifiant de son auteur", async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const postId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const updatedPost = {
    id: postId,
    authorId: { id: userId, name: "Test" },
    content: "Modifié",
    visibility: "private",
    createdAt: new Date(),
  };
  const originalFindOneAndUpdate = Post.findOneAndUpdate;
  let updateFilter;
  let update;
  Post.findOneAndUpdate = (filter, changes) => {
    updateFilter = filter;
    update = changes;
    return { populate: async () => updatedPost };
  };

  try {
    const response = await fetch(`${base}/api/posts/${postId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: " Modifié ", visibility: "private" }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(updateFilter, { _id: postId, authorId: userId });
    assert.deepEqual(update, {
      $set: { content: "Modifié", visibility: "private" },
    });
    assert.equal((await response.json()).visibility, "private");
  } finally {
    Post.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("le fil retourne les posts publics et ceux de l'utilisateur connecté", async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const originalFind = Post.find;
  const originalCountDocuments = Post.countDocuments;
  const filters = [];
  const query = {
    populate() {
      return this;
    },
    sort() {
      return this;
    },
    skip() {
      return this;
    },
    limit() {
      return this;
    },
    lean: async () => [],
  };
  Post.find = (filter) => {
    filters.push(filter);
    return query;
  };
  Post.countDocuments = async (filter) => {
    filters.push(filter);
    return 0;
  };

  try {
    const response = await fetch(`${base}/api/posts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.total, 0);
    assert.deepEqual(filters, [
      {
        $or: [
          { visibility: { $ne: "private" } },
          { authorId: userId },
        ],
      },
      {
        $or: [
          { visibility: { $ne: "private" } },
          { authorId: userId },
        ],
      },
    ]);
  } finally {
    Post.find = originalFind;
    Post.countDocuments = originalCountDocuments;
  }
});

test("la suppression filtre le post sur l'identifiant de son auteur", async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const postId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const originalFindOneAndDelete = Post.findOneAndDelete;
  let deleteFilter;
  Post.findOneAndDelete = (filter) => ({
    select: async () => {
    deleteFilter = filter;
    return null;
    },
  });

  try {
    const response = await fetch(`${base}/api/posts/${postId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 404);
    assert.deepEqual(deleteFilter, { _id: postId, authorId: userId });
  } finally {
    Post.findOneAndDelete = originalFindOneAndDelete;
  }
});

test("une publication audio doit référencer une piste de la bibliothèque de son auteur", async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const trackId = new mongoose.Types.ObjectId().toString();
  const postId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const originalFindOne = Track.findOne;
  const originalCreate = Post.create;
  let trackFilter;
  let postData;
  const track = {
    _id: trackId,
    originalName: "practice.mp3",
    storedName: "stored-practice.mp3",
    mimeType: "audio/mpeg",
    size: 42,
  };
  const post = {
    id: postId,
    authorId: { id: userId, name: "Test" },
    content: "Mon morceau",
    visibility: "public",
    audio: {
      originalName: track.originalName,
      mimeType: track.mimeType,
      size: track.size,
    },
    createdAt: new Date(),
    populate: async function () {
      return this;
    },
  };
  Track.findOne = (filter) => {
    trackFilter = filter;
    return { select: async () => track };
  };
  Post.create = async (data) => {
    postData = data;
    return post;
  };

  try {
    const response = await fetch(`${base}/api/posts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: "Mon morceau",
        visibility: "public",
        trackId,
      }),
    });

    assert.equal(response.status, 201);
    assert.equal(trackFilter._id, trackId);
    assert.equal(trackFilter.ownerId, userId);
    assert.deepEqual(trackFilter.$or, [
      { category: "uploaded" },
      { category: { $exists: false } },
    ]);
    assert.equal(postData.audio.sourceTrackId, trackId);
    assert.equal(postData.audio.storedName, track.storedName);
  } finally {
    Track.findOne = originalFindOne;
    Post.create = originalCreate;
  }
});

test("l’ancienne route de téléchargement communautaire n’existe plus", async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const authorId = new mongoose.Types.ObjectId().toString();
  const postId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const originalFindById = Post.findById;
  Post.findById = () => ({
    select() {
      return this;
    },
    populate: async () => ({
      _id: postId,
      visibility: "private",
      audio: { storedName: "private.mp3" },
      authorId: { _id: authorId },
    }),
  });

  try {
    const response = await fetch(`${base}/api/posts/${postId}/download`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 404);
  } finally {
    Post.findById = originalFindById;
  }
});

test("une piste référencée par une publication ne peut pas être supprimée", async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const trackId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const originalPostExists = Post.exists;
  const originalTrackDelete = Track.findOneAndDelete;
  let deleteCalled = false;
  Post.exists = async () => ({ _id: new mongoose.Types.ObjectId() });
  Track.findOneAndDelete = () => {
    deleteCalled = true;
  };

  try {
    const response = await fetch(`${base}/api/tracks/${trackId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 409);
    assert.equal(deleteCalled, false);
  } finally {
    Post.exists = originalPostExists;
    Track.findOneAndDelete = originalTrackDelete;
  }
});

test("les routes des membres et messages exigent une authentification", async () => {
  const memberResponse = await fetch(`${base}/api/users`);
  const unreadResponse = await fetch(`${base}/api/messages/unread-counts`);
  const conversationResponse = await fetch(
    `${base}/api/messages/${new mongoose.Types.ObjectId()}`,
  );
  const sendResponse = await fetch(
    `${base}/api/messages/${new mongoose.Types.ObjectId()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Salut" }),
    },
  );

  assert.deepEqual(
    [
      memberResponse.status,
      unreadResponse.status,
      conversationResponse.status,
      sendResponse.status,
    ],
    [401, 401, 401, 401],
  );
});

test("les compteurs de messages non lus sont calculés par expéditeur", async () => {
  const recipientId = new mongoose.Types.ObjectId().toString();
  const senderId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign(
    { sub: recipientId },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const originalAggregate = Message.aggregate;
  let pipeline;
  Message.aggregate = async (value) => {
    pipeline = value;
    return [{ _id: new mongoose.Types.ObjectId(senderId), count: 3 }];
  };

  try {
    const response = await fetch(`${base}/api/messages/unread-counts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      total: 3,
      bySender: [{ senderId, count: 3 }],
    });
    assert.equal(
      String(pipeline[0].$match.recipientId),
      recipientId,
    );
    assert.equal(pipeline[0].$match.readAt, null);
  } finally {
    Message.aggregate = originalAggregate;
  }
});

test("l’ouverture d’une conversation marque ses messages entrants comme lus", async () => {
  const recipientId = new mongoose.Types.ObjectId().toString();
  const senderId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign(
    { sub: recipientId },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const originalUserFind = User.findById;
  const originalUpdateMany = Message.updateMany;
  const originalMessageFind = Message.find;
  let readFilter;
  User.findById = () => ({
    select() {
      return this;
    },
    lean: async () => ({ _id: senderId, name: "Expéditeur" }),
  });
  Message.updateMany = async (filter) => {
    readFilter = filter;
  };
  const query = {
    populate() {
      return this;
    },
    sort() {
      return this;
    },
    limit() {
      return this;
    },
    lean: async () => [],
  };
  Message.find = () => query;

  try {
    const response = await fetch(`${base}/api/messages/${senderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(readFilter, {
      senderId,
      recipientId,
      readAt: null,
    });
    assert.deepEqual((await response.json()).items, []);
  } finally {
    User.findById = originalUserFind;
    Message.updateMany = originalUpdateMany;
    Message.find = originalMessageFind;
  }
});

test("la messagerie refuse un identifiant destinataire invalide", async () => {
  const token = jwt.sign(
    { sub: new mongoose.Types.ObjectId().toString() },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const response = await fetch(`${base}/api/messages/invalid`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(response.status, 400);
});

test("l’envoi d’un message utilise l’auteur du JWT et nettoie le texte", async () => {
  const senderId = new mongoose.Types.ObjectId().toString();
  const recipientId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign(
    { sub: senderId },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const originalExists = User.exists;
  const originalCreate = Message.create;
  let createdMessage;
  User.exists = async (filter) => filter._id === recipientId;
  Message.create = async (data) => {
    createdMessage = data;
    return {
      id: new mongoose.Types.ObjectId().toString(),
      senderId: null,
      recipientId: null,
      content: data.content,
      createdAt: new Date(),
      populate: async function () {
        this.senderId = { id: senderId, name: "Expéditeur" };
        this.recipientId = { id: recipientId, name: "Destinataire" };
        return this;
      },
    };
  };

  try {
    const response = await fetch(`${base}/api/messages/${recipientId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: "  Bonjour !  " }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(createdMessage.senderId, senderId);
    assert.equal(createdMessage.recipientId, recipientId);
    assert.equal(createdMessage.content, "Bonjour !");
    assert.equal(createdMessage.readAt, null);
    assert.equal(body.sender.id, senderId);
    assert.equal(body.content, "Bonjour !");
  } finally {
    User.exists = originalExists;
    Message.create = originalCreate;
  }
});

test("l’accès aux médias des posts respecte la visibilité privée", async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const postId = new mongoose.Types.ObjectId().toString();
  const mediaId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const originalFindOne = Post.findOne;
  let mediaFilter;
  Post.findOne = (filter) => {
    mediaFilter = filter;
    return { select: async () => null };
  };

  try {
    const response = await fetch(
      `${base}/api/posts/${postId}/media/${mediaId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    assert.equal(response.status, 404);
    assert.deepEqual(mediaFilter, {
      _id: postId,
      $or: [{ visibility: { $ne: "private" } }, { authorId: userId }],
    });
  } finally {
    Post.findOne = originalFindOne;
  }
});

test("une publication multipart enregistre les métadonnées du média", async () => {
  const authorId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign(
    { sub: authorId },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const originalCreate = Post.create;
  let createdPost;
  Post.create = async (data) => {
    createdPost = {
      _id: new mongoose.Types.ObjectId(),
      authorId: { _id: authorId, name: "Test" },
      content: data.content,
      visibility: data.visibility,
      audio: null,
      media: data.media.map((media) => ({
        ...media,
        _id: new mongoose.Types.ObjectId(),
      })),
      createdAt: new Date(),
      populate: async function () {
        return this;
      },
    };
    return createdPost;
  };

  const form = new FormData();
  form.append("content", "Photo du jour");
  form.append("visibility", "public");
  form.append("media", new Blob(["image-data"], { type: "image/png" }), "photo.png");

  try {
    const response = await fetch(`${base}/api/posts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(createdPost.media.length, 1);
    assert.equal(createdPost.media[0].mimeType, "image/png");
    assert.notEqual(createdPost.media[0].storedName, "photo.png");
    assert.equal(body.media[0].originalName, "photo.png");
    assert.equal(body.media[0].mimeType, "image/png");
    assert.equal(body.content, "Photo du jour");
  } finally {
    Post.create = originalCreate;
    if (createdPost?.media[0]?.storedName) {
      await fsPromises.unlink(
        path.resolve("data/media", createdPost.media[0].storedName),
      );
    }
  }
});
