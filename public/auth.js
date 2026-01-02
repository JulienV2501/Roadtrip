/* =========================
   AUTH SIMPLE – LOCAL ONLY
   ========================= */

const AUTH_USER_KEY = "auth.user.v1";
const AUTH_SESSION_KEY = "auth.session.v1";

/* --- utils --- */
async function hashPassword(pwd) {
  const enc = new TextEncoder().encode(pwd);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_USER_KEY));
  } catch {
    return null;
  }
}

function isLogged() {
  return !!localStorage.getItem(AUTH_SESSION_KEY);
}

/* --- auth actions --- */
async function signup(email, password) {
  if (getUser()) throw new Error("Un compte existe déjà");
  const hash = await hashPassword(password);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ email, hash }));
  await login(email, password);
}

async function login(email, password) {
  const user = getUser();
  if (!user) throw new Error("Aucun compte");
  const hash = await hashPassword(password);
  if (user.email !== email || user.hash !== hash)
    throw new Error("Identifiants invalides");
  localStorage.setItem(
    AUTH_SESSION_KEY,
    JSON.stringify({ email, at: Date.now() })
  );
}

function logout() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

function requireAuth() {
  if (!isLogged()) {
    // garde la page demandée pour revenir après login
    const returnTo = encodeURIComponent(location.pathname + location.search);
    location.href = `login.html?returnTo=${returnTo}`;
  }
}
