# Tehtävä: sanaston laajennus suomen yleisimmistä perusmuodoista (suomi → ruotsi, englanti, saksa)

Rakennat kieltenopiskeluohjelman (suomenkielinen oppija, kohdekielet ruotsi, englanti, saksa) sanakirjastoa. Saat listan suomen sanoja Kotimaisten kielten keskuksen nykysuomen sanalistasta, järjestettynä yleisyyden mukaan (zipf_fi = yleisyys, wordfreq). Ohjelmassa on jo noin 3700 käsitettä; nämä sanat eivät ole niiden suomenkielisissä kehotteissa.

Lue: /home/claude/k/lex40/topics_all.md (aihepiirit ja tasot A1–B2).

Jokaiselle listan sanalle päätä ensin, otetaanko se mukaan (keep=1) vai ei (keep=0):
- keep=0: taivutettu muoto tai pronominin/numeraalin muoto, joka ei ole perusmuoto (esim. "sen", "sitä", "kahden"); karkea tai halventava kieli; erisnimi; puhekielinen lyhenne tai murremuoto (mä, tää); hyvin erikoistunut sana, jota B2-tason oppija ei tarvitse; sana, jolle ei ole järkevää vastinetta. skip-sarakkeeseen lyhyt syy.
- keep=1: hyödyllinen perusmuoto (myös adverbit, partikkelit, konjunktiot ja postpositiot ovat hyödyllisiä, esim. "juuri", "välillä", "kai", "takia" – anna niille sopiva vastine ja tarkenne).

Kirjoita TSV (otsikkorivi mukaan), sarakkeet tässä järjestyksessä:
fi_lemma	keep	skip	fi	pos	level	topic	sv	sv_infl	en	en_infl	de	de_infl

- fi_lemma: annettu sana sellaisenaan.
- fi: oppijalle näytettävä suomenkielinen kehote. Ensimmäinen " / "-vaihtoehto näytetään; muut ovat hyväksyttyjä synonyymejä vastattaessa suomeksi. Lisää sulkutarkenne, jos sana on monimerkityksinen ja valitset yhden merkityksen (esim. "kuusi (puu)", "juuri (äsken)"). Jos sanalla on kaksi yhtä tärkeää merkitystä, tee kaksi riviä samalla fi_lemma-arvolla, eri tarkenteilla.
- pos: n, v, adj, adv, pron, prep, conj, num, interj, phrase.
- level: A1, A2, B1 tai B2 (CEFR-taso, jolla oppija sanan tyypillisesti tarvitsee).
- topic: yksi aihepiirin id topics_all.md:stä, jonka taso = level (B2-sanoille b2_*).
- sv / en / de: hyväksytyt vastaukset " / " eroteltuna (ensimmäinen = päämuoto; vaihtoehto vain, jos yleinen ja vastaa kehotetta).
  - ruotsi: substantiivi epämääräisen artikkelin kanssa ("en bil", "ett hus"), ainesanat ja monikkosanat ilman; verbit ilman "att".
  - englanti: substantiivi ilman artikkelia ("car"), verbi ilman "to", brittienglanti.
  - saksa: substantiivi määräisen artikkelin kanssa ("der Hund", "die Katze", "das Haus"); verbit infinitiivissä.
- *_infl: taivutus muodossa avain=arvo;avain=arvo (vain ensimmäiselle vaihtoehdolle):
  - sv: substantiivi def=bilen;pl=bilar (pl=- jos ei monikkoa); verbi pres=skriver;pret=skrev;sup=skrivit; adjektiivi neut=stort;apl=stora.
  - en: substantiivi pl=children; verbi past=went;pp=gone; muille tyhjä.
  - de: substantiivi pl=die Hunde (pl=- jos ei monikkoa); verbi pres3=fährt;pret=fuhr;pp=ist gefahren (apuverbi mukaan); muille tyhjä.
- keep=0-riveillä vain fi_lemma, keep ja skip; muut sarakkeet tyhjiä.

Laatu: oikeinkirjoitus, suku (en/ett, der/die/das), epäsäännölliset muodot tarkasti. Riikinruotsi, brittienglanti, saksan yleiskieli. Ei kaksoiskappaleita omassa tiedostossasi.

Kirjoita tiedosto tiiviiseen apumuotoon Write-työkalulla ja muunna se Pythonilla TSV:ksi (Write voi poistaa rivien lopun tyhjät tabit); tarkista lopuksi Pythonilla, että jokaisella rivillä on 13 saraketta ja keep on 0 tai 1. Palauta lyhyt yhteenveto: rivimäärä, keep=1/keep=0, tasojakauma, epävarmat kohdat (max 8).
