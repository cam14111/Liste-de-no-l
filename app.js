const STORAGE_KEY = "xmas-gifts-v1";
const STORAGE_META_KEY = "xmas-gifts-meta-v1";
const form = document.getElementById("giftForm");
const giftListEl = document.getElementById("giftList");
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");
const installBtn = document.getElementById("installBtn");
const snackbar = document.getElementById("snackbar");
const confirmDialog = document.getElementById("confirmDialog");
const confirmMessage = document.getElementById("confirmMessage");
const confirmOk = document.getElementById("confirmOk");
const confirmCancel = document.getElementById("confirmCancel");
const confirmClose = document.getElementById("confirmClose");
const recipientSuggestions = document.getElementById("recipientSuggestions");
const locationSuggestions = document.getElementById("locationSuggestions");

const filterRecipient = document.getElementById("filterRecipient");
const filterLocation = document.getElementById("filterLocation");
const filterPurchase = document.getElementById("filterPurchase");
const filterDelivery = document.getElementById("filterDelivery");
const filterWrap = document.getElementById("filterWrap");
const sortGifts = document.getElementById("sortGifts");
const costSortSelect = document.getElementById("costSort");
const locationSortSelect = document.getElementById("locationSort");

const newRecipientInput = document.getElementById("newRecipientInput");
const newLocationInput = document.getElementById("newLocationInput");
const recipientTagList = document.getElementById("recipientTagList");
const locationTagList = document.getElementById("locationTagList");

let deferredPrompt = null;
let state = {
  gifts: [],
  editingId: null,
  recipients: [],
  locations: [],
};

let confirmResolver = null;

const statusLabels = {
  purchase: {
    to_buy: "À acheter",
    bought: "Acheté",
  },
  delivery: {
    none: "Non commandé",
    transit: "En transit",
    delivered: "Livré",
    na: "Aucun besoin",
  },
  wrap: {
    not_wrapped: "Pas emballé",
    wrapped: "Emballé",
  },
};

const statusTone = {
  purchase: {
    to_buy: "danger",
    bought: "success",
  },
  delivery: {
    none: "danger",
    transit: "warning",
    delivered: "success",
    na: "success",
  },
  wrap: {
    not_wrapped: "danger",
    wrapped: "success",
  },
};

const statusFieldLabels = {
  purchase: "Achat",
  delivery: "Livraison",
  wrap: "Emballage",
};

init();

function init() {
  bindEvents();
  loadData();
  renderFilters();
  renderManagedLists();
  renderGiftList();
  renderDashboard();
  registerServiceWorker();
}

function bindEvents() {
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchPanel(tab.dataset.target));
  });

  document.getElementById("goToFormBtn").addEventListener("click", () => switchPanel("formPanel"));

  document.getElementById("clearFiltersBtn").addEventListener("click", () => {
    filterRecipient.value = "";
    filterLocation.value = "";
    filterPurchase.value = "";
    filterDelivery.value = "";
    filterWrap.value = "";
    if (sortGifts) sortGifts.value = "";
    renderGiftList();
  });

  [filterRecipient, filterLocation, filterPurchase, filterDelivery, filterWrap].forEach((select) => {
    select.addEventListener("change", renderGiftList);
  });

  sortGifts?.addEventListener("change", renderGiftList);
  costSortSelect?.addEventListener("change", renderDashboard);
  locationSortSelect?.addEventListener("change", renderDashboard);

  document.getElementById("resetFormBtn").addEventListener("click", () => {
    resetForm();
    showMessage("Formulaire réinitialisé");
  });

  form.addEventListener("submit", handleSubmit);

  installBtn.addEventListener("click", handleInstallClick);
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = "inline-flex";
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installBtn.style.display = "none";
    showMessage("Application installée !");
  });

  document.getElementById("addRecipientBtn").addEventListener("click", () => {
    addListItem("recipients", newRecipientInput.value);
    newRecipientInput.value = "";
  });

  document.getElementById("addLocationBtn").addEventListener("click", () => {
    addListItem("locations", newLocationInput.value);
    newLocationInput.value = "";
  });

  giftListEl.addEventListener("click", handleBadgeClick);
  giftListEl.addEventListener("keydown", handleBadgeKeydown);

  if (confirmOk && confirmCancel) {
    confirmOk.addEventListener("click", () => resolveConfirm(true));
    confirmCancel.addEventListener("click", () => resolveConfirm(false));
  }

  if (confirmClose) {
    confirmClose.addEventListener("click", () => resolveConfirm(false));
  }

  if (confirmDialog) {
    confirmDialog.addEventListener("click", (event) => {
      if (event.target === confirmDialog) resolveConfirm(false);
    });
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && confirmResolver) {
      resolveConfirm(false);
    }
  });

  [newRecipientInput, newLocationInput].forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const type = input === newRecipientInput ? "recipients" : "locations";
        addListItem(type, input.value);
        input.value = "";
      }
    });
  });

  recipientTagList.addEventListener("click", handleTagRemove);
  locationTagList.addEventListener("click", handleTagRemove);
}

function loadData() {
  const savedGifts = localStorage.getItem(STORAGE_KEY);
  if (savedGifts) {
    state.gifts = JSON.parse(savedGifts);
  } else {
    state.gifts = getSeedData();
    persist();
  }

  const savedMeta = localStorage.getItem(STORAGE_META_KEY);
  if (savedMeta) {
    const parsed = JSON.parse(savedMeta);
    state.recipients = Array.isArray(parsed.recipients) ? parsed.recipients : [];
    state.locations = Array.isArray(parsed.locations) ? parsed.locations : [];
  } else {
    deriveListsFromGifts();
    persistMeta();
  }

  ensureListsContainGifts();
  persistMeta();
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.gifts));
}

function persistMeta() {
  localStorage.setItem(
    STORAGE_META_KEY,
    JSON.stringify({
      recipients: state.recipients,
      locations: state.locations,
    })
  );
}

function deriveListsFromGifts() {
  const rec = new Set();
  const loc = new Set();
  state.gifts.forEach((gift) => {
    if (gift.recipient) rec.add(gift.recipient);
    if (gift.location) loc.add(gift.location);
  });
  state.recipients = Array.from(rec);
  state.locations = Array.from(loc);
}

function ensureListsContainGifts() {
  let updated = false;
  state.gifts.forEach((gift) => {
    if (gift.recipient && !state.recipients.includes(gift.recipient)) {
      state.recipients.push(gift.recipient);
      updated = true;
    }
    if (gift.location && !state.locations.includes(gift.location)) {
      state.locations.push(gift.location);
      updated = true;
    }
  });
  if (updated) persistMeta();
}

function getSeedData() {
  const now = new Date().toISOString();
  return [
    {
      id: createId(),
      recipient: "Pauline",
      location: "Famille",
      giftName: "Echarpe en laine",
      price: 39.9,
      purchaseStatus: "to_buy",
      deliveryStatus: "none",
      wrapStatus: "not_wrapped",
      link: "",
      notes: "Couleur vert sapin",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: createId(),
      recipient: "Lucas",
      location: "Amis",
      giftName: "Casque audio",
      price: 89.0,
      purchaseStatus: "bought",
      deliveryStatus: "transit",
      wrapStatus: "not_wrapped",
      link: "",
      notes: "Check réduction vendredi",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: createId(),
      recipient: "Parents",
      location: "Famille",
      giftName: "Weekend détente",
      price: 210.0,
      purchaseStatus: "bought",
      deliveryStatus: "delivered",
      wrapStatus: "wrapped",
      link: "",
      notes: "",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function handleSubmit(event) {
  event.preventDefault();

  const payload = {
    recipient: form.recipient.value.trim(),
    location: form.location.value.trim(),
    giftName: form.giftName.value.trim(),
    price: parseFloat(form.price.value) || 0,
    purchaseStatus: form.purchaseStatus.value,
    deliveryStatus: form.deliveryStatus.value,
    wrapStatus: form.wrapStatus.value,
    link: form.link.value.trim(),
    notes: form.notes.value.trim(),
    updatedAt: new Date().toISOString(),
  };

  if (!payload.recipient || !payload.location || !payload.giftName) {
    showMessage("Complète les champs obligatoires.");
    return;
  }

  syncListsWithGift(payload);

  if (state.editingId) {
    const index = state.gifts.findIndex((gift) => gift.id === state.editingId);
    if (index !== -1) {
      state.gifts[index] = { ...state.gifts[index], ...payload };
      showMessage("Cadeau mis à jour.");
    }
  } else {
    state.gifts.unshift({
      ...payload,
      id: createId(),
      createdAt: new Date().toISOString(),
    });
    showMessage("Cadeau ajouté !");
  }

  persist();
  renderFilters();
  renderManagedLists();
  renderGiftList();
  renderDashboard();
  resetForm();
  switchPanel("listPanel");
}

function resetForm() {
  state.editingId = null;
  form.reset();
  form.purchaseStatus.value = "to_buy";
  form.deliveryStatus.value = "none";
  form.wrapStatus.value = "not_wrapped";
  document.getElementById("submitBtn").textContent = "Enregistrer";
}

function renderFilters() {
  const recipients = getRecipientsSet();
  const locations = getLocationsSet();

  populateSelect(filterRecipient, recipients);
  populateSelect(filterLocation, locations);
}

function populateSelect(select, items) {
  const currentValue = select.value;
  select.innerHTML = "<option value=\"\">Tous</option>";

  Array.from(items)
    .sort()
    .forEach((item) => {
      const option = document.createElement("option");
      option.value = item;
      option.textContent = item;
      select.appendChild(option);
    });

  select.value = currentValue;
}

function populateDatalist(datalist, items) {
  if (!datalist) return;
  datalist.innerHTML = "";
  Array.from(items)
    .sort()
    .forEach((item) => {
      const option = document.createElement("option");
      option.value = item;
      datalist.appendChild(option);
    });
}

function applyFilters(list) {
  return list.filter((gift) => {
    const matchRecipient = filterRecipient.value ? gift.recipient === filterRecipient.value : true;
    const matchLocation = filterLocation.value ? gift.location === filterLocation.value : true;
    const matchPurchase = filterPurchase.value ? gift.purchaseStatus === filterPurchase.value : true;
    const matchDelivery = filterDelivery.value ? gift.deliveryStatus === filterDelivery.value : true;
    const matchWrap = filterWrap.value ? gift.wrapStatus === filterWrap.value : true;

    return matchRecipient && matchLocation && matchPurchase && matchDelivery && matchWrap;
  });
}

function sortGiftList(list) {
  const sortBy = sortGifts?.value || "";
  if (!sortBy) return list;

  const copy = [...list];

  if (sortBy === "progress_desc") {
    const progressMap = new Map(copy.map((g) => [g.id, computeGiftProgress(g)]));
    copy.sort((a, b) => {
      const pa = progressMap.get(a.id) || 0;
      const pb = progressMap.get(b.id) || 0;
      if (pa !== pb) return pa - pb;
      return (a.recipient || "").localeCompare(b.recipient || "", "fr", { sensitivity: "base" });
    });
  } else if (sortBy === "name_asc") {
    copy.sort((a, b) => (a.recipient || "").localeCompare(b.recipient || "", "fr", { sensitivity: "base" }));
  } else if (sortBy === "location_asc") {
    copy.sort((a, b) => {
      const locCmp = (a.location || "").localeCompare(b.location || "", "fr", { sensitivity: "base" });
      if (locCmp !== 0) return locCmp;
      return (a.recipient || "").localeCompare(b.recipient || "", "fr", { sensitivity: "base" });
    });
  }

  return copy;
}

function groupGifts(list, sortBy) {
  if (sortBy === "name_asc") {
    return groupByKey(list, "recipient", "Sans nom");
  }
  if (sortBy === "location_asc") {
    return groupByKey(list, "location", "Sans lieu");
  }
  return null;
}

function groupByKey(list, key, fallbackLabel) {
  const groups = new Map();
  list.forEach((gift) => {
    const label = (gift[key] || fallbackLabel || "").trim();
    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label).push(gift);
  });

  const sortedLabels = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  return sortedLabels.map((label) => ({ label, items: groups.get(label) || [] }));
}

function renderManagedLists() {
  const recipientsSet = getRecipientsSet();
  const locationsSet = getLocationsSet();
  populateDatalist(recipientSuggestions, recipientsSet);
  populateDatalist(locationSuggestions, locationsSet);
  renderTagList(recipientTagList, state.recipients, "recipients");
  renderTagList(locationTagList, state.locations, "locations");
}

function renderTagList(container, items, type) {
  if (!container) return;
  container.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Aucune entrée pour l'instant.";
    container.appendChild(empty);
    return;
  }
  items
    .slice()
    .sort((a, b) => a.localeCompare(b))
    .forEach((item) => {
      const tag = document.createElement("div");
      tag.className = "tag";
      tag.textContent = item;
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "tag-remove";
      removeBtn.textContent = "×";
      removeBtn.dataset.type = type;
      removeBtn.dataset.value = item;
      tag.appendChild(removeBtn);
      container.appendChild(tag);
    });
}

function addListItem(type, value) {
  const trimmed = value.trim();
  if (!trimmed) {
    showMessage("Entrez un nom non vide.");
    return;
  }
  const listRef = type === "recipients" ? "recipients" : "locations";
  const list = state[listRef];
  const exists = list.some((item) => item.toLowerCase() === trimmed.toLowerCase());
  if (exists) {
    showMessage("Déjà présent dans la liste.");
    return;
  }
  list.push(trimmed);
  persistMeta();
  renderFilters();
  renderManagedLists();
  showMessage(type === "recipients" ? "Destinataire ajouté." : "Lieu ajouté.");
}

function removeListItem(type, value) {
  const listRef = type === "recipients" ? "recipients" : "locations";
  const label = type === "recipients" ? "Destinataire supprimé." : "Lieu supprimé.";
  state[listRef] = state[listRef].filter((item) => item !== value);
  persistMeta();
  renderFilters();
  renderManagedLists();
  showMessage(label);
}

function handleTagRemove(event) {
  const btn = event.target.closest(".tag-remove");
  if (!btn || !btn.dataset.type || !btn.dataset.value) return;
  removeListItem(btn.dataset.type, btn.dataset.value);
}

function getRecipientsSet() {
  const recipients = new Set(state.recipients);
  state.gifts.forEach((gift) => gift.recipient && recipients.add(gift.recipient));
  return recipients;
}

function getLocationsSet() {
  const locations = new Set(state.locations);
  state.gifts.forEach((gift) => gift.location && locations.add(gift.location));
  return locations;
}

function renderGiftList() {
  const filtered = applyFilters(state.gifts);
  const list = sortGiftList(filtered);
  const sortBy = sortGifts?.value || "";
  const grouped = groupGifts(list, sortBy);
  renderListProgress(computeStats(state.gifts));
  giftListEl.innerHTML = "";

  if (list.length === 0) {
    giftListEl.classList.remove("grouped");
    const empty = document.createElement("div");
    empty.className = "card";
    empty.innerHTML = `
      <p class="label">Aucun cadeau trouvé.</p>
      <p style="margin:6px 0 10px; color: var(--muted);">Ajoute ton premier cadeau ou ajuste les filtres.</p>
      <button class="primary-btn" id="emptyCreate">+ Ajouter un cadeau</button>
    `;
    giftListEl.appendChild(empty);
    document.getElementById("emptyCreate").addEventListener("click", () => switchPanel("formPanel"));
    return;
  }

  if (grouped) {
    giftListEl.classList.add("grouped");
    grouped.forEach((group) => {
      const wrapper = document.createElement("div");
      wrapper.className = "gift-group";
      wrapper.innerHTML = `
        <div class="gift-group-header">
          <h3>${group.label || "—"}</h3>
          <span class="chip subtle">${group.items.length} cadeau${group.items.length > 1 ? "x" : ""}</span>
        </div>
      `;
      const grid = document.createElement("div");
      grid.className = "gift-group-grid";
      group.items.forEach((gift) => {
        grid.appendChild(buildGiftCardElement(gift));
      });
      wrapper.appendChild(grid);
      giftListEl.appendChild(wrapper);
    });
  } else {
    giftListEl.classList.remove("grouped");
    list.forEach((gift) => {
      giftListEl.appendChild(buildGiftCardElement(gift));
    });
  }

  giftListEl.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      const id = event.currentTarget.dataset.id;
      if (event.currentTarget.dataset.action === "edit") {
        populateForm(id);
        switchPanel("formPanel");
      } else {
        openConfirmDialog("Supprimer ce cadeau ?").then((confirmed) => {
          if (confirmed) {
            deleteGift(id);
          }
        });
      }
    });
  });
}

function buildGiftCardElement(gift) {
  const card = document.createElement("div");
  const progress = computeGiftProgress(gift);
  const isComplete = progress === 100;
  card.className = `card gift-card${isComplete ? " completed" : ""}`;

  const price = gift.price ? formatCurrency(gift.price) : "-";
  const badges = [
    buildBadge("purchase", gift.purchaseStatus, gift.id),
    buildBadge("delivery", gift.deliveryStatus, gift.id),
    buildBadge("wrap", gift.wrapStatus, gift.id),
  ].join("");

  const linkBlock = gift.link
    ? `<a href="${gift.link}" target="_blank" rel="noopener" style="color: var(--accent); font-weight:600;">Voir le lien</a>`
    : "";

  const notesBlock = gift.notes ? `<p style="color: var(--muted); font-size:0.95rem;">${gift.notes}</p>` : "";

  card.innerHTML = `
    <div class="header">
      <div>
        <div class="title">${gift.giftName}</div>
        <div class="meta">
          <span>${gift.recipient}</span>
          <span>•</span>
          <span>${gift.location}</span>
          <span>•</span>
          <strong>${price}</strong>
        </div>
      </div>
      <div class="gift-actions">
        <button class="ghost-btn icon-btn" data-action="edit" data-id="${gift.id}" aria-label="Modifier ce cadeau">
          <span class="btn-icon">&#9998;</span>
        </button>
        <button class="ghost-btn icon-btn" data-action="delete" data-id="${gift.id}" aria-label="Supprimer ce cadeau">
          <span class="btn-icon">&#128465;</span>
        </button>
      </div>
    </div>
    <div class="badges">${badges}</div>
    <div class="gift-progress" aria-label="Avancement individuel">
      <div class="gift-progress-bar">
        <div class="gift-progress-fill${isComplete ? " complete" : ""}" style="width:${progress}%;"></div>
      </div>
      <span class="gift-progress-value">${progress}%</span>
    </div>
    ${notesBlock}
    ${linkBlock}
  `;

  return card;
}

function buildBadge(type, value, giftId) {
  const label = statusLabels[type]?.[value] || value;
  const tone = statusTone[type]?.[value] || "";
  const ariaLabel = `${statusFieldLabels[type] || "Statut"}: ${label}. Cliquer pour changer`;
  return `<span class="badge ${tone || ""} status-badge" role="button" tabindex="0" data-type="${type}" data-id="${giftId}" data-value="${value}" aria-label="${ariaLabel}">${label}</span>`;
}

function populateForm(id) {
  const gift = state.gifts.find((item) => item.id === id);
  if (!gift) return;

  state.editingId = id;
  form.recipient.value = gift.recipient;
  form.location.value = gift.location;
  form.giftName.value = gift.giftName;
  form.price.value = gift.price;
  form.purchaseStatus.value = gift.purchaseStatus;
  form.deliveryStatus.value = gift.deliveryStatus;
  form.wrapStatus.value = gift.wrapStatus;
  form.link.value = gift.link || "";
  form.notes.value = gift.notes || "";
  document.getElementById("submitBtn").textContent = "Mettre à jour";
}

function deleteGift(id) {
  state.gifts = state.gifts.filter((gift) => gift.id !== id);
  persist();
  renderFilters();
  renderManagedLists();
  renderGiftList();
  renderDashboard();
  showMessage("Cadeau supprimé.");
}

function renderDashboard() {
  const stats = computeStats(state.gifts);

  document.getElementById("plannedTotal").textContent = formatCurrency(stats.totalPlanned);
  document.getElementById("spentTotal").textContent = formatCurrency(stats.totalSpent);
  document.getElementById("differenceTotal").textContent = formatCurrency(stats.difference);

  document.getElementById("purchasePercent").textContent = formatPercent(stats.purchasePct);
  document.getElementById("deliveryPercent").textContent = formatPercent(stats.deliveryPct);
  document.getElementById("wrapPercent").textContent = formatPercent(stats.wrapPct);

  document.getElementById("overallPercent").textContent = formatPercent(stats.overallPct);
  document.getElementById("progressFill").style.width = `${stats.overallPct}%`;
  renderListProgress(stats);

  if (typeof renderCharts === "function") {
    renderCharts(stats);
  }
}

function computeStats(list) {
  const totalPlanned = list.reduce((sum, gift) => sum + (Number.isFinite(gift.price) ? gift.price : 0), 0);
  const purchased = list.filter((gift) => gift.purchaseStatus === "bought");
  const delivered = list.filter((gift) => gift.deliveryStatus === "delivered");
  const wrapped = list.filter((gift) => gift.wrapStatus === "wrapped");

  const totalSpent = purchased.reduce((sum, gift) => sum + (Number.isFinite(gift.price) ? gift.price : 0), 0);

  const totalCount = list.length;
  const purchasePct = totalCount ? Math.round((purchased.length / totalCount) * 100) : 0;
  const deliveryPct = totalCount ? Math.round((delivered.length / totalCount) * 100) : 0;
  const wrapPct = totalCount ? Math.round((wrapped.length / totalCount) * 100) : 0;

  const costPerRecipient = list.reduce((acc, gift) => {
    if (!gift.recipient) return acc;
    acc[gift.recipient] = (acc[gift.recipient] || 0) + (Number.isFinite(gift.price) ? gift.price : 0);
    return acc;
  }, {});

  const recipientLocationCounts = list.reduce((acc, gift) => {
    if (!gift.recipient || !gift.location) return acc;
    if (!acc[gift.recipient]) acc[gift.recipient] = {};
    acc[gift.recipient][gift.location] = (acc[gift.recipient][gift.location] || 0) + 1;
    return acc;
  }, {});

  const overallPct = totalCount ? Math.round((purchasePct + deliveryPct + wrapPct) / 3) : 0;

  return {
    totalPlanned: round(totalPlanned),
    totalSpent: round(totalSpent),
    difference: round(totalPlanned - totalSpent),
    purchasePct,
    deliveryPct,
    wrapPct,
    overallPct,
    purchasedCount: purchased.length,
    totalCount,
    costPerRecipient,
    recipientLocationCounts,
  };
}

function renderListProgress(stats) {
  const percentEl = document.getElementById("listOverallPercent");
  const fillEl = document.getElementById("listProgressFill");
  const detailEl = document.getElementById("listProgressDetail");
  if (!percentEl || !fillEl || !stats) return;
  percentEl.textContent = formatPercent(stats.overallPct);
  fillEl.style.width = `${stats.overallPct}%`;
  if (detailEl) {
    detailEl.textContent = `Achats ${formatPercent(stats.purchasePct)}, Livraisons ${formatPercent(stats.deliveryPct)}, Emballages ${formatPercent(stats.wrapPct)}.`;
  }
}

function computeGiftProgress(gift) {
  let total = 0;

  if (gift.purchaseStatus === "bought") total += 60;

  if (gift.deliveryStatus === "transit") {
    total += 15;
  } else if (gift.deliveryStatus === "delivered" || gift.deliveryStatus === "na") {
    total += 30;
  }

  if (gift.wrapStatus === "wrapped") total += 10;

  return Math.min(100, Math.max(0, total));
}

function handleBadgeClick(event) {
  const badge = event.target.closest(".status-badge");
  if (!badge) return;
  cycleBadgeStatus(badge);
}

function handleBadgeKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const badge = event.target.closest(".status-badge");
  if (!badge) return;
  event.preventDefault();
  cycleBadgeStatus(badge);
}

function cycleBadgeStatus(badge) {
  const { type, id, value } = badge.dataset;
  if (!type || !id) return;

  const options = Object.keys(statusLabels[type] || {});
  if (!options.length) return;

  const currentIndex = options.indexOf(value);
  const nextValue = options[(currentIndex + 1) % options.length];
  updateGiftStatus(id, type, nextValue);
}

function openConfirmDialog(message) {
  if (!confirmDialog || !confirmMessage) {
    return Promise.resolve(false);
  }

  confirmMessage.textContent = message;
  confirmDialog.classList.add("show");
  confirmOk?.focus();

  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function resolveConfirm(result) {
  if (!confirmDialog || !confirmResolver) return;
  confirmDialog.classList.remove("show");
  confirmResolver(result);
  confirmResolver = null;
}

function updateGiftStatus(id, type, value) {
  const keyMap = {
    purchase: "purchaseStatus",
    delivery: "deliveryStatus",
    wrap: "wrapStatus",
  };

  const key = keyMap[type];
  if (!key) return;

  const index = state.gifts.findIndex((gift) => gift.id === id);
  if (index === -1) return;

  state.gifts[index] = {
    ...state.gifts[index],
    [key]: value,
    updatedAt: new Date().toISOString(),
  };

  persist();
  renderGiftList();
  renderDashboard();
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value || 0);
}

function formatPercent(value) {
  return `${Math.min(100, Math.max(0, Math.round(value)))}%`;
}

function createId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `gift-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function switchPanel(targetId) {
  panels.forEach((panel) => panel.classList.remove("active"));
  tabs.forEach((tab) => tab.classList.remove("active"));

  document.getElementById(targetId)?.classList.add("active");
  const tab = Array.from(tabs).find((t) => t.dataset.target === targetId);
  tab?.classList.add("active");
}

function showMessage(text) {
  if (!snackbar) return;
  snackbar.textContent = text;
  snackbar.classList.add("show");
  setTimeout(() => snackbar.classList.remove("show"), 2200);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const protocol = window.location.protocol;
  if (protocol !== "http:" && protocol !== "https:") {
    console.warn("Service worker non disponible hors HTTP/HTTPS.");
    return;
  }
  navigator.serviceWorker.register("service-worker.js").catch((err) => {
    console.error("SW registration failed", err);
  });
}

function handleInstallClick() {
  if (!deferredPrompt) {
    showMessage("Installation non disponible pour le moment.");
    return;
  }
  deferredPrompt.prompt();
  deferredPrompt.userChoice.finally(() => {
    deferredPrompt = null;
    installBtn.style.display = "none";
  });
}

function syncListsWithGift(gift) {
  let updated = false;
  if (gift.recipient && !state.recipients.some((r) => r.toLowerCase() === gift.recipient.toLowerCase())) {
    state.recipients.push(gift.recipient);
    updated = true;
  }
  if (gift.location && !state.locations.some((l) => l.toLowerCase() === gift.location.toLowerCase())) {
    state.locations.push(gift.location);
    updated = true;
  }
  if (updated) {
    persistMeta();
  }
}

function importGiftData(rawText) {
  if (!rawText || typeof rawText !== "string") return { imported: 0, skipped: 0 };
  const rows = rawText.trim().split(/\r?\n/);
  if (rows.length <= 1) return { imported: 0, skipped: 0 };

  const payloadRows = rows.slice(1); // skip header
  let imported = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  payloadRows.forEach((row) => {
    const cells = splitRow(row);
    if (cells.length < 7) {
      skipped += 1;
      return;
    }

    const [recipient, location, giftName, priceRaw, purchaseRaw, deliveryRaw, wrapRaw] = cells;
    const gift = {
      id: createId(),
      recipient: recipient.trim(),
      location: location.trim(),
      giftName: giftName.trim(),
      price: parsePrice(priceRaw),
      purchaseStatus: normalizePurchase(purchaseRaw),
      deliveryStatus: normalizeDelivery(deliveryRaw),
      wrapStatus: normalizeWrap(wrapRaw),
      link: "",
      notes: "",
      createdAt: now,
      updatedAt: now,
    };

    if (!gift.recipient || !gift.location || !gift.giftName) {
      skipped += 1;
      return;
    }

    state.gifts.unshift(gift);
    syncListsWithGift(gift);
    imported += 1;
  });

  persist();
  renderFilters();
  renderManagedLists();
  renderGiftList();
  renderDashboard();
  showMessage(`${imported} cadeau(x) importé(s).`);

  return { imported, skipped };
}

function splitRow(row) {
  const withTabs = row.split(/\t/).filter((cell) => cell !== "");
  if (withTabs.length > 1) return withTabs;

  const withSemicolons = row.split(";").map((c) => c.trim());
  if (withSemicolons.length > 1) return withSemicolons;

  return row.split(",").map((c) => c.trim());
}

function parsePrice(value) {
  if (typeof value !== "string") return 0;
  const normalized = value.replace(/[^\d,.-]/g, "").replace(",", "."); // keep last dot/comma as decimal
  const num = parseFloat(normalized);
  return Number.isFinite(num) ? num : 0;
}

function normalizePurchase(value) {
  const v = (value || "").toLowerCase();
  if (v.includes("pas achet")) return "to_buy";
  if (v.includes("achet")) return "bought";
  return "to_buy";
}

function normalizeDelivery(value) {
  const v = (value || "").toLowerCase();
  if (v.includes("pas de livraison") || v.includes("aucun besoin")) return "na";
  if (v.includes("pas command")) return "none";
  if (v.includes("transit")) return "transit";
  if (v.includes("arriv") || v.includes("livr")) return "delivered";
  return "none";
}

function normalizeWrap(value) {
  const v = (value || "").toLowerCase();
  if (v.includes("emball") && !v.includes("pas")) return "wrapped";
  return "not_wrapped";
}

window.importGiftData = importGiftData;
