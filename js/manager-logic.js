// js/manager-logic.js

const auth = firebase.auth();
const db = firebase.firestore();

// Haetaan HTML-elementit
const reportContainer = document.getElementById('report-container');
const logoutButton = document.getElementById('logoutButton');

// --- 1. Tarkista onko käyttäjä kirjautunut JA onko hän esimies ---

auth.onAuthStateChanged(async (user) => {
    if (user) {
        // Käyttäjä on kirjautunut. Tarkistetaan rooli.
        const idTokenResult = await user.getIdTokenResult(true); // true = pakota päivitys

        if (idTokenResult.claims.manager) {
            // KÄYTTÄJÄ ON ESIMIES. Ladataan raportit.
            console.log("Pääsy sallittu esimiehelle:", user.email);
            loadAllEmployeeProgress();
        } else {
            // KÄYTTÄJÄ ON TAVALLINEN TYÖNTEKIJÄ.
            // Potkitaan pois tältä sivulta.
            console.warn("PÄÄSY KIELLETTY: Käyttäjä ei ole esimies.");
            alert("Sinulla ei ole oikeuksia tähän näkymään.");
            window.location.href = 'app.html'; // Ohjataan työntekijän sivulle
        }

    } else {
        // Ei kirjautunut, ohjataan takaisin login-sivulle
        console.log("Ei käyttäjää, ohjataan kirjautumiseen.");
        window.location.href = 'index.html';
    }
});


// --- 2. Lataa KAIKKIEN työntekijöiden edistyminen ---

async function loadAllEmployeeProgress() {
    reportContainer.innerHTML = 'Ladataan tietoja...';

    try {
        const snapshot = await db.collection('userProgress').get();

        // LISÄTTY UUSI SARAKE "Häät (Valmis)"
        let html = `
            <table>
                <tr>
                    <th>Työntekijä</th>
                    <th>Suntio (Valmis)</th>
                    <th>Toimisto (Valmis)</th>
                    <th>Häät (Valmis)</th> 
                    <th>Viimeksi päivitetty</th>
                </tr>
        `;

        snapshot.forEach(doc => {
            const data = doc.data();

            // Nämä käyttävät nyt uutta, älykästä calculateProgress-funktiota
            const suntioProgress = calculateProgress(data.suntio);
            const toimistoProgress = calculateProgress(data.toimisto);
            const haatProgress = calculateProgress(data.haat); // LASKETAAN UUSI OSIO

            const lastUpdated = data.lastUpdated ? data.lastUpdated.toDate().toLocaleString('fi-FI') : 'Ei tietoa';

            // LISÄTTY UUSI SARAKE (<td>) RIVILLE
            html += `
                <tr>
                    <td>${data.userEmail || doc.id}</td>
                    <td>${suntioProgress}%</td>
                    <td>${toimistoProgress}%</td>
                    <td>${haatProgress}%</td> 
                    <td>${lastUpdated}</td>
                </tr>
            `;
        });

        html += '</table>';
        reportContainer.innerHTML = html;

    } catch (error) {
        console.error("Virhe raporttien lataamisessa:", error);
        reportContainer.innerHTML = '<p style="color:red;">Tietojen lataaminen epäonnistui. Tarkista tietoturvasäännöt.</p>';
    }
}

// Apufunktio edistymisen laskentaan
function calculateProgress(section) {
    if (!section) return 0; 

    const tasks = Object.values(section); 
    if (tasks.length === 0) return 0; 

    let completedTasks = 0;

    tasks.forEach(task => {
        if (typeof task === 'boolean' && task === true) {
            // Vanha datatyyppi (esim. suntio: { task1: true })
            completedTasks++;
        } else if (typeof task === 'object' && task !== null && task.completed === true) {
            // Uusi datatyyppi (esim. haat: { task1: { completed: true, ... } })
            completedTasks++;
        }
    });

    return Math.round((completedTasks / tasks.length) * 100);
}

// --- 3. Kirjaudu ulos ---

logoutButton.addEventListener('click', () => {
    auth.signOut().then(() => {
        console.log("Kirjauduttu ulos.");
        window.location.href = 'index.html';
    });
});