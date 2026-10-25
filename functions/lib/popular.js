const POPULAR_WINDOW_MS = 24 * 60 * 60 * 1000;

const storeFeaturedPost = async (db, postId, now) => {
  const expiresAt = now + POPULAR_WINDOW_MS;
  await db.prepare(`
    INSERT INTO featured_posts (id, post_id, featured_at, expires_at)
    VALUES (1, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      post_id = excluded.post_id,
      featured_at = excluded.featured_at,
      expires_at = excluded.expires_at
  `).bind(postId, now, expiresAt).run();
  return { postId, expiresAt };
};

export const getFeaturedPost = async (db, recalculate = false) => {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS featured_posts (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      post_id TEXT NOT NULL,
      featured_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `).run();

  const now = Date.now();
  const state = await db.prepare(
    "SELECT post_id, featured_at, expires_at FROM featured_posts WHERE id = 1",
  ).first();
  const leader = await db.prepare(`
    SELECT id FROM posts
    WHERE likes > 0
    ORDER BY likes DESC, created_at DESC, id ASC
    LIMIT 1
  `).first();

  if (!state) {
    return leader ? storeFeaturedPost(db, leader.id, now) : null;
  }

  const existingPost = await db.prepare(
    "SELECT id FROM posts WHERE id = ?",
  ).bind(state.post_id).first();
  if (!existingPost) {
    return leader ? storeFeaturedPost(db, leader.id, now) : null;
  }

  if (state.expires_at > now && (!recalculate || leader?.id === state.post_id)) {
    return { postId: state.post_id, expiresAt: state.expires_at };
  }

  if (recalculate && leader && leader.id !== state.post_id) {
    return storeFeaturedPost(db, leader.id, now);
  }

  const nextPost = await db.prepare(`
    SELECT id FROM posts
    WHERE likes > 0 AND id != ?
    ORDER BY likes DESC, created_at DESC, id ASC
    LIMIT 1
  `).bind(state.post_id).first();

  return nextPost ? storeFeaturedPost(db, nextPost.id, now) : null;
};
