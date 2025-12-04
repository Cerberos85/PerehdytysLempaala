// js/manager-logic.js

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// DOM-elementit
const reportContainer = document.getElementById('report-container');
const logoutButton = document.getElementById('logoutButton');
const fileUploadInput = document.getElementById('fileUploadInput');
const fileUploadButton = document.getElementById('fileUploadButton');
const uploadStatus = document.getElementById('uploadStatus');

// Modal-elementit (Tarkasteluikkuna)
const modal = document.getElementById("detailModal");
const closeModalBtn = document.getElementsByClassName("close-btn")[0];

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

                // 3. Aktivoidaan raporttitaulukon napit (Delegointi)
                if (reportContainer) {
                    reportContainer.addEventListener('click', (event) => {
                        // A) Työsuhteen päättäminen
                        if (event.target.classList.contains('end-contract-btn')) {
                            const userId = event.target.dataset.userid;
                            const userName = event.target.closest('tr').cells[0].textContent.trim();
                
                            if (confirm(`Haluatko varmasti merkitä käyttäjän ${userName} työsuhteen päättyneeksi?`)) {
                                markEmploymentEnded(userId);
                            }
                        }
                        
                        // B) Tarkastelu (Modal)
                        if (event.target.classList.contains('view-details-btn')) {
                            const rawData = event.target.getAttribute('data-entry');
                            const userName = event.target.getAttribute('data-name');
                            
                            // Puretaan JSON-data takaisin objektiksi
                            try {
                                const data = JSON.parse(decodeURIComponent(rawData));
                                openDetailModal(userName, data);
                            } catch (e) {
                                console.error("Virhe datan purkamisessa:", e);
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

// --- 2. RAPORTTIEN LATAUS ---

async function loadAllEmployeeProgress() {
    if (!reportContainer) return;
    reportContainer.innerHTML = '<p>Ladataan tietoja...</p>';

    try {
        const user = firebase.auth().currentUser;
        const tokenResult = await user.getIdTokenResult();
        
        const isSuperAdmin = tokenResult.claims.superAdmin;
        const managedDept = tokenResult.claims.managedDepartment;

        let query = db.collection('userProgress');

        // Suodatetaan osaston mukaan (Super Admin näkee kaikki)
        if (isSuperAdmin) {
            console.log("Super Admin - ladataan kaikki.");
        } else if (managedDept) {
            console.log(`Osastoesimies (${managedDept})`);
            query = query.where('department', '==', managedDept);
        }

        // HUOM: Emme käytä Firestoren "employmentEnded != true" suodatusta tässä,
        // koska se piilottaisi käyttäjät, joilla kenttää ei vielä ole.
        // Teemme suodatuksen JavaScriptissä alla.

        const snapshot = await query.get();

        if (snapshot.empty) {
            reportContainer.innerHTML = '<p>Ei löytynyt raportoitavia työntekijöitä.</p>';
            return;
        }
        
        // Luodaan taulukko
        let html = `
            <div style="overflow-x: auto;"> 
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Työntekijä</th>
                        <th style="background-color: #e8f0fe;">Rooli</th> 
                        <th>Suntio %</th>
                        <th>Toimisto %</th>
                        <th>Hautaus %</th> 
                        <th>Suntiotyö %</th>    
                        <th>Lapsiperhe %</th>   
                        <th>Häät %</th>
                        <th style="background-color: #fce8e6;">Kausityö %</th> <th>Toiminnot</th>
                    </tr>
                </thead>
                <tbody>
        `;

        let visibleRows = 0;

        snapshot.forEach(doc => {
            const data = doc.data();

            // --- SUODATUS: Piilotetaan päättyneet työsuhteet ---
            if (data.employmentEnded === true) {
                return; // Hypätään yli (continue)
            }
            visibleRows++;
            
            const userRole = data.department || '-';

            // Lasketaan prosentit dynaamisesti
            const suntioProgress = calculateProgress(data.suntio);
            const toimistoProgress = calculateProgress(data.toimisto);
            const hautausProgress = calculateProgress(data.hautaustoimi || data.hautaus); 
            const suntiotyoProgress = calculateProgress(data.suntiotyo);
            const lapsiProgress = calculateProgress(data.lapsiperhe);
            const haatProgress = calculateProgress(data.haat); 
            const kausityoProgress = calculateProgress(data.kausityo); // UUSI ROOLI

            // Linkki yksilöraporttiin (HTML-sivu)
            const userLink = `<a href="employee-report.html?uid=${doc.id}" target="_blank">${data.userEmail || 'Tuntematon'}</a>`;
            const roleStyle = userRole === '-' ? 'color: red; font-weight: bold;' : '';

            // Pakataan data turvallisesti napin attribuuttiin modaalia varten
            const safeData = encodeURIComponent(JSON.stringify(data));

            html += `
                <tr>
                    <td>${userLink}</td>
                    <td style="${roleStyle}">${userRole}</td> 
                    <td>${suntioProgress}%</td>
                    <td>${toimistoProgress}%</td>
                    <td>${hautausProgress}%</td>     
                    <td>${suntiotyoProgress}%</td>  
                    <td>${lapsiProgress}%</td>      
                    <td>${haatProgress}%</td>
                    <td>${kausityoProgress}%</td>
                    <td>
                        <button class="view-details-btn" data-entry="${safeData}" data-name="${data.userEmail}">
                            👁️ Tarkastele
                        </button>

                        <button class="end-contract-btn" data-userid="${doc.id}">Päätä työsuhde</button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div>';
        
        if (visibleRows === 0) {
            reportContainer.innerHTML = '<p>Ei aktiivisia työntekijöitä.</p>';
        } else {
            reportContainer.innerHTML = html;
        }

    } catch (error) {
        console.error("Virhe raporttien lataamisessa:", error);
        reportContainer.innerHTML = `<p style="color:red;">Latausvirhe: ${error.message}</p>`;
    }
}

// --- 3. APUFUNKTIOT (LASKENTA) ---

function calculateProgress(categoryData) {
    if (!categoryData) return 0;
    
    // Muutetaan objekti arvojen taulukoksi
    const tasks = Object.values(categoryData);
    if (tasks.length === 0) return 0;

    let completedCount = 0;
    tasks.forEach(task => {
        // Tuetaan boolean-arvoja (true) ja objekteja {completed: true}
        if (task === true || (typeof task === 'object' && task !== null && task.completed === true)) {
            completedCount++;
        }
    });

    return Math.round((completedCount / tasks.length) * 100);
}

// --- 4. MODAL LOGIIKKA (POPUP) ---

// Sulje kun ruksista painetaan
if (closeModalBtn) {
    closeModalBtn.onclick = function() {
        modal.style.display = "none";
    }
}

// Sulje kun klikataan ohi ikkunan
window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

function openDetailModal(userName, data) {
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    if(!modalTitle || !modalBody) return;

    modalTitle.textContent = `Perehdytys: ${userName}`;
    modalBody.innerHTML = ''; // Tyhjennä vanhat

    // Määritellään kategoriat ja niiden otsikot
    const categories = {
        'suntio': 'Suntion tehtävät',
        'toimisto': 'Toimisto',
        'hautaustoimi': 'Hautaustoimi',
        'suntiotyo': 'Suntiotyö',
        'lapsiperhe': 'Lapsi- ja perhetyö',
        'haat': 'Häät',
        'kausityo': 'Kausityöntekijä' // UUSI
    };

    let contentFound = false;

    // Käydään kategoriat läpi
    for (const [key, title] of Object.entries(categories)) {
        // Tietokannassa voi olla 'hautaustoimi' tai 'hautaus', tarkistetaan molemmat
        let categoryData = data[key];
        if (!categoryData && key === 'hautaustoimi') categoryData = data['hautaus'];

        if (categoryData && Object.keys(categoryData).length > 0) {
            contentFound = true;
            const section = document.createElement('div');
            section.className = 'detail-section';
            
            let itemsHtml = `<h3>${title}</h3>`;
            
            // Lajitellaan tehtävät nimen mukaan (task1, task2...)
            const sortedKeys = Object.keys(categoryData).sort((a, b) => {
                // Yritetään järjestää numeron mukaan jos mahdollista
                const numA = parseInt(a.replace(/^\D+/g, '')) || 0;
                const numB = parseInt(b.replace(/^\D+/g, '')) || 0;
                return numA - numB;
            });

            sortedKeys.forEach(taskKey => {
                const taskVal = categoryData[taskKey];
                let isDone = false;
                let dateStr = '';

                if (typeof taskVal === 'boolean') {
                    isDone = taskVal;
                } else if (taskVal && typeof taskVal === 'object') {
                    isDone = taskVal.completed;
                    if (isDone && taskVal.date) {
                        const dateObj = new Date(taskVal.date.seconds * 1000); 
                        dateStr = ` <small>(${dateObj.toLocaleDateString('fi-FI')})</small>`;
                    }
                }

                const icon = isDone ? '✅' : '❌';
                const color = isDone ? 'green' : '#d9534f';
                // Siistitään nimi: "task1" -> "Tehtävä 1" tai "kausityo-task1" -> "Kausityö-task1"
                // Yksinkertainen tapa on näyttää ID, mutta käyttäjäystävällisempi olisi kääntää.
                // Tässä näytetään puhdas avain hieman siistittynä.
                const taskName = taskKey.replace(/task/i, 'Tehtävä ');

                itemsHtml += `
                    <div class="detail-item" style="border-bottom: 1px solid #f0f0f0; padding: 4px 0;">
                        <span class="status-icon">${icon}</span> 
                        <span style="color:${color}; font-weight:500;">${taskName}</span> ${dateStr}
                    </div>
                `;
            });

            section.innerHTML = itemsHtml;
            modalBody.appendChild(section);
        }
    }

    if (!contentFound) {
        modalBody.innerHTML = '<p>Ei kirjattuja suorituksia.</p>';
    }

    modal.style.display = "block";
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

// --- 6. TYÖSUHTEEN PÄÄTTÄMINEN ---

async function markEmploymentEnded(userId) {
    try {
        await db.collection('userProgress').doc(userId).set({
            employmentEnded: true,
            employmentEndDate: firebase.firestore.Timestamp.now()
        }, { merge: true }); // Merge true varmistaa ettei muu data katoa
        
        alert("Työsuhde merkitty päättyneeksi.");
        loadAllEmployeeProgress(); // Päivitä lista
    } catch (error) {
        console.error("Virhe:", error);
        alert("Virhe toiminnossa.");
    }
}

// --- 7. ULOSKIRJAUTUMINEN ---

if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        auth.signOut().then(() => {
            window.location.href = 'index.html';
        });
    });
}