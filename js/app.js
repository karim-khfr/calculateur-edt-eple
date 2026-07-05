// ==========================================
// TOASTS & MODALE DE CONFIRMATION
// ==========================================

/**
 * Affiche un toast non bloquant.
 * @param {string} message  - Texte à afficher
 * @param {'succes'|'info'|'erreur'} type - Type visuel
 * @param {number} duree    - Durée en ms avant disparition (défaut 3500)
 */
function afficherToast(message, type = 'info', duree = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icones = { succes: '✅', info: 'ℹ️', erreur: '❌' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.setProperty('--toast-duree', `${duree / 1000}s`);
    toast.innerHTML = `<span class="toast-icone">${icones[type] || 'ℹ️'}</span><span>${message}</span>`;
    container.appendChild(toast);

    // Supprimer le toast après la fin de l'animation de sortie
    setTimeout(() => toast.remove(), duree + 400);
}

/**
 * Remplace confirm() par une modale non bloquante.
 * Retourne une Promise<boolean> : true si confirmé, false si annulé.
 * @param {string} message - Texte de la question
 * @param {string} labelOk - Libellé du bouton de confirmation (défaut "Confirmer")
 */
let _resolveConfirm = null;
function confirmerAsync(message, labelOk = 'Confirmer') {
    return new Promise(resolve => {
        _resolveConfirm = resolve;
        const modale = document.getElementById('modale-confirm');
        document.getElementById('modale-confirm-texte').textContent = message;
        document.getElementById('modale-confirm-ok').textContent = labelOk;
        modale.classList.remove('cache');
    });
}

function confirmerReponse(reponse) {
    const modale = document.getElementById('modale-confirm');
    modale.classList.add('cache');
    if (_resolveConfirm) {
        _resolveConfirm(reponse);
        _resolveConfirm = null;
    }
}

// ==========================================
// GESTION DES ONGLETS
// ==========================================
function changerOnglet(event, ongletId) {
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });

    const targetContent = document.getElementById(ongletId);
    if (targetContent) {
        targetContent.classList.add('active');
    }

    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }

    // Générations à la volée selon l'onglet
    if (ongletId === 'semaines') {
        genererTableauSemaines();
    } else if (ongletId === 'resultats') {
        calculerResultats();
    }
}

// ==========================================
// SAUVEGARDE LOCALE & RESTAURATION
// ==========================================
let tableauSemainesData = {};

// Debounce : évite de sérialiser le DOM à chaque frappe clavier
// La sauvegarde réelle n'a lieu que 600ms après la dernière modification
let _timerSauvegarde = null;
function sauvegarderTout() {
    clearTimeout(_timerSauvegarde);
    _timerSauvegarde = setTimeout(_executerSauvegarde, 600);
}

function _executerSauvegarde() {
    const data = {};
    document.querySelectorAll('input, textarea, select').forEach(el => {
        const key = el.id || el.name;
        if (key) data[key] = el.value;
    });

    const horairesSemaineType = [];
    document.querySelectorAll('#heuresTable tbody tr').forEach(row => {
        horairesSemaineType.push({
            dm: row.querySelector('.debut-matin').value,
            fm: row.querySelector('.fin-matin').value,
            da: row.querySelector('.debut-apm').value,
            fa: row.querySelector('.fin-apm').value
        });
    });

    data['__horairesSemaineType'] = JSON.stringify(horairesSemaineType);
    data['__tableauSemainesData'] = JSON.stringify(tableauSemainesData);

    localStorage.setItem('eple_calculateur', JSON.stringify(data));
}

// Sauvegarde immédiate (sans debounce) pour les actions critiques
// (reset, appliquerHoraires, etc.)
function sauvegarderImmediatement() {
    clearTimeout(_timerSauvegarde);
    _executerSauvegarde();
}

function restaurerSauvegarde() {
    const raw = localStorage.getItem('eple_calculateur');
    if (!raw) return;
    try {
        const data = JSON.parse(raw);
        Object.keys(data).forEach(key => {
            if (key.startsWith('__')) return;
            const el = document.getElementById(key);
            if (el) el.value = data[key];
        });

        if (data['__horairesSemaineType']) {
            const horaires = JSON.parse(data['__horairesSemaineType']);
            const rows = document.querySelectorAll('#heuresTable tbody tr');
            horaires.forEach((h, i) => {
                if (rows[i]) {
                    rows[i].querySelector('.debut-matin').value = h.dm || "";
                    rows[i].querySelector('.fin-matin').value = h.fm || "";
                    rows[i].querySelector('.debut-apm').value = h.da || "";
                    rows[i].querySelector('.fin-apm').value = h.fa || "";
                }
            });
            // Recalculer les totaux journaliers et hebdomadaires après restauration
            calculerTotalHebdo();
        }

        if (data['__tableauSemainesData']) {
            tableauSemainesData = JSON.parse(data['__tableauSemainesData']);
        }
    } catch (e) {
        console.error("Erreur de chargement LocalStorage:", e);
    }
}

function sauvegarderSemaineEnLigne(input) {
    const key = input.getAttribute('data-key');
    if (!key) return;
    if (!tableauSemainesData[key]) {
        tableauSemainesData[key] = { h: "", hs: "", hr: "", c: "" };
    }
    if (input.classList.contains('s-heures')) tableauSemainesData[key].h = input.value;
    if (input.classList.contains('s-heures-sup')) tableauSemainesData[key].hs = input.value;
    if (input.classList.contains('s-heures-recup')) tableauSemainesData[key].hr = input.value;
    if (input.classList.contains('s-comm')) tableauSemainesData[key].c = input.value;

    sauvegarderTout();
    calculerResultats();
}

// ==========================================
// GÉNÉRATION DYNAMIQUE DES ANNÉES SCOLAIRES
// ==========================================

// Génère les options du select d'année scolaire :
// - Année en cours (basée sur la date réelle)
// - 2 années précédentes
// - 2 années suivantes
// soit 5 options glissantes, toujours à jour
function genererOptionsAnneeScolaire() {
    const select = document.getElementById("anneeScolaireSelect");
    if (!select) return;

    const maintenant = new Date();
    // L'année scolaire "courante" commence en septembre :
    // si on est avant septembre, l'année scolaire en cours a démarré l'année précédente
    const anneeCoursDebut = maintenant.getMonth() >= 8
        ? maintenant.getFullYear()
        : maintenant.getFullYear() - 1;

    // Récupérer l'année éventuellement sauvegardée
    let anneeSauvegardee = null;
    try {
        const saved = JSON.parse(localStorage.getItem('eple_calculateur') || '{}');
        if (saved['anneeScolaireSelect']) anneeSauvegardee = parseInt(saved['anneeScolaireSelect']);
    } catch(e) {}

    select.innerHTML = '';

    for (let offset = -2; offset <= 2; offset++) {
        const anneeDebut = anneeCoursDebut + offset;
        const option = document.createElement('option');
        option.value = anneeDebut;
        option.textContent = `${anneeDebut}-${anneeDebut + 1}`;
        if (anneeDebut === (anneeSauvegardee || anneeCoursDebut)) {
            option.selected = true;
        }
        select.appendChild(option);
    }
}
let semaines = [];
let listeVacancesAPI = [];

function getNumeroSemaineISO(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function formaterDateVersChaine(date) {
    const j = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const a = date.getFullYear();
    return `${j}/${m}/${a}`;
}

async function chargerVacancesDepuisAPI(anneeDepart, zoneChoisie) {
    const anneeFin = anneeDepart + 1;
    const url = `https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records?where=annee_scolaire%3D%22${anneeDepart}-${anneeFin}%22%20and%20zones%3D%22Zone%20${zoneChoisie}%22&limit=100`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Erreur réseau API");
        const data = await response.json();
        listeVacancesAPI = data.results.map(record => ({
            nom: record.description || "Vacances",
            debut: new Date(record.start_date),
            fin: new Date(record.end_date)
        }));
    } catch (error) {
        console.error("Erreur API Éducation, repli local vide :", error);
        listeVacancesAPI = [];
    }
}

async function initialiserCalendrierDynamique() {
    const anneeSelect = document.getElementById("anneeScolaireSelect");
    const zoneSelect = document.getElementById("zoneScolaireSelect");
    if (!anneeSelect || !zoneSelect) return;

    const anneeDepart = parseInt(anneeSelect.value);
    const zoneChoisie = zoneSelect.value;

    // Afficher le spinner
    const spinner = document.getElementById("spinnerCalendrier");
    if (spinner) spinner.style.display = "inline-block";

    // Charger vacances scolaires ET jours fériés en parallèle
    await Promise.all([
        chargerVacancesDepuisAPI(anneeDepart, zoneChoisie),
        chargerJoursFeriesDepuisAPI(anneeDepart)
    ]);

    // Masquer le spinner
    if (spinner) spinner.style.display = "none";

    let dateCurseur = new Date(anneeDepart, 8, 1); // 1er Septembre
    const jourRentrée = dateCurseur.getDay();
    if (jourRentrée === 0) {
        dateCurseur.setDate(dateCurseur.getDate() - 6);
    } else if (jourRentrée > 1) {
        dateCurseur.setDate(dateCurseur.getDate() - (jourRentrée - 1));
    }

    const dateFinAnneeScolaire = new Date(anneeDepart + 1, 8, 1);
    semaines = [];

    while (dateCurseur < dateFinAnneeScolaire) {
        let debutSemaine = new Date(dateCurseur);
        let finSemaine = new Date(dateCurseur);
        finSemaine.setDate(finSemaine.getDate() + 5);

        semaines.push({
            num: getNumeroSemaineISO(debutSemaine),
            debut: formaterDateVersChaine(debutSemaine),
            fin: formaterDateVersChaine(finSemaine),
            dateObjetDebut: debutSemaine,
            dateObjetFin: finSemaine
        });
        dateCurseur.setDate(dateCurseur.getDate() + 7);
    }

    const titre = document.getElementById("titreOngletSemaines");
    if (titre) titre.textContent = `Tableau des semaines ${anneeDepart}-${anneeDepart + 1} (Zone ${zoneChoisie})`;
}

function estEnVacances(dateDebut, dateFin) {
    const jeudiSemaine = new Date(dateDebut);
    jeudiSemaine.setDate(jeudiSemaine.getDate() + 3);

    const moisJeudi = jeudiSemaine.getMonth();
    const jourJeudi = jeudiSemaine.getDate();

    if (moisJeudi === 7 || (moisJeudi === 6 && jourJeudi >= 4)) {
        return { enVacances: true, nom: "Vacances d'Éte" };
    }

    if (!listeVacancesAPI || listeVacancesAPI.length === 0) {
        return { enVacances: false, nom: "Hors vacances" };
    }

    const tJeudi = jeudiSemaine.getTime();

    for (const vacance of listeVacancesAPI) {
        if (tJeudi >= vacance.debut.getTime() && tJeudi <= vacance.fin.getTime()) {
            return { enVacances: true, nom: vacance.nom };
        }
    }
    return { enVacances: false, nom: "Hors vacances" };
}

// ==========================================
// JOURS FÉRIÉS FRANÇAIS (API DINUM)
// ==========================================

// Dictionnaire des jours fériés chargé depuis l'API officielle
// { "2026-05-14": "Ascension", "2027-01-01": "1er janvier", ... }
let listeJoursFeriesAPI = {};

// Charge les jours fériés pour deux années civiles (N et N+1)
// via https://calendrier.api.gouv.fr/jours-feries/metropole/{annee}.json
async function chargerJoursFeriesDepuisAPI(anneeDepart) {
    try {
        const [res1, res2] = await Promise.all([
            fetch(`https://calendrier.api.gouv.fr/jours-feries/metropole/${anneeDepart}.json`),
            fetch(`https://calendrier.api.gouv.fr/jours-feries/metropole/${anneeDepart + 1}.json`)
        ]);
        const [data1, data2] = await Promise.all([res1.json(), res2.json()]);
        // Fusionner les deux années dans un seul dictionnaire
        listeJoursFeriesAPI = { ...data1, ...data2 };
    } catch (error) {
        console.error("Erreur API jours fériés DINUM :", error);
        listeJoursFeriesAPI = {};
    }
}

// Retourne la liste des jours fériés tombant dans une semaine (lundi→samedi)
// sous la forme [{date, nom}, ...]
function getJoursFeriesDansSemaine(dateDebutSemaine, dateFinSemaine) {
    const resultats = [];
    const curseur = new Date(dateDebutSemaine);
    while (curseur <= dateFinSemaine) {
        const k = `${curseur.getFullYear()}-${String(curseur.getMonth() + 1).padStart(2, '0')}-${String(curseur.getDate()).padStart(2, '0')}`;
        if (listeJoursFeriesAPI[k]) {
            resultats.push({ date: new Date(curseur), nom: listeJoursFeriesAPI[k] });
        }
        curseur.setDate(curseur.getDate() + 1);
    }
    return resultats;
}


function genererTableauSemaines() {
    const tbody = document.getElementById("semainesTableContent");
    if (!tbody) return;
    tbody.innerHTML = "";

    const champHorsVac = document.getElementById('horaireHorsVacances');
    const valHorsVac = champHorsVac ? parseFloat(champHorsVac.value) : 0;
    let horaireTypeBaseHHMM = "00:00";

    if (valHorsVac > 0) {
        const hEntier = Math.floor(valHorsVac);
        const mMin = Math.round((valHorsVac - hEntier) * 60);
        horaireTypeBaseHHMM = `${hEntier}:${String(mMin).padStart(2, '0')}`;
    } else {
        const totalHebdoTexte = document.getElementById('totalHebdo').textContent.trim();
        if (totalHebdoTexte !== "" && totalHebdoTexte !== "0h 00") {
            horaireTypeBaseHHMM = totalHebdoTexte.replace('h ', ':').trim();
        }
    }

    // Le dictionnaire listeJoursFeriesAPI est déjà chargé par initialiserCalendrierDynamique
    const moisNomsCourt = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'];

    semaines.forEach(sem => {
        const vacInfo = estEnVacances(sem.dateObjetDebut, sem.dateObjetFin);
        const tr = document.createElement("tr");

        // Détecter les jours fériés dans la semaine
        const feriesSemaine = getJoursFeriesDansSemaine(sem.dateObjetDebut, sem.dateObjetFin);
        const aDesFeeries = feriesSemaine.length > 0;

        // Priorité couleur : vacances (jaune) > férié hors vacances (bleu pâle)
        if (vacInfo.enVacances) {
            tr.style.backgroundColor = "#fff9c4";
        } else if (aDesFeeries) {
            tr.style.backgroundColor = "#e8f4fc";
        }

        const key = `sem_${sem.num}_${sem.debut.replace(/\//g, '_')}`;
        const saved = tableauSemainesData[key] || { h: "", hs: "", hr: "", c: "" };

        let affichageHeures = saved.h;
        if (affichageHeures === "") {
            affichageHeures = vacInfo.enVacances ? "00:00" : horaireTypeBaseHHMM;
        }

        function attrSafe(val) {
            return String(val || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        // Texte des fériés (affiché uniquement hors vacances)
        const nomsFeries = feriesSemaine.map(f => {
            const j = f.date.getDate();
            const m = moisNomsCourt[f.date.getMonth()];
            return `${f.nom} (${j} ${m})`;
        }).join(', ');

        tr.innerHTML = `
            <td>
                <strong>Semaine ${sem.num}</strong><br>
                <small style="color:#555;">du ${sem.debut} au ${sem.fin}</small>
                ${aDesFeeries && !vacInfo.enVacances
                    ? `<br><small style="color:#2980b9; font-style:italic;">🔵 ${nomsFeries}</small>`
                    : ''}
            </td>
            <td><span class="badge" style="background:${vacInfo.enVacances ? '#f39c12' : '#27ae60'}; color:#fff; padding:3px 6px; border-radius:3px; font-size:11px;">${vacInfo.enVacances ? 'Vacances' : 'Scolaire'}</span></td>
            <td><input type="text" class="s-heures" data-key="${attrSafe(key)}" value="${attrSafe(affichageHeures)}" placeholder="35:00" maxlength="5" oninput="sauvegarderSemaineEnLigne(this)"></td>
            <td><input type="text" class="s-heures-sup" data-key="${attrSafe(key)}" value="${attrSafe(saved.hs || '00:00')}" placeholder="00:00" maxlength="5" oninput="sauvegarderSemaineEnLigne(this)"></td>
            <td><input type="text" class="s-heures-recup" data-key="${attrSafe(key)}" value="${attrSafe(saved.hr || '00:00')}" placeholder="00:00" maxlength="5" oninput="sauvegarderSemaineEnLigne(this)"></td>
            <td style="min-width: 250px; width: 33%;"></td>
        `;

        const tdComm = tr.querySelector('td:last-child');
        const textarea = document.createElement('textarea');
        textarea.className = 's-comm';
        textarea.setAttribute('data-key', key);
        textarea.placeholder = '...';
        textarea.style.cssText = 'width: 100% !important; box-sizing: border-box; resize: vertical; min-height: 38px; height: 38px; font-family: inherit; font-size: inherit; padding: 4px; vertical-align: middle;';
        textarea.setAttribute('oninput', 'sauvegarderSemaineEnLigne(this)');
        textarea.textContent = saved.c || '';
        tdComm.appendChild(textarea);
        tbody.appendChild(tr);
    });
}

async function changerConfigurationCalendrier() {
    await initialiserCalendrierDynamique();
    mettreAJourInfoAnneeScolaire();
    genererTableauSemaines();
    calculerResultats();
    sauvegarderImmediatement();
}

// Met à jour dynamiquement le texte informatif selon l'année sélectionnée
function mettreAJourInfoAnneeScolaire() {
    const anneeSelect = document.getElementById("anneeScolaireSelect");
    if (!anneeSelect) return;
    const annee = parseInt(anneeSelect.value);
    const anneeSuivante = annee + 1;

    // Calculer le 1er septembre de l'année de départ pour trouver le premier lundi
    const premierSept = new Date(annee, 8, 1);
    const jourSemaine = premierSept.getDay(); // 0=dim, 1=lun...
    const offsetLundi = jourSemaine === 0 ? -6 : jourSemaine === 1 ? 0 : -(jourSemaine - 1);
    const debutSemaine = new Date(premierSept);
    debutSemaine.setDate(debutSemaine.getDate() + offsetLundi);

    // Trouver le dernier vendredi avant le 1er septembre de l'année suivante
    const premierSeptSuivant = new Date(anneeSuivante, 8, 1);
    const jourSemaineSuivant = premierSeptSuivant.getDay();
    const offsetVendrediPrecedent = jourSemaineSuivant === 0 ? -2 : jourSemaineSuivant === 6 ? -1 : -(jourSemaineSuivant + 1) % 7 || -7;
    const finAnnee = new Date(premierSeptSuivant);
    finAnnee.setDate(finAnnee.getDate() + offsetVendrediPrecedent);

    const joursNoms = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const moisNoms = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

    const formatDate = d => `${joursNoms[d.getDay()]} ${d.getDate()} ${moisNoms[d.getMonth()]} ${d.getFullYear()}`;

    const texte = `Ce tableau de l'année ${annee}-${anneeSuivante} débute le <strong>${formatDate(debutSemaine)}</strong>. `
        + `Si la rentrée ne coïncide pas avec ce jour, pensez à <strong>ajuster manuellement les heures de la première semaine</strong>. `
        + `De même, <strong>vérifiez la dernière semaine</strong> si l'année scolaire se termine en cours de semaine.`;

    // Mettre à jour toutes les zones info-annee-scolaire de la page
    document.querySelectorAll('.info-annee-scolaire').forEach(el => {
        el.innerHTML = texte;
    });
}

// ==========================================
// CALCULS DES HORAIRES HEBDOMADAIRES (ONGLET 2)
// ==========================================
function parseHoraire(str) {
    if (!str) return null;
    str = String(str).trim().replace(',', '.');

    if (str.includes(':')) {
        const parts = str.split(':');
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (isNaN(h) || isNaN(m)) return null;
        return h * 60 + m;
    }

    const valeurDecimale = parseFloat(str);
    if (!isNaN(valeurDecimale)) {
        return Math.round(valeurDecimale * 60);
    }

    return null;
}

function formatMinutes(totalMin) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h ${String(m).padStart(2, '0')}`;
}

function calculerTotalHebdo() {
    let totalMinutesGeneral = 0;

    document.querySelectorAll('#heuresTable tbody tr').forEach(row => {
        const dm = row.querySelector('.debut-matin').value;
        const fm = row.querySelector('.fin-matin').value;
        const da = row.querySelector('.debut-apm').value;
        const fa = row.querySelector('.fin-apm').value;

        let minMatin = 0;
        const tDm = parseHoraire(dm);
        const tFm = parseHoraire(fm);
        if (tDm !== null && tFm !== null && tFm > tDm) minMatin = tFm - tDm;
        row.querySelector('.heures-matin').textContent = formatMinutes(minMatin);

        let minApm = 0;
        const tDa = parseHoraire(da);
        const tFa = parseHoraire(fa);
        if (tDa !== null && tFa !== null && tFa > tDa) minApm = tFa - tDa;
        row.querySelector('.heures-apm').textContent = formatMinutes(minApm);

        const totalJour = minMatin + minApm;
        row.querySelector('.total-jour').textContent = formatMinutes(totalJour);
        totalMinutesGeneral += totalJour;
    });

    const nbPauses = parseInt(document.getElementById('nbPauses').value, 10) || 0;
    totalMinutesGeneral += (nbPauses * 20);

    document.getElementById('totalHebdo').textContent = formatMinutes(totalMinutesGeneral);
    sauvegarderTout();
}

function copierTotalHebdo() {
    const textTotal = document.getElementById('totalHebdo').textContent;
    const parts = textTotal.replace('h', '').trim().split(' ');
    const h = parseInt(parts[0], 10) || 0;
    const m = parts[1] ? parseInt(parts[1], 10) : 0;
    const decimal = h + (m / 60);

    const cible = document.getElementById('horaireHorsVacances');
    if (cible) {
        cible.value = decimal.toFixed(2);
        sauvegarderTout();
        afficherToast(`Valeur copiée : ${decimal.toFixed(2)}h`, 'succes');
    }
}

function appliquerHorairesHorsVacances() {
    genererTableauSemaines();
    calculerResultats();
    sauvegarderImmediatement();
    afficherToast("Horaires appliqués à toutes les semaines scolaires.", 'succes');
}

// ==========================================
// CALCULS DES QUOTITÉS (ONGLET 1)
// ==========================================
function updateQuotiteAndResults() {
    const q = parseInt(document.getElementById("quotiteSelect").value, 10) || 100;
    const baseStandard = 1593;
    const exact = (baseStandard * q) / 100;
    const heuresEntieres = Math.floor(exact);
    const minutes = Math.round((exact - heuresEntieres) * 60);
    const affichage = minutes > 0
        ? `${heuresEntieres}h ${String(minutes).padStart(2, '0')}min`
        : `${heuresEntieres}h 00`;
    document.getElementById("heuresMaxInput").value = affichage;
    window.referenceAnnuelleExacte = exact;
    calculerResultats();
    sauvegarderTout();
}

// ==========================================
// CALCULS DES RÉSULTATS GENERAUX (ONGLET 4)
// ==========================================
function parseDecimal(str) {
    if (!str) return 0;
    const val = parseFloat(String(str).replace(',', '.'));
    return isNaN(val) ? 0 : val;
}

function formatResultatHeures(totalHeures) {
    const entier = Math.floor(totalHeures);
    const minutes = Math.round((totalHeures - entier) * 60);
    return `${entier}h ${String(minutes).padStart(2, '0')} (${totalHeures.toFixed(2)}h)`;
}

function calculerResultats() {
    let totalMinutesScolaire = 0;
    let totalMinutesVacances = 0;
    let totalMinutesSup = 0;
    let totalMinutesRecup = 0;

    const champHorsVacRes = document.getElementById('horaireHorsVacances');
    const valHorsVacRes = champHorsVacRes ? parseFloat(champHorsVacRes.value) : 0;
    let minutesTypeBase = 0;

    if (valHorsVacRes > 0) {
        minutesTypeBase = Math.round(valHorsVacRes * 60);
    } else {
        const totalHebdoTexte = document.getElementById('totalHebdo').textContent.trim();
        if (totalHebdoTexte !== "" && totalHebdoTexte !== "0h 00") {
            minutesTypeBase = parseHoraire(totalHebdoTexte.replace('h ', ':')) || 0;
        }
    }

    semaines.forEach(sem => {
        const vacInfo = estEnVacances(sem.dateObjetDebut, sem.dateObjetFin);
        const key = `sem_${sem.num}_${sem.debut.replace(/\//g, '_')}`;
        const saved = tableauSemainesData[key] || { h: "", hs: "", hr: "", c: "" };

        let m = saved.h !== "" ? (parseHoraire(saved.h) || 0) : (vacInfo.enVacances ? 0 : minutesTypeBase);
        let ms = saved.hs !== "" ? (parseHoraire(saved.hs) || 0) : 0;
        let mr = saved.hr !== "" ? (parseHoraire(saved.hr) || 0) : 0;

        if (vacInfo.enVacances) {
            totalMinutesVacances += m;
        } else {
            totalMinutesScolaire += m;
        }
        totalMinutesSup += ms;
        totalMinutesRecup += mr;
    });

    const totalScolaire = totalMinutesScolaire / 60;
    const totalVacances = totalMinutesVacances / 60;
    const totalSup = totalMinutesSup / 60;
    const totalRecup = totalMinutesRecup / 60;

    const totalGeneral = totalScolaire + totalVacances + totalSup - totalRecup;
    const q = parseInt(document.getElementById("quotiteSelect").value, 10) || 100;
    const referenceAnnuelle = window.referenceAnnuelleExacte || (1593 * q) / 100;
    const ecart = totalGeneral - referenceAnnuelle;

    document.getElementById("resScolaire").textContent = formatResultatHeures(totalScolaire);
    document.getElementById("resVacances").textContent = formatResultatHeures(totalVacances);
    document.getElementById("resSup").textContent = formatResultatHeures(totalSup);
    document.getElementById("resRecup").textContent = formatResultatHeures(totalRecup);
    document.getElementById("resTotal").textContent = formatResultatHeures(totalGeneral);
    const refH = Math.floor(referenceAnnuelle);
    const refMin = Math.round((referenceAnnuelle - refH) * 60);
    document.getElementById("resReference").textContent = refMin > 0
        ? `${refH}h ${String(refMin).padStart(2, '0')}min`
        : `${refH}h 00`;

    const elEcart = document.getElementById("resEcart");
    if (ecart >= 0) {
        elEcart.textContent = "+ " + formatResultatHeures(ecart);
        elEcart.style.color = "green";
    } else {
        elEcart.textContent = "- " + formatResultatHeures(Math.abs(ecart));
        elEcart.style.color = "red";
    }
}

// ==========================================
// DUPLICATION DES HORAIRES
// ==========================================
function dupliquerJour(bouton) {
    const rowSource = bouton.closest('tr');
    const jourSource = rowSource.cells[0].textContent.trim();
    const dm = rowSource.querySelector('.debut-matin').value;
    const fm = rowSource.querySelector('.fin-matin').value;
    const da = rowSource.querySelector('.debut-apm').value;
    const fa = rowSource.querySelector('.fin-apm').value;

    // Construire la liste des autres jours disponibles
    const tousLesJours = [];
    document.querySelectorAll('#heuresTable tbody tr').forEach(row => {
        const jour = row.cells[0].textContent.trim();
        if (jour !== jourSource) tousLesJours.push(jour);
    });

    // Créer la modale
    let modale = document.getElementById('modaleDuplication');
    if (!modale) {
        modale = document.createElement('div');
        modale.id = 'modaleDuplication';
        modale.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.45);
            display: flex; align-items: center; justify-content: center; z-index: 9999;
        `;
        document.body.appendChild(modale);
    }

    modale.innerHTML = `
        <div style="background:#fff; border-radius:8px; padding:24px; min-width:300px; box-shadow:0 4px 20px rgba(0,0,0,0.2);">
            <h3 style="margin:0 0 12px; color:#2c3e50;">Dupliquer les horaires de <em>${jourSource}</em></h3>
            <p style="margin:0 0 12px; font-size:0.9em; color:#555;">Sélectionnez les jours cibles :</p>
            <div id="checkboxJours" style="display:flex; flex-direction:column; gap:8px; margin-bottom:16px;">
                ${tousLesJours.map(j => `
                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.95em;">
                        <input type="checkbox" value="${j}" style="width:auto; margin:0;"> ${j}
                    </label>
                `).join('')}
            </div>
            <div style="display:flex; gap:8px; justify-content:flex-end;">
                <button onclick="fermerModaleDuplication()" style="background:#aaa;">Annuler</button>
                <button onclick="appliquerDuplication('${jourSource}', '${dm}', '${fm}', '${da}', '${fa}')">✔ Dupliquer</button>
            </div>
        </div>
    `;
    modale.style.display = 'flex';
}

function fermerModaleDuplication() {
    const modale = document.getElementById('modaleDuplication');
    if (modale) modale.style.display = 'none';
}

function appliquerDuplication(jourSource, dm, fm, da, fa) {
    const cases = document.querySelectorAll('#checkboxJours input[type="checkbox"]:checked');
    const joursCibles = Array.from(cases).map(cb => cb.value.toLowerCase());

    if (joursCibles.length === 0) {
        fermerModaleDuplication();
        return;
    }

    document.querySelectorAll('#heuresTable tbody tr').forEach(rowCible => {
        const jCible = rowCible.cells[0].textContent.trim().toLowerCase();
        if (joursCibles.includes(jCible)) {
            rowCible.querySelector('.debut-matin').value = dm;
            rowCible.querySelector('.fin-matin').value = fm;
            rowCible.querySelector('.debut-apm').value = da;
            rowCible.querySelector('.fin-apm').value = fa;
        }
    });

    calculerTotalHebdo();
    fermerModaleDuplication();
}

// ==========================================
// EXPORTS PDF (GUIDE)
// ==========================================
function exporterModeEmploiPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    // Couleurs de la charte graphique (Élégant & Moderne)
    const bleuPrimaire = [0, 0, 145]; // #000091
    const rougeAccent = [201, 25, 30]; // #c9191e
    const grisTexte = [60, 60, 60];

    // --- EN-TÊTE DU DOCUMENT ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(bleuPrimaire[0], bleuPrimaire[1], bleuPrimaire[2]);
    doc.text("Mode d'emploi", 14, 20);

    doc.setFontSize(13);
    doc.setTextColor(110, 110, 110);
    doc.text("Outil de calcul du temps de travail EPLE", 14, 27);

    // Ajout du lien vers la version en ligne demandé
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(rougeAccent[0], rougeAccent[1], rougeAccent[2]);
    doc.text("Version en ligne de l'application :", 14, 35);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 238); // Bleu standard pour un lien cliquable
    doc.text("https://karim-khfr.github.io/calculateur-edt-eple/", 73, 35);
    doc.link(73, 32, 85, 4, { url: "https://karim-khfr.github.io/calculateur-edt-eple/" });

    // Ligne de séparation élégante sous l'en-tête
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(14, 39, 196, 39);

    let y = 48; // Position de départ pour le contenu dynamique

    // --- PARSAGE DYNAMIQUE DU CONTENU DE L'ONGLET ---
    // On cible le conteneur du guide dans l'index.html
    const conteneurGuide = document.getElementById('guide');

    if (!conteneurGuide) {
        // Sécurité au cas où l'id de l'onglet est différent
        doc.setFont("helvetica", "normal");
        doc.setTextColor(grisTexte[0], grisTexte[1], grisTexte[2]);
        doc.text("Le contenu du mode d'emploi n'a pas pu être extrait.", 14, y);
        doc.save("Mode_d_emploi_Calculateur.pdf");
        return;
    }

    // Extraction de tous les éléments textuels et structurels (titres, paragraphes, listes)
    const elements = conteneurGuide.querySelectorAll('h2, h3, p, li');

    elements.forEach(el => {
        // Sécurité de saut de page si on arrive en bas de feuille
        if (y > 275) {
            doc.addPage();
            y = 20;
        }

        const texte = el.textContent.trim();
        if (!texte) return;

        // Masquer le bouton d'export ou le texte du lien s'il est déjà écrit en brut dans le HTML
        if (texte.includes("Exporter") || texte.includes("Version en ligne")) return;

        if (el.tagName === 'H2') {
            y += 4; // Espace avant titre principal
            if (y > 275) { doc.addPage(); y = 20; }
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(bleuPrimaire[0], bleuPrimaire[1], bleuPrimaire[2]);
            doc.text(texte, 14, y);
            y += 8;
        }
        else if (el.tagName === 'H3') {
            y += 2;
            if (y > 275) { doc.addPage(); y = 20; }
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(rougeAccent[0], rougeAccent[1], rougeAccent[2]);
            doc.text(texte, 14, y);
            y += 6;
        }
        else if (el.tagName === 'LI') {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(grisTexte[0], grisTexte[1], grisTexte[2]);

            // Formatage de la puce pour les listes
            const lignesPuce = doc.splitTextToSize(`•  ${texte}`, 182);
            lignesPuce.forEach(ligne => {
                if (y > 275) { doc.addPage(); y = 20; }
                doc.text(ligne, 14, y);
                y += 5.5;
            });
            y += 1;
        }
        else if (el.tagName === 'P') {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(grisTexte[0], grisTexte[1], grisTexte[2]);

            const lignesParagraphe = doc.splitTextToSize(texte, 182);
            lignesParagraphe.forEach(ligne => {
                if (y > 275) { doc.addPage(); y = 20; }
                doc.text(ligne, 14, y);
                y += 5.5;
            });
            y += 2.5; // Espacement après paragraphe
        }
    });

    // --- NUMÉROTATION DYNAMIQUE DES PAGES ---
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i}/${totalPages}`, 196, 287, { align: "right" });
    }

    // Téléchargement du fichier
    doc.save("Mode_d_emploi_Calculateur.pdf");
}

// ==========================================
// EXPORTS PDF (BILAN)
// ==========================================

function exporterPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    const bleuPrimaire = [0, 0, 145];
    const rougeAccent = [201, 25, 30];
    const grisTexte = [60, 60, 60];
    const grisLeger = [200, 200, 200];
    const pageW = doc.internal.pageSize.width;
    const pageH = doc.internal.pageSize.height;
    const mL = 14, mR = 14;

    // Identité
    const nomInput = document.getElementById("nomAgent");
    const prenomInput = document.getElementById("prenomAgent");
    const nom = (nomInput && nomInput.value ? nomInput.value : "Agent").toUpperCase();
    const prenom = (prenomInput && prenomInput.value ? prenomInput.value : "");
    const quotiteEl = document.getElementById("quotiteSelect");
    const quotite = quotiteEl ? quotiteEl.value + " %" : "100 %";
    const heuresRefEl = document.getElementById("heuresMaxInput");
    const heuresRef = heuresRefEl ? heuresRefEl.value : "1593h 00";

    // Helper : saut de page si besoin
    function checkY(needed) {
        if (y + needed > pageH - 18) { doc.addPage(); y = 18; ajouterEnTete(); }
    }

    // En-tête répété sur chaque page
    function ajouterEnTete() {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(bleuPrimaire[0], bleuPrimaire[1], bleuPrimaire[2]);
        doc.text("EMPLOI DU TEMPS ANNUEL", mL, 10);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(grisTexte[0], grisTexte[1], grisTexte[2]);
        doc.text(`${prenom} ${nom}  |  Quotité : ${quotite}`, mL, 15);
        doc.setDrawColor(grisLeger[0], grisLeger[1], grisLeger[2]);
        doc.setLineWidth(0.3);
        doc.line(mL, 17, pageW - mR, 17);
    }

    function sectionTitre(texte) {
        checkY(10);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(bleuPrimaire[0], bleuPrimaire[1], bleuPrimaire[2]);
        doc.text(texte, mL, y);
        y += 2;
        doc.setDrawColor(bleuPrimaire[0], bleuPrimaire[1], bleuPrimaire[2]);
        doc.setLineWidth(0.4);
        doc.line(mL, y, pageW - mR, y);
        y += 6;
        doc.setTextColor(grisTexte[0], grisTexte[1], grisTexte[2]);
        doc.setFont("helvetica", "normal");
        doc.setDrawColor(grisLeger[0], grisLeger[1], grisLeger[2]);
        doc.setLineWidth(0.3);
    }

    // Valeur propre sans la partie décimale entre parenthèses
    const val = (id) => {
        const el = document.getElementById(id);
        if (!el) return "0h 00";
        return el.textContent.trim().split('(')[0].trim();
    };

    // ── PAGE 1 : EN-TÊTE PRINCIPAL ─────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(bleuPrimaire[0], bleuPrimaire[1], bleuPrimaire[2]);
    doc.text("EMPLOI DU TEMPS ANNUEL", mL, 22);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(grisTexte[0], grisTexte[1], grisTexte[2]);
    doc.text(`Agent : ${prenom} ${nom}`, mL, 31);
    doc.text(`Quotité de travail : ${quotite}  —  Volume annuel de référence : ${heuresRef}`, mL, 37);

    doc.setDrawColor(grisLeger[0], grisLeger[1], grisLeger[2]);
    doc.setLineWidth(0.5);
    doc.line(mL, 41, pageW - mR, 41);

    let y = 50;

    // ── SECTION 1 : HORAIRES HEBDOMADAIRES (onglet 2) ──────
    sectionTitre("1. Horaires hebdomadaires (semaine type)");

    const joursRows = [];
    document.querySelectorAll('#heuresTable tbody tr').forEach(row => {
        const jour = row.cells[0] ? row.cells[0].textContent.trim() : "";
        const dm = row.querySelector('.debut-matin') ? row.querySelector('.debut-matin').value || "—" : "—";
        const fm = row.querySelector('.fin-matin') ? row.querySelector('.fin-matin').value || "—" : "—";
        const hm = row.querySelector('.heures-matin') ? row.querySelector('.heures-matin').textContent.trim() : "—";
        const da = row.querySelector('.debut-apm') ? row.querySelector('.debut-apm').value || "—" : "—";
        const fa = row.querySelector('.fin-apm') ? row.querySelector('.fin-apm').value || "—" : "—";
        const ha = row.querySelector('.heures-apm') ? row.querySelector('.heures-apm').textContent.trim() : "—";
        const total = row.querySelector('.total-jour') ? row.querySelector('.total-jour').textContent.trim() : "—";
        joursRows.push([jour, `${dm} – ${fm}`, hm, `${da} – ${fa}`, ha, total]);
    });

    const nbPausesVal = document.getElementById('nbPauses') ? document.getElementById('nbPauses').value : "0";
    const totalHebdoVal = document.getElementById('totalHebdo') ? document.getElementById('totalHebdo').textContent.trim() : "—";

    doc.autoTable({
        startY: y,
        margin: { left: mL, right: mR },
        head: [['Jour', 'Matin (début – fin)', 'H matin', 'APM (début – fin)', 'H APM', 'Total']],
        body: joursRows,
        theme: 'striped',
        headStyles: { fillColor: bleuPrimaire, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold' } }
    });
    y = doc.lastAutoTable.finalY + 4;

    checkY(8);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Pauses de 20 min comptabilisées par semaine : ${nbPausesVal}`, mL, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.text(`Total hebdomadaire : ${totalHebdoVal}`, mL, y);
    y += 10;

    // ── SECTION 2 : RÉCAPITULATIF ANNUEL (onglet 3) ────────
    sectionTitre("2. Récapitulatif hebdomadaire annuel");

    const semRows = [];
    semaines.forEach(sem => {
        const key = `sem_${sem.num}_${sem.debut.replace(/\//g, '_')}`;
        const saved = tableauSemainesData[key] || { h: "", hs: "", hr: "", c: "" };
        const vacInfo = estEnVacances(sem.dateObjetDebut, sem.dateObjetFin);

        const champHV = document.getElementById('horaireHorsVacances');
        const valHV = champHV ? parseFloat(champHV.value) : 0;
        let heuresAff;
        if (saved.h !== "") {
            heuresAff = saved.h;
        } else if (vacInfo.enVacances) {
            heuresAff = "00:00";
        } else if (valHV > 0) {
            const hE = Math.floor(valHV);
            const mE = Math.round((valHV - hE) * 60);
            heuresAff = `${hE}:${String(mE).padStart(2, '0')}`;
        } else {
            const txt = document.getElementById('totalHebdo') ? document.getElementById('totalHebdo').textContent.trim() : "0h 00";
            heuresAff = txt.replace('h ', ':').trim();
        }

        semRows.push([
            `S${sem.num}`,
            `${sem.debut} – ${sem.fin}`,
            vacInfo.enVacances ? "Vacances" : "Scolaire",
            heuresAff,
            saved.hs || "00:00",
            saved.hr || "00:00",
            saved.c || ""
        ]);
    });

    doc.autoTable({
        startY: y,
        margin: { left: mL, right: mR },
        head: [['Sem.', 'Période', 'Type', 'Heures', 'H. Sup', 'H. Récup', 'Commentaire']],
        body: semRows,
        theme: 'striped',
        headStyles: { fillColor: bleuPrimaire, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
            0: { cellWidth: 12 },
            1: { cellWidth: 38 },
            2: { cellWidth: 22 },
            3: { cellWidth: 20 },
            4: { cellWidth: 16 },
            5: { cellWidth: 16 },
            6: { cellWidth: 'auto' }
        },
        didParseCell: function (data) {
            if (data.section === 'body' && data.column.index === 2) {
                if (data.cell.text[0] === 'Vacances') {
                    data.cell.styles.textColor = [180, 100, 0];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        },
        didDrawPage: function () { y = doc.lastAutoTable.finalY + 6; }
    });
    y = doc.lastAutoTable.finalY + 10;

    // ── SECTION 3 : RÉSULTATS (onglet 4) ───────────────────
    checkY(60);
    sectionTitre("3. Résultats annuels");

    const refElement = document.getElementById("resReference");
    const valeurRef = refElement ? refElement.textContent.trim() : heuresRef;
    const ecartTexte = val("resEcart");
    const ecartNegatif = ecartTexte.includes('-');
    const ecartPositif = ecartTexte.includes('+') && !ecartTexte.includes('0h 00');

    doc.autoTable({
        startY: y,
        margin: { left: mL, right: mR },
        head: [['Indicateur', 'Volume horaire']],
        body: [
            ["Heures scolaires réalisées", val("resScolaire")],
            ["Heures de vacances réalisées", val("resVacances")],
            ["Heures supplémentaires comptées", val("resSup")],
            ["Heures déduites / récupérées", val("resRecup")],
            ["TOTAL ANNUEL CALCULÉ", val("resTotal")],
            ["Obligation réglementaire de référence", valeurRef],
            ["Balance (Écart annuel)", ecartTexte]
        ],
        theme: 'striped',
        headStyles: { fillColor: bleuPrimaire, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
        styles: { fontSize: 10, cellPadding: 4 },
        didParseCell: function (data) {
            if (data.row.index === 4) {
                data.cell.styles.fontStyle = 'bold';
            }
            if (data.row.index === 6) {
                data.cell.styles.fontStyle = 'bold';
                if (data.section === 'body' && data.column.index === 1) {
                    if (ecartNegatif) data.cell.styles.textColor = rougeAccent;
                    else if (ecartPositif) data.cell.styles.textColor = [39, 174, 96];
                }
            }
        }
    });
    y = doc.lastAutoTable.finalY + 12;

    // ── SECTION 4 : SIGNATURES ─────────────────────────────
    checkY(45);
    sectionTitre("4. Signatures");

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(grisTexte[0], grisTexte[1], grisTexte[2]);

    const colL = mL;
    const colR = pageW / 2 + 5;
    const colW = pageW / 2 - mL - 5;

    // Cadre gauche — Agent
    doc.setDrawColor(grisLeger[0], grisLeger[1], grisLeger[2]);
    doc.rect(colL, y, colW, 35);
    doc.setFont("helvetica", "bold");
    doc.text("L'agent", colL + 4, y + 7);
    doc.setFont("helvetica", "normal");
    doc.text(`${prenom} ${nom}`, colL + 4, y + 13);
    doc.text("Date :", colL + 4, y + 21);
    doc.text("Signature :", colL + 4, y + 29);

    // Cadre droit — Supérieur hiérarchique
    doc.rect(colR, y, colW, 35);
    doc.setFont("helvetica", "bold");
    doc.text("Le supérieur hiérarchique", colR + 4, y + 7);
    doc.setFont("helvetica", "normal");
    doc.text("Nom / Prénom :", colR + 4, y + 13);
    doc.text("Date :", colR + 4, y + 21);
    doc.text("Signature :", colR + 4, y + 29);

    y += 42;

    // ── PIED DE PAGE (toutes les pages) ────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(160, 160, 160);
        doc.text(
            `Document généré le ${new Date().toLocaleDateString('fr-FR')} — Outil de calcul du temps de travail EPLE`,
            mL, pageH - 8
        );
        doc.text(`Page ${i} / ${totalPages}`, pageW - mR, pageH - 8, { align: 'right' });
    }

    doc.save(`Bilan_Horaire_${nom}_${prenom}.pdf`);
}

// ==========================================
// REMISES À ZERO
// ==========================================
function resetAgent() {
    document.getElementById("nomAgent").value = "";
    document.getElementById("prenomAgent").value = "";
    document.getElementById("quotiteSelect").value = "100";
    updateQuotiteAndResults();
    sauvegarderImmediatement();
}

function resetHorairesHebdo() {
    // Vider les inputs de saisie
    document.querySelectorAll('#heuresTable input').forEach(i => i.value = "");
    // Remettre à zéro les colonnes calculées (matin, APM, total journalier)
    document.querySelectorAll('#heuresTable .heures-matin, #heuresTable .heures-apm, #heuresTable .total-jour').forEach(td => td.textContent = "0h 00");
    document.getElementById("nbPauses").value = "0";
    const champHV = document.getElementById("horaireHorsVacances");
    if (champHV) champHV.value = "0";
    // Recalculer (remet totalHebdo à 0h 00 et sauvegarde)
    calculerTotalHebdo();
    sauvegarderImmediatement();
}

async function resetTableauAnnuel() {
    const ok = await confirmerAsync(
        "Voulez-vous réinitialiser toutes les saisies manuelles des semaines ?",
        "Réinitialiser"
    );
    if (!ok) return;
    tableauSemainesData = {};
    genererTableauSemaines();
    calculerResultats();
    sauvegarderImmediatement();
    afficherToast("Tableau annuel réinitialisé.", 'info');
}

async function resetApplication() {
    const ok = await confirmerAsync(
        "Tout effacer et recommencer à zéro ? Cette action est irréversible.",
        "Tout effacer"
    );
    if (!ok) return;
    localStorage.removeItem('eple_calculateur');
    window.location.reload();
}

// ==========================================
// EXPORT PDF HORAIRES HEBDOMADAIRES
// ==========================================

function exporterHorairesPDF() {
    const { jsPDF } = window.jspdf;
    // Paysage (landscape)
    const doc = new jsPDF('l', 'mm', 'a4');

    const bleuPrimaire = [0, 0, 145];
    const grisTexte    = [60, 60, 60];
    const grisLeger    = [200, 200, 200];
    const pageW = doc.internal.pageSize.width;  // 297mm en paysage
    const pageH = doc.internal.pageSize.height; // 210mm en paysage
    const mL = 14, mR = 14;

    // Identité
    const nom    = (document.getElementById("nomAgent")?.value    || "Agent").toUpperCase();
    const prenom =  document.getElementById("prenomAgent")?.value || "";
    const quotiteEl = document.getElementById("quotiteSelect");
    const quotite   = quotiteEl ? quotiteEl.value + " %" : "100 %";

    // ── EN-TÊTE ─────────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(bleuPrimaire[0], bleuPrimaire[1], bleuPrimaire[2]);
    doc.text("HORAIRES HEBDOMADAIRES — SEMAINE TYPE", mL, 20);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(grisTexte[0], grisTexte[1], grisTexte[2]);
    doc.text(`Agent : ${prenom} ${nom}   |   Quotité : ${quotite}`, mL, 29);

    doc.setDrawColor(grisLeger[0], grisLeger[1], grisLeger[2]);
    doc.setLineWidth(0.5);
    doc.line(mL, 33, pageW - mR, 33);

    // ── TABLEAU DES JOURS ───────────────────────────────────
    const joursRows = [];
    document.querySelectorAll('#heuresTable tbody tr').forEach(row => {
        const jour  = row.cells[0]?.textContent.trim() || "";
        const dm    = row.querySelector('.debut-matin')?.value  || "—";
        const fm    = row.querySelector('.fin-matin')?.value    || "—";
        const hm    = row.querySelector('.heures-matin')?.textContent.trim() || "—";
        const da    = row.querySelector('.debut-apm')?.value    || "—";
        const fa    = row.querySelector('.fin-apm')?.value      || "—";
        const ha    = row.querySelector('.heures-apm')?.textContent.trim()   || "—";
        const total = row.querySelector('.total-jour')?.textContent.trim()   || "—";
        joursRows.push([jour, `${dm} – ${fm}`, hm, `${da} – ${fa}`, ha, total]);
    });

    doc.autoTable({
        startY: 39,
        margin: { left: mL, right: mR },
        head: [['Jour', 'Début matin', 'Fin matin', 'H matin', 'Début APM', 'Fin APM', 'H APM', 'Total journalier']],
        body: joursRows.map(r => {
            // Séparer les colonnes fusionnées "dm – fm" pour plus de lisibilité en paysage
            const [jour, matinRange, hm, apmRange, ha, total] = r;
            const [dm, fm] = matinRange.split(' – ');
            const [da, fa] = apmRange.split(' – ');
            return [jour, dm, fm, hm, da, fa, ha, total];
        }),
        theme: 'striped',
        headStyles: {
            fillColor: bleuPrimaire,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 11,
            halign: 'center'
        },
        styles: { fontSize: 11, cellPadding: 5, halign: 'center' },
        columnStyles: {
            0: { fontStyle: 'bold', halign: 'left', cellWidth: 28 },
            1: { cellWidth: 28 },
            2: { cellWidth: 28 },
            3: { cellWidth: 24 },
            4: { cellWidth: 28 },
            5: { cellWidth: 28 },
            6: { cellWidth: 24 },
            7: { fontStyle: 'bold', cellWidth: 32 }
        }
    });

    doc.save(`Horaires_${nom}_${prenom}.pdf`);
}

// ==========================================
// EXPORT EXCEL
// ==========================================

function exporterExcel() {
    if (typeof XLSX === 'undefined') {
        afficherToast("La bibliothèque Excel n'est pas disponible. Vérifiez votre connexion.", 'erreur', 5000);
        return;
    }

    const nom    = (document.getElementById("nomAgent")?.value    || "Agent").toUpperCase();
    const prenom =  document.getElementById("prenomAgent")?.value || "";
    const quotiteEl   = document.getElementById("quotiteSelect");
    const quotite     = quotiteEl ? quotiteEl.value + " %" : "100 %";
    const heuresRefEl = document.getElementById("heuresMaxInput");
    const heuresRef   = heuresRefEl ? heuresRefEl.value : "";
    const anneeEl     = document.getElementById("anneeScolaireSelect");
    const anneeLabel  = anneeEl ? anneeEl.options[anneeEl.selectedIndex]?.text || "" : "";

    const wb = XLSX.utils.book_new();

    // ── FEUILLE 1 : TABLEAU DES SEMAINES ────────────────────
    const entetesSemaines = ["Semaine", "Du", "Au", "Type", "Heures", "H. Sup", "H. Récup", "Commentaire"];
    const lignesSemaines  = [
        [`Agent : ${prenom} ${nom}   |   Quotité : ${quotite}   |   Référence : ${heuresRef}   |   Année : ${anneeLabel}`],
        [],
        entetesSemaines
    ];

    document.querySelectorAll('#semainesTableContent tr').forEach(row => {
        const cellSemaine  = row.querySelector('td:nth-child(1)');
        const cellType     = row.querySelector('td:nth-child(2)');
        const inputHeures  = row.querySelector('.s-heures');
        const inputSup     = row.querySelector('.s-heures-sup');
        const inputRecup   = row.querySelector('.s-heures-recup');
        const inputComm    = row.querySelector('.s-comm');
        if (!cellSemaine) return;

        // Extraire numéro et dates depuis la cellule "Semaine"
        const textes = cellSemaine.innerText.split('\n').map(s => s.trim()).filter(Boolean);
        const numSem = textes[0] || "";  // "Semaine 36"
        const dates  = textes[1] || "";  // "du 31/08/2026 au 06/09/2026"
        const matchDates = dates.match(/(\d{2}\/\d{2}\/\d{4})/g) || [];
        const dateDebut  = matchDates[0] || "";
        const dateFin    = matchDates[1] || "";

        lignesSemaines.push([
            numSem,
            dateDebut,
            dateFin,
            cellType?.textContent.trim()     || "",
            inputHeures?.value               || "",
            inputSup?.value                  || "",
            inputRecup?.value                || "",
            inputComm?.value                 || ""
        ]);
    });

    const wsSemaines = XLSX.utils.aoa_to_sheet(lignesSemaines);

    // Largeurs de colonnes
    wsSemaines['!cols'] = [
        { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
        { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 35 }
    ];

    // Fusion de la cellule d'en-tête agent sur toute la largeur
    wsSemaines['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];

    XLSX.utils.book_append_sheet(wb, wsSemaines, "Tableau des semaines");

    // ── FEUILLE 2 : RÉSULTATS ───────────────────────────────
    const val = (id) => {
        const el = document.getElementById(id);
        if (!el) return "";
        return el.textContent.trim().split('(')[0].trim();
    };

    const lignesResultats = [
        [`Agent : ${prenom} ${nom}   |   Quotité : ${quotite}   |   Année : ${anneeLabel}`],
        [],
        ["Indicateur", "Valeur"],
        ["Heures effectuées hors vacances scolaires",  val("resScolaire")],
        ["Heures effectuées pendant les vacances",     val("resVacances")],
        ["Heures supplémentaires comptabilisées",      val("resSup")],
        ["Heures récupérées / déduites",               val("resRecup")],
        ["TOTAL GÉNÉRAL RÉALISÉ",                      val("resTotal")],
        ["Volume annuel de référence obligatoire",     val("resReference")],
        ["Écart (Balance annuelle)",                   val("resEcart")]
    ];

    const wsResultats = XLSX.utils.aoa_to_sheet(lignesResultats);
    wsResultats['!cols'] = [{ wch: 48 }, { wch: 16 }];
    wsResultats['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];

    XLSX.utils.book_append_sheet(wb, wsResultats, "Résultats");

    // ── TÉLÉCHARGEMENT ──────────────────────────────────────
    const nomFichier = `Bilan_EPLE_${nom}_${prenom}_${anneeLabel.replace('-', '_')}.xlsx`;
    XLSX.writeFile(wb, nomFichier);
    afficherToast("Fichier Excel exporté avec succès.", 'succes');
}


window.onload = async function () {
    // 1. Générer les options d'années scolaires dynamiquement
    genererOptionsAnneeScolaire();

    // 2. Restaurer la sauvegarde (inclut la sélection d'année sauvegardée)
    restaurerSauvegarde();

    // CORRECTION : Si aucune sauvegarde n'existe, on force le champ à 0 pour éviter les 35h par défaut du HTML
    const champHV = document.getElementById("horaireHorsVacances");
    if (champHV && !localStorage.getItem('eple_calculateur')) {
        champHV.value = "0";
    }

    await initialiserCalendrierDynamique();
    mettreAJourInfoAnneeScolaire();
    updateQuotiteAndResults();
    calculerTotalHebdo();
    genererTableauSemaines();
    calculerResultats();
};

// ===== SCRIPT POUR LE FORMULAIRE DE CONTACT =====
document.addEventListener("DOMContentLoaded", function () {
    // Gestionnaire d'envoi du formulaire de contact avec indicateur de chargement
    const contactForm = document.getElementById('contact-form');
    const btnSubmit = document.getElementById('btn-contact-submit');
    const successMessage = document.getElementById('success-message');

    if (contactForm && btnSubmit) {
        contactForm.addEventListener('submit', function (e) {
            e.preventDefault(); // Empêche le rechargement de la page

            // 1. Passage en mode "Chargement"
            btnSubmit.disabled = true;
            btnSubmit.innerText = "Envoi en cours...";
            btnSubmit.style.opacity = "0.7";
            btnSubmit.style.cursor = "not-allowed";

            // 2. Récupération des données du formulaire
            const formData = new FormData(this);

            // 3. Envoi asynchrone à FormSubmit
            fetch(this.action, {
                method: this.method,
                body: formData,
                headers: {
                    'Accept': 'application/json'
                }
            })
                .then(response => {
                    // 4. Réinitialisation du bouton après réception de la réponse
                    btnSubmit.disabled = false;
                    btnSubmit.innerText = "Envoyer";
                    btnSubmit.style.opacity = "1";
                    btnSubmit.style.cursor = "pointer";

                    if (response.ok) {
                        // Succès : on affiche le message de réussite et on vide le formulaire
                        if (successMessage) {
                            successMessage.style.display = 'block';
                            // Optionnel : masquer le message après 5 secondes
                            setTimeout(() => { successMessage.style.display = 'none'; }, 5000);
                        }
                        contactForm.reset();
                    } else {
                        afficherToast("Une erreur est survenue lors de l'envoi. Veuillez réessayer.", 'erreur', 5000);
                    }
                })
                .catch(error => {
                    // En cas de coupure réseau ou crash
                    btnSubmit.disabled = false;
                    btnSubmit.innerText = "Envoyer";
                    btnSubmit.style.opacity = "1";
                    btnSubmit.style.cursor = "pointer";
                    console.error("Erreur de liaison :", error);
                    afficherToast("Impossible de joindre le serveur. Vérifiez votre connexion internet.", 'erreur', 5000);
                });
        });
    }
});