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

    if (/no such table:\s*(users|sessions|posts)/i.test(String(error?.message))) {
      return jsonError("D1 tables are missing. Apply the current schema.sql to the bound DB database.", 503);
    }

    return jsonError("The Pages Function failed. Check the Cloudflare Pages Function logs.", 500);
  }
};
