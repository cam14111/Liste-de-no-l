# Brief IA dev

- **Stack** : page statique `index.html` + `style.css` + `app.js` + `charts.js`; aucun build; **aucune ressource externe** : Chart.js 4.5.1 et la police Space Grotesk (woff2, OFL) sont embarqués dans `vendor/`; stockage 100% localStorage; PWA (`manifest.json` + `service-worker.js` avec pre-cache des assets, **stale-while-revalidate** same-origin — les mises à jour sont récupérées en arrière-plan et servies au chargement suivant, network+cache pour l'externe). Incrementer `CACHE_NAME` quand la liste de precache change.
- **Modele de donnees** : cadeau = `{id, recipient, location, giftName, price:number, purchaseStatus:("to_buy"|"bought"), deliveryStatus:("none"|"transit"|"delivered"|"na"), wrapStatus:("not_wrapped"|"wrapped"), link?, notes?, createdAt, updatedAt}`. Meta separee `recipients`, `locations` (STORAGE_META_KEY). Seed de 3 cadeaux au premier chargement.
- **Layout** : en-tete fixe (brand + tabs Liste/Formulaire/Dashboard). Trois panneaux `listPanel`, `formPanel`, `dashboardPanel`; bouton `+ Ajouter` bascule vers le formulaire; tabs avec aria et active state.
- **Liste + filtres** : filtres par nom/lieu/achat/livraison/emballage + tri (progression desc, nom asc, lieu asc); bouton reset filtres. Si tri par nom/lieu => regroupement avec header + compteur. Etat vide: message + CTA vers formulaire. Cartes rendues depuis `renderGiftList`.
- **Carte cadeau** : titre = giftName; meta = recipient + location + prix EUR (ou "-"). Badges statuts clic/Enter/Espace pour cycler. Progression: achat 60 pts; livraison transit +15, delivered/na +30; emballage wrapped +10; clamp 0-100; carte `completed` si 100%. Actions edit/delete (delete via modal de confirmation).
- **Formulaire** : champs requis recipient/location/giftName; valeurs par defaut to_buy/none/not_wrapped. Submit valide, sync listes (ajout si nouveau, insensible casse), ajoute ou met a jour l'entree, persiste, rerend filtres/listes/dashboard, reset et retourne a Liste. Reset bouton remet defauts + snackbar.
- **Listes maitre** : bloc ajout/suppression recipients/locations; dedoublonne insensible a la casse; suppression met a jour selects/filters sans toucher aux cadeaux existants.
- **Stats + dashboard** : `computeStats` calcule total planifie (somme prix), depenses (seulement bought), difference, % achat/livraison/emballage (arrondis), overall = moyenne des trois, `costPerRecipient`, `recipientLocationCounts`. Dashboard affiche totaux + pourcentages + barre d'avancement globale.
- **Graphiques Chart.js** : 1) doughnut achats (achetés vs a acheter, gere cas 0). 2) barres cout par destinataire, tri par nom ou montant (select). 3) barres empilees cadeaux par destinataire, stack par lieu, tri par nom ou total; plugin interne value labels dans les barres.
- **Import** : `window.importGiftData(text)` prend TSV/CSV (saute header), colonnes `recipient,location,giftName[,price,purchase,delivery,wrap]` (3 premieres requises); `splitRow` conserve les cellules vides et gere les champs entre guillemets (`""` echappe); `parsePrice` tolere "39,90", "1 234,56", "1,234.56". `window.importJsonData(text)` importe une sauvegarde JSON (format app `{gifts,recipients,locations}` ou tableau brut). Les deux passent par `importGiftsArray` qui **valide/normalise** chaque cadeau (`normalizeGift`) et **dedoublonne** (cle `recipient|location|giftName`, insensible casse). L'UI expose Export/Import/Partage via `handleImportFile` (route JSON vs CSV).
- **Export / Partage** : `exportData()` telecharge `cadeaux-AAAA-MM-JJ.json` (app, schemaVersion, exportedAt, gifts, recipients, locations). Bouton partage ouvre `shareDialog` : `shareByLink()` (lien interactif) ou `shareSummary()` (resume texte, Web Share sinon presse-papier).
- **Partage par lien** : `buildShareLink()` serialise `{v,gifts,recipients,locations}` en JSON compresse deflate-raw (`CompressionStream`, prefixe "1.", repli base64 "0.") en base64url dans `#s=…`. A l'ouverture, `maybeEnterSharedModeFromHash()` decode et bascule en **mode partage** (`sharedMode`) : etat remplace en memoire (lecture seule), `persist`/`persistMeta` neutralises, actions masquees via `body.shared-mode`, badges non interactifs, banniere `#sharedBanner` avec « Ajouter a ma liste » (fusion dedoublonnee via `importGiftsArray`) et « Voir ma liste » (`exitSharedMode()` recharge le localStorage). Lien invalide → message + hash nettoye. Limite ~30 000 caracteres (au-dela : message conseillant l'export JSON).
- **Anti-doublon / duplication** : a la creation, si `giftKey` existe deja → modale de confirmation (« Ajouter quand meme »). Bouton « Dupliquer » sur chaque carte pre-remplit le formulaire en mode creation (statuts remis a zero).
- **Multi-onglets** : listener `storage` → `reloadStateFromStorage()` re-rend l'etat si un autre onglet ecrit (ignore en mode partage).
- **Securite / robustesse** : tout contenu utilisateur rendu via innerHTML est echappe (`escapeHtml`); liens assainis (`sanitizeUrl`, http(s) absolu uniquement). Acces localStorage via wrapper `storage` tolerant (mode prive, quota). Chargement robuste : `JSON.parse` protege, schema normalise, copie de secours si donnees illisibles ou enregistrements ecartes (jamais de perte silencieuse).
- **Accessibilite** : recherche (`#searchInput`) filtrant nom/lieu/notes; focus piege dans les modales (`handleModalFocusTrap`) + restauration du focus; `aria-selected` sur les tabs; snackbar avec action (annulation de suppression); respect `prefers-reduced-motion`; modales retirees du flux tab (`visibility:hidden`).
- **UX/UI** : theme sombre sapin (#061a1d/#0f3d3e, accent #73ffc6/#ff7a6a, Space Grotesk), background degrade + cartes glassmorphism. Grilles responsives (cadeaux 3 cols, puis 2 <640px, 1 <520px). Snackbar bas-centre; modal overlay closable (clic exterieur/Escape). Badges focus-visible.
- **Systeme de themes** : 6 themes disponibles (noel, valentine, birthday, meeting_anniversary, wedding_anniversary, neutral). Bouton palette dans header ouvre modal de selection. Theme persiste dans localStorage (`appThemeId`). Application via CSS variables `--color-*`. Chaque theme definit: `id`, `label`, `emoji`, `title` (titre header), `subtitle` (sous-titre header), `palette` (primary, secondary, accent, bg, surface, text, mutedText, border, onPrimary), `pattern` (motif de fond optionnel), `isDark` (boolean). Le titre et sous-titre du header changent dynamiquement selon le theme selectionne.

## Ajouter un nouveau theme

1. Dans `app.js`, ajouter une entree dans l'objet `THEMES` :
   ```js
   mon_theme: {
     id: "mon_theme",
     label: "Mon Theme",
     emoji: "🎉",
     title: "Mon Titre",
     subtitle: "Mon sous-titre",
     palette: {
       primary: "#...", secondary: "#...", accent: "#...",
       bg: "#...", surface: "#...", text: "#...",
       mutedText: "#...", border: "#...", onPrimary: "#..."
     },
     pattern: "none", // ou "hearts", "confetti", "stars", "snowflakes", "monogram"
     isDark: false // true si fond sombre
   }
   ```

2. (Optionnel) Si nouveau pattern, ajouter dans `style.css` :
   ```css
   [data-theme-pattern="mon_pattern"] body::before {
     content: "";
     position: fixed; inset: 0; z-index: -1;
     opacity: 0.03; pointer-events: none;
     background-image: url("data:image/svg+xml,...");
     background-size: 60px 60px;
   }
   ```

3. Incrementer `CACHE_NAME` dans `service-worker.js`.
