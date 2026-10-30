const jsonError = (message, status) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export const onRequest = async (context) => {
  try {
    return await context.next();
  } catch (error) {
    console.error("Cloudflare Pages Function failed.", error);

    const message = String(error?.message);
    if (/no such table:\s*(users|sessions|posts|featured_posts|advertising_rate_limits)/i.test(message)) {
      return jsonError("D1 tables are missing. Apply the current schema.sql to the bound DB database.", 503);
    }
    if (/no such column|has no column named/i.test(message)) {
      return jsonError("D1 schema is missing required columns. Migrate the existing tables to match schema.sql.", 503);
    }

    return jsonError("The Pages Function failed. Check the Cloudflare Pages Function logs.", 500);
  }
};
