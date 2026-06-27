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

function sauvegarderTout() {
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
// CALENDRIER DYNAMIQUE & API VACANCES MINISTÈRE
// ==========================================
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

    await chargerVacancesDepuisAPI(anneeDepart, zoneChoisie);

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

    semaines.forEach(sem => {
        const vacInfo = estEnVacances(sem.dateObjetDebut, sem.dateObjetFin);
        const tr = document.createElement("tr");

        if (vacInfo.enVacances) {
            tr.style.backgroundColor = "#fff9c4";
        }

        const key = `sem_${sem.num}_${sem.debut.replace(/\//g, '_')}`;
        const saved = tableauSemainesData[key] || { h: "", hs: "", hr: "", c: "" };

        let affichageHeures = saved.h;
        if (affichageHeures === "") {
            affichageHeures = vacInfo.enVacances ? "00:00" : horaireTypeBaseHHMM;
        }

        tr.innerHTML = `
            <td><strong>Semaine ${sem.num}</strong><br><small style="color:#555;">du ${sem.debut} au ${sem.fin}</small></td>
            <td><span class="badge" style="background:${vacInfo.enVacances ? '#f39c12' : '#27ae60'}; color:#fff; padding:3px 6px; border-radius:3px; font-size:11px;">${vacInfo.enVacances ? 'Vacances' : 'Scolaire'}</span></td>
            <td><input type="text" class="s-heures" data-key="${key}" value="${affichageHeures}" placeholder="35:00" maxlength="5" oninput="sauvegarderSemaineEnLigne(this)"></td>
            <td><input type="text" class="s-heures-sup" data-key="${key}" value="${saved.hs || '00:00'}" placeholder="00:00" maxlength="5" oninput="sauvegarderSemaineEnLigne(this)"></td>
            <td><input type="text" class="s-heures-recup" data-key="${key}" value="${saved.hr || '00:00'}" placeholder="00:00" maxlength="5" oninput="sauvegarderSemaineEnLigne(this)"></td>
            <td style="min-width: 250px; width: 33%;">
                <textarea class="s-comm" data-key="${key}" placeholder="..." style="width: 100% !important; box-sizing: border-box; resize: vertical; min-height: 38px; height: 38px; font-family: inherit; font-size: inherit; padding: 4px; vertical-align: middle;" oninput="sauvegarderSemaineEnLigne(this)">${saved.c || ''}</textarea>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function changerConfigurationCalendrier() {
    await initialiserCalendrierDynamique();
    genererTableauSemaines();
    calculerResultats();
    sauvegarderTout();
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
        alert(`Valeur copiée avec succès : ${decimal.toFixed(2)}h`);
    }
}

function appliquerHorairesHorsVacances() {
    genererTableauSemaines();
    calculerResultats();
    sauvegarderTout();
    alert("Les horaires types ont été appliqués sur l'ensemble des semaines scolaires.");
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

    const reponse = prompt(
        `Duplication des horaires de ${jourSource} :\n` +
        `Saisissez les jours cibles séparés par une virgule (ex: Mardi, Jeudi, Vendredi) :`
    );
    if (!reponse) return;

    const dm = rowSource.querySelector('.debut-matin').value;
    const fm = rowSource.querySelector('.fin-matin').value;
    const da = rowSource.querySelector('.debut-apm').value;
    const fa = rowSource.querySelector('.fin-apm').value;

    const joursCibles = reponse.split(',').map(j => j.trim().toLowerCase());

    document.querySelectorAll('#heuresTable tbody tr').forEach(rowCible => {
        const jCible = rowCible.cells[0].textContent.trim().toLowerCase();
        if (joursCibles.includes(jCible) && jCible !== jourSource.toLowerCase()) {
            rowCible.querySelector('.debut-matin').value = dm;
            rowCible.querySelector('.fin-matin').value = fm;
            rowCible.querySelector('.debut-apm').value = da;
            rowCible.querySelector('.fin-apm').value = fa;
        }
    });
    calculerTotalHebdo();
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

    const bleuPrimaire  = [0, 0, 145];
    const rougeAccent   = [201, 25, 30];
    const grisTexte     = [60, 60, 60];
    const grisLeger     = [200, 200, 200];
    const pageW = doc.internal.pageSize.width;
    const pageH = doc.internal.pageSize.height;
    const mL = 14, mR = 14;

    // Identité
    const nomInput    = document.getElementById("nomAgent");
    const prenomInput = document.getElementById("prenomAgent");
    const nom    = (nomInput    && nomInput.value    ? nomInput.value    : "Agent").toUpperCase();
    const prenom = (prenomInput && prenomInput.value ? prenomInput.value : "");
    const quotiteEl = document.getElementById("quotiteSelect");
    const quotite   = quotiteEl ? quotiteEl.value + " %" : "100 %";
    const heuresRefEl = document.getElementById("heuresMaxInput");
    const heuresRef   = heuresRefEl ? heuresRefEl.value : "1593h 00";

    // Helper : saut de page si besoin
    function checkY(needed) {
        if (y + needed > pageH - 18) { doc.addPage(); y = 18; ajouterEnTete(); }
    }

    // En-tête répété sur chaque page
    function ajouterEnTete() {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(bleuPrimaire[0], bleuPrimaire[1], bleuPrimaire[2]);
        doc.text("BILAN ANNUEL DE TEMPS DE TRAVAIL", mL, 10);
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
    doc.text("BILAN ANNUEL DE TEMPS DE TRAVAIL", mL, 22);

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
        const jour    = row.cells[0] ? row.cells[0].textContent.trim() : "";
        const dm      = row.querySelector('.debut-matin')  ? row.querySelector('.debut-matin').value  || "—" : "—";
        const fm      = row.querySelector('.fin-matin')    ? row.querySelector('.fin-matin').value    || "—" : "—";
        const hm      = row.querySelector('.heures-matin') ? row.querySelector('.heures-matin').textContent.trim() : "—";
        const da      = row.querySelector('.debut-apm')    ? row.querySelector('.debut-apm').value    || "—" : "—";
        const fa      = row.querySelector('.fin-apm')      ? row.querySelector('.fin-apm').value      || "—" : "—";
        const ha      = row.querySelector('.heures-apm')   ? row.querySelector('.heures-apm').textContent.trim()  : "—";
        const total   = row.querySelector('.total-jour')   ? row.querySelector('.total-jour').textContent.trim()  : "—";
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
        headStyles: { fillColor: bleuPrimaire, textColor: [255,255,255], fontStyle: 'bold', fontSize: 9 },
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
        const key   = `sem_${sem.num}_${sem.debut.replace(/\//g, '_')}`;
        const saved = tableauSemainesData[key] || { h: "", hs: "", hr: "", c: "" };
        const vacInfo = estEnVacances(sem.dateObjetDebut, sem.dateObjetFin);

        const champHV   = document.getElementById('horaireHorsVacances');
        const valHV     = champHV ? parseFloat(champHV.value) : 0;
        let heuresAff;
        if (saved.h !== "") {
            heuresAff = saved.h;
        } else if (vacInfo.enVacances) {
            heuresAff = "00:00";
        } else if (valHV > 0) {
            const hE = Math.floor(valHV);
            const mE = Math.round((valHV - hE) * 60);
            heuresAff = `${hE}:${String(mE).padStart(2,'0')}`;
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
            saved.c  || ""
        ]);
    });

    doc.autoTable({
        startY: y,
        margin: { left: mL, right: mR },
        head: [['Sem.', 'Période', 'Type', 'Heures', 'H. Sup', 'H. Récup', 'Commentaire']],
        body: semRows,
        theme: 'striped',
        headStyles: { fillColor: bleuPrimaire, textColor: [255,255,255], fontStyle: 'bold', fontSize: 8 },
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
        didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 2) {
                if (data.cell.text[0] === 'Vacances') {
                    data.cell.styles.textColor = [180, 100, 0];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        },
        didDrawPage: function() { y = doc.lastAutoTable.finalY + 6; }
    });
    y = doc.lastAutoTable.finalY + 10;

    // ── SECTION 3 : RÉSULTATS (onglet 4) ───────────────────
    checkY(60);
    sectionTitre("3. Résultats annuels");

    const refElement    = document.getElementById("resReference");
    const valeurRef     = refElement ? refElement.textContent.trim() : heuresRef;
    const ecartTexte    = val("resEcart");
    const ecartNegatif  = ecartTexte.includes('-');
    const ecartPositif  = ecartTexte.includes('+') && !ecartTexte.includes('0h 00');

    doc.autoTable({
        startY: y,
        margin: { left: mL, right: mR },
        head: [['Indicateur', 'Volume horaire']],
        body: [
            ["Heures scolaires réalisées",        val("resScolaire")],
            ["Heures de vacances réalisées",       val("resVacances")],
            ["Heures supplémentaires comptées",    val("resSup")],
            ["Heures déduites / récupérées",       val("resRecup")],
            ["TOTAL ANNUEL CALCULÉ",               val("resTotal")],
            ["Obligation réglementaire de référence", valeurRef],
            ["Balance (Écart annuel)",             ecartTexte]
        ],
        theme: 'striped',
        headStyles: { fillColor: bleuPrimaire, textColor: [255,255,255], fontStyle: 'bold', fontSize: 10 },
        styles: { fontSize: 10, cellPadding: 4 },
        didParseCell: function(data) {
            if (data.row.index === 4) {
                data.cell.styles.fontStyle = 'bold';
            }
            if (data.row.index === 6) {
                data.cell.styles.fontStyle = 'bold';
                if (data.section === 'body' && data.column.index === 1) {
                    if (ecartNegatif)       data.cell.styles.textColor = rougeAccent;
                    else if (ecartPositif)  data.cell.styles.textColor = [39, 174, 96];
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
}

function resetHorairesHebdo() {
    document.querySelectorAll('#heuresTable input').forEach(i => i.value = "");
    document.getElementById("nbPauses").value = "0";
    const champHV = document.getElementById("horaireHorsVacances");
    if (champHV) champHV.value = "0";
    calculerTotalHebdo();
    sauvegarderTout();
}

function resetTableauAnnuel() {
    if (confirm("Voulez-vous réinitialiser toutes les saisies manuelles des semaines ?")) {
        tableauSemainesData = {};
        genererTableauSemaines();
        calculerResultats();
        sauvegarderTout();
    }
}

function resetApplication() {
    if (confirm("Tout effacer et recommencer à zéro ?")) {
        localStorage.removeItem('eple_calculateur');
        window.location.reload();
    }
}

// ==========================================
// DEMARRAGE AUTOMATIQUE
// ==========================================
window.onload = async function () {
    restaurerSauvegarde();

    // CORRECTION : Si aucune sauvegarde n'existe, on force le champ à 0 pour éviter les 35h par défaut du HTML
    const champHV = document.getElementById("horaireHorsVacances");
    if (champHV && !localStorage.getItem('eple_calculateur')) {
        champHV.value = "0";
    }

    await initialiserCalendrierDynamique();
    updateQuotiteAndResults();
    calculerTotalHebdo();
    genererTableauSemaines();
    calculerResultats();
};