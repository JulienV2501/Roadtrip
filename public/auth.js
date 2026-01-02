/* =========================
   AUTH FERMÉ – 2 COMPTES
   =========================
   - Pas de création de compte
   - Seulement les emails listés ci-dessous
   - Mot de passe vérifié par hash SHA-256
*/

const AUTH_SESSION_KEY = "auth.session.v1";

/*
  🔒 REMPLIS ICI
  - emails autorisés
  - hash SHA-256 du mot de passe correspondant

  Exemple :
  "julien@mail.com": "e3b0c44298fc1c149afbf4c8996fb924..."
*/
const ALLOWED_USERS = {
  "toi@email.com": "HASH_SHA256_MDP_TOI",
  "copine@email.com": "HASH_SHA256_MDP_COPINE"
};

/* ===== utils ===== */
async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function isLogged() {
  return !!localStorage.getItem(AUTH_SESSION_KEY);
}

/* ===== auth ===== */
async function login(email, password) {
  const e = (email || "").trim().toLowerCase();

  if (!ALLOWED_USERS[e]) {
    throw new Error("Compte non autorisé");
  }

  const hash = await sha256(password);

  if (hash !== ALLOWED_USERS[e]) {
    throw new Error("Mot de passe incorrect");
  }

  localStorage.setItem(
    AUTH_SESSION_KEY,
    JSON.stringify({
      email: e,
      at: Date.now()
    })
  );
}

function logout() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

function requireAuth() {
  if (!isLogged()) {
    const returnTo = encodeURIComponent(
      location.pathname + location.search
    );
    location.href = `login.html?returnTo=${returnTo}`;
  }
}
