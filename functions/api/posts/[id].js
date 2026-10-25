import { getDatabase, getPost, json } from "../../../lib/posts.js";
import { authenticate } from "../../lib/auth.js";

export const onRequestDelete = async (context) => {
  const { db, error } = getDatabase(context);
  if (error) return error;
  const { user, error: authError } = await authenticate(context);
  if (authError) return authError;

  const post = await getPost(db, context.params.id);
  if (!post) return json({ error: "Post not found." }, 404);
  if (post.author_id !== user.id && !user.is_admin) {
    return json({ error: "Only the post owner can delete it." }, 403);
  }

  await db.prepare("DELETE FROM posts WHERE id = ?").bind(context.params.id).run();
  return json({ ok: true });
};
