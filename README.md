# Outil de calcul du temps de travail EPLE

Prototype d'application web développé en HTML, CSS et JavaScript permettant de calculer, suivre et analyser le temps de travail annuel des personnels exerçant en EPLE (Établissements Publics Locaux d'Enseignement).

## Présentation

Cet outil a été conçu pour faciliter le suivi du temps de travail des agents sur l'année scolaire 2026-2027.

Il permet de calculer automatiquement les obligations de service, de suivre les heures effectuées semaine par semaine, de prendre en compte les heures supplémentaires et les récupérations, puis de générer un bilan annuel complet exportable au format PDF.

## Fonctionnalités

### Quotité de travail

* Calcul automatique du volume annuel à effectuer en fonction de la quotité de travail.
* Gestion des quotités de 40 % à 100 %.

### Horaires hebdomadaires

* Calculateur d'horaires hebdomadaires.
* Calcul automatique des temps de travail journaliers et hebdomadaires.
* Prise en compte des pauses de 20 minutes comptabilisées comme temps de travail effectif.
* Report automatique du total hebdomadaire.

### Tableau annuel des semaines

* Tableau complet des semaines de l'année scolaire 2026-2027.
* Identification visuelle des semaines de vacances scolaires.
* Pré-remplissage automatique des semaines travaillées.
* Saisie des heures hebdomadaires.
* Gestion des heures supplémentaires.
* Gestion des heures récupérées.
* Ajout de commentaires personnalisés.

### Bilan annuel

* Calcul en temps réel :

  * des heures effectuées hors vacances scolaires ;
  * des heures effectuées pendant les vacances scolaires ;
  * des heures supplémentaires ;
  * des heures récupérées ;
  * du total général ;
  * de l'écart entre le temps dû et le temps effectué.

### Export PDF

Génération automatique d'un document récapitulatif comprenant :

* Les informations de l'agent ;
* Les horaires hebdomadaires ;
* Le tableau annuel des semaines ;
* Le bilan annuel ;
* Un bloc de signatures.

### Sauvegarde automatique

Toutes les données sont enregistrées automatiquement dans le navigateur grâce au LocalStorage.

Aucune saisie n'est perdue lors de la fermeture ou du rechargement de la page.

### Documentation intégrée

* Guide d'utilisation complet directement accessible dans l'application.
* Rappel des principales références réglementaires relatives au temps de travail en EPLE.

## Technologies utilisées

* HTML5
* CSS3
* JavaScript (Vanilla JS)
* jsPDF
* jsPDF AutoTable

## Public concerné

Cet outil s'adresse principalement :

* aux gestionnaires d'EPLE ;
* aux secrétaires généraux d'EPLE ;
* aux personnels administratifs ;
* aux collectivités territoriales ;
* aux agents souhaitant suivre leur temps de travail annuel.

## Utilisation

1. Télécharger ou cloner le dépôt.
2. Ouvrir le fichier `index.html` dans un navigateur web moderne.
3. Renseigner les différents onglets dans l'ordre proposé.

Aucune installation ni serveur web ne sont nécessaires.

## État du projet

> Ce projet est actuellement proposé comme prototype fonctionnel et peut encore évoluer en fonction des besoins exprimés par les utilisateurs.

## Licence

Ce projet est distribué sous licence MIT.
