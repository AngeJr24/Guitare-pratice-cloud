import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { Track } from "../src/models/Track.js";
import { Post } from "../src/models/Post.js";
import { Comment } from "../src/models/Comment.js";
import { Message } from "../src/models/Message.js";
import { Playlist } from "../src/models/Playlist.js";

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

  const playlist = new Playlist({
    ownerId: new mongoose.Types.ObjectId(),
    name: "  Répétition  ",
  });
  assert.equal(playlist.name, "Répétition");
  assert.equal(playlist.visibility, "private");
  assert.deepEqual(playlist.tracks, []);
  assert.equal(Playlist.schema.path("ownerId").options.ref, "User");
  assert.equal(
    Playlist.schema.path("tracks").schema.path("trackId").options.ref,
    "Track",
  );
  assert.equal(
    Playlist.schema.path("tracks").schema.path("addedBy").options.ref,
    "User",
  );

  const profileUser = new User({
    name: "Profil",
    email: "profil@example.com",
    password: "12345678",
    profilePhoto: {
      storedName: "private-name.png",
      mimeType: "image/png",
      size: 42,
    },
  });
  assert.deepEqual(profileUser.toPublic().profilePhoto, {
    mimeType: "image/png",
    size: 42,
  });
  assert.equal(profileUser.toPublic().profilePhoto.storedName, undefined);
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

test("schéma Comment et réactions de publication valident leurs données", async () => {
  const comment = new Comment({
    postId: new mongoose.Types.ObjectId(),
    authorId: new mongoose.Types.ObjectId(),
    content: "  Très belle photo  ",
  });
  await comment.validate();
  assert.equal(comment.content, "Très belle photo");

  const post = new Post({
    authorId: new mongoose.Types.ObjectId(),
    content: "Publication",
    reactions: { "user-1": "love" },
  });
  await post.validate();
  assert.equal(post.reactions.get("user-1"), "love");

  post.reactions.set("user-2", "unknown");
  await assert.rejects(post.validate());
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

test("mes publications filtre sur l'auteur et la visibilité demandée", async () => {
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
    const response = await fetch(
      `${base}/api/posts?scope=mine&visibility=private`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.total, 0);
    assert.deepEqual(filters, [
      { $and: [{ authorId: userId }, { visibility: "private" }] },
      { $and: [{ authorId: userId }, { visibility: "private" }] },
    ]);
  } finally {
    Post.find = originalFind;
    Post.countDocuments = originalCountDocuments;
  }
});

test("mes publications ne renvoie jamais les posts d'un autre auteur", async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const otherUserId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const originalFind = Post.find;
  const originalCountDocuments = Post.countDocuments;
  const ownPost = {
    _id: new mongoose.Types.ObjectId(),
    authorId: {
      _id: userId,
      name: "Moi",
      profilePhoto: {
        storedName: "private-profile-photo.png",
        mimeType: "image/png",
        size: 42,
      },
    },
    content: "Ma publication",
    visibility: "public",
    media: [],
    createdAt: new Date(),
  };
  const otherPost = {
    ...ownPost,
    _id: new mongoose.Types.ObjectId(),
    authorId: { _id: otherUserId, name: "Autre membre" },
    content: "Publication d'un autre membre",
  };
  let authorSelection;
  const query = {
    populate(_path, selection) {
      authorSelection = selection;
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
    lean: async () => [ownPost, otherPost],
  };
  Post.find = () => query;
  Post.countDocuments = async () => 1;

  try {
    const response = await fetch(`${base}/api/posts?scope=mine`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.items.map((post) => post.author.id), [userId]);
    assert.deepEqual(body.items.map((post) => post.content), ["Ma publication"]);
    assert.equal(
      authorSelection,
      "name profilePhoto.mimeType profilePhoto.size",
    );
    assert.deepEqual(body.items[0].author, {
      id: userId,
      name: "Moi",
      profilePhoto: { mimeType: "image/png", size: 42 },
    });
  } finally {
    Post.find = originalFind;
    Post.countDocuments = originalCountDocuments;
  }
});

test("une réaction est unique par utilisateur et renvoie le récapitulatif", async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const postId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const originalFindOneAndUpdate = Post.findOneAndUpdate;
  let filter;
  let update;
  const updatedPost = {
    _id: postId,
    authorId: { _id: userId, name: "Moi" },
    content: "Une publication",
    visibility: "public",
    audio: null,
    media: [],
    reactions: new Map([[userId, "love"]]),
    createdAt: new Date(),
    populate: async function () {
      return this;
    },
  };
  Post.findOneAndUpdate = (query, changes) => {
    filter = query;
    update = changes;
    return {
      populate: async () => updatedPost,
    };
  };

  try {
    const response = await fetch(`${base}/api/posts/${postId}/reaction`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reaction: "love" }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(filter, {
      _id: postId,
      $or: [{ visibility: { $ne: "private" } }, { authorId: userId }],
    });
    assert.deepEqual(update, { $set: { [`reactions.${userId}`]: "love" } });
    assert.equal(body.myReaction, "love");
    assert.equal(body.reactionCounts.love, 1);

    const invalidResponse = await fetch(`${base}/api/posts/${postId}/reaction`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reaction: "unknown" }),
    });
    assert.equal(invalidResponse.status, 400);
  } finally {
    Post.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("un commentaire est validé, associé à l'auteur et lisible dans son post", async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const postId = new mongoose.Types.ObjectId().toString();
  const commentId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const originalPostExists = Post.exists;
  const originalCommentCreate = Comment.create;
  const originalCommentFind = Comment.find;
  const readableFilter = {
    _id: postId,
    $or: [{ visibility: { $ne: "private" } }, { authorId: userId }],
  };
  let createData;
  Post.exists = async (filter) => {
    assert.deepEqual(filter, readableFilter);
    return { _id: postId };
  };
  Comment.create = async (data) => {
    createData = data;
    return {
      _id: commentId,
      ...data,
      authorId: { _id: userId, name: "Moi" },
      createdAt: new Date(),
      populate: async function () {
        return this;
      },
    };
  };
  const commentQuery = {
    populate() {
      return this;
    },
    sort() {
      return this;
    },
    limit() {
      return this;
    },
    lean: async () => [{
      _id: commentId,
      authorId: { _id: userId, name: "Moi" },
      content: "Très belle photo",
      createdAt: new Date(),
    }],
  };
  Comment.find = (filter) => {
    assert.deepEqual(filter, { postId });
    return commentQuery;
  };

  try {
    const invalidResponse = await fetch(`${base}/api/posts/${postId}/comments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: "   " }),
    });
    const createResponse = await fetch(`${base}/api/posts/${postId}/comments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: "  Très belle photo  " }),
    });
    const created = await createResponse.json();
    const listResponse = await fetch(`${base}/api/posts/${postId}/comments`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const listed = await listResponse.json();

    assert.equal(invalidResponse.status, 400);
    assert.equal(createResponse.status, 201);
    assert.equal(createData.postId, postId);
    assert.equal(createData.authorId, userId);
    assert.equal(createData.content, "Très belle photo");
    assert.equal(created.author.id, userId);
    assert.equal(listResponse.status, 200);
    assert.equal(listed[0].content, "Très belle photo");
  } finally {
    Post.exists = originalPostExists;
    Comment.create = originalCommentCreate;
    Comment.find = originalCommentFind;
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

test("la création d'une publication audio est temporairement désactivée", async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const trackId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const originalFindOne = Track.findOne;
  const originalCreate = Post.create;
  Track.findOne = () => {
    throw new Error("Une publication audio ne doit pas charger de piste");
  };
  Post.create = () => {
    throw new Error("Une publication audio ne doit pas être créée");
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

    assert.equal(response.status, 400);
    assert.match(
      (await response.json()).message,
      /publications audio ne sont pas disponibles/i,
    );
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

test("les routes de playlists exigent une authentification", async () => {
      const playlistId = new mongoose.Types.ObjectId();
      const trackId = new mongoose.Types.ObjectId();
      const requests = [
        fetch(`${base}/api/playlists`),
        fetch(`${base}/api/playlists`, { method: "POST" }),
        fetch(`${base}/api/playlists/${playlistId}`),
        fetch(`${base}/api/playlists/${playlistId}`, { method: "PATCH" }),
        fetch(`${base}/api/playlists/${playlistId}`, { method: "DELETE" }),
        fetch(`${base}/api/playlists/${playlistId}/tracks`, { method: "POST" }),
        fetch(`${base}/api/playlists/${playlistId}/tracks/${trackId}`, {
          method: "DELETE",
        }),
        fetch(`${base}/api/playlists/${playlistId}/tracks/${trackId}/audio`),
      ];
      const responses = await Promise.all(requests);
      assert.deepEqual(responses.map((response) => response.status), Array(8).fill(401));
});

test("les playlists listées sont publiques ou appartiennent au membre", async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const originalFind = Playlist.find;
  let filter;
  Playlist.find = (query) => {
    filter = query;
    return {
      populate() {
        return this;
      },
      sort() {
        return this;
      },
      lean: async () => [],
    };
  };

  try {
    const response = await fetch(`${base}/api/playlists`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(filter, {
      $or: [
        { ownerId: userId },
        { visibility: { $in: ["public", "collaborative"] } },
      ],
    });
  } finally {
    Playlist.find = originalFind;
  }
});

test("la découverte renvoie aussi une playlist publique créée par un autre membre", async () => {
  const viewerId = new mongoose.Types.ObjectId().toString();
  const ownerId = new mongoose.Types.ObjectId().toString();
  const playlistId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign(
    { sub: viewerId },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const originalFind = Playlist.find;
  Playlist.find = () => ({
    populate() {
      return this;
    },
    sort() {
      return this;
    },
    lean: async () => [{
      _id: playlistId,
      ownerId: { _id: ownerId, name: "Créateur" },
      name: "Session publique",
      visibility: "public",
      tracks: [],
    }],
  });

  try {
    const response = await fetch(`${base}/api/playlists`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.length, 1);
    assert.equal(body[0].id, playlistId);
    assert.deepEqual(body[0].owner, { id: ownerId, name: "Créateur" });
    assert.equal(body[0].visibility, "public");
  } finally {
    Playlist.find = originalFind;
  }
});

test("la création de playlist valide le nom et la visibilité", async () => {
  const token = jwt.sign(
    { sub: new mongoose.Types.ObjectId().toString() },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const emptyNameResponse = await fetch(`${base}/api/playlists`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "   ", visibility: "private" }),
  });
  const invalidVisibilityResponse = await fetch(`${base}/api/playlists`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "Jam", visibility: "friends" }),
  });

  assert.equal(emptyNameResponse.status, 400);
  assert.equal(invalidVisibilityResponse.status, 400);
});

test("le créateur peut rendre sa playlist publique", async () => {
  const ownerId = new mongoose.Types.ObjectId().toString();
  const playlistId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign(
    { sub: ownerId },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const originalFindOneAndUpdate = Playlist.findOneAndUpdate;
  let updateFilter;
  let updateDocument;
  Playlist.findOneAndUpdate = (filter, update) => {
    updateFilter = filter;
    updateDocument = update;
    return {
      populate() {
        return this;
      },
      lean: async () => ({
        _id: playlistId,
        ownerId: { _id: ownerId, name: "Créateur" },
        name: "Session",
        visibility: "public",
        tracks: [],
      }),
    };
  };

  try {
    const response = await fetch(`${base}/api/playlists/${playlistId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ visibility: "public" }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(updateFilter, { _id: playlistId, ownerId });
    assert.deepEqual(updateDocument.$set, { visibility: "public" });
    assert.equal(body.visibility, "public");
  } finally {
    Playlist.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("les playlists privées sont invisibles aux autres membres", async () => {
      const ownerId = new mongoose.Types.ObjectId().toString();
      const viewerId = new mongoose.Types.ObjectId().toString();
      const playlistId = new mongoose.Types.ObjectId().toString();
      const token = jwt.sign(
        { sub: viewerId },
        process.env.JWT_SECRET || "tp1-development-secret",
      );
      const originalFind = Playlist.findById;
      let playlistOwner = ownerId;
      Playlist.findById = () => ({
        populate() {
          return this;
        },
        lean: async () => ({
          _id: playlistId,
          ownerId: playlistOwner,
          name: "Privée",
          visibility: "private",
          tracks: [],
        }),
      });

      try {
        const hiddenResponse = await fetch(`${base}/api/playlists/${playlistId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(hiddenResponse.status, 404);

        playlistOwner = viewerId;
        const ownerResponse = await fetch(`${base}/api/playlists/${playlistId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(ownerResponse.status, 200);
        const body = await ownerResponse.json();
        assert.equal(body.owner.id, viewerId);
        assert.equal(body.name, "Privée");
      } finally {
        Playlist.findById = originalFind;
      }
});

test("une piste utilisée par une playlist ne peut pas être supprimée", async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const trackId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const originalPostExists = Post.exists;
  const originalPlaylistExists = Playlist.exists;
  const originalTrackDelete = Track.findOneAndDelete;
  let deleteCalled = false;
  Post.exists = async () => null;
  Playlist.exists = async (filter) => {
    assert.deepEqual(filter, { "tracks.trackId": trackId });
    return { _id: new mongoose.Types.ObjectId() };
  };
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
    Playlist.exists = originalPlaylistExists;
    Track.findOneAndDelete = originalTrackDelete;
  }
});

test("une playlist collaborative accepte uniquement les pistes du membre connecté", async () => {
      const ownerId = new mongoose.Types.ObjectId().toString();
      const contributorId = new mongoose.Types.ObjectId().toString();
      const playlistId = new mongoose.Types.ObjectId().toString();
      const trackId = new mongoose.Types.ObjectId().toString();
      const token = jwt.sign(
        { sub: contributorId },
        process.env.JWT_SECRET || "tp1-development-secret",
      );
      const originalFindById = Playlist.findById;
      const originalTrackFindOne = Track.findOne;
      const originalUpdateOne = Playlist.updateOne;
      let findCount = 0;
      let addedTrack;
      Playlist.findById = () => {
        findCount += 1;
        if (findCount === 1) {
          return {
            _id: playlistId,
            ownerId,
            visibility: "collaborative",
            tracks: [],
          };
        }
        return {
          populate() {
            return this;
          },
          lean: async () => ({
            _id: playlistId,
            ownerId: { _id: ownerId, name: "Créateur" },
            name: "Jam",
            visibility: "collaborative",
            tracks: [{
              trackId: {
                _id: trackId,
                title: "Improvisation",
                originalName: "jam.mp3",
                mimeType: "audio/mpeg",
                size: 12,
              },
              addedBy: contributorId,
              addedAt: new Date("2026-11-17T00:00:00.000Z"),
            }],
          }),
        };
      };
      Track.findOne = async (filter) => {
        assert.deepEqual(filter, { _id: trackId, ownerId: contributorId });
        return { _id: trackId };
      };
      Playlist.updateOne = async (_filter, update) => {
        addedTrack = update.$push.tracks;
        return { matchedCount: 1 };
      };

      try {
        const response = await fetch(`${base}/api/playlists/${playlistId}/tracks`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ trackId }),
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.deepEqual(addedTrack, { trackId, addedBy: contributorId });
        assert.equal(body.tracks[0].track.id, trackId);
        assert.equal(body.tracks[0].addedBy, contributorId);
      } finally {
        Playlist.findById = originalFindById;
        Track.findOne = originalTrackFindOne;
        Playlist.updateOne = originalUpdateOne;
      }
});

test("un membre collaborateur ne peut retirer que sa propre contribution", async () => {
      const ownerId = new mongoose.Types.ObjectId().toString();
      const contributorId = new mongoose.Types.ObjectId().toString();
      const otherContributorId = new mongoose.Types.ObjectId().toString();
      const playlistId = new mongoose.Types.ObjectId().toString();
      const trackId = new mongoose.Types.ObjectId().toString();
      const token = jwt.sign(
        { sub: contributorId },
        process.env.JWT_SECRET || "tp1-development-secret",
      );
      const originalFindById = Playlist.findById;
      const originalUpdateOne = Playlist.updateOne;
      let addedBy = otherContributorId;
      let allowDetailedRead = false;
      let updateFilter;
      Playlist.findById = () => {
        if (allowDetailedRead) {
          return {
            populate() {
              return this;
            },
            lean: async () => ({
              _id: playlistId,
              ownerId: { _id: ownerId, name: "Créateur" },
              name: "Jam",
              visibility: "collaborative",
              tracks: [],
            }),
          };
        }
        return {
          _id: playlistId,
          ownerId,
          visibility: "collaborative",
          tracks: [{ trackId, addedBy }],
        };
      };
      Playlist.updateOne = async (filter) => {
        updateFilter = filter;
        allowDetailedRead = true;
        return { matchedCount: 1 };
      };

      try {
        const forbiddenResponse = await fetch(
          `${base}/api/playlists/${playlistId}/tracks/${trackId}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
        );
        assert.equal(forbiddenResponse.status, 404);
        assert.equal(updateFilter, undefined);

        addedBy = contributorId;
        const allowedResponse = await fetch(
          `${base}/api/playlists/${playlistId}/tracks/${trackId}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
        );
        assert.equal(allowedResponse.status, 200);
        assert.deepEqual(updateFilter.tracks, {
          $elemMatch: { trackId, addedBy: contributorId },
        });
      } finally {
        Playlist.findById = originalFindById;
        Playlist.updateOne = originalUpdateOne;
      }
});

test("les routes des membres et messages exigent une authentification", async () => {
  const memberResponse = await fetch(`${base}/api/users`);
  const photoResponse = await fetch(`${base}/api/users/me/photo`);
  const memberPhotoResponse = await fetch(
    `${base}/api/members/${new mongoose.Types.ObjectId()}/photo`,
  );
  const uploadPhotoResponse = await fetch(`${base}/api/users/me/photo`, {
    method: "POST",
  });
  const deletePhotoResponse = await fetch(`${base}/api/users/me/photo`, {
    method: "DELETE",
  });
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
      photoResponse.status,
      memberPhotoResponse.status,
      uploadPhotoResponse.status,
      deletePhotoResponse.status,
      unreadResponse.status,
      conversationResponse.status,
      sendResponse.status,
    ],
    [401, 401, 401, 401, 401, 401, 401, 401],
  );
});

test("les membres exposent les métadonnées publiques de leur photo", async () => {
  const currentUserId = new mongoose.Types.ObjectId().toString();
  const memberId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign(
    { sub: currentUserId },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const originalFind = User.find;
  User.find = () => ({
    select() {
      return this;
    },
    sort() {
      return this;
    },
    limit() {
      return this;
    },
    lean: async () => [
      {
        _id: memberId,
        name: "Membre",
        profilePhoto: {
          storedName: "private-name.png",
          mimeType: "image/png",
          size: 42,
        },
      },
    ],
  });

  try {
    const response = await fetch(`${base}/api/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [
      {
        id: memberId,
        name: "Membre",
        profilePhoto: { mimeType: "image/png", size: 42 },
      },
    ]);
  } finally {
    User.find = originalFind;
  }
});

test("photo de profil : ajout, remplacement, lecture et suppression", async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const originalFindById = User.findById;
  const profileDirectory = path.resolve("data/profile-photos");
  const user = {
    id: userId,
    name: "Profil",
    email: "profil@example.com",
    profilePhoto: null,
    toPublic() {
      return {
        id: this.id,
        name: this.name,
        email: this.email,
        profilePhoto: this.profilePhoto
          ? {
              mimeType: this.profilePhoto.mimeType,
              size: this.profilePhoto.size,
            }
          : null,
      };
    },
    async save() {},
  };
  User.findById = () => ({
    select: async () => user,
  });
  const headers = { Authorization: `Bearer ${token}` };
  const generatedFiles = [];
  const uploadPhoto = async (contents) => {
    const form = new FormData();
    form.append(
      "photo",
      new Blob([contents], { type: "image/png" }),
      "avatar.png",
    );
    const response = await fetch(`${base}/api/users/me/photo`, {
      method: "POST",
      headers,
      body: form,
    });
    if (user.profilePhoto?.storedName) {
      generatedFiles.push(user.profilePhoto.storedName);
    }
    return response;
  };

  try {
    const firstUploadResponse = await uploadPhoto("first-photo");
    const firstUploadBody = await firstUploadResponse.json();
    const firstStoredName = user.profilePhoto.storedName;
    assert.equal(firstUploadResponse.status, 200);
    assert.deepEqual(firstUploadBody.profilePhoto, {
      mimeType: "image/png",
      size: Buffer.byteLength("first-photo"),
    });
    assert.equal(firstUploadBody.profilePhoto.storedName, undefined);
    assert.ok(firstStoredName);

    const memberPhotoResponse = await fetch(
      `${base}/api/members/${userId}/photo`,
      { headers },
    );
    assert.equal(memberPhotoResponse.status, 200);
    assert.equal(memberPhotoResponse.headers.get("content-type"), "image/png");
    assert.equal(await memberPhotoResponse.text(), "first-photo");

    const replacementResponse = await uploadPhoto("replacement-photo");
    const replacementBody = await replacementResponse.json();
    const replacementStoredName = user.profilePhoto.storedName;
    assert.equal(replacementResponse.status, 200);
    assert.notEqual(replacementStoredName, firstStoredName);
    await assert.rejects(
      fsPromises.access(path.join(profileDirectory, firstStoredName)),
    );

    const photoResponse = await fetch(`${base}/api/users/me/photo`, {
      headers,
    });
    assert.equal(photoResponse.status, 200);
    assert.equal(photoResponse.headers.get("content-type"), "image/png");
    assert.equal(await photoResponse.text(), "replacement-photo");
    assert.deepEqual(replacementBody.profilePhoto, user.toPublic().profilePhoto);

    const deleteResponse = await fetch(`${base}/api/users/me/photo`, {
      method: "DELETE",
      headers,
    });
    assert.equal(deleteResponse.status, 204);
    assert.equal(user.profilePhoto, null);
    await assert.rejects(
      fsPromises.access(path.join(profileDirectory, replacementStoredName)),
    );
    const missingPhotoResponse = await fetch(
      `${base}/api/users/me/photo`,
      { headers },
    );
    assert.equal(missingPhotoResponse.status, 404);
  } finally {
    User.findById = originalFindById;
    await Promise.all(
      generatedFiles.map((filename) =>
        fsPromises.rm(path.join(profileDirectory, filename), { force: true }),
      ),
    );
  }
});

test("photo de profil refuse les formats non image", async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const token = jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const form = new FormData();
  form.append(
    "photo",
    new Blob(["not an image"], { type: "application/pdf" }),
    "document.pdf",
  );

  const response = await fetch(`${base}/api/users/me/photo`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  assert.equal(response.status, 400);
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
    const body = await response.json();
    assert.deepEqual(body.member, {
      id: senderId,
      name: "Expéditeur",
      profilePhoto: null,
    });
    assert.deepEqual(body.items, []);
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
    assert.equal(body.sender.profilePhoto, null);
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

test("un média de publication est servi depuis le dossier persistant", async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const postId = new mongoose.Types.ObjectId().toString();
  const mediaId = new mongoose.Types.ObjectId().toString();
  const storedName = `${crypto.randomUUID()}.png`;
  const mediaPath = path.resolve("data/media", storedName);
  const token = jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET || "tp1-development-secret",
  );
  const originalFindOne = Post.findOne;
  await fsPromises.writeFile(mediaPath, Buffer.from("image-data"));
  Post.findOne = () => ({
    select: async () => ({
      id: postId,
      media: [{
        _id: mediaId,
        storedName,
        mimeType: "image/png",
      }],
    }),
  });

  try {
    const response = await fetch(
      `${base}/api/posts/${postId}/media/${mediaId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
    assert.equal(await response.text(), "image-data");
  } finally {
    Post.findOne = originalFindOne;
    await fsPromises.unlink(mediaPath);
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
