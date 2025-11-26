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

        loadUserProgress(user.uid);
        loadSharedDocuments(); 

    } else {
        console.log("Ei käyttäjää, ohjataan kirjautumiseen.");
        window.location.href = 'index.html';
    }
});

// --- 2. LATAUSLOGIIKKA ---

async function loadUserProgress(uid) {
    const docRef = db.collection('userProgress').doc(uid);

    try {
        const doc = await docRef.get();

        if (doc.exists) {
            const data = doc.data();
            console.log("LADATUT TIEDOT:", data);

            // 1. SUNTIO
            updateTaskUI('suntio-task1', data.suntio?.task1);
            updateTaskUI('suntio-task2', data.suntio?.task2);

            // 2. TOIMISTO
            updateTaskUI('toimisto-task1', data.toimisto?.task1);
            updateTaskUI('toimisto-task2', data.toimisto?.task2);

            // 3. HÄÄT
            updateTaskUI('haat-task1-kirkko', data.haat?.task1, 'haat-task1-date');
            updateTaskUI('haat-task2-opastus', data.haat?.task2, 'haat-task2-date');

            // 4. HAUTAUSTOIMI
            updateTaskUI('hautaus-task1', data.hautaustoimi?.task1, 'hautaus-task1-date');
            
            // 5. SUNTIOTYÖ (Tämä ladataan nyt oikein, jos ID täsmää HTML:ään)
            updateTaskUI('suntiotyo-task1', data.suntiotyo?.task1, 'suntiotyo-task1-date');
            
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

    // Apufunktio checkboxin ja päivämäärän tallennusobjektin luontiin
    const getTaskObj = (id) => {
        const el = document.getElementById(id);
        const isChecked = el ? el.checked : false;
        return {
            completed: isChecked,
            date: isChecked ? now : null
        };
    };

    // Luodaan tallennettava data
    const progressData = {
        userEmail: currentUser.email, 
        department: myRole, 
        
        // Vanhat (boolean)
        suntio: {
            task1: document.getElementById('suntio-task1') ? document.getElementById('suntio-task1').checked : false,
            task2: document.getElementById('suntio-task2') ? document.getElementById('suntio-task2').checked : false,
        },
        toimisto: {
            task1: document.getElementById('toimisto-task1') ? document.getElementById('toimisto-task1').checked : false,
            task2: document.getElementById('toimisto-task2') ? document.getElementById('toimisto-task2').checked : false,
        },
        
        // Uudet (objekti + pvm)
        haat: {
            task1: getTaskObj('haat-task1-kirkko'),
            task2: getTaskObj('haat-task2-opastus')
        },
        hautaustoimi: {
            task1: getTaskObj('hautaus-task1')
        },
        suntiotyo: {
            task1: getTaskObj('suntiotyo-task1')
        },
        lapsiperhe: {
            task1: getTaskObj('lapsi-task1')
        },

        lastUpdated: now 
    };

    try {
        await db.collection('userProgress').doc(currentUser.uid).set(progressData, { merge: true });
        
        saveStatus.textContent = "Edistyminen tallennettu!";
        console.log(`Tallennettu osastolla: ${myRole}`);
        
        loadUserProgress(currentUser.uid); 
        setTimeout(() => { saveStatus.textContent = ""; }, 3000);

    } catch (error) {
        console.error("Tallennusvirhe:", error);
        saveStatus.textContent = "Tallennus epäonnistui.";
    }
}

saveButton.addEventListener('click', saveProgress);

// --- 4. NÄKYMÄN HALLINTA (TÄMÄ OLI VIKANA) ---

function showSectionsBasedOnRole(role) {
    console.log("Päivitetään näkymä roolille:", role);

    // 1. Piilotetaan ensin kaikki osiot
    const allSections = [
        'section-suntio', 
        'section-toimisto', 
        'section-hautaustoimi', 
        'section-suntiotyo', 
        'section-lapsiperhe'
    ];
    
    allSections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // 2. Näytetään vain roolia vastaava
    if (role === 'Hautaustoimi') {
        const el = document.getElementById('section-hautaustoimi');
        if (el) el.style.display = 'block';
    } 
    else if (role === 'Suntiotyö') { 
        // TÄMÄ PUUTTUI AIEMMIN!
        const el = document.getElementById('section-suntiotyo');
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

// --- 5. ULOSKIRJAUTUMINEN ---

logoutButton.addEventListener('click', () => {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    });
});