# Tehtävä: englannin ja saksan muodot olemassa oleville käsitteille

Kieltenopiskeluohjelmassa on ruotsin itseopiskelusanasto (A1–B1, Fable-tarkistettu). Nyt samoille käsitteille tarvitaan englanti ja saksa taivutuksineen. Tiedoston sarakkeet: id, fi (oppijalle näytettävä suomenkielinen kehote; ensimmäinen " / "-vaihtoehto näytetään), sv (ruotsin vastine, apuna merkityksen tarkentamiseen), pos, en_nykyinen (jo olemassa oleva englannin muoto, tarkistettu), en_viite (karkea englanninkielinen viite, ei tarkistettu), de_nykyinen (olemassa oleva saksan muoto, tarkistettu), de_pl_nykyinen.

Kirjoita TSV (otsikkorivi mukaan): id	en	en_infl	de	de_infl

- en: jos en_nykyinen on annettu, kopioi se sellaisenaan. Muuten kirjoita englannin vastine, joka vastaa fi-kehotetta ja sv-sanaa: hyväksytyt vastaukset " / " eroteltuna, substantiivit ilman artikkelia, verbit ilman "to", fraasit kokonaisina ilman loppupistettä, brittienglanti.
- de: jos de_nykyinen on annettu, kopioi se sellaisenaan. Muuten saksan vastine: substantiivit määräisen artikkelin kanssa (der/die/das), ainesanat ja monikkosanat samoin artikkelilla (das Wasser, die Eltern), verbit infinitiivissä, fraasit kokonaisina.
- en_infl / de_infl: avain=arvo;avain=arvo ensimmäiselle vaihtoehdolle.
  - en: substantiivi pl=…; verbi past=…;pp=…; muuten tyhjä.
  - de: substantiivi pl=die … (pl=- jos ei monikkoa; jos de_pl_nykyinen annettu, käytä sitä); verbi pres3=…;pret=…;pp=hat/ist … (apuverbi mukaan); muuten tyhjä.
- Jokaiselle syöterivillä olevalle id:lle täsmälleen yksi rivi, samassa järjestyksessä.

Laatu: vastineen pitää vastata suomen kehotetta (ei englannin homonyymiä); suku ja epäsäännölliset muodot tarkasti. Kirjoita tiedosto tiiviiseen apumuotoon Write-työkalulla ja muunna Pythonilla TSV:ksi; tarkista Pythonilla, että rivimäärä = syöterivit, id:t samat ja jokaisella rivillä 5 saraketta. Palauta lyhyt yhteenveto (rivimäärä, epävarmat kohdat max 8).
