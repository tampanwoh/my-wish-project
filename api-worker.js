// This API runs on Cloudflare Workers, separately from the GitHub Pages frontend.
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const MAX_LOGIN_ATTEMPTS = 10;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const encoder = new TextEncoder();

function corsHeaders(origin, env) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
  if (origin && origin === env.SITE_ORIGIN) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function jsonResponse(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, cors)
  });
}

async function readJson(request) {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > 16384) {
    const error = new Error("Request terlalu besar.");
    error.status = 413;
    throw error;
  }
  try {
    return await request.json();
  } catch (error) {
    if (error.status) throw error;
    const invalidJson = new Error("Format data tidak valid.");
    invalidJson.status = 400;
    throw invalidJson;
  }
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), function(byte) {
    return byte.toString(16).padStart(2, "0");
  }).join("");
}

function constantTimeEqual(left, right) {
  const a = encoder.encode(String(left || ""));
  const b = encoder.encode(String(right || ""));
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    mismatch |= (a[i] || 0) ^ (b[i] || 0);
  }
  return mismatch === 0;
}

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  bytes.forEach(function(byte) { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function requireAdmin(request, env) {
  const match = /^Bearer ([A-Za-z0-9_-]{40,})$/.exec(request.headers.get("Authorization") || "");
  if (!match) return null;
  const tokenHash = await sha256(match[1]);
  const now = Math.floor(Date.now() / 1000);
  const session = await env.DB.prepare(
    "SELECT token_hash FROM admin_sessions WHERE token_hash = ? AND expires_at > ?"
  ).bind(tokenHash, now).first();
  return session ? { tokenHash: tokenHash } : null;
}

function validOrder(body) {
  if (!body || typeof body !== "object") return null;
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const paymentMethod = typeof body.payment_method === "string" ? body.payment_method.trim() : "";

  if (name.length < 2 || name.length > 120) return null;
  if (!/^62[0-9]{8,13}$/.test(phone)) return null;
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
  if (!/^(qris|ewallet|bank[0-9]{1,2})$/.test(paymentMethod)) return null;
  return { name: name, phone: phone, email: email, paymentMethod: paymentMethod };
}

async function login(request, env) {
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
    return jsonResponse({ error: "Kredensial admin belum dikonfigurasi." }, 503, {});
  }
  const body = await readJson(request);
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ipHash = await sha256(ip);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare("DELETE FROM login_attempts WHERE attempted_at <= ?")
    .bind(now - LOGIN_WINDOW_SECONDS).run();
  const attempts = await env.DB.prepare(
    "SELECT COUNT(*) AS total FROM login_attempts WHERE ip_hash = ? AND attempted_at > ?"
  ).bind(ipHash, now - LOGIN_WINDOW_SECONDS).first();

  if (attempts && attempts.total >= MAX_LOGIN_ATTEMPTS) {
    return jsonResponse({ error: "Terlalu banyak percobaan. Coba lagi 15 menit." }, 429, {});
  }
  if (!constantTimeEqual(username, env.ADMIN_USERNAME) ||
      !constantTimeEqual(password, env.ADMIN_PASSWORD)) {
    await env.DB.prepare(
      "INSERT INTO login_attempts (ip_hash, attempted_at) VALUES (?, ?)"
    ).bind(ipHash, now).run();
    return jsonResponse({ error: "Username atau password salah." }, 401, {});
  }

  const token = newToken();
  const expiresAt = now + SESSION_TTL_SECONDS;
  await env.DB.prepare(
    "INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, ?)"
  ).bind(await sha256(token), expiresAt).run();
  await env.DB.prepare("DELETE FROM login_attempts WHERE attempted_at <= ?")
    .bind(now - LOGIN_WINDOW_SECONDS).run();
  return jsonResponse({ token: token, expires_at: expiresAt }, 200, {});
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin, env);
    if (origin && origin !== env.SITE_ORIGIN) {
      return jsonResponse({ error: "Origin tidak diizinkan." }, 403, {});
    }
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    try {
      if (request.method === "POST" && url.pathname === "/api/orders") {
        const order = validOrder(await readJson(request));
        if (!order) {
          return jsonResponse({ error: "Data order tidak valid." }, 400, cors);
        }
        const id = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        await env.DB.prepare(
          "INSERT INTO orders (id, name, phone, email, payment_method, amount, status, created_at) VALUES (?, ?, ?, ?, ?, 49999, 'pending', ?)"
        ).bind(id, order.name, order.phone, order.email, order.paymentMethod, createdAt).run();
        return jsonResponse({ id: id, status: "pending" }, 201, cors);
      }

      if (request.method === "POST" && url.pathname === "/api/admin/login") {
        return await login(request, env).then(function(response) {
          const headers = new Headers(response.headers);
          Object.keys(cors).forEach(function(key) { headers.set(key, cors[key]); });
          return new Response(response.body, { status: response.status, headers: headers });
        });
      }

      if (url.pathname.startsWith("/api/admin/")) {
        const session = await requireAdmin(request, env);
        if (!session) return jsonResponse({ error: "Sesi admin tidak valid atau sudah berakhir." }, 401, cors);

        if (request.method === "GET" && url.pathname === "/api/admin/orders") {
          const result = await env.DB.prepare(
            "SELECT id, name, phone, email, payment_method, amount, status, created_at FROM orders ORDER BY created_at DESC LIMIT 500"
          ).all();
          return jsonResponse({ orders: result.results || [] }, 200, cors);
        }

        if (request.method === "PATCH" && /^\/api\/admin\/orders\/[^/]+$/.test(url.pathname)) {
          const id = decodeURIComponent(url.pathname.slice("/api/admin/orders/".length));
          const body = await readJson(request);
          if (!["pending", "paid", "cancelled"].includes(body.status)) {
            return jsonResponse({ error: "Status order tidak valid." }, 400, cors);
          }
          const result = await env.DB.prepare(
            "UPDATE orders SET status = ? WHERE id = ?"
          ).bind(body.status, id).run();
          if (!result.meta || result.meta.changes === 0) {
            return jsonResponse({ error: "Order tidak ditemukan." }, 404, cors);
          }
          return jsonResponse({ id: id, status: body.status }, 200, cors);
        }

        if (request.method === "POST" && url.pathname === "/api/admin/logout") {
          await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash = ?")
            .bind(session.tokenHash).run();
          return jsonResponse({ ok: true }, 200, cors);
        }
        return jsonResponse({ error: "Endpoint admin tidak ditemukan." }, 404, cors);
      }

      return jsonResponse({ error: "Endpoint tidak ditemukan." }, 404, cors);
    } catch (error) {
      console.error("Request API gagal:", error);
      const status = error && error.status ? error.status : 500;
      const message = status < 500 ? error.message : "Terjadi kesalahan server.";
      return jsonResponse({ error: message }, status, cors);
    }
  }
};
