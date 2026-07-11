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
  - 🔗 **Partager par lien** : vos proches ouvrent la liste en lecture seule
    dans leur navigateur (les données voyagent compressées dans le lien,
    jamais sur un serveur) et peuvent la fusionner dans leur propre
    application — pratique pour se coordonner et éviter les cadeaux en double.
  - 📤 **Partager un résumé** lisible (via le partage natif du téléphone ou le
    presse-papier).
  - 💾 **Exporter** une sauvegarde JSON complète.
  - 📥 **Importer** une sauvegarde JSON ou un fichier CSV/TSV (fusion sans
    doublon, aucune donnée écrasée ; champs entre guillemets et prix français
    « 39,90 » acceptés).
- **Anti-doublon** : alerte si un cadeau identique existe déjà pour la même
  personne ; bouton « Dupliquer » pour réutiliser un cadeau comme modèle.
- **Annulation de suppression** (bouton « Annuler » après un retrait).
- **Hors-ligne & 100 % autonome** : installable en PWA, aucune ressource
  externe (Chart.js et la police sont embarqués), fonctionne sans connexion
  après la première visite et se met à jour automatiquement au chargement
  suivant.
- **Multi-onglets** : les modifications faites dans un onglet apparaissent
  dans les autres (pas d'écrasement croisé).
- **Responsive & accessible** : optimisée mobile (filtres repliables) et
  ordinateur, navigation clavier, focus piégé dans les fenêtres, respect de
  « animations réduites ».

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

Aucune donnée n'est envoyée à un serveur et aucune ressource externe n'est
chargée (Chart.js et la police Space Grotesk sont servis localement depuis
`vendor/`). Le partage par lien encode les données dans le fragment d'URL
(`#s=…`), qui n'est jamais transmis au serveur web. Les liens de produits sont
assainis (seuls `http`/`https` sont autorisés).

## 🗂️ Structure

| Fichier | Rôle |
| --- | --- |
| `index.html` | Structure de l'interface |
| `style.css` | Thèmes et mise en page |
| `app.js` | Logique, stockage, import/export, accessibilité |
| `charts.js` | Graphiques du tableau de bord |
| `service-worker.js` | Cache hors-ligne (PWA, stale-while-revalidate) |
| `manifest.json` | Métadonnées PWA |
| `vendor/` | Dépendances embarquées : Chart.js 4.5.1, police Space Grotesk |

## 🎨 Ajouter un thème

Voir `BRIEFING.md` (section « Ajouter un nouveau thème »).
