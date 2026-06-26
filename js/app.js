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

    // Déclenchement des calculs ou générations selon l'onglet
    if (ongletId === 'semaines') {
        genererTableauSemaines();
    } else if (ongletId === 'resultats') {
        calculerResultats();
    }
}

// ======================
// SAUVEGARDE LOCALE
// ======================

function sauvegarderTout() {
    const data = {};
    document.querySelectorAll('input, textarea, select').forEach(el => {
        const key = el.id || el.name;
        if (key) data[key] = el.value;
    });

    const horaires = [];
    document.querySelectorAll('#heuresTable tbody tr').forEach(row => {
        horaires.push({
            dm: row.querySelector('.debut-matin').value,
            fm: row.querySelector('.fin-matin').value,
            da: row.querySelector('.debut-apm').value,
            fa: row.querySelector('.fin-apm').value
        });
    });
    data['__horaires'] = JSON.stringify(horaires);
    data['__tableauSemainesData'] = JSON.stringify(tableauSemainesData);

    localStorage.setItem('eple_calculateur', JSON.stringify(data));
}

document.addEventListener('input', sauvegarderTout);
document.addEventListener('change', sauvegarderTout);

function restaurerSauvegarde() {
    try {
        const data = JSON.parse(localStorage.getItem('eple_calculateur') || '{}');

        if (data['__tableauSemainesData']) {
            Object.assign(tableauSemainesData, JSON.parse(data['__tableauSemainesData']));
        }

        Object.entries(data).forEach(([k, v]) => {
            if (k.startsWith('__')) return;
            const el = document.getElementById(k);
            if (el) el.value = v;
        });

        if (data['__horaires']) {
            const horaires = JSON.parse(data['__horaires']);
            document.querySelectorAll('#heuresTable tbody tr').forEach((row, i) => {
                if (!horaires[i]) return;
                row.querySelector('.debut-matin').value = horaires[i].dm || '';
                row.querySelector('.fin-matin').value = horaires[i].fm || '';
                row.querySelector('.debut-apm').value = horaires[i].da || '';
                row.querySelector('.fin-apm').value = horaires[i].fa || '';
                updateRow(row);
            });
        }

    } catch (e) { console.warn('Restauration sauvegarde :', e); }
}

// ======================
// FONCTIONS UTILITAIRES
// ======================
function formatHeure(heures) {
    if (heures === undefined || heures === null || isNaN(heures)) {
        return "0h00";
    }
    const heuresEntieres = Math.floor(heures);
    const minutes = Math.round((heures - heuresEntieres) * 60);
    const minutesFormatees = minutes < 10 ? `0${minutes}` : minutes;
    return `${heuresEntieres}h${minutesFormatees}`;
}

function formatHeurePourAffichage(heures) {
    return formatHeure(heures);
}

// ======================
// DONNÉES GLOBALES
// ======================

const vacances = [
    { nom: "Toussaint", debut: new Date(2026, 9, 19), fin: new Date(2026, 10, 1), semaines: [] },
    { nom: "Noël", debut: new Date(2026, 11, 21), fin: new Date(2027, 0, 3), semaines: [] },
    { nom: "Hiver", debut: new Date(2027, 1, 15), fin: new Date(2027, 1, 28), semaines: [] },
    { nom: "Printemps", debut: new Date(2027, 3, 12), fin: new Date(2027, 3, 25), semaines: [] },
    { nom: "Été", debut: new Date(2027, 6, 5), fin: new Date(2027, 7, 31), semaines: [] }
];

const tempsPlein = { effectif: 1593, fractionnement: 14, total: 1607 };

const semaines = [
    { num: 36, debut: "31/08/2026", fin: "05/09/2026" },
    { num: 37, debut: "07/09/2026", fin: "12/09/2026" },
    { num: 38, debut: "14/09/2026", fin: "19/09/2026" },
    { num: 39, debut: "21/09/2026", fin: "26/09/2026" },
    { num: 40, debut: "28/09/2026", fin: "03/10/2026" },
    { num: 41, debut: "05/10/2026", fin: "10/10/2026" },
    { num: 42, debut: "12/10/2026", fin: "17/10/2026" },
    { num: 43, debut: "19/10/2026", fin: "24/10/2026" },
    { num: 44, debut: "26/10/2026", fin: "31/10/2026" },
    { num: 45, debut: "02/11/2026", fin: "07/11/2026" },
    { num: 46, debut: "09/11/2026", fin: "14/11/2026" },
    { num: 47, debut: "16/11/2026", fin: "21/11/2026" },
    { num: 48, debut: "23/11/2026", fin: "28/11/2026" },
    { num: 49, debut: "30/11/2026", fin: "05/12/2026" },
    { num: 50, debut: "07/12/2026", fin: "12/12/2026" },
    { num: 51, debut: "14/12/2026", fin: "19/12/2026" },
    { num: 52, debut: "21/12/2026", fin: "26/12/2026" },
    { num: 53, debut: "28/12/2026", fin: "02/01/2027" },
    { num: 1, debut: "04/01/2027", fin: "09/01/2027" },
    { num: 2, debut: "11/01/2027", fin: "16/01/2027" },
    { num: 3, debut: "18/01/2027", fin: "23/01/2027" },
    { num: 4, debut: "25/01/2027", fin: "30/01/2027" },
    { num: 5, debut: "01/02/2027", fin: "06/02/2027" },
    { num: 6, debut: "08/02/2027", fin: "13/02/2027" },
    { num: 7, debut: "15/02/2027", fin: "20/02/2027" },
    { num: 8, debut: "22/02/2027", fin: "27/02/2027" },
    { num: 9, debut: "01/03/2027", fin: "06/03/2027" },
    { num: 10, debut: "08/03/2027", fin: "13/03/2027" },
    { num: 11, debut: "15/03/2027", fin: "20/03/2027" },
    { num: 12, debut: "22/03/2027", fin: "27/03/2027" },
    { num: 13, debut: "29/03/2027", fin: "03/04/2027" },
    { num: 14, debut: "05/04/2027", fin: "10/04/2027" },
    { num: 15, debut: "12/04/2027", fin: "17/04/2027" },
    { num: 16, debut: "19/04/2027", fin: "24/04/2027" },
    { num: 17, debut: "26/04/2027", fin: "01/05/2027" },
    { num: 18, debut: "03/05/2027", fin: "08/05/2027" },
    { num: 19, debut: "10/05/2027", fin: "15/05/2027" },
    { num: 20, debut: "17/05/2027", fin: "22/05/2027" },
    { num: 21, debut: "24/05/2027", fin: "29/05/2027" },
    { num: 22, debut: "31/05/2027", fin: "05/06/2027" },
    { num: 23, debut: "07/06/2027", fin: "12/06/2027" },
    { num: 24, debut: "14/06/2027", fin: "19/06/2027" },
    { num: 25, debut: "21/06/2027", fin: "26/06/2027" },
    { num: 26, debut: "28/06/2027", fin: "03/07/2027" },
    { num: 27, debut: "05/07/2027", fin: "10/07/2027" },
    { num: 28, debut: "12/07/2027", fin: "17/07/2027" },
    { num: 29, debut: "19/07/2027", fin: "24/07/2027" },
    { num: 30, debut: "26/07/2027", fin: "31/07/2027" },
    { num: 31, debut: "02/08/2027", fin: "07/08/2027" },
    { num: 32, debut: "09/08/2027", fin: "14/08/2027" },
    { num: 33, debut: "16/08/2027", fin: "21/08/2027" },
    { num: 34, debut: "23/08/2027", fin: "28/08/2027" },
    { num: 35, debut: "30/08/2027", fin: "04/09/2027" }
];

let tableauSemainesData = {};

// ======================
// FONCTIONS UTILITAIRES DATES
// ======================
function formaterDate(dateStr) {
    const [jour, mois, annee] = dateStr.split('/');
    return new Date(`${annee}-${mois}-${jour}`);
}

function estEnVacances(debutSemaine, finSemaine) {
    for (const vacance of vacances) {
        if (debutSemaine <= vacance.fin && finSemaine >= vacance.debut) {
            return { enVacances: true, nom: vacance.nom };
        }
    }
    return { enVacances: false, nom: "Hors vacances" };
}

function getNomVacances(debutStr, finStr) {
    const debut = formaterDate(debutStr);
    const fin = formaterDate(finStr);
    const result = estEnVacances(debut, fin);
    return result.nom;
}

// ======================
// ONGLET 1 : QUOTITÉ
// ======================
function updateQuotiteAndResults() {
    const elQuotite = document.getElementById("quotiteSelect");
    if (!elQuotite) return;

    const quotite = parseInt(elQuotite.value);
    const heuresMax = (1593 * quotite) / 100;

    const elHeuresMax = document.getElementById("heuresMaxInput");
    if (elHeuresMax) {
        elHeuresMax.value = heuresMax.toFixed(2) + " (" + formatHeure(heuresMax) + ")";
    }
    window.currentQuotite = quotite;

    const elResultats = document.getElementById("resultats");
    if (elResultats && elResultats.classList.contains("active")) {
        calculerResultats();
    }
}

// ======================
// ONGLET 2 : HORAIRES
// ======================
function timeToMinutes(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return 0;
    return h * 60 + m;
}

function minutesToTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${String(m).padStart(2, '0')}`;
}

function calculateDuration(debut, fin) {
    const d = timeToMinutes(debut), f = timeToMinutes(fin);
    if (!debut || !fin) return 0;
    let dur = f - d;
    if (dur < 0) dur += 1440;
    return dur;
}

function updateRow(row) {
    const dm = row.querySelector('.debut-matin').value;
    const fm = row.querySelector('.fin-matin').value;
    const da = row.querySelector('.debut-apm').value;
    const fa = row.querySelector('.fin-apm').value;

    const matin = calculateDuration(dm, fm);
    const apm = calculateDuration(da, fa);

    row.querySelector('.heures-matin').textContent = minutesToTime(matin);
    row.querySelector('.heures-apm').textContent = minutesToTime(apm);
    row.querySelector('.total-jour').textContent = minutesToTime(matin + apm);
}

function calculerTotalHebdo() {
    let total = 0;
    document.querySelectorAll('#heuresTable tbody tr').forEach(row => {
        const dm = row.querySelector('.debut-matin').value;
        const fm = row.querySelector('.fin-matin').value;
        const da = row.querySelector('.debut-apm').value;
        const fa = row.querySelector('.fin-apm').value;
        total += calculateDuration(dm, fm) + calculateDuration(da, fa);
    });

    const nbPauses = parseInt(document.getElementById('nbPauses').value) || 0;
    total += nbPauses * 20;

    const heures = total / 60;
    window.currentHeuresHebdo = heures;

    document.getElementById('totalHebdo').textContent = minutesToTime(total);
    document.getElementById('horaireHorsVacances').value = heures.toFixed(2);
}

function copierTotalHebdo() {
    const total = window.currentHeuresHebdo || 0;
    document.getElementById("horaireHorsVacances").value = total.toFixed(2);
    appliquerHorairesHorsVacances();
}

function appliquerHorairesHorsVacances() {
    const horaire = parseFloat(document.getElementById("horaireHorsVacances").value) || 0;
    const inputs = document.querySelectorAll(".heures-input[data-en-vacances='false']");
    inputs.forEach(input => {
        input.value = horaire.toFixed(2);
        const semaineNum = input.getAttribute("data-semaine");
        if (!tableauSemainesData[semaineNum]) {
            tableauSemainesData[semaineNum] = {};
        }
        tableauSemainesData[semaineNum].heures = horaire;
    });
    calculerResultats();
}

// ======================
// ONGLET 3 : TABLEAU DES SEMAINES
// ======================
function heuresVersDecimal(valeur) {
    if (!valeur) return 0;

    valeur = valeur.toString().trim();

    if (valeur.includes(':')) {
        const [h, m] = valeur.split(':').map(Number);

        if (isNaN(h) || isNaN(m)) return 0;

        return h + (m / 60);
    }

    return parseFloat(valeur) || 0;
}

function decimalVersHeures(valeur) {
    const heures = Math.floor(valeur);
    const minutes = Math.round((valeur - heures) * 60);

    return `${heures}:${String(minutes).padStart(2, '0')}`;
}

function genererTableauSemaines() {
    const tableau = document.getElementById("tableauSemaines");
    if (!tableau) return;
    tableau.innerHTML = "";

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");

    const headerRow = document.createElement("tr");
    ["N° Semaine", "Date début", "Date fin", "Type", "Heures", "Heures Sup", "Heures Récup", "Commentaires"].forEach(text => {
        const th = document.createElement("th");
        th.textContent = text;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const horaireBaseInput = document.getElementById("horaireHorsVacances");
    const horaireDefault = horaireBaseInput ? horaireBaseInput.value : "0.00";

    semaines.forEach(semaine => {
        const debut = formaterDate(semaine.debut);
        const fin = formaterDate(semaine.fin);
        const result = estEnVacances(debut, fin);

        const row = document.createElement("tr");
        if (result.enVacances) {
            row.classList.add("vacances");
        }

        const semaineData = tableauSemainesData[semaine.num] || {};
        const heures = semaineData.heures !== undefined
            ? decimalVersHeures(semaineData.heures)
            : decimalVersHeures(parseFloat(result.enVacances ? 0 : horaireDefault));
        const heuresSup = semaineData.heuresSup !== undefined
            ? decimalVersHeures(semaineData.heuresSup)
            : "0:00";
        const heuresRecup = semaineData.heuresRecup !== undefined
            ? decimalVersHeures(semaineData.heuresRecup)
            : "0:00";
        const comment = semaineData.comment !== undefined ? semaineData.comment : "";

        row.innerHTML = `
            <td>${semaine.num}</td>
            <td>${semaine.debut}</td>
            <td>${semaine.fin}</td>
            <td>${result.nom}</td>
            <td>
                <input type="text" class="heures-input" data-semaine="${semaine.num}"
                       data-en-vacances="${result.enVacances}" step="any" min="0"
                       value="${heures}" onchange="sauvegarderDonneesSemaine(${semaine.num}, 'heures', this.value); calculerResultats()">
            </td>
            <td>
                <input type="text" class="heures-sup-input" data-semaine="${semaine.num}" step="any" min="0"
                       value="${heuresSup}" onchange="sauvegarderDonneesSemaine(${semaine.num}, 'heuresSup', this.value); calculerResultats()">
            </td>
            <td>
                <input type="text" class="heures-recup-input" data-semaine="${semaine.num}" step="any" min="0"
                       value="${heuresRecup}" onchange="sauvegarderDonneesSemaine(${semaine.num}, 'heuresRecup', this.value); calculerResultats()">
            </td>
            <td>
                <textarea class="comment-input" data-semaine="${semaine.num}" placeholder="Détails..."
                          onchange="sauvegarderDonneesSemaine(${semaine.num}, 'comment', this.value); calculerResultats()">${comment}</textarea>
            </td>
        `;
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableau.appendChild(table);
}

function sauvegarderDonneesSemaine(semaineNum, champ, valeur) {

    if (!tableauSemainesData[semaineNum]) {
        tableauSemainesData[semaineNum] = {};
    }

    if (champ !== 'comment') {
        tableauSemainesData[semaineNum][champ] = heuresVersDecimal(valeur);
    } else {
        tableauSemainesData[semaineNum][champ] = valeur;
    }
}

// ======================
// ONGLET 4 : RÉSULTATS
// ======================
function calculerResultats() {
    const quotiteValue = window.currentQuotite || 100;
    const tempsBase = (1593 * quotiteValue) / 100;

    let totalHorsVacances = 0;
    let totalVacances = 0;
    let totalHeuresSup = 0;
    let totalHeuresRecup = 0;

    const horaireBaseInput = document.getElementById("horaireHorsVacances");
    const horaireDefault = horaireBaseInput ? parseFloat(horaireBaseInput.value) || 0 : 0;

    semaines.forEach(semaine => {
        const semaineData = tableauSemainesData[semaine.num] || {};
        const debut = formaterDate(semaine.debut);
        const fin = formaterDate(semaine.fin);
        const result = estEnVacances(debut, fin);

        const heures = semaineData.heures !== undefined ? semaineData.heures : (result.enVacances ? 0 : horaireDefault);
        const heuresSup = semaineData.heuresSup !== undefined ? semaineData.heuresSup : 0;
        const heuresRecup = semaineData.heuresRecup !== undefined ? semaineData.heuresRecup : 0;

        if (result.enVacances) {
            totalVacances += heures;
        } else {
            totalHorsVacances += heures;
        }
        totalHeuresSup += heuresSup;
        totalHeuresRecup += heuresRecup;
    });

    const totalHeures = totalHorsVacances + totalVacances + totalHeuresSup - totalHeuresRecup;
    const difference = totalHeures - tempsBase;

    const resultatsDiv = document.getElementById("resultatsCalculs");
    if (!resultatsDiv) return;

    resultatsDiv.innerHTML = `
        <div class="result">
            <p><strong>Quotité :</strong> ${quotiteValue}%</p>
            <p><strong>Temps de travail de base (hors fractionnement) :</strong> ${tempsBase.toFixed(2)} h (${formatHeure(tempsBase)})</p>
            <hr>
            <p><strong>Heures hors vacances scolaires :</strong> ${totalHorsVacances.toFixed(2)} h (${formatHeure(totalHorsVacances)})</p>
            <p><strong>Heures pendant vacances scolaires :</strong> ${totalVacances.toFixed(2)} h (${formatHeure(totalVacances)})</p>
            <p><strong>Heures supplémentaires :</strong> ${totalHeuresSup.toFixed(2)} h (${formatHeure(totalHeuresSup)})</p>
            <p><strong>Heures récupérées :</strong> ${totalHeuresRecup.toFixed(2)} h (${formatHeure(totalHeuresRecup)})</p>
            <hr>
            <p><strong>Total heures travaillées :</strong> ${totalHeures.toFixed(2)} h (${formatHeure(totalHeures)})</p>
            <p><strong>Différence :</strong>
                <span class="${difference >= 0 ? 'positive' : 'negative'}">
                    ${difference >= 0 ? "+" : ""}${difference.toFixed(2)} h (${formatHeure(Math.abs(difference))}
                
                ${difference >= 0 ? "au-dessus" : "en dessous"} du nombre d'heures à effectuer)
                </span>
            </p>
        </div>
    `;
}

// ======================
// EXPORT PDF PRINCIPAL
// ======================
async function exporterPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;

    doc.setFontSize(18);
    doc.text("Emploi du temps annuel EPLE", 105, 20, { align: "center" });

    doc.setFontSize(12);
    const quotiteValue = window.currentQuotite || 100;
    const heuresMaxValue = document.getElementById("heuresMaxInput") ? document.getElementById("heuresMaxInput").value : "";

    doc.text(`Quotité: ${quotiteValue}%`, 20, 40);
    doc.text(`Heures annuelles: ${heuresMaxValue}`, 20, 50);
    doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 20, 60);

    const nomAgent = (document.getElementById("nomAgent") && document.getElementById("nomAgent").value) || "_____________";
    const prenomAgent = (document.getElementById("prenomAgent") && document.getElementById("prenomAgent").value) || "_____________";
    doc.text(`Agent: ${prenomAgent} ${nomAgent}`, 20, 70);

    doc.setFontSize(11);
    doc.text("Récapitulatif des horaires hebdomadaires :", 20, 80);

    const horairesHebdo = [];
    document.querySelectorAll('#heuresTable tbody tr').forEach(row => {
        const jour = row.cells[0].textContent;
        const debutMatin = row.querySelector('.debut-matin').value || "";
        const finMatin = row.querySelector('.fin-matin').value || "";
        const debutApm = row.querySelector('.debut-apm').value || "";
        const finApm = row.querySelector('.fin-apm').value || "";
        const heuresMatin = row.querySelector('.heures-matin').textContent;
        const heuresApm = row.querySelector('.heures-apm').textContent;
        const totalJour = row.querySelector('.total-jour').textContent;

        horairesHebdo.push([jour, debutMatin, finMatin, heuresMatin, debutApm, finApm, heuresApm, totalJour]);
    });

    doc.autoTable({
        head: [["Jour", "Début matin", "Fin matin", "Heures matin", "Début APR", "Fin APR", "Heures APR", "Total journalier"]],
        body: horairesHebdo,
        startY: 85,
        styles: { fontSize: 8 }
    });

    const yAfterHoraires = doc.previousAutoTable.finalY + 5;
    const semainesData = [];
    const horaireDefault = document.getElementById("horaireHorsVacances") ? parseFloat(document.getElementById("horaireHorsVacances").value) || 0 : 0;

    semaines.forEach(semaine => {
        const semaineData = tableauSemainesData[semaine.num] || {};
        const heures = semaineData.heures ?? (estEnVacances(
            formaterDate(semaine.debut),
            formaterDate(semaine.fin)
        ).enVacances ? 0 : horaireDefault);

        semainesData.push([
            semaine.num,
            `${semaine.debut} - ${semaine.fin}`,
            getNomVacances(semaine.debut, semaine.fin),
            heures,
            semaineData.heuresSup || 0,
            semaineData.heuresRecup || 0,
            semaineData.comment || ""
        ]);
    });

    doc.autoTable({
        head: [["Semaine", "Dates", "Type", "Heures", "HS", "Récup", "Commentaires"]],
        body: semainesData,
        startY: yAfterHoraires,
        styles: { fontSize: 9 }
    });

    let y = doc.previousAutoTable.finalY + 10;

    let totalHorsVacances = 0;
    let totalVacances = 0;
    let totalHeuresSup = 0;
    let totalHeuresRecup = 0;

    semaines.forEach(semaine => {
        const semaineData = tableauSemainesData[semaine.num] || {};
        const debut = formaterDate(semaine.debut);
        const fin = formaterDate(semaine.fin);
        const result = estEnVacances(debut, fin);

        const heures = semaineData.heures !== undefined ? semaineData.heures : (result.enVacances ? 0 : horaireDefault);
        const heuresSup = semaineData.heuresSup !== undefined ? semaineData.heuresSup : 0;
        const heuresRecup = semaineData.heuresRecup !== undefined ? semaineData.heuresRecup : 0;

        if (result.enVacances) {
            totalVacances += heures;
        } else {
            totalHorsVacances += heures;
        }
        totalHeuresSup += heuresSup;
        totalHeuresRecup += heuresRecup;
    });

    const tempsBase = (1593 * quotiteValue) / 100;
    const totalHeures = totalHorsVacances + totalVacances + totalHeuresSup - totalHeuresRecup;
    const difference = totalHeures - tempsBase;

    doc.setFontSize(11);
    doc.text("RÉSULTATS", 20, y);
    doc.setFontSize(10);
    doc.text(`Total heures travaillées : ${totalHeures.toFixed(2)} h (${formatHeure(totalHeures)})`, 20, y + 5);
    doc.text(`Différence : ${difference >= 0 ? "+" : ""}${difference.toFixed(2)} h (${formatHeure(Math.abs(difference))}) ${difference >= 0 ? "(Au-dessus" : "(En dessous"} du nombre d'heures à effectuer)`, 20, y + 10);

    y = y + 8;
    const signatureHeight = 30;
    if (y + signatureHeight > pageHeight) {
        doc.addPage();
        y = 30;
    }

    doc.setFontSize(10);
    doc.text("Agent", 20, y + 15);
    doc.text(`Nom : ${nomAgent}`, 20, y + 25);
    doc.text(`Prénom : ${prenomAgent}`, 20, y + 30);
    doc.text("Signature :", 20, y + 35);

    doc.text("Supérieur hiérarchique", 120, y + 15);
    doc.text("Nom : ____________________", 120, y + 25);
    doc.text("Signature :", 120, y + 40);

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.text(`Page ${i} / ${pageCount}`, pageWidth - 40, pageHeight - 10);
    }

    doc.save("emploi_du_temps_annuel_eple.pdf");
}

// ======================
// EXPORT PDF MODE D'EMPLOI
// ======================
function exporterModeEmploiPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const mL = 20, mR = 20;
    const maxW = pageWidth - mL - mR;
    let y = 20;

    function checkPage(needed) {
        if (y + needed > pageHeight - 15) { doc.addPage(); y = 20; }
    }
    function titre1(text) {
        checkPage(12);
        doc.setFontSize(14); doc.setFont(undefined, 'bold');
        doc.text(text, mL, y); y += 8;
        doc.setFont(undefined, 'normal');
    }
    function titre2(text) {
        checkPage(9);
        doc.setFontSize(11); doc.setFont(undefined, 'bold');
        doc.text(text, mL, y); y += 6;
        doc.setFont(undefined, 'normal');
    }
    function para(text, indent) {
        doc.setFontSize(10); doc.setFont(undefined, 'normal');
        const x = mL + (indent || 0);
        const lines = doc.splitTextToSize(text, maxW - (indent || 0));
        lines.forEach(line => { checkPage(6); doc.text(line, x, y); y += 5; });
        y += 1;
    }
    function puce(text) {
        doc.setFontSize(10); doc.setFont(undefined, 'normal');
        const lines = doc.splitTextToSize('• ' + text, maxW - 6);
        lines.forEach(line => { checkPage(6); doc.text(line, mL + 5, y); y += 5; });
    }
    function hr() {
        checkPage(8);
        doc.setDrawColor(200);
        doc.line(mL, y, pageWidth - mR, y);
        y += 7;
        doc.setDrawColor(0);
    }
    function tableau(headers, rows) {
        checkPage(22);
        doc.autoTable({
            head: [headers], body: rows,
            startY: y, margin: { left: mL, right: mR },
            styles: { fontSize: 9 },
            headStyles: { fillColor: [242, 242, 242], textColor: 50, fontStyle: 'bold' }
        });
        y = doc.lastAutoTable.finalY + 5;
    }

    // ---- TITRE PRINCIPAL ----
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text("Mode d'emploi", pageWidth / 2, y, { align: 'center' });
    y += 8;

    doc.setFontSize(12); doc.setFont(undefined, 'normal');
    doc.text("Outil de calcul du temps de travail EPLE", pageWidth / 2, y, { align: 'center' });
    y += 10;

    // Lien vers la version en ligne
    doc.setFontSize(10);

    doc.text(
        "Version en ligne de l'application :",
        mL,
        y
    );
    y += 6;

    const url = "https://karim-khfr.github.io/calculateur-edt-eple/";

    // Couleur bleue
    doc.setTextColor(0, 0, 255);

    doc.textWithLink(
        url,
        mL,
        y,
        {
            url: url
        }
    );

    // Soulignement
    const largeurLien = doc.getTextWidth(url);
    doc.line(
        mL,
        y + 1,
        mL + largeurLien,
        y + 1
    );

    // Retour à la couleur noire
    doc.setTextColor(0, 0, 0);

    y += 8;

    hr();

    // ---- PRÉSENTATION ----
    titre1("Présentation générale");
    para("Cet outil permet de calculer et de suivre le temps de travail annuel d'un agent d'un EPLE sur l'annee scolaire 2026-2027. Il est organise en 5 onglets a renseigner dans l'ordre.");
    para("Toutes vos saisies sont automatiquement sauvegardees dans votre navigateur. Vous pouvez fermer et rouvrir la page sans perdre vos donnees.");
    hr();

    // ---- ONGLET 1 ----
    titre1("Onglet 1 — Quotite de travail");
    para("C'est le point de depart. Renseignez :");
    puce("Nom et prenom de l'agent (ils apparaitront dans le PDF exporte).");
    puce("Quotite de travail : selectionnez le pourcentage dans le menu deroulant (100 %, 90 %, 80 %...).");
    y += 2;
    para("Le champ 'Heures a effectuer' se calcule automatiquement.");
    para("Exemple : un agent a 80 % doit effectuer 1 274,40 h dans l'annee.");
    hr();

    // ---- ONGLET 2 ----
    titre1("Onglet 2 — Horaires par periode");
    titre2("1. Saisir les horaires journaliers");
    para("Renseignez les heures de debut et de fin pour chaque demi-journee travaillee, au format HH:MM (ex : 08:00, 12:30, 13:45).");
    puce("Les colonnes 'Heures matin', 'Heures apres-midi' et 'Total journalier' se calculent automatiquement apres chaque saisie.");
    puce("Si un agent ne travaille pas le matin ou l'apres-midi un jour donne, laissez simplement les champs vides.");
    y += 2;
    titre2("2. Pauses de 20 minutes");
    para("Si l'agent beneficie de pauses de 20 minutes comptabilisees comme temps de travail effectif, indiquez leur nombre hebdomadaire.");
    tableau(
        ["Nombre de pauses", "Duree totale", "Valeur decimale"],
        [["1 pause", "20 min", "0,33 h"], ["2 pauses", "40 min", "0,66 h"], ["3 pauses", "60 min", "1,00 h"]]
    );
    titre2("3. Reporter le total dans le champ hebdomadaire");
    para("Cliquez sur 'Copier dans le champ ci-dessous' puis sur 'Appliquer a toutes les semaines hors vacances'.");
    hr();

    // ---- ONGLET 3 ----
    titre1("Onglet 3 — Tableau des semaines");
    para("Les semaines de vacances scolaires apparaissent en fond jaune.");
    tableau(
        ["Colonne", "Usage"],
        [
            ["Heures", "Volume horaire hebdomadaire"],
            ["Heures Sup", "Heures supplementaires"],
            ["Heures Recup", "Heures recuperees"],
            ["Commentaires", "Observations diverses"]
        ]
    );
    titre2("Saisie en heures decimales");
    tableau(
        ["Minutes", "Valeur decimale"],
        [["6 min", "0,10"], ["12 min", "0,20"], ["15 min", "0,25"], ["18 min", "0,30"], ["20 min", "0,33"], ["24 min", "0,40"], ["30 min", "0,50"], ["36 min", "0,60"], ["40 min", "0,66"], ["45 min", "0,75"], ["48 min", "0,80"], ["54 min", "0,90"]]
    );
    para("Regle generale : divisez les minutes par 60. Exemple : 48 ÷ 60 = 0,80.");
    hr();

    // ---- ONGLET 4 ----
    titre1("Onglet 4 — Resultats & Export");
    puce("Heures effectuees hors vacances scolaires");
    puce("Heures effectuees pendant les vacances scolaires");
    puce("Heures supplementaires");
    puce("Heures recuperees");
    puce("Total general");
    puce("Ecart par rapport au volume de reference");
    y += 2;
    para("Cliquez sur 'Exporter en PDF' pour generer le document recapitulatif complet.");
    hr();

    // ---- ONGLET 5 ----
    titre1("Onglet 5 — Informations reglementaires");
    para("Cet onglet rappelle les textes de reference et les règles essentielles d'organisation du temps de travail.");
    hr();

    // ---- CONSEILS ----
    titre1("Conseils pratiques");
    puce("Respectez l'ordre des onglets.");
    puce("Modifiez directement les semaines atypiques dans l'onglet 3.");
    puce("Renseignez le nom et le prenom avant l'export PDF.");

    // ---- PAGINATION ----
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.text(`Page ${i} / ${pageCount}`, pageWidth - mR, pageHeight - 10, { align: 'right' });
    }

    doc.save("mode_emploi_outil_EPLE.pdf");
}

// Alias pour faire le pont avec le bouton du fichier HTML sans rien casser
function exporterGuidePDF() {
    exporterModeEmploiPDF();
}



// ======================
// FONCTIONS DE RÉINITIALISATION
// ======================

// --- Onglet 1 : agent ---
function resetAgent() {
    if (!confirm(
        "Les informations de l'agent seront supprimées.\n" +
        "Les autres données ne seront pas modifiées.\n\n" +
        "Continuer ?"
    )) return;

    document.getElementById("nomAgent").value = "";
    document.getElementById("prenomAgent").value = "";
    document.getElementById("quotiteSelect").value = "100";
    updateQuotiteAndResults();
    sauvegarderTout();
}

// --- Onglet 2 : horaires hebdomadaires ---
function resetHorairesHebdo() {
    if (!confirm(
        "Les horaires hebdomadaires seront supprimés.\n" +
        "Les semaines hors vacances seront réinitialisées.\n" +
        "Les semaines de vacances ne seront pas modifiées.\n\n" +
        "Continuer ?"
    )) return;

    // Vider les horaires journaliers
    document.querySelectorAll('#heuresTable tbody tr').forEach(row => {
        row.querySelector('.debut-matin').value = '';
        row.querySelector('.fin-matin').value = '';
        row.querySelector('.debut-apm').value = '';
        row.querySelector('.fin-apm').value = '';
        updateRow(row);
    });

    // Remettre les pauses à 0
    document.getElementById('nbPauses').value = 0;

    // Recalculer le total hebdo (→ 0)
    calculerTotalHebdo();

    // Remettre le champ horaire hors vacances à 0
    document.getElementById("horaireHorsVacances").value = "0.00";

    // Réinitialiser uniquement les semaines hors vacances dans tableauSemainesData
    semaines.forEach(semaine => {
        const debut = formaterDate(semaine.debut);
        const fin = formaterDate(semaine.fin);
        const result = estEnVacances(debut, fin);
        if (!result.enVacances) {
            if (tableauSemainesData[semaine.num]) {
                tableauSemainesData[semaine.num].heures = 0;
            } else {
                tableauSemainesData[semaine.num] = { heures: 0 };
            }
        }
    });

    // Mettre à jour l'affichage de l'onglet 3 s'il est visible
    const onglet3 = document.getElementById("semaines");
    if (onglet3 && onglet3.classList.contains("active")) {
        genererTableauSemaines();
    }

    calculerResultats();
    sauvegarderTout();
}

// --- Onglet 3 : tableau annuel ---
function resetTableauAnnuel() {
    if (!confirm(
        "Le tableau annuel sera entièrement réinitialisé.\n" +
        "Les heures, heures supplémentaires, récupérations et commentaires de toutes les semaines seront supprimés.\n" +
        "Les onglets 1 et 2 ne seront pas modifiés.\n\n" +
        "Continuer ?"
    )) return;

    // Vider toutes les semaines dans tableauSemainesData
    semaines.forEach(semaine => {
        tableauSemainesData[semaine.num] = {
            heures: 0,
            heuresSup: 0,
            heuresRecup: 0,
            comment: ""
        };
    });

    // Régénérer le tableau si visible
    const onglet3 = document.getElementById("semaines");
    if (onglet3 && onglet3.classList.contains("active")) {
        genererTableauSemaines();
    }

    calculerResultats();
    sauvegarderTout();
}

// --- Application : nouveau calcul ---
function resetApplication() {
    if (!confirm(
        "Toutes les données enregistrées seront définitivement supprimées.\n" +
        "Cette opération est irréversible.\n\n" +
        "Continuer ?"
    )) return;

    localStorage.removeItem('eple_calculateur');
    window.location.reload();
}

// ======================
// FONCTION DE DUPLICATION DES HORAIRES
// ======================
function dupliquerJour(bouton) {
    const rowSource = bouton.closest('tr');
    const jourSource = rowSource.cells[0].textContent.trim();

    // Message d'invite explicite insistant sur la séparation par des virgules
    const reponse = prompt(
        `Duplication des horaires du ${jourSource} :\n\n` +
        `Veuillez saisir les jours cibles en les SÉPARANT OBLIGATOIREMENT PAR UNE VIRGULE.\n\n` +
        `Exemple exact à recopier : Mardi, Jeudi, Vendredi\n\n` +
        `Vers quels jours copier ces horaires ?`
    );

    if (!reponse) return; // Si clic sur Annuler ou champ vide

    // Récupérer proprement les horaires du jour source
    const dm = rowSource.querySelector('.debut-matin').value;
    const fm = rowSource.querySelector('.fin-matin').value;
    const da = rowSource.querySelector('.debut-apm').value;
    const fa = rowSource.querySelector('.fin-apm').value;

    // Convertir la réponse en liste de jours nettoyés (minuscules et sans espaces superflus)
    const joursCibles = reponse.split(',').map(j => j.trim().toLowerCase());

    let modificationsAppliquees = false;

    // Parcourir toutes les lignes du tableau pour injecter les heures
    document.querySelectorAll('#heuresTable tbody tr').forEach(rowCible => {
        const jourCible = rowCible.cells[0].textContent.trim().toLowerCase();

        // Si le jour correspond à la demande et n'est pas le jour d'origine
        if (joursCibles.includes(jourCible) && jourCible !== jourSource.toLowerCase()) {
            rowCible.querySelector('.debut-matin').value = dm;
            rowCible.querySelector('.fin-matin').value = fm;
            rowCible.querySelector('.debut-apm').value = da;
            rowCible.querySelector('.fin-apm').value = fa;

            // Forcer la mise à jour des totaux de cette ligne
            updateRow(rowCible);
            modificationsAppliquees = true;
        }
    });

    // Si au moins un jour a été modifié, on recalcule le total de la semaine et on sauvegarde
    if (modificationsAppliquees) {
        calculerTotalHebdo();
        if (typeof sauvegarderTout === 'function') {
            sauvegarderTout();
        }
    }
}

// ======================
// INITIALISATION
// ======================
document.addEventListener('change', function (e) { if (e.target.matches('#heuresTable input[type="text"]')) { updateRow(e.target.closest('tr')); calculerTotalHebdo(); } });

window.onload = function () {
    const hasSave = !!localStorage.getItem('eple_calculateur');
    if (!hasSave) {
        document.getElementById("quotiteSelect").value = "100";
        document.getElementById("horaireHorsVacances").value = "35.00";
    }

    restaurerSauvegarde();
    updateQuotiteAndResults();
    calculerTotalHebdo();
    genererTableauSemaines();
    calculerResultats();

    const defaultTab = document.querySelector('.tab.active');
    if (defaultTab) {
        const defaultTabId = defaultTab.getAttribute('onclick').match(/'([^']+)'/)[1];
        changerOnglet({ currentTarget: defaultTab }, defaultTabId);
    }
};
