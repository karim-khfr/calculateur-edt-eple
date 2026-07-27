# CHANGELOG

Toutes les modifications notables apportées au projet **TempoEPLE** seront consignées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/), et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

---

## [À venir] - Unreleased

### En réflexion / Roadmap d'évolution
* **Refonte architecturale majeure (Migration Symfony) :** 
  Une étude d'architecture est en cours pour faire évoluer l'application d'un fonctionnement client-side (`localStorage`) vers une **application web serveur complète basée sur le framework Symfony**.

  Cette transition vise à répondre aux besoins de passage à l'échelle et de gestion d'équipe :
  * **Architecture Backend & Découplage :** Passage à une architecture n-tiers structurée (API REST / Controllers Symfony) couplée à une base de données relationnelle centralisée (PostgreSQL/MySQL via Doctrine ORM).
  * **Gestion Multi-utilisateurs & Sécurité (RBAC) :** Implémentation d'un système complet d'authentification et de gestion fine des rôles (Agents, Responsables de service, Chefs d'établissement, Administrateurs).
  * **Supervision & Centralisation :** Mise en place d'un tableau de bord de suivi d'équipe en temps réel, centralisant les emplois du temps et les bilans horaires à l'échelle de l'établissement.
  * **Workflow de Validation :** Automatisation des demandes et approbations pour les régularisations d'heures et autorisations d'absence avec traçabilité complète.

---

## [1.0.0] - 2026-07-27

### Nouveautés
- **Calculateur automatique de temps de travail** pour les agents administratifs et ITRF d'EPLE.
- **Gestion dynamique du calendrier scolaire** via l'API officielle de l'Éducation Nationale (`data.education.gouv.fr`) avec repli versionné local.
- **Prise en charge des zones A, B et C** et calcul automatique du découpage des semaines scolaires.
- **Intégration dynamique des jours fériés** via l'API Étalab (`calendrier.api.gouv.fr`).
- **Calculateur d'horaires hebdomadaires** avec gestion des demi-journées, des pauses réglementaires de 20 minutes et duplication des journées.
- **Gestion des quotités de travail** (100% à 40%) avec calcul automatique du volume annuel de référence (1593h de base).
- **Indicateur visuel de progression** dans l'onglet résultats avec alertes d'objectif.
- **Exports multiples** :
  - Export PDF complet du bilan d'emploi du temps avec zone de signatures.
  - Export PDF des horaires hebdomadaires pour affichage du service.
  - Export PDF du mode d'emploi.
  - Export Excel (`.xlsx`) structuré.
- **Sauvegarde automatique** locale dans le navigateur (`localStorage`).