const FALLBACK_TOOL_IMAGE = "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=85";
const DEFAULT_TOOLS = [
  {
    id: "example-perceuse",
    name: "Perceuse-visseuse",
    category: "Électricité",
    coop: "Coop de l'Alternative",
    description: "Parfaite pour monter des étagères, fixer des planches et bricoler sans devoir tout acheter.",
    image: "https://images.unsplash.com/photo-1581147036324-c17ac6bb9b3f?auto=format&fit=crop&w=900&q=80",
    requiresTraining: false,
    trainingName: ""
  },
  {
    id: "example-tailleuse",
    name: "Tailleuse de pelouse",
    category: "Jardin",
    coop: "Maraîchage partagé",
    description: "Idéale pour entretenir les espaces verts en commun sans acheter un équipement coûteux.",
    image: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=900&q=80",
    requiresTraining: true,
    trainingName: "Utilisation et sécurité"
  }
];

const storage = {
  read(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      showToast("Impossible d’enregistrer sur cet appareil.");
    }
  }
};

const storedTools = storage.read("la-remise-tools", null);
let tools = Array.isArray(storedTools) && storedTools.length ? storedTools : DEFAULT_TOOLS.slice();
if (!Array.isArray(storedTools) || storedTools.length === 0) storage.write("la-remise-tools", tools);
const storedReservations = storage.read("la-remise-reservations", []);
let reservations = storedReservations.filter((reservation) => !DEMO_TOOL_IDS.has(reservation.toolId));
let requests = storage.read("la-remise-requests", []);
let trainingProposals = storage.read("la-remise-training-proposals", []);
if (tools.length !== storedTools.length) storage.write("la-remise-tools", tools);
if (reservations.length !== storedReservations.length) storage.write("la-remise-reservations", reservations);
let selectedCategory = "Tous";
let searchTerm = "";
let toastTimer;
let nextView = null;

const grid = document.querySelector("#tool-grid");
const emptyState = document.querySelector("#empty-state");
const reserveDialog = document.querySelector("#reserve-dialog");
const addDialog = document.querySelector("#add-dialog");
const requestDialog = document.querySelector("#request-dialog");
const trainingDialog = document.querySelector("#training-dialog");
const memberGateDialog = document.querySelector("#member-gate-dialog");

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`));
}

function localDateString(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function datesOverlap(start, end, otherStart, otherEnd) {
  return start <= otherEnd && end >= otherStart;
}

function activeReservations(toolId) {
  const today = localDateString();
  return reservations.filter((reservation) => reservation.toolId === toolId && reservation.end >= today);
}

function renderTools() {
  const query = searchTerm.trim().toLocaleLowerCase("fr");
  const visibleTools = tools.filter((tool) => {
    const matchesCategory = selectedCategory === "Tous" || tool.category === selectedCategory;
    const matchesQuery = !query || `${tool.name} ${tool.coop} ${tool.category} ${tool.description}`.toLocaleLowerCase("fr").includes(query);
    return matchesCategory && matchesQuery;
  });
  grid.innerHTML = visibleTools.map((tool, index) => {
    const isBusy = activeReservations(tool.id).length > 0;
    const image = tool.image || FALLBACK_TOOL_IMAGE;
    return `<article class="tool-card" style="animation-delay:${index * 45}ms">
      <div class="tool-photo">
        <img src="${escapeHTML(image)}" alt="${escapeHTML(tool.name)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=85'" />
        <span class="category-label">${escapeHTML(tool.category)}</span>
        <span class="availability${isBusy ? " is-busy" : ""}">${isBusy ? "DATES PRISES" : "DISPONIBLE"}</span>
      </div>
      <div class="tool-info">
        <div class="tool-title-row"><h3>${escapeHTML(tool.name)}</h3><span class="tool-number">N° ${String(index + 1).padStart(2, "0")}</span></div>
        ${tool.requiresTraining ? `<p class="tool-training">FORMATION REQUISE · ${escapeHTML(tool.trainingName)}</p>` : ""}
        <p class="tool-description">${escapeHTML(tool.description)}</p>
        <div class="tool-meta"><span class="coop-name"><span aria-hidden="true">●</span>${escapeHTML(tool.coop)}</span><button class="reserve-button" data-reserve="${escapeHTML(tool.id)}">${isBusy ? "Choisir des dates ↗" : "Réserver ↗"}</button></div>
      </div>
    </article>`;
  }).join("");
  emptyState.hidden = visibleTools.length > 0;
  const noTools = tools.length === 0;
  document.querySelector("#empty-title").textContent = noTools ? "Aucun outil dans le catalogue." : "Aucun outil ne correspond à la recherche.";
  document.querySelector("#empty-copy").textContent = noTools
    ? "Les membres peuvent ajouter leurs outils; toute personne peut demander un outil."
    : "Essayez un autre mot ou une autre catégorie.";
  document.querySelector("#empty-add").hidden = !noTools;
  document.querySelector("#empty-request").hidden = !noTools;
  document.querySelector("#reset-filters").hidden = noTools;
  document.querySelector("#result-count").textContent = `${visibleTools.length} ${visibleTools.length === 1 ? "outil" : "outils"}`;
  document.querySelector("#tool-total").textContent = String(tools.length).padStart(2, "0");
  document.querySelector("#nav-count").textContent = String(tools.length).padStart(2, "0");
  document.querySelector("#all-count").textContent = String(tools.length).padStart(2, "0");
  document.querySelector("#request-count").textContent = String(requests.length).padStart(2, "0");
  document.querySelector("#request-total").textContent = String(requests.length).padStart(2, "0");
  document.querySelector("#training-count").textContent = String(trainingProposals.length).padStart(2, "0");
}

function renderReservations() {
  const list = document.querySelector("#reservation-list");
  const empty = document.querySelector("#reservation-empty");
  document.querySelector("#reservation-count").textContent = String(reservations.length).padStart(2, "0");
  document.querySelector("#reservation-subtitle").textContent = `${reservations.length} ${reservations.length === 1 ? "emprunt" : "emprunts"}`;
  list.innerHTML = reservations.map((reservation) => {
    const tool = tools.find((item) => item.id === reservation.toolId);
    if (!tool) return "";
    return `<article class="reservation-row">
      <img src="${escapeHTML(tool.image || FALLBACK_TOOL_IMAGE)}" alt="" />
      <div><h3>${escapeHTML(tool.name)}</h3><p>Pour ${escapeHTML(reservation.name)} · ${escapeHTML(tool.coop)}</p></div>
      <div class="reservation-dates">${formatDate(reservation.start)} → ${formatDate(reservation.end)}${reservation.note ? `<br>${escapeHTML(reservation.note)}` : ""}</div>
      <div class="reservation-status-wrap"><span class="reservation-status">CONFIRMÉE</span><br><button class="cancel-button" data-cancel="${escapeHTML(reservation.id)}">Annuler</button></div>
    </article>`;
  }).join("");
  empty.hidden = reservations.length > 0;
}

function renderRequests() {
  const list = document.querySelector("#request-list");
  const empty = document.querySelector("#request-empty");
  list.innerHTML = requests.map((request) => `<article class="request-row">
    <div class="request-main"><h3>${escapeHTML(request.toolName)}</h3><p>${escapeHTML(request.name)} · ${escapeHTML(request.coop)}</p>${request.details ? `<p>${escapeHTML(request.details)}</p>` : ""}</div>
    <div class="request-contact"><span>Pour joindre la personne</span><strong>${escapeHTML(request.contact)}</strong></div>
    <button class="request-done" data-delete-request="${escapeHTML(request.id)}">Demande traitée</button>
  </article>`).join("");
  empty.hidden = requests.length > 0;
  document.querySelector("#request-subtitle").textContent = `${requests.length} ${requests.length === 1 ? "demande" : "demandes"}`;
}

function renderTrainingProposals() {
  const list = document.querySelector("#training-list");
  const empty = document.querySelector("#training-empty");
  list.innerHTML = trainingProposals.map((proposal) => `<article class="request-row">
    <div class="request-main"><h3>${escapeHTML(proposal.title)}</h3><p>${escapeHTML(proposal.subject)} · ${escapeHTML(proposal.name)} · ${escapeHTML(proposal.coop)}</p>${proposal.details ? `<p>${escapeHTML(proposal.details)}</p>` : ""}</div>
    <div class="request-contact"><span>Pour joindre la personne</span><strong>${escapeHTML(proposal.contact)}</strong></div>
    <button class="request-done" data-delete-training="${escapeHTML(proposal.id)}">Proposition étudiée</button>
  </article>`).join("");
  empty.hidden = trainingProposals.length > 0;
  document.querySelector("#training-subtitle").textContent = `${trainingProposals.length} ${trainingProposals.length === 1 ? "proposition" : "propositions"}`;
}

function render() {
  renderTools();
  renderReservations();
  renderRequests();
  renderTrainingProposals();
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2800);
}

function setView(view) {
  const isCatalogue = view === "catalogue";
  document.querySelector("#catalogue").hidden = !isCatalogue;
  document.querySelector("#reservations").hidden = view !== "reservations";
  document.querySelector("#requests").hidden = view !== "requests";
  document.querySelector("#training-proposals").hidden = view !== "trainings";
  document.querySelectorAll(".nav-link").forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    if (["requests", "trainings"].includes(viewButton.dataset.view)) {
      nextView = viewButton.dataset.view;
      document.querySelector("#member-gate-title").textContent = viewButton.dataset.view === "trainings"
        ? "Voir les propositions de formation"
        : "Voir les demandes reçues";
      document.querySelector("#member-gate-error").textContent = "";
      memberGateDialog.showModal();
    } else {
      setView(viewButton.dataset.view);
    }
  }

  const categoryButton = event.target.closest("[data-category]");
  if (categoryButton) {
    selectedCategory = categoryButton.dataset.category;
    document.querySelectorAll(".filter-chip").forEach((button) => button.classList.toggle("is-selected", button === categoryButton));
    renderTools();
  }

  const reserveButton = event.target.closest("[data-reserve]");
  if (reserveButton) {
    const tool = tools.find((item) => item.id === reserveButton.dataset.reserve);
    if (!tool) return;
    document.querySelector("#reserve-tool-id").value = tool.id;
    document.querySelector("#reserve-tool-name").textContent = `${tool.name} · ${tool.coop}`;
    const trainingNotice = document.querySelector("#training-notice");
    const trainingConfirm = document.querySelector("#training-confirm");
    const hasTraining = document.querySelector("#has-training");
    trainingNotice.hidden = !tool.requiresTraining;
    trainingNotice.textContent = tool.requiresTraining ? `Formation requise : ${tool.trainingName || "formation de sécurité"}.` : "";
    trainingConfirm.hidden = !tool.requiresTraining;
    hasTraining.required = Boolean(tool.requiresTraining);
    hasTraining.checked = false;
    const today = localDateString();
    document.querySelector("#reserve-start").min = today;
    document.querySelector("#reserve-start").value = today;
    document.querySelector("#reserve-end").min = today;
    document.querySelector("#reserve-end").value = today;
    document.querySelector("#reserve-error").textContent = "";
    reserveDialog.showModal();
  }

  const cancelButton = event.target.closest("[data-cancel]");
  if (cancelButton) {
    reservations = reservations.filter((reservation) => reservation.id !== cancelButton.dataset.cancel);
    storage.write("la-remise-reservations", reservations);
    render();
    showToast("Réservation annulée.");
  }

  const deleteRequestButton = event.target.closest("[data-delete-request]");
  if (deleteRequestButton) {
    requests = requests.filter((request) => request.id !== deleteRequestButton.dataset.deleteRequest);
    storage.write("la-remise-requests", requests);
    render();
    showToast("Demande marquée comme traitée.");
  }

  const deleteTrainingButton = event.target.closest("[data-delete-training]");
  if (deleteTrainingButton) {
    trainingProposals = trainingProposals.filter((proposal) => proposal.id !== deleteTrainingButton.dataset.deleteTraining);
    storage.write("la-remise-training-proposals", trainingProposals);
    render();
    showToast("Proposition marquée comme étudiée.");
  }

  if (event.target.matches("[data-close]")) event.target.closest("dialog").close();
});

document.querySelector("#open-add").addEventListener("click", () => {
  document.querySelector("#add-error").textContent = "";
  addDialog.showModal();
});

document.querySelector("#empty-add").addEventListener("click", () => document.querySelector("#open-add").click());

document.querySelector("#open-request").addEventListener("click", () => {
  document.querySelector("#request-error").textContent = "";
  requestDialog.showModal();
});

document.querySelector("#empty-request").addEventListener("click", () => document.querySelector("#open-request").click());

document.querySelector("#open-training").addEventListener("click", () => {
  document.querySelector("#training-error").textContent = "";
  trainingDialog.showModal();
});

document.querySelector("#search-input").addEventListener("input", (event) => {
  searchTerm = event.target.value;
  renderTools();
});

document.querySelector("#reset-filters").addEventListener("click", () => {
  selectedCategory = "Tous";
  searchTerm = "";
  document.querySelector("#search-input").value = "";
  document.querySelectorAll(".filter-chip").forEach((button) => button.classList.toggle("is-selected", button.dataset.category === "Tous"));
  renderTools();
});

document.querySelector("#reserve-start").addEventListener("change", (event) => {
  const endInput = document.querySelector("#reserve-end");
  endInput.min = event.target.value;
  if (endInput.value < event.target.value) endInput.value = event.target.value;
});

document.querySelector("#reserve-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const toolId = document.querySelector("#reserve-tool-id").value;
  const start = document.querySelector("#reserve-start").value;
  const end = document.querySelector("#reserve-end").value;
  const error = document.querySelector("#reserve-error");
  const tool = tools.find((item) => item.id === toolId);
  if (tool?.requiresTraining && !document.querySelector("#has-training").checked) {
    error.textContent = "Cette réservation nécessite de confirmer que vous avez suivi la formation.";
    return;
  }
  if (end < start) {
    error.textContent = "La date de retour doit être après le début du prêt.";
    return;
  }
  const conflict = reservations.some((reservation) => reservation.toolId === toolId && datesOverlap(start, end, reservation.start, reservation.end));
  if (conflict) {
    error.textContent = "Ces dates chevauchent déjà une réservation. Essayez une autre période.";
    return;
  }
  const form = event.currentTarget;
  reservations.unshift({
    id: `pret-${Date.now()}`,
    toolId,
    name: form.elements.name.value.trim(),
    start,
    end,
    note: form.elements.note.value.trim()
  });
  storage.write("la-remise-reservations", reservations);
  form.reset();
  reserveDialog.close();
  render();
  showToast("C’est réservé, votre coop est au courant !");
});

document.querySelector("#member-gate-form").addEventListener("submit", (event) => {
  event.preventDefault();
  event.currentTarget.reset();
  memberGateDialog.close();
  if (nextView) setView(nextView);
  nextView = null;
});

document.querySelector("#add-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  const image = String(values.get("image")).trim();
  if (image && !/^https?:\/\//i.test(image)) {
    document.querySelector("#add-error").textContent = "Ajoutez une adresse de photo commençant par http:// ou https://.";
    return;
  }
  tools.unshift({
    id: `outil-${Date.now()}`,
    name: String(values.get("name")).trim(),
    category: String(values.get("category")),
    coop: String(values.get("coop")).trim(),
    description: String(values.get("description")).trim(),
    image,
    requiresTraining: form.elements.requiresTraining.checked,
    trainingName: form.elements.requiresTraining.checked ? String(values.get("trainingName")).trim() : ""
  });
  storage.write("la-remise-tools", tools);
  selectedCategory = "Tous";
  searchTerm = "";
  document.querySelector("#search-input").value = "";
  document.querySelectorAll(".filter-chip").forEach((button) => button.classList.toggle("is-selected", button.dataset.category === "Tous"));
  form.reset();
  document.querySelector("#training-name-field").hidden = true;
  form.elements.trainingName.required = false;
  addDialog.close();
  setView("catalogue");
  render();
  showToast("Votre outil est maintenant dans le catalogue.");
});

document.querySelector("#request-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const values = new FormData(event.currentTarget);
  requests.unshift({
    id: `demande-${Date.now()}`,
    toolName: String(values.get("toolName")).trim(),
    name: String(values.get("name")).trim(),
    coop: String(values.get("coop")).trim(),
    contact: String(values.get("contact")).trim(),
    details: String(values.get("details")).trim()
  });
  storage.write("la-remise-requests", requests);
  event.currentTarget.reset();
  requestDialog.close();
  render();
  showToast("Demande enregistrée sur cet appareil.");
});

document.querySelector("#add-form").elements.requiresTraining.addEventListener("change", (event) => {
  const field = document.querySelector("#training-name-field");
  field.hidden = !event.target.checked;
  document.querySelector("#add-form").elements.trainingName.required = event.target.checked;
});

document.querySelector("#training-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const values = new FormData(event.currentTarget);
  trainingProposals.unshift({
    id: `formation-${Date.now()}`,
    title: String(values.get("title")).trim(),
    subject: String(values.get("subject")).trim(),
    name: String(values.get("name")).trim(),
    coop: String(values.get("coop")).trim(),
    contact: String(values.get("contact")).trim(),
    details: String(values.get("details")).trim()
  });
  storage.write("la-remise-training-proposals", trainingProposals);
  event.currentTarget.reset();
  trainingDialog.close();
  render();
  showToast("Proposition de formation enregistrée.");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    document.querySelector("#search-input").focus();
  }
  if (event.key === "Escape") {
    if (reserveDialog.open) reserveDialog.close();
    if (addDialog.open) addDialog.close();
    if (requestDialog.open) requestDialog.close();
    if (trainingDialog.open) trainingDialog.close();
    if (memberGateDialog.open) memberGateDialog.close();
  }
});

render();