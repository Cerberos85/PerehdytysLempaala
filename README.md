📖 Perehdytyssovellus (Lempäälän Seurakunta)
Moderni, roolipohjainen selainsovellus seurakunnan työntekijöiden ja esimiesten perehdytysprosessin seurantaan ja hallintaan. Sovellus on suunniteltu erityisesti hautaustoimen, suntioiden, toimiston sekä lapsi- ja perhetyön tarpeisiin.

🚀 Ominaisuudet
Työntekijälle (App)
Selainpohjainen perehdytyskortti: Roolipohjainen näkymä, jossa työntekijä näkee vain omat tehtävänsä (esim. Kausityö tai Suntio).

Automaattinen tallennus: Ruksit tallentuvat välittömästi tietokantaan aikaleiman kera (esim. 15.2.2026 14.30).

Luotettava kirjausketju (Audit Trail): Jos suoritettu tehtävä halutaan peruuttaa (ottaa rasti pois), järjestelmä vaatii aina kirjallisen syyn, joka näkyy myös esimiehelle.

Jaetut dokumentit: Pääsy esimiehen jakamiin materiaaleihin ja ohjeisiin.

Esimiehelle (Manager)
Kattava raporttinäkymä: Taulukko alaisista ja heidän perehdytyksensä edistymisestä (%). Esimies näkee automaattisesti oikeat alaosastot (esim. Hautaustoimen esimies näkee Hautaustoimen ja Kausityöntekijät).

Yksityiskohtainen tarkastelu (Modal): Mahdollisuus tarkastella yksittäisen työntekijän kaikkia rastitettuja tehtäviä, aikaleimoja ja mahdollisia peruutussyitä.

Työsuhteen päättäminen ja palautus: Päättyneet työsuhteet voidaan arkistoida. Esimies voi tarkastella arkistoituja (max 2v vanhoja) työsuhteita ja palauttaa niitä voimaan (esim. palaavat kausityöntekijät).

Tiedostojen hallinta: Esimies voi ladata perehdytysmateriaaleja (PDF tms.) suoraan järjestelmään työntekijöiden nähtäville.

Tietoturva ja Automatiikka (GDPR)
Firestore TTL (Time-To-Live): Päättyneiden työsuhteiden tiedot tuhoutuvat automaattisesti ja pysyvästi tietokannasta tarkalleen 2 vuoden kuluttua (GDPR-vaatimusten mukaisesti).

Custom Claims (RBAC): Roolit ja oikeudet on lukittu Firebase Auth -palvelimen päässä, eikä niitä voi kiertää selaimen kautta.

Pakotettu salasananvaihto: Kun uusi työntekijä luodaan, ohjelma pakottaa hänet vaihtamaan väliaikaisen salasanansa ensimmäisellä kirjautumiskerralla.

🛠 Teknologiapino
Frontend: Puhdas HTML5, CSS3 (Flexbox, responsiivinen mobiiliin), Vanilla JavaScript (ES6+). Ei raskaita viitekehyksiä.

Backend (BaaS): Google Firebase (v9 Compat).

Authentication: Käyttäjien tunnistautuminen ja Custom Claims.

Firestore: NoSQL-tietokanta reaaliaikaisilla turvasäännöillä.

Storage: Tiedostojen (PDF, Word) tallennus ja jakelu.

Hallintatyökalut (Admin): Node.js ja Firebase Admin SDK (hallintaskriptit terminaalin kautta).

📁 Projektin rakenne
Plaintext
PerehdytysLempaala/
│
├── index.html                # Sisäänkirjautumisnäkymä
├── app.html                  # Työntekijän päänäkymä (Välilehdet ja tehtävät)
├── manager.html              # Esimiehen ja hallinnan raporttinäkymä
├── change-password.html      # Pakotettu salasananvaihto uusille käyttäjille
├── employee-report.html      # Työntekijän tulostettava yksilöraportti
│
├── css/
│   └── style.css             # Keskitetty tyylitiedosto (Kortit, taulukot, modaalit)
│
├── js/
│   ├── auth.js               # Sisäänkirjautumisen ja reitityksen logiikka
│   ├── app-logic.js          # Työntekijän näkymän logiikka (Autosave)
│   ├── manager-logic.js      # Esimiehen näkymän logiikka (Raportit, lataukset)
│   ├── password-logic.js     # Salasanan vaihtamisen logiikka
│   └── firebase-config.js    # Firebasen julkiset API-avaimet
│
├── admin/                    # (Node.js taustaskriptit)
│   ├── manageRoles.js        # Uusien työntekijöiden luominen
│   ├── setManagerRole.js     # Esimiesoikeuksien asettaminen
│   └── setUserRole.js        # Olemassa olevan käyttäjän roolin muuttaminen
│
└── firestore.rules           # Tietokannan tietoturvasäännöt
⚙️ Asennus ja käyttöönotto (Kehittäjille)
1. Julkisen ympäristön asennus (Frontend)
Kloonaa repositorio: git clone https://github.com/Cerberos85/PerehdytysLempaala.git

Määritä oman Firebase-projektisi asetukset tiedostoon js/firebase-config.js.

Säännöt tietokannalle löytyvät firestore.rules -tiedostosta. Vie ne Firebaseen komennolla: firebase deploy --only firestore:rules.

2. Admin-työkalujen asennus (Node.js)
Jotta voit luoda uusia työntekijöitä ja määrittää heille rooleja terminaalista, tarvitset Node.js-ympäristön.

Asenna riippuvuudet projektin juuressa:

Bash
npm install firebase-admin
Hae Firebase-konsolista salainen avain (Project settings -> Service accounts -> Generate new private key).

Nimeä ladattu JSON-tiedosto nimellä serviceAccountKey.json ja siirrä se projektin juureen (tai admin-kansioon).

TÄRKEÄÄ: Varmista, että projektissa on .gitignore -tiedosto, joka sisältää rivin serviceAccountKey.json. Tätä tiedostoa ei saa KOSKAAN puskea GitHubiin.

3. Käyttäjien hallinta skripteillä
Uuden työntekijän lisääminen tapahtuu muokkaamalla manageRoles.js -tiedoston newUsers -listaa ja ajamalla skripti terminaalissa:

Bash
node manageRoles.js
Tämä skripti luo käyttäjän, lukitsee hänen roolinsa Auth Claims -tasolla, pakottaa salasananvaihdon ja luo Firestoreen "haamudokumentin", jotta esimies näkee työntekijän välittömästi listallaan.

🔒 Tietoturva
Tietojen lukeminen: Vain esimiehet (manager) voivat listata kokoelman userProgress. Työntekijä voi lukea vain oman dokumenttinsa.

Tietojen päivittäminen: Työntekijä ei voi vahingossa tai tahallaan muuttaa omaa osastoaan (department), sähköpostiaan tai työsuhteensa tilaa. Esimies puolestaan saa päivittää vain työsuhteen voimassaoloon liittyviä kenttiä.

Versionhallinta: Repositoriossa ei pidetä salaista Firebase Admin -avainta.

Kehitetty Lempäälän seurakunnan tarpeisiin (2026).
