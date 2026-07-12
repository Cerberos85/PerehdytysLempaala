// js/manager-logic.js

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// --- DOM-ELEMENTIT ---
const reportContainer = document.getElementById('report-container');
const logoutButton = document.getElementById('logoutButton');
const fileUploadInput = document.getElementById('fileUploadInput');
const fileUploadButton = document.getElementById('fileUploadButton');
const uploadStatus = document.getElementById('uploadStatus');

// Etsitään valintaruutu (Näytä päättyneet)
const showEndedCheckbox = document.getElementById('showEndedContracts');
if (showEndedCheckbox) {
    showEndedCheckbox.addEventListener('change', () => {
        loadAllEmployeeProgress(); // Ladataan taulukko uudelleen kun ruksi laitetaan päälle/pois
    });
}

// --- 1. AUTH JA ALUSTUS ---

auth.onAuthStateChanged(async (user) => {
    if (user) {
        try {
            const idTokenResult = await user.getIdTokenResult(true);

            // Tarkistetaan onko manageri (tai superAdmin)
            if (idTokenResult.claims.manager) {
                console.log("Esimies tunnistettu:", user.email);
                
                // 1. Ladataan raportit
                loadAllEmployeeProgress();

                // 2. Aktivoidaan tiedoston latausnappi
                if (fileUploadButton) {
                    fileUploadButton.addEventListener('click', () => {
                        const file = fileUploadInput.files[0];
                        if (!file) {
                            alert("Valitse ensin tiedosto!");
                            return;
                        }
                        uploadSharedDocument(file);
                    });
                }

                // 3. Aktivoidaan korttien napit (Päätä/Palauta työsuhde)
                if (reportContainer) {
                    reportContainer.addEventListener('click', (event) => {
                        
                        // A) Työsuhteen päättäminen
                        if (event.target.classList.contains('end-contract-btn')) {
                            const userId = event.target.dataset.userid;
                            const userName = event.target.dataset.name;
                            if (confirm(`Haluatko varmasti merkitä käyttäjän ${userName} työsuhteen päättyneeksi?\nTiedot poistuvat tietokannasta automaattisesti 2 vuoden kuluttua.`)) {
                                markEmploymentEnded(userId);
                            }
                        }
                        
                        // B) Työsuhteen palauttaminen
                        if (event.target.classList.contains('restore-contract-btn')) {
                            const userId = event.target.dataset.userid;
                            const userName = event.target.dataset.name;
                            if (confirm(`Haluatko palauttaa käyttäjän ${userName} työsuhteen voimaan?`)) {
                                restoreEmployment(userId);
                            }
                        }
                    });
                }

            } else {
                console.warn("Käyttäjällä ei ole manager-oikeuksia.");
                alert("Ei oikeuksia tälle sivulle.");
                window.location.href = 'app.html';
            }
        } catch (error) {
            console.error("Virhe roolin tarkistuksessa:", error);
        }
    } else {
        window.location.href = 'index.html';
    }
});

// --- 2. APUFUNKTIOT TEHTÄVIEN MUOTOILUUN ---

function formatCategoryName(key) {
    if (key.startsWith('diakonia')) return 'Diakoniatyö';
    if (key.startsWith('hautaus')) return 'Hautaustoimi';
    if (key.startsWith('kausityo')) return 'Kausityö';
    if (key.startsWith('suntio')) return 'Suntion tehtävät';
    if (key.startsWith('haat')) return 'Häät ja kirkolliset toimitukset';
    if (key.startsWith('toimisto')) return 'Toimistotyö';
    if (key.startsWith('lapsi')) return 'Lapsi- ja perhetyö';
    return 'Muut tehtävät';
}

function formatTaskName(key) {
    const parts = key.split('-');
    if (parts.length > 1) parts.shift(); 
    let name = parts.join(' ');
    // Korvataan viivat ja alaviivat välilyönneillä
    name = name.replace(/[_-]/g, ' ');
    return name.charAt(0).toUpperCase() + name.slice(1);
}

// --- 3. RAPORTTIEN LATAUS JA PIIRTÄMINEN ---

async function loadAllEmployeeProgress() {
    if (!reportContainer) return;
    reportContainer.innerHTML = '<p>Ladataan tietoja...</p>';

    try {
        const user = firebase.auth().currentUser;
        const tokenResult = await user.getIdTokenResult();
        
        const isSuperAdmin = tokenResult.claims.superAdmin;
        const managedDept = tokenResult.claims.managedDepartment;

        let query = db.collection('userProgress');

        // MÄÄRITELMÄ: Mitä osastoja kukin esimies saa nähdä
        const visibilityMap = {
            'Suntio': ['Suntio', 'Suntiotyö', 'Haat'],
            'Hautaustoimi': ['Hautaustoimi', 'Kausityö'],
            'Toimisto': ['Toimisto', 'Lapsiperhe'],
            'Diakonia': ['Diakonia']
        };

        if (isSuperAdmin) {
            console.log("Super Admin - ladataan kaikki.");
        } else if (managedDept) {
            const allowedDepartments = visibilityMap[managedDept] || [managedDept];
            query = query.where('department', 'in', allowedDepartments);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
            reportContainer.innerHTML = '<p>Ei löytynyt raportoitavia työntekijöitä.</p>';
            return;
        }
        
        let html = `<div style="display: flex; flex-direction: column; gap: 20px;">`;
        let visibleRows = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            const userId = doc.id;
            const isEnded = data.employmentEnded === true;
            const email = data.userEmail || 'Tuntematon';
            const department = data.department || 'Ei osastoa';

            // SUODATUS: Tarkistetaan näytetäänkö päättyneet
            const showEnded = showEndedCheckbox ? showEndedCheckbox.checked : false;
            if (isEnded && !showEnded) {
                return; 
            }

            visibleRows++;

            // Päätetään kumpi nappi näytetään (Päätä vai Palauta)
            const actionButton = isEnded 
                ? `<button class="restore-contract-btn" data-userid="${userId}" data-name="${email}" style="background-color: #28a745; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">🔄 Palauta työsuhde</button>`
                : `<button class="end-contract-btn" data-userid="${userId}" data-name="${email}" style="background-color: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">❌ Päätä työsuhde</button>`;

            html += `
            <div class="employee-card" style="padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: ${isEnded ? '#f8f9fa' : '#fff'}; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 15px;">
                    <div>
                        <h3 style="margin: 0; color: #333;">${email}</h3>
                        <span style="font-size: 0.85em; color: #666;">Osasto/Rooli: <strong>${department}</strong></span>
                    </div>
                    <div>
                        ${isEnded ? '<span style="background-color: #f8d7da; color: #721c24; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; margin-right: 10px;">Päättynyt</span>' : '<span style="background-color: #d4edda; color: #155724; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; margin-right: 10px;">Aktiivinen</span>'}
                        ${actionButton}
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px;">
            `;

            // Kerätään tehtävät kategorioittain
            let hasTasks = false;
            const categories = {};

            Object.keys(data).forEach((key) => {
                // Sivuutetaan metatiedot
                if (['userEmail', 'department', 'employmentEnded', 'employmentEndDate', 'requiresPasswordChange', 'expireAt'].includes(key)) return;
                if (key.endsWith('-date')) return; // Ohitetaan erilliset date-kentät, ne käsitellään parin yhteydessä

                const taskData = data[key];
                // Tarkistetaan onko kyseessä vanhanmallinen ryhmäobjekti (esim data.suntio = {tehtava1: true})
                if (typeof taskData === 'object' && taskData !== null && !taskData.completed && !taskData.seconds) {
                    // Tämä on vanhan mallinen tietokantarakenne, jätetään huomioimatta (uusi tallentaa suoraan juureen)
                    return; 
                }

                hasTasks = true;
                const categoryName = formatCategoryName(key);
                if (!categories[categoryName]) categories[categoryName] = [];
                
                // Selvitetään onko tehty ja milloin
                let isDone = false;
                let dateStr = '';
                
                if (typeof taskData === 'boolean') {
                    isDone = taskData;
                } else if (taskData && typeof taskData === 'object') {
                    isDone = taskData.completed;
                    if (taskData.date && taskData.date.seconds) {
                        dateStr = new Date(taskData.date.seconds * 1000).toLocaleDateString('fi-FI');
                    }
                }

                // Haetaan päivämäärä erillisestä kentästä (jos on)
                if (data[`${key}-date`] && data[`${key}-date`].seconds) {
                    dateStr = new Date(data[`${key}-date`].seconds * 1000).toLocaleDateString('fi-FI');
                }

                categories[categoryName].push({
                    key: key,
                    done: isDone,
                    date: dateStr
                });
            });

            if (hasTasks) {
                Object.keys(categories).forEach((catName) => {
                    html += `
                    <div style="background: #fdfdfd; padding: 12px; border: 1px solid #eaeaea; border-radius: 6px;">
                        <h5 style="margin: 0 0 10px 0; color: #0056b3; border-bottom: 1px solid #eee; padding-bottom: 5px;">${catName}</h5>
                        <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.9em;">
                    `;

                    categories[catName].forEach((task) => {
                        if (task.done) {
                            html += `
                            <li style="margin-bottom: 6px; color: #155724; background: #e8f5e9; padding: 6px 10px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                                <span>✓ ${formatTaskName(task.key)}</span>
                                <span style="font-size: 0.8em; color: #558b2f; font-weight: bold;">${task.date || 'Tehty'}</span>
                            </li>`;
                        } else {
                            html += `
                            <li style="margin-bottom: 6px; color: #6c757d; background: #f8f9fa; padding: 6px 10px; border-radius: 4px; border-left: 3px solid #dee2e6;">
                                <span>○ ${formatTaskName(task.key)}</span>
                            </li>`;
                        }
                    });

                    html += `</ul></div>`;
                });
            } else {
                html += `<p style="color: #999; font-style: italic; width: 100%;">Ei vielä kirjattuja tehtäviä.</p>`;
            }

            html += `
                </div>
            </div>`;
        });
        
        html += '</div>';
        
        if (visibleRows === 0) {
            reportContainer.innerHTML = '<p>Ei näytettäviä työntekijöitä tällä suodattimella.</p>';
        } else {
            reportContainer.innerHTML = html;
        }

    } catch (error) {
        console.error("Virhe raporttien lataamisessa:", error);
        reportContainer.innerHTML = `<p style="color:red;">Latausvirhe: ${error.message}</p>`;
    }
}

// --- 4. TYÖSUHTEEN PÄÄTTÄMINEN JA PALAUTUS (TTL) ---

async function markEmploymentEnded(userId) {
    try {
        const now = new Date();
        const twoYearsFromNow = new Date();
        twoYearsFromNow.setFullYear(now.getFullYear() + 2);

        await db.collection('userProgress').doc(userId).set({
            employmentEnded: true,
            employmentEndDate: firebase.firestore.Timestamp.fromDate(now),
            expireAt: firebase.firestore.Timestamp.fromDate(twoYearsFromNow) // TTL-kenttä
        }, { merge: true }); 
        
        alert("Työsuhde merkitty päättyneeksi. Tiedot piilotetaan raportista ja ne poistuvat tietokannasta automaattisesti 2 vuoden kuluttua.");
        loadAllEmployeeProgress(); // Päivitä lista
        
    } catch (error) {
        console.error("Virhe:", error);
        alert("Virhe toiminnossa: " + error.message);
    }
}

async function restoreEmployment(userId) {
    try {
        await db.collection('userProgress').doc(userId).update({
            employmentEnded: false,
            employmentEndDate: firebase.firestore.FieldValue.delete(), 
            expireAt: firebase.firestore.FieldValue.delete()           
        });
        
        alert("Työsuhde on palautettu voimaan! Työntekijä voi jälleen kirjautua normaalisti.");
        loadAllEmployeeProgress(); 

    } catch (error) {
        console.error("Virhe palautuksessa:", error);
        alert("Virhe toiminnossa: " + error.message);
    }
}

// --- 5. TIEDOSTOJEN LATAUS (STORAGE) ---

async function uploadSharedDocument(file) {
    if (!uploadStatus) return;
    uploadStatus.textContent = "Ladataan...";
    uploadStatus.style.color = "blue";

    try {
        const storageRef = storage.ref(`shared_documents/${file.name}`);
        await storageRef.put(file);
        const downloadURL = await storageRef.getDownloadURL();
        
        await db.collection('sharedDocuments').add({
            fileName: file.name,
            url: downloadURL,
            uploadedAt: firebase.firestore.Timestamp.now()
        });

        uploadStatus.textContent = `✅ Tiedosto "${file.name}" ladattu ja jaettu!`;
        uploadStatus.style.color = "green";
        if(fileUploadInput) fileUploadInput.value = ""; 

    } catch (error) {
        console.error("Latausvirhe:", error);
        uploadStatus.textContent = "❌ Lataus epäonnistui: " + error.message;
        uploadStatus.style.color = "red";
    }
}

// --- 6. ULOSKIRJAUTUMINEN ---

if(logoutButton) {
    logoutButton.addEventListener('click', () => {
        const originalText = logoutButton.textContent;
        logoutButton.textContent = "Kirjaudutaan ulos...";
        logoutButton.disabled = true;

        auth.signOut().then(() => {
            window.location.href = 'index.html';
        }).catch((error) => {
            console.error("Virhe uloskirjautumisessa:", error);
            logoutButton.textContent = originalText;
            logoutButton.disabled = false;
        });
    });
}