# Sanastoehdotukset POPS:n pohjalta (tarkistettavaksi)

Lähde: Perusopetuksen opetussuunnitelman perusteet 2014, Englanti A-oppimäärä, vuosiluokat 3–6.
https://peda.net/opetussuunnitelma/ops2016/opetussuunnitelmat/jspo/l1ov3/ov3/vieraat-kielet/vkeav3/pop

## Huomio POPS:n luonteesta

POPS ei anna valmista sanalistaa — se on taitotasoperustainen (mitä oppilaan pitää osata tehdä kielellä), ei sanastoperustainen. Se kuitenkin nimeää keskeiset aihepiirit, joita opetuksen tulee käsitellä vuosiluokilla 3–6:

> "minä itse, perheeni, ystäväni, koulu, harrastukset ja vapaa-ajan vietto sekä elämä ja toiminta englanninkielisessä ympäristössä"

sekä yleisemmin oppilaan jokapäiväinen elämänpiiri ja kiinnostuksen kohteet (näkökulmat "minä, me ja maailma").

## Vertailu nykyiseen sanastoon (en_4lk_v1.json)

Nykyinen v1-sanasto (143 sanaa) kattaa jo hyvin: koulu ja kouluaineet, luonteenpiirteet, vastakohdat, toiminta-/puheverbit, paikat, ruoka ja hedelmät, kohteliaisuusfraasit, kellonajat, sekä pelisanaston (Minecraft/Fortnite).

POPS:n aihepiireistä nykyisestä sanastosta **puuttuu tai on vain vähän edustettuna**:

- **Perhe** ("perheeni") — ei ole yhtään perheenjäsensanaa.
- **Minä itse** — perustiedot itsestä (nimi, ikä, tunteet) puuttuvat lähes kokonaan.
- **Harrastukset ja vapaa-ajan vietto** — muutama toimintaverbi on (uida, tanssia), mutta ei harrastuksia substantiiveina.
- **Tunteet** — ei tunnesanoja (iloinen, surullinen, väsynyt, nälkäinen...).
- **Perustervehdykset ja fraasit** ("elämä englanninkielisessä ympäristössä") — ei tervehdyksiä tai esittäytymisfraaseja.
- **Värit ja numerot** — nämä ovat vakio-osa alkuopetuksen/4. luokan sanastoa, eivät olleet oppikirjan skannatuilla sivuilla mutta ovat todennäköisesti oppilaalle jo osin tuttuja; silti hyvä sisällyttää kattavuuden vuoksi.

## Ehdotetut lisäykset (uusi kategoria + sanat)

Nämä ovat ehdotuksia samaan JSON-muotoon (`en`, `fi`, `category`) lisättäväksi `en_4lk_v1.json`-tiedostoon manuaalisen tarkistuksen jälkeen. En ole lisännyt niitä suoraan päätiedostoon.

### family (perhe)
- mother – äiti
- father – isä
- sister – sisko
- brother – veli
- grandma – mummi/isoäiti
- grandpa – pappa/isoisä
- family – perhe
- cousin – serkku
- baby – vauva
- pet – lemmikki

### myself (minä itse)
- name – nimi
- age – ikä
- I am ... years old – olen ... vuotta vanha
- happy – iloinen
- sad – surullinen
- tired – väsynyt
- hungry – nälkäinen
- scared – peloissaan
- excited – innoissaan

### hobbies (harrastukset ja vapaa-aika)
- football – jalkapallo
- reading – lukeminen
- drawing – piirtäminen
- gaming – pelaaminen
- riding a bike – pyöräily
- gymnastics – voimistelu
- singing – laulaminen
- collecting – keräily

### greetings_phrases (tervehdykset ja arki-ilmaukset)
- hello – hei
- goodbye – näkemiin
- good morning – huomenta
- how are you? – mitä kuuluu?
- my name is ... – nimeni on ...
- see you later – nähdään myöhemmin
- welcome – tervetuloa

### colours (värit)
- red – punainen
- blue – sininen
- green – vihreä
- yellow – keltainen
- black – musta
- white – valkoinen
- pink – pinkki
- orange (colour) – oranssi

### numbers (numerot 1–10)
- one – yksi
- two – kaksi
- three – kolme
- four – neljä
- five – viisi
- six – kuusi
- seven – seitsemän
- eight – kahdeksan
- nine – yhdeksän
- ten – kymmenen

## Ehdotus

Näistä voisi koota `en_4lk_v1.json`:n rinnalle version 2 (`en_4lk_v2.json`), jos hyväksyt lisäykset sellaisenaan tai muokattuna. Odotan sinun tarkistustasi ennen kuin viemme mitään näistä varsinaiseen sanastotiedostoon.
