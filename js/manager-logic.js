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

// UUSI: Etsitään valintaruutu (Näytä päättyneet)
const showEndedCheckbox = document.getElementById('showEndedContracts');
if (showEndedCheckbox) {
    showEndedCheckbox.addEventListener('change', () => {
        loadAllEmployeeProgress(); // Ladataan taulukko uudelleen kun ruksi laitetaan päälle/pois
    });
}

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
                            if (confirm(`Haluatko varmasti merkitä käyttäjän ${userName} työsuhteen päättyneeksi?\nTiedot poistuvat tietokannasta automaattisesti 2 vuoden kuluttua.`)) {
                                markEmploymentEnded(userId);
                            }
                        }
                        
                        // B) Työsuhteen palauttaminen (UUSI)
                        if (event.target.classList.contains('restore-contract-btn')) {
                            const userId = event.target.dataset.userid;
                            const userName = event.target.closest('tr').cells[0].textContent.trim();
                            if (confirm(`Haluatko palauttaa käyttäjän ${userName} työsuhteen voimaan?`)) {
                                restoreEmployment(userId);
                            }
                        }

                        // C) Tarkastelu (Modal)
                        if (event.target.classList.contains('view-details-btn')) {
                            const rawData = event.target.getAttribute('data-entry');
                            const userName = event.target.getAttribute('data-name');
                            
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

        // MÄÄRITELMÄ: Mitä osastoja kukin esimies saa nähdä
        const visibilityMap = {
            'Suntio': ['Suntio', 'Suntiotyö', 'Haat'],
            'Hautaustoimi': ['Hautaustoimi', 'Kausityö'],
            'Toimisto': ['Toimisto', 'Lapsiperhe']
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
                        <th style="background-color: #fce8e6;">Kausityö %</th> 
                        <th>Toiminnot</th>
                    </tr>
                </thead>
                <tbody>
        `;

        let visibleRows = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            const isEnded = data.employmentEnded === true;

            // --- SUODATUS: Tarkistetaan näytetäänkö päättyneet ---
            const showEnded = showEndedCheckbox ? showEndedCheckbox.checked : false;
            if (isEnded && !showEnded) {
                return; // Piilotetaan, jos checkbox ei ole valittuna
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
            const kausityoProgress = calculateProgress(data.kausityo); 

            // Visuaaliset tyylit päättyneille työsuhteille
            const rowStyle = isEnded ? 'background-color: #f5f5f5; color: #888; font-style: italic;' : '';
            const roleText = isEnded ? `${userRole} <br><small style="color:red;">(Päättynyt)</small>` : userRole;

            // Linkki yksilöraporttiin
            const userLink = `<a href="employee-report.html?uid=${doc.id}" target="_blank" style="${isEnded ? 'color:#888;' : ''}">${data.userEmail || 'Tuntematon'}</a>`;

            // Päätetään kumpi nappi näytetään (Päätä vai Palauta)
            const actionButton = isEnded 
                ? `<button class="restore-contract-btn" data-userid="${doc.id}" style="background-color: #28a745; margin-top: 5px;">🔄 Palauta</button>`
                : `<button class="end-contract-btn" data-userid="${doc.id}" style="background-color: #dc3545; margin-top: 5px;">❌ Päätä</button>`;

            const safeData = encodeURIComponent(JSON.stringify(data));

            html += `
                <tr style="${rowStyle}">
                    <td>${userLink}</td>
                    <td>${roleText}</td> 
                    <td>${suntioProgress}%</td>
                    <td>${toimistoProgress}%</td>
                    <td>${hautausProgress}%</td>     
                    <td>${suntiotyoProgress}%</td>  
                    <td>${lapsiProgress}%</td>      
                    <td>${haatProgress}%</td>
                    <td>${kausityoProgress}%</td>
                    <td>
                        <button class="view-details-btn" data-entry="${safeData}" data-name="${data.userEmail}">👁️ Tarkastele</button>
                        ${actionButton}
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
    
    const tasks = Object.values(categoryData);
    if (tasks.length === 0) return 0;

    let completedCount = 0;
    tasks.forEach(task => {
        // Lasketaan vain aidosti valmiit (ei peruttuja)
        if (task === true || (typeof task === 'object' && task !== null && task.completed === true)) {
            completedCount++;
        }
    });

    return Math.round((completedCount / tasks.length) * 100);
}

// --- 4. MODAL LOGIIKKA (POPUP) ---

if (closeModalBtn) {
    closeModalBtn.onclick = function() {
        modal.style.display = "none";
    }
}

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
    modalBody.innerHTML = ''; 

    const categories = {
        'suntio': 'Suntion tehtävät',
        'toimisto': 'Toimisto',
        'hautaustoimi': 'Hautaustoimi',
        'suntiotyo': 'Suntiotyö',
        'lapsiperhe': 'Lapsi- ja perhetyö',
        'haat': 'Häät',
        'kausityo': 'Kausityöntekijä' 
    };

    let contentFound = false;

    for (const [key, title] of Object.entries(categories)) {
        let categoryData = data[key];
        if (!categoryData && key === 'hautaustoimi') categoryData = data['hautaus'];

        if (categoryData && Object.keys(categoryData).length > 0) {
            contentFound = true;
            const section = document.createElement('div');
            section.className = 'detail-section';
            
            let itemsHtml = `<h3>${title}</h3>`;
            
            const sortedKeys = Object.keys(categoryData).sort((a, b) => {
                const numA = parseInt(a.replace(/^\D+/g, '')) || 0;
                const numB = parseInt(b.replace(/^\D+/g, '')) || 0;
                return numA - numB;
            });

            sortedKeys.forEach(taskKey => {
                const taskVal = categoryData[taskKey];
                let isDone = false;
                let dateStr = '';
                let reasonStr = '';

                // UUSI LOGIIKKA: Käsitellään myös peruutussyyt
                if (typeof taskVal === 'boolean') {
                    isDone = taskVal;
                } else if (taskVal && typeof taskVal === 'object') {
                    isDone = taskVal.completed;
                    if (isDone && taskVal.date) {
                        const dateObj = new Date(taskVal.date.seconds * 1000); 
                        dateStr = ` <small style="color:#666;">(${dateObj.toLocaleDateString('fi-FI')} ${dateObj.toLocaleTimeString('fi-FI', {hour: '2-digit', minute:'2-digit'})})</small>`;
                    } else if (!isDone && taskVal.removedReason) {
                        reasonStr = ` <br><small style="color:red; margin-left: 25px;">Syy peruutukseen: "${taskVal.removedReason}"</small>`;
                    }
                }

                // Jos peruttu, näytetään huutomerkki tai vastaava ikoni
                const icon = isDone ? '✅' : (reasonStr ? '⚠️' : '❌');
                const color = isDone ? 'green' : (reasonStr ? '#d9534f' : '#d9534f');
                const taskName = taskKey.replace(/task/i, 'Tehtävä ');

                itemsHtml += `
                    <div class="detail-item" style="border-bottom: 1px solid #f0f0f0; padding: 6px 0;">
                        <span class="status-icon">${icon}</span> 
                        <span style="color:${color}; font-weight:500;">${taskName}</span> ${dateStr}
                        ${reasonStr}
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

// --- 5. TYÖSUHTEEN PÄÄTTÄMINEN (TTL 2 VUOTTA) ---

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

// --- 6. TYÖSUHTEEN PALAUTTAMINEN (UUSI) ---

async function restoreEmployment(userId) {
    try {
        await db.collection('userProgress').doc(userId).update({
            employmentEnded: false,
            employmentEndDate: firebase.firestore.FieldValue.delete(), // Poistetaan päättymispvm
            expireAt: firebase.firestore.FieldValue.delete()           // Poistetaan 2 vuoden tuhoutumisajastin
        });
        
        alert("Työsuhde on palautettu voimaan! Työntekijä voi jälleen kirjautua normaalisti.");
        
        // Päivitä lista (piilottaa sen, jos "Näytä päättyneet" ei ole valittuna)
        loadAllEmployeeProgress(); 

    } catch (error) {
        console.error("Virhe palautuksessa:", error);
        alert("Virhe toiminnossa: " + error.message);
    }
}

// --- 7. TIEDOSTOJEN LATAUS (STORAGE) ---

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

// --- 8. ULOSKIRJAUTUMINEN ---

if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        auth.signOut().then(() => {
            window.location.href = 'index.html';
        });
    });
}