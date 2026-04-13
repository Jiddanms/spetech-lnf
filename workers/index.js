
// workers/index.js
// Central router for all worker handlers.
// Imports each handler module (one per endpoint file) and dispatches requests
// to the correct handler. This file expects each handler module to export either:
//  - a default object with a `fetch(req, env)` method (as in the worker templates), or
//  - a default function that accepts ({ req, env }) and returns a Response.
// The router supports exact routes and simple parameter routes like /api/lost/:id.
//
// NOTE: After you copy this file to your repo, ensure all handler filenames
// match the imports below and that you added the D1 binding `DB` in Worker settings.

import accountRegister from "./account-register.js";
import accountLogin from "./account-login.js";
import accountLogout from "./account-logout.js";

import lostAdd from "./lost-add.js";
import lostList from "./lost-list.js";
import lostRecent from "./lost-recent.js";
import lostId from "./lost-id.js";

import foundAdd from "./found-add.js";
import foundList from "./found-list.js";
import foundRecent from "./found-recent.js";
import foundId from "./found-id.js";

import itemsId from "./items-id.js";

import adminForms from "./admin-forms.js";
import adminFormsStatus from "./admin-forms-status.js";
import adminFormsDelete from "./admin-forms-delete.js";

import adminAccounts from "./admin-accounts.js";
import adminAccountsAdd from "./admin-accounts-add.js";
import adminAccountsRole from "./admin-accounts-role.js";
import adminAccountsDelete from "./admin-accounts-delete.js";

import accountsPublic from "./accounts.js";
import health from "./health.js";

/**
 * Route table
 * - exactRoutes: direct string match (method + path)
 * - paramRoutes: array of { method, pattern, regex, handler } for :id style routes
 *
 * Keep paths consistent with frontend expectations:
 * e.g. POST /api/account/register, GET /api/lost/:id, PATCH /api/admin/forms/:id/status
 */
const exactRoutes = new Map([
  // Account
  ["POST /api/account/register", accountRegister],
  ["POST /api/account/login", accountLogin],
  ["POST /api/account/logout", accountLogout],

  // Lost
  ["POST /api/lost/add", lostAdd],
  ["GET /api/lost/list", lostList],
  ["GET /api/lost/recent", lostRecent],

  // Found
  ["POST /api/found/add", foundAdd],
  ["GET /api/found/list", foundList],
  ["GET /api/found/recent", foundRecent],

  // Items
  // items/:id handled by paramRoutes
  // Admin exact
  ["GET /api/admin/forms", adminForms],
  ["GET /api/admin/accounts", adminAccounts],
  ["POST /api/admin/accounts", adminAccountsAdd],

  // Public accounts & health
  ["GET /api/accounts", accountsPublic],
  ["GET /api/health", health]
]);

// Parameterized routes (supporting :id)
const paramRoutes = [
  // Lost / Found / Items detail
  { method: "GET", pattern: "/api/lost/:id", regex: /^\/api\/lost\/([^/]+)$/, handler: lostId },
  { method: "GET", pattern: "/api/found/:id", regex: /^\/api\/found\/([^/]+)$/, handler: foundId },
  { method: "GET", pattern: "/api/items/:id", regex: /^\/api\/items\/([^/]+)$/, handler: itemsId },

  // Admin forms status and delete
  { method: "PATCH", pattern: "/api/admin/forms/:id/status", regex: /^\/api\/admin\/forms\/([^/]+)\/status$/, handler: adminFormsStatus },
  { method: "DELETE", pattern: "/api/admin/forms/:id", regex: /^\/api\/admin\/forms\/([^/]+)$/, handler: adminFormsDelete },

  // Admin accounts role and delete
  { method: "PATCH", pattern: "/api/admin/accounts/:id/role", regex: /^\/api\/admin\/accounts\/([^/]+)\/role$/, handler: adminAccountsRole },
  { method: "DELETE", pattern: "/api/admin/accounts/:id", regex: /^\/api\/admin\/accounts\/([^/]+)$/, handler: adminAccountsDelete }
];

/**
 * Helper: call a handler module in a flexible way.
 * Accepts handler which may be:
 *  - module default object with fetch(req, env)
 *  - module default function that accepts ({ req, env })
 *  - module object with fetch property
 */
async function callHandler(handlerModule, req, env, params = {}) {
  // If module is a function (default export is function)
  if (typeof handlerModule === "function") {
    return handlerModule({ req, env, params });
  }

  // If module has default export (ES module transpiled)
  const mod = handlerModule && handlerModule.default ? handlerModule.default : handlerModule;

  if (!mod) {
    return new Response(JSON.stringify({ ok: false, message: "Handler not found" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  // If mod is a function
  if (typeof mod === "function") {
    return mod({ req, env, params });
  }

  // If mod has fetch method
  if (typeof mod.fetch === "function") {
    // Some handler templates expect (req, env) or ({ req, env })
    try {
      // Try calling as mod.fetch(req, env)
      const maybe = mod.fetch(req, env);
      // If returns a Promise/Response, return it
      if (maybe && typeof maybe.then === "function") return maybe;
      return maybe;
    } catch (e) {
      // fallback to calling as mod.fetch({ req, env })
      return mod.fetch({ req, env, params });
    }
  }

  return new Response(JSON.stringify({ ok: false, message: "Invalid handler shape" }), { status: 500, headers: { "Content-Type": "application/json" } });
}

/**
 * Normalize path: remove trailing slash (except root)
 */
function normalizePath(p) {
  if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
  return p;
}

export default {
  async fetch(req, env) {
    try {
      const url = new URL(req.url);
      const method = req.method.toUpperCase();
      const path = normalizePath(url.pathname);

      const exactKey = `${method} ${path}`;
      // 1) exact match
      if (exactRoutes.has(exactKey)) {
        const handler = exactRoutes.get(exactKey);
        return await callHandler(handler, req, env, {});
      }

      // 2) param routes match
      for (const r of paramRoutes) {
        if (r.method !== method) continue;
        const m = path.match(r.regex);
        if (m) {
          const paramValue = m[1];
          return await callHandler(r.handler, req, env, { id: paramValue });
        }
      }

      // 3) fallback: try some common patterns (e.g., POST /api/account/logout might be handled)
      // If not found, return 404 JSON
      return new Response(JSON.stringify({ ok: false, message: "Not Found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      console.error("Router error", err);
      return new Response(JSON.stringify({ ok: false, message: "Server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
