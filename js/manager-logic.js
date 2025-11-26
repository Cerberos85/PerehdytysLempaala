// js/manager-logic.js

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage(); // Varmista, että tämä on mukana!

const reportContainer = document.getElementById('report-container');
const logoutButton = document.getElementById('logoutButton');

// Latauskomponentit
const fileUploadInput = document.getElementById('fileUploadInput');
const fileUploadButton = document.getElementById('fileUploadButton');
const uploadStatus = document.getElementById('uploadStatus');

// --- 1. AUTH JA ALUSTUS ---

auth.onAuthStateChanged(async (user) => {
    if (user) {
        // Tarkistetaan rooli
        const idTokenResult = await user.getIdTokenResult(true);

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
            reportContainer.addEventListener('click', (event) => {
                if (event.target.classList.contains('end-contract-btn')) {
                    const userId = event.target.dataset.userid;
                    const userName = event.target.closest('tr').cells[0].textContent.trim();
        
                    if (confirm(`Haluatko varmasti merkitä käyttäjän ${userName} työsuhteen päättyneeksi?`)) {
                        markEmploymentEnded(userId);
                    }
                }
            });

        } else {
            alert("Ei oikeuksia tälle sivulle.");
            window.location.href = 'app.html';
        }

    } else {
        window.location.href = 'index.html';
    }
});

// --- 2. RAPORTTIEN LATAUS ---

async function loadAllEmployeeProgress() {
    reportContainer.innerHTML = 'Ladataan tietoja...';

    try {
        const user = firebase.auth().currentUser;
        const tokenResult = await user.getIdTokenResult();
        
        const isSuperAdmin = tokenResult.claims.superAdmin;
        const managedDept = tokenResult.claims.managedDepartment;

        let query = db.collection('userProgress');

        // Suodatetaan osaston mukaan
        if (isSuperAdmin) {
            console.log("Super Admin - ladataan kaikki.");
        } else if (managedDept) {
            console.log(`Osastoesimies (${managedDept})`);
            query = query.where('department', '==', managedDept);
        }

        query = query.where('employmentEnded', '!=', true);

        const snapshot = await query.get();
        
        // --- PÄIVITETTY TAULUKON OTSIKOT ---
        let html = `
            <div style="overflow-x: auto;"> <table>
                <tr>
                    <th>Työntekijä</th>
                    <th>Suntio %</th>
                    <th>Toimisto %</th>
                    <th>Hautaustoimi %</th> <th>Suntiotyö %</th>    <th>Lapsiperhe %</th>   <th>Häät %</th>
                    <th>Päivitetty</th>
                    <th>Toiminnot</th>
                </tr>
        `;

        snapshot.forEach(doc => {
            const data = doc.data();
            
            // --- LASKETAAN KAIKKI ROOLIT ---
            const suntioProgress = calculateProgress(data.suntio);
            const toimistoProgress = calculateProgress(data.toimisto);
            const haatProgress = calculateProgress(data.haat);
            
            // Uudet osiot
            const hautausProgress = calculateProgress(data.hautaustoimi);
            const suntiotyoProgress = calculateProgress(data.suntiotyo);
            const lapsiProgress = calculateProgress(data.lapsiperhe);
            
            const userLink = `<a href="employee-report.html?uid=${doc.id}" target="_blank">${data.userEmail || 'Tuntematon'}</a>`;
            const lastUpdated = data.lastUpdated ? data.lastUpdated.toDate().toLocaleString('fi-FI') : '-';

            html += `
                <tr>
                    <td>${userLink}</td>
                    <td>${suntioProgress}%</td>
                    <td>${toimistoProgress}%</td>
                    <td>${hautausProgress}%</td>    <td>${suntiotyoProgress}%</td>  <td>${lapsiProgress}%</td>      <td>${haatProgress}%</td>
                    <td>${lastUpdated}</td>
                    <td>
                        <button class="end-contract-btn" data-userid="${doc.id}">Päätä työsuhde</button>
                    </td>
                </tr>
            `;
        });
        
        html += '</table></div>';
        reportContainer.innerHTML = html;

    } catch (error) {
        console.error("Virhe raporttien lataamisessa:", error);
        reportContainer.innerHTML = '<p style="color:red;">Latausvirhe (tarkista konsoli F12).</p>';
    }
}

// --- 3. TIEDOSTOJEN LATAUS (STORAGE) ---

async function uploadSharedDocument(file) {
    uploadStatus.textContent = "Ladataan...";
    uploadStatus.style.color = "blue";

    try {
        // 1. Luodaan viittaus Storageen
        const storageRef = storage.ref(`shared_documents/${file.name}`);
        
        // 2. Lähetetään tiedosto
        await storageRef.put(file);
        
        // 3. Haetaan latauslinkki
        const downloadURL = await storageRef.getDownloadURL();
        
        // 4. Tallennetaan linkki tietokantaan
        await db.collection('sharedDocuments').add({
            fileName: file.name,
            url: downloadURL,
            uploadedAt: firebase.firestore.Timestamp.now()
        });

        uploadStatus.textContent = `✅ Tiedosto "${file.name}" ladattu ja jaettu!`;
        uploadStatus.style.color = "green";
        fileUploadInput.value = ""; // Tyhjennetään kenttä

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

logoutButton.addEventListener('click', () => {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    });
});