import { getDatabase, getPost, json, readJson, toPost } from "../../../../lib/posts.js";
import { getFeaturedPost } from "../../../lib/popular.js";

export const onRequestPost = async (context) => {
  const { db, error } = getDatabase(context);
  if (error) return error;

  const { value, error: bodyError } = await readJson(context.request);
  if (bodyError) return bodyError;
  if (value?.delta !== 1 && value?.delta !== -1) {
    return json({ error: "Like delta must be 1 or -1." }, 400);
  }

  const result = await db.prepare(`
    UPDATE posts SET likes = MAX(0, likes + ?) WHERE id = ?
  `).bind(value.delta, context.params.id).run();
  if (!result.meta.changes) return json({ error: "Post not found." }, 404);

  const post = await getPost(db, context.params.id);
  const featured = await getFeaturedPost(db, true);
  return json({
    ...toPost(post),
    popularUntil: post.id === featured?.postId ? featured.expiresAt : null,
  });
};
