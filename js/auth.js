// js/auth.js

// Alustetaan Firebase
// js/auth.js

const auth = firebase.auth();
const db = firebase.firestore();

const loginButton = document.getElementById('loginButton');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('error-message');

if (loginButton) {
    loginButton.addEventListener('click', () => {
        const email = emailInput.value;
        const password = passwordInput.value;
        
        // --- 1. VISUAALINEN PALAUTE PÄÄLLE ---
        const originalText = loginButton.textContent; // Otetaan talteen alkuperäinen teksti ("Kirjaudu")
        loginButton.textContent = "Kirjaudutaan...";  // Vaihdetaan teksti
        loginButton.disabled = true;                  // Lukitaan nappi, jottei sitä voi painaa kahdesti
        errorMessage.textContent = "";                // Tyhjennetään vanhat virheet ruudulta

        auth.signInWithEmailAndPassword(email, password)
            .then(async (userCredential) => {
                const user = userCredential.user;
                
                // --- 2. Tarkistetaan tietokannasta, onko salasanan vaihto pakotettu ---
                const userDoc = await db.collection('userProgress').doc(user.uid).get();
                
                if (userDoc.exists && userDoc.data().requiresPasswordChange === true) {
                    // Jos on, heitetään käyttäjä salasananvaihtosivulle!
                    window.location.href = 'change-password.html';
                    return; // Lopetetaan suoritus tähän
                }

                // --- 3. Jos vaihtoa ei vaadita, käytetään erillistä funktiota roolin tarkistukseen ---
                await checkUserRoleAndRedirect(user);
            })
            .catch((error) => {
                console.error("Kirjautumisvirhe:", error);
                errorMessage.textContent = "Väärä sähköposti tai salasana.";
                
                // --- 4. PALAUTETAAN NAPPI NORMAALIKSI VIRHETILANTEESSA ---
                loginButton.textContent = originalText;
                loginButton.disabled = false;
            });
    });
}

// Funktio, joka tekee päätöksen minne mennään
async function checkUserRoleAndRedirect(user) {
    console.log("Aloitetaan roolin tarkistus...");
    
    try {
        // Pakotetaan haku palvelimelta (true)
        const idTokenResult = await user.getIdTokenResult(true);
        const claims = idTokenResult.claims;

        console.log("Löydetyt roolit (Claims):", claims);

        // TARKISTUS: Onko manager tai superAdmin?
        if (claims.manager === true || claims.superAdmin === true) {
            console.log(">>> PÄÄTÖS: Käyttäjä on ESIMIES -> Ohjataan manager.html");
            window.location.href = 'manager.html';
        } else {
            console.log(">>> PÄÄTÖS: Käyttäjä on TYÖNTEKIJÄ -> Ohjataan app.html");
            window.location.href = 'app.html';
        }

    } catch (error) {
        console.error("Virhe roolien tarkistuksessa:", error);
        errorMessage.textContent = "Virhe roolien haussa. Yritä uudelleen.";
        
        // Palautetaan nappi täälläkin, jos roolien haussa tulee yllättävä verkkohäiriö
        if (loginButton) {
            loginButton.textContent = "Kirjaudu";
            loginButton.disabled = false;
        }
    }
}