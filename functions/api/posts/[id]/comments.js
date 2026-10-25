import { getDatabase, getPost, json, readJson, toPost } from "../../../../lib/posts.js";

export const onRequestPost = async (context) => {
  const { db, error } = getDatabase(context);
  if (error) return error;

  const { value: comment, error: bodyError } = await readJson(context.request);
  if (bodyError) return bodyError;
  if (
    !comment ||
    typeof comment.id !== "string" || comment.id.length > 100 ||
    typeof comment.body !== "string" ||
    !comment.body.trim() || comment.body.length > 500 ||
    !Number.isSafeInteger(comment.createdAt)
  ) {
    return json({ error: "The comment contains invalid fields." }, 400);
  }

  const result = await db.prepare(`
    UPDATE posts
    SET comments = json_insert(comments, '$[#]', json(?))
    WHERE id = ?
  `).bind(
    JSON.stringify({ ...comment, body: comment.body.trim() }),
    context.params.id,
  ).run();
  if (!result.meta.changes) return json({ error: "Post not found." }, 404);

  const post = await getPost(db, context.params.id);
  return json(toPost(post));
};
