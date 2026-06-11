const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const {
  ADMIN_EMAIL,
  ADMIN_NAME,
  ADMIN_PASSWORD,
  AUTH_ENABLED,
  DEFAULT_CLIENT_ID,
  JWT_EXPIRES_IN_SECONDS,
  JWT_SECRET,
} = require("../config/env");

const DATA_DIR = path.resolve(__dirname, "../../data");
const USERS_PATH = path.join(DATA_DIR, "users.json");

const DEFAULT_USERS_STATE = Object.freeze({
  version: 1,
  users: [],
});

function _ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function _clone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function _readJson(filePath, fallbackState) {
  if (!fs.existsSync(filePath)) {
    return _clone(fallbackState);
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : _clone(fallbackState);
  } catch {
    return _clone(fallbackState);
  }
}

function _writeJson(filePath, data) {
  _ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function _createUserId() {
  return `usr_${crypto.randomBytes(6).toString("hex")}`;
}

function _normalizeRole(role) {
  const value = String(role || "client").trim().toLowerCase();
  return value === "admin" ? "admin" : "client";
}

function _normalizeStatus(status) {
  const value = String(status || "active").trim().toLowerCase();
  return value === "disabled" ? "disabled" : "active";
}

function _normalizeUser(user) {
  return {
    id: String(user.id || "").trim(),
    email: String(user.email || "").trim().toLowerCase(),
    name: String(user.name || "").trim() || "Unnamed user",
    password_hash: String(user.password_hash || "").trim(),
    role: _normalizeRole(user.role),
    status: _normalizeStatus(user.status),
    created_at: user.created_at || new Date().toISOString(),
    updated_at: user.updated_at || user.created_at || new Date().toISOString(),
    last_login_at: user.last_login_at || null,
    client_id:
      user.client_id === undefined || user.client_id === null || String(user.client_id).trim() === ""
        ? null
        : String(user.client_id).trim(),
  };
}

function _readState() {
  const state = _readJson(USERS_PATH, DEFAULT_USERS_STATE);
  const users = Array.isArray(state.users) ? state.users.map(_normalizeUser) : [];
  const normalizedState = {
    version: Number(state.version || 1),
    users,
  };
  if (JSON.stringify(normalizedState) !== JSON.stringify(state)) {
    _writeState(normalizedState);
  }
  return normalizedState;
}

function _writeState(state) {
  _writeJson(USERS_PATH, state);
}

function _hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const secret = String(password || "");
  const derived = crypto.scryptSync(secret, salt, 64);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

function _verifyPassword(password, hashedPassword) {
  if (typeof hashedPassword !== "string" || !hashedPassword.startsWith("scrypt$")) {
    return false;
  }

  const [, salt, digest] = hashedPassword.split("$");
  if (!salt || !digest) {
    return false;
  }

  const candidate = crypto.scryptSync(String(password || ""), salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(digest, "hex"));
}

function _base64UrlEncode(input) {
  return Buffer.from(JSON.stringify(input)).toString("base64url");
}

function _base64UrlDecode(input) {
  return JSON.parse(Buffer.from(input, "base64url").toString("utf8"));
}

function _signToken(payload, secret = JWT_SECRET, expiresInSeconds = JWT_EXPIRES_IN_SECONDS) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    ...payload,
    iat: issuedAt,
    exp: issuedAt + Math.max(60, Number(expiresInSeconds) || JWT_EXPIRES_IN_SECONDS),
  };
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(tokenPayload)).toString("base64url");
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac("sha256", String(secret || JWT_SECRET))
    .update(signingInput)
    .digest("base64url");
  return `${signingInput}.${signature}`;
}

function _verifyToken(token, secret = JWT_SECRET) {
  const rawToken = String(token || "").trim();
  if (!rawToken) {
    const error = new Error("Token is required.");
    error.status = 401;
    throw error;
  }

  const [encodedHeader, encodedPayload, signature] = rawToken.split(".");
  if (!encodedHeader || !encodedPayload || !signature) {
    const error = new Error("Invalid token.");
    error.status = 401;
    throw error;
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto
    .createHmac("sha256", String(secret || JWT_SECRET))
    .update(signingInput)
    .digest("base64url");

  const provided = Buffer.from(signature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    const error = new Error("Invalid token signature.");
    error.status = 401;
    throw error;
  }

  const payload = _base64UrlDecode(encodedPayload);
  if (!payload || typeof payload !== "object") {
    const error = new Error("Invalid token payload.");
    error.status = 401;
    throw error;
  }

  if (Number(payload.exp || 0) * 1000 <= Date.now()) {
    const error = new Error("Token has expired.");
    error.status = 401;
    throw error;
  }

  return payload;
}

function _toPublicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    client_id: user.client_id,
    clientId: user.client_id,
    created_at: user.created_at,
    updated_at: user.updated_at,
    last_login_at: user.last_login_at,
  };
}

function getDefaultAuthContext() {
  return {
    id: "usr_legacy_owner",
    email: ADMIN_EMAIL,
    name: ADMIN_NAME,
    role: "admin",
    status: "active",
    client_id: DEFAULT_CLIENT_ID,
    clientId: DEFAULT_CLIENT_ID,
  };
}

function ensureDefaultUsers() {
  const state = _readState();
  const normalizedAdminEmail = String(ADMIN_EMAIL || "").trim().toLowerCase();
  const existingAdmin = state.users.find(
    (user) => user.role === "admin" && user.email === normalizedAdminEmail,
  );

  if (!existingAdmin) {
    const now = new Date().toISOString();
    state.users.push(
      _normalizeUser({
        id: _createUserId(),
        email: normalizedAdminEmail,
        name: ADMIN_NAME,
        password_hash: _hashPassword(ADMIN_PASSWORD),
        role: "admin",
        status: "active",
        created_at: now,
        updated_at: now,
        last_login_at: null,
        client_id: null,
      }),
    );
    _writeState(state);
  }

  return listUsers();
}

function normalizeLegacyClientScopes() {
  const state = _readState();
  let changedCount = 0;

  state.users = state.users.map((user) => {
    if (user.role !== "client") {
      return user;
    }

    if (user.client_id && String(user.client_id).trim()) {
      return user;
    }

    changedCount += 1;
    return _normalizeUser({
      ...user,
      client_id: `client_${String(user.id || crypto.randomBytes(4).toString("hex")).replace(/^usr_/, "")}`,
      updated_at: new Date().toISOString(),
    });
  });

  if (changedCount > 0) {
    _writeState(state);
  }

  return changedCount;
}

function listUsers() {
  return _readState().users.map(_toPublicUser);
}

function findUserByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;
  return listUsers().find((user) => user.email === normalized) || null;
}

function findUserRecordByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;
  return _readState().users.find((user) => user.email === normalized) || null;
}

function findUserById(id) {
  const target = String(id || "").trim();
  if (!target) return null;
  return listUsers().find((user) => user.id === target) || null;
}

function createUser({ email, name, password, role = "client", clientId = null }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedName = String(name || "").trim();
  const normalizedPassword = String(password || "");
  const normalizedRole = _normalizeRole(role);
  const normalizedClientId =
    clientId === undefined || clientId === null || String(clientId).trim() === ""
      ? normalizedRole === "client"
        ? `client_${crypto.randomBytes(4).toString("hex")}`
        : null
      : String(clientId).trim();

  if (!normalizedEmail || !normalizedName || !normalizedPassword) {
    const error = new Error("email, name, and password are required.");
    error.status = 400;
    throw error;
  }

  const state = _readState();
  if (state.users.some((user) => user.email === normalizedEmail)) {
    const error = new Error("A user with this email already exists.");
    error.status = 409;
    throw error;
  }

  const now = new Date().toISOString();
  const user = _normalizeUser({
    id: _createUserId(),
    email: normalizedEmail,
    name: normalizedName,
    password_hash: _hashPassword(normalizedPassword),
    role: normalizedRole,
    status: "active",
    created_at: now,
    updated_at: now,
    last_login_at: null,
    client_id: normalizedClientId,
  });

  state.users.push(user);
  _writeState(state);
  return _toPublicUser(user);
}

function authenticateUser(email, password) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const userRecord = findUserRecordByEmail(normalizedEmail);
  if (!userRecord || userRecord.status !== "active") {
    return null;
  }

  if (!_verifyPassword(password, userRecord.password_hash)) {
    return null;
  }

  const state = _readState();
  const now = new Date().toISOString();
  state.users = state.users.map((user) => {
    if (user.id !== userRecord.id) return user;
    return _normalizeUser({ ...user, last_login_at: now, updated_at: now });
  });
  _writeState(state);

  const refreshed = state.users.find((user) => user.id === userRecord.id) || userRecord;
  return _toPublicUser(refreshed);
}

function issueToken(user) {
  if (!user) {
    const error = new Error("User is required to issue a token.");
    error.status = 400;
    throw error;
  }

  return _signToken({
    sub: user.id,
    role: user.role,
    client_id: user.client_id ?? null,
    email: user.email,
    name: user.name,
  });
}

function verifyToken(token) {
  return _verifyToken(token);
}

function updateUserStatus(userId, status) {
  const targetId = String(userId || "").trim();
  if (!targetId) return null;

  const normalizedStatus = _normalizeStatus(status);
  const state = _readState();
  let updated = null;

  state.users = state.users.map((user) => {
    if (user.id !== targetId) return user;
    updated = _normalizeUser({
      ...user,
      status: normalizedStatus,
      updated_at: new Date().toISOString(),
    });
    return updated;
  });

  if (!updated) return null;
  _writeState(state);
  return _toPublicUser(updated);
}

function deleteUser(userId) {
  const targetId = String(userId || "").trim();
  if (!targetId) return null;

  const state = _readState();
  const existing = state.users.find((user) => user.id === targetId);
  if (!existing) return null;

  state.users = state.users.filter((user) => user.id !== targetId);
  _writeState(state);
  return _toPublicUser(existing);
}

module.exports = {
  USERS_PATH,
  ensureDefaultUsers,
  listUsers,
  findUserByEmail,
  findUserById,
  createUser,
  authenticateUser,
  issueToken,
  verifyToken,
  updateUserStatus,
  deleteUser,
  getDefaultAuthContext,
  normalizeLegacyClientScopes,
  toPublicUser: _toPublicUser,
};
