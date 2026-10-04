# Sanaseikkailun regressiotestit

Testit ajavat oikean `index.html`:n inline-skriptin Noden `vm`-kontekstissa feikatulla selainympäristöllä (ei npm-riippuvuuksia, vain Node 22:n omat moduulit).

## Ajaminen

```
cd "G:\01 AI\05 Kieliohjelma"   (tai mikä tahansa repon kopio)
python3 build.py          # rakentaa index.html:n templatesta
node tests/test_app.js    # kaikki testit; exit-koodi 1 jos jokin epäonnistuu
node tests/test_app.js Virke   # vain testit, joiden nimessä on "Virke"
```

Vaihtoehtoinen HTML: `SANA_HTML=/polku/tiedosto.html node tests/test_app.js`.

## Tiedostot

- `harness.js` - `loadApp(options)`: feikattu DOM, localStorage, IndexedDB (`put` laukaisee `oncomplete`n asynkronisesti), puhesynteesi, siemennetty `Math.random`. Palauttaa `{ ctx, run, elements, db, storage, flush, dispose, ... }`. Optiot: `localStorage`, `stats`, `random`/`seed`, `speechRecognition`.
- `check_data.py` - sanaston ja virkeaineiston eheystarkistus (`python3 tests/check_data.py`): id:t, puuttuvat kentät, luokka-asteet, välimerkit, saksan artikkelit (heuristinen), monitulkintaiset käännökset, virkkeiden pituus ja sanaston kattavuus luokittain. Viimeisin raportti: `data_report.txt`.
- `test_app.js` - testisarja. Testin nimen alkuliite `KNOWN BUG:` tekee epäonnistumisesta varoituksen (WARN), joka ei kaada ajoa.

## Katetut alueet

- Käynnistys: sana näkyviin, 6 luokka-asteen vaihtoehtoa, teemavalikko, frontier-luokan päättely tilastoista
- Kieli (en/de): vaihto, localStorage, erilliset `grade_en` / `grade_de`, lippupainikkeet, lausumiskieli
- Vastauksen tarkistus: isot/pienet kirjaimet, välimerkit, "/"-vaihtoehdot, sulkutarkenteet, numerot sanoiksi (puhe), puheen lauseensisäinen vastaus
- `recordResult`: näppäimistö-, puhe- ja kynäputket (kynässä suunnat erikseen)
- Vaihekynnykset (kynä 1/3, näppäimistö 3/5, puhe 4/6), `isFullyLearned`, `tierState`
- Luokka-asteet: `wordsForGrade`, harrasteteemat pois, `isGradeComplete`, `detectFrontierGrade`, `maybeAdvanceGrade`
- Aktiivinen pooli: koko 10-15, täydennys samalta luokalta, graduoitujen poisto, täydennys muiden luokka-asteiden yli (ylemmät ensin, sitten alemmat; vaihe 20)
- Tähtimodaali ja -badge, "Näytä sana" -painike
- Virkeharjoittelu: aineiston eheys, tilanvaihto sanat/virkkeet, tehtävätyypit write/blank/reorder/listen, `recordSentenceResult` (4 oikein = opittu), armollinen vertailu (lyhenteet, US/GB-kirjoitusasu, alt-muodot ja vaihtoehtoinen sanajärjestys), ei sukupuolettomia "hän"-kehotteita
- Varmuuskopio: vienti, tuonti, virheelliset tiedostot, vienti-tuonti-kierto

## Rajoitukset

- Feikattu DOM ei laske asettelua eikä CSS:ää; kynäpiirto ja oikea puheentunnistus eivät ole katettuina.
- Sovelluksen ajastimet (`setTimeout`) ovat aitoja; kutsu `app.dispose()` testin lopuksi.
