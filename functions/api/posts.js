import { getDatabase, getPost, json, readJson, toPost, validatePost } from "../../lib/posts.js";
import { authenticate } from "../lib/auth.js";

export const onRequestGet = async (context) => {
  const { db, error } = getDatabase(context);
  if (error) return error;

  const { results } = await db.prepare(
    "SELECT * FROM posts ORDER BY created_at DESC",
  ).all();
  return json(results.map(toPost));
};

export const onRequestPost = async (context) => {
  const { db, error } = getDatabase(context);
  if (error) return error;
  const { user, error: authError } = await authenticate(context);
  if (authError) return authError;

  const { value: post, error: bodyError } = await readJson(context.request);
  if (bodyError) return bodyError;
  if (!validatePost(post)) {
    return json({ error: "The post contains invalid or oversized fields." }, 400);
  }

  await db.prepare(`
    INSERT OR IGNORE INTO posts
      (id, author_id, nickname, category, title, body, image, created_at, likes, comments)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    post.id,
    user.id,
    user.nickname,
    post.category,
    post.title.trim(),
    post.body.trim(),
    post.image,
    post.createdAt,
    Math.max(0, Number.isSafeInteger(post.likes) ? post.likes : 0),
    JSON.stringify(post.comments),
  ).run();

  const savedPost = await getPost(db, post.id);
  return json(toPost(savedPost), 201);
};
