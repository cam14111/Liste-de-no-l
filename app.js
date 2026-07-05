const STORAGE_KEY = "xmas-gifts-v1";
const STORAGE_META_KEY = "xmas-gifts-meta-v1";
const THEME_STORAGE_KEY = "appThemeId";
const DEFAULT_THEME_ID = "noel";
const SCHEMA_VERSION = 1;

// Valeurs de statut autorisées (source de vérité pour la validation)
const PURCHASE_VALUES = ["to_buy", "bought"];
const DELIVERY_VALUES = ["none", "transit", "delivered", "na"];
const WRAP_VALUES = ["not_wrapped", "wrapped"];

/**
 * Accès localStorage tolérant aux erreurs (mode privé, quota plein, stockage
 * désactivé). Ne jette jamais : l'application reste utilisable même sans
 * persistance.
 */
const storage = {
  available: (() => {
    try {
      const k = "__xmas_test__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  })(),
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.error("Échec d'écriture localStorage", e);
      if (e && (e.name === "QuotaExceededError" || e.code === 22)) {
        showMessage("Stockage plein : impossible d'enregistrer.");
      }
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      /* ignore */
    }
  },
};

/** Échappe le HTML pour empêcher toute injection (XSS) dans innerHTML. */
function escapeHtml(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** N'autorise que les URLs http(s) absolues ; bloque javascript:, data:, relatif, etc. */
function sanitizeUrl(url) {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed); // absolue requise : lève une erreur sinon
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
  } catch (e) {
    /* URL invalide ou relative */
  }
  return "";
}

/** Valide et normalise un cadeau issu du stockage/import. Renvoie null si invalide. */
function normalizeGift(raw) {
  if (!raw || typeof raw !== "object") return null;
  const recipient = typeof raw.recipient === "string" ? raw.recipient.trim() : "";
  const location = typeof raw.location === "string" ? raw.location.trim() : "";
  const giftName = typeof raw.giftName === "string" ? raw.giftName.trim() : "";
  if (!recipient || !location || !giftName) return null;

  let price = Number.isFinite(raw.price) ? raw.price : parseFloat(raw.price);
  if (!Number.isFinite(price) || price < 0) price = 0;

  const now = new Date().toISOString();
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : createId(),
    recipient,
    location,
    giftName,
    price: round(price),
    purchaseStatus: PURCHASE_VALUES.includes(raw.purchaseStatus) ? raw.purchaseStatus : "to_buy",
    deliveryStatus: DELIVERY_VALUES.includes(raw.deliveryStatus) ? raw.deliveryStatus : "none",
    wrapStatus: WRAP_VALUES.includes(raw.wrapStatus) ? raw.wrapStatus : "not_wrapped",
    link: typeof raw.link === "string" ? raw.link.trim() : "",
    notes: typeof raw.notes === "string" ? raw.notes.trim() : "",
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : now,
  };
}

// Définition des thèmes
const THEMES = {
  noel: {
    id: "noel",
    label: "Noël",
    emoji: "🎄",
    title: "Atelier Noël",
    subtitle: "Suivi des cadeaux",
    palette: {
      primary: "#0f3d3e",
      secondary: "#124748",
      accent: "#73ffc6",
      bg: "#061a1d",
      surface: "#0f3d3e",
      text: "#e9f5f2",
      mutedText: "#9fb3b5",
      border: "rgba(255, 255, 255, 0.08)",
      onPrimary: "#e9f5f2"
    },
    pattern: "snowflakes",
    isDark: true
  },
  valentine: {
    id: "valentine",
    label: "Saint-Valentin",
    emoji: "💘",
    title: "Cadeaux St-Valentin",
    subtitle: "Pour mon amour",
    palette: {
      primary: "#D81B60",
      secondary: "#F8BBD0",
      accent: "#8E24AA",
      bg: "#FFF7FA",
      surface: "#FFFFFF",
      text: "#2B2B2B",
      mutedText: "#6B6B6B",
      border: "#F3C6D6",
      onPrimary: "#FFFFFF"
    },
    pattern: "hearts",
    isDark: false
  },
  birthday: {
    id: "birthday",
    label: "Anniversaire",
    emoji: "🎂",
    title: "Cadeaux Anniversaire",
    subtitle: "Joyeux anniversaire !",
    palette: {
      primary: "#7C3AED",
      secondary: "#FDE68A",
      accent: "#22C55E",
      bg: "#FAFAFF",
      surface: "#FFFFFF",
      text: "#1F2937",
      mutedText: "#6B7280",
      border: "#E5E7EB",
      onPrimary: "#FFFFFF"
    },
    pattern: "confetti",
    isDark: false
  },
  meeting_anniversary: {
    id: "meeting_anniversary",
    label: "Anniversaire de rencontre",
    emoji: "✨",
    title: "Notre Rencontre",
    subtitle: "Un moment magique",
    palette: {
      primary: "#B45309",
      secondary: "#FCE7C3",
      accent: "#0EA5E9",
      bg: "#FFFBF5",
      surface: "#FFFFFF",
      text: "#2A2A2A",
      mutedText: "#6B6B6B",
      border: "#F3D9B1",
      onPrimary: "#FFFFFF"
    },
    pattern: "stars",
    isDark: false
  },
  wedding_anniversary: {
    id: "wedding_anniversary",
    label: "Anniversaire de mariage",
    emoji: "💍",
    title: "Notre Mariage",
    subtitle: "Célébrons notre amour",
    palette: {
      primary: "#0F172A",
      secondary: "#E2E8F0",
      accent: "#D4AF37",
      bg: "#F8FAFC",
      surface: "#FFFFFF",
      text: "#0B1220",
      mutedText: "#475569",
      border: "#CBD5E1",
      onPrimary: "#FFFFFF"
    },
    pattern: "monogram",
    isDark: false
  },
  neutral: {
    id: "neutral",
    label: "Neutre",
    emoji: "🗓️",
    title: "Liste Cadeaux",
    subtitle: "Suivi des achats",
    palette: {
      primary: "#2563EB",
      secondary: "#E5E7EB",
      accent: "#10B981",
      bg: "#F7F7F8",
      surface: "#FFFFFF",
      text: "#111827",
      mutedText: "#6B7280",
      border: "#D1D5DB",
      onPrimary: "#FFFFFF"
    },
    pattern: "none",
    isDark: false
  }
};

// Gestionnaire de thèmes
const ThemeManager = {
  themes: THEMES,
  currentThemeId: null,

  init() {
    const saved = storage.get(THEME_STORAGE_KEY);
    const themeId = (saved && this.themes[saved]) ? saved : DEFAULT_THEME_ID;
    this.apply(themeId);
  },

  apply(themeId) {
    const theme = this.themes[themeId];
    if (!theme) return;

    this.currentThemeId = themeId;
    const root = document.documentElement;

    // Appliquer les couleurs de la palette
    Object.entries(theme.palette).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    // Data attributes pour les sélecteurs CSS
    root.dataset.themeId = themeId;
    root.dataset.themeDark = theme.isDark;
    root.dataset.themePattern = theme.pattern || "none";

    // Persister le choix
    storage.set(THEME_STORAGE_KEY, themeId);

    // Mettre à jour le meta theme-color
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute("content", theme.palette.primary);
    }

    // Mettre à jour le logo emoji
    const logo = document.querySelector(".logo");
    if (logo) {
      logo.textContent = theme.emoji;
    }

    // Mettre à jour le titre et sous-titre du header
    const brandTitle = document.querySelector(".brand-text strong");
    const brandSubtitle = document.querySelector(".brand-text small");
    if (brandTitle && theme.title) {
      brandTitle.textContent = theme.title;
    }
    if (brandSubtitle && theme.subtitle) {
      brandSubtitle.textContent = theme.subtitle;
    }

    // Mettre à jour les charts si la fonction existe
    if (typeof window.updateChartsForTheme === "function") {
      window.updateChartsForTheme(theme);
    }
  },

  getCurrentTheme() {
    return this.themes[this.currentThemeId];
  },

  listThemes() {
    return Object.values(this.themes);
  },

  getThemeId() {
    return this.currentThemeId;
  },

  setThemeId(id) {
    this.apply(id);
  }
};
const form = document.getElementById("giftForm");
const giftListEl = document.getElementById("giftList");
const tabs = document.querySelectorAll(".tabs .tab");
const panels = document.querySelectorAll(".panel");
const snackbar = document.getElementById("snackbar");
const confirmDialog = document.getElementById("confirmDialog");
const confirmMessage = document.getElementById("confirmMessage");
const confirmOk = document.getElementById("confirmOk");
const confirmCancel = document.getElementById("confirmCancel");
const confirmClose = document.getElementById("confirmClose");
const themeBtn = document.getElementById("themeBtn");
const themeDialog = document.getElementById("themeDialog");
const themeGrid = document.getElementById("themeGrid");
const themeClose = document.getElementById("themeClose");
const recipientSelect = document.getElementById("recipient");
const locationSelect = document.getElementById("location");

const searchInput = document.getElementById("searchInput");
const filterRecipient = document.getElementById("filterRecipient");
const filterLocation = document.getElementById("filterLocation");
const filterPurchase = document.getElementById("filterPurchase");
const filterDelivery = document.getElementById("filterDelivery");
const filterWrap = document.getElementById("filterWrap");
const sortGifts = document.getElementById("sortGifts");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFileInput = document.getElementById("importFileInput");
const shareBtn = document.getElementById("shareBtn");
const costSortSelect = document.getElementById("costSort");
const locationSortSelect = document.getElementById("locationSort");

const newRecipientInput = document.getElementById("newRecipientInput");
const newLocationInput = document.getElementById("newLocationInput");
const recipientTagList = document.getElementById("recipientTagList");
const locationTagList = document.getElementById("locationTagList");

let state = {
  gifts: [],
  editingId: null,
  recipients: [],
  locations: [],
};

let confirmResolver = null;
let lastFocusedElement = null;
let snackbarTimer = null;

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
  ThemeManager.init();
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
    if (searchInput) searchInput.value = "";
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

  searchInput?.addEventListener("input", renderGiftList);
  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && searchInput.value) {
      searchInput.value = "";
      renderGiftList();
    }
  });

  exportBtn?.addEventListener("click", exportData);
  shareBtn?.addEventListener("click", shareSummary);
  importBtn?.addEventListener("click", () => importFileInput?.click());
  importFileInput?.addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    handleImportFile(file);
    event.target.value = ""; // permet de réimporter le même fichier
  });

  sortGifts?.addEventListener("change", renderGiftList);
  costSortSelect?.addEventListener("change", renderDashboard);
  locationSortSelect?.addEventListener("change", renderDashboard);

  document.getElementById("resetFormBtn").addEventListener("click", () => {
    resetForm();
    showMessage("Formulaire réinitialisé");
  });

  form.addEventListener("submit", handleSubmit);

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
    if (event.key === "Escape") {
      if (confirmResolver) {
        resolveConfirm(false);
      }
      if (themeDialog?.classList.contains("show")) {
        closeThemeDialog();
      }
    }
  });

  window.addEventListener("keydown", handleModalFocusTrap);

  // Theme dialog events
  if (themeBtn) {
    themeBtn.addEventListener("click", openThemeDialog);
  }

  if (themeClose) {
    themeClose.addEventListener("click", closeThemeDialog);
  }

  if (themeDialog) {
    themeDialog.addEventListener("click", (event) => {
      if (event.target === themeDialog) closeThemeDialog();
    });
  }

  if (themeGrid) {
    themeGrid.addEventListener("click", (event) => {
      const card = event.target.closest(".theme-card");
      if (!card) return;
      ThemeManager.apply(card.dataset.themeId);
      renderThemeGrid();
      showMessage(`Thème "${ThemeManager.getCurrentTheme().label}" appliqué`);
    });
  }

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
  const savedGifts = storage.get(STORAGE_KEY);
  if (savedGifts) {
    try {
      const parsed = JSON.parse(savedGifts);
      if (Array.isArray(parsed)) {
        const normalized = parsed.map(normalizeGift).filter(Boolean);
        // Si la validation écarte des enregistrements, on conserve l'original
        // par sécurité avant de réécrire la version nettoyée (pas de perte silencieuse).
        if (normalized.length !== parsed.length) {
          storage.set(`${STORAGE_KEY}-backup-${Date.now()}`, savedGifts);
        }
        state.gifts = normalized;
      } else {
        state.gifts = [];
      }
      persist(); // réécrit une version normalisée/nettoyée
    } catch (e) {
      console.error("Données cadeaux illisibles", e);
      // On conserve une copie de secours au lieu d'écraser silencieusement.
      storage.set(`${STORAGE_KEY}-corrupted-${Date.now()}`, savedGifts);
      state.gifts = [];
      showMessage("Données illisibles : une sauvegarde de secours a été créée.");
    }
  } else {
    state.gifts = getSeedData();
    persist();
  }

  const savedMeta = storage.get(STORAGE_META_KEY);
  if (savedMeta) {
    try {
      const parsed = JSON.parse(savedMeta);
      state.recipients = Array.isArray(parsed.recipients)
        ? parsed.recipients.filter((v) => typeof v === "string" && v.trim())
        : [];
      state.locations = Array.isArray(parsed.locations)
        ? parsed.locations.filter((v) => typeof v === "string" && v.trim())
        : [];
    } catch (e) {
      console.error("Métadonnées illisibles", e);
      deriveListsFromGifts();
    }
  } else {
    deriveListsFromGifts();
    persistMeta();
  }

  ensureListsContainGifts();
  persistMeta();
}

function persist() {
  storage.set(STORAGE_KEY, JSON.stringify(state.gifts));
}

function persistMeta() {
  storage.set(
    STORAGE_META_KEY,
    JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
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

  const parsedPrice = parseFloat(form.price.value);
  const payload = {
    recipient: form.recipient.value.trim(),
    location: form.location.value.trim(),
    giftName: form.giftName.value.trim(),
    price: Number.isFinite(parsedPrice) && parsedPrice > 0 ? round(parsedPrice) : 0,
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


function applyFilters(list) {
  const query = (searchInput?.value || "").trim().toLowerCase();
  return list.filter((gift) => {
    const matchRecipient = filterRecipient.value ? gift.recipient === filterRecipient.value : true;
    const matchLocation = filterLocation.value ? gift.location === filterLocation.value : true;
    const matchPurchase = filterPurchase.value ? gift.purchaseStatus === filterPurchase.value : true;
    const matchDelivery = filterDelivery.value ? gift.deliveryStatus === filterDelivery.value : true;
    const matchWrap = filterWrap.value ? gift.wrapStatus === filterWrap.value : true;
    const matchQuery = query
      ? [gift.giftName, gift.recipient, gift.location, gift.notes]
          .some((field) => (field || "").toLowerCase().includes(query))
      : true;

    return matchRecipient && matchLocation && matchPurchase && matchDelivery && matchWrap && matchQuery;
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
  populateFormSelect(recipientSelect, recipientsSet, "-- Sélectionner un nom --");
  populateFormSelect(locationSelect, locationsSet, "-- Sélectionner un lieu --");
  renderTagList(recipientTagList, state.recipients, "recipients");
  renderTagList(locationTagList, state.locations, "locations");
}

function populateFormSelect(select, items, placeholder) {
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = placeholder;
  select.appendChild(defaultOption);

  Array.from(items)
    .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }))
    .forEach((item) => {
      const option = document.createElement("option");
      option.value = item;
      option.textContent = item;
      select.appendChild(option);
    });

  if (currentValue && Array.from(items).includes(currentValue)) {
    select.value = currentValue;
  }
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
    const hasGifts = state.gifts.length > 0;
    const empty = document.createElement("div");
    empty.className = "card empty-state";
    if (hasGifts) {
      empty.innerHTML = `
        <p class="empty-emoji" aria-hidden="true">🔍</p>
        <p class="label">Aucun cadeau ne correspond.</p>
        <p class="muted">Aucun résultat pour ces filtres ou cette recherche.</p>
        <button class="ghost-btn" id="emptyClear">Réinitialiser les filtres</button>
      `;
      giftListEl.appendChild(empty);
      document.getElementById("emptyClear").addEventListener("click", () => {
        document.getElementById("clearFiltersBtn").click();
      });
    } else {
      empty.innerHTML = `
        <p class="empty-emoji" aria-hidden="true">🎁</p>
        <p class="label">Votre liste est vide.</p>
        <p class="muted">Ajoutez votre premier cadeau ou importez une sauvegarde.</p>
        <button class="primary-btn" id="emptyCreate">+ Ajouter un cadeau</button>
      `;
      giftListEl.appendChild(empty);
      document.getElementById("emptyCreate").addEventListener("click", () => switchPanel("formPanel"));
    }
    return;
  }

  if (grouped) {
    giftListEl.classList.add("grouped");
    grouped.forEach((group) => {
      const wrapper = document.createElement("div");
      wrapper.className = "gift-group";
      wrapper.innerHTML = `
        <div class="gift-group-header">
          <h3>${escapeHtml(group.label) || "—"}</h3>
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

  const safeLink = sanitizeUrl(gift.link);
  const linkBlock = safeLink
    ? `<a class="gift-link" href="${escapeHtml(safeLink)}" target="_blank" rel="noopener noreferrer">🔗 Voir le lien</a>`
    : "";

  const notesBlock = gift.notes
    ? `<p class="gift-notes">${escapeHtml(gift.notes)}</p>`
    : "";

  const safeId = escapeHtml(gift.id);

  card.innerHTML = `
    <div class="header">
      <div>
        <div class="title">${escapeHtml(gift.giftName)}</div>
        <div class="meta">
          <span>${escapeHtml(gift.recipient)}</span>
          <span>•</span>
          <span>${escapeHtml(gift.location)}</span>
          <span>•</span>
          <strong>${escapeHtml(price)}</strong>
        </div>
      </div>
      <div class="gift-actions">
        <button class="ghost-btn icon-btn" data-action="edit" data-id="${safeId}" aria-label="Modifier « ${escapeHtml(gift.giftName)} »">
          <span class="btn-icon" aria-hidden="true">&#9998;</span>
        </button>
        <button class="ghost-btn icon-btn" data-action="delete" data-id="${safeId}" aria-label="Supprimer « ${escapeHtml(gift.giftName)} »">
          <span class="btn-icon" aria-hidden="true">&#128465;</span>
        </button>
      </div>
    </div>
    <div class="badges">${badges}</div>
    <div class="gift-progress" aria-label="Avancement : ${progress}%">
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
  const index = state.gifts.findIndex((gift) => gift.id === id);
  if (index === -1) return;
  const [removed] = state.gifts.splice(index, 1);
  persist();
  renderFilters();
  renderManagedLists();
  renderGiftList();
  renderDashboard();
  showMessage("Cadeau supprimé.", {
    label: "Annuler",
    onClick: () => {
      const at = Math.min(index, state.gifts.length);
      state.gifts.splice(at, 0, removed);
      syncListsWithGift(removed);
      persist();
      renderFilters();
      renderManagedLists();
      renderGiftList();
      renderDashboard();
      showMessage("Suppression annulée.");
    },
  });
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
  const noDeliveryNeeded = list.filter((gift) => gift.deliveryStatus === "na");
  const wrapped = list.filter((gift) => gift.wrapStatus === "wrapped");

  const totalSpent = purchased.reduce((sum, gift) => sum + (Number.isFinite(gift.price) ? gift.price : 0), 0);

  const totalCount = list.length;
  const deliveryDenominator = totalCount - noDeliveryNeeded.length;
  const purchasePct = totalCount ? Math.round((purchased.length / totalCount) * 100) : 0;
  const deliveryPct = deliveryDenominator > 0 ? Math.round((delivered.length / deliveryDenominator) * 100) : 0;
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

  // Si aucune livraison n'est requise (tous "Aucun besoin"), exclure ce critère du calcul global
  const overallPct = totalCount
    ? deliveryDenominator > 0
      ? Math.round((purchasePct + deliveryPct + wrapPct) / 3)
      : Math.round((purchasePct + wrapPct) / 2)
    : 0;

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

// Expose getCurrentStats for theme updates
window.getCurrentStats = function () {
  return computeStats(state.gifts);
};

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

  lastFocusedElement = document.activeElement;
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
  const resolve = confirmResolver;
  confirmResolver = null;
  restoreFocus();
  resolve(result);
}

/** Renvoie la modale actuellement ouverte, le cas échéant. */
function getOpenModal() {
  if (confirmDialog?.classList.contains("show")) return confirmDialog;
  if (themeDialog?.classList.contains("show")) return themeDialog;
  return null;
}

/** Rend le focus à l'élément qui a ouvert la modale (s'il existe encore). */
function restoreFocus() {
  if (lastFocusedElement && document.contains(lastFocusedElement) && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }
  lastFocusedElement = null;
}

/** Piège le focus (Tab / Shift+Tab) à l'intérieur de la modale ouverte. */
function handleModalFocusTrap(event) {
  if (event.key !== "Tab") return;
  const modal = getOpenModal();
  if (!modal) return;
  const focusables = Array.from(
    modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
  ).filter((el) => !el.disabled && el.offsetParent !== null);
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

// Theme Dialog Functions
function renderThemeGrid() {
  if (!themeGrid) return;
  themeGrid.innerHTML = "";

  ThemeManager.listThemes().forEach((theme) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `theme-card${theme.id === ThemeManager.currentThemeId ? " active" : ""}`;
    card.dataset.themeId = theme.id;
    card.innerHTML = `
      <span class="theme-card-emoji">${theme.emoji}</span>
      <span class="theme-card-name">${theme.label}</span>
      <div class="theme-swatches">
        <span class="theme-swatch" style="background:${theme.palette.primary}"></span>
        <span class="theme-swatch" style="background:${theme.palette.accent}"></span>
        <span class="theme-swatch" style="background:${theme.palette.secondary}"></span>
      </div>
    `;
    themeGrid.appendChild(card);
  });
}

function openThemeDialog() {
  lastFocusedElement = document.activeElement;
  renderThemeGrid();
  themeDialog?.classList.add("show");
  (themeGrid?.querySelector(".theme-card.active") || themeGrid?.querySelector(".theme-card"))?.focus();
}

function closeThemeDialog() {
  if (!themeDialog?.classList.contains("show")) return;
  themeDialog.classList.remove("show");
  restoreFocus();
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
  tabs.forEach((tab) => {
    tab.classList.remove("active");
    tab.setAttribute("aria-selected", "false");
  });

  document.getElementById(targetId)?.classList.add("active");
  const tab = Array.from(tabs).find((t) => t.dataset.target === targetId);
  if (tab) {
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
  }
}

function showMessage(text, action) {
  if (!snackbar) return;
  clearTimeout(snackbarTimer);
  snackbar.innerHTML = "";

  const msg = document.createElement("span");
  msg.className = "snackbar-text";
  msg.textContent = text;
  snackbar.appendChild(msg);

  const hasAction = action && action.label && typeof action.onClick === "function";
  if (hasAction) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "snackbar-action";
    btn.textContent = action.label;
    btn.addEventListener("click", () => {
      hideSnackbar();
      action.onClick();
    });
    snackbar.appendChild(btn);
  }

  snackbar.classList.add("show");
  snackbarTimer = setTimeout(hideSnackbar, hasAction ? 6000 : 2400);
}

function hideSnackbar() {
  clearTimeout(snackbarTimer);
  snackbar?.classList.remove("show");
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

/** Clé de déduplication : même destinataire + lieu + cadeau (insensible à la casse). */
function giftKey(gift) {
  return `${gift.recipient}|${gift.location}|${gift.giftName}`.toLowerCase();
}

/**
 * Importe un tableau de cadeaux bruts (validés/normalisés). Déduplique par
 * défaut et n'écrase jamais les données existantes (fusion additive sûre).
 */
function importGiftsArray(rawGifts, { dedupe = true } = {}) {
  if (!Array.isArray(rawGifts)) return { imported: 0, skipped: 0 };
  const existing = new Set(state.gifts.map(giftKey));
  let imported = 0;
  let skipped = 0;

  rawGifts.forEach((raw) => {
    const gift = normalizeGift(raw);
    if (!gift) {
      skipped += 1;
      return;
    }
    if (dedupe && existing.has(giftKey(gift))) {
      skipped += 1;
      return;
    }
    existing.add(giftKey(gift));
    gift.id = createId(); // évite toute collision d'id
    state.gifts.unshift(gift);
    syncListsWithGift(gift);
    imported += 1;
  });

  if (imported) {
    persist();
    renderFilters();
    renderManagedLists();
    renderGiftList();
    renderDashboard();
  }
  return { imported, skipped };
}

/** Import CSV/TSV (colonnes recipient,location,giftName,price,purchase,delivery,wrap). */
function importGiftData(rawText) {
  if (!rawText || typeof rawText !== "string") return { imported: 0, skipped: 0 };
  const rows = rawText.trim().split(/\r?\n/);
  if (rows.length <= 1) {
    showMessage("Fichier vide ou sans données.");
    return { imported: 0, skipped: 0 };
  }

  const rawGifts = rows.slice(1).map((row) => {
    const cells = splitRow(row);
    if (cells.length < 7) return null;
    const [recipient, location, giftName, priceRaw, purchaseRaw, deliveryRaw, wrapRaw] = cells;
    return {
      recipient: recipient.trim(),
      location: location.trim(),
      giftName: giftName.trim(),
      price: parsePrice(priceRaw),
      purchaseStatus: normalizePurchase(purchaseRaw),
      deliveryStatus: normalizeDelivery(deliveryRaw),
      wrapStatus: normalizeWrap(wrapRaw),
    };
  }).filter(Boolean);

  const result = importGiftsArray(rawGifts);
  announceImport(result);
  return result;
}

/** Import d'une sauvegarde JSON (format app ou tableau brut de cadeaux). */
function importJsonData(rawText) {
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    showMessage("Fichier JSON invalide.");
    return { imported: 0, skipped: 0 };
  }

  const rawGifts = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray(parsed.gifts)
    ? parsed.gifts
    : null;

  if (!rawGifts) {
    showMessage("Aucun cadeau trouvé dans le fichier.");
    return { imported: 0, skipped: 0 };
  }

  // Fusionner aussi les listes maîtres si présentes.
  if (parsed && !Array.isArray(parsed)) {
    mergeMasterLists(parsed.recipients, "recipients");
    mergeMasterLists(parsed.locations, "locations");
  }

  const result = importGiftsArray(rawGifts);
  announceImport(result);
  return result;
}

function mergeMasterLists(items, type) {
  if (!Array.isArray(items)) return;
  const list = state[type];
  items.forEach((value) => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (trimmed && !list.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      list.push(trimmed);
    }
  });
  persistMeta();
}

function announceImport({ imported, skipped }) {
  if (!imported && !skipped) return;
  if (!imported) {
    showMessage(`Aucun nouveau cadeau (${skipped} ignoré·s).`);
  } else {
    showMessage(`${imported} cadeau·x importé·s${skipped ? `, ${skipped} ignoré·s` : ""}.`);
  }
}

/** Lit un fichier importé et route vers l'import JSON ou CSV. */
function handleImportFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || "");
    const name = (file.name || "").toLowerCase();
    const looksJson = name.endsWith(".json") || /^\s*[[{]/.test(text);
    if (looksJson) {
      importJsonData(text);
    } else {
      importGiftData(text);
    }
  };
  reader.onerror = () => showMessage("Lecture du fichier impossible.");
  reader.readAsText(file);
}

/** Exporte une sauvegarde JSON complète (téléchargement local). */
function exportData() {
  const payload = {
    app: "atelier-noel",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    gifts: state.gifts,
    recipients: state.recipients,
    locations: state.locations,
  };
  try {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cadeaux-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showMessage("Sauvegarde exportée.");
  } catch (e) {
    console.error("Export impossible", e);
    showMessage("Export impossible sur cet appareil.");
  }
}

/** Construit un résumé lisible de la liste pour le partage. */
function buildShareSummary() {
  const stats = computeStats(state.gifts);
  const theme = ThemeManager.getCurrentTheme();
  const lines = [];
  lines.push(`${theme?.emoji || "🎁"} ${theme?.title || "Liste de cadeaux"}`);
  lines.push(`${stats.totalCount} cadeau·x • ${stats.purchasePct}% achetés • ${formatCurrency(stats.totalSpent)} dépensés`);
  lines.push("");

  const byRecipient = {};
  state.gifts.forEach((gift) => {
    (byRecipient[gift.recipient] = byRecipient[gift.recipient] || []).push(gift);
  });
  Object.keys(byRecipient)
    .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }))
    .forEach((recipient) => {
      lines.push(`${recipient} :`);
      byRecipient[recipient].forEach((gift) => {
        const check = gift.purchaseStatus === "bought" ? "✅" : "⬜";
        lines.push(`  ${check} ${gift.giftName}`);
      });
    });
  return lines.join("\n");
}

/** Partage le résumé via l'API Web Share, sinon copie dans le presse-papier. */
async function shareSummary() {
  if (!state.gifts.length) {
    showMessage("Aucun cadeau à partager.");
    return;
  }
  const text = buildShareSummary();
  try {
    if (navigator.share) {
      await navigator.share({ title: "Ma liste de cadeaux", text });
      return;
    }
  } catch (e) {
    if (e && e.name === "AbortError") return; // annulé par l'utilisateur
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      showMessage("Résumé copié dans le presse-papier.");
      return;
    }
  } catch (e) {
    /* fallback ci-dessous */
  }
  showMessage("Partage non disponible sur cet appareil.");
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
window.importJsonData = importJsonData;
window.exportData = exportData;
