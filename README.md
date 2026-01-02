# Roadtrip (statique) + Supabase

## Structure
- `public/index.html` : Hub (connexion + liste des trips)
- `public/trip.html` : Page d'un trip (récap + jours + fichiers)
- `public/config.js` : URL + anon key Supabase + bucket
- `supabase.sql` : SQL à coller dans Supabase (table + RLS)

## Lancer en local
Évite `file://` pour l'auth. Fais plutôt :
- VS Code Live Server, ou
- `python -m http.server` à la racine puis ouvre `http://localhost:8000/public/`

## Netlify
- Publish directory: `public`
- Build command: none
