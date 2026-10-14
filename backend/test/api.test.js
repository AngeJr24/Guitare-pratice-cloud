import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { Track } from "../src/models/Track.js";
import { Post } from "../src/models/Post.js";

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

test("routes du fil exigent une authentification", async () => {
  const [listResponse, createResponse] = await Promise.all([
    fetch(`${base}/api/posts`),
    fetch(`${base}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Bonjour" }),
    }),
  ]);

  assert.equal(listResponse.status, 401);
  assert.equal(createResponse.status, 401);
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
  Post.findOneAndDelete = async (filter) => {
    deleteFilter = filter;
    return null;
  };

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
