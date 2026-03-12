// js/auth.js

// Alustetaan Firebase
const auth = firebase.auth();
const db = firebase.firestore();

const loginButton = document.getElementById('loginButton');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('error-message');

loginButton.addEventListener('click', () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');

    auth.signInWithEmailAndPassword(email, password)
        .then(async (userCredential) => {
            const user = userCredential.user;
            
            // 1. Tarkistetaan tietokannasta, onko salasanan vaihto pakotettu
            const userDoc = await db.collection('userProgress').doc(user.uid).get();
            
            if (userDoc.exists && userDoc.data().requiresPasswordChange === true) {
                // Jos on, heitetään käyttäjä salasananvaihtosivulle!
                window.location.href = 'change-password.html';
                return; // Lopetetaan suoritus tähän
            }

            // 2. Jos vaihtoa ei vaadita, katsotaan rooli ja ohjataan oikealle sivulle
            const idTokenResult = await user.getIdTokenResult();
            if (idTokenResult.claims.manager || idTokenResult.claims.superAdmin) {
                window.location.href = 'manager.html';
            } else {
                window.location.href = 'app.html';
            }
        })
        .catch((error) => {
            console.error("Kirjautumisvirhe:", error);
            errorMessage.textContent = "Väärä sähköposti tai salasana.";
        });
});

// Funktio, joka tekee päätöksen minne mennään
async function checkUserRoleAndRedirect(user) {
    console.log("2. Aloitetaan roolin tarkistus...");
    
    try {
        // Pakotetaan haku palvelimelta (true)
        const idTokenResult = await user.getIdTokenResult(true);
        const claims = idTokenResult.claims;

        console.log("3. Löydetyt roolit (Claims):", claims);

        // TARKISTUS: Onko manager?
        // Huom: Tarkistetaan onko se olemassa ja tosi
        if (claims.manager === true) {
            console.log(">>> PÄÄTÖS: Käyttäjä on ESIMIES -> Ohjataan manager.html");
            window.location.href = 'manager.html';
        } else {
            console.log(">>> PÄÄTÖS: Käyttäjä on TYÖNTEKIJÄ -> Ohjataan app.html");
            window.location.href = 'app.html';
        }

    } catch (error) {
        console.error("Virhe roolien tarkistuksessa:", error);
        errorMessage.textContent = "Virhe roolien haussa. Yritä uudelleen.";
    }
}