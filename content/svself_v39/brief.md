# Tehtävä: ruotsin itseopiskelusanasto aikuiselle (suomi → ruotsi)

Rakennat osan suomenkielisen aikuisen ruotsin itseopiskeluohjelman sanastosta (CEFR A1–B1, riikinruotsi). Sanasto on ohjelman ydin, joten tavoite on mahdollisimman täydellinen ja käyttökelpoinen sanasto annetuille aihepiireille: yleisimmät ja hyödyllisimmät sanat ja kiinteät ilmaukset aikuisen arjessa, työssä ja yhteiskunnassa, oikealla tasolla.

Lue ensin:
- /home/claude/k/svself/topics.md: kaikki 49 aihepiiriä tasoineen ja rajauksineen (näet, mikä kuuluu muille aihepiireille ja tasoille; älä vie niiden sanoja).
- /home/claude/k/svself/existing.tsv: ohjelmassa jo olevat käsitteet (id, fi, en, sv, koulun_teema). Monet ovat lapsille tehtyjä, mutta jos sama merkitys sopii aihepiiriisi, KÄYTÄ SEN id:tä (ei uutta riviä ilman id:tä). Jos olemassa olevalla käsitteellä ei ole sv-muotoa, annat sen.

Kirjoita tulos TSV-tiedostoon (polku annettu alla), sarakkeet tässä järjestyksessä, otsikkorivi mukaan:
topic	id	fi	sv	pos	en	pl	def	pres	pret	sup	neut	apl

Sarakkeet:
- topic: aihepiirin id (vain sinulle annetut).
- id: olemassa olevan käsitteen id existing.tsv:stä, jos merkitys on sama; muuten tyhjä.
- fi: suomenkielinen kehote, jonka oppija näkee. Ensimmäinen " / "-vaihtoehto näytetään kehotteena, muut ovat hyväksyttyjä suomen synonyymejä (ruotsi → suomi -suunta). Kehotteen täytyy yksiselitteisesti osoittaa ruotsin sana: jos sama suomen sana kuuluu kahdelle ruotsin sanalle, lisää sulkuihin tarkenne, esim. "kuusi (luku)", "kuusi (puu)", "laittaa (pystyyn)". Verbit A-infinitiivissä, substantiivit yksikön perusmuodossa.
- sv: hyväksytyt vastaukset " / " eroteltuna (ensimmäinen = päämuoto). Substantiivit epämääräisen artikkelin kanssa: "en bil", "ett hus". Ainesanat, abstraktit kappaleena laskemattomat (vatten, mjölk, information), monikkosanat (byxor, pengar) ja urheilulajit ilman artikkelia. Verbit perusmuodossa ilman "att" (refleksiivit "känna sig", partikkeliverbit "tycka om"). Fraasit kokonaisina ilman loppupistettä. Vaihtoehto vain, jos se on yleinen ja vastaa kehotetta.
- pos: n, v, adj, adv, pron, prep, conj, num, interj, phrase.
- en: englanninkielinen vastine (yksi päämuoto; käytetään myöhemmin englannin versioon).
- pl: substantiivin epämääräinen monikko (bilar, hus, äpplen); "-" jos ei monikkoa; muille sanaluokille tyhjä.
- def: substantiivin määräinen yksikkö (bilen, huset).
- pres, pret, sup: verbin preesens, preteriti, supiini (skriver, skrev, skrivit); fraasiverbeissä taivutetaan verbiosa (tycker om, tyckte om, tyckt om).
- neut, apl: adjektiivin ett-muoto ja monikko/määräinen (stort, stora); taipumattomille sama muoto.

Laatu:
- Määrä per aihepiiri noin topics.md:n tavoitteen verran (±20 %); priorisoi yleisyys ja hyödyllisyys aikuiselle.
- Taso: A1-aihepiireissä vain A1-sanastoa, A2-aihepiireissä ei A1-perussanoja (ne on jo A1:ssä), B1:ssä ei A1/A2-perussanoja.
- Ei kaksoiskappaleita omassa tiedostossasi. Sama sana voi kuulua vain yhteen aihepiiriin.
- Oikeinkirjoitus (å/ä/ö), en/ett-suku ja taivutusmuodot tarkkaan oikein; tarkista epäsäännölliset verbit ja monikot.
- Ei lapsille tarkoitettua sanastoa (lelut, pelit, sadut).

Kun valmis, palauta lyhyt yhteenveto: rivimäärä per aihepiiri, montako olemassa olevaa id:tä käytit, ja epävarmat kohdat (max 10).
