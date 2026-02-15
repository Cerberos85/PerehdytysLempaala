// js/app-logic.js

const auth = firebase.auth();
const db = firebase.firestore();

let currentUser; 
const logoutButton = document.getElementById('logoutButton');
const saveStatus = document.getElementById('saveStatus'); // Jos haluat näyttää "Tallennettu" -viestin

// --- 1. AUTH JA ALUSTUS ---

auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user; 
        console.log("Käyttäjä ladattu:", user.uid);

        const idTokenResult = await user.getIdTokenResult(true); 
        const userRole = idTokenResult.claims.employeeRole; 
        console.log("Käyttäjän rooli:", userRole);

        // Näytä oikeat osiot
        showSectionsBasedOnRole(userRole);

        // Lataa jaetut dokumentit (PDF-linkit)
        loadSharedDocuments(); 

        // Lataa käyttäjän rastit tietokannasta
        await loadUserProgress(user.uid);

        // Kun tiedot on ladattu, aktivoidaan kuuntelijat, jotta checkboxien klikkailu tallentuu
        attachCheckboxListeners();

    } else {
        console.log("Ei käyttäjää, ohjataan kirjautumiseen.");
        window.location.href = 'index.html';
    }
});

// --- 2. NÄKYMÄN HALLINTA (ROOLIT) ---

function showSectionsBasedOnRole(role) {
    // Piilotetaan ensin kaikki
    const allSections = document.querySelectorAll('.module');
    allSections.forEach(section => {
        if (section.id !== 'section-shared-docs') { // Jaetut dokumentit näkyvät kaikille
            section.style.display = 'none';
        }
    });

    // Näytetään rooliin perustuvat osiot
    if (role === 'Hautaustoimi') {
        const el = document.getElementById('section-hautaus');
        if (el) el.style.display = 'block';
    } 
    else if (role === 'Kausityö') {
        const el = document.getElementById('section-kausityo');
        if (el) el.style.display = 'block';
    }
    else if (role === 'Lapsiperhe' || role === 'Lapsi ja perhetyö') {
        const el = document.getElementById('section-lapsiperhe');
        if (el) el.style.display = 'block';
    }
    else if (role === 'Suntio') { 
        const el1 = document.getElementById('section-suntio');
        const el2 = document.getElementById('section-haat');
        if (el1) el1.style.display = 'block';
        if (el2) el2.style.display = 'block';
    }
    else if (role === 'Suntiotyö') {
        const el = document.getElementById('section-suntiotyo');
        if (el) el.style.display = 'block';
    }
    else if (role === 'Toimisto') {
        const el = document.getElementById('section-toimisto');
        if (el) el.style.display = 'block';
    }
}

// --- 3. TIETOJEN LATAAMINEN FIRESTORESTA ---

async function loadUserProgress(uid) {
    try {
        const docRef = db.collection('userProgress').doc(uid);
        const doc = await docRef.get();

        if (doc.exists) {
            const data = doc.data();
            console.log("LADATUT TIEDOT:", data);

            // Käydään kaikki sivulla olevat checkboxit läpi
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            
            checkboxes.forEach(checkbox => {
                const taskId = checkbox.id;
                // Kategoria saadaan ID:stä. Esim. "hautaus-task1" -> "hautaus"
                const category = taskId.split('-')[0]; 
                
                // Jos tietokannassa on tälle kategorialle ja tehtävälle dataa
                if (data[category] && data[category][taskId]) {
                    const taskInfo = data[category][taskId];
                    const dateSpan = document.getElementById(`${taskId}-date`);
                    
                    // A) Jos tehtävä on tehty aiemmin (vanha boolean-tyyli tai uusi objekti)
                    if (taskInfo === true || taskInfo.completed === true) {
                        checkbox.checked = true;
                        
                        // Uusi tyyli: näytetään pvm
                        if (dateSpan && taskInfo.date) {
                            const dateObj = new Date(taskInfo.date.seconds * 1000);
                            dateSpan.innerText = `(${dateObj.toLocaleDateString('fi-FI')} ${dateObj.toLocaleTimeString('fi-FI', {hour: '2-digit', minute:'2-digit'})})`;
                            dateSpan.style.color = "#555";
                        }
                    } 
                    // B) Jos tehtävä on peruttu ja sille on kirjoitettu syy
                    else if (taskInfo.completed === false && taskInfo.removedReason) {
                        checkbox.checked = false;
                        if (dateSpan) {
                            dateSpan.innerText = `(Peruttu: ${taskInfo.removedReason})`;
                            dateSpan.style.color = "red";
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error("Virhe tietoja ladatessa:", error);
    }
}

// --- 4. CHECKBOXIEN KUUNTELIJA JA TALLENNUS (AUTOSAVE) ---

function attachCheckboxListeners() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', async (event) => {
            const taskId = event.target.id;
            const isChecked = event.target.checked;
            
            // Haetaan kategoria ID:stä (esim. "suntio-task1" -> "suntio")
            const category = taskId.split('-')[0]; 
            const dateSpan = document.getElementById(`${taskId}-date`);

            if (isChecked) {
                // --- TEHTÄVÄ SUORITETAAN ---
                const now = new Date();
                
                if (dateSpan) {
                    dateSpan.innerText = `(${now.toLocaleDateString('fi-FI')} ${now.toLocaleTimeString('fi-FI', {hour: '2-digit', minute:'2-digit'})})`;
                    dateSpan.style.color = "#555";
                }
                
                await saveTaskToDb(category, taskId, true, now, null);

            } else {
                // --- TEHTÄVÄ PERUUTETAAN ---
                const reason = prompt("Miksi haluat perua tämän perehdytysmerkinnän?\nKirjoita syy tähän:");
                
                if (reason && reason.trim() !== "") {
                    // Syy annettiin -> Sallitaan poisto
                    if (dateSpan) {
                        dateSpan.innerText = `(Peruttu: ${reason})`;
                        dateSpan.style.color = "red";
                    }
                    await saveTaskToDb(category, taskId, false, new Date(), reason);
                } else {
                    // Ei syytä -> Estetään poisto
                    alert("Kirjallinen syy on pakollinen. Merkintää ei poistettu.");
                    event.target.checked = true; // Rasti takaisin
                }
            }
        });
    });
}

// Apufunktio yhden tehtävän tallentamiseen
async function saveTaskToDb(category, taskId, isCompleted, dateObj, reasonText) {
    if (!currentUser) return;
    
    if (saveStatus) saveStatus.textContent = "Tallennetaan...";

    const userRef = db.collection('userProgress').doc(currentUser.uid);
    
    const taskData = {
        completed: isCompleted,
        date: firebase.firestore.Timestamp.fromDate(dateObj)
    };
    
    if (reasonText) {
        taskData.removedReason = reasonText;
    }

    try {
        await userRef.set({
            [category]: {
                [taskId]: taskData
            },
            lastUpdated: firebase.firestore.Timestamp.now()
        }, { merge: true }); // Tärkeää, ettei ylikirjoita muuta dataa
        
        if (saveStatus) {
            saveStatus.textContent = "Edistyminen tallennettu!";
            setTimeout(() => { saveStatus.textContent = ""; }, 2000);
        }
        
    } catch (error) {
        console.error("Virhe tallennuksessa:", error);
        alert("Virhe tietojen tallennuksessa. Tarkista verkkoyhteys.");
        if (saveStatus) saveStatus.textContent = "";
    }
}

// --- 5. VÄLILEHTIEN (TABS) LOGIIKKA ---

document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-button');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const parentSection = button.closest('.module');
            
            parentSection.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            parentSection.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
                content.style.display = 'none'; 
            });

            button.classList.add('active');

            const targetId = button.getAttribute('data-tab');
            const targetContent = document.getElementById(targetId);
            if(targetContent) {
                targetContent.classList.add('active');
                targetContent.style.display = 'block'; 
            }
        });
    });
});

// --- 6. JAETTUJEN DOKUMENTTIEN LATAUS ---

async function loadSharedDocuments() {
    const listElement = document.getElementById('document-list');
    if (!listElement) return; 

    try {
        const snapshot = await db.collection('sharedDocuments')
                                 .orderBy('uploadedAt', 'desc')
                                 .get();

        if (snapshot.empty) {
            listElement.innerHTML = '<li>Ei jaettuja dokumentteja.</li>';
            return;
        }

        listElement.innerHTML = ''; 
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const li = document.createElement('li');
            const a = document.createElement('a');
            
            a.href = data.url;        
            a.textContent = data.fileName; 
            a.target = '_blank';      
            
            li.appendChild(a);
            listElement.appendChild(li);
        });

    } catch (error) {
        console.error("Virhe jaettujen dokumenttien latauksessa:", error);
        if (error.message.includes('index')) {
            console.log("Huom: Saatat tarvita Firestore-indeksin 'sharedDocuments'-kokoelmalle (uploadedAt).");
        }
        listElement.innerHTML = '<li>Dokumenttien lataus epäonnistui.</li>';
    }
}

// --- 7. ULOSKIRJAUTUMINEN ---

if(logoutButton) {
    logoutButton.addEventListener('click', () => {
        auth.signOut().then(() => {
            window.location.href = 'index.html';
        });
    });
}