# Mode d'emploi — Outil de calcul du temps de travail EPLE

---

## Présentation générale

Cet outil permet aux agents administratifs et ITRF des EPLE de calculer et de suivre leur temps de travail annuel. Il est organisé en **7 onglets**, dont **4 onglets fonctionnels à renseigner dans l'ordre** :

- **Mode d'emploi** : ce guide.
- **Quotité de travail** : saisie des informations de l'agent et configuration du calendrier.
- **Horaires hors vacances** : définition des horaires hebdomadaires types.
- **Tableau des semaines** : saisie détaillée du temps de travail par semaine.
- **Résultats & Export** : récapitulatif, progression annuelle et exports.
- **Informations réglementaires** : rappel des principaux textes et règles applicables.
- **Contact** : formulaire permettant de contacter le développeur.

> **Bon à savoir :** toutes vos saisies sont automatiquement sauvegardées dans votre navigateur. Vous pouvez fermer puis rouvrir la page sans perdre vos données.

---

## Onglet 1 — Informations de l'agent, quotité et configuration du calendrier

Renseignez les informations suivantes :

- **Nom, prénom et poste occupé par l'agent** : ces informations sont automatiquement reportées dans les documents exportés concernés.
- **Année scolaire** : sélectionnez l'année à utiliser pour générer le tableau annuel.
- **Zone académique** : choisissez la zone A, B ou C afin d'adapter les périodes de vacances scolaires.
- **Quotité de travail** : sélectionnez le pourcentage correspondant à la situation de l'agent (100 %, 90 %, 80 %, etc.).

Le champ **« Heures à effectuer »** se calcule automatiquement en fonction de la quotité choisie.

Exemple : un agent à 80 % doit effectuer **1 274,40 h** dans l'année, hors fractionnement.

Le bouton **« Réinitialiser les informations de l'agent »** permet de remettre à zéro les informations de cet onglet, notamment le nom, le prénom, le poste, la quotité, la zone académique et l'année scolaire.

---

## Onglet 2 — Horaires hors vacances

Cet onglet permet de définir les horaires habituels de l'agent pendant les semaines travaillées hors vacances scolaires.

### 1. Calculateur hebdomadaire

Saisissez les horaires de début et de fin pour chaque demi-journée, au format **HH:MM**.

- Les champs vides sont considérés comme des périodes non travaillées.
- Les durées du matin, de l'après-midi et de la journée se calculent automatiquement.
- Le total hebdomadaire s'affiche en bas du tableau.
- Le bouton **« Dupliquer »** permet de copier les horaires d'un jour vers un ou plusieurs autres jours de la semaine.

### 2. Pauses de 20 minutes

Si l'agent bénéficie de pauses de 20 minutes comptabilisées comme temps de travail effectif, indiquez leur nombre hebdomadaire dans le champ prévu à cet effet.

| Nombre de pauses | Durée totale | Valeur décimale |
|:---:|:---:|:---:|
| 1 pause | 20 min | 0,33 h |
| 2 pauses | 40 min | 0,66 h |
| 3 pauses | 60 min | 1,00 h |

### 3. Appliquer les horaires

Une fois les horaires saisis :

1. Cliquez sur **« Copier dans le champ ci-dessous »** pour reporter le total hebdomadaire calculé dans le champ **« Heures par semaine »**.
2. Cliquez sur **« Appliquer à toutes les semaines hors vacances »** pour préremplir les semaines scolaires de l'onglet 3.
3. Utilisez **« Réinitialiser les horaires hebdomadaires »** pour effacer les horaires de cet onglet et recommencer.

---

## Onglet 3 — Tableau des semaines

Cet onglet présente les semaines de l'année scolaire sélectionnée.

- Les semaines de **vacances scolaires** apparaissent sur un fond jaune.
- Les semaines comprenant **au moins un jour férié** apparaissent sur un fond bleu clair.
- Les semaines scolaires ordinaires apparaissent sur un fond blanc.

Pour chaque semaine, les colonnes suivantes sont disponibles :

| Colonne | Description |
|---|---|
| **Heures effectuées** | Volume horaire hebdomadaire de base |
| **Heures Sup** | Heures supplémentaires effectuées |
| **Heures Récup** | Heures récupérées ou déduites du total |
| **Commentaires** | Observations ou informations complémentaires |

Les valeurs peuvent être ajustées directement pour les semaines atypiques : formation, absence, semaine raccourcie, travail pendant les vacances, récupération, etc.

Le bouton **« Réinitialiser le tableau annuel »** efface les saisies manuelles du tableau. Les horaires types définis dans l'onglet 2 restent disponibles pour les semaines scolaires.

---

## Onglet 4 — Résultats & Export

Cet onglet présente le bilan annuel, mis à jour à partir des données saisies dans le tableau des semaines.

### Progression annuelle

Le bloc **« Progression annuelle »** affiche :

- le volume déjà réalisé ;
- l'objectif annuel lié à la quotité ;
- le nombre d'heures restant à effectuer ;
- ou l'excédent lorsque l'objectif est dépassé.

La barre de progression et les indicateurs sont actualisés automatiquement.

### Récapitulatif et résultats

Le tableau récapitulatif présente :

- les heures effectuées hors vacances scolaires ;
- les heures effectuées pendant les vacances ;
- les heures supplémentaires comptabilisées ;
- les heures récupérées ou déduites ;
- le total général réalisé ;
- le volume annuel de référence ;
- l'écart ou la balance annuelle.

### Export des données

- **Exporter le bilan en PDF** : génère un document récapitulatif comprenant les informations de l'agent, les horaires hebdomadaires, le tableau des semaines, le bilan annuel et les blocs de signature.
- **Exporter les horaires en PDF** : génère un document présentant les horaires hebdomadaires des semaines travaillées en présence des élèves. Ce document comprend notamment le nom et le poste de l'agent et peut servir à l'affichage.
- **Exporter en Excel** : génère le récapitulatif complet au format Excel.
- **Nouveau calcul** : réinitialise complètement l'application et efface les données enregistrées par l'outil dans le navigateur.

---

## Onglet 5 — Informations réglementaires

Cet onglet est informatif. Il rappelle notamment :

- les principaux textes de référence ;
- les règles relatives au repos et à la durée du travail ;
- la pause de 20 minutes et la pause méridienne ;
- les règles applicables aux services partagés ;
- les coefficients de valorisation de certaines heures travaillées ;
- le travail pendant les congés des élèves ;
- les règles de décompte des jours fériés.

---

## Contact

L'onglet **« Contact »** permet d'envoyer une question, une suggestion ou un signalement d'anomalie au développeur.

Les coordonnées et le message saisis dans ce formulaire sont transmis à Formspree uniquement pour acheminer la demande. Ils ne sont pas inclus dans la sauvegarde métier de l'application.

---

## Conseils pratiques

- Respectez l'ordre des onglets fonctionnels : commencez par les informations de l'agent et la quotité, puis définissez les horaires hebdomadaires avant de compléter le tableau annuel.
- Modifiez directement les semaines atypiques dans l'onglet 3 sans changer l'horaire type des autres semaines.
- Vérifiez les premières et dernières semaines lorsque l'année scolaire commence ou se termine en cours de semaine.
- Renseignez le nom, le prénom et le poste de l'agent avant de générer les documents PDF.
- Les dates des vacances scolaires des années futures seront mises à jour dès leur publication officielle par le ministère de l'Éducation nationale.
