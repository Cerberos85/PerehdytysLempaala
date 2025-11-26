// js/auth.js

// Alustetaan Firebase Auth ja Firestore
const auth = firebase.auth();
const db = firebase.firestore();

// Haetaan HTML-elementit, joita tarvitsemme
const loginButton = document.getElementById('loginButton');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('error-message');

// Lisätään "kuuntelija" napille. Tämä koodi suoritetaan, kun nappia klikataan.
loginButton.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;

    // Tyhjennetään vanha virheviesti
    errorMessage.textContent = "";

    // Yritetään kirjautua sisään Firebasen avulla
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // KIRJAUTUMINEN ONNISTUI

            // Tulostetaan konsoliin (hyvä virheenjäljitykseen F12-työkaluissa)
            console.log("Kirjautuminen onnistui:", userCredential.user.email);

            // Tässä kohtaa tarkistetaan, onko käyttäjä esimies vai työntekijä
            // ja ohjataan oikealle sivulle.
            // Teemme tämän toiminnon myöhemmin (vaiheissa 5 ja 6).
            // Nyt ohjataan kaikki vain app.html-sivulle.

            checkUserRoleAndRedirect(userCredential.user);
            window.location.href = 'app.html'; // Voit poistaa tämän kommentin testataksesi ohjausta

        })
        .catch((error) => {
            // KIRJAUTUMINEN EPÄONNISTUI
            console.error("Kirjautumisvirhe:", error.message);

            // Annetaan käyttäjälle ystävällinen virheilmoitus
            errorMessage.textContent = "Virheellinen sähköposti tai salasana.";
        });
});

async function checkUserRoleAndRedirect(user) {
    // true-parametri pakottaa hakemaan tuoreimmat tiedot palvelimelta
    const idTokenResult = await user.getIdTokenResult(true);
    
    console.log("Tarkistetaan roolit:", idTokenResult.claims); // Debuggausta varten

    // TARKISTUS: Onko käyttäjä manager?
    if (idTokenResult.claims.manager === true) {
        console.log("Käyttäjä on esimies -> manager.html");
        window.location.href = 'manager.html';
    } else {
        console.log("Käyttäjä on työntekijä -> app.html");
        window.location.href = 'app.html';
    }
}