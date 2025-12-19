# Brief IA dev

- **Stack** : page statique `index.html` + `style.css` + `app.js` + `charts.js`; aucun build; Chart.js via CDN; stockage 100% localStorage; PWA (`manifest.json` + `service-worker.js` avec pre-cache des assets + Chart.js, cache-first local, network+cache externe).
- **Modele de donnees** : cadeau = `{id, recipient, location, giftName, price:number, purchaseStatus:("to_buy"|"bought"), deliveryStatus:("none"|"transit"|"delivered"|"na"), wrapStatus:("not_wrapped"|"wrapped"), link?, notes?, createdAt, updatedAt}`. Meta separee `recipients`, `locations` (STORAGE_META_KEY). Seed de 3 cadeaux au premier chargement.
- **Layout** : en-tete fixe (brand + tabs Liste/Formulaire/Dashboard). Trois panneaux `listPanel`, `formPanel`, `dashboardPanel`; bouton `+ Ajouter` bascule vers le formulaire; tabs avec aria et active state.
- **Liste + filtres** : filtres par nom/lieu/achat/livraison/emballage + tri (progression desc, nom asc, lieu asc); bouton reset filtres. Si tri par nom/lieu => regroupement avec header + compteur. Etat vide: message + CTA vers formulaire. Cartes rendues depuis `renderGiftList`.
- **Carte cadeau** : titre = giftName; meta = recipient + location + prix EUR (ou "-"). Badges statuts clic/Enter/Espace pour cycler. Progression: achat 60 pts; livraison transit +15, delivered/na +30; emballage wrapped +10; clamp 0-100; carte `completed` si 100%. Actions edit/delete (delete via modal de confirmation).
- **Formulaire** : champs requis recipient/location/giftName; valeurs par defaut to_buy/none/not_wrapped. Submit valide, sync listes (ajout si nouveau, insensible casse), ajoute ou met a jour l'entree, persiste, rerend filtres/listes/dashboard, reset et retourne a Liste. Reset bouton remet defauts + snackbar.
- **Listes maitre** : bloc ajout/suppression recipients/locations; dedoublonne insensible a la casse; suppression met a jour selects/filters sans toucher aux cadeaux existants.
- **Stats + dashboard** : `computeStats` calcule total planifie (somme prix), depenses (seulement bought), difference, % achat/livraison/emballage (arrondis), overall = moyenne des trois, `costPerRecipient`, `recipientLocationCounts`. Dashboard affiche totaux + pourcentages + barre d'avancement globale.
- **Graphiques Chart.js** : 1) doughnut achats (achetés vs a acheter, gere cas 0). 2) barres cout par destinataire, tri par nom ou montant (select). 3) barres empilees cadeaux par destinataire, stack par lieu, tri par nom ou total; plugin interne value labels dans les barres.
- **Import** : `window.importGiftData(text)` prend TSV/CSV (saute header), colonnes `recipient,location,giftName,price,purchase,delivery,wrap`; normalise statuts FR, parse prix tolerant virgule; ajoute en tete de liste, compte importes/skippes, snackbar `N importe(s)`.
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
