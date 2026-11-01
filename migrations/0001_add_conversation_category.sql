CREATE TABLE posts_new (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  nickname TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('daily', 'conversation', 'heart', 'question', 'hobby', 'career', 'free')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  image TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0 CHECK (likes >= 0),
  comments TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(comments))
);

INSERT INTO posts_new (id, author_id, nickname, category, title, body, image, created_at, likes, comments)
SELECT id, author_id, nickname, category, title, body, image, created_at, likes, comments
FROM posts;

DROP TABLE posts;
ALTER TABLE posts_new RENAME TO posts;
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts (created_at DESC);