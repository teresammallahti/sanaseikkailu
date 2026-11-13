# Fable-tarkistus: ruotsin itseopiskelusanasto (suomi → ruotsi, aikuiset, CEFR A1–B1, riikinruotsi)

Tarkistat yhden erän aikuisen ruotsin itseopiskeluohjelman sanastosta. Sanaston on luonnostellut toinen malli; sinun tehtäväsi on löytää oikeat virheet ja korjata ne. Sarakkeet: id, topic, taso, pos (n/v/adj/adv/pron/prep/conj/num/interj/phrase), fi, sv, def, pl, pres, pret, sup, neut, apl.

Miten ohjelma käyttää kenttiä:
- fi: suomenkielinen kehote. Ensimmäinen " / "-vaihtoehto näytetään oppijalle, muut ovat hyväksyttyjä vastauksia ruotsi → suomi -suunnassa. Kehotteen pitää yksiselitteisesti osoittaa sv-sanaan (sulkutarkenne, jos tarpeen).
- sv: hyväksytyt vastaukset " / " eroteltuna; oppijan pitää kirjoittaa jokin niistä täsmälleen (isot kirjaimet ja loppuvälimerkit eivät haittaa). Substantiivit epämääräisen artikkelin kanssa (en bil, ett hus); ainesanat, kappaleena laskemattomat, monikkosanat ja urheilulajit ilman artikkelia. Verbit ilman "att".
- Taivutus näytetään palautteessa ja käytetään myöhemmin taivutusharjoituksessa: substantiivi def (määräinen yks.) ja pl (epämääräinen monikko; "-" tai tyhjä = ei monikkoa), verbi pres/pret/sup, adjektiivi neut (ett-muoto) ja apl (monikko/määräinen).

Tarkista:
1. sv-muodon oikeellisuus: oikeinkirjoitus, en/ett-suku, merkitys vastaa fi-kehotetta, luonteva nykyruotsi (ei vanhentuneita muotoja; suomenruotsalainen muoto vain vaihtoehtona, jos se on Suomessa yleinen).
2. Taivutusmuodot: erityisesti epäsäännölliset monikot ja verbit, -er/-or/-ar-monikot, sup-muodot, adjektiivien neutri (esim. gravid, rädd), määräiset muodot. Jos sanalla on kaksi yleistä muotoa, valitse yleisempi (taivutuskentissä vain yksi muoto).
3. Kehote: puuttuuko tarkenne, onko kehote harhaanjohtava, puuttuuko hyvin yleinen ruotsin vaihtoehto, jonka oppija todennäköisesti kirjoittaisi.
4. Taso: siirrä sana vain, jos se on selvästi väärällä tasolla (esim. B1-sana A1:ssä), kertomalla uusi topic (toinen aihepiiri samassa erässä tai muu aihepiirin id: a1_*, a2_*, b1_* kuten tiedostossa näkyy).
5. Lapsille tarkoitetut tai aikuiselle tarpeettomat sanat: ehdota poistoa (field "delete").

Älä ehdota tyylimakuasioita. Kirjoita tulos JSON-listana tiedostoon (polku annettu): [{"id": "...", "field": "sv"|"fi"|"def"|"pl"|"pres"|"pret"|"sup"|"neut"|"apl"|"topic"|"delete", "old": "<nykyinen arvo>", "new": "<uusi arvo>", "reason": "<lyhyt syy suomeksi>"}]. "delete": old = sv, new = "". Tarkista lopuksi, että tiedosto on validia JSONia. Palauta lyhyt yhteenveto: korjausten määrä tyypeittäin ja tärkeimmät havainnot (max 8).
