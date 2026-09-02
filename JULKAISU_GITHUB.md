# Sovelluksen julkaisu GitHub Pagesiin

Tätä tarvitaan, jotta mikrofoni (puheentunnistus) toimii: se vaatii oman https-osoitteen, jossa sivu ei ole upotettuna kehykseen.

## 1. Luo repo GitHubissa

github.com → New repository → nimeksi esim. `sanaseikkailu` → Public → **älä** rastita "Add a README" (se on jo tässä kansiossa) → Create repository.

Repo voi olla julkinen: koodissa ja sanastossa ei ole mitään henkilökohtaista, ja lapsen edistyminen tallentuu vain tabletin omaan selaimeen, ei koskaan GitHubiin.

## 2. Aja nämä komennot tässä kansiossa

Avaa Git Bash tai PowerShell kansiossa `G:\01 AI\05 Kieliohjelma` ja korvaa KAYTTAJANIMI omalla GitHub-tunnuksellasi:

    git config user.name "Oma nimi"
    git config user.email "sahkoposti@jota-kaytat-githubissa"
    git remote add origin https://github.com/KAYTTAJANIMI/sanaseikkailu.git
    git push -u origin main

(Kaksi ensimmäistä riviä asettavat oikean tekijätiedon jatkossa tehtäville committeille. Aiemmat commitit on tehty tilapäisellä sähköpostilla, mikä ei haittaa mitään.)

## 3. Kytke Pages päälle

Repo → Settings → Pages → Source: "Deploy from a branch" → Branch: `main`, kansio `/ (root)` → Save.

Muutaman minuutin kuluttua sovellus on osoitteessa:

    https://KAYTTAJANIMI.github.io/sanaseikkailu/

Avaa tämä osoite tabletilla ja lisää se aloitusnäytölle. Mikrofonin pitäisi toimia siellä normaalisti — Chrome kysyy luvan ensimmäisellä kerralla.

## 4. Jatkossa

Kun koodi muuttuu, muutokset menevät julki komennolla `git push`. Osoite pysyy samana, joten aloitusnäytön kuvaketta ei tarvitse vaihtaa.
