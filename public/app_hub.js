(function () {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.CONFIG || {};
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    alert("config.js: SUPABASE_URL / SUPABASE_ANON_KEY manquants");
    return;
  }
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const els = {
    authState: document.getElementById("authState"),
    btnLogout: document.getElementById("btnLogout"),
    email: document.getElementById("email"),
    password: document.getElementById("password"),
    btnLogin: document.getElementById("btnLogin"),
    btnSignup: document.getElementById("btnSignup"),
    authMsg: document.getElementById("authMsg"),
    tripsList: document.getElementById("tripsList"),
    btnRefresh: document.getElementById("btnRefresh"),
    newTripName: document.getElementById("newTripName"),
    btnCreateTrip: document.getElementById("btnCreateTrip"),
  };

  function showMsg(text, ok = true) {
    els.authMsg.style.display = "block";
    els.authMsg.className = "msg " + (ok ? "ok" : "err");
    els.authMsg.textContent = text;
  }
  function clearMsg() {
    els.authMsg.style.display = "none";
    els.authMsg.textContent = "";
  }
  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[m]));
  }
  function formatDate(iso) {
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  }

  async function refreshAuthUI() {
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) {
      els.authState.textContent = `Connecté : ${session.user.email}`;
      els.btnLogout.style.display = "inline-block";
    } else {
      els.authState.textContent = "Non connecté";
      els.btnLogout.style.display = "none";
    }
  }

  function renderTrips(trips) {
    els.tripsList.innerHTML = "";
    if (!trips || trips.length === 0) {
      const div = document.createElement("div");
      div.className = "muted small";
      div.textContent = "Aucun trip pour le moment.";
      els.tripsList.appendChild(div);
      return;
    }

    for (const t of trips) {
      const item = document.createElement("div");
      item.className = "item";

      const meta = document.createElement("div");
      meta.className = "meta";
      meta.innerHTML = `<strong>${escapeHtml(t.name)}</strong>
        <span class="muted small">Mis à jour: ${formatDate(t.updated_at)}</span>`;

      const actions = document.createElement("div");
      actions.className = "row";

      const btnOpen = document.createElement("button");
      btnOpen.className = "btn btn--secondary";
      btnOpen.textContent = "Ouvrir";
      btnOpen.onclick = () => location.href = `trip.html?trip=${encodeURIComponent(t.id)}`;

      const btnDel = document.createElement("button");
      btnDel.className = "btn btn--danger";
      btnDel.textContent = "Supprimer";
      btnDel.onclick = async () => {
        if (!confirm(`Supprimer "${t.name}" ?`)) return;
        const { error } = await sb.from("trips").delete().eq("id", t.id);
        if (error) return showMsg(error.message, false);
        await loadTrips();
      };

      actions.appendChild(btnOpen);
      actions.appendChild(btnDel);

      item.appendChild(meta);
      item.appendChild(actions);
      els.tripsList.appendChild(item);
    }
  }

  async function loadTrips() {
    clearMsg();
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) {
      renderTrips([]);
      return;
    }
    const { data, error } = await sb
      .from("trips")
      .select("id,name,updated_at")
      .order("updated_at", { ascending: false });

    if (error) return showMsg(error.message, false);
    renderTrips(data);
  }

  async function createTrip() {
    clearMsg();
    const name = (els.newTripName.value || "").trim() || "Nouveau trip";
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) return showMsg("Connecte-toi d'abord.", false);

    const initial = {
      version: 1,
      createdAt: new Date().toISOString(),
      days: [
        {
          title: "Jour 1",
          date: "",
          stops: ["Départ", "Arrivée"],
          hours: 0,
          km: 0,
          road_cost: 0,
          costs: { activities: 0, lodging: 0, food: 0, other: 0 },
          lodging: { name: "", link: "", checkin: "", checkout: "", notes: "" },
        }
      ]
    };

    const { data, error } = await sb
      .from("trips")
      .insert([{ owner: session.user.id, name, data: initial }])
      .select("id")
      .single();

    if (error) return showMsg(error.message, false);
    location.href = `trip.html?trip=${encodeURIComponent(data.id)}`;
  }

  async function login() {
    clearMsg();
    const email = els.email.value.trim();
    const password = els.password.value;
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return showMsg(error.message, false);
    showMsg("Connecté ✅", true);
    await refreshAuthUI();
    await loadTrips();
  }

  async function signup() {
    clearMsg();
    const email = els.email.value.trim();
    const password = els.password.value;
    const { error } = await sb.auth.signUp({ email, password });
    if (error) return showMsg(error.message, false);
    showMsg("Compte créé ✅ (si email confirmation activée, vérifie ta boîte).", true);
  }

  async function logout() {
    await sb.auth.signOut();
    await refreshAuthUI();
    await loadTrips();
  }

  els.btnLogin.addEventListener("click", login);
  els.btnSignup.addEventListener("click", signup);
  els.btnLogout.addEventListener("click", logout);
  els.btnRefresh.addEventListener("click", loadTrips);
  els.btnCreateTrip.addEventListener("click", createTrip);

  sb.auth.onAuthStateChange(async () => {
    await refreshAuthUI();
    await loadTrips();
  });

  (async () => {
    await refreshAuthUI();
    await loadTrips();
  })();
})();