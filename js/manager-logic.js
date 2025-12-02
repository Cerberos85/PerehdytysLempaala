const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

const reportContainer = document.getElementById('report-container');
const logoutButton = document.getElementById('logoutButton');

// Latauskomponentit
const fileUploadInput = document.getElementById('fileUploadInput');
const fileUploadButton = document.getElementById('fileUploadButton');
const uploadStatus = document.getElementById('uploadStatus');

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

                // 3. Aktivoidaan raportin napit (Työsuhteen päättäminen)
                if (reportContainer) {
                    reportContainer.addEventListener('click', (event) => {
                        if (event.target.classList.contains('end-contract-btn')) {
                            const userId = event.target.dataset.userid;
                            const userName = event.target.closest('tr').cells[0].textContent.trim();
                
                            if (confirm(`Haluatko varmasti merkitä käyttäjän ${userName} työsuhteen päättyneeksi?`)) {
                                markEmploymentEnded(userId);
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

        // Suodatetaan päättyneet pois
        query = query.where('employmentEnded', '!=', true);

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
                        <th>Toiminnot</th>
                    </tr>
                </thead>
                <tbody>
        `;

        snapshot.forEach(doc => {
            const data = doc.data();
            
            const userRole = data.department || '-';

            // Lasketaan prosentit dynaamisesti
            const suntioProgress = calculateProgress(data.suntio);
            const toimistoProgress = calculateProgress(data.toimisto);
            const hautausProgress = calculateProgress(data.hautaustoimi || data.hautaus); 
            const suntiotyoProgress = calculateProgress(data.suntiotyo);
            const lapsiProgress = calculateProgress(data.lapsiperhe);
            const haatProgress = calculateProgress(data.haat); // Tämä puuttui aiemmin!

            // Linkki yksilöraporttiin
            const userLink = `<a href="employee-report.html?uid=${doc.id}" target="_blank">${data.userEmail || 'Tuntematon'}</a>`;

            const roleStyle = userRole === '-' ? 'color: red; font-weight: bold;' : '';

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
                    <td>
                        <button class="end-contract-btn" data-userid="${doc.id}">Päätä työsuhde</button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div>';
        reportContainer.innerHTML = html;

    } catch (error) {
        console.error("Virhe raporttien lataamisessa:", error);
        reportContainer.innerHTML = `<p style="color:red;">Latausvirhe: ${error.message}</p>`;
    }
}

// --- APUFUNKTIO: PROSENTTIEN LASKENTA ---
// Tämä osaa laskea prosentit riippumatta tehtävien määrästä (2 tai 12)
function calculateProgress(categoryData) {
    if (!categoryData) return 0;
    
    // Muutetaan objekti arvojen taulukoksi (oli siellä 2 tai 12 tehtävää)
    const tasks = Object.values(categoryData);
    if (tasks.length === 0) return 0;

    let completedCount = 0;
    tasks.forEach(task => {
        // Tuetaan sekä boolean-arvoja (true) että objekteja {completed: true}
        if (task === true || (typeof task === 'object' && task !== null && task.completed === true)) {
            completedCount++;
        }
    });

    return Math.round((completedCount / tasks.length) * 100);
}

// --- 3. TIEDOSTOJEN LATAUS (STORAGE) ---

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

// --- 4. TYÖSUHTEEN PÄÄTTÄMINEN ---

async function markEmploymentEnded(userId) {
    try {
        await db.collection('userProgress').doc(userId).update({
            employmentEnded: true,
            employmentEndDate: firebase.firestore.Timestamp.now()
        });
        alert("Työsuhde merkitty päättyneeksi.");
        loadAllEmployeeProgress(); // Päivitä lista
    } catch (error) {
        console.error("Virhe:", error);
        alert("Virhe toiminnossa.");
    }
}

// --- 5. ULOSKIRJAUTUMINEN ---

if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        auth.signOut().then(() => {
            window.location.href = 'index.html';
        });
    });
}