/*
 * Outil de calcul du temps de travail EPLE
 * © 2026 Karim Khenifer
 *
 * Distribué selon les conditions définies dans le fichier LICENSE.
 */

// ======================================================
// Version de l'application
// ======================================================
const APP_VERSION = "1.0";

// ===== MODULE INTÉGRÉ : calculs.js =====
// Fonctions métier pures : aucune dépendance au DOM.
function parseHoraire(str) {
    if (!str) return null;
    const valeur = String(str).trim().replace(',', '.');

    if (valeur.includes(':')) {
        const parts = valeur.split(':');
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (Number.isNaN(h) || Number.isNaN(m)) return null;
        return h * 60 + m;
    }

    const valeurDecimale = parseFloat(valeur);
    return Number.isNaN(valeurDecimale) ? null : Math.round(valeurDecimale * 60);
}

function formatMinutes(totalMin) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h ${String(m).padStart(2, '0')}`;
}

function parseDecimal(str) {
    if (!str) return 0;
    const val = parseFloat(String(str).replace(',', '.'));
    return Number.isNaN(val) ? 0 : val;
}

function formatResultatHeures(totalHeures) {
    const entier = Math.floor(totalHeures);
    const minutes = Math.round((totalHeures - entier) * 60);
    return `${entier}h ${String(minutes).padStart(2, '0')} (${totalHeures.toFixed(2)}h)`;
}

function obtenirHeuresPourSemaine(heuresSaisies, estVacances, horaireType = '00:00') {
    const valeurSaisie = String(heuresSaisies ?? '').trim();
    if (valeurSaisie !== '') return valeurSaisie;
    return estVacances ? '00:00' : (horaireType || '00:00');
}

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
    return `${j}/${m}/${date.getFullYear()}`;
}

function validerFormatHoraire(valeur) {
    if (!valeur || valeur.trim() === '') return 'vide';

    const str = valeur.trim().replace(',', '.');
    if (str.includes(':')) {
        const parts = str.split(':');
        if (parts.length !== 2) return 'invalide';
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (Number.isNaN(h) || Number.isNaN(m) || parts[1].trim() === '') return 'invalide';
        if (h > 23 || m > 59) return 'impossible';
        return 'ok';
    }

    const dec = parseFloat(str);
    if ((!Number.isNaN(dec) && str === String(dec)) || /^\d+(\.\d+)?$/.test(str)) {
        return dec > 23.99 ? 'impossible' : 'ok';
    }

    return 'invalide';
}

// ===== MODULE INTÉGRÉ : ui.js =====
function afficherToast(message, type = 'info', duree = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icones = { succes: '✅', info: 'ℹ️', erreur: '❌' };
    const toast = document.createElement('div');
    const icone = document.createElement('span');
    const texte = document.createElement('span');

    toast.className = `toast ${type}`;
    toast.style.setProperty('--toast-duree', `${duree / 1000}s`);
    icone.className = 'toast-icone';
    icone.textContent = icones[type] || 'ℹ️';
    texte.textContent = String(message);

    toast.append(icone, texte);
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duree + 400);
}

// ===== MODULE INTÉGRÉ : calendrier-api.js =====
const DELAI_MAX_API_MS = 8000;
const CACHE_PREFIX = 'eple_calendrier_v2:';
const cacheMemoire = new Map();
let requeteCalendrierActive = null;

// Table de repli versionnée. Elle remplace l'ancienne règle approximative
// « à partir du 4 juillet ». À actualiser lors des publications officielles.
const VACANCES_ETE_PAR_ANNEE_SCOLAIRE = Object.freeze({
    2023: { debut: '2024-07-06', fin: '2024-09-01', version: '2024-01' },
    2024: { debut: '2025-07-05', fin: '2025-09-01', version: '2025-01' },
    2025: { debut: '2026-07-04', fin: '2026-09-01', version: '2026-01' },
    2026: { debut: '2027-07-03', fin: '2027-09-01', version: '2026-07' },
    2027: { debut: '2028-07-08', fin: '2028-09-01', version: '2026-07' }
});

function creerCleCache(anneeDepart, zone) {
    return `${anneeDepart}:${zone}`;
}

function lireCacheSession(cle) {
    try {
        const raw = sessionStorage.getItem(CACHE_PREFIX + cle);
        if (!raw) return null;
        const data = JSON.parse(raw);
        return {
            vacances: data.vacances.map(v => ({ ...v, debut: new Date(v.debut), fin: new Date(v.fin) })),
            joursFeries: data.joursFeries
        };
    } catch {
        return null;
    }
}

function ecrireCacheSession(cle, data) {
    try {
        sessionStorage.setItem(CACHE_PREFIX + cle, JSON.stringify(data));
    } catch {
        // Le cache est une optimisation : son échec ne doit jamais bloquer l'outil.
    }
}

async function fetchAvecSignal(url, signal) {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
}

function ajouterVacancesEteVersionnees(vacances, anneeDepart) {
    const config = VACANCES_ETE_PAR_ANNEE_SCOLAIRE[anneeDepart];
    if (!config) return vacances;

    const debutEte = new Date(`${config.debut}T00:00:00`);
    const finEte = new Date(`${config.fin}T00:00:00`);

    // Une véritable période estivale doit couvrir une durée significative et
    // chevaucher la plage officielle versionnée. Une simple entrée « fin des cours »
    // ne suffit donc plus à neutraliser le repli.
    const contientDejaEte = vacances.some(v => {
        const debut = new Date(v.debut);
        const fin = new Date(v.fin);
        const dureeJours = (fin - debut) / 86400000;
        const chevaucheEte = debut <= finEte && fin >= debutEte;
        return chevaucheEte && dureeJours >= 30;
    });

    if (contientDejaEte) return vacances;

    return [...vacances, {
        nom: "Vacances d'Été",
        debut: debutEte,
        fin: finEte,
        source: `table-statique-${config.version}`
    }];
}

async function chargerVacances(anneeDepart, zone, signal) {
    const anneeFin = anneeDepart + 1;
    const url = `https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records?where=annee_scolaire%3D%22${anneeDepart}-${anneeFin}%22%20and%20zones%3D%22Zone%20${zone}%22&limit=100`;
    const response = await fetchAvecSignal(url, signal);
    const data = await response.json();
    const vacances = (data.results || []).map(record => ({
        nom: record.description || 'Vacances',
        debut: new Date(record.start_date),
        fin: new Date(record.end_date),
        source: 'api-education'
    }));
    return ajouterVacancesEteVersionnees(vacances, anneeDepart);
}

async function chargerJoursFeries(anneeDepart, signal) {
    const [res1, res2] = await Promise.all([
        fetchAvecSignal(`https://calendrier.api.gouv.fr/jours-feries/metropole/${anneeDepart}.json`, signal),
        fetchAvecSignal(`https://calendrier.api.gouv.fr/jours-feries/metropole/${anneeDepart + 1}.json`, signal)
    ]);
    const [data1, data2] = await Promise.all([res1.json(), res2.json()]);
    return { ...data1, ...data2 };
}

async function chargerDonneesCalendrier(anneeDepart, zone) {
    const cle = creerCleCache(anneeDepart, zone);
    const cached = cacheMemoire.get(cle) || lireCacheSession(cle);
    if (cached) {
        // Réappliquer systématiquement le repli versionné aux données du cache.
        // Cela garantit que les anciens caches incomplets ne masquent pas l'été.
        const cachedCorrige = {
            ...cached,
            vacances: ajouterVacancesEteVersionnees(cached.vacances || [], anneeDepart)
        };
        cacheMemoire.set(cle, cachedCorrige);
        ecrireCacheSession(cle, cachedCorrige);
        return { ...cachedCorrige, depuisCache: true, erreurs: [] };
    }

    requeteCalendrierActive?.abort();
    const controller = new AbortController();
    requeteCalendrierActive = controller;
    const timer = setTimeout(() => controller.abort(), DELAI_MAX_API_MS);

    try {
        const [vacancesResult, feriesResult] = await Promise.allSettled([
            chargerVacances(anneeDepart, zone, controller.signal),
            chargerJoursFeries(anneeDepart, controller.signal)
        ]);

        if (controller.signal.aborted) {
            throw new DOMException('Chargement du calendrier annulé', 'AbortError');
        }

        const erreurs = [];
        let vacances = [];
        let joursFeries = {};

        if (vacancesResult.status === 'fulfilled') {
            vacances = vacancesResult.value;
        } else {
            erreurs.push({ source: 'vacances', erreur: vacancesResult.reason });
            vacances = ajouterVacancesEteVersionnees([], anneeDepart);
        }

        if (feriesResult.status === 'fulfilled') {
            joursFeries = feriesResult.value;
        } else {
            erreurs.push({ source: 'joursFeries', erreur: feriesResult.reason });
        }

        const data = { vacances, joursFeries };
        cacheMemoire.set(cle, data);
        ecrireCacheSession(cle, data);
        return { ...data, depuisCache: false, erreurs };
    } finally {
        clearTimeout(timer);
        if (requeteCalendrierActive === controller) requeteCalendrierActive = null;
    }
}

// ===== MODULE INTÉGRÉ : export-utils.js =====
function construireJoursRows(lignesHoraires) {
    return lignesHoraires.map(({ jour, dm, fm, da, fa, cellules }) => [
        jour,
        `${dm || '—'} – ${fm || '—'}`,
        cellules.heuresMatin?.textContent.trim() || '—',
        `${da || '—'} – ${fa || '—'}`,
        cellules.heuresApm?.textContent.trim() || '—',
        cellules.totalJour?.textContent.trim() || '—'
    ]);
}

function convertirJoursRowsPourPaysage(joursRows) {
    return joursRows.map(([jour, matinRange, hm, apmRange, ha, total]) => {
        const [dm, fm] = matinRange.split(' – ');
        const [da, fa] = apmRange.split(' – ');
        return [jour, dm, fm, hm, da, fa, ha, total];
    });
}


// ==========================================
// TOASTS & MODALE DE CONFIRMATION
// ==========================================

/**
 * Affiche un toast non bloquant.
 * @param {string} message  - Texte à afficher
 * @param {'succes'|'info'|'erreur'} type - Type visuel
 * @param {number} duree    - Durée en ms avant disparition (défaut 3500)
 */
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
// UTILITAIRES TRANSVERSES
// ==========================================
function assainirNomFichier(valeur) {
    return String(valeur || '')
        .trim()
        .replace(/[\/\\:*?"<>|]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_') || 'Agent';
}

// Source unique de lecture du tableau des horaires.
// Les références DOM sont conservées pour permettre aux fonctions de validation
// et de calcul de mettre à jour les cellules sans refaire les mêmes sélecteurs.
function lireLignesHoraires() {
    return Array.from(document.querySelectorAll('#heuresTable tbody tr')).map(row => {
        const champs = {
            dm: row.querySelector('.debut-matin'),
            fm: row.querySelector('.fin-matin'),
            da: row.querySelector('.debut-apm'),
            fa: row.querySelector('.fin-apm')
        };

        return {
            row,
            jour: row.cells[0]?.textContent.trim() || '',
            champs,
            dm: champs.dm?.value.trim() || '',
            fm: champs.fm?.value.trim() || '',
            da: champs.da?.value.trim() || '',
            fa: champs.fa?.value.trim() || '',
            cellules: {
                heuresMatin: row.querySelector('.heures-matin'),
                heuresApm: row.querySelector('.heures-apm'),
                totalJour: row.querySelector('.total-jour')
            }
        };
    });
}

// Source unique de l'horaire hebdomadaire par défaut.
function obtenirHoraireTypeBaseHHMM() {
    const valeurHorsVacances = parseDecimal(document.getElementById('horaireHorsVacances')?.value);

    if (valeurHorsVacances > 0) {
        const totalMinutes = Math.round(valeurHorsVacances * 60);
        const heures = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${heures}:${String(minutes).padStart(2, '0')}`;
    }

    const totalHebdoTexte = document.getElementById('totalHebdo')?.textContent.trim() || '';
    if (totalHebdoTexte && totalHebdoTexte !== '0h 00') {
        return totalHebdoTexte.replace('h ', ':').trim();
    }

    return '00:00';
}

// Règle métier centralisée : saisie manuelle > vacances à zéro > horaire type.
function ajouterLibellesAccessiblesHoraires() {
    const libelles = [
        ['.debut-matin', 'début matin'],
        ['.fin-matin', 'fin matin'],
        ['.debut-apm', 'début après-midi'],
        ['.fin-apm', 'fin après-midi']
    ];

    lireLignesHoraires().forEach(({ jour, row }) => {
        libelles.forEach(([selecteur, libelle]) => {
            const champ = row.querySelector(selecteur);
            if (champ) champ.setAttribute('aria-label', `${jour || 'Jour'}, ${libelle}`);
        });
    });
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
    document.querySelectorAll('.tab-content:not(#contact) input, .tab-content:not(#contact) textarea, .tab-content:not(#contact) select').forEach(el => {
        const key = el.id || el.name;
        if (key) data[key] = el.value;
    });

    const horairesSemaineType = lireLignesHoraires().map(({ dm, fm, da, fa }) => ({
        dm, fm, da, fa
    }));

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
            // Ne jamais restaurer les données personnelles du formulaire de contact.
            if (el && !el.closest('#contact-form')) el.value = data[key];
        });

        if (data['__horairesSemaineType']) {
            const horaires = JSON.parse(data['__horairesSemaineType']);
            const lignes = lireLignesHoraires();
            horaires.forEach((h, i) => {
                const ligne = lignes[i];
                if (!ligne) return;
                if (ligne.champs.dm) ligne.champs.dm.value = h.dm || '';
                if (ligne.champs.fm) ligne.champs.fm.value = h.fm || '';
                if (ligne.champs.da) ligne.champs.da.value = h.da || '';
                if (ligne.champs.fa) ligne.champs.fa.value = h.fa || '';
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
    } catch (e) { }

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

async function initialiserCalendrierDynamique() {
    const anneeSelect = document.getElementById("anneeScolaireSelect");
    const zoneSelect = document.getElementById("zoneScolaireSelect");
    if (!anneeSelect || !zoneSelect) return;

    const anneeDepart = parseInt(anneeSelect.value, 10);
    const zoneChoisie = zoneSelect.value;
    const spinner = document.getElementById("spinnerCalendrier");
    if (spinner) spinner.style.display = "inline-block";

    try {
        const resultat = await chargerDonneesCalendrier(anneeDepart, zoneChoisie);
        listeVacancesAPI = resultat.vacances;
        listeJoursFeriesAPI = resultat.joursFeries;

        resultat.erreurs.forEach(({ source, erreur }) => {
            console.error(`Erreur de chargement ${source} :`, erreur);
            if (source === 'vacances') {
                afficherToast(
                    "Le calendrier scolaire en ligne est indisponible. Le repli versionné des vacances d'été reste actif.",
                    'erreur',
                    7000
                );
            } else {
                afficherToast(
                    "Impossible de récupérer les jours fériés. Leur surbrillance ne sera pas affichée.",
                    'erreur',
                    7000
                );
            }
        });
    } catch (error) {
        if (error.name === 'AbortError') return;
        console.error("Erreur de chargement du calendrier :", error);
        afficherToast("Impossible de charger le calendrier demandé.", 'erreur', 7000);
        return;
    } finally {
        if (spinner) spinner.style.display = "none";
    }

    let dateCurseur = new Date(anneeDepart, 8, 1);
    const jourRentree = dateCurseur.getDay();
    if (jourRentree === 0) {
        dateCurseur.setDate(dateCurseur.getDate() - 6);
    } else if (jourRentree > 1) {
        dateCurseur.setDate(dateCurseur.getDate() - (jourRentree - 1));
    }

    const dateFinAnneeScolaire = new Date(anneeDepart + 1, 8, 1);
    semaines = [];

    while (dateCurseur < dateFinAnneeScolaire) {
        const debutSemaine = new Date(dateCurseur);
        const finSemaine = new Date(dateCurseur);
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
    const tJeudi = jeudiSemaine.getTime();

    for (const vacance of listeVacancesAPI || []) {
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

    const horaireTypeBaseHHMM = obtenirHoraireTypeBaseHHMM();

    // Le dictionnaire listeJoursFeriesAPI est déjà chargé par initialiserCalendrierDynamique
    const moisNomsCourt = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];

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

        const affichageHeures = obtenirHeuresPourSemaine(
            saved.h,
            vacInfo.enVacances,
            horaireTypeBaseHHMM
        );

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
    const annee = parseInt(anneeSelect.value, 10);
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
    const jVendrediAvant = ((jourSemaineSuivant - 5 + 7) % 7) || 7;
    const offsetVendrediPrecedent = -jVendrediAvant;
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
// VALIDATION DES SAISIES HORAIRES (ONGLET 2)
// ==========================================

/**
 * Valide un champ horaire individuel.
 * Retourne : 'ok' | 'vide' | 'invalide' | 'impossible'
 * - 'vide'      : champ vide, neutre
 * - 'ok'        : valeur correcte
 * - 'invalide'  : format non reconnu (ex: "abc", "13:", "25h30")
 * - 'impossible': heure > 23 ou minutes > 59
 */
/**
 * Applique le style visuel sur un champ selon son état de validation.
 */
function appliquerStyleValidation(input, etat) {
    input.classList.remove('horaire-invalide', 'horaire-attention');
    if (etat === 'invalide' || etat === 'impossible') {
        input.classList.add('horaire-invalide');
    } else if (etat === 'attention') {
        input.classList.add('horaire-attention');
    }
}

/**
 * Valide l'ensemble du tableau onglet 2 et affiche les erreurs.
 * Appelé par calculerTotalHebdo après chaque saisie.
 */
function validerTableauHoraires() {
    const msgEl = document.getElementById('validation-message-horaires');
    const erreurs = [];
    const avertissements = [];

    lireLignesHoraires().forEach(({ jour, champs }) => {
        const { dm, fm, da, fa } = champs;
        if (!dm || !fm || !da || !fa) return;

        // Valider le format de chaque champ
        [dm, fm, da, fa].forEach(input => {
            const etat = validerFormatHoraire(input.value);
            if (etat === 'invalide') {
                appliquerStyleValidation(input, 'invalide');
                erreurs.push(`${jour} : "${input.value}" n'est pas un horaire valide (attendu HH:MM).`);
            } else if (etat === 'impossible') {
                appliquerStyleValidation(input, 'invalide');
                erreurs.push(`${jour} : "${input.value}" dépasse les limites horaires (max 23:59).`);
            } else {
                appliquerStyleValidation(input, 'ok');
            }
        });

        // Vérifier fin > début pour le matin
        const tDm = parseHoraire(dm.value);
        const tFm = parseHoraire(fm.value);
        if (tDm !== null && tFm !== null && tFm <= tDm) {
            appliquerStyleValidation(dm, 'attention');
            appliquerStyleValidation(fm, 'attention');
            avertissements.push(`${jour} matin : l'heure de fin doit être après l'heure de début.`);
        }

        // Vérifier fin > début pour l'après-midi
        const tDa = parseHoraire(da.value);
        const tFa = parseHoraire(fa.value);
        if (tDa !== null && tFa !== null && tFa <= tDa) {
            appliquerStyleValidation(da, 'attention');
            appliquerStyleValidation(fa, 'attention');
            avertissements.push(`${jour} APM : l'heure de fin doit être après l'heure de début.`);
        }

        // Vérifier que l'APM ne commence pas avant la fin du matin
        if (tFm !== null && tDa !== null && tDa < tFm) {
            appliquerStyleValidation(da, 'attention');
            avertissements.push(`${jour} : le début APM (${da.value}) est avant la fin du matin (${fm.value}).`);
        }
    });

    // Afficher le premier message le plus important
    if (msgEl) {
        if (erreurs.length > 0) {
            msgEl.textContent = '⛔ ' + erreurs[0];
            msgEl.className = '';
        } else if (avertissements.length > 0) {
            msgEl.textContent = '⚠️ ' + avertissements[0];
            msgEl.className = 'attention';
        } else {
            msgEl.textContent = '';
            msgEl.className = '';
        }
    }
}

// ==========================================
// CALCULS DES HORAIRES HEBDOMADAIRES (ONGLET 2)
// ==========================================
function calculerTotalHebdo() {
    let totalMinutesGeneral = 0;

    lireLignesHoraires().forEach(({ dm, fm, da, fa, cellules }) => {
        let minMatin = 0;
        const tDm = parseHoraire(dm);
        const tFm = parseHoraire(fm);
        if (tDm !== null && tFm !== null && tFm > tDm) minMatin = tFm - tDm;
        if (cellules.heuresMatin) cellules.heuresMatin.textContent = formatMinutes(minMatin);

        let minApm = 0;
        const tDa = parseHoraire(da);
        const tFa = parseHoraire(fa);
        if (tDa !== null && tFa !== null && tFa > tDa) minApm = tFa - tDa;
        if (cellules.heuresApm) cellules.heuresApm.textContent = formatMinutes(minApm);

        const totalJour = minMatin + minApm;
        if (cellules.totalJour) cellules.totalJour.textContent = formatMinutes(totalJour);
        totalMinutesGeneral += totalJour;
    });

    const nbPauses = parseInt(document.getElementById('nbPauses').value, 10) || 0;
    totalMinutesGeneral += (nbPauses * 20);

    document.getElementById('totalHebdo').textContent = formatMinutes(totalMinutesGeneral);
    validerTableauHoraires();
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
function calculerResultats() {
    let totalMinutesScolaire = 0;
    let totalMinutesVacances = 0;
    let totalMinutesSup = 0;
    let totalMinutesRecup = 0;

    const horaireTypeBaseHHMM = obtenirHoraireTypeBaseHHMM();

    semaines.forEach(sem => {
        const vacInfo = estEnVacances(sem.dateObjetDebut, sem.dateObjetFin);
        const key = `sem_${sem.num}_${sem.debut.replace(/\//g, '_')}`;
        const saved = tableauSemainesData[key] || { h: "", hs: "", hr: "", c: "" };

        const heuresApplicables = obtenirHeuresPourSemaine(
            saved.h,
            vacInfo.enVacances,
            horaireTypeBaseHHMM
        );
        const m = parseHoraire(heuresApplicables) || 0;
        const ms = saved.hs !== "" ? (parseHoraire(saved.hs) || 0) : 0;
        const mr = saved.hr !== "" ? (parseHoraire(saved.hr) || 0) : 0;

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

    // Mettre à jour l'indicateur de progression
    mettreAJourProgression(totalGeneral, referenceAnnuelle);
}

// ==========================================
// INDICATEUR DE PROGRESSION (ONGLET 4)
// ==========================================
function mettreAJourProgression(totalHeures, referenceHeures) {
    const remplissage = document.getElementById('progression-remplissage');
    const pct = document.getElementById('progression-pct');
    const badge = document.getElementById('progression-badge');
    const realise = document.getElementById('prog-realise');
    const objectif = document.getElementById('prog-objectif');
    const resteWrap = document.getElementById('prog-reste-wrap');
    if (!remplissage || !pct) return;

    // Seuil d'approche : 5 heures avant l'objectif
    const SEUIL_APPROCHE_H = 5;

    const pourcentage = referenceHeures > 0
        ? Math.min(100, (totalHeures / referenceHeures) * 100)
        : 0;
    const ecartH = totalHeures - referenceHeures;
    const depasse = ecartH > 0;
    const atteint = Math.abs(ecartH) < 0.01; // tolérance 1 minute
    const approche = !depasse && !atteint && (referenceHeures - totalHeures) <= SEUIL_APPROCHE_H;

    // Largeur de la barre
    remplissage.style.width = pourcentage.toFixed(1) + '%';

    // Couleur de la barre
    remplissage.className = 'progression-barre-remplissage ' + (
        depasse ? 'rouge' :
            atteint ? 'verte' :
                approche ? 'orange' :
                    'bleue'
    );

    // Attribut aria
    remplissage.closest('[role="progressbar"]')
        ?.setAttribute('aria-valuenow', Math.round(pourcentage));

    // Pourcentage texte
    pct.textContent = Math.round(pourcentage) + ' %';
    pct.style.color = depasse ? '#c0392b' : atteint ? '#1e8449' : '#2c3e50';

    // Badge
    badge.style.display = '';
    if (depasse) {
        badge.textContent = `⚠️ Dépassement`;
        badge.className = 'progression-badge depasse';
    } else if (atteint) {
        badge.textContent = '✅ Objectif atteint';
        badge.className = 'progression-badge atteint';
    } else if (approche) {
        badge.textContent = '⚡ Objectif proche';
        badge.className = 'progression-badge approche';
    } else {
        badge.style.display = 'none';
    }

    // Ligne de détail
    const fmtH = (h) => {
        const entier = Math.floor(Math.abs(h));
        const min = Math.round((Math.abs(h) - entier) * 60);
        return `${entier}h ${String(min).padStart(2, '0')}`;
    };

    realise.textContent = fmtH(totalHeures);
    objectif.textContent = fmtH(referenceHeures);

    // La zone est reconstruite de façon cohérente à chaque mise à jour.
    // Ne pas utiliser l'ancienne référence `reste`, car innerHTML peut l'avoir supprimée.
    resteWrap.replaceChildren();

    const valeurEcart = document.createElement('strong');

    if (depasse) {
        resteWrap.append(document.createTextNode('Excédent : '));

        valeurEcart.textContent = `+ ${fmtH(ecartH)}`;
        valeurEcart.style.color = '#c0392b';

        resteWrap.appendChild(valeurEcart);
    } else if (atteint) {
        valeurEcart.textContent = 'Objectif atteint ✓';
        valeurEcart.style.color = '#1e8449';

        resteWrap.appendChild(valeurEcart);
    } else {
        resteWrap.append(document.createTextNode('Reste : '));

        valeurEcart.id = 'prog-reste';
        valeurEcart.textContent = fmtH(referenceHeures - totalHeures);

        resteWrap.appendChild(valeurEcart);
    }
}

// ==========================================
// DUPLICATION DES HORAIRES
// ==========================================
function dupliquerJour(bouton) {
    const rowSource = bouton.closest('tr');
    if (!rowSource) return;

    const ligneSource = lireLignesHoraires().find(({ row }) => row === rowSource);
    if (!ligneSource) return;

    const { jour: jourSource, dm, fm, da, fa } = ligneSource;
    const tousLesJours = lireLignesHoraires()
        .map(({ jour }) => jour)
        .filter(jour => jour && jour !== jourSource);

    let modale = document.getElementById('modaleDuplication');
    if (!modale) {
        modale = document.createElement('div');
        modale.id = 'modaleDuplication';
        modale.className = 'modale-duplication';
        modale.setAttribute('role', 'dialog');
        modale.setAttribute('aria-modal', 'true');
        modale.setAttribute('aria-labelledby', 'titre-modale-duplication');
        document.body.appendChild(modale);
    }

    // Construction DOM sans innerHTML contenant des valeurs utilisateur :
    // supprime le vecteur d'injection via attribut onclick.
    modale.replaceChildren();
    const boite = document.createElement('div');
    boite.className = 'modale-duplication__boite';

    const titre = document.createElement('h3');
    titre.id = 'titre-modale-duplication';
    titre.textContent = `Dupliquer les horaires de ${jourSource}`;

    const aide = document.createElement('p');
    aide.textContent = 'Sélectionnez les jours cibles :';

    const liste = document.createElement('div');
    liste.id = 'checkboxJours';
    liste.className = 'modale-duplication__liste';

    tousLesJours.forEach(jour => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = jour;
        label.append(checkbox, document.createTextNode(` ${jour}`));
        liste.appendChild(label);
    });

    const actions = document.createElement('div');
    actions.className = 'modale-duplication__actions';

    const btnAnnuler = document.createElement('button');
    btnAnnuler.type = 'button';
    btnAnnuler.className = 'btn-secondary';
    btnAnnuler.textContent = 'Annuler';
    btnAnnuler.addEventListener('click', fermerModaleDuplication);

    const btnDupliquer = document.createElement('button');
    btnDupliquer.type = 'button';
    btnDupliquer.textContent = '✔ Dupliquer';
    btnDupliquer.addEventListener('click', () => appliquerDuplication(jourSource, dm, fm, da, fa));

    actions.append(btnAnnuler, btnDupliquer);
    boite.append(titre, aide, liste, actions);
    modale.appendChild(boite);
    modale.style.display = 'flex';
    btnAnnuler.focus();
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

    lireLignesHoraires().forEach(({ jour, champs }) => {
        if (!joursCibles.includes(jour.toLowerCase())) return;
        if (champs.dm) champs.dm.value = dm;
        if (champs.fm) champs.fm.value = fm;
        if (champs.da) champs.da.value = da;
        if (champs.fa) champs.fa.value = fa;
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

    // Correction ciblée : cet export ne modifie aucune donnée de l'application.
    const bleuPrimaire = [0, 0, 145];
    const rougeAccent = [201, 25, 30];
    const grisTexte = [60, 60, 60];
    const largeurTexte = 182;
    const limiteBasPage = 275;

    function ajouterPageSiNecessaire(hauteurNecessaire = 8) {
        if (y + hauteurNecessaire > limiteBasPage) {
            doc.addPage();
            y = 20;
        }
    }

    function ecrireTexte(texte, {
        taille = 10,
        style = 'normal',
        couleur = grisTexte,
        retrait = 0,
        prefixe = '',
        espacementApres = 2.5,
        interligne = 5.5
    } = {}) {
        const contenu = String(texte || '').trim();
        if (!contenu) return;

        doc.setFont('helvetica', style);
        doc.setFontSize(taille);
        doc.setTextColor(couleur[0], couleur[1], couleur[2]);

        const lignes = doc.splitTextToSize(
            `${prefixe}${contenu}`,
            largeurTexte - retrait
        );

        lignes.forEach(ligne => {
            ajouterPageSiNecessaire(interligne);
            doc.text(ligne, 14 + retrait, y);
            y += interligne;
        });

        y += espacementApres;
    }

    // --- EN-TÊTE DU DOCUMENT ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(...bleuPrimaire);
    doc.text("Mode d'emploi", 14, 20);

    doc.setFontSize(13);
    doc.setTextColor(110, 110, 110);
    doc.text('Outil de calcul du temps de travail EPLE', 14, 27);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...rougeAccent);
    doc.text("Version en ligne de l'application :", 14, 35);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 238);
    doc.text('https://karim-khfr.github.io/calculateur-edt-eple/', 73, 35);
    doc.link(73, 32, 85, 4, {
        url: 'https://karim-khfr.github.io/calculateur-edt-eple/'
    });

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(14, 39, 196, 39);

    let y = 48;

    const conteneurGuide = document.getElementById('guide');
    const sectionGuide = conteneurGuide?.querySelector('.section');

    if (!sectionGuide) {
        ecrireTexte("Le contenu du mode d'emploi n'a pas pu être extrait.");
        doc.save('Mode_d_emploi_Calculateur.pdf');
        return;
    }

    // Parcours des enfants directs : conserve l'ordre du HTML sans exporter deux fois
    // les contenus imbriqués des listes et des tableaux.
    Array.from(sectionGuide.children).forEach(element => {
        const tag = element.tagName;

        // Le bouton de téléchargement et les séparateurs visuels ne sont pas du contenu.
        if (tag === 'BUTTON' || tag === 'HR') return;

        if (tag === 'H2') {
            y += 4;
            ecrireTexte(element.textContent, {
                taille: 14,
                style: 'bold',
                couleur: bleuPrimaire,
                espacementApres: 3,
                interligne: 7
            });
            return;
        }

        if (tag === 'H3') {
            y += 2;
            ecrireTexte(element.textContent, {
                taille: 11,
                style: 'bold',
                couleur: rougeAccent,
                espacementApres: 2,
                interligne: 6
            });
            return;
        }

        if (tag === 'P') {
            ecrireTexte(element.textContent);
            return;
        }

        if (tag === 'UL' || tag === 'OL') {
            Array.from(element.children).forEach((li, index) => {
                const prefixe = tag === 'OL' ? `${index + 1}.  ` : '•  ';
                ecrireTexte(li.textContent, {
                    retrait: 2,
                    prefixe,
                    espacementApres: 1,
                    interligne: 5.5
                });
            });
            y += 1;
            return;
        }

        if (tag === 'DIV' && element.classList.contains('result')) {
            ajouterPageSiNecessaire(16);
            doc.setFillColor(232, 244, 252);
            doc.setDrawColor(52, 152, 219);

            const lignes = doc.splitTextToSize(element.textContent.trim(), largeurTexte - 8);
            const hauteurBloc = Math.max(14, lignes.length * 5.5 + 7);

            if (y + hauteurBloc > limiteBasPage) {
                doc.addPage();
                y = 20;
            }

            doc.setFillColor(232, 244, 252);
            doc.rect(14, y - 4, largeurTexte, hauteurBloc, 'F');
            doc.setDrawColor(52, 152, 219);
            doc.setLineWidth(1);
            doc.line(14, y - 4, 14, y - 4 + hauteurBloc);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(...grisTexte);
            lignes.forEach(ligne => {
                doc.text(ligne, 18, y + 2);
                y += 5.5;
            });
            y += 5;
            return;
        }

        if (tag === 'TABLE') {
            ajouterPageSiNecessaire(20);

            const entetes = Array.from(element.querySelectorAll('thead th'))
                .map(cellule => cellule.textContent.trim());

            const lignes = Array.from(element.querySelectorAll('tbody tr'))
                .map(ligne => Array.from(ligne.cells)
                    .map(cellule => cellule.textContent.trim()));

            if (typeof doc.autoTable === 'function' && lignes.length > 0) {
                doc.autoTable({
                    startY: y,
                    head: entetes.length ? [entetes] : undefined,
                    body: lignes,
                    margin: { left: 14, right: 14 },
                    styles: {
                        font: 'helvetica',
                        fontSize: 9,
                        textColor: grisTexte,
                        cellPadding: 2.5,
                        overflow: 'linebreak'
                    },
                    headStyles: {
                        fillColor: [242, 242, 242],
                        textColor: [44, 62, 80],
                        fontStyle: 'bold'
                    },
                    theme: 'grid'
                });
                y = doc.lastAutoTable.finalY + 6;
            } else {
                // Repli lisible si autoTable n'est pas disponible.
                if (entetes.length) {
                    ecrireTexte(entetes.join(' — '), {
                        style: 'bold',
                        espacementApres: 1
                    });
                }
                lignes.forEach(ligne => {
                    ecrireTexte(ligne.join(' — '), {
                        retrait: 2,
                        prefixe: '•  ',
                        espacementApres: 1
                    });
                });
                y += 3;
            }
        }
    });

    // --- NUMÉROTATION DYNAMIQUE DES PAGES ---
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i}/${totalPages}`, 196, 287, { align: 'right' });
    }

    doc.save('Mode_d_emploi_Calculateur.pdf');
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

    const joursRows = construireJoursRows(lireLignesHoraires());

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
    const horaireTypeBaseHHMM = obtenirHoraireTypeBaseHHMM();
    semaines.forEach(sem => {
        const key = `sem_${sem.num}_${sem.debut.replace(/\//g, '_')}`;
        const saved = tableauSemainesData[key] || { h: "", hs: "", hr: "", c: "" };
        const vacInfo = estEnVacances(sem.dateObjetDebut, sem.dateObjetFin);

        const heuresAff = obtenirHeuresPourSemaine(
            saved.h,
            vacInfo.enVacances,
            horaireTypeBaseHHMM
        );

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

    doc.save(`Bilan_Horaire_${assainirNomFichier(nom)}_${assainirNomFichier(prenom)}.pdf`);
}

// ==========================================
// REMISES À ZERO
// ==========================================
async function resetAgent() {
    // Réinitialiser uniquement les informations et la configuration de l'onglet 1.
    const nomAgent = document.getElementById("nomAgent");
    const prenomAgent = document.getElementById("prenomAgent");
    const posteAgent = document.getElementById("posteAgent");
    const quotiteSelect = document.getElementById("quotiteSelect");
    const zoneSelect = document.getElementById("zoneScolaireSelect");
    const anneeSelect = document.getElementById("anneeScolaireSelect");

    if (nomAgent) nomAgent.value = "";
    if (prenomAgent) prenomAgent.value = "";
    if (posteAgent) posteAgent.value = "";
    if (quotiteSelect) quotiteSelect.value = "100";
    if (zoneSelect) zoneSelect.value = "A";

    // Revenir à l'année scolaire courante, selon la même règle que lors
    // de la génération initiale des options (année scolaire dès septembre).
    const maintenant = new Date();
    const anneeScolaireCourante = maintenant.getMonth() >= 8
        ? maintenant.getFullYear()
        : maintenant.getFullYear() - 1;

    if (anneeSelect) {
        anneeSelect.value = String(anneeScolaireCourante);
    }

    // Recalculer seulement les éléments dépendant de l'onglet 1.
    // Les horaires et les saisies du tableau annuel ne sont pas effacés.
    await initialiserCalendrierDynamique();
    mettreAJourInfoAnneeScolaire();
    updateQuotiteAndResults();
    genererTableauSemaines();
    calculerResultats();
    sauvegarderImmediatement();

    afficherToast("Informations de l'agent réinitialisées.", "info");
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

// ==========================================
// EXPORT PDF HORAIRES HEBDOMADAIRES
// ==========================================

function exporterHorairesPDF() {
    const { jsPDF } = window.jspdf;
    // Paysage (landscape)
    const doc = new jsPDF('l', 'mm', 'a4');

    const bleuPrimaire = [0, 0, 145];
    const grisTexte = [60, 60, 60];
    const grisLeger = [200, 200, 200];
    const pageW = doc.internal.pageSize.width;  // 297mm en paysage
    const pageH = doc.internal.pageSize.height; // 210mm en paysage
    const mL = 14, mR = 14;

    // Identité et année scolaire
    const nom = (document.getElementById("nomAgent")?.value || "Agent").toUpperCase();
    const prenom = document.getElementById("prenomAgent")?.value || "";
    const anneeSelectEl = document.getElementById("anneeScolaireSelect");
    const anneeScolaire = anneeSelectEl ? anneeSelectEl.options[anneeSelectEl.selectedIndex].text : "";
    const posteAgent = (document.getElementById("posteAgent")?.value || "").trim();

    // ── EN-TÊTE ─────────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(bleuPrimaire[0], bleuPrimaire[1], bleuPrimaire[2]);

    // 1. Titre mis à jour de manière dynamique avec l'année scolaire
    doc.text(`Horaires hebdomadaires - Année scolaire ${anneeScolaire}`, mL, 20);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(grisTexte[0], grisTexte[1], grisTexte[2]);

    // 2. Logique conditionnelle : Si le poste est renseigné, on l'affiche à la place de la quotité.
    // Sinon, on affiche uniquement l'identité de l'agent sans mention alternative.
    if (posteAgent !== "") {
        doc.text(`Agent : ${prenom} ${nom}   |   Poste : ${posteAgent}`, mL, 29);
    } else {
        doc.text(`Agent : ${prenom} ${nom}`, mL, 29);
    }

    doc.setDrawColor(grisLeger[0], grisLeger[1], grisLeger[2]);
    doc.setLineWidth(0.5);
    doc.line(mL, 33, pageW - mR, 33);

    // ── TABLEAU DES JOURS ───────────────────────────────────
    const joursRows = construireJoursRows(lireLignesHoraires());

    doc.autoTable({
        startY: 39,
        margin: { left: mL, right: mR },
        head: [['Jour', 'Début matin', 'Fin matin', 'H matin', 'Début APM', 'Fin APM', 'H APM', 'Total journalier']],
        body: convertirJoursRowsPourPaysage(joursRows),
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

    doc.save(`Horaires_${assainirNomFichier(nom)}_${assainirNomFichier(prenom)}.pdf`);
}

// ==========================================
// EXPORT EXCEL
// ==========================================

function exporterExcel() {
    if (typeof XLSX === 'undefined') {
        afficherToast("La bibliothèque Excel n'est pas disponible. Vérifiez votre connexion.", 'erreur', 5000);
        return;
    }

    const nom = (document.getElementById("nomAgent")?.value || "Agent").toUpperCase();
    const prenom = document.getElementById("prenomAgent")?.value || "";
    const quotiteEl = document.getElementById("quotiteSelect");
    const quotite = quotiteEl ? quotiteEl.value + " %" : "100 %";
    const heuresRefEl = document.getElementById("heuresMaxInput");
    const heuresRef = heuresRefEl ? heuresRefEl.value : "";
    const anneeEl = document.getElementById("anneeScolaireSelect");
    const anneeLabel = anneeEl ? anneeEl.options[anneeEl.selectedIndex]?.text || "" : "";

    const wb = XLSX.utils.book_new();

    // ── FEUILLE 1 : TABLEAU DES SEMAINES ────────────────────
    const entetesSemaines = ["Semaine", "Du", "Au", "Type", "Heures", "H. Sup", "H. Récup", "Commentaire"];
    const lignesSemaines = [
        [`Agent : ${prenom} ${nom}   |   Quotité : ${quotite}   |   Référence : ${heuresRef}   |   Année : ${anneeLabel}`],
        [],
        entetesSemaines
    ];

    document.querySelectorAll('#semainesTableContent tr').forEach(row => {
        const cellSemaine = row.querySelector('td:nth-child(1)');
        const cellType = row.querySelector('td:nth-child(2)');
        const inputHeures = row.querySelector('.s-heures');
        const inputSup = row.querySelector('.s-heures-sup');
        const inputRecup = row.querySelector('.s-heures-recup');
        const inputComm = row.querySelector('.s-comm');
        if (!cellSemaine) return;

        // Extraire numéro et dates depuis la cellule "Semaine"
        const textes = cellSemaine.innerText.split('\n').map(s => s.trim()).filter(Boolean);
        const numSem = textes[0] || "";  // "Semaine 36"
        const dates = textes[1] || "";  // "du 31/08/2026 au 06/09/2026"
        const matchDates = dates.match(/(\d{2}\/\d{2}\/\d{4})/g) || [];
        const dateDebut = matchDates[0] || "";
        const dateFin = matchDates[1] || "";

        lignesSemaines.push([
            numSem,
            dateDebut,
            dateFin,
            cellType?.textContent.trim() || "",
            inputHeures?.value || "",
            inputSup?.value || "",
            inputRecup?.value || "",
            inputComm?.value || ""
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
        ["Heures effectuées hors vacances scolaires", val("resScolaire")],
        ["Heures effectuées pendant les vacances", val("resVacances")],
        ["Heures supplémentaires comptabilisées", val("resSup")],
        ["Heures récupérées / déduites", val("resRecup")],
        ["TOTAL GÉNÉRAL RÉALISÉ", val("resTotal")],
        ["Volume annuel de référence obligatoire", val("resReference")],
        ["Écart (Balance annuelle)", val("resEcart")]
    ];

    const wsResultats = XLSX.utils.aoa_to_sheet(lignesResultats);
    wsResultats['!cols'] = [{ wch: 48 }, { wch: 16 }];
    wsResultats['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];

    XLSX.utils.book_append_sheet(wb, wsResultats, "Résultats");

    // ── TÉLÉCHARGEMENT ──────────────────────────────────────
    const nomFichier = `Bilan_EPLE_${assainirNomFichier(nom)}_${assainirNomFichier(prenom)}_${assainirNomFichier(anneeLabel)}.xlsx`;
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
    ajouterLibellesAccessiblesHoraires();
    calculerTotalHebdo();
    genererTableauSemaines();
    calculerResultats();
};

// ===== SCRIPT POUR LE FORMULAIRE DE CONTACT =====
document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("app-version").textContent = APP_VERSION;

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

// ==========================================
// RÉINITIALISATION GLOBALE DE L'APPLICATION
// ==========================================
async function resetApplication() {
    const confirmation = await confirmerAsync(
        "Voulez-vous vraiment réinitialiser complètement l'outil ? Toutes vos données saisies seront définitivement effacées.",
        "Effacer tout"
    );

    if (confirmation) {
        localStorage.removeItem('eple_calculateur');
        afficherToast("Application réinitialisée. Rechargement...", "succes");
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }
}

// Compatibilité avec tous les gestionnaires HTML inline.
// En script classique, les déclarations sont déjà globales ; cet assignement explicite
// documente le contrat public et évite toute ambiguïté lors d'un futur refactoring.
Object.assign(window, {
    appliquerHorairesHorsVacances,
    calculerTotalHebdo,
    changerConfigurationCalendrier,
    changerOnglet,
    confirmerReponse,
    copierTotalHebdo,
    dupliquerJour,
    exporterExcel,
    exporterHorairesPDF,
    exporterModeEmploiPDF,
    exporterPDF,
    resetAgent,
    resetApplication,
    resetHorairesHebdo,
    resetTableauAnnuel,
    updateQuotiteAndResults
});

// Mettre à jour tous les éléments avec l'ID "app-version"
document.addEventListener("DOMContentLoaded", function () {
    const versionElements = document.querySelectorAll("#app-version");
    versionElements.forEach(element => {
        element.textContent = APP_VERSION;
    });
});