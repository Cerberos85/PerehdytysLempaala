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
            
            // 5. SUNTIOTYÖ
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

    const getTaskObj = (id) => {
        const el = document.getElementById(id);
        const isChecked = el ? el.checked : false;
        return {
            completed: isChecked,
            date: isChecked ? now : null
        };
    };

    const progressData = {
        userEmail: currentUser.email, 
        department: myRole, 
        
        suntio: {
            task1: document.getElementById('suntio-task1') ? document.getElementById('suntio-task1').checked : false,
            task2: document.getElementById('suntio-task2') ? document.getElementById('suntio-task2').checked : false,
        },
        toimisto: {
            task1: document.getElementById('toimisto-task1') ? document.getElementById('toimisto-task1').checked : false,
            task2: document.getElementById('toimisto-task2') ? document.getElementById('toimisto-task2').checked : false,
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
        'section-suntiotyo', 
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
    else if (role === 'Suntiotyö') { 
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