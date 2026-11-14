# Fable-tarkistus: monikielinen sanakirjasto (suomenkielinen oppija; ruotsi, englanti, saksa; CEFR A1–B2)

Tarkistat erän kieltenopiskeluohjelman sanastoa. Luonnokset on tehnyt toinen malli. Sarakkeet: id, taso, aihepiiri, pos (n/v/adj/adv/pron/prep/conj/num/interj/phrase), fi, sv_text, sv_infl, en_text, en_infl, de_text, de_infl.

Miten ohjelma käyttää kenttiä:
- fi: suomenkielinen kehote; ensimmäinen " / "-vaihtoehto näytetään, muut ovat hyväksyttyjä synonyymejä. Kehotteen pitää yksiselitteisesti osoittaa vastaukseen (sulkutarkenne tarvittaessa).
- *_text: hyväksytyt vastaukset " / " eroteltuna (ensimmäinen = päämuoto), oppijan pitää kirjoittaa jokin täsmälleen (isot kirjaimet ja loppuvälimerkit eivät haittaa). Ruotsi: substantiivit en/ett-artikkelilla, ainesanat/monikkosanat ilman, verbit ilman "att". Englanti: substantiivit ilman artikkelia, verbit ilman "to", brittienglanti. Saksa: substantiivit der/die/das-artikkelilla, verbit infinitiivissä.
- *_infl (avain=arvo;…, päämuodolle): sv def/pl/pres/pret/sup/neut/apl; en pl/past/pp; de pl ("die …")/pres3/pret/pp (apuverbin kanssa "hat …"/"ist …"). "-" tai puuttuva = ei muotoa.

Tarkista:
1. Vastineet: vastaavatko sv/en/de suomen kehotetta (ei englannin homonyymejä, oikea merkitys), oikeinkirjoitus, suku, luontevuus; puuttuuko hyvin yleinen vaihtoehto, jonka oppija todennäköisesti kirjoittaisi.
2. Taivutus: epäsäännölliset monikot ja verbit, saksan perfektin apuverbi, ruotsin neutri- ja määräiset muodot. Taivutuksen pitää koskea päämuotoa.
3. Kehote: harhaanjohtava tai puuttuva tarkenne.
4. Taso: siirrä vain selvästi väärällä tasolla oleva sana (kenttä "taso", arvo A1/A2/B1/B2).
5. Poista (field "delete") sanat, jotka ovat karkeita, halventavia, erisnimiä tai oppijalle hyödyttömiä.
Ohjeerän erityinen painotus kerrotaan tehtävässä.

Älä ehdota tyylimakuasioita. Kirjoita tulos JSON-listana annettuun polkuun: [{"id": "...", "field": "fi"|"sv_text"|"sv_infl"|"en_text"|"en_infl"|"de_text"|"de_infl"|"taso"|"delete", "old": "<nykyinen arvo>", "new": "<uusi arvo; *_infl kokonaisena avain=arvo;…-merkkijonona>", "reason": "<lyhyt syy suomeksi>"}]. Kopioi old täsmälleen tiedostosta. Tarkista lopuksi, että JSON on validia. Palauta lyhyt yhteenveto (korjaukset tyypeittäin, tärkeimmät havainnot max 8).
