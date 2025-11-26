// js/app-logic.js

const auth = firebase.auth();
const db = firebase.firestore();

// Pidetään kirjaa, kuka käyttäjä on
let currentUser; 

// Haetaan HTML-elementit
const saveButton = document.getElementById('saveButton');
const logoutButton = document.getElementById('logoutButton');
const saveStatus = document.getElementById('saveStatus');

// --- 1. Tarkista onko käyttäjä kirjautunut ---

// Tämä on "vahti", joka tarkistaa sivun latautuessa, onko käyttäjä kirjautunut.
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // Käyttäjä ON kirjautunut
        currentUser = user; 
        console.log("Käyttäjä ladattu:", user.uid);

        // Hae käyttäjän roolit (Custom Claims)
        const idTokenResult = await user.getIdTokenResult(true); // true = pakota päivitys
        const userRole = idTokenResult.claims.employeeRole; // Esim. "Suntio" tai "Toimisto"

        console.log("Käyttäjän rooli:", userRole);

        // --- TÄSSÄ TAPAHTUU ITSE NÄYTÄMINEN ---
        // Näytä osiot roolin perusteella
        showSectionsBasedOnRole(userRole);

        // Nämä lataavat kaiken datan. Se ei haittaa,
        // koska väärät osiot ovat piilossa (display:none),
        // ja vain näkyvien osien checkboxit päivittyvät.
        loadUserProgress(user.uid);

        // Ladataan jaetut dokumentit (jotka näkyvät kaikille)
        loadSharedDocuments(); 

    } else {
        // Käyttäjä EI OLE kirjautunut
        console.log("Ei käyttäjää, ohjataan kirjautumiseen.");
        window.location.href = 'index.html';
    }
});


// --- 2. Lataa käyttäjän edistyminen ---

async function loadUserProgress(uid) {
    const docRef = db.collection('userProgress').doc(uid);

    try {
        const doc = await docRef.get();

        if (doc.exists) {
            const data = doc.data();
            console.log("LADATUT TIEDOT:", data);

            // Vanhat osiot (toimivat edelleen)
            document.getElementById('suntio-task1').checked = data.suntio?.task1 || false;
            document.getElementById('suntio-task2').checked = data.suntio?.task2 || false;
            document.getElementById('toimisto-task1').checked = data.toimisto?.task1 || false;
            document.getElementById('toimisto-task2').checked = data.toimisto?.task2 || false;

            // UUSI HÄÄT-OSIO
            // Ladataan checkboxin tila
            document.getElementById('haat-task1-kirkko').checked = data.haat?.task1?.completed || false;
            document.getElementById('haat-task2-opastus').checked = data.haat?.task2?.completed || false;

            // Ladataan ja muotoillaan päivämäärä, jos se on olemassa
            if (data.haat?.task1?.date) {
                const date = data.haat.task1.date.toDate().toLocaleString('fi-FI', { day: 'numeric', month: 'short', year: 'numeric' });
                document.getElementById('haat-task1-date').textContent = `(Kuitattu: ${date})`;
            } else {
                document.getElementById('haat-task1-date').textContent = ""; // Tyhjennetään, jos ei kuitattu
            }

            if (data.haat?.task2?.date) {
                const date = data.haat.task2.date.toDate().toLocaleString('fi-FI', { day: 'numeric', month: 'short', year: 'numeric' });
                document.getElementById('haat-task2-date').textContent = `(Kuitattu: ${date})`;
            } else {
                document.getElementById('haat-task2-date').textContent = "";
            }

        } else {
            console.log("Käyttäjälle ei löydy aiempia tietoja.");
        }
    } catch (error) {
        console.error("Virhe tietoja ladatessa:", error);
    }
}

// --- 3. Tallenna edistyminen ---

async function saveProgress() {
    if (!currentUser) return; 

    const saveStatus = document.getElementById('saveStatus');
    saveStatus.textContent = "Tallennetaan...";
    
    // Luodaan aikaleima
    const now = firebase.firestore.Timestamp.now(); 

    // --- 1. UUSI LISÄYS: Haetaan käyttäjän rooli (department) ---
    // Tämä on kriittinen vaihe hierarkiaa varten.
    let myRole = 'Muu';
    try {
        const idTokenResult = await currentUser.getIdTokenResult();
        // Tallennetaan rooli (esim. "Suntio" tai "Toimisto") muuttujaan
        if (idTokenResult.claims.employeeRole) {
            myRole = idTokenResult.claims.employeeRole;
        }
    } catch (e) {
        console.log("Roolin haku epäonnistui, käytetään oletusta.", e);
    }
    // -------------------------------------------------------------

    // Haetaan checkboxien tilat (mukaan lukien aiemmin tehdyt Häät-osiot)
    const haatTask1Checked = document.getElementById('haat-task1-kirkko') ? document.getElementById('haat-task1-kirkko').checked : false;
    const haatTask2Checked = document.getElementById('haat-task2-opastus') ? document.getElementById('haat-task2-opastus').checked : false;

    const progressData = {
        userEmail: currentUser.email, 
        
        // --- 2. UUSI LISÄYS: Tallennetaan osastotieto tietokantaan ---
        department: myRole, 
        // -------------------------------------------------------------

        // Vanhat osiot
        suntio: {
            task1: document.getElementById('suntio-task1') ? document.getElementById('suntio-task1').checked : false,
            task2: document.getElementById('suntio-task2') ? document.getElementById('suntio-task2').checked : false,
        },
        toimisto: {
            task1: document.getElementById('toimisto-task1') ? document.getElementById('toimisto-task1').checked : false,
            task2: document.getElementById('toimisto-task2') ? document.getElementById('toimisto-task2').checked : false,
        },
        
        // Häät-osio (päivämäärälogiikalla)
        haat: {
            task1: {
                completed: haatTask1Checked,
                date: haatTask1Checked ? now : null 
            },
            task2: {
                completed: haatTask2Checked,
                date: haatTask2Checked ? now : null
            }
        },
        lastUpdated: now 
    };

    try {
        // Tallennetaan tiedot Firestoreen
        await db.collection('userProgress').doc(currentUser.uid).set(progressData, { merge: true });
        
        saveStatus.textContent = "Edistyminen tallennettu!";
        console.log(`Tallennettu osastolla: ${myRole}`);
        
        // Päivitetään näkymä (esim. päivämäärät)
        loadUserProgress(currentUser.uid); 
        
        setTimeout(() => { saveStatus.textContent = ""; }, 3000);

    } catch (error) {
        console.error("Tallennusvirhe:", error);
        saveStatus.textContent = "Tallennus epäonnistui.";
    }
}

    try {
        // Huom: Kun käyttäjä poistaa ruksin, 'date' muuttuu 'null'-arvoksi.
        // Jos haluat säilyttää ENSIMMÄISEN kuittauspäivän ikuisesti, 
        // logiikkaa täytyy monimutkaistaa (vaatisi datan lukemista ennen tallennusta).
        // Tämä "viimeisin kuittaus" -tapa on yksinkertaisempi.

        await db.collection('userProgress').doc(currentUser.uid).set(progressData, { merge: true });

        saveStatus.textContent = "Edistyminen tallennettu!";
        console.log("Tiedot tallennettu!");

        // Päivitetään päivämääränäkymä heti tallennuksen jälkeen
        loadUserProgress(currentUser.uid); 

        setTimeout(() => { saveStatus.textContent = ""; }, 3000);

    } catch (error) {
        console.error("Tallennusvirhe:", error);
        saveStatus.textContent = "Tallennus epäonnistui.";
    }

// Lisätään tallennusnappiin kuuntelija
saveButton.addEventListener('click', saveProgress);
/**
 * Etsii HTML-sivulta osiot ja näyttää ne käyttäjän roolin perusteella.
 * @param {string} role - Käyttäjän rooli, esim. "Suntio" tai "Toimisto".
 */
function showSectionsBasedOnRole(role) {

    // Hae kaikki mahdolliset osiot
    const suntioSection = document.getElementById('section-suntio');
    const toimistoSection = document.getElementById('section-toimisto');

    // Jaettujen dokumenttien osio (#section-shared-docs) on aina näkyvissä,
    // joten emme koske siihen.

    if (role === 'Suntio') {
        // Näytä Suntion osio
        if (suntioSection) suntioSection.style.display = 'block';

    } else if (role === 'Toimisto') {
        // Näytä Toimiston osio
        if (toimistoSection) toimistoSection.style.display = 'block';

    } else {
        // Tuntematon rooli tai roolia ei ole asetettu
        console.warn("Ei tunnistettua roolia. Käyttäjä ei näe perehdytysosioita.");
        // Voit myös näyttää tässä jonkin oletusnäkymän tai virheilmoituksen.
    }
}

// --- 4. Kirjaudu ulos ---

logoutButton.addEventListener('click', () => {
    auth.signOut().then(() => {
        console.log("Kirjauduttu ulos.");
        window.location.href = 'index.html'; // Ohjataan takaisin kirjautumissivulle
    }).catch((error) => {
        console.error("Uloskirjautumisvirhe:", error);
    });
});