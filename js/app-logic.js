// js/app-logic.js

const auth = firebase.auth();
const db = firebase.firestore();

let currentUser; 

const saveButton = document.getElementById('saveButton');
const logoutButton = document.getElementById('logoutButton');
const saveStatus = document.getElementById('saveStatus');

// --- 1. AUTH LOGIIKKA ---

auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user; 
        console.log("Käyttäjä ladattu:", user.uid);

        const idTokenResult = await user.getIdTokenResult(true); 
        const userRole = idTokenResult.claims.employeeRole; 

        console.log("Käyttäjän rooli:", userRole);

        // Näytä oikeat osiot
        showSectionsBasedOnRole(userRole);

        // Lataa rastit
        loadUserProgress(user.uid);

        // TÄMÄ RIVI AIHEUTTI VIRHEEN, KOSKA FUNKTIO PUUTTUI. 
        // NYT SE ON LISÄTTY TIEDOSTON LOPPUUN.
        loadSharedDocuments(); 

    } else {
        console.log("Ei käyttäjää, ohjataan kirjautumiseen.");
        window.location.href = 'index.html';
    }
});

// --- 2. LATAUSLOGIIKKA (RASTIT) ---

async function loadUserProgress(uid) {
    const docRef = db.collection('userProgress').doc(uid);

    try {
        const doc = await docRef.get();

        if (doc.exists) {
            const data = doc.data();
            console.log("LADATUT TIEDOT:", data);

            // 1. SUNTIO (Nyt kaikki 12 tehtävää)
            // Käytetään silmukkaa tai listataan selkeyden vuoksi:
            for (let i = 1; i <= 12; i++) {
                updateTaskUI(`suntio-task${i}`, data.suntio?.[`task${i}`]);
            }

            // 2. TOIMISTO
            updateTaskUI('toimisto-task1', data.toimisto?.task1);
            updateTaskUI('toimisto-task2', data.toimisto?.task2);
            // 3. HAUTAUSTOIMI
            updateTaskUI('hautaus-task1', data.hautaus?.task1, 'hautaus-task1-date');      
            // 6. LAPSI- JA PERHETYÖ
            updateTaskUI('lapsi-task1', data.lapsiperhe?.task1, 'lapsi-task1-date');

        } else {
            console.log("Käyttäjälle ei löydy aiempia tietoja.");
        }
    } catch (error) {
        console.error("Virhe tietoja ladatessa:", error);
    }
}

function updateTaskUI(checkboxId, taskData, dateSpanId = null) {
    const checkbox = document.getElementById(checkboxId);
    if (!checkbox) return;

    let isChecked = false;
    let dateText = "";

    if (typeof taskData === 'boolean') {
        isChecked = taskData;
    } else if (taskData && taskData.completed) {
        isChecked = true;
        if (taskData.date && dateSpanId) {
            const dateObj = taskData.date.toDate();
            const dateStr = dateObj.toLocaleString('fi-FI', { day: 'numeric', month: 'short', year: 'numeric' });
            dateText = `(Kuitattu: ${dateStr})`;
        }
    }

    checkbox.checked = isChecked;

    if (dateSpanId) {
        const dateElement = document.getElementById(dateSpanId);
        if (dateElement) dateElement.textContent = dateText;
    }
}

// --- 3. TALLENNUSLOGIIKKA ---

async function saveProgress() {
    if (!currentUser) return; 

    saveStatus.textContent = "Tallennetaan...";
    const now = firebase.firestore.Timestamp.now(); 

    // Haetaan rooli
    let myRole = 'Muu';
    try {
        const idTokenResult = await currentUser.getIdTokenResult();
        if (idTokenResult.claims.employeeRole) {
            myRole = idTokenResult.claims.employeeRole;
        }
    } catch (e) {
        console.log("Roolin haku epäonnistui", e);
    }

    // Apufunktio: Hakee objektin { completed: boolean, date: Timestamp/null }
    const getTaskObj = (id) => {
        const el = document.getElementById(id);
        const isChecked = el ? el.checked : false;
        // Jos elementtiä ei löydy (HTML puuttuu), tulostetaan varoitus konsoliin
        if (!el) console.warn(`Elementtiä ID:llä '${id}' ei löytynyt tallennuksessa!`);
        
        return {
            completed: isChecked,
            date: isChecked ? now : null
        };
    };

    // Apufunktio: Hakee pelkän booleanin (Suntio/Toimisto vanha tyyli)
    const getSimpleBool = (id) => {
        const el = document.getElementById(id);
        return el ? el.checked : false;
    };

    // Rakennetaan suntio-objekti dynaamisesti (task1 - task12)
    let suntioTasks = {};
    for (let i = 1; i <= 12; i++) {
        suntioTasks[`task${i}`] = getSimpleBool(`suntio-task${i}`);
    }

    const progressData = {
        userEmail: currentUser.email, 
        department: myRole, 
        
        suntio: suntioTasks, // Sisältää nyt task1...task12

        toimisto: {
            task1: getSimpleBool('toimisto-task1'),
            task2: getSimpleBool('toimisto-task2'),
        },
        hautaustoimi: {
            task1: getTaskObj('hautaus-task1') // Huom: HTML ID oli hautaus-task1
        },
        lapsiperhe: {
            task1: getTaskObj('lapsi-task1')
        },
        lastUpdated: now 
    };

    try {

        await db.collection('userProgress').doc(currentUser.uid).set(progressData, { merge: true });
        
        saveStatus.textContent = "Edistyminen tallennettu!";
        

        loadUserProgress(currentUser.uid); 
        
        setTimeout(() => { saveStatus.textContent = ""; }, 3000);

    } catch (error) {
        console.error("Tallennusvirhe:", error);
        saveStatus.textContent = "Tallennus epäonnistui.";
    }
}

saveButton.addEventListener('click', saveProgress);

// --- 4. NÄKYMÄN HALLINTA ---

function showSectionsBasedOnRole(role) {
    const allSections = [
        'section-suntio', 
        'section-toimisto', 
        'section-hautaus',  
        'section-lapsiperhe'
    ];
    
    allSections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    if (role === 'Hautaus') {
        const el = document.getElementById('section-hautaus');
        if (el) el.style.display = 'block';
    } 
    else if (role === 'Lapsi ja perhetyö') {
        const el = document.getElementById('section-lapsiperhe');
        if (el) el.style.display = 'block';
    }
    else if (role === 'Suntio') { 
        const el = document.getElementById('section-suntio');
        if (el) el.style.display = 'block';
    }
    else if (role === 'Toimisto') {
        const el = document.getElementById('section-toimisto');
        if (el) el.style.display = 'block';
    }
}

// --- 5. PUUTTUVAN FUNKTION LISÄYS: DOKUMENTTIEN LATAUS ---

async function loadSharedDocuments() {
    const listElement = document.getElementById('document-list');
    if (!listElement) return; // Varmistus, jos elementtiä ei ole

    try {
        // Haetaan dokumentit, uusimmasta vanhimpaan
        const snapshot = await db.collection('sharedDocuments')
                                 .orderBy('uploadedAt', 'desc')
                                 .get();

        if (snapshot.empty) {
            listElement.innerHTML = '<li>Ei jaettuja dokumentteja.</li>';
            return;
        }

        listElement.innerHTML = ''; // Tyhjennetään "Ladataan..."
        
        snapshot.forEach(doc => {
            const data = doc.data();
            
            const li = document.createElement('li');
            const a = document.createElement('a');
            
            a.href = data.url;        // Latauslinkki
            a.textContent = data.fileName; // Tiedoston nimi
            a.target = '_blank';      // Avaa uuteen välilehteen
            
            li.appendChild(a);
            listElement.appendChild(li);
        });

    } catch (error) {
        console.error("Virhe jaettujen dokumenttien latauksessa:", error);
        
        // Jos tulee indeksi-virhe (koska orderBy), näytetään silti jotain
        if (error.message.includes('index')) {
            console.log("Huom: Saatat tarvita Firestore-indeksin 'sharedDocuments'-kokoelmalle (uploadedAt).");
        }
        
        listElement.innerHTML = '<li>Dokumenttien lataus epäonnistui.</li>';
    }
}

// --- 6. ULOSKIRJAUTUMINEN ---

logoutButton.addEventListener('click', () => {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    });
});
// Odotetaan, että DOM on varmasti ladattu
document.addEventListener('DOMContentLoaded', () => {
    
    // Haetaan kaikki välilehtipainikkeet
    const tabButtons = document.querySelectorAll('.tab-button');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 1. Haetaan painikkeen ylätaso (esim. section-hautaus), jotta logiikka toimii vain kyseisessä osiossa
            const parentSection = button.closest('.module');
            
            // 2. Poistetaan "active"-luokka kaikilta tämän osion painikkeilta ja sisällöiltä
            parentSection.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            parentSection.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
                content.style.display = 'none'; // Piilotetaan sisältö
            });

            // 3. Lisätään "active"-luokka klikattuun painikkeeseen
            button.classList.add('active');

            // 4. Näytetään oikea sisältö-div data-tab -attribuutin perusteella
            const targetId = button.getAttribute('data-tab');
            const targetContent = document.getElementById(targetId);
            targetContent.classList.add('active');
            targetContent.style.display = 'block'; // Näytetään sisältö
        });
    });
});