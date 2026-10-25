const CATEGORIES = new Set(["daily", "heart", "question", "hobby", "career", "free"]);
const MAX_IMAGE_LENGTH = 1_200_000;

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export const getDatabase = (context) => {
  if (!context.env.DB) {
    return { error: json({ error: "D1 binding 'DB' is not configured." }, 503) };
  }
  return { db: context.env.DB };
};

export const readJson = async (request) => {
  try {
    return { value: await request.json() };
  } catch {
    return { error: json({ error: "A valid JSON body is required." }, 400) };
  }
};

export const toPost = (row) => ({
  id: row.id,
  authorId: row.author_id,
  nickname: row.nickname,
  category: row.category,
  title: row.title,
  body: row.body,
  image: row.image,
  videoId: "",
  createdAt: row.created_at,
  likes: row.likes,
  comments: JSON.parse(row.comments),
  liked: false,
});

export const validatePost = (post) => {
  if (
    !post ||
    typeof post.id !== "string" || !post.id || post.id.length > 100 ||
    typeof post.authorId !== "string" || !post.authorId || post.authorId.length > 100 ||
    typeof post.nickname !== "string" || post.nickname.length > 20 ||
    !CATEGORIES.has(post.category) ||
    typeof post.title !== "string" || !post.title.trim() || post.title.length > 80 ||
    typeof post.body !== "string" || !post.body.trim() || post.body.length > 2000 ||
    typeof post.image !== "string" ||
    post.image.length > MAX_IMAGE_LENGTH ||
    (post.image !== "" && !post.image.startsWith("data:image/jpeg;base64,")) ||
    !Number.isSafeInteger(post.createdAt) ||
    !Array.isArray(post.comments) || post.comments.length > 500
  ) {
    return false;
  }

  return post.comments.every((comment) =>
    comment &&
    typeof comment.id === "string" &&
    comment.id.length > 0 &&
    comment.id.length <= 100 &&
    typeof comment.body === "string" &&
    comment.body.trim().length > 0 &&
    comment.body.length <= 500 &&
    Number.isSafeInteger(comment.createdAt),
  );
};

export const getPost = async (db, id) =>
  db.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
