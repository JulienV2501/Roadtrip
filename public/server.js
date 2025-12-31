// server.js
// Backend minimal pour créer automatiquement un fichier HTML pour chaque nouveau voyage.
// Usage : node server.js

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

// =====================
// CONFIG
// =====================

// Template générique à copier pour chaque voyage
const TEMPLATE_FILE = path.join(__dirname, "trip_template.html");

// Dossier racine (là où se trouvent les sous-dossiers AAAA)
const OUTPUT_ROOT = __dirname;

// =====================
// MIDDLEWARES
// =====================

app.use(express.json());

// CORS permissif pour appeler l'API depuis le hub
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// =====================
// UTILS
// =====================

function slugifyName(name) {
  return String(name || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "voyage";
}

// =====================
// API : CRÉER UN FICHIER HTML DE VOYAGE
// =====================
//
// POST /api/trips/create
// Body JSON : { year: 2027, name: "Nordic Roadtrip 2027", slug?: "nordic-roadtrip-2027" }
//
// Effets :
//   - crée ./2027/ si nécessaire
//   - copie trip_template.html en ./2027/<slug>.html
//   - ne réécrit pas si le fichier existe déjà
//
app.post("/api/trips/create", (req, res) => {
  try {
    let { year, name, slug } = req.body || {};
    year = parseInt(year, 10);

    if (!year || !Number.isFinite(year)) {
      return res.status(400).send("Champ 'year' invalide.");
    }
    if (!name) {
      return res.status(400).send("Champ 'name' obligatoire.");
    }

    if (!slug) {
      slug = slugifyName(name);
    }

    const yearDir = path.join(OUTPUT_ROOT, String(year));
    const filename = `${slug}.html`;
    const outputFile = path.join(yearDir, filename);
    const relPath = `${year}/${filename}`; // ce chemin sera utilisé par le hub

    if (!fs.existsSync(TEMPLATE_FILE)) {
      return res.status(500).send("Template trip_template.html introuvable côté serveur.");
    }

    fs.mkdirSync(yearDir, { recursive: true });

    if (fs.existsSync(outputFile)) {
      return res.status(200).json({
        status: "exists",
        message: "Le fichier existait déjà, aucune copie effectuée.",
        path: outputFile,
        relPath,
        year,
        slug
      });
    }

    fs.copyFileSync(TEMPLATE_FILE, outputFile);

    return res.status(201).json({
      status: "created",
      message: "Fichier de voyage créé avec succès.",
      path: outputFile,
      relPath,
      year,
      slug
    });

  } catch (err) {
    console.error("Erreur /api/trips/create :", err);
    return res.status(500).send("Erreur interne.");
  }
});

// =====================
// ROUTE RACINE → HUB
// =====================

app.get("/", (req, res) => {
  res.sendFile(path.join(OUTPUT_ROOT, "voyages_hub.html"));
});

// Fichiers statiques (hub, template, voyages 2026/xxxx.html, etc.)
app.use(express.static(OUTPUT_ROOT));

// =====================
// START
// =====================

app.listen(PORT, () => {
  console.log(`📡 Serveur backend démarré : http://localhost:${PORT}`);
  console.log(`📄 Template utilisé : ${TEMPLATE_FILE}`);
});
