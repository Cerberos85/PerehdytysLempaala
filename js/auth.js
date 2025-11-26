// js/auth.js

// Alustetaan Firebase
const auth = firebase.auth();
const db = firebase.firestore();

const loginButton = document.getElementById('loginButton');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('error-message');

loginButton.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;

    errorMessage.textContent = "";
    errorMessage.style.color = "red";

    // 1. Aloitetaan kirjautuminen
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            console.log("1. Kirjautuminen onnistui käyttäjällä:", userCredential.user.email);
            
            // 2. Kutsutaan ohjausfunktiota
            // TÄRKEÄÄ: Tämän jälkeen EI SAA olla window.location.href -kutsua!
            checkUserRoleAndRedirect(userCredential.user);
        })
        .catch((error) => {
            console.error("Kirjautumisvirhe:", error);
            errorMessage.textContent = "Virhe: " + error.message;
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