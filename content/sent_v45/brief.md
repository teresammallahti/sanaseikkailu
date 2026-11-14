# Tehtävä: ruotsin itseopiskelun virkkeet ja dialogit (suomenkielinen aikuinen oppija, riikinruotsi)

Kirjoitat harjoitusvirkkeitä ja lyhyitä dialogeja aihepiireittäin. Saat tiedoston, jossa on aihepiirit (id, CEFR-taso, nimi) ja kunkin yleisimpiä ohjelman sanoja. Käytä ensisijaisesti näitä sanoja; muiden sanojen pitää olla samaa tai helpompaa tasoa.

Jokaiselle aihepiirille:
1. **8 virkettä** (sentences). Taso: A1 lyhyitä (3–7 sanaa, preesens, perusrakenteet), A2 (5–10 sanaa, preteriti/perfekti, sivulause), B1 (8–14 sanaa, mielipiteet, sivulauseen sanajärjestys), B2 (10–18 sanaa, abstraktimpi, konditionaali, passiivi). Aikuisen arkeen ja aihepiiriin liittyviä, luontevia, ei lapsellisia.
2. **1 dialogi** (6–8 repliikkiä, puhujat A ja B), arkinen tilanne aihepiiristä (esim. asiointi, työpaikka, lääkärissä), tason mukainen.

Kirjoita kaksi TSV-tiedostoa (otsikkorivit mukaan):

sentences: `topic	level	sv	fi	alt`
- sv: mallivirke (iso alkukirjain, loppuvälimerkki). fi: luonteva suomennos, joka yksiselitteisesti ohjaa juuri tähän ruotsin virkkeeseen (oppija kääntää suomesta ruotsiksi; sovellus hyväksyy sv:n tai minkä tahansa alt-muodon, isot kirjaimet ja välimerkit eivät haittaa). alt: muut oikeat käännökset, jotka oppija todennäköisesti kirjoittaisi (vaihtoehtoinen sanajärjestys, yleinen synonyymi), erottimena " || "; tyhjä jos ei ole.

dialogues: `topic	level	title_fi	line	speaker	sv	fi`
- title_fi: dialogin otsikko suomeksi (sama kaikilla saman dialogin riveillä). line: 1, 2, 3 … speaker: A tai B.

Laatu: kieliopillisesti virheetön riikinruotsi (V2, sivulauseen adverbi, en/ett-taivutus), luonteva puhekielinen mutta huoliteltu sävy dialogeissa. Ei erisnimiä paitsi tavallisia etunimiä ja paikkoja (Stockholm, Helsingfors).

Kirjoita tiiviiseen apumuotoon Write-työkalulla ja muunna Pythonilla TSV:ksi; tarkista, että sarakemäärät ovat oikein (5 ja 7) ja jokaisella aihepiirillä on 8 virkettä ja yksi dialogi. Palauta lyhyt yhteenveto (määrät, epävarmat kohdat max 5).
