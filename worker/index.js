// Cloudflare Worker for the Lykos contact link.
// The email address lives only in the CONTACT_EMAIL deployment secret,
// so it never appears in the site's source or this repository.
//
// GET  /config -> { sitekey } the public Turnstile site key
// POST /reveal -> { email } once Cloudflare Turnstile confirms the
//   visitor is human

const allowedOrigins = ["https://lyk05.com", "https://www.lyk05.com"];
const verifyUrl =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
  if (allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = corsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (request.method === "GET" && url.pathname === "/config") {
      return json({ sitekey: env.TURNSTILE_SITE_KEY }, 200, headers);
    }

    if (request.method === "POST" && url.pathname === "/reveal") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "bad request" }, 400, headers);
      }
      const token = body && body.token;
      if (typeof token !== "string" || !token) {
        return json({ error: "bad request" }, 400, headers);
      }

      const form = new FormData();
      form.append("secret", env.TURNSTILE_SECRET_KEY);
      form.append("response", token);
      const ip = request.headers.get("CF-Connecting-IP");
      if (ip) form.append("remoteip", ip);

      const verification = await fetch(verifyUrl, {
        method: "POST",
        body: form,
      }).then((res) => res.json());

      if (!verification.success) {
        return json({ error: "not verified" }, 403, headers);
      }

      return json({ email: env.CONTACT_EMAIL }, 200, headers);
    }

    return new Response("not found", { status: 404, headers });
  },
};
