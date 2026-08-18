// Cloudflare Worker for the Lykos contact link.
// The email address lives only in the CONTACT_EMAIL deployment secret,
// so it never appears in the site's source or this repository.
//
// GET  /challenge -> { a, b, expiry, signature } (signature is a
//   hash-based message authentication code over "a.b.expiry")
// POST /reveal    -> { email } when the signature checks out, the
//   challenge has not expired, and the answer equals a + b

const allowedOrigins = ["https://lyk05.com", "https://www.lyk05.com"];
const challengeLifetimeMs = 5 * 60 * 1000;

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

async function signingKey(env, usage) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.CHALLENGE_SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage]
  );
}

function payloadBytes(a, b, expiry) {
  return new TextEncoder().encode(a + "." + b + "." + expiry);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = corsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (request.method === "GET" && url.pathname === "/challenge") {
      const randoms = new Uint8Array(2);
      crypto.getRandomValues(randoms);
      const a = 2 + (randoms[0] % 8);
      const b = 2 + (randoms[1] % 8);
      const expiry = Date.now() + challengeLifetimeMs;
      const key = await signingKey(env, "sign");
      const signatureBuffer = await crypto.subtle.sign(
        "HMAC",
        key,
        payloadBytes(a, b, expiry)
      );
      const signature = [...new Uint8Array(signatureBuffer)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      return json({ a, b, expiry, signature }, 200, headers);
    }

    if (request.method === "POST" && url.pathname === "/reveal") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "bad request" }, 400, headers);
      }
      const { a, b, expiry, signature, answer } = body || {};
      if (
        !Number.isInteger(a) ||
        !Number.isInteger(b) ||
        !Number.isInteger(expiry) ||
        typeof signature !== "string"
      ) {
        return json({ error: "bad request" }, 400, headers);
      }
      const signatureBytes = new Uint8Array(
        (signature.match(/.{2}/g) || []).map((pair) => parseInt(pair, 16))
      );
      const key = await signingKey(env, "verify");
      const valid = await crypto.subtle.verify(
        "HMAC",
        key,
        signatureBytes,
        payloadBytes(a, b, expiry)
      );
      if (!valid) return json({ error: "bad signature" }, 400, headers);
      if (Date.now() > expiry) return json({ error: "expired" }, 410, headers);
      if (parseInt(answer, 10) !== a + b) {
        return json({ error: "wrong" }, 403, headers);
      }
      return json({ email: env.CONTACT_EMAIL }, 200, headers);
    }

    return new Response("not found", { status: 404, headers });
  },
};
