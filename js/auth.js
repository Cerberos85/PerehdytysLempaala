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

    errorMessage.textContent = "";

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // KIRJAUTUMINEN ONNISTUI
            console.log("Kirjautuminen onnistui:", userCredential.user.email);

            // --- TÄSSÄ OLI VIKA ---
            
            // Kutsu tätä funktiota. Se hoitaa ohjauksen (joko manager.html tai app.html).
            checkUserRoleAndRedirect(userCredential.user);

            // POISTA TÄMÄ RIVI!
            // window.location.href = 'app.html'; <--- TÄMÄ PAKOTTI KAIKKI TYÖNTEKIJÄSIVULLE
        })
        .catch((error) => {
            console.error("Kirjautumisvirhe:", error);
            errorMessage.textContent = "Virhe: " + error.message;
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