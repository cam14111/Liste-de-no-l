# 🎄 Atelier Noël — Suivi des cadeaux

Application web (PWA) pour organiser les achats de cadeaux : suivi des achats,
livraisons, emballages et budget. **100 % local, sans compte ni serveur** : vos
données restent dans le navigateur (`localStorage`).

## ✨ Fonctionnalités

- **Liste de cadeaux** avec statuts cliquables (achat / livraison / emballage) et
  barre d'avancement par cadeau et globale.
- **Recherche** instantanée (cadeau, nom, lieu, notes) + filtres et tri.
- **Formulaire** d'ajout / modification, avec listes maîtres de noms et lieux.
- **Tableau de bord** : budget prévu / dépensé, pourcentages, et graphiques
  (Chart.js) coûts par personne et cadeaux par lieu.
- **6 thèmes** (Noël, Saint-Valentin, Anniversaire, etc.) avec fonds animés.
- **Sauvegarde & partage** :
  - 💾 **Exporter** une sauvegarde JSON complète.
  - 📥 **Importer** une sauvegarde JSON ou un fichier CSV/TSV (fusion sans
    doublon, aucune donnée écrasée).
  - 📤 **Partager** un résumé lisible de la liste (via le partage natif du
    téléphone ou le presse-papier).
- **Annulation de suppression** (bouton « Annuler » après un retrait).
- **Hors-ligne** : installable en PWA, fonctionne sans connexion après la
  première visite (service worker).
- **Responsive & accessible** : optimisée mobile et ordinateur, navigation
  clavier, focus piégé dans les fenêtres, respect de « animations réduites ».

## 🚀 Lancer en local

Aucune installation ni build. Servez le dossier avec n'importe quel serveur
statique (le service worker nécessite `http`/`https`) :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## 💾 Sauvegarde & restauration des données

Les données vivent uniquement dans le navigateur. Pour ne rien perdre :

1. **Sauvegarder** : bouton 💾 → un fichier `cadeaux-AAAA-MM-JJ.json` est
   téléchargé. Conservez-le (cloud, email…).
2. **Restaurer / changer d'appareil** : bouton 📥 → sélectionnez le fichier JSON.
   L'import **fusionne** sans créer de doublon (clé : nom + lieu + cadeau).

En cas de données corrompues, l'application crée automatiquement une copie de
secours dans `localStorage` (`xmas-gifts-v1-corrupted-…` ou `-backup-…`) au lieu
de les effacer.

## 🔐 Confidentialité

Aucune donnée n'est envoyée à un serveur. Seule ressource externe : la
bibliothèque Chart.js (CDN), mise en cache pour l'usage hors-ligne. Les liens de
produits sont assainis (seuls `http`/`https` sont autorisés).

## 🗂️ Structure

| Fichier | Rôle |
| --- | --- |
| `index.html` | Structure de l'interface |
| `style.css` | Thèmes et mise en page |
| `app.js` | Logique, stockage, import/export, accessibilité |
| `charts.js` | Graphiques du tableau de bord |
| `service-worker.js` | Cache hors-ligne (PWA) |
| `manifest.json` | Métadonnées PWA |

## 🎨 Ajouter un thème

Voir `BRIEFING.md` (section « Ajouter un nouveau thème »).
