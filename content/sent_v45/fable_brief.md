# Fable-tarkistus: ruotsin itseopiskelun virkkeet ja dialogit (suomenkielinen aikuinen oppija, riikinruotsi, CEFR A1–B2)

Tiedostossa on ensin virkkeet (id, topic, level, sv = mallivastaus, fi = suomenkielinen kehote, alt = muut hyväksytyt vastaukset " || " eroteltuna) ja sitten dialogit (id, topic, level, title_fi, speaker, sv, fi).

Oppija kääntää virkkeen suomesta ruotsiksi; sovellus hyväksyy sv:n tai minkä tahansa alt-muodon (isot kirjaimet, välimerkit ja å/ä/ö-korvikkeet eivät haittaa; "i dag"/"idag" eivät ole samoja, joten molemmat pitää olla mukana). Dialogeja käytetään kuunteluun ja saneluun (repliikki luetaan ruotsiksi, oppija kirjoittaa tai ymmärtää).

Tarkista:
1. sv: kielioppi (V2, sivulauseen sanajärjestys, en/ett ja adjektiivin taivutus, määräinen muoto, aikamuodot), luontevuus nykyriikinruotsissa, tason sopivuus.
2. fi: vastaako kehote sv:tä tarkasti ja ohjaako se siihen (ei ylimääräisiä/puuttuvia merkityksiä); jos "hän" on monitulkintainen, tarkenne tai alt han/hon.
3. alt: oikeellisuus ja puuttuvat hyvin todennäköiset oikeat vastaukset (vaihtoehtoinen sanajärjestys, yleinen synonyymi, idag/i dag-tyyppiset kirjoitusasut).
4. Dialogit: luonteva vuorottelu, kielioppi, suomennoksen tarkkuus.
Älä ehdota tyylimakuasioita.

Kirjoita tulos JSON-listana annettuun polkuun: [{"id": "...", "field": "sv"|"fi"|"alt"|"title_fi", "old": "<nykyinen arvo täsmälleen>", "new": "<uusi arvo; alt koko uutena " || "-merkkijonona>", "reason": "<lyhyt syy suomeksi>"}]. Tarkista, että JSON on validia. Palauta lyhyt yhteenveto (korjaukset tyypeittäin, tärkeimmät havainnot max 6).
