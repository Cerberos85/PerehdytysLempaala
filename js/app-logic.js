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
        currentUser = user; // Tallennetaan käyttäjä muistiin
        console.log("Käyttäjä ladattu:", user.uid);
        
        // Ladataan käyttäjän tallennettu edistyminen
        loadUserProgress(user.uid);
    } else {
        // Käyttäjä EI OLE kirjautunut
        console.log("Ei käyttäjää, ohjataan kirjautumiseen.");
        // Ohjataan takaisin kirjautumissivulle
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

    saveStatus.textContent = "Tallennetaan...";

    // Luodaan Firebasen aikaleima NYT-hetkestä
    const now = firebase.firestore.Timestamp.now(); 

    // Haetaan uusien checkboxien tila
    const haatTask1Checked = document.getElementById('haat-task1-kirkko').checked;
    const haatTask2Checked = document.getElementById('haat-task2-opastus').checked;

    const progressData = {
        userEmail: currentUser.email, 

        // Vanhat osiot tallennetaan kuten ennenkin
        suntio: {
            task1: document.getElementById('suntio-task1').checked,
            task2: document.getElementById('suntio-task2').checked,
        },
        toimisto: {
            task1: document.getElementById('toimisto-task1').checked,
            task2: document.getElementById('toimisto-task2').checked,
        },

        // UUSI HÄÄT-OSIO
        haat: {
            // Tallennetaan objekti: { completed: [true/false], date: [aikaleima/null] }
            task1: {
                completed: haatTask1Checked,
                date: haatTask1Checked ? now : null // Tallennetaan 'nyt' jos kuitattu, muuten null
            },
            task2: {
                completed: haatTask2Checked,
                date: haatTask2Checked ? now : null
            }
        },
        lastUpdated: now // Käytetään samaa aikaleimaa
    };

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
}

// Lisätään tallennusnappiin kuuntelija
saveButton.addEventListener('click', saveProgress);


// --- 4. Kirjaudu ulos ---

logoutButton.addEventListener('click', () => {
    auth.signOut().then(() => {
        console.log("Kirjauduttu ulos.");
        window.location.href = 'index.html'; // Ohjataan takaisin kirjautumissivulle
    }).catch((error) => {
        console.error("Uloskirjautumisvirhe:", error);
    });
});