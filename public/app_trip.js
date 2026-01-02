(function () {
  const CFG = window.CONFIG || {};
  const { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_BUCKET } = CFG;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    alert("config.js: SUPABASE_URL / SUPABASE_ANON_KEY manquants");
    return;
  }
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const q = new URLSearchParams(location.search);
  const tripId = q.get("trip");
  if (!tripId) {
    alert("URL invalide: manque ?trip=...");
    location.href = "index.html";
    return;
  }

  const el = {
    tripTitle: document.getElementById("tripTitle"),
    tripMeta: document.getElementById("tripMeta"),
    authState: document.getElementById("authState"),
    btnLogout: document.getElementById("btnLogout"),
    btnSave: document.getElementById("btnSave"),
    saveState: document.getElementById("saveState"),
    daysNav: document.getElementById("daysNav"),
    btnAddDay: document.getElementById("btnAddDay"),
    viewSummary: document.getElementById("viewSummary"),
    viewDay: document.getElementById("viewDay"),
    sumKm: document.getElementById("sumKm"),
    sumHours: document.getElementById("sumHours"),
    sumCost: document.getElementById("sumCost"),
    perDayList: document.getElementById("perDayList"),
    dayTitle: document.getElementById("dayTitle"),
    daySubtitle: document.getElementById("daySubtitle"),
    btnDeleteDay: document.getElementById("btnDeleteDay"),
    stopsInput: document.getElementById("stopsInput"),
    hoursInput: document.getElementById("hoursInput"),
    kmInput: document.getElementById("kmInput"),
    roadCostInput: document.getElementById("roadCostInput"),
    costActivities: document.getElementById("costActivities"),
    costLodging: document.getElementById("costLodging"),
    costFood: document.getElementById("costFood"),
    costOther: document.getElementById("costOther"),
    lodgingName: document.getElementById("lodgingName"),
    lodgingLink: document.getElementById("lodgingLink"),
    lodgingCheckin: document.getElementById("lodgingCheckin"),
    lodgingCheckout: document.getElementById("lodgingCheckout"),
    lodgingNotes: document.getElementById("lodgingNotes"),
    fileInput: document.getElementById("fileInput"),
    btnUploadFiles: document.getElementById("btnUploadFiles"),
    filesList: document.getElementById("filesList"),
  };

  let state = null;
  let activeView = "summary";
  let activeDayIndex = 0;

  let mapSummary, mapDay, layerSummary, layerDay;

  function fmt(n) { const x = Number(n || 0); return (Math.round(x * 10) / 10).toString(); }
  function money(n) { const x = Number(n || 0); return x.toFixed(0); }

  async function refreshAuthUI() {
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) {
      el.authState.textContent = `Connecté : ${session.user.email}`;
      el.btnLogout.style.display = "inline-block";
    } else {
      el.authState.textContent = "Non connecté";
      el.btnLogout.style.display = "none";
    }
  }

  async function requireAuth() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user) {
      alert("Connecte-toi depuis le hub d'abord.");
      location.href = "index.html";
      return null;
    }
    return session.user;
  }

  async function loadTrip() {
    const user = await requireAuth();
    if (!user) return;

    const { data, error } = await sb
      .from("trips")
      .select("id,name,data,updated_at,created_at")
      .eq("id", tripId)
      .single();

    if (error) {
      alert(error.message);
      location.href = "index.html";
      return;
    }

    state = data;
    el.tripTitle.textContent = data.name;
    el.tripMeta.textContent = `Trip ID: ${data.id} • Maj: ${new Date(data.updated_at).toLocaleString()}`;
    normalizeState();
    renderNav();
    renderSummary();
    switchTo("summary");
  }

  async function saveTrip() {
    if (!state) return;
    el.saveState.textContent = "Sauvegarde...";
    el.btnSave.disabled = true;

    const { error } = await sb.from("trips").update({ data: state.data }).eq("id", state.id);

    el.btnSave.disabled = false;
    if (error) {
      el.saveState.textContent = "Erreur: " + error.message;
      return;
    }
    el.saveState.textContent = "Sauvegardé ✅ " + new Date().toLocaleTimeString();
    renderSummary();
    renderNav();
  }

  function normalizeState() {
    if (!state.data || typeof state.data !== "object") state.data = {};
    if (!Array.isArray(state.data.days)) state.data.days = [];
    if (state.data.days.length === 0) state.data.days.push(newEmptyDay(1));

    state.data.days = state.data.days.map((d, i) => ({
      title: d.title ?? `Jour ${i + 1}`,
      date: d.date ?? "",
      stops: Array.isArray(d.stops) ? d.stops : ["Départ", "Arrivée"],
      hours: Number(d.hours ?? 0),
      km: Number(d.km ?? 0),
      road_cost: Number(d.road_cost ?? 0),
      costs: {
        activities: Number(d.costs?.activities ?? 0),
        lodging: Number(d.costs?.lodging ?? 0),
        food: Number(d.costs?.food ?? 0),
        other: Number(d.costs?.other ?? 0),
      },
      lodging: {
        name: d.lodging?.name ?? "",
        link: d.lodging?.link ?? "",
        checkin: d.lodging?.checkin ?? "",
        checkout: d.lodging?.checkout ?? "",
        notes: d.lodging?.notes ?? "",
      },
    }));
  }

  function newEmptyDay(n) {
    return {
      title: `Jour ${n}`,
      date: "",
      stops: ["Départ", "Arrivée"],
      hours: 0,
      km: 0,
      road_cost: 0,
      costs: { activities: 0, lodging: 0, food: 0, other: 0 },
      lodging: { name: "", link: "", checkin: "", checkout: "", notes: "" },
    };
  }

  function renderNav() {
    el.daysNav.innerHTML = "";
    state.data.days.forEach((d, idx) => {
      const btn = document.createElement("button");
      btn.className = "navitem";
      btn.textContent = `🗓️ ${d.title || ("Jour " + (idx + 1))}`;
      btn.dataset.view = "day";
      btn.dataset.day = String(idx);
      btn.onclick = () => switchToDay(idx);
      el.daysNav.appendChild(btn);
    });

    document.querySelectorAll(".navitem").forEach(b => b.classList.remove("navitem--active"));
    const summaryBtn = document.querySelector('[data-view="summary"]');
    if (activeView === "summary") summaryBtn?.classList.add("navitem--active");
    if (activeView === "day") el.daysNav.querySelector(`[data-day="${activeDayIndex}"]`)?.classList.add("navitem--active");
  }

  function switchTo(view) {
    activeView = view;
    el.viewSummary.style.display = view === "summary" ? "block" : "none";
    el.viewDay.style.display = view === "day" ? "block" : "none";
    renderNav();
    setTimeout(() => (view === "summary" ? mapSummary : mapDay)?.invalidateSize(), 50);
  }

  function switchToDay(idx) {
    activeDayIndex = idx;
    renderDay();
    switchTo("day");
    listFilesForDay();
  }

  function dayTotalCost(d) {
    const c = d.costs || {};
    return Number(d.road_cost || 0) + Number(c.activities || 0) + Number(c.lodging || 0) + Number(c.food || 0) + Number(c.other || 0);
  }

  function renderSummary() {
    const days = state.data.days;
    el.sumKm.textContent = fmt(days.reduce((a, d) => a + Number(d.km || 0), 0));
    el.sumHours.textContent = fmt(days.reduce((a, d) => a + Number(d.hours || 0), 0));
    el.sumCost.textContent = money(days.reduce((a, d) => a + dayTotalCost(d), 0));

    el.perDayList.innerHTML = "";
    days.forEach((d, idx) => {
      const item = document.createElement("div");
      item.className = "item";
      const title = document.createElement("div");
      title.className = "meta";
      title.innerHTML = `<strong>${escapeHtml(d.title || ("Jour " + (idx + 1)))}</strong>
        <span class="muted small">km: ${fmt(d.km)} • h: ${fmt(d.hours)} • coût: ${money(dayTotalCost(d))}</span>`;
      const act = document.createElement("div");
      const btn = document.createElement("button");
      btn.className = "btn btn--secondary";
      btn.textContent = "Ouvrir";
      btn.onclick = () => switchToDay(idx);
      act.appendChild(btn);
      item.appendChild(title);
      item.appendChild(act);
      el.perDayList.appendChild(item);
    });

    ensureMaps();
    drawSummaryMap();
  }

  function renderDay() {
    const d = state.data.days[activeDayIndex];
    el.dayTitle.textContent = d.title || `Jour ${activeDayIndex + 1}`;
    el.daySubtitle.textContent = d.date ? `Date: ${d.date}` : "";

    el.stopsInput.value = (d.stops || []).join("\n");
    el.hoursInput.value = String(d.hours ?? 0);
    el.kmInput.value = String(d.km ?? 0);
    el.roadCostInput.value = String(d.road_cost ?? 0);

    el.costActivities.value = String(d.costs?.activities ?? 0);
    el.costLodging.value = String(d.costs?.lodging ?? 0);
    el.costFood.value = String(d.costs?.food ?? 0);
    el.costOther.value = String(d.costs?.other ?? 0);

    el.lodgingName.value = d.lodging?.name ?? "";
    el.lodgingLink.value = d.lodging?.link ?? "";
    el.lodgingCheckin.value = d.lodging?.checkin ?? "";
    el.lodgingCheckout.value = d.lodging?.checkout ?? "";
    el.lodgingNotes.value = d.lodging?.notes ?? "";

    ensureMaps();
    drawDayMap();
  }

  function bindDayInputs() {
    const sync = () => {
      const d = state.data.days[activeDayIndex];
      d.stops = el.stopsInput.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      d.hours = Number(el.hoursInput.value || 0);
      d.km = Number(el.kmInput.value || 0);
      d.road_cost = Number(el.roadCostInput.value || 0);

      d.costs.activities = Number(el.costActivities.value || 0);
      d.costs.lodging = Number(el.costLodging.value || 0);
      d.costs.food = Number(el.costFood.value || 0);
      d.costs.other = Number(el.costOther.value || 0);

      d.lodging.name = el.lodgingName.value || "";
      d.lodging.link = el.lodgingLink.value || "";
      d.lodging.checkin = el.lodgingCheckin.value || "";
      d.lodging.checkout = el.lodgingCheckout.value || "";
      d.lodging.notes = el.lodgingNotes.value || "";

      if (activeView === "day") drawDayMap();
      renderSummary();
    };

    ["input", "change"].forEach(evt => {
      [
        el.stopsInput, el.hoursInput, el.kmInput, el.roadCostInput,
        el.costActivities, el.costLodging, el.costFood, el.costOther,
        el.lodgingName, el.lodgingLink, el.lodgingCheckin, el.lodgingCheckout, el.lodgingNotes
      ].forEach(node => node.addEventListener(evt, sync));
    });
  }

  function ensureMaps() {
    if (!mapSummary) {
      mapSummary = L.map("mapSummary").setView([59.3, 18.0], 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: "© OpenStreetMap"
      }).addTo(mapSummary);
      layerSummary = L.layerGroup().addTo(mapSummary);
    }
    if (!mapDay) {
      mapDay = L.map("mapDay").setView([59.3, 18.0], 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: "© OpenStreetMap"
      }).addTo(mapDay);
      layerDay = L.layerGroup().addTo(mapDay);
    }
  }

  function fakeCoordsForStops(stops, seed) {
    const baseLat = 57.5 + (seed % 7) * 0.6;
    const baseLng = 10.0 + (seed % 9) * 0.8;
    return stops.map((s, i) => {
      const lat = baseLat + i * 0.35 + ((hash(s) % 100) / 1000);
      const lng = baseLng + i * 0.45 + ((hash(s + "x") % 100) / 1000);
      return [lat, lng];
    });
  }

  function drawSummaryMap() {
    layerSummary.clearLayers();
    const all = [];
    state.data.days.forEach((d, idx) => {
      const stops = (d.stops || []).slice(0, 10);
      if (stops.length < 2) return;
      const coords = fakeCoordsForStops(stops, idx + 1);
      all.push(...coords.map(c => L.latLng(c[0], c[1])));
      L.polyline(coords, { weight: 4, opacity: 0.7 }).addTo(layerSummary);
      coords.forEach((c, i) => {
        L.circleMarker(c, { radius: 5, opacity: 0.9, fillOpacity: 0.9 })
          .bindPopup(`<strong>${escapeHtml(d.title || ("Jour " + (idx + 1)))}</strong><br/>${escapeHtml(stops[i] || "")}`)
          .addTo(layerSummary);
      });
    });
    if (all.length) mapSummary.fitBounds(L.latLngBounds(all), { padding: [20, 20] });
  }

  function drawDayMap() {
    layerDay.clearLayers();
    const d = state.data.days[activeDayIndex];
    const stops = (d.stops || []).slice(0, 10);
    if (stops.length < 2) return;
    const coords = fakeCoordsForStops(stops, activeDayIndex + 1);
    const latlngs = coords.map(c => L.latLng(c[0], c[1]));
    L.polyline(coords, { weight: 5, opacity: 0.85 }).addTo(layerDay);
    coords.forEach((c, i) => L.marker(c).bindPopup(`<strong>${escapeHtml(stops[i] || "")}</strong>`).addTo(layerDay));
    mapDay.fitBounds(L.latLngBounds(latlngs), { padding: [20, 20] });
  }

  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[m]));
  }

  function dayFolderPrefix(userId) {
    return `${userId}/${tripId}/day-${activeDayIndex + 1}/`;
  }

  async function listFilesForDay() {
    el.filesList.innerHTML = "";
    const user = await requireAuth();
    if (!user) return;

    const prefix = dayFolderPrefix(user.id);
    const bucket = STORAGE_BUCKET || "trip-files";

    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 100, offset: 0 });
    if (error) {
      el.filesList.innerHTML = `<div class="muted small">Erreur list: ${escapeHtml(error.message)}</div>`;
      return;
    }
    if (!data || data.length === 0) {
      el.filesList.innerHTML = `<div class="muted small">Aucun fichier.</div>`;
      return;
    }

    for (const f of data) {
      const item = document.createElement("div");
      item.className = "item";

      const meta = document.createElement("div");
      meta.className = "meta";
      meta.innerHTML = `<strong>${escapeHtml(f.name)}</strong><span class="muted small">${(f.metadata?.size ?? 0)} bytes</span>`;

      const actions = document.createElement("div");
      actions.className = "row";

      const btnOpen = document.createElement("button");
      btnOpen.className = "btn btn--secondary";
      btnOpen.textContent = "Ouvrir";
      btnOpen.onclick = async () => {
        const path = prefix + f.name;
        const { data: signed, error: e2 } = await sb.storage.from(bucket).createSignedUrl(path, 60 * 10);
        if (e2) return alert(e2.message);
        window.open(signed.signedUrl, "_blank");
      };

      const btnDel = document.createElement("button");
      btnDel.className = "btn btn--danger";
      btnDel.textContent = "Supprimer";
      btnDel.onclick = async () => {
        if (!confirm(`Supprimer ${f.name} ?`)) return;
        const path = prefix + f.name;
        const { error: e3 } = await sb.storage.from(bucket).remove([path]);
        if (e3) return alert(e3.message);
        await listFilesForDay();
      };

      actions.appendChild(btnOpen);
      actions.appendChild(btnDel);
      item.appendChild(meta);
      item.appendChild(actions);
      el.filesList.appendChild(item);
    }
  }

  async function uploadFiles() {
    const user = await requireAuth();
    if (!user) return;

    const files = el.fileInput.files;
    if (!files || files.length === 0) return alert("Choisis au moins un fichier.");
    const prefix = dayFolderPrefix(user.id);
    const bucket = STORAGE_BUCKET || "trip-files";

    for (const f of files) {
      const path = prefix + f.name;
      const { error } = await sb.storage.from(bucket).upload(path, f, { upsert: true });
      if (error) return alert(error.message);
    }
    el.fileInput.value = "";
    await listFilesForDay();
    alert("Upload terminé ✅");
  }

  async function addDay() {
    state.data.days.push(newEmptyDay(state.data.days.length + 1));
    activeDayIndex = state.data.days.length - 1;
    renderNav();
    renderDay();
    switchTo("day");
  }

  async function deleteDay() {
    if (state.data.days.length <= 1) return alert("Il faut au moins 1 jour.");
    if (!confirm("Supprimer ce jour ?")) return;
    state.data.days.splice(activeDayIndex, 1);
    activeDayIndex = Math.max(0, activeDayIndex - 1);
    normalizeState();
    renderNav();
    renderSummary();
    renderDay();
  }

  async function logout() {
    await sb.auth.signOut();
    location.href = "index.html";
  }

  document.querySelector('[data-view="summary"]').addEventListener("click", () => {
    renderSummary();
    switchTo("summary");
  });

  el.btnSave.addEventListener("click", saveTrip);
  el.btnAddDay.addEventListener("click", addDay);
  el.btnDeleteDay.addEventListener("click", deleteDay);
  el.btnLogout.addEventListener("click", logout);
  el.btnUploadFiles.addEventListener("click", uploadFiles);

  sb.auth.onAuthStateChange(async () => {
    await refreshAuthUI();
  });

  (async () => {
    await refreshAuthUI();
    bindDayInputs();
    await loadTrip();
  })();
})();