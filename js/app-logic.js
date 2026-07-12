// js/app-logic.js

const auth = firebase.auth();
const db = firebase.firestore();

let currentUser; 
const logoutButton = document.getElementById('logoutButton');
const saveStatus = document.getElementById('saveStatus'); 

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

        // Kun tiedot on ladattu, aktivoidaan kuuntelijat
        attachCheckboxListeners();

    } else {
        console.log("Ei käyttäjää, ohjataan kirjautumiseen.");
        window.location.href = 'index.html';
    }
});

// --- 2. NÄKYMÄN HALLINTA (ROOLIT) ---

function showSectionsBasedOnRole(role) {
    // 1. Piilotetaan ensin kaikki osiot
    const allSections = document.querySelectorAll('.module');
    allSections.forEach(section => {
        if (section.id !== 'section-shared-docs') { 
            section.style.display = 'none';
        }
    });

    // 2. Määritellään, mitä osioita kukin rooli saa nähdä
    const roleVisibility = {
        'Hautaustoimi': ['section-hautaus', 'section-kausityo'], 
        'Hautaus': ['section-hautaus', 'section-kausityo'], // Varmuuden vuoksi myös vanha nimi
        'Kausityö': ['section-hautaus', 'section-kausityo'],     
        'Suntio': ['section-suntio', 'section-haat', 'section-suntiotyo'],
        'Suntiotyö': ['section-suntiotyo', 'section-haat'],
        'Toimisto': ['section-toimisto'],
        'Lapsiperhe': ['section-lapsiperhe'],
        'Lapsi ja perhetyö': ['section-lapsiperhe'] 
        'Diakonia': ['section-diakonia']
    };

    // 3. Haetaan käyttäjän roolia vastaava lista
    const sectionsToShow = roleVisibility[role] || []; 

    // 4. Näytetään oikeat laatikot
    sectionsToShow.forEach(sectionId => {
        const el = document.getElementById(sectionId);
        if (el) {
            el.style.display = 'block';
        }
    });
}

// --- 3. TIETOJEN LATAAMINEN FIRESTORESTA ---

async function loadUserProgress(uid) {
    try {
        const docRef = db.collection('userProgress').doc(uid);
        const doc = await docRef.get();

        if (doc.exists) {
            const data = doc.data();
            console.log("LADATUT TIEDOT:", data);

            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            
            checkboxes.forEach(checkbox => {
                const taskId = checkbox.id;
                const category = taskId.split('-')[0]; 
                
                if (data[category] && data[category][taskId]) {
                    const taskInfo = data[category][taskId];
                    const dateSpan = document.getElementById(`${taskId}-date`);
                    
                    if (taskInfo === true || taskInfo.completed === true) {
                        checkbox.checked = true;
                        
                        if (dateSpan && taskInfo.date) {
                            // TALLENNETAAN AIKALEIMA HTML-ELEMENTTIIN 4 VRK TARKISTUSTA VARTEN
                            checkbox.dataset.completedAt = taskInfo.date.seconds * 1000;

                            const dateObj = new Date(taskInfo.date.seconds * 1000);
                            dateSpan.innerText = `(${dateObj.toLocaleDateString('fi-FI')} ${dateObj.toLocaleTimeString('fi-FI', {hour: '2-digit', minute:'2-digit'})})`;
                            dateSpan.style.color = "#555";
                        }
                    } 
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

// --- 4. CHECKBOXIEN KUUNTELIJA JA TALLENNUS (AUTOSAVE & 4 VRK SÄÄNTÖ) ---

function attachCheckboxListeners() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', async (event) => {
            const taskId = event.target.id;
            const isChecked = event.target.checked;
            
            const category = taskId.split('-')[0]; 
            const dateSpan = document.getElementById(`${taskId}-date`);

            if (isChecked) {
                // --- TEHTÄVÄ SUORITETAAN ---
                const now = new Date();
                
                // Tallennetaan uusi aikaleima muistiin välittömästi selaimessa
                checkbox.dataset.completedAt = now.getTime();
                
                if (dateSpan) {
                    dateSpan.innerText = `(${now.toLocaleDateString('fi-FI')} ${now.toLocaleTimeString('fi-FI', {hour: '2-digit', minute:'2-digit'})})`;
                    dateSpan.style.color = "#555";
                }
                
                await saveTaskToDb(category, taskId, true, now, null);

            } else {
                // --- TEHTÄVÄ PERUUTETAAN (Otetaan rasti pois) ---
                let requireReason = false;
                
                // 1. Tarkistetaan onko 4 vrk (96 tuntia) kulunut
                if (checkbox.dataset.completedAt) {
                    const completedTime = parseInt(checkbox.dataset.completedAt, 10);
                    const currentTime = new Date().getTime();
                    const hoursDifference = (currentTime - completedTime) / (1000 * 60 * 60); // Ero tunteina
                    
                    if (hoursDifference > 96) {
                        requireReason = true; // Yli 96h (4 vrk) kulunut -> Vaaditaan syy
                    }
                }

                // 2. Kysytään syytä VAIN jos 4 vrk on ylittynyt
                if (requireReason) {
                    const reason = prompt("Perehdytyksen suorittamisesta on kulunut yli 4 vuorokautta.\nMiksi haluat perua tämän merkinnän?\nKirjoita syy tähän:");
                    
                    if (reason && reason.trim() !== "") {
                        // Syy annettu -> Sallitaan poisto ja tallennetaan syy
                        checkbox.removeAttribute('data-completedAt');
                        if (dateSpan) {
                            dateSpan.innerText = `(Peruttu: ${reason})`;
                            dateSpan.style.color = "red";
                        }
                        await saveTaskToDb(category, taskId, false, null, reason);
                    } else {
                        // Ei syytä -> Estetään poisto, rasti takaisin
                        alert("Kirjallinen syy on pakollinen yli 4 vuorokautta vanhoille merkinnöille. Merkintää ei poistettu.");
                        event.target.checked = true; 
                    }
                } else {
                    // 3. Alle 4 vrk kulunut -> Poistetaan äänettömästi (katsotaan vahinkoklikkaukseksi)
                    checkbox.removeAttribute('data-completedAt');
                    if (dateSpan) {
                        dateSpan.innerText = ""; // Tyhjennetään teksti ruudulta
                    }
                    await saveTaskToDb(category, taskId, false, null, null);
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
    
    // Rakennetaan tallennettava objekti
    const taskData = {
        completed: isCompleted
    };
    
    // Jos päivämäärä annetaan (rasti laitetaan ruutuun), tallennetaan Timestamp.
    // Jos päivämäärää ei anneta (rasti otetaan pois), poistetaan vanha Timestamp tietokannasta.
    if (dateObj) {
        taskData.date = firebase.firestore.Timestamp.fromDate(dateObj);
    } else {
        taskData.date = firebase.firestore.FieldValue.delete();
    }
    
    // Jos syy annetaan, tallennetaan se. Jos ei, poistetaan mahdollinen vanha syy tietokannasta.
    if (reasonText) {
        taskData.removedReason = reasonText;
    } else {
        taskData.removedReason = firebase.firestore.FieldValue.delete(); 
    }

    try {
        await userRef.set({
            [category]: {
                [taskId]: taskData
            },
            lastUpdated: firebase.firestore.Timestamp.now()
        }, { merge: true }); // Merge varmistaa, ettei ylikirjoiteta muita tehtäviä
        
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

// --- ULOSKIRJAUTUMINEN ---
if(logoutButton) {
    logoutButton.addEventListener('click', () => {
        // 1. Visuaalinen palaute
        const originalText = logoutButton.textContent;
        logoutButton.textContent = "Kirjaudutaan ulos...";
        logoutButton.disabled = true;

        auth.signOut().then(() => {
            window.location.href = 'index.html';
        }).catch((error) => {
            console.error("Virhe uloskirjautumisessa:", error);
            // 2. Palautetaan nappi, jos nettiyhteys pätkii tms.
            logoutButton.textContent = originalText;
            logoutButton.disabled = false;
        });
    });
}