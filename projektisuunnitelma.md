---
title: Projektisuunnitelma – Kieliopiskelusovellus
description: Sanaseikkailu - alun perin 10-vuotiaan tablettisovellus, tavoitteena täysiverinen itseopiskeluohjelma englannin, ruotsin ja saksan opiskeluun. Pilotti, vaiheet, tiekartta ja mallisuositukset.
---

# Kieliopiskelusovellus – projektisuunnitelma

## Tavoite

Tablettisovellus, jolla 10-vuotias voi harjoitella englannin ja saksan sanastoa. Sovellus suunnitellaan alusta asti niin, että se kantaa yli tulevien kieliopintojen (uudet kielet, kasvava vaikeustaso, useampi vuosi), vaikka pilotissa aloitettiin suppealla 4. luokan englannin sanastolla. Saksa on lisätty samaan sovellukseen samalla sanastopohjalla, ja oppiminen etenee nyt kolmivaiheisen syöttöpolun (piirrä → kirjoita → puhu) sekä pass/graduate-portaiden, per-menetelmä-palkintoasteikkojen ja rajatun aktiivisen sanaryhmän kautta (ks. alla). Syöttötavan valinta on aina lapsen omissa käsissä — sovellus ei enää koskaan vaihda tilaa automaattisesti. Lapsi voi myös tarkistaa tuntemattoman sanan merkityksen "Näytä sana" -napilla ilman että joutuu arvaamaan sokkona (vaihe 15). Yläpalkin edistymismittarit on tietoisesti pidetty minimaalisina — pelkkä liekkilaskuri poistettiin ja tähtibadge kertoo edistymisen vain symboleina, ei tekstinä — jotta lapsen huomio pysyy itse sanan harjoittelussa (vaihe 16). Vaiheessa 17 sanasto laajennettiin kattamaan koko alakoulu (luokat 1–6): oppilas etenee lähtökohtaisesti oman luokka-asteensa sanastossa, ja sekä palkintomittari että sanaston valikko seuraavat mukana luokka-asteen vaihtuessa. Vaiheessa 18 tähtibadgesta tehtiin klikattava (avaa koko 6-tasoisen palkintoasteikon kerralla) ja senhetkisen tason maskotti näkyy nyt isona, himmeänä taustakuvana sana- ja kirjoituslaatikossa. **Vaiheessa 19 sovellukseen lisättiin kokonaan uusi harjoitusmuoto sanojen rinnalle: virkkeiden harjoittelu** (neljä harjoitustyyppiä, luokka-asteittain etenevä vaikeustaso, oma sanat/virkkeet-valitsin) — ensimmäinen askel kohti täysien lauseiden tuottamista pelkän sanaston sijaan. **Vaihe 20 oli laatu- ja sisältövaihe ilman uusia näkymiä:** automaattinen testisarja (84 testiä) ja datan eheystarkistus repoon, virkkeet 60 → 120, armollisempi virkkeiden tarkistus (lyhennemuodot, US/GB-kirjoitusasu, vaihtoehtoiset muodot ja sanajärjestykset) ja aktiivisen sanaryhmän täydennyksen korjaus kaikkien luokka-asteiden yli. **Vaiheessa 21 saksan opiskelu siirrettiin alkamaan 4. luokalta** (kuten suomalaisissa kouluissa), numerot laajennettiin 0–20:een (lapsella tulossa saksan koe väreistä ja numeroista 0–20) ja monitulkintaiset sanat tarkennettiin kehotteessa.

## Visio (päätetty vaiheessa 37): täysiverinen itseopiskeluohjelma

Pitkän tähtäimen tavoite: Sanaseikkailusta kehitetään **täysiverinen kieltenopiskeluohjelma, jolla kuka tahansa voi opiskella kieltä itsenäisesti** ilman opettajaa tai oppikirjaa. Kielet rajataan toistaiseksi **englantiin, ruotsiin ja saksaan**; lähtökieli on toistaiseksi suomi. Oma lapsi ja hänen koulukirjansa ovat edelleen pilotti ja testiryhmä, mutta suunnittelu tehdään yleiskäyttöiseksi. Arkkitehtuuri pysyy kevyenä (ei palvelinta, ei tilejä, tiedot laitteella + vienti/tuonti) niin kauan kuin se riittää; päätös tarkistetaan, jos tarvitaan laitteiden välistä synkronointia.

### Mitä "täysiverinen" tarkoittaa

1. **Tasot koululuokkien tilalle.** Nykyiset luokka-asteet (1–9) korvataan tai niiden rinnalle tulee CEFR-pohjainen tasorakenne A1 → A2 → B1 (aluksi). Koulutila (luokka-asteet, Koe-teemat) säilyy omana "koulun kanssa" -tilanaan.
2. **Oma, oppikirjasta riippumaton sisältö.** Nykyinen sanasto on osin johdettu suomalaisista oppikirjoista (4. lk:n kirjasanasto, Koe-teemat). Itseopiskeluohjelma tarvitsee oman, lisenssiltään selvän sanasto- ja virkeaineiston (taajuuspohjainen ydinsanasto per kieli ja taso). Kirjasta johdettua sisältöä ei jaeta laajemmalle ilman oikeuksien selvittämistä.
3. **Aloitus ja tasonmääritys.** Ensikäynnin onboarding: kielen valinta, lähtötason kartoitus (lyhyt testi), päivittäinen tavoite. Ei pakollista luokka-asteen valintaa.
4. **Monipuoliset harjoitustyypit.** Nykyisten (piirrä/kirjoita/puhu, virkkeet, kielioppi) lisäksi: monivalinta, yhdistely, sanelu/kuullun ymmärtäminen, täydennys, lukukappaleet kysymyksineen, pienet dialogit.
5. **Kielioppi kaikille kielille.** Saksan artikkelit/monikot ovat valmiina; lisättävä: ruotsin en/ett ja taivutus, englannin aikamuodot, saksan verbitaivutus ja sijat, lyhyet selitykset suomeksi (myöhemmin muilla lähtökielillä).
6. **Kertausjärjestelmä.** Nykyinen painotus + harvakseltaan-kertaus korvataan tai täydennetään oikealla välitetyllä toistolla (spaced repetition) ja päivittäisellä kertausjonolla.
7. **Motivaatio aikuiselle.** Palkinnot sopivat lapselle; aikuinen oppija tarvitsee hillitymmän tyylin (teema/valinta), putkilaskurin ja viikkotavoitteen. Sama sisältö, vaihdettava ulkoasu.
8. **Tallennus ja siirrettävyys.** Vienti/tuonti jää; lisätään automaattinen varmuuskopiomuistutus ja tarvittaessa valinnainen synkronointi (vasta kun tarve on osoitettu).
9. **Laatu.** Kaikki sisältö kulkee putken: Opus luonnostelee → Fable tarkistaa (vain käyttäjän komennolla) → Sonnet integroi ja testaa; datan eheystarkistus (`check_data.py`) ja automaattitestit varmistavat jokaisen version.
10. **Saavutettavuus ja käyttöliittymä.** Toimii puhelimella, tabletilla ja tietokoneella; näppäimistö ja kosketus; isot kirjasimet, kontrasti, lukihäiriöystävällinen kirjasinvaihtoehto.
11. **Oikeudet ja lisenssit.** Selvitettävä ennen julkaisua: sanaston/virkkeiden alkuperä, äänilähteet (nykyinen selaimen puhesynteesi riittää alkuun), tietosuoja (tiedot vain laitteella).

### Kaksi tilaa: koulutila ja itseopiskelutila (päätetty vaiheessa 38)

Ohjelma jaetaan kahteen tilaan, jotka käyttävät samaa harjoitusmoottoria (piirrä/kirjoita/puhu, virkkeet, kielioppi, edistymisen tallennus) ja samaa käsitevarastoa, mutta eri rakennetta:

- Käyttöliittymässä tilat ovat **🏫 Peruskoulu** ja **🎓 Itseopiskelu** (vaihe 39).
- **Koulutila (lapset ja nuoret):** nykyinen malli ennallaan: luokka-asteet 1–9, kielten aloitusluokat (en 1., de/sv 4.), koeteemat, Viikon sanat, maskotit ja palkinnot.
- **Itseopiskelutila (aikuiset):** CEFR-tasot A1 → A2 → B1 ja aikuisen arkeen sidotut aihepiirit, hillitty ulkoasu, tasonmääritys, selitetty kielioppi.

Miksi aikuiselle ei kannata koulurakennetta sellaisenaan:
1. **Aihepiirien järjestys seuraa lapsen elämää:** värit, lelut, eläimet, koulutarvikkeet, pelisanasto ja sadut tulevat ensin; aikuinen tarvitsee heti asumisen, työn, terveyden, asioinnin ja matkustamisen sanastoa.
2. **Tahti on koulun:** koulussa A1-taso venyy usealle vuodelle (pari tuntia viikossa); aikuinen voi edetä samaan tasoon muutamassa kuukaudessa, ja luokka-asteet vain hidastavat ja hämärtävät tavoitetta.
3. **Luokka-aste ei kerro aikuiselle mitään** ("ruotsin 4. luokka"), kun taas CEFR-tasot ovat vertailukelpoisia kurssien, YKI-testin ja työnantajien kanssa.
4. **Sisältö on osin oppikirjasidonnaista** (4. lk:n kirjasanasto, Koe-teemat), mikä palvelee vain kyseisen kirjan käyttäjää.
5. **Aikuinen hyötyy eksplisiittisestä kieliopista** heti alussa, lapsi oppii enemmän toistolla ja leikillä; myös palkinnot ja maskotit ovat lapselle suunniteltuja.

Päällekkäisyys on silti suuri (perussanasto, numerot, ruoka, perhe), joten käsitteet ovat yhteisiä ja vain niiden ryhmittely ja tahti eroavat (`data/school.json` vs. `data/self.json`).

### Itseopiskelun työkalut: kehitysjono (vaihe 39)

Ruotsin itseopiskelusanasto (A1–B1, 3119 käsitettä) on pohja; nämä työkalut rakennetaan sen päälle tässä järjestyksessä. Malli: sisältö Opus (tarkistus Fable käyttäjän komennosta), koodi Sonnet.

1. **Tasonmääritys** — lyhyt testi (sanat tasoittain A1 → B1, mukautuva), joka asettaa lähtötason ja merkitsee osaamansa sanat opituiksi. Koodi; data valmiina.
2. **Välitetty toisto ja päivätavoite** — kertausjono (spaced repetition) ja päivän tavoite (esim. 20 sanaa / 10 min), putkilaskuri aikuisen tyyliin.
3. **Monivalinta ja yhdistely** — nopea tunnistusharjoitus aloittelijalle ennen kirjoittamista (4 vaihtoehtoa; parien yhdistely). Hyödyttää myös peruskoulua.
4. **Taivutusharjoitus (ruotsi)** — en/ett, määräinen muoto, monikko, verbin preesens/preteriti/supiini, adjektiivin taivutus. Data on jo sanastossa (`def`, `pl`, `pres`, `pret`, `sup`, `neut`, `apl`).
5. **Kuuntelu ja sanelu** — kuule ruotsiksi (sv-SE puhesynteesi) ja kirjoita / valitse merkitys.
6. **Virkkeet ja dialogit aihepiireittäin** — itseopiskelun omat virkkeet (Opus), käyttävät nykyisiä virkeharjoituksia (kirjoita, täydennä, järjestä, kuuntele).
7. **Kielioppiselitykset** — lyhyet suomenkieliset selitykset (V2-sanajärjestys, sivulauseen adverbi, en/ett, taivutusluokat), linkitetty harjoituksiin.
8. **Lukutekstit** — lyhyet tasotekstit kysymyksineen, sanat linkitetty sanastoon.
9. **Sanakortti / sanakirjanäkymä** — sanan taivutus, esimerkkilause, ääntäminen, aihepiiri; haku suomeksi ja ruotsiksi.
10. **Edistymisen seuranta ja varmuuskopiomuistutus** — tasojen ja aihepiirien valmius, viikkonäkymä, muistutus varmuuskopiosta.

Sisällön laatu: Fable-tarkistus 3119 sanalle (käyttäjän komennosta), Opuksen epävarmat kohdat (`svself/`-raportit) läpi samalla. Englannin ja saksan itseopiskelu: lisätään `forms/en.json` / `de.json` samoille käsitteille, kun ruotsin malli on koeteltu.

### Tiekartta (ehdotettu järjestys)

- **A. Pohja (valmis/käynnissä):** kolme kieltä, sanat + virkkeet, kielioppi (de), aikuisen raportti, testit. Ruotsi lisätty (vaihe 37).
- **B. Tasorakenne:** ✅ tietomalli v2 (vaihe 38), tilanvalinta ja ruotsin A1–B1-sanasto (vaihe 39). Seuraavaksi: työkalujen kehitysjono yllä; aiemmin suunniteltu: tilanvalinta käyttöliittymään, A1-ydinsanaston karsinta ja täydennys aikuiselle (nyt A1-luonnoksessa 1029 käsitettä englanniksi, joista 333 saksaksi/ruotsiksi; tavoite ~600, kaikilla kolmella kielellä), tasonmääritys.
- **C. Uudet harjoitustyypit:** monivalinta, yhdistely, sanelu, lukukappaleet. Nämä hyödyttävät myös koulutilaa.
- **D. Ruotsin ja englannin kielioppi:** en/ett, englannin aikamuodot, saksan verbit/sijat.
- **E. Kertausjärjestelmä (spaced repetition) ja päivätavoite.**
- **F. Onboarding, aikuisen tyyli, saavutettavuus.**
- **G. Muut lähtökielet** (esim. englanti → ruotsi), vasta kun suomi-pohja on vakaa.

Päätökset ennen B-vaihetta (kysytään käyttäjältä, kun siihen tullaan): sisältölähde ja lisenssi, kohdeyleisö (aikuiset vs. nuoret), halutaanko mukaan tilit/synkronointi.

## Tietomalli v2 (vaihe 38)

Sanasto ja virkkeet ovat kansiossa `data/` (ei enää yhdessä `en_1_9lk_vNN.json`-tiedostossa eikä virkkeitä `index_template.html`:ssä):

- `data/meta.json`: versio (v18), kielet, muutosloki (vanha historia `legacy_meta`-kentässä).
- `data/concepts.json`: kielestä riippumattomat käsitteet (`id`, `fi` = suomen kehote, `cat` = koulutilan teema, `also` = lisäteemat). Käsitteen id on vanha sanan id, joten laitteelle tallennettu edistyminen säilyy.
- `data/forms/en.json`, `de.json`, `sv.json`: kielikohtaiset muodot (`text` = hyväksytyt vastaukset " / " eroteltuna, `pl` = monikko, `fi` = kielikohtainen kehote, kun yhteinen kehote ei sovi, esim. spring = "kevät / jousi" → ruotsiksi ja saksaksi pelkkä "kevät"). Kieli ei enää riipu englannista: käsitteellä voi olla pelkkä saksan tai ruotsin muoto.
- `data/school.json`: koulutila (luokka-asteet, aloitusluokat, 93 teemaa).
- `data/self.json`: itseopiskelutila, LUONNOS: tasot A1/A2/B1 ja 29 aihepiiriä, jotka kokoavat käsitteet koulun teemoista (`from_categories`, `add`, `exclude`); lapsi-/koulusidonnaiset teemat on rajattu pois (`not_in_self`).
- `data/sentences/<kieli>.json`: virkkeet (`text`, `fi`, `alt`, `grade`, `theme`; myöhemmin `level`).

Työkalut: `tools/datamodel.py` (lataus, `validate()`, `to_legacy()` = sovelluksen nykyinen muoto, `self_topic_concepts()`), `tools/migrate_v17_to_v2.py` (kertaluonteinen siirto, tulos tarkistettu identtiseksi v17:n kanssa), `tools/apply_sv_fable_v38.py`. `build.py` lukee mallin, validoi sen ja upottaa sanaston ja virkkeet sovellukseen. Tiedostot on kirjoitettu yksi alkio per rivi, jotta git-diffit pysyvät luettavina ja sisältötyön (Opus/Fable) voi tehdä kieli kerrallaan.

## Arkkitehtuurilinjaus: kevytohjelma, ei "oikea" sovellus

Käyttäjä vertasi tätä projektiin "01 Kuntosaliäppi" (Rautakirja): offline HTML/PWA, tallennus laitteen omaan selaimeen, varmuuskopiot manuaalisesti tiedostoon (Rautakirjassa OneDriveen). Koska Sanaseikkailuakaan ei ole tarkoitus kaupallistaa, sama kevyt arkkitehtuuri sopii tähänkin — ei siis palvelinta, tietokantaa, käyttäjätilejä eikä kääntämistä natiiviksi Android-sovellukseksi. Perustelut:
- Käyttäjäkunta on pieni (oma lapsi, ehkä myöhemmin muutama muu), ei tarvetta usean käyttäjän hallinnalle tai palvelinpuolen skaalautuvuudelle.
- Selainpohjainen yksitiedostoinen HTML toimii jo nyt "Lisää aloitusnäyttöön" -tyylisesti kuin asennettu sovellus, ilman sovelluskaupan julkaisuprosessia.
- Ylläpito pysyy yksinkertaisena: yksi `index.html`, ei build-vaihetta ajossa (paikallinen `build.py`-skripti kokoaa tiedoston kehityksen aikana lähdemallipohjasta `index_template.html`), ei riippuvuuksia. Molemmat ovat nyt myös gitissä, joten koko koodi on versionhallinnassa eikä vain Clauden istunnon väliaikaisessa työtilassa.
- Jos tarve kasvaa myöhemmin (esim. usean lapsen erilliset tilit, opettajan seurantanäkymä, laitteiden välinen synkronointi), siihen voi siirtyä asteittain ilman että nykyinen pohja pitää heittää pois — geneerinen tietorakenne (myös uuden kielen, palkintotasojen, teemaryhmittelyn, luokka-asteiden ja nyt virkeharjoittelun lisäys osoitti tämän) on suunniteltu kestämään tämän. **Vaihe 19 on tästä hyvä esimerkki:** virkkeiden edistyminen tallentuu samaan geneeriseen `word_stats`-tauluun kuin sanojen edistyminen, pelkästään eri statId-etuliitteellä ("sentence|..." vs. "kieli|taso|..."), eikä vaatinut mitään tietokantamuutosta.

**Ainoa lisätty kevyt osa on manuaalinen varmuuskopiointi** (ks. alla), joka tuo saman turvan kuin Rautakirjan OneDrive-varmuuskopiot, ilman että koko sovellusta tarvitsee muuttaa "oikeaksi" backend-sovellukseksi.

## Päätökset

- **Alusta:** selainpohjainen web-sovellus, kevyt PWA-tyylinen kokonaisuus (kuten Rautakirja). Testilaite: Android-tabletti (Chrome).
- **Julkaisu:** GitHub Pages, repo `github.com/teresammallahti/sanaseikkailu`. Mikrofoni toimii siellä — artifact-linkissä ei (upotettu kehys estää).
- **Oppimiskehityksen tallennus:** IndexedDB, geneerinen avain `kohdekieli|taso|sanan id` sanoille ja `sentence|kohdekieli|virkkeen id` virkkeille (sama taulu, ks. alla) — kohdekieli mukana avaimessa, joten englannin ja saksan edistymiset pysyvät automaattisesti täysin erillään. Täydennetty manuaalisella JSON-varmuuskopioinnilla (vie/tuo, kattaa myös virkkeiden edistymisen, koska vienti/tuonti käsittelee koko taulun geneerisesti). Edistyminen tallentuu sanakohtaisesti riippumatta sanaston sisällöstä milloinkaan, joten se säilyy myös sanaston päivittyessä (ks. palkintotasot alla) — myös luokka-asteiden käyttöönotto (vaihe 17) ei vaikuttanut yhteenkään olemassa olevaan sanan id:hen.
- **Projektikansio:** `G:\01 AI\05 Kieliohjelma`, git-repo haarassa `main`, yhdistetty GitHubiin. Sisältää nyt sekä koostetun `index.html`:n että lähteet (`index_template.html`, `build.py`, `en_1_6lk_v7.json`) ja testit (`tests/`). **Vaiheessa 20 `build.py` korjattiin käyttämään repon suhteellisia polkuja ja v7-sanastoa** (aiemmin se osoitti Clauden väliaikaisiin `/tmp`-polkuihin ja vanhaan v2-sanastoon, joten repon kopiosta ei voinut koota nykyistä sovellusta) — nyt `python3 build.py` repokansiossa tuottaa tavu tavulta saman `index.html`:n. Vanha `en_4lk_v2.json` on jätetty repoon historian vuoksi, vaikka `build.py` ei enää lue sitä.
- **Kynäsyöttö:** ratkaistu Gboardin käsialanäppäimistöllä (ei koodimuutosta) — Chromen `HandwritingRecognizer`-rajapinta ei ollut käytettävissä testilaitteella, kuten oletettiinkin harvinaiseksi. Sovellus näyttää tästä vihjeen kynätilassa. **Korjattu piilobugi (vaihe 10):** kielituen tarkistus oli aiemmin kovakoodattu englanniksi (`penLanguageSupported("en")`), vaikka kohdekielenä olisi saksa — korjattu käyttämään aina valittua kohdekieltä. **Vahvistettu uudelleen (vaihe 14 ja 15):** kynäkirjoituksen 2 sekunnin vakautusviive (ks. vaihe 11 alla) toimii yhä täsmälleen kuten suunniteltu — sovellus odottaa aina vähintään 2 sekuntia täyttä hiljaisuutta tekstikentässä ennen kuin vastaus hyväksytään, riippumatta siitä milloin lapsi painaa Tarkista-nappia. Koodia ei ole muutettu tältä osin.
- **Sanaston kirjakielisyys (v3):** puhekieliset ja lyhennetyt muodot korvattu kirjakielisillä perusmuodoilla, jotta lapsi oppii oikeat sanat lyhenteiden/slangin sijaan.
- **Automaattinen ääntäminen (vaihe 6):** kohdekielinen sana lausutaan automaattisesti ääneen heti kun se näytetään, ruksittavalla kytkimellä (päällä oletuksena, tila muistetaan laitteella). **Vaiheessa 19 sama periaate ulotettiin virkkeisiin:** virkkeen ääneen lausuminen tapahtuu automaattisesti VAIN "kuuntele ja toista" -harjoitustyypissä (vastaa sanaharjoittelun sääntöä, jossa vain kohdekieli→suomi-suunta lausutaan automaattisesti — ei koskaan sitä suuntaa/tyyppiä jota juuri testataan/tuotetaan).
- **Sanastolähteistä:** github.com/samimiettinen/suomen-kieli tarkistettu — se on suomen kielen oikeakielisyystaito (Kotus-normit), ei sanalistoja. Ei sovi sanaston kokoamiseen; sanasto kootaan edelleen POPS 2014 -aihepiirien ja oman harkinnan pohjalta, kuten aiemminkin. **Vaiheessa 17 tarkistettiin lisäksi (WebSearch), että POPS 2014 määrittää englannin A-oppimäärän sisällöt vain luokkaväleittäin (vl 1–2 ja vl 3–6), ei yksittäisille luokka-asteille erikseen** — luokka-asteiden 1–6 sanastojako on siksi Clauden oma pedagoginen jaottelu olemassa olevan sanaston ja uuden sisällön pohjalta, ei suoraan opetussuunnitelmasta poimittu. **Vaiheen 19 virkeaineiston vaikeuskaari nojaa samaan periaatteeseen:** koska POPS ei anna kielioppi-/virkerakennesyllabusta luokka-asteittain, virkkeiden vaikeustaso on kalibroitu CEFR-alatasoilla (luokat 1–2 ≈ pre-A1, 3–4 ≈ A1.1–A1.2, 5–6 ≈ A1.3–A2.1) mukaillen yleistä suomalaista oppikirjaetenemistä — tämä on Clauden oma pedagoginen tulkinta, ei suoraan opetussuunnitelmasta poimittu.
- **Saksan kielen lisäys (v5, vaihe 9):** suomi pysyy kiinteänä pohjakielenä, käyttäjä valitsee kohdekieleksi joko englannin tai saksan lippupainikkeilla ruudun ylälaidassa. Sama sanasto/kategoriat/id:t kuin englannissa — vain uusi `de`-kenttä lisätty jokaiseen sanaan. Substantiiveille lisätty der/die/das-artikkelit heti alusta lähtien: tarkistettu (WebSearch/WebFetch, mm. learngerman.io ja yourdailygerman.com), että muodollisessa/koulumaisessa opetuksessa suku opetellaan sanan mukana alusta asti. **Huom käyttäjälle:** saksankieliset käännökset koottiin suoraan sanasto-JSONiin ilman erillistä ehdotustiedostoa — kannattaa silmäillä sanasto-JSONin `de`-kentät läpi ja ilmoittaa, jos jokin käännös tai artikkelivalinta ei ole kohdallaan. Tämä koskee erityisesti vaiheen 17 uusia 138 sanaa (luokat 5–6), joita ei ole vielä silmäilty käyttäjän toimesta. **Vaiheessa 19 virkeharjoittelu rajattiin tietoisesti VAIN englantiin** käyttäjän omasta valinnasta ("vain englanti aluksi, suositus") — saksankieliset virkkeet (`SENTENCE_DATA.de`) lisätään vasta kun englanninkielinen versio on koeteltu käytössä.
- **Ulkoasun tiivistys (v5):** paddingit, marginaalit, fontit ja mic-/kynäpainikkeiden koot pienennetty läpi sovelluksen, jotta sisältöä ei jää piiloon Gboardin noustessa näkyviin.
- **Kolmivaiheinen oppimispolku ja osaamisehdon uudistus (vaihe 10):** vanha ⭐-osaamisehto (2x oikein molempiin suuntiin, riippumatta syöttötavasta) korvattiin kolmivaiheisella polulla: (1) **piirrä** kynällä — kohdekieli→FI- ja FI→kohdekieli-suuntaan erikseen; (2) **kirjoita** näppäimistöllä; (3) **puhu** mikillä. Väärä vastaus nollaa vain käytössä olleen vaiheen (ja piirrossa vain kysytyn suunnan) laskurin. **Vaiheessa 12 jokaiselle vaiheelle lisättiin kaksi kynnystä yhden sijaan** (ks. alla) — tämä kohta kuvaa nyt alkuperäisten kynnysarvojen roolin, joka vastaa uutta "Pass"-kynnystä.
- **Tilanvalinta on aina käsin, ei koskaan automaattinen (vaihe 10 → korvattu vaiheessa 14):** vaiheessa 10 sovellus valitsi syöttötavan oletuksena itse sen mukaan, missä vaiheessa sana oli ("pakotettu järjestys" -asetus, kytkettävissä pois). **Vaiheessa 14 tämä automatiikka poistettiin kokonaan** käytännön testauksessa havaitun ongelman vuoksi (ks. alla) — lapsi valitsee syöttötavan aina itse tilapainikkeista, ja sovellus pysyy siinä tilassa kunnes lapsi itse vaihtaa sitä. Jokaisen vaiheen edistyminen (streakit) tallentuu silti taustalla riippumatta siitä missä järjestyksessä tai kuinka pitkään lapsi harjoittelee mitäkin tilaa. **Tilapainikkeiden järjestys (vaihe 13):** kynä vasemmalla, näppäimistö keskellä, puhe oikealla — vastaa oppimispolun etenemisjärjestystä (piirrä → kirjoita → puhu), vaikka vaihto onkin nyt aina manuaalinen.
- **Palkintotasot, alun perin yhdistettynä (vaihe 10), eriytetty per menetelmä (vaihe 13), tekstitys yksinkertaistettu (vaihe 16), rajattu aktiiviseen luokka-asteeseen (vaihe 17), avattavissa kokonaisuudessaan (vaihe 18):** vanha ⭐-laskuri yläpalkissa korvattiin ensin vaiheessa 10 yhdellä yhdistetyllä tasojärjestelmällä: 6 päätasoa (Kärmes, Basiliski, Aarnikotka, Hydra, Traakki, Lohikäärme) x 5 tähteä = 30 yhtä suurta askelta. **Vaiheessa 13** asteikko jaettiin kolmeen täysin toisistaan riippumattomaan asteikkoon (piirto/näppäimistö/puhe), jotka täyttyvät sitä mukaa kun sanoja graduoituu kyseisessä vaiheessa. **Vaiheessa 16** badgen tekstitys yksinkertaistettiin pelkiksi ★/☆-symboleiksi ilman sanoitusta. **Vaiheessa 17 nimittäjä muutettiin koko kohdekielen sanastosta aktiivisen luokka-asteen sanastoon** (`wordsForGrade(activeGrade)`), koska käyttäjä halusi palkintomittarin koskevan aina vain sitä luokka-astetta, jota oppilas parhaillaan opiskelee — kun oppilas siirtyy esim. 4. luokalta 5. luokan sanoihin, kaikki kolme tähtiasteikkoa (piirto/näppäimistö/puhe) nollautuvat käytännössä uudelle, pienemmälle nimittäjälle ja alkavat täyttyä uudelleen 5. luokan sanaston mukaan. **Vaiheessa 18 tähtibadgesta tehtiin klikattava:** klikkaus avaa modaalin, joka listaa kaikki 6 tasoa kerralla (kunkin oma ikoni + tähtimäärä), korostaa parhaillaan käynnissä olevan tason ja merkitsee jo läpikäydyt tasot "✅"-merkillä — jotta lapsi/vanhempi näkee koko matkan, ei vain nykyistä pistettä siinä.
- **Piirtovaiheen suoja tavallista näppäilyä vastaan (vaihe 11):** kun Chromen `HandwritingRecognizer`-API ei ole käytettävissä (tyypillinen tilanne, ks. yllä) ja sovellus näyttää tekstikentän Gboardin käsialatilaa varten, kenttä havaitsee nopean, tasaisen kirjain-kerrallaan-näppäilyn (kolme yksittäistä merkkiä alle 900 ms välein) ja hylkää sen tyhjentämällä kentän ja pyytämällä käyttämään kynää. **Rajoitus:** sovellus ei pysty erottamaan tavallista näppäilyä Gboardin omasta sanelupainikkeesta, koska selaimella ei ole pääsyä siihen, mistä lähteestä teksti todella tuli. Näppäimistö ei myöskään enää avaudu automaattisesti piirto- tai puhevaiheessa, jottei Gboard ponnahda esiin kutsumatta.
- **Vakautusviive piirtovaiheessa (vaihe 11):** piirtovastaus (Gboard-tekstikenttä) käsitellään lopullisena vasta kun teksti on pysynyt muuttumattomana 2 sekuntia, koska Gboardin käsialantunnistus voi vielä täydentää tai korjata sanaa hetken kirjoittamisen jälkeen. "⏳ Vahvistetaan..." -ilmaisin näkyy odotuksen ajan. Toteutus tarkistettu uudelleen sekä vaiheessa 14 että 15 lapsen kysyttyä asiasta — koodi on ennallaan ja toimii kuten suunniteltu.
- **Pass/Graduate-portaat jokaiselle vaiheelle (vaihe 12):** vanha yhden kynnyksen malli (piirto 1, näppäimistö 3, puhe 4) korvattu kahdella kynnyksellä per vaihe: **Pass** = sama kynnys kuin ennen — kun täyttyy, sanan näyttötiheys puolittuu, jotta fokus siirtyy muihin vielä opeteltaviin sanoihin. **Graduate** = Pass + 2 lisäkertaa oikein samalla tavalla ilman virhettä välissä (piirto 3/3, näppäimistö 5, puhe 6) — kun täyttyy, sana siirtyy pysyvästi hierarkiassa (piirto → näppäimistö → puhe) seuraavalle vaiheelle, eikä sitä enää näytetä alemmalla vaiheella. Sana lasketaan kokonaan opituksi (graduoiduksi/kokonaisedistymispalkkiin vaikuttavaksi, ja vaiheesta 17 lähtien myös "luokka-aste kokonaan opittu" -tilaan vaikuttavaksi) vasta kun kaikki kolme vaihetta on graduoitu. **Vaiheen 19 virkkeille käytetään tietoisesti YKSINKERTAISEMPAA yhden kynnyksen mallia** (4 peräkkäistä oikein millä tahansa harjoitustyypillä, mikä tahansa virhe nollaa laskurin) — monimutkaisempi pass/graduate-porrastus on jätetty myöhemmäksi lisättäväksi, kunhan nähdään ensin miten peruskonsepti toimii käytännössä.
- **Rajattu aktiivinen sanaryhmä (vaihe 12, korjattu vaiheessa 14, laajennettu vaiheessa 17):** riippumatta siitä onko valittuna yksittäinen teema vai "kaikki teemat", ruudulla kierrätetään kerrallaan enintään 15 ja vähintään 10 sanaa (`ACTIVE_POOL_MIN`/`ACTIVE_POOL_MAX`), jotta suuri sanamäärä ei tee sanojen hyväksytyksi saamisesta liian hidasta ja demotivoivaa. Kun sana graduoituu pois PARHAILLAAN VALITUSTA tilasta, se poistuu aktiivijoukosta ja tilalle nostetaan uusi sana samasta teemasta; jos teema loppuu kesken, täydennetään ensin samasta luokka-asteesta muista teemoista, ja jos sekään ei riitä, seuraavan ylemmän luokka-asteen sanoista (ks. vaihe 17 alla — tämä korvaa vanhan "yleissanat"-täydennyksen roolin). **Vaiheen 12 alkuperäisessä toteutuksessa poistumiskriteerinä oli virheellisesti "kaikki kolme vaihetta graduoitu"**, mikä korjattiin vaiheessa 14 käyttämään parhaillaan valitun tilan graduoitumista. **Virkeharjoittelussa (vaihe 19) ei ole vastaavaa rajattua aktiivijoukkoa** — luokka-asteen 10 virkettä ovat kaikki koko ajan mukana kierrossa, koska määrä on jo valmiiksi pieni.
- **Sanaston ryhmittely OPSin teemoihin, "yleissanat" (v6, vaihe 12) ja sen purku luokka-asteiden tieltä (v7, vaihe 17):** vaiheessa 12 teemat personality, opposites, verbs_action ja verbs_communication (58 sanaa) yhdistettiin kokoomateemaan "yleissanat" (`group: general`), joka toimi aktiivijoukon täydentäjänä. **Vaiheessa 17 tämä yhdistäminen purettiin takaisin neljäksi erilliseksi teemaksi**, koska jokainen sana tarvitsee nyt oman luokka-astemerkintänsä eikä yhteinen "yleissanat"-kori enää sovi tähän. Vanhan "yleissanat"-täydennyksen tehtävä (aktiivijoukon täyttäminen kun oma teema loppuu) on korvattu kokonaan uudella luokka-astepohjaisella täydennyslogiikalla (ks. alla). Pelisanastot gaming_minecraft ja gaming_fortnite pysyvät edelleen `group: hobby` -merkittyinä ja luokka-asteesta riippumattomina — ne ovat aina käsin valittavissa teemavalikosta riippumatta siitä mikä luokka-aste on aktiivinen.
- **"Näytä sana" -paljastusnappi (vaihe 15):** käyttäjän havainto: kun aktiivijoukkoon nousee uusi/tuntematon sana, sen kirjoittaminen ensimmäistä kertaa on lapselle turhauttavaa arvailua. Ratkaisu: vastausalueen alapuolelle lisätty "👁️ Näytä sana" -nappi, joka paljastaa oikean vastauksen ja piilottaa syöttökentät/Tarkista-napin — jäljelle jää vain Ohita. Paljastus ei koskaan lasketa oikeaksi tai vääräksi vastaukseksi. **Vaiheessa 19 sama "👁️ Näytä virke" -periaate toistettiin virkeharjoittelussa** täysin samalla mekanismilla (piilottaa syöttötavat ja Tarkista-napin, jäljelle jää vain Ohita).
- **Yläpalkin edistymismittarien yksinkertaistus (vaihe 16):** liekkimittari (🔥) poistettu kokonaan, tähtibadge näyttää pelkän tasonimen + isommat ★/☆-symbolit, ja "X % opittu" -palkki korvattiin "Seuraavaan tähteen: X%" -palkilla, joka mittaa edistymistä kohti parhaillaan valitun tavan seuraavaa tähteä.
- **Luokka-asteittainen sanavarasto ja sen valikointi (vaihe 17):** ks. kokonaan oma osio alla ("Sanasto — v7" ja "Sovellus — vaihe 17").
- **Synonyymit ja monimerkitykselliset sanat (vaihe 17):** käyttäjän havainto: osa sanoista (varsinkin adjektiivit) tarkoittaa useampaa asiaa, esim. "land" = laskeutua/maa. Ratkaisu: 12 sanalle lisätty vaihtoehtoinen suomennos olemassa olevan `acceptedAnswers()`/`firstAcceptedAnswer()`-logiikan "/"-erotinkäytännön avulla (sama periaate jota jo käytettiin mm. sanalla "mine": "louhia / kaivos") — ei vaadi mitään koodimuutosta, koska "/"-tuki oli jo olemassa. Molemmat vaihtoehdot hyväksytään vastauksena, mutta suomeksi kysyttäessä näytetään aina vain ensimmäinen. Erillinen tarkistuslista (`synonyymit_tarkistettavaksi.md`) toimitettu käyttäjälle manuaalista läpikäyntiä varten — käyttäjä voi pyytää korjauksia, lisäyksiä tai poistoja listan pohjalta.
- **Palkintoasteikon avaaminen kokonaisuudessaan ja tasomaskotit taustakuvana (vaihe 18):** käyttäjän kaksi erillistä pyyntöä samasta viestistä. (1) Tähtibadgesta tehtiin klikattava (`cursor:pointer`) — klikkaus avaa modaalin (`#tierModalOverlay`), joka listaa kaikki 6 tasoa LEVELS-järjestyksessä, korostaa nykyisen tason ja merkitsee läpikäydyt tasot ✅-merkillä; sulkeutuu sulkunapista, taustaa klikkaamalla tai Esc-näppäimellä. (2) Nykyisen palkintotason maskotti-ikoni (🐍/🦎/🦅/🐙/🐊/🐉) näkyy nyt isona (220px), erittäin himmeänä (7 % peittävyys) taustakuvana sekä sanalaatikossa (`.prompt-card`) että kirjoituslaatikossa (`.answer-area`) — toteutettu CSS-muuttujalla `--tier-bg-icon`, jota päivitetään JS:stä `renderTierBadge()`-funktiosta aina kun taso tai harjoittelutapa vaihtuu.
- **Virkeharjoittelu — oma harjoitustyökalu kokonaisille virkkeille (vaihe 19):** ks. kokonaan oma osio alla ("Sovellus — vaihe 19").
- **Saksa alkaa 4. luokalta (vaihe 21, käyttäjän päätös):** Suomessa saksaa ei opiskella ennen 4. luokkaa. Kategorioiden `grade`-kenttä tarkoittaa nyt kielen **opiskeluvuotta**, ja sovellus siirtää sen luokka-asteeksi kielen aloitusluokan mukaan (`LANG_START_GRADE = { en: 1, de: 4 }`, `categoryGrade()`, `gradesForLang()`). Saksan luokkavalikossa on vain 4.–6. luokka; saksan 4. luokka = ensimmäinen opiskeluvuosi (samat perusteemat kuin englannin 1. luokalla: värit, numerot, perhe, tervehdykset, eläimet, kehonosat, perusverbit), 5. luokka = toinen vuosi, 6. luokka = kolmas. Englannin 4.–6. luokan teemat (mm. ammatit, matkustaminen) eivät kuulu saksan alakouluun. Saksan aiempi edistyminen säilyy (sanojen id:t ennallaan); vanha tallennettu `grade_de` 1–3 ei enää kelpaa, joten saksa avautuu 4. luokalta. Virkkeiden `grade` tulkitaan samoin, kun saksankielisiä virkkeitä joskus lisätään.
- **Numerot 0–20 (vaihe 21):** sanasto v8 (`en_1_6lk_v8.json`, v7 jätetty repoon historiaksi): lisätty zero ja eleven–twenty (fi + de: null, elf, zwölf … sechzehn, siebzehn … zwanzig). Puheentunnistuksen numero→sana-muunnos laajennettu 20:een kaikilla kielillä. **Samalla korjattu porsaanreikä:** aiemmin kirjoitettu numero ("15") hyväksyttiin sanan tilalle kaikissa syöttötavoissa, jolloin "viisitoista"-kehotteeseen pystyi vastaamaan opettelematta sanaa. Nyt numero kelpaa vain puhetilassa (jossa puheentunnistus itse palauttaa numeroita).
- **Monitulkintaisten sanojen tarkenteet (vaihe 21, käyttäjän valinta "tarkenna suomenkielistä kehotetta"):** sulkutarkenne näkyy lapselle kehotteessa mutta ei vaikuta vastauksen tarkistukseen eikä sitä lausuta ääneen: English/Finnish (kouluaine) vs. (kansalaisuus), orange (hedelmä) vs. (väri); "pyöräily" eroteltu: riding a bike = "pyörällä ajaminen", cycling = "pyöräily (urheilulaji)". Eheystarkistuksen varoitukset 6 → 2 (jäljelle jääneet kaksi ovat tarkistettuja vääriä hälytyksiä).
- **Automaattinen testaus ennen jokaista julkaisua (vaihe 20):** repoon lisätty `tests/`-kansio: `test_app.js` (84 regressiotestiä, ajaa oikean koostetun `index.html`:n skriptin Noden vm-hiekkalaatikossa feikatulla selaimella; testisarjan toimivuus varmennettu tahallisilla virheillä, jotka se saa kiinni) ja `check_data.py` (sanaston ja virkeaineiston eheys). Ajo: `python3 build.py` ja sitten `node tests/test_app.js` sekä `python3 tests/check_data.py`. Jatkossa jokainen muutos ajetaan näiden läpi ennen julkaisua.
- **Mallinvalinta vaiheessa 20 (käyttäjän ohje "parhaaksi katsomallasi mallilla"):** testisarja ja eheystarkistus Sonnetilla (mekaanista), virkkeiden kirjoitus ja logiikkamuutokset Opuksella, kieliasun riippumaton katselmointi Fablella (vahvin kielentarkistukseen). Sama Opus kirjoittaa + Fable tarkistaa -malli kannattaa jatkossakin kaikelle uudelle kielisisällölle (esim. saksankieliset virkkeet).
- **Virkkeiden tarkistuksen armollisuus (vaihe 20):** "kirjoita koko virke" -tehtävä vaati aiemmin täsmälleen tallennetun muodon, jolloin oikein osaava lapsi saattoi saada "väärin" esim. kirjoittamalla "I'm" eikä "I am", "favorite" eikä "favourite", tai "Yesterday I played football" eikä "I played football yesterday". Nyt (`normalizeSentence()`): lyhennemuodot avataan (I'm, don't, can't, it's, I'd…), amerikkalaiset kirjoitusasut muunnetaan brittiläisiksi (favorite, color, mom, math, practiced, traveled, canceled), ja virkkeellä voi olla valinnainen `alt`-lista hyväksyttyjä vaihtoehtoja — myös vaihtoehtoisia sanajärjestyksiä, jotka kelpaavat "järjestä sanat" -tehtävässä. Kuuntele ja toista vertaa parhaaseen osumaan kaikista hyväksytyistä muodoista. Sovelluksen oma kieliasu on nyt johdonmukaisesti brittienglantia (favourite, colour, mum, film, maths, practised), koska ääntäminen on en-GB.
- **Ei sukupuolettomia "hän"-kehotteita (vaihe 20):** suomen "hän" ei kerro, kirjoitetaanko *he* vai *she*, joten yhdeksän virkkeen subjekti vaihdettiin nimeksi (Anna, Max, Mia, Tom, Ella, Emma, Leo) tai "opettajaksi". Testi estää tämän virhetyypin palaamisen.
- **Julkaisu koneelta:** git push GitHubiin vaatii kirjautumisen (käyttäjätunnus/PAT), jota Claude ei voi syöttää puolestaan (turvallisuussyistä). Commitit tehdään Clauden toimesta paikalliseen repoon, mutta push jää aina käyttäjän tehtäväksi PowerShellistä tai Android Studion Git-integraatiosta.
- **Komentojen esitystapa:** kun vaihe on valmis ja käyttäjän pitää itse ajaa komentoja (esim. git push), Claude kirjaa ne aina allekkain omina komentorivinään (ensin kansioon siirtyminen `cd`-komennolla, sitten itse komento) — ei yhdelle riville `&&`-ketjuna.

- **Usean teeman valinta ja tiukka teemarajaus (vaihe 22, käyttäjän pyyntö):** teemavalikko (`#categoryFilter`) korvattiin napilla `#themeButton`, joka avaa ikkunan valintaruuduilla; oppilas voi valita useita teemoja (luokka-asteen teemat + Minecraft/Fortnite yhdessä). Ei valintaa = kaikki teemat. Ikkunassa asetus **"Pysy vain valituissa teemoissa"** (`themeStrict`, muistetaan laitteella, oletus pois): kun päällä, aktiivinen sanaryhmä koostuu vain valituista teemoista (pooli voi jäädä alle 10 sanan); kun pois, pooli täydennetään kuten ennenkin muista saman luokan teemoista ja muilta luokilta. Pelkkä harrasteteema-valinta ei koskaan täydennä muualta. Teemavalinta nollautuu luokan, kielen tai automaattisen luokkaetenemisen vaihtuessa (harrasteteemat säilyvät sanitoinnissa luokan vaihtuessa kesken valinnan vain jos ovat edelleen valittavissa).

## Sanasto — v7, luokka-asteittainen (1.–6. lk), englanti + saksa

`en_1_6lk_v8.json` (vaihe 21; v7 historiaksi): **409 sanaa, 42 kategoriaa** (v8 lisäsi numerot 0 ja 11–20). Jokainen sana kuuluu johonkin kategoriaan, ja jokainen kategoria (paitsi kaksi harrasteteemaa) on merkitty luokka-asteelle 1–6 kentällä `grade`. Rakenne muuten sama kuin ennen (id, en, fi, de, category, group).

**Luokka-asteiden sisältö pähkinänkuoressa** (kokonaismäärät ennen mallilause-suodatusta, ks. `practiceWords()`):
- **1. luokka / saksan 4. luokka (73 sanaa, ml. numerot 0–20):** perusverbit + osa aiemmasta v6-sanastosta uudelleenjaoteltuna helpoimmasta päästä (mm. koulun ihmiset, värit, numerot, tervehdykset).
- **2. luokka / saksan 5. luokka (59 sanaa):** mm. viikonpäivät, perhe, ruoka, hedelmät.
- **3. luokka / saksan 6. luokka (71 sanaa):** mm. koulun tarvikkeet ja -aineet, kellonajat, kohteliaat ilmaukset, eläimet.
- **4. luokka (68 sanaa):** mm. ulkonäkö, vaatteet, koti ja huoneet, kehonosat, sää ja vuodenajat, uusi "päivärutiinit"-teema.
- **5. luokka (60 sanaa):** kokonaan uudet teemat — ammatit, urheilu, liikenne, prepositiot, laajennetut tunteet, ostokset.
- **6. luokka (60 sanaa):** kokonaan uudet teemat — matkustaminen, teknologia, menneen ajan verbit, vaativammat adjektiivit, maat, tulevaisuuden suunnitelmat.
- **Luokka-asteesta riippumattomat (18 sanaa):** Minecraft- ja Fortnite-pelisanastot (`group: hobby`), aina käsin valittavissa.

**Aiempi versiohistoria (v2–v6) tiivistettynä:** v2 lisäsi ensimmäiset POPS-pohjaiset kategoriat, v3 korvasi puhekieliset muodot kirjakielisillä, v4 laajensi 194→260 sanaan (kuusi uutta kategoriaa), v5 lisäsi saksankieliset käännökset artikkeleineen, v6 ryhmitteli sanaston OPSin teemoihin ja yhdisti neljä teemaa "yleissanat"-koriksi. Kaikki nämä id:t on säilytetty muuttumattomina v7:ään asti, joten tallennettu edistyminen ei ole kadonnut yhdessäkään vaiheessa.

**v7-uudistus (vaihe 17):**
1. **"Yleissanat"-yhdistäminen purettu** takaisin neljäksi erilliseksi teemaksi (personality, opposites, verbs_action, verbs_communication), koska jokainen tarvitsi oman luokka-astemerkintänsä.
2. **138 kokonaan uutta sanaa** kirjoitettu luokille 5–6 kuuteen uuteen teemaan per luokka-aste (ks. yllä), koska POPS 2014 ei tarjoa valmista sanalistaa alakoulun 5.–6. luokille.
3. **12 sanalle lisätty vaihtoehtoinen suomennos** ("/"-erotettuna) monimerkityksellisyyden vuoksi — ks. Päätökset-osio ja erillinen `synonyymit_tarkistettavaksi.md`.
4. Kokonaismäärä kasvoi 260 → 398 sanaan, kategorioiden määrä 25 → 42:een.

## Virkeaineisto — vaihe 19 (laajennettu vaiheessa 20), englanti, luokat 1–6

`SENTENCE_DATA.en` (upotettu suoraan `index_template.html`:ään, ei erillistä JSON-tiedostoa toistaiseksi): **120 englanninkielistä virkettä, 20 per luokka-aste (1–6)**, kukin muotoa `{ id, grade, en, fi, alt? }`; 39 virkkeellä on `alt`-lista hyväksyttyjä vaihtoehtoja. Vaiheen 20 uudet virkkeet (id:t `en_gX_11`–`en_gX_20`) on kirjoitettu painottaen kyseisen tai alemman luokka-asteen sanastoa, koska eheystarkistus näytti, että alkuperäisten virkkeiden sisältösanoista vain 21–37 % löytyi sanalistasta. Kaikki 120 virkettä katselmoitiin Fablella (32 korjausta: lähinnä suomenkielisiä kehotteita, jotka olisivat voineet johtaa toiseen yhtä oikeaan englanninkieliseen vastaukseen, sekä kaksi luokka-asteelleen liian vaikeaa/helppoa virkettä). `SENTENCE_DATA.de` on toistaiseksi tyhjä taulukko (ks. Päätökset — saksa lisätään myöhemmin).

**Vaikeuskaari luokittain** (Clauden oma CEFR-pohjainen kalibrointi, ks. Päätökset-osio):
- **1. luokka (pre-A1):** hyvin yksinkertaisia perusvirkkeitä olla/omistaa-rakenteilla ("I am happy.", "I have a dog.").
- **2. luokka (pre-A1 → A1.1):** yksinkertainen preesens, pitämiset/ei-pitämiset, osaamisen ilmaisu ("I can swim very well.", "I don't like spiders.").
- **3. luokka (A1.1):** arkisia toimintoja ja mennyttä aikaa, yksinkertaisia toiveita ("I played football yesterday.", "I want to be a doctor.").
- **4. luokka (A1.1 → A1.2):** kysymyksiä, vertailuja, kahden lauseenosan yhdistelyä ("but"-rakenteet) ("Can you help me with my homework?").
- **5. luokka (A1.2):** ehtolauseet, sivulauseet ("although", "because"), täydennysverbit ("If it rains tomorrow, we will stay at home.").
- **6. luokka (A1.3 → A2.1):** mielipiteet, monimutkaisemmat sivulauseet, tulevan ajan rakenteet ("Hurry up, or the film will start before we get there."; vaiheessa 20 poistettu B1-tason futuurin perfekti).
- **Keskimääräinen virkepituus sanoina:** 4,1 / 5,0 / 5,9 / 7,7 / 9,0 / 11,3 (luokat 1–6) — kasvaa tasaisesti.

## Sovellus — vaiheet 3–6, 9–20

`index.html`, yksi tiedosto, sanasto upotettuna (toimii myös ilman palvelinta). Rakennetaan lähdetiedostosta `index_template.html` + sanasto-JSON `build.py`-skriptillä; sama build tuottaa myös `sanaseikkailu.html`-fragmentin Artifact-julkaisua varten. Molemmat lähdetiedostot ovat gitissä.

**Käyttöliittymä ja ydinlogiikka (vaiheet 3–4):** lapsille sopiva ulkoasu, teemasuodatin, satunnainen kohdekieli/FI-suunta, painotettu sananvalinta, edistymisen tallennus.

**Kynä-, näppäimistö- ja puhesyöttö (vaihe 5, laajennettu vaiheissa 10–11, 13–14) — vahvistettu toimivaksi tabletilla:**
- **Piirrä (kynä):** Chromen `HandwritingRecognizer` ensisijaisena, Gboardin käsialanäppäimistö varana. Suojattu tavallista näppäilyä vastaan ja vakautusviiveellä. Tilapainike vasemmanpuoleisin.
- **Kirjoita (näppäimistö):** tilapainike keskellä.
- **Puhu (mikrofoni):** vastaus tarkistetaan automaattisesti heti tunnistuksen jälkeen. Toimii GitHub Pagesissa, ei artifact-linkissä. Kielikoodi vaihtuu automaattisesti (en-GB / de-DE). Tilapainike oikeanpuoleisin.
- **Vastausten normalisointi:** isot/pienet kirjaimet ja välimerkit eivät haittaa, "/"-vaihtoehdot kelpaavat (ks. myös vaihe 17: synonyymit käyttävät samaa mekanismia), numerot muunnetaan sanoiksi (myös saksaksi).
- **Tilanvalinta on aina lapsen käsissä (vaihe 14):** kolme tilapainiketta ovat aina näkyvissä ja klikattavissa, mikä tahansa sana on kesken. Sovellus ei koskaan vaihda tilaa taustalla.

**Saksan kielen lisäys (vaihe 9):** ✅ Lippuvalitsin (🇬🇧 English / 🇩🇪 Deutsch), suomi kiinteänä pohjakielenä.

**Kolmivaiheinen oppimispolku (vaihe 10, korvattu osittain vaiheessa 14):** ✅ Piirrä → kirjoita → puhu -oppimispolku per sana. Automaattinen pakotettu järjestys poistettu kokonaan vaiheessa 14.

**Piirtovaiheen tiukennukset (vaihe 11):** ✅ Nopean kirjain-kerrallaan-näppäilyn tunnistus ja hylkäys, näppäimistö ei avaudu automaattisesti piirto-/puhevaiheessa, 2 sekunnin vakautusviive.

**Aktiivinen sanaryhmä, pass/graduate-portaat ja teemojen ryhmittely (vaihe 12, korjattu vaiheessa 14, laajennettu vaiheessa 17):** ✅ Kynnykset (Pass/Graduate) piirto 1/3, näppäimistö 3/5, puhe 4/6. ✅ Rullaava aktiivinen sanaryhmä (10–15 sanaa). ✅ 15 % kertaustodennäköisyys. ✅ Täydennyslogiikka korvattu vaiheessa 17 luokka-astepohjaisella versiolla (ks. alla).

**Palkintoasteikkojen kevennys per menetelmä + tilapainikkeiden järjestys (vaihe 13):** ✅ Kolme erillistä tähtiasteikkoa (piirto/näppäimistö/puhe). ✅ Tilapainikkeiden järjestys kynä→näppäimistö→puhe.

**Manuaalinen tilanvalinta ja aktiivijoukon per-menetelmä-korjaus (vaihe 14):** ✅ Automaattinen syöttötavan vaihto poistettu kokonaan. ✅ Aktiivijoukon poistumis-/täydennyskriteeri korjattu käyttämään parhaillaan valitun tilan graduoitumista.

**"Näytä sana" -paljastusnappi (vaihe 15):** ✅ Valmis ja käytössä.

**Yläpalkin edistymismittarien yksinkertaistus (vaihe 16):** ✅ Liekkimittari pois, tähtibadge symboleina, "seuraavaan tähteen" -palkki.

**Luokka-asteittainen sanavarasto ja sen valikointi (vaihe 17):**
- ✅ **398 sanan v7-sanasto** ladattu käyttöön (ks. "Sanasto — v7" yllä), koskien sekä englantia että saksaa.
- ✅ **Uusi luokka-astevalikko** (`#gradeFilter`) valikkorivillä, ennen olemassa olevaa teemavalikkoa (`#categoryFilter`). Valmiiksi opitut luokka-asteet näkyvät valikossa vihreällä "✅ "-etuliitteellä.
- ✅ **Teemavalikko rajautuu aktiivisen luokka-asteen mukaan:** `populateCategoryOptions()` näyttää vain sen luokka-asteen teemat (plus aina Minecraft/Fortnite-harrasteteemat riippumatta luokka-asteesta).
- ✅ **Oletusluokka-aste per kieli** ja **ristiin luokka-asteiden menevä automaattitäydennys** (`nextGradeFallbackWords()`).
- ✅ **Luokka-asteen valmistuminen ja automaattinen siirtyminen** (`isGradeComplete()`/`maybeAdvanceGrade()`).
- ✅ **Palkintomittari (tähdet) rajattu aktiiviseen luokka-asteeseen.**
- ✅ Rakennettu, syntaksi tarkistettu, logiikka varmennettu Node.js vm-integraatiotestillä. Julkaistu Artifactiin (Versio 17) ja committoitu gittiin.
- 🔄 Lapsi testaa käytännössä.

**Klikattava palkintoasteikko + tasomaskotit taustakuvana (vaihe 18):**
- ✅ **Palkintoasteikko-modaali:** tähtibadgen klikkaus (`openTierModal()`) avaa `#tierModalOverlay`-modaalin, joka listaa kaikki 6 tasoa (`renderTierModalContent()`), korostaa nykyisen ja merkitsee läpikäydyt ✅:lla. Sulkeutuu sulkunapista, taustaklikkauksella tai Esc:llä (`closeTierModal()`).
- ✅ **Tasomaskotit taustakuvana:** CSS-muuttuja `--tier-bg-icon` (asetetaan `renderTierBadge()`:sta) renderöi nykyisen tason ikonin (🐍/🦎/🦅/🐙/🐊/🐉) 220px-kokoisena, 7 %:n peittävyydellä `.prompt-card`- ja `.answer-area`-korttien taustalle `::before`-pseudoelementillä; oikea sisältö pidetään päällä `z-index`illä.
- ✅ Rakennettu, syntaksi tarkistettu (`node --check`), logiikka varmennettu Node.js vm-testillä (fake-canvas/`getContext`- ja `window.addEventListener`-stubit lisätty testiharjoitukseen). Julkaistu Artifactiin (Versio 18) ja committoitu gittiin (`ff81eda`).
- 🔄 Lapsi testaa käytännössä.

**Virkeharjoittelu — oma harjoitustyökalu kokonaisille virkkeille (vaihe 19):**
- **Tausta:** käyttäjä pyysi omaa harjoitustyökalua virkkeille, ikäluokan mukaan etenevällä vaikeustasolla, ja kysyi ehdotuksia toteutukseen. `AskUserQuestion`-kierroksella käyttäjä päätti: (1) kaikki neljä harjoitustyyppiä kerralla, (2) sijoittelu sanaharjoittelun luokka-aste/teema-rakenteeseen päätetään myöhemmin prototyypin kokeilun jälkeen, (3) vain englanti aluksi.
- ✅ **Uusi sanat/virkkeet-valitsin** (`.practice-switch`, "📚 Sanat" / "📝 Virkkeet") lippuvalinnan alapuolella. `setPracticeMode()` vaihtaa näkyviin joko olemassa olevan `#wordPractice`-lohkon tai uuden `#sentencePractice`-lohkon; teemanappi (`#themeButton`, ei relevantti virkkeille) piilotetaan virketilassa. Luokka-astevalikko (`#gradeFilter`) toimii yhteisesti molemmille tiloille.
- ✅ **Neljä harjoitustyyppiä**, arvotaan satunnaisesti joka kierroksella (`EXERCISE_TYPES`):
  1. **Kirjoita koko virke** (suomi→englanti, vapaa tekstikenttä, tarkka vastaavuus normalisoinnin jälkeen).
  2. **Täydennä puuttuva sana** — yksi sisältösana (ei "a/the/is"-tyyppinen pikkusana, ks. `blankIndexFor()`/`SENTENCE_STOPWORDS`) korvataan aukolla, suomenkielinen virke näkyy vihjeenä.
  3. **Järjestä sanat oikein** — englanninkielisen virkkeen sanat sekoitetaan klikattaviksi "chipeiksi" (`.sentence-chip`), lapsi rakentaa virkkeen napauttamalla oikeassa järjestyksessä; "↩️ Poista viimeinen" -nappi peruu viimeisimmän valinnan.
  4. **Kuuntele ja toista** — sovellus lausuu englanninkielisen virkkeen automaattisesti (ks. Päätökset), lapsi toistaa mikrofoniin; tunnistus tarkistetaan LIEVÄLLÄ ≥70 %:n sana-osumalla (`sentenceTokenOverlap()`) tarkan vastaavuuden sijaan, koska puheentunnistus ei ole täysin tarkka.
- ✅ **60 virkkeen aineisto** (`SENTENCE_DATA.en`, 10 per luokka-aste 1–6, ks. "Virkeaineisto — vaihe 19" yllä), Clauden koostama POPS/CEFR-tutkimuksen pohjalta.
- ✅ **Yksinkertaistettu mastery-malli** (ks. Päätökset): 4 peräkkäistä oikein millä tahansa harjoitustyypillä graduoi virkkeen (`SENTENCE_GRADUATE`), tallennetaan samaan IndexedDB-tauluun `sentence|kieli|virkkeen id` -avaimella. Luokka-asteen edistymislabel ("Opittu X/10 virkettä") näytetään virketilan yläpuolella.
- ✅ Rakennettu (`build.py`), syntaksi tarkistettu (`node --check`), logiikka varmennettu laajalla Node.js vm-integraatiotestillä (kaikki neljä harjoitustyyppiä, `blankIndexFor()`:n sisältösanavalinta, mastery-laskenta 4 peräkkäisen oikean jälkeen, ja sanat/virkkeet-valitsimen näkyvyystoggle — kaikki läpäisivät).
- ✅ Julkaistu Artifactiin (Versio 19) ja committoitu gittiin (`9151ff1`).
- ⏭️ Lapsi ei ole vielä testannut käytännössä. Sijoittelu sanaharjoittelun rakenteeseen (oma erillinen tila vs. teema sanaston sisällä) päätetään vasta kun prototyyppiä on kokeiltu — ks. Seuraavaksi käyttäjältä.

**Laatuvaihe: testit, data, virkkeet ja täydennyksen korjaus (vaihe 20):**
- ✅ **Regressiotestit** `tests/test_app.js` (84 testiä) + `tests/harness.js` + `tests/README.md`. Kattaa käynnistyksen, kielivalinnan, vastausten tarkistuksen, vaihekynnykset, palkintotasot, luokka-asteet, aktiivisen poolin, modaalin, "Näytä sana" -napin, kaikki neljä virketehtävää ja varmuuskopioinnin.
- ✅ **Eheystarkistus** `tests/check_data.py` (+ raportti `tests/data_report.txt`): 0 virhettä, 6 varoitusta — kaikki tarkistettuja ja hyväksyttäviä (ks. Seuraavaksi käyttäjältä kohta 4).
- ✅ **Virkkeet 60 → 120** ja Fable-katselmointi (ks. Virkeaineisto yllä).
- ✅ **Armollinen virkevertailu** (`normalizeSentence()`, `matchesSentence()`, `bestSentenceOverlap()`, `alt`-listat).
- ✅ **Aktiivijoukon täydennyksen korjaus** (`fallbackGradeOrder()`, `fillFromOtherGrades()`): aiemmin täydennys katsoi vain ensimmäisen ylemmän luokka-asteen, jolla oli sanoja — jos ne kaikki oli jo graduoitu valitussa tilassa, aktiivinen pooli jäi tyhjäksi (sovellus ei kaatunut, mutta kierrätti jo opittuja sanoja uusien sijaan), ja 6. luokalla täydennystä ei ollut lainkaan. Nyt täydennys käy läpi kaikki ylemmät luokka-asteet nousevassa järjestyksessä ja sitten alemmat laskevassa. Testattu, että vanha versio epäonnistuu uusissa testeissä ja uusi läpäisee ne.
- ✅ Testit ajettu sekä Clauden työtilassa että käyttäjän koneella (84/84). Julkaistu Artifactiin (Versio 20) ja committoitu (`dda46bc`).
- ⏭️ Lapsi ei ole vielä testannut.

**Saksa 4. luokalta, numerot 0–20, tarkenteet (vaihe 21):**
- ✅ Kielikohtainen aloitusluokka (`LANG_START_GRADE`), saksan luokat 4–6, värit ja numerot saksan 4. luokan teemoissa.
- ✅ Sanasto v8: numerot 0–20; kirjoitettu numero ei enää kelpaa sanan tilalle.
- ✅ Tarkenteet monitulkintaisiin sanoihin, tarkennetta ei lausuta.
- ✅ 90 testiä (6 uutta), dataeheys 0 virhettä / 2 tunnettua väärää hälytystä. Sama build tavu tavulta käyttäjän koneella. Julkaistu (Artifact v21), committoitu (`de478f1`).

**Usean teeman valinta (vaihe 22):**
- ✅ `selectedThemes` (lista) korvasi `currentCategory`; `eligibleWordsForCategoryScope(sel)`, `topUpPool`, `fillFromOtherGrades`, `graduatedWordsInScope` ottavat listan; `outsideTopUpAllowed(sel)` päättää täydennyksen; `scopeKey()` käynnistää poolin uudelleen kun valinta tai tiukka-asetus vaihtuu.
- ✅ Teemanappi piilotetaan virketilassa kuten ennen valikko.
- ✅ 101 testiä (11 uutta, vanhat päivitetty), dataeheys ennallaan. Julkaistu (Artifact v22), committoitu (`cbcd927`).

## Testitulokset tabletilla

| | Artifact-linkki | GitHub Pages |
|---|---|---|
| Näppäimistö | ✅ | ✅ |
| Kaiutin (🔊) | ✅ | ✅ |
| Mikrofoni | ❌ kehys estää | ✅ |
| Kynä (Gboard-käsiala) | testaamatta | ✅ |
| Varmuuskopiointi (vie/tuo) | ❌ sandboxin rajoitus | testaamatta |
| Saksan kielivalinta (v5) | testaamatta | testaamatta |
| Oppimispolku, manuaalinen tilanvalinta (vaihe 10 → 14) | 🔄 lapsi testaa parhaillaan | testaamatta |
| Piirtovaiheen näppäilyesto + vakautusviive (vaihe 11) | 🔄 lapsi testaa parhaillaan | testaamatta |
| Aktiivinen sanaryhmä + pass/graduate + teemaryhmittely (vaihe 12, korjattu vaihe 14) | 🔄 lapsi testaa parhaillaan | testaamatta |
| Per-menetelmä-palkintoasteikot + tilapainikkeiden järjestys (vaihe 13) | testaamatta | testaamatta |
| "Näytä sana" -paljastusnappi (vaihe 15) | 🔄 lapsi testaa parhaillaan | testaamatta |
| Yläpalkin mittarien yksinkertaistus (vaihe 16) | 🔄 lapsi testaa parhaillaan | testaamatta |
| Luokka-asteittainen sanasto, valikko, ristiin menevä täydennys, automaattinen luokka-asteen vaihto (vaihe 17) | testaamatta | testaamatta |
| Synonyymit/monimerkitykselliset sanat (vaihe 17) | testaamatta, odottaa käyttäjän manuaalista tarkistusta | testaamatta |
| Klikattava palkintoasteikko-modaali (vaihe 18) | testaamatta | testaamatta |
| Tasomaskotit taustakuvana sana-/kirjoituslaatikossa (vaihe 18) | testaamatta | testaamatta |
| Virkeharjoittelu — kaikki neljä harjoitustyyppiä (vaihe 19) | testaamatta | testaamatta |
| Sanat/virkkeet-valitsin (vaihe 19) | testaamatta | testaamatta |
| 120 virkettä + armollinen tarkistus (lyhenteet, US/GB, vaihtoehtoiset järjestykset) (vaihe 20) | testaamatta | testaamatta |
| Saksa 4. luokalta, numerot 0–20, tarkenteet (vaihe 21) | testaamatta | testaamatta |
| Usean teeman valinta + tiukka teemarajaus (vaihe 22) | testaamatta | testaamatta |
| Automaattiset regressiotestit (vaiheet 20–21) | ✅ 90/90 (Node, ei selainta) | — |

Vinkki: Chromen valikko → "Lisää aloitusnäyttöön" avaa sovelluksen kokoruudussa ilman selainpalkkeja.

## Vaiheet ja mallisuositukset

1. **Määrittely ja UX-suunnittelu** — Sonnet. ✅
2. **Sanaston kokoaminen** — Haiku/Sonnet. ✅
3. **UI-prototyyppi** — Sonnet. ✅
4. **Ydinlogiikka** — Sonnet. ✅
5. **Kynä- ja puhesyötteen integrointi** — Opus. ✅ Testattu ja toimii tabletilla.
6. **Testaus lapsen kanssa ja korjaukset** — Sonnet, ongelmatilanteissa Opus. ✅ Valmis.
7. **Lisäominaisuudet: kertaus vaikeista sanoista + ääneen luettu sana** — Sonnet. ✅ Toteutunut osittain (painotettu sananvalinta + harvakseltaan-kertaus), erillistä spaced repetition -aikataulutusta ei silti ole.
8. **Viimeistely ja julkaisukuntoon saattaminen** — Opus koodikatselmointiin, Sonnet korjauksiin.
9. **Saksan kielen lisäys** — Sonnet. ✅ Koodipuoli valmis. ⏭️ Testaus lapsen kanssa vielä tekemättä.
10. **Kolmivaiheinen oppimispolku** — Sonnet. ✅ Koodipuoli valmis (automaattinen järjestys korvattu vaiheessa 14).
11. **Piirtovaiheen näppäilyesto ja vakautusviive** — Sonnet. ✅ Koodipuoli valmis, logiikkatestattu, käytön testaus alkanut.
12. **Aktiivinen sanaryhmä, pass/graduate-portaat ja teemojen OPS-ryhmittely** — Sonnet. ✅ Koodipuoli valmis, logiikkatestattu, käytön testauksessa löytynyt bugi korjattu vaiheessa 14.
13. **Palkintoasteikkojen kevennys per menetelmä + tilapainikkeiden järjestys** — Sonnet. ✅ Koodipuoli valmis, logiikkatestattu. ⏭️ Testaus lapsen kanssa vielä tekemättä.
14. **Manuaalinen tilanvalinta ja aktiivijoukon per-menetelmä-korjaus** — Sonnet. ✅ Koodipuoli valmis, logiikkatestattu, käytön testauksessa löytynyt jatko-ongelma johti vaiheeseen 15.
15. **"Näytä sana" -paljastusnappi** — Sonnet. ✅ Koodipuoli valmis, lapsi testasi.
16. **Yläpalkin edistymismittarien yksinkertaistus** — Sonnet. ✅ Koodipuoli valmis, lapsi testasi.
17. **Luokka-asteittainen sanavarasto (1.–6. lk) + synonyymit** — Sonnet. ✅ Koodipuoli valmis: 398 sanan v7-sanasto, luokka-astevalikko, ristiin menevä automaattitäydennys, automaattinen luokka-asteen valmistuminen/siirtyminen, per-luokka-aste-palkintomittari, 12 synonyymilisäystä. Julkaistu ja committoitu. 🔄 Lapsi testaa vasta alkamassa; käyttäjän synonyymilista odottaa manuaalista läpikäyntiä.
18. **Klikattava palkintoasteikko-modaali ja tasomaskotit taustakuvana** — Sonnet. ✅ Koodipuoli valmis: koko 6-tason asteikko avautuu tähtibadgen klikkauksesta, nykyisen tason maskotti näkyy himmeänä taustakuvana sana-/kirjoituslaatikossa. Julkaistu (Artifact v18) ja committoitu (`ff81eda`). ⏭️ Testaus lapsen kanssa vielä tekemättä.
19. **Virkeharjoittelu — oma harjoitustyökalu kokonaisille virkkeille** — Sonnet. ✅ Koodipuoli valmis: sanat/virkkeet-valitsin, 60 virkkeen englanninkielinen aineisto (luokat 1–6), neljä harjoitustyyppiä (kirjoita/täydennä/järjestä/kuuntele), yksinkertaistettu mastery-malli. Julkaistu (Artifact v19) ja committoitu (`9151ff1`). 🔄 Lapsi ei ole vielä testannut. Sijoittelu sanaharjoittelun rakenteeseen ja saksan lisäys päätetään myöhemmin prototyypin kokeilun perusteella.
20. **Laatuvaihe: testisarja, dataeheys, 120 virkettä, armollinen virkevertailu, moniasteinen täydennys** — Sonnet (testit, eheystarkistus), **Opus** (virkkeet, logiikka; käytössä nyt), Fable (kieliasun katselmointi). ✅ Valmis, julkaistu (Artifact v20) ja committoitu (`dda46bc`). ⏭️ Lapsi ei ole vielä testannut.
21. **Saksa alkaa 4. luokalta, numerot 0–20, tarkenteet monitulkintaisiin sanoihin** — **Opus** (käytössä nyt). ✅ Valmis, julkaistu (Artifact v21) ja committoitu (`de478f1`). 🔄 Lapsella tulossa saksan koe väreistä ja numeroista 0–20 — harjoittelu: Saksa → 4. luokka → teema "Värit" tai "Numerot".
22. **Usean teeman valinta ja valinnainen tiukka teemarajaus** — **Sonnet** (käytössä). ✅ Valmis, julkaistu (Artifact v22) ja committoitu (`cbcd927`).
23. **Tiivis asettelu pystysuuntaiselle tabletille** — **Sonnet**. ✅ Julkaistu (Artifact v23). Committoitu (`375085a`): Sanaseikkailu-logo poistettu, valintanapit yhteen vasemmalle tasattuun riviin, äänitoistonappi ja automaattilausunta kortin alareunaan, EN/DE-merkki piilotettu, välejä tiivistetty. Muutokset `index_template.html`:ssä.
23b. **Aikuisen näkymä (vaihe 24)** — Sonnet. ✅ Julkaistu (Artifact v24), committoitu (`5e61b86`). Footerin nappi "📊 Aikuisen näkymä": yhteenveto, luokka-asteittain, teemoittain, hankalat sanat (≥2 virhettä, ei vielä opittu), 14 päivän päiväloki (localStorage, alkaa vaiheesta 24), virkkeet. 107 testiä.
25. **Sanasto v9 (vaihe 25)** — Opus (luonnos) + Fable (tarkistus). ✅ 67 virkkeissä esiintyvää sanaa lisätty (409 → 476), uudet kategoriat Aikasanat (lk 2), Aika- ja yleissanat (lk 3), Sidesanat ja täsmentimet (lk 5). Fablen korjaukset sovellettu. Virkekattavuus nousi mm. luokalla 4: 58 % → 85 %.
26. **Saksankieliset virkkeet (vaihe 26)** — Opus (luonnos) + Fable (tarkistus). ✅ 60 virkettä (opiskeluvuodet 1–3 = 4.–6. lk, 20/vuosi), alt-muodot sanajärjestysvaihtoehdoille, ä/ö/ü/ß ↔ ae/oe/ue/ss -lievennys, saksan apusanat täydennystehtävässä. Sanastoon lisätty eat, drink, very, cake, school. Committoitu (`c46726a`, vaiheet 25–26 yhdessä), Artifact v26. 113 testiä.
   - ⏳ Havainto vaiheesta 23 (kustantamon kirjan järjestys): opettaja seuraa kirjan etenemistä, joten sovellus ei tiedä viikon sanoja. Ehdotus: aikuisen "Viikon sanat" -lista (aikuinen valitsee sanat tai teemat, joita lapsen pooli ensisijaisesti harjoittelee). Odottaa käyttäjän päätöstä.
27. **Viikon sanat (vaihe 27)** — Sonnet. ✅ Aikuisen näkymässä lista (kirjan mukaiset sanat, en/de tai suomeksi, pilkulla/rivinvaihdolla); tunnistamattomat raportoidaan. Lapselle painike "📖 Viikon sanat": pooli koostuu vain listan sanoista (ei täydennystä muualta), kielikohtainen, muistetaan laitteella. Committoitu (`e88e184`), Artifact v27, 122 testiä.
28. **Yläkoulun sanasto 7.–9. lk (vaihe 28)** — Opus (luonnos) + Fable (tarkistus). ✅ Sanasto v10 (`en_1_9lk_v10.json`): 224 uutta englannin sanaa, 21 uutta kategoriaa (luokat 7/8/9), ei saksaa (saksan pooli sivuuttaa sanat joilla ei ole `de`). Luokka-asteet 1–9 (saksa 4–9: saksan luokat 7–9 = englannin 4.–6. lk:n teemat). Fablen törmäyskorjaukset (pay/exam tarkenteet jne.) sovellettu. Committoitu (`6f1dea0`), Artifact v28, 127 testiä.
29. **Englannin virkkeet 7.–9. lk (vaihe 29)** — Opus (luonnos) + Fable (tarkistus, 11 korjausta). ✅ 60 uutta virkettä, englannin virkkeitä yhteensä 180 (luokat 1–9, 20/luokka). check_data.py tukee luokkia 1–9. Committoitu (`d264054`), Artifact v29, 129 testiä.
30. **Kirjan sanasto 4. lk (vaihe 30)** — käyttäjän valokuvaamat oppikirjan suomi–englanti-aakkossanaston sivut (s. 121–132) litteroitu (7 Opus-agenttia, ~1500 paria), karsittu (Opus: 470 duplikaattia pois, 176 hylättyä) ja Fable-tarkistettu (britti-englanti, törmäykset). ✅ Sanasto v11 (`en_1_9lk_v11.json`): +871 sanaa, 25 uutta 4. lk:n kategoriaa (`*_4`, `no_de: true` = ei saksaa), yhteensä 1576 sanaa. check_data.py sallii puuttuvan `de`:n `no_de`-kategorioissa. Committoimatta (laitteeseen ei saatu yhteyttä), Artifact v30, 129 testiä. Huom: 4. lk:n sanamäärä kasvoi ~75:stä ~950:een, joten automaattinen luokan eteneminen hidastuu — harkitse teemojen/Viikon sanat -käyttöä.
31. **Koe 1 -teema (vaihe 31)** — käyttäjän kuvaamat oppikirjan Unit 1–3 -sivut (s. 8–31: olla-verbi, kestopreesens, kouluaineet, kellonajat). ✅ Uusi koealue-teema `koe1_4` ("Koe 1", `exam:true`, `lang:"en"`): 110 olemassa olevaa sanaa merkitty lisäteemaksi (`word.also`) + 3 uutta (ballet, quarter to, watch (katsella)); `turn` = kääntyä / vuoro, `hide` + olla piilossa. 38 omaa Koe 1 -virkettä (`theme:"koe1_4"`, grade 4; eivät kuulu tavallisiin luokkapooleihin). Koealueen teema näkyy aina listan ensimmäisenä englannissa (ei saksassa), ohittaa luokkarajauksen, ei täydennä ulkopuolelta. Teemanappi näkyy myös virketilassa (vain koe-teemat). Aikuisen raportissa Koe 1 -teema. Sanasto v12 (`en_1_9lk_v12.json`, 1579 sanaa). Fable-tarkistettu (nyt-vihjeet kestopreesensvirkkeissä). 134 testiä, Artifact v31. Committoitu (11c4f50).
32. **Saksan Koe 1 + englannin synonyymit (vaihe 32)** — käyttäjän kuvaamat saksan oppikirjan (Los geht's! 1) Lektion 1–3 -sivut. ✅ Uusi koealue `koe1_de` ("Koe 1", `exam:true`, `lang:"de"`, grade 1 = 4. lk): 39 olemassa olevaa sanaa merkitty lisäteemaksi (`also`; värit, numerot 0–12, tervehdykset, kohteliaisuudet) + 37 uutta sanaa/fraasia (`de_only:true`: eivät näy englannin harjoituksessa). 40 omaa saksan Koe 1 -virkettä (`de_k1_*`, `theme:"koe1_de"`). Opus litteroi, Fable tarkisti (suomennosten ja alt-muotojen korjaukset tehty). Lisäksi englannin synonyymikierros: ~240 sanalle lisätty yleisiä suomennosvaihtoehtoja (esim. funny = hassu / hauska); törmäävät (fi→en-monitulkintaiset) lisäykset karsittu. Sanasto v13 (`en_1_9lk_v13.json`, 1616 sanaa). 136 testiä, Artifact v32.
33. **Saksan synonyymit ja virkkeet 7.–9. lk (vaihe 33)** — ✅ Opus-apurit (ei Fablea, käyttäjän ohjeen mukaan odottaa erillistä komentoa): saksan sanoille lisätty suomennos- ja saksavaihtoehtoja (~120 sanaa; esim. lustig = lustig / witzig; ristiriitaiset lisäykset karsittu), uudet 60 saksan virkettä opiskeluvuosille 4–6 (`de_g4_*`–`de_g6_*`, eli 7.–9. lk; aiemmin 0), nyt saksan luokkavirkkeitä 120 (20 / vuosi). Sanasto v14 (`en_1_9lk_v14.json`). 136 testiä. **Fable-tarkistus odottaa:** saksan synonyymit ja uudet virkkeet (aja kun käyttäjä antaa komennon). Muita ehdotettuja laajennuksia: 4. lk englannin alatasot (871 sanaa), kielioppimoduuli (artikkelit, monikot, sein/haben), lukukappaleet, esimerkkilauseet vaikeille sanoille, Koe 2 -tuonti (kuvista), ruotsi 6. lk:lta.
34. **Englannin virkkeet kirjasanastolle + testien vakautus (vaihe 34)** — ✅ Opus kirjoitti 120 omaa englannin virkettä (`en_g4_b0..b2_*`, grade 4) 4. luokan kirjasanaston 26 kategoriasta; englannin virkkeitä nyt 338 (4. luokalla 140). Testien satunnaiset kaatumiset korjattu: `boot()` odottaa asynkronisen alustuksen valmistumista (3 rinnakkaista ajoa läpi). 136 testiä. **Fable-tarkistus odottaa:** 120 uutta englannin virkettä, saksan synonyymit, 60 saksan virkettä (7.–9. lk).
35. **Saksan monikot + koealueraportti (vaihe 35)** — ✅ Opus tuotti monikkomuodot 175 saksan substantiiville (`de_pl`, sanasto v15): näkyvät palautteessa ja "Näytä sana" -paljastuksessa saksassa (englannissa ei). Aikuisen raporttiin uusi "Koealueet"-osio: Koe 1 -sanojen ja -virkkeiden valmius sekä heikoimmat sanat (kielen mukaan). 138 testiä.
36. **Kielioppiharjoitus + Fable-tarkistukset (vaihe 36)** — ✅ Uusi 🔤 Kielioppi -harjoittelutapa (vain saksa): der/die/das-valinta ja monikon kirjoitus (hyväksyy ilman artikkelia, vaihtoehtoiset muodot ja ae/ue/ss-korvikkeet; painotus heikoimmin menneille sanoille, tilastot localStoragessa `grammarStats_de`; sanat luokka-asteeseen asti). Fable tarkisti käyttäjän komennosta kaiken odottaneen: 120 englannin virkettä (11 korjausta), saksan synonyymit (3, vanhoja käännösvirheitä: kind, look, ticket), 60 saksan virkettä 7.–9. lk (12), 175 monikkoa (3 vaihtoehtomuotoa), englannin synonyymit (9). Korjaukset tehty, sanasto v16 (`en_1_9lk_v16.json`). 141 testiä. Tulevaa: monivalinta/yhdistely, sanelu, lukukappaleet, esimerkkilauseet, Koe 2 -tuonti kuvista.
   - Huom: englannin virkkeitä luokille 7–9 ei vielä ole (virketila näyttää "Ei vielä virkkeitä"); `meta.level` jätettiin "4lk" tallennusavainten säilyttämiseksi.
37. **Ruotsi (sv) kolmanneksi kieleksi (vaihe 37)** — ✅ Opus kirjoitti ruotsinnokset 481 sanalle (kaikki sanat, joilla on saksa ja luokka ≤ 6; ei Koe 1 -englantia, ei `de_only`) ja 60 ruotsin virkettä (`sv_g1_*`–`sv_g3_*`, 20 / opiskeluvuosi). Sovellukseen 🇸🇪 Svenska -nappi, ruotsin kielitila (puhesynteesi sv-SE), å/ä/ö-lievennys virkkeissä (å/ä→a, ö→o), ruotsin apusanat täydennystehtävässä, numerosanat 0–20; ruotsi alkaa 4. luokalta kuten saksa. Sanojen vastauksissa å/ä/ö ja artikkeli (en/ett) vaaditaan täsmälleen. Kielioppi-harjoitus on toistaiseksi vain saksalle. Sanasto v17 (`en_1_9lk_v17.json`), `check_data.py` tarkistaa ruotsin kentät. 144 testiä, Artifact v37. **Fable-tarkistus odottaa käyttäjän komentoa:** 481 sanaa + 60 virkettä. **Ei pushattu** (käyttäjän ohje) - vain paikallinen commit.
   - Samassa vaiheessa projektin suunta päivitettiin: ks. luku "Visio: täysiverinen itseopiskeluohjelma".
38. **Ruotsin Fable-tarkistus + tietomalli v2 + tilajako (vaihe 38)** — ✅ Fable tarkisti käyttäjän komennosta ruotsin 481 sanaa (30 korjausta: ainesanat ilman artikkelia, väska / kasse, e-post, puuttuvat yleiset vaihtoehdot kuten idag/imorgon/igår, sockor, lycklig, hård; ei yhtään å/ä/ö- tai en/ett-virhettä) ja 60 virkettä (ei virheitä, 23 alt-täydennystä). Fablen havaitsemat englannin homonyymit suomen kehotteissa (kevät / jousi, kirja / varata, viivain / hallitsija, laskeutua / maa, jalka) korjattu kielikohtaisilla kehotteilla saksalle ja ruotsille. Uusi tietomalli v2 (ks. luku "Tietomalli v2"), sovellukseen `fiFor()`; sovelluksen toiminta muuten ennallaan (koulutila). Päätetty jakaa ohjelma koulutilaan ja aikuisen itseopiskelutilaan (ks. visio); `data/self.json` on ensimmäinen luonnos. Sanasto v18. 145 + 11 testiä (`tests/test_datamodel.py`), Artifact v38, vain paikallinen commit (ei pushia).

39. **Tilanvalinta ja ruotsin itseopiskelusanasto (vaihe 39)** — ✅ Sonnet: tilavalitsin 🏫 Peruskoulu / 🎓 Itseopiskelu (`studyMode`, `selfLevel`, `targetLang_self`); itseopiskelussa tasot A1/A2/B1 luokka-asteiden tilalla, aihepiirit teemojen tilalla, vain ruotsi, maskotti/Viikon sanat/koeteemat/virkkeet piilossa, "📊 Oma edistyminen" -raportti tasoittain ja aihepiireittäin, ruotsin taivutus palautteessa (esim. "bilen · bilar"). Peruskoulu ennallaan (ruotsi koulussa = sama sanasto kuin saksa). Opus (9 rinnakkaista agenttia): ruotsin itseopiskelusanasto 49 aikuisen aihepiiriin, 3601 riviä → yhdistetty 3119 käsitteeksi (A1 1153, A2 1009, B1 957), joista 2065 uutta, 684 olemassa olevalle käsitteelle uusi ruotsin muoto; kaikilla substantiiveilla, verbeillä ja adjektiiveilla taivutusmuodot; kehotteet yksiselitteisiä (11 törmäystä korjattu). `check_data.py` tarkistaa itseopiskelun ruotsin (kehotteet, muotoilu, taivutus). Sanasto v19, 160 + 13 testiä. **Fable-tarkistus odottaa käyttäjän komentoa.**

> Muistutussääntö: kun aloitatte uuden vaiheen, mainitkaa se — Claude tarkistaa suunnitelman ja muistuttaa, mikä malli kannattaa olla käytössä.

## Seuraavaksi käyttäjältä

1. **Push GitHubiin** — käyttäjä päätti vaiheessa 37, ettei pushata vielä; vaiheet 38–39 odottavat paikallisina committeina. Kun aika koittaa, aja koneellasi allekkain:

   ```powershell
   cd "G:\01 AI\05 Kieliohjelma"
   git push
   ```

   Jos tulee "rejected"-virhe, aja ensin:

   ```powershell
   cd "G:\01 AI\05 Kieliohjelma"
   git pull --rebase origin main
   git push
   ```

   Vaihtoehtoisesti Android Studion VCS-valikosta "Git > Push", jos GitHub-tili on siihen kirjautunut. Repo on tällä hetkellä GitHub on ajan tasalla vaiheeseen 23 asti (vaiheet 24–29 committoitu, odottavat pushia) (tarkistettu `git status`: up to date with origin/main).
2. **Saksan koe (värit, numerot 0–20):** harjoittelu sovelluksessa: 🇩🇪 Deutsch → 4. luokka → teema "Värit" tai "Numerot". Kerro, jos kokeessa on muitakin aihepiirejä, niin varmistetaan että ne ovat mukana.
2b. **Testaa virkeharjoittelu käytännössä (vaiheet 19–20):** toimiiko sanat/virkkeet-valitsin odotetusti, tuntuvatko kaikki neljä harjoitustyyppiä (kirjoita/täydennä/järjestä/kuuntele) mielekkäiltä ja sopivan vaikeilta omalle luokka-asteelle, toimiiko "kuuntele ja toista" -tyypin puheentunnistus riittävän luotettavasti lievällä osumalogiikalla. Kerro myös, tuntuuko sijoittelu (oma valitsin nykyisen valikkorivin alla) toimivalta, vai pitäisikö virkeharjoittelu sittemmin integroida osaksi luokka-aste/teema-rakennetta.
3. **Silmäile 120 englanninkielistä virkettä** (`SENTENCE_DATA.en` tiedostossa `index_template.html`) pedagogisen sopivuuden osalta — Fable on jo tarkistanut kieliasun, joten painopiste on siinä, sopivatko aiheet ja vaikeustaso omalle lapselle.
4. ~~**Päätä kaksi eheystarkistuksen esiin nostamaa monitulkintaisuutta sanastossa**~~ ✅ Ratkaistu vaiheessa 21 (tarkenteet kehotteeseen). 
5. **Testaa vaiheen 18 muutokset käytännössä:** avautuuko palkintoasteikko-modaali odotetusti tähtibadgea klikkaamalla, näkyvätkö tasomaskotit sopivan himmeinä taustalla häiritsemättä sanan/virkkeen lukemista.
6. **Käy läpi synonyymilista** (`synonyymit_tarkistettavaksi.md`, toimitettu erikseen) ja kerro, jos jokin 12 lisäyksestä pitää korjata, poistaa tai jos puuttuu jokin sana jonka koet monitulkintaiseksi.
7. **Testaa vaiheen 17 luokka-astejärjestelmä käytännössä:** näkyykö uusi luokka-astevalikko odotetusti, valikoituuko lapselle järkevä aloitusluokka-aste, toimiiko ristiin menevä täydennys kun oma luokka-aste alkaa loppua, ja tuntuuko luokka-asteen vaihtuminen (vihreä väri + automaattinen siirtymä) selkeältä.
8. **Silmäile vaiheen 17 uudet 138 sanaa** (luokat 5–6, `en_1_6lk_v7.json`) pedagogisen sopivuuden ja käännösten oikeellisuuden osalta — sekä englannin että saksan kentät.
9. Jatka lapsen kanssa testausta manuaalisella tilanvalinnalla (vaihe 14) ja tarkkaile pienten teemojen täydennystä.
10. Testaa saksan kielivalinta ja varmuuskopiointi (vie/tuo) käytännössä GitHub Pagesissa.
11. Jatka testausta lapsen kanssa ja kerro lisää havaintoja — korjataan niiden pohjalta.

## Muut ideoidut lisäominaisuudet (ei vielä priorisoitu)

- Vaikeustason nousu sanaston sisällä (esim. pidemmät/harvinaisemmat sanat vasta myöhemmin)
- Ääntämisen arviointi puheentunnistuksella
- Käsinkirjoituksen selkeyden palaute lapselle
- Aikuisen/opettajan näkymä edistymisen seurantaan
- Erillinen spaced repetition -aikataulutus (nykyinen painotus + harvakseltaan-kertaus on yksinkertaisempi, ei tarkkaan ajastettu)
- Monivalinta- tai yhdistelytehtävät
- Päivittäinen harjoitustavoite ja muistutus
- REVIEW_CHANCE-arvon (15 %) hienosäätö käyttökokemuksen perusteella
- Mahdollisesti kolme rinnakkaista tähtibadgea yhden vaihtuvan sijaan, jos lapsi ei huomaa/ymmärrä badgen automaattista vaihtumista
- Jos "Näytä sana" -nappia käytetään paljon myös tuttuihin sanoihin oikoreittinä: harkita rajoitusta käyttökertoihin per sana
- Jos lapsi kaipaa jotain motivaatiopalautetta liekkimittarin poiston jälkeen: harkita hienovaraisempaa tapaa juhlistaa peräkkäisiä oikeita vastauksia
- Yläkoulun (7.–9. lk) sanaston lisääminen samalla luokka-asteperiaatteella, kun alakoulun 1.–6. lk on testattu riittävästi
- Nykyinen "seuraava ylempi luokka-aste" -täydennyslogiikka voisi tulevaisuudessa laajentua useamman luokka-asteen yli (esim. jos 6. luokankin sanat joskus loppuvat), jos alakoulun jälkeen jatketaan samalla mallilla yläkouluun
- Sanaston täydentäminen virkkeissä usein esiintyvillä sanoilla, joita sanalistassa ei vielä ole (eheystarkistuksen top-30-lista `tests/data_report.txt`:ssä, esim. every, favourite, today, film, visit, home, fun, tomorrow)
- Virkeharjoitteluun (vaihe 19) mahdollisesti myöhemmin: pass/graduate-porrastus yhden kynnyksen sijaan, saksankieliset virkkeet, virkkeiden sijoittaminen osaksi luokka-aste/teema-valikkoa oman erillisen valitsimen sijaan, rajattu aktiivinen virkejoukko jos virkemäärä kasvaa paljon nykyistä suuremmaksi
