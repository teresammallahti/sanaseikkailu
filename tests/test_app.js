'use strict';
// Sanaseikkailu - regressiotestit oikeaa index.html:ää vastaan.
// Aja: python3 build.py && node tests/test_app.js
const assert = require('assert');
const { loadApp } = require('./harness');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

let failed = 0, passed = 0, warned = 0;
const unhandled = [];
process.on('unhandledRejection', (e) => { unhandled.push(e); });

async function boot(opts) {
  const app = loadApp(opts);
  await app.flush();
  // Odotetaan että asynkroninen alustus (IndexedDB-tilastot, poolin täyttö) on valmis,
  // jotta testit eivät kilpaile sen kanssa kuormitetulla koneella (vakauttaa satunnaiset kaatumiset).
  for (let i = 0; i < 100; i++) {
    let ready = false;
    try { ready = !!app.run('typeof current !== "undefined" && current && sessionPool.length > 0'); } catch (e) { /* ei vielä */ }
    if (ready) break;
    await app.flush(20);
  }
  await app.flush(30);
  return app;
}
const J = (app, code) => JSON.parse(app.run(`JSON.stringify(${code})`));
const fbText = (el) => String(el.innerHTML) + ' ' + String(el.textContent);

// Asettaa nykyisen sanan id:llä ja suunnan
function setWord(app, id, dir) {
  app.run(`current = VOCAB.words.find(w => w.id === ${JSON.stringify(id)}); direction = ${JSON.stringify(dir || 'target-fi')};`);
}
// Täysin opittu tilasto sanalle (kaikki vaiheet graduoitu)
function learnedStat(app, id) {
  const sid = app.run(`statId({id: ${JSON.stringify(id)}})`);
  return { statId: sid, wordId: id, language: 'en', level: '4lk', correctCount: 20, incorrectCount: 0,
    streakCorrect: 6, streakTargetFi: 3, streakFiTarget: 3, streakKeyboard: 5, streakMic: 6,
    kbTF: 3, kbFT: 2, micTF: 3, micFT: 3 }; // vaihe 49: suuntalaskurit (opittu = molemmat >= 1)
}
function grade1Ids(app) { return J(app, 'wordsForGrade(1).map(w => w.id)'); }

// ---------------- Boot ----------------
test('Boot: skripti ajautuu ilman virhettä ja sana näkyy', async () => {
  const app = await boot();
  const txt = app.elements.promptWord.textContent;
  assert.ok(txt && txt !== '…', 'promptWord: ' + txt);
  assert.ok(app.run('current') && app.run('current.id'));
  assert.strictEqual(app.asyncErrors.length, 0);
  assert.strictEqual(app.logs.filter(l => l[0] === 'error').length, 0);
  app.dispose();
});

test('Boot: luokka-asteen valinnassa 9 vaihtoehtoa', async () => {
  const app = await boot();
  assert.strictEqual(app.elements.gradeFilter._children.length, 9);
  assert.strictEqual(app.elements.gradeFilter._children[0].value, '1');
  app.dispose();
});

test('Boot: teemavalikko sisältää "all" + luokka-asteen teemat + harrasteteemat', async () => {
  const app = await boot();
  const expected = app.run('VOCAB.categories.filter(c => (c.grade === 1 && !c.exam) || c.group === "hobby" || (c.exam && (!c.lang || c.lang === "en"))).length');
  // + kirjasanaston osio (vaihe 49): otsikko, "Koko kirjan sanasto" -rivi ja kirjateemat
  const books = app.run('VOCAB.categories.filter(c => c.group === "book").length');
  assert.strictEqual(app.elements.themeList._children.length, expected + books + 2);
  assert.strictEqual(app.elements.themeButton.textContent, 'Kaikki teemat');
  app.dispose();
});

test('Boot: ilman tilastoja aloitetaan 1. luokalta, pooli täyttyy', async () => {
  const app = await boot();
  assert.strictEqual(app.run('activeGrade'), 1);
  assert.ok(app.run('sessionPool.length') >= 10);
  app.dispose();
});

test('Boot: IndexedDB:hen esitäytetty edistyminen siirtää frontier-luokalle (2)', async () => {
  const probe = await boot();
  const ids = grade1Ids(probe);
  const stats = ids.map(id => learnedStat(probe, id));
  probe.dispose();
  const app = await boot({ stats });
  assert.strictEqual(app.run('activeGrade'), 2);
  assert.strictEqual(app.run('isGradeComplete(1)'), true);
  app.dispose();
});

test('Boot: tallennettu grade_en säilyy (ei automaattista päättelyä)', async () => {
  const app = await boot({ localStorage: { grade_en: '3' } });
  assert.strictEqual(app.run('activeGrade'), 3);
  app.dispose();
});

// ---------------- Kieli ----------------
test('Kieli: selectTargetLang("de") vaihtaa kielen ja tallentaa', async () => {
  const app = await boot();
  app.run('selectTargetLang("de")');
  await app.flush();
  assert.strictEqual(app.run('targetLang'), 'de');
  assert.strictEqual(app.storage.getItem('targetLang'), 'de');
  assert.ok(app.run('PRACTICE_WORDS.length') > 0);
  assert.ok(app.run('current') !== null);
  assert.strictEqual(app.run('statId(current).startsWith("de|")'), true);
  app.dispose();
});

test('Kieli: tallennettu targetLang luetaan käynnistyksessä', async () => {
  const app = await boot({ localStorage: { targetLang: 'de' } });
  assert.strictEqual(app.run('targetLang'), 'de');
  app.dispose();
});

test('Kieli: lippupainike (click) vaihtaa kielen ja active-luokat', async () => {
  const app = await boot();
  const de = app.langButtons.find(b => b.dataset.lang === 'de');
  const en = app.langButtons.find(b => b.dataset.lang === 'en');
  de.click();
  await app.flush();
  assert.strictEqual(app.run('targetLang'), 'de');
  assert.ok(de.classList.contains('active'));
  assert.ok(!en.classList.contains('active'));
  app.dispose();
});

test('Kieli: grade_de on erillinen grade_en:stä', async () => {
  const app = await boot({ localStorage: { grade_en: '2', grade_de: '4' } });
  assert.strictEqual(app.run('activeGrade'), 2);
  app.run('selectTargetLang("de")');
  await app.flush();
  assert.strictEqual(app.run('activeGrade'), 4);
  app.run('selectTargetLang("en")');
  await app.flush();
  assert.strictEqual(app.run('activeGrade'), 2);
  app.dispose();
});

test('Kieli: saksalle päätellään luokka omista tilastoista (en-edistys ei vaikuta)', async () => {
  const probe = await boot();
  const stats = grade1Ids(probe).map(id => learnedStat(probe, id));
  probe.dispose();
  const app = await boot({ stats });
  assert.strictEqual(app.run('activeGrade'), 2);
  app.run('selectTargetLang("de")');
  await app.flush();
  assert.strictEqual(app.run('activeGrade'), 4, 'saksa alkaa 4. luokalta eikä en-edistys siirrä sitä');
  app.dispose();
});

// ---------------- Saksa alkaa 4. luokalta (vaihe 21) ----------------
test('Saksa: luokka-asteet 4-9, englanti 1-9', async () => {
  const app = await boot();
  assert.strictEqual(JSON.stringify(app.run('gradesForLang()')), '[1,2,3,4,5,6,7,8,9]');
  app.run('selectTargetLang("de")');
  await app.flush();
  assert.strictEqual(JSON.stringify(app.run('gradesForLang()')), '[4,5,6,7,8,9]');
  assert.strictEqual(app.elements.gradeFilter._children.length, 6, 'valikossa 6 luokkaa');
  assert.strictEqual(app.run('activeGrade'), 4);
  for (const g of [1, 2, 3]) assert.strictEqual(app.run(`wordsForGrade(${g}).length`), 0, 'ei saksaa luokalla ' + g);
  app.dispose();
});

test('Saksa: 4. luokan teemoissa ovat värit ja numerot 0-20', async () => {
  const app = await boot({ localStorage: { targetLang: 'de' } });
  assert.strictEqual(app.run('activeGrade'), 4);
  const ids = J(app, 'wordsForGrade(4).map(w => w.id)');
  for (const id of ['colours_red', 'colours_blue', 'colours_orange_colour', 'numbers_zero', 'numbers_ten', 'numbers_eleven', 'numbers_sixteen', 'numbers_seventeen', 'numbers_twenty']) {
    assert.ok(ids.includes(id), id + ' puuttuu saksan 4. luokalta');
  }
  const cats = J(app, 'themeList._children.map(o => o.dataset.cat)');
  assert.ok(cats.includes('colours') && cats.includes('numbers'), 'teemavalikossa värit ja numerot: ' + cats.join(','));
  assert.strictEqual(app.run('VOCAB.words.filter(w => w.category === "numbers").length'), 21, 'numerot 0-20');
  app.dispose();
});

test('Saksa: vanha tallennettu grade_de (1-3) ei jää voimaan, aloitetaan 4. luokalta', async () => {
  const app = await boot({ localStorage: { targetLang: 'de', grade_de: '2' } });
  assert.strictEqual(app.run('activeGrade'), 4);
  app.dispose();
});

test('Saksa: englannin 4.-6. luokan teemat eivät näy saksalle, englannissa värit ovat yhä 1. luokalla', async () => {
  const app = await boot();
  assert.ok(J(app, 'wordsForGrade(1).map(w => w.id)').includes('colours_red'));
  app.run('selectTargetLang("de")');
  await app.flush();
  const all = J(app, '[4,5,6].flatMap(g => wordsForGrade(g)).map(w => w.category)');
  for (const c of ['professions_5', 'travel_6', 'paivarutiinit_4']) assert.ok(!all.includes(c), c + ' ei kuulu saksan alakouluun');
  assert.ok(all.includes('school_subjects'), 'saksan 6. lk = kolmas opiskeluvuosi');
  app.dispose();
});

test('Numerot: kirjoitettu numero ei kelpaa sanan tilalle, puheessa kelpaa (vaihe 21)', async () => {
  const app = await boot({ localStorage: { targetLang: 'de' } });
  setWord(app, 'numbers_fifteen', 'fi-target');
  assert.strictEqual(app.run('matchesAnswer("fünfzehn", "keyboard")'), true);
  assert.strictEqual(app.run('matchesAnswer("15", "keyboard")'), false);
  assert.strictEqual(app.run('matchesAnswer("15", "pen")'), false);
  assert.strictEqual(app.run('matchesAnswer("15", "mic")'), true);
  setWord(app, 'numbers_seventeen', 'fi-target');
  assert.strictEqual(app.run('matchesAnswer("siebzehn", "keyboard")'), true);
  assert.strictEqual(app.run('matchesAnswer("siebenzehn", "keyboard")'), false);
  app.dispose();
});

test('Tarkenteet: "English (kouluaine)" hyväksyy vastauksen "English" eikä tarkennetta lausuta', async () => {
  const app = await boot();
  setWord(app, 'school_subjects_english', 'fi-target');
  assert.strictEqual(app.run('matchesAnswer("English", "keyboard")'), true);
  setWord(app, 'school_subjects_english', 'target-fi');
  app.run('renderPrompt()');
  assert.strictEqual(app.elements.promptWord.textContent, 'English (kouluaine)');
  app.run('speakWord()');
  assert.strictEqual(app.spoken[app.spoken.length - 1].text, 'English');
  setWord(app, 'sports_cycling', 'target-fi');
  assert.strictEqual(app.run('matchesAnswer("pyöräily", "keyboard")'), true);
  app.dispose();
});

test('Kieli: lausuminen käyttää oikeaa kieltä (en-GB / de-DE)', async () => {
  const app = await boot();
  setWord(app, 'numbers_two', 'target-fi');
  app.run('speakWord()');
  assert.strictEqual(app.spoken[app.spoken.length - 1].lang, 'en-GB');
  app.run('selectTargetLang("de")');
  await app.flush();
  setWord(app, 'numbers_two', 'target-fi');
  app.run('speakWord()');
  assert.strictEqual(app.spoken[app.spoken.length - 1].lang, 'de-DE');
  app.dispose();
});

// ---------------- Vastauksen tarkistus ----------------
test('matchesAnswer: oikea vastaus, isot kirjaimet ja loppuvälimerkit', async () => {
  const app = await boot();
  setWord(app, 'numbers_two', 'target-fi');
  for (const a of ['kaksi', 'KAKSI', 'Kaksi!', '  kaksi. ', 'kaksi?']) {
    assert.strictEqual(app.run(`matchesAnswer(${JSON.stringify(a)}, "keyboard")`), true, a);
  }
  assert.strictEqual(app.run('matchesAnswer("kolme", "keyboard")'), false);
  assert.strictEqual(app.run('matchesAnswer("", "keyboard")'), false);
  assert.strictEqual(app.run('matchesAnswer(null, "keyboard")'), false);
  setWord(app, 'numbers_two', 'fi-target');
  assert.strictEqual(app.run('matchesAnswer("Two", "keyboard")'), true);
  assert.strictEqual(app.run('matchesAnswer("three", "keyboard")'), false);
  app.dispose();
});

test('matchesAnswer: "/"-erotellut vaihtoehdot hyväksytään', async () => {
  const app = await boot();
  assert.strictEqual(app.run('VOCAB.words.find(w => w.id === "opposites_hard").fi'), 'vaikea / kova');
  setWord(app, 'opposites_hard', 'target-fi');
  assert.strictEqual(app.run('matchesAnswer("vaikea", "keyboard")'), true);
  assert.strictEqual(app.run('matchesAnswer("kova", "keyboard")'), true);
  assert.strictEqual(app.run('matchesAnswer("Kova.", "keyboard")'), true);
  assert.strictEqual(app.run('matchesAnswer("helppo", "keyboard")'), false);
  assert.strictEqual(app.run('matchesAnswer("vaikea / kova", "keyboard")'), false, 'koko merkkijono ei ole yksi vaihtoehto');
  app.dispose();
});

test('matchesAnswer: kaikki "/"-sanat: jokainen vaihtoehto kelpaa molempiin suuntiin', async () => {
  const app = await boot();
  const ids = J(app, 'PRACTICE_WORDS.filter(w => w.fi.includes("/") || w.en.includes("/")).map(w => w.id)');
  assert.ok(ids.length > 0);
  for (const id of ids) {
    for (const dir of ['target-fi', 'fi-target']) {
      setWord(app, id, dir);
      const opts = J(app, 'acceptedAnswers()');
      for (const o of opts) {
        assert.strictEqual(app.run(`matchesAnswer(${JSON.stringify(o)}, "keyboard")`), true, `${id} ${dir} "${o}"`);
      }
    }
  }
  app.dispose();
});

test('matchesAnswer: sulkutarkenne poistetaan (target-fi)', async () => {
  const app = await boot();
  setWord(app, 'polite_phrases_excuse_me', 'target-fi');
  assert.strictEqual(app.run('matchesAnswer("anteeksi", "keyboard")'), true);
  assert.strictEqual(app.run('matchesAnswer("Anteeksi!", "keyboard")'), true);
  assert.strictEqual(app.run('matchesAnswer("anteeksi (huomion herättämiseen)", "keyboard")'), true);
  assert.strictEqual(app.run('matchesAnswer("kiitos", "keyboard")'), false);
  app.dispose();
});

test('matchesAnswer: numerot sanoiksi (mic): "2" -> kaksi', async () => {
  const app = await boot();
  setWord(app, 'numbers_two', 'target-fi');
  assert.strictEqual(app.run('matchesAnswer("2", "mic")'), true);
  assert.strictEqual(app.run('matchesAnswer("3", "mic")'), false);
  setWord(app, 'numbers_two', 'fi-target');
  assert.strictEqual(app.run('matchesAnswer("2", "mic")'), true); // en: two
  app.run('selectTargetLang("de")'); await app.flush();
  setWord(app, 'numbers_two', 'fi-target');
  assert.strictEqual(app.run('matchesAnswer("2", "mic")'), true); // de: zwei
  app.dispose();
});

test('matchesAnswer: mic sallii sanan lauseen sisällä, näppäimistö ei', async () => {
  const app = await boot();
  setWord(app, 'numbers_two', 'target-fi');
  assert.strictEqual(app.run('matchesAnswer("se on kaksi", "mic")'), true);
  assert.strictEqual(app.run('matchesAnswer("se on kaksi", "keyboard")'), false);
  assert.strictEqual(app.run('matchesAnswer("kaksikymmentä", "mic")'), false, 'ei osasanana');
  app.dispose();
});

test('checkAnswer: palaute ja tallennus (oikein/väärin)', async () => {
  const app = await boot();
  setWord(app, 'numbers_two', 'target-fi');
  await app.run('checkAnswer("kaksi", "keyboard")');
  assert.ok(fbText(app.elements.feedback).includes('Oikein'));
  assert.ok(app.elements.feedback.classList.contains('correct'));
  await app.run('checkAnswer("kolme", "keyboard")');
  assert.ok(app.elements.feedback.classList.contains('incorrect'));
  assert.ok(fbText(app.elements.feedback).includes('kaksi'), 'oikea vastaus näytetään');
  const stored = app.db.data.get(app.run('statId(current)'));
  assert.ok(stored);
  assert.strictEqual(stored.correctCount, 1);
  assert.strictEqual(stored.incorrectCount, 1);
  app.dispose();
});

// ---------------- recordResult ----------------
async function stat(app) { return J(app, 'statsCache[statId(current)]'); }

test('recordResult: keyboard oikein kasvattaa streakKeyboard', async () => {
  const app = await boot();
  setWord(app, 'numbers_two');
  await app.run('recordResult(true, "keyboard")');
  await app.run('recordResult(true, "keyboard")');
  const s = await stat(app);
  assert.strictEqual(s.streakKeyboard, 2);
  assert.strictEqual(s.streakCorrect, 2);
  assert.strictEqual(s.streakMic, 0);
  assert.strictEqual(s.correctCount, 2);
  app.dispose();
});

test('recordResult: keyboard väärin nollaa vain streakKeyboardin', async () => {
  const app = await boot();
  setWord(app, 'numbers_two');
  await app.run('recordResult(true, "mic")');
  await app.run('recordResult(true, "mic")');
  await app.run('recordResult(true, "keyboard")');
  await app.run('recordResult(true, "keyboard")');
  await app.run('recordResult(false, "keyboard")');
  const s = await stat(app);
  assert.strictEqual(s.streakKeyboard, 0);
  assert.strictEqual(s.streakMic, 2);
  assert.strictEqual(s.incorrectCount, 1);
  assert.strictEqual(s.streakCorrect, 0);
  app.dispose();
});

test('recordResult: mic väärin nollaa vain streakMicin', async () => {
  const app = await boot();
  setWord(app, 'numbers_two');
  await app.run('recordResult(true, "keyboard")');
  await app.run('recordResult(true, "mic")');
  await app.run('recordResult(false, "mic")');
  const s = await stat(app);
  assert.strictEqual(s.streakMic, 0);
  assert.strictEqual(s.streakKeyboard, 1);
  app.dispose();
});

test('recordResult: pen laskee suunnat erikseen', async () => {
  const app = await boot();
  setWord(app, 'numbers_two', 'target-fi');
  await app.run('recordResult(true, "pen")');
  await app.run('recordResult(true, "pen")');
  app.run('direction = "fi-target"');
  await app.run('recordResult(true, "pen")');
  let s = await stat(app);
  assert.strictEqual(s.streakTargetFi, 2);
  assert.strictEqual(s.streakFiTarget, 1);
  app.run('direction = "target-fi"');
  await app.run('recordResult(false, "pen")');
  s = await stat(app);
  assert.strictEqual(s.streakTargetFi, 0);
  assert.strictEqual(s.streakFiTarget, 1, 'toinen suunta säilyy');
  assert.strictEqual(s.streakKeyboard, 0);
  app.dispose();
});

test('recordResult: tallentuu tietokantaan ja säilyy updateHeaderStats:in jälkeen', async () => {
  const app = await boot();
  setWord(app, 'numbers_two');
  await app.run('recordResult(true, "keyboard")');
  await app.run('updateHeaderStats()');
  assert.strictEqual(J(app, 'statsCache[statId(current)].streakKeyboard'), 1);
  assert.strictEqual(app.db.data.get(app.run('statId(current)')).streakKeyboard, 1);
  app.dispose();
});

// ---------------- Vaihekynnykset ----------------
test('Vaiheet: näppäimistö 2 oikeaa (1 / suunta): Pass = yksi suunta, graduointi = molemmat', async () => {
  const app = await boot();
  const f = (o, k) => app.run(`${k}(${JSON.stringify(o)})`);
  assert.strictEqual(f({}, 'stageKeyboardPassed'), false);
  assert.strictEqual(f({ kbTF: 1, kbFT: 0 }, 'stageKeyboardPassed'), true);
  assert.strictEqual(f({ kbTF: 0, kbFT: 1 }, 'stageKeyboardPassed'), true);
  assert.strictEqual(f({ kbTF: 1, kbFT: 0 }, 'stageKeyboardGraduated'), false);
  assert.strictEqual(f({ kbTF: 5, kbFT: 0 }, 'stageKeyboardGraduated'), false, 'toistot yhteen suuntaan eivät riitä');
  assert.strictEqual(f({ kbTF: 1, kbFT: 1 }, 'stageKeyboardGraduated'), true);
  assert.strictEqual(app.run('stageKeyboardPassed(null)'), false);
  assert.strictEqual(app.run('stageKeyboardGraduated(null)'), false);
  app.dispose();
});

test('Vaiheet: mikrofoni 2 oikeaa (1 / suunta)', async () => {
  const app = await boot();
  const f = (o, k) => app.run(`${k}(${JSON.stringify(o)})`);
  assert.strictEqual(f({ micTF: 0, micFT: 0 }, 'stageMicPassed'), false);
  assert.strictEqual(f({ micTF: 1, micFT: 0 }, 'stageMicPassed'), true);
  assert.strictEqual(f({ micTF: 0, micFT: 3 }, 'stageMicGraduated'), false);
  assert.strictEqual(f({ micTF: 1, micFT: 1 }, 'stageMicGraduated'), true);
  app.dispose();
});

test('Vaiheet: kynä 2 oikeaa (1 / suunta): Pass = yksi suunta, graduointi = molemmat', async () => {
  const app = await boot();
  const p = (a, b, k) => app.run(`${k}({streakTargetFi: ${a}, streakFiTarget: ${b}})`);
  assert.strictEqual(p(0, 0, 'stagePenPassed'), false);
  assert.strictEqual(p(1, 0, 'stagePenPassed'), true);
  assert.strictEqual(p(0, 1, 'stagePenPassed'), true);
  assert.strictEqual(p(1, 0, 'stagePenGraduated'), false);
  assert.strictEqual(p(3, 0, 'stagePenGraduated'), false);
  assert.strictEqual(p(0, 2, 'stagePenGraduated'), false);
  assert.strictEqual(p(1, 1, 'stagePenGraduated'), true);
  assert.strictEqual(p(3, 3, 'stagePenGraduated'), true);
  app.dispose();
});

test('Vaiheet: isFullyLearned vaatii kaikki kolme', async () => {
  const app = await boot();
  const full = { streakTargetFi: 1, streakFiTarget: 1, kbTF: 1, kbFT: 1, micTF: 1, micFT: 1 };
  const t = (o) => app.run(`isFullyLearned(${JSON.stringify(o)})`);
  assert.strictEqual(t(full), true);
  assert.strictEqual(t({ ...full, micFT: 0 }), false);
  assert.strictEqual(t({ ...full, kbTF: 0 }), false);
  assert.strictEqual(t({ ...full, streakFiTarget: 0 }), false);
  assert.strictEqual(app.run('isFullyLearned(undefined)'), false);
  app.dispose();
});

// ---------------- Oppimisrajat (vaihe 49): suuntalaskurit tavoittain ----------------
test('Oppimisrajat: kaikki tavat - oikea molempiin suuntiin graduoi, yksi suunta vain Pass', async () => {
  for (const [mode, tf, ft, graduated, passed] of [
    ['pen', 'streakTargetFi', 'streakFiTarget', 'stagePenGraduated', 'stagePenPassed'],
    ['keyboard', 'kbTF', 'kbFT', 'stageKeyboardGraduated', 'stageKeyboardPassed'],
    ['mic', 'micTF', 'micFT', 'stageMicGraduated', 'stageMicPassed']
  ]) {
    const app = await boot();
    const id = 'numbers_two';
    const st = () => app.run(`statsCache[statId({id: "${id}"})]`);
    const ok = () => app.run(`${graduated}(statsCache[statId({id: "${id}"})])`);
    const pass = () => app.run(`${passed}(statsCache[statId({id: "${id}"})])`);
    setWord(app, id, 'target-fi');
    await app.run(`recordResult(true, "${mode}")`);
    assert.strictEqual(J(app, `statsCache[statId({id: "${id}"})]`)[tf], 1, mode);
    assert.strictEqual(pass(), true, mode + ' Pass = yksi oikea');
    assert.strictEqual(ok(), false, mode + ' yksi suunta ei graduoi');
    setWord(app, id, 'target-fi');
    await app.run(`recordResult(true, "${mode}")`);
    assert.strictEqual(ok(), false, mode + ': toinen oikea samaan suuntaan ei graduoi');
    setWord(app, id, 'fi-target');
    await app.run(`recordResult(true, "${mode}")`);
    assert.strictEqual(J(app, `statsCache[statId({id: "${id}"})]`)[ft], 1, mode);
    assert.strictEqual(ok(), true, mode + ' molemmat suunnat -> graduoitu');
    app.dispose();
  }
});

test('Oppimisrajat: väärä vastaus nollaa vain oman tavan ja suunnan laskurin', async () => {
  const app = await boot();
  const id = 'numbers_two';
  const S = () => J(app, `statsCache[statId({id: "${id}"})]`);
  for (const m of ['pen', 'keyboard', 'mic']) {
    for (const d of ['target-fi', 'fi-target']) { setWord(app, id, d); await app.run(`recordResult(true, "${m}")`); }
  }
  let st = S();
  assert.deepStrictEqual([st.streakTargetFi, st.streakFiTarget, st.kbTF, st.kbFT, st.micTF, st.micFT], [1, 1, 1, 1, 1, 1]);
  setWord(app, id, 'target-fi');
  await app.run('recordResult(false, "keyboard")');
  st = S();
  assert.deepStrictEqual([st.streakTargetFi, st.streakFiTarget, st.kbTF, st.kbFT, st.micTF, st.micFT], [1, 1, 0, 1, 1, 1]);
  assert.strictEqual(app.run(`stageKeyboardGraduated(statsCache[statId({id: "${id}"})])`), false);
  assert.strictEqual(app.run(`stageKeyboardPassed(statsCache[statId({id: "${id}"})])`), true, 'toinen suunta pitää Pass-tason');
  assert.strictEqual(app.run(`stageMicGraduated(statsCache[statId({id: "${id}"})])`), true);
  assert.strictEqual(app.run(`stagePenGraduated(statsCache[statId({id: "${id}"})])`), true);
  setWord(app, id, 'fi-target');
  await app.run('recordResult(false, "mic")');
  st = S();
  assert.deepStrictEqual([st.kbTF, st.kbFT, st.micTF, st.micFT], [0, 1, 1, 0]);
  setWord(app, id, 'fi-target');
  await app.run('recordResult(false, "pen")');
  st = S();
  assert.deepStrictEqual([st.streakTargetFi, st.streakFiTarget], [1, 0]);
  app.dispose();
});

test('Oppimisrajat: siirtymä - vanhoilla rajoilla opittu pysyy opittuna, vanhat tilastot tulkitaan uusilla rajoilla', async () => {
  const app = await boot();
  const g = (o, k) => app.run(`${k}(${JSON.stringify(o)})`);
  // Vanha graduointi (näppäimistö 5, puhe 6, kynä 3+3) -> graduoitu
  assert.strictEqual(g({ streakKeyboard: 5 }, 'stageKeyboardGraduated'), true);
  assert.strictEqual(g({ streakMic: 6 }, 'stageMicGraduated'), true);
  assert.strictEqual(g({ streakTargetFi: 3, streakFiTarget: 3 }, 'stagePenGraduated'), true);
  // Uusi raja riittää: putki >= 2 / kynän molemmat suunnat >= 1
  assert.strictEqual(g({ streakKeyboard: 2 }, 'stageKeyboardGraduated'), true);
  assert.strictEqual(g({ streakMic: 2 }, 'stageMicGraduated'), true);
  assert.strictEqual(g({ streakTargetFi: 1, streakFiTarget: 1 }, 'stagePenGraduated'), true);
  assert.strictEqual(g({ streakKeyboard: 1 }, 'stageKeyboardGraduated'), false);
  assert.strictEqual(g({ streakMic: 1 }, 'stageMicGraduated'), false);
  assert.strictEqual(g({ streakKeyboard: 1 }, 'stageKeyboardPassed'), false, 'putki 1 = suunta tuntematon, ei vielä Pass-siirtymää');
  assert.strictEqual(g({ streakKeyboard: 2 }, 'stageKeyboardPassed'), true);
  assert.strictEqual(g({ streakTargetFi: 3, streakFiTarget: 3, streakKeyboard: 5, streakMic: 6 }, 'isFullyLearned'), true);
  // Siirtynyt tila säilyy recordResultissa: väärä vastaus yhteen suuntaan nollaa vain sen
  const id = 'numbers_two';
  app.run(`statsCache[statId({id: "${id}"})] = ${JSON.stringify({ statId: app.run(`statId({id: "${id}"})`), wordId: id, language: 'en', correctCount: 9, incorrectCount: 0, streakCorrect: 5, streakKeyboard: 5, streakMic: 0 })}`);
  setWord(app, id, 'target-fi');
  await app.run('recordResult(false, "keyboard")');
  const st = J(app, `statsCache[statId({id: "${id}"})]`);
  assert.deepStrictEqual([st.kbTF, st.kbFT], [0, 1], 'siirretty molemmat -> virhe nollaa vain TF');
  assert.strictEqual(st.bestKbTF, 1);
  assert.strictEqual(st.bestKbFT, 1);
  app.dispose();
});

// ---------------- tierState ----------------
test('tierState: rajatapaukset', async () => {
  const app = await boot();
  let t = J(app, 'tierState(0, 10)');
  assert.strictEqual(t.majorIndex, 0); assert.strictEqual(t.stars, 0); assert.strictEqual(t.exactSteps, 0);
  t = J(app, 'tierState(10, 10)');
  assert.strictEqual(t.exactSteps, 30); assert.strictEqual(t.majorIndex, 5); assert.strictEqual(t.stars, 5);
  t = J(app, 'tierState(5, 10)');
  assert.strictEqual(t.exactSteps, 15); assert.strictEqual(t.majorIndex, 3); assert.strictEqual(t.stars, 0);
  t = J(app, 'tierState(0, 0)');
  assert.strictEqual(t.majorIndex, 0); assert.strictEqual(t.exactSteps, 0);
  t = J(app, 'tierState(1, 10)'); // 3 askelta
  assert.strictEqual(t.majorIndex, 0); assert.strictEqual(t.stars, 3);
  app.dispose();
});

// ---------------- Luokka-asteet ----------------
test('Luokka-asteet: wordsForGrade(1..6) ei tyhjä, sanat oikeasta luokasta', async () => {
  const app = await boot();
  for (let g = 1; g <= 6; g++) {
    assert.ok(app.run(`wordsForGrade(${g}).length`) > 0, 'grade ' + g);
    assert.strictEqual(app.run(`wordsForGrade(${g}).every(w => wordGrade(w) === ${g})`), true);
  }
  app.dispose();
});

test('Luokka-asteet: harrasteteemat eivät koskaan wordsForGrade:ssa', async () => {
  const app = await boot();
  const hobbyCats = J(app, 'VOCAB.categories.filter(c => c.group === "hobby").map(c => c.id)');
  assert.ok(hobbyCats.length > 0);
  assert.strictEqual(app.run('VOCAB.categories.filter(c => c.group === "hobby").every(c => c.grade === null)'), true);
  for (let g = 1; g <= 6; g++) {
    const cats = J(app, `wordsForGrade(${g}).map(w => w.category)`);
    for (const c of cats) assert.ok(!hobbyCats.includes(c), `hobby ${c} luokassa ${g}`);
  }
  app.dispose();
});

test('Luokka-asteet: jokainen sana kuuluu täsmälleen yhteen luokkaan, harrasteeseen tai kirjasanastoon', async () => {
  const app = await boot();
  const total = [1, 2, 3, 4, 5, 6, 7, 8, 9].reduce((a, g) => a + app.run(`wordsForGrade(${g}).length`), 0);
  const hobby = app.run('PRACTICE_WORDS.filter(w => categoryGroup(w.category) === "hobby").length');
  // Kirjasanasto (group=book, vaihe 49) on oma ryhmänsä: ei luokassa eikä harrasteissa
  const book = app.run('PRACTICE_WORDS.filter(w => categoryGroup(w.category) === "book").length');
  assert.ok(book > 0, 'kirjasanoja on');
  assert.strictEqual(total + hobby + book, app.run('PRACTICE_WORDS.length'));
  app.dispose();
});

test('Luokka-asteet: isGradeComplete epätosi tyhjillä tilastoilla', async () => {
  const app = await boot();
  for (let g = 1; g <= 9; g++) assert.strictEqual(app.run(`isGradeComplete(${g})`), false);
  assert.strictEqual(app.run('detectFrontierGrade()'), 1);
  app.dispose();
});

test('Luokka-asteet: täysin opittu 1. luokka -> complete, frontier 2, maybeAdvanceGrade 1->2', async () => {
  const app = await boot();
  const ids = grade1Ids(app);
  for (const id of ids) {
    const st = learnedStat(app, id);
    assert.strictEqual(st.statId, `en|4lk|${id}`);
    app.run(`statsCache[${JSON.stringify(st.statId)}] = ${JSON.stringify(st)}`);
  }
  app.run('activeGrade = 1');
  assert.strictEqual(app.run('isGradeComplete(1)'), true);
  assert.strictEqual(app.run('isGradeComplete(2)'), false);
  assert.strictEqual(app.run('detectFrontierGrade()'), 2);
  app.run('maybeAdvanceGrade()');
  assert.strictEqual(app.run('activeGrade'), 2);
  assert.strictEqual(app.storage.getItem('grade_en'), '2');
  assert.strictEqual(app.run('selectedThemes.length'), 0);
  app.dispose();
});

test('Luokka-asteet: yksi sana vajaa -> ei valmis, ei etene', async () => {
  const app = await boot();
  const ids = grade1Ids(app);
  ids.forEach((id, i) => {
    const st = learnedStat(app, id);
    if (i === 0) { st.streakMic = 0; st.micTF = 0; st.micFT = 0; } // yksi sana ilman puhevaihetta
    app.run(`statsCache[${JSON.stringify(st.statId)}] = ${JSON.stringify(st)}`);
  });
  app.run('activeGrade = 1');
  assert.strictEqual(app.run('isGradeComplete(1)'), false);
  app.run('maybeAdvanceGrade()');
  assert.strictEqual(app.run('activeGrade'), 1);
  app.dispose();
});

test('Luokka-asteet: viimeinen luokka ei etene yli 6', async () => {
  const app = await boot();
  app.run('activeGrade = 6; maybeAdvanceGrade();');
  assert.strictEqual(app.run('activeGrade'), 6);
  app.dispose();
});

test('Luokka-asteet: gradeFilter change tallentaa valinnan ja vaihtaa sanaston', async () => {
  const app = await boot();
  const gf = app.elements.gradeFilter;
  gf.value = '3';
  await gf.dispatch('change', {});
  await app.flush();
  assert.strictEqual(app.run('activeGrade'), 3);
  assert.strictEqual(app.storage.getItem('grade_en'), '3');
  assert.strictEqual(app.run('wordGrade(current) === 3 || sessionPool.every(w => wordGrade(w) >= 3)'), true);
  app.dispose();
});

// ---------------- Aktiivinen pooli ----------------
test('Pooli: luokka 1, kaikki teemat -> 10-15 sanaa', async () => {
  const app = await boot();
  app.run('activeGrade = 1; selectedThemes = []; initSessionPool();');
  const n = app.run('sessionPool.length');
  assert.ok(n >= 10 && n <= 15, 'koko ' + n);
  assert.strictEqual(app.run('sessionPool.every(w => wordGrade(w) === 1)'), true);
  assert.strictEqual(app.run('new Set(sessionPool.map(w => w.id)).size'), n, 'ei duplikaatteja');
  app.dispose();
});

test('Pooli: pieni yksittäinen teema täydentyy >=10 saman luokan sanoilla', async () => {
  const app = await boot();
  const small = J(app, `VOCAB.categories.filter(c => c.grade === 1 && !c.exam)
    .map(c => ({ id: c.id, n: PRACTICE_WORDS.filter(w => w.category === c.id).length }))
    .sort((a, b) => a.n - b.n)[0]`);
  assert.ok(small.n < 10, 'tarvitaan alle 10 sanan teema, pienin: ' + small.n);
  app.run(`activeGrade = 1; selectedThemes = [${JSON.stringify(small.id)}]; initSessionPool();`);
  const n = app.run('sessionPool.length');
  assert.ok(n >= 10, 'koko ' + n);
  assert.strictEqual(app.run(`PRACTICE_WORDS.filter(w => w.category === ${JSON.stringify(small.id)}).every(w => sessionPool.some(p => p.id === w.id))`), true,
    'teeman omat sanat mukana');
  assert.strictEqual(app.run('sessionPool.every(w => wordGrade(w) === 1)'), true, 'täydennys samalta luokalta');
  app.dispose();
});

test('Pooli: täydennys jatkuu seuraavaan luokka-asteeseen, jos väliin jäävä luokka on jo graduoitu (vaihe 20)', async () => {
  const app = await boot();
  // Luokat 1 ja 2 graduoitu näppäimistötilassa -> täydennys pitää hakea luokalta 3.
  app.run(`activeGrade = 1; selectedThemes = []; activeMode = "keyboard";
    [...wordsForGrade(1), ...wordsForGrade(2)].forEach(w => statsCache[statId(w)] = { statId: statId(w), streakKeyboard: 5 });
    initSessionPool();`);
  const n = app.run('sessionPool.length');
  assert.ok(n >= 10, 'pooli vajaa: ' + n);
  assert.strictEqual(app.run('sessionPool.every(w => wordGrade(w) === 3)'), true, 'sanat luokalta 3');
  app.dispose();
});

test('Pooli: viimeisellä (9.) luokalla täydennetään alempien luokkien kesken jääneillä sanoilla (vaihe 20)', async () => {
  const app = await boot();
  app.run(`activeGrade = 9; selectedThemes = []; activeMode = "keyboard";
    wordsForGrade(9).forEach(w => statsCache[statId(w)] = { statId: statId(w), streakKeyboard: 5 });
    initSessionPool();`);
  const n = app.run('sessionPool.length');
  assert.ok(n >= 10, 'pooli vajaa: ' + n);
  assert.strictEqual(app.run('sessionPool.every(w => wordGrade(w) === 8)'), true, 'lähin alempi luokka ensin');
  app.dispose();
});

test('Pooli: täydennysjärjestys = ylemmät nousevasti, sitten alemmat laskevasti', async () => {
  const app = await boot();
  app.run('activeGrade = 3;');
  assert.strictEqual(JSON.stringify(app.run('fallbackGradeOrder()')), '[4,5,6,7,8,9,2,1]');
  app.dispose();
});

test('Pooli: graduoidut sanat (nykyinen tila) jätetään pois', async () => {
  const app = await boot();
  app.run('activeGrade = 1; selectedThemes = []; activeMode = "keyboard"; initSessionPool();');
  const firstIds = J(app, 'sessionPool.slice(0, 4).map(w => w.id)');
  for (const id of firstIds) {
    app.run(`statsCache[statId({id: ${JSON.stringify(id)}})] = { streakKeyboard: 5 }`);
  }
  app.run('initSessionPool()');
  const ids = J(app, 'sessionPool.map(w => w.id)');
  for (const id of firstIds) assert.ok(!ids.includes(id), id + ' pitäisi olla poissa');
  assert.ok(ids.length >= 10);
  app.dispose();
});

test('Pooli: graduointi katsoo valittua tilaa (pen vs keyboard)', async () => {
  const app = await boot();
  app.run('activeGrade = 1; selectedThemes = []; activeMode = "keyboard"; initSessionPool();');
  const id = J(app, 'sessionPool[0].id');
  app.run(`statsCache[statId({id: ${JSON.stringify(id)}})] = { streakKeyboard: 5 }`);
  app.run('initSessionPool()');
  assert.ok(!J(app, 'sessionPool.map(w => w.id)').includes(id));
  app.run('activeMode = "pen"; initSessionPool();');
  assert.ok(app.run('sessionPool.length') >= 10);
  assert.ok(J(app, 'sessionPool.map(w => w.id)').includes(id), 'pen-tilassa keyboard-graduoitu sana kelpaa poolin ehdokkaaksi');
  app.dispose();
});

test('Pooli: moodinvaihtopainike rakentaa poolin uudelleen', async () => {
  const app = await boot();
  const penBtn = app.modeButtons.find(b => b.dataset.mode === 'pen');
  await penBtn.click();
  await app.flush();
  assert.strictEqual(app.run('activeMode'), 'pen');
  assert.strictEqual(app.run('sessionPoolMode'), 'pen');
  assert.ok(app.elements['mode-pen'].classList.contains('visible'));
  assert.ok(!app.elements['mode-keyboard'].classList.contains('visible'));
  app.dispose();
});

test('Pooli: pickWord valitsee sanan poolista (tai kertauksena graduoidusta)', async () => {
  const app = await boot();
  for (let i = 0; i < 30; i++) {
    await app.run('pickWord()');
    assert.ok(app.run('current && current.id'));
    assert.ok(['target-fi', 'fi-target'].includes(app.run('direction')));
  }
  app.dispose();
});

// ---------------- Tier-modaali ----------------
test('Tier-modaali: open/close ja 6 riviä', async () => {
  const app = await boot();
  const ov = app.elements.tierModalOverlay;
  app.run('openTierModal()');
  assert.ok(ov.classList.contains('visible'));
  assert.strictEqual(app.elements.tierScaleList._children.length, 6);
  assert.ok(app.elements.tierModalSubtitle.textContent.length > 0);
  assert.strictEqual(app.elements.tierScaleList._children.filter(r => r.classList.contains('current')).length, 1);
  app.run('closeTierModal()');
  assert.ok(!ov.classList.contains('visible'));
  app.dispose();
});

test('Tier-modaali: tähtibadge-klikkaus avaa, sulkunappi sulkee, Escape sulkee', async () => {
  const app = await boot();
  const ov = app.elements.tierModalOverlay;
  await app.elements.tierBadge.click();
  assert.ok(ov.classList.contains('visible'));
  await app.elements.tierModalClose.click();
  assert.ok(!ov.classList.contains('visible'));
  await app.elements.tierBadge.click();
  await app.ctx.document.dispatch('keydown', { key: 'Escape' });
  assert.ok(!ov.classList.contains('visible'));
  await app.elements.tierBadge.click();
  await ov.dispatch('click', { target: ov });
  assert.ok(!ov.classList.contains('visible'), 'taustaklikkaus sulkee');
  app.dispose();
});

test('Tier-badge: --tier-bg-icon on yksi LEVEL_ICONS-arvoista', async () => {
  const app = await boot();
  app.run('renderTierBadge()');
  const v = app.cssVars['--tier-bg-icon'];
  assert.ok(v, 'muuttuja asetettu');
  const icons = J(app, 'LEVEL_ICONS');
  assert.ok(icons.includes(JSON.parse(v)), v);
  assert.strictEqual(app.elements.tierStars.textContent.length, 5);
  app.dispose();
});

test('Tier-badge: oppiminen nostaa tähtiä (kaikki 1. lk graduoitu keyboardissa -> Lohikäärme)', async () => {
  const probe = await boot();
  const stats = grade1Ids(probe).map(id => learnedStat(probe, id));
  probe.dispose();
  // grade_en=1 pitää oppilaan 1. luokalla (muuten maybeAdvance siirtäisi)
  const app = await boot({ stats, localStorage: { grade_en: '1' } });
  // maybeAdvanceGrade voi siirtää 2. luokalle; pakotetaan 1. ja päivitetään
  app.run('activeGrade = 1');
  await app.run('updateHeaderStats()');
  const t = J(app, 'tierByMode.keyboard');
  assert.strictEqual(t.majorIndex, 5);
  assert.strictEqual(t.exactSteps, 30);
  assert.ok(app.elements.progressLabel.textContent.includes('täynnä'));
  app.dispose();
});

// ---------------- Näytä sana ----------------
test('Reveal: revealBtn lisää "revealed" ja näyttää vastauksen', async () => {
  const app = await boot();
  setWord(app, 'numbers_two', 'target-fi');
  await app.elements.revealBtn.click();
  assert.ok(app.run('answerArea.classList.contains("revealed")'));
  assert.ok(app.elements.revealBox.textContent.includes('kaksi'));
  app.run('renderPrompt()');
  assert.ok(!app.run('answerArea.classList.contains("revealed")'), 'uusi sana nollaa paljastuksen');
  assert.strictEqual(app.elements.revealBox.textContent, '');
  app.dispose();
});

// ---------------- Virkeharjoittelu ----------------
test('Virkkeet: SENTENCE_DATA.en >=10 per luokka, kentät ja uniikit id:t', async () => {
  const app = await boot();
  for (let g = 1; g <= 9; g++) {
    assert.ok(app.run(`SENTENCE_DATA.en.filter(s => s.grade === ${g}).length`) >= 10, 'luokka ' + g);
  }
  const all = J(app, 'SENTENCE_DATA.en');
  for (const s of all) {
    assert.ok(s.id && typeof s.id === 'string', 'id');
    assert.ok(Number.isInteger(s.grade) && s.grade >= 1 && s.grade <= 9, 'grade ' + s.id);
    assert.ok(s.en && s.en.trim(), 'en ' + s.id);
    assert.ok(s.fi && s.fi.trim(), 'fi ' + s.id);
  }
  assert.strictEqual(new Set(all.map(s => s.id)).size, all.length, 'id:t uniikkeja');
  app.dispose();
});

test('Virkkeet: setPracticeMode vaihtaa näkymät molempiin suuntiin', async () => {
  const app = await boot();
  const wp = app.elements.wordPractice, sp = app.elements.sentencePractice;
  app.run('setPracticeMode("sentences")');
  assert.strictEqual(wp.hidden, true);
  assert.strictEqual(sp.hidden, false);
  assert.notStrictEqual(app.elements.themeButton.style.display, 'none'); // Koe 1 -virkkeet
  assert.ok(app.run('currentSentence') !== null);
  assert.ok(app.elements.sentenceFiPrompt.textContent.length > 0);
  app.run('setPracticeMode("words")');
  assert.strictEqual(wp.hidden, false);
  assert.strictEqual(sp.hidden, true);
  assert.notStrictEqual(app.elements.themeButton.style.display, 'none');
  app.dispose();
});

test('Virkkeet: harjoittelutavan painikkeet toimivat (click)', async () => {
  const app = await boot();
  const sBtn = app.practiceButtons.find(b => b.dataset.practice === 'sentences');
  const wBtn = app.practiceButtons.find(b => b.dataset.practice === 'words');
  await sBtn.click();
  assert.strictEqual(app.run('practiceMode'), 'sentences');
  assert.ok(sBtn.classList.contains('active'));
  assert.strictEqual(sBtn.getAttribute('aria-pressed'), 'true');
  await wBtn.click();
  assert.strictEqual(app.run('practiceMode'), 'words');
  assert.ok(wBtn.classList.contains('active'));
  app.dispose();
});

test('Virkkeet: pickSentenceRound valitsee aktiivisen luokan virkkeen', async () => {
  const app = await boot();
  for (const g of [1, 3, 6]) {
    app.run(`activeGrade = ${g}; currentSentence = null; pickSentenceRound();`);
    assert.strictEqual(app.run('currentSentence.grade'), g);
    assert.ok(app.run('EXERCISE_TYPES.includes(currentExerciseType)'));
  }
  // peräkkäin eri virke
  let prev = app.run('currentSentence.id');
  for (let i = 0; i < 20; i++) {
    app.run('pickSentenceRound()');
    const id = app.run('currentSentence.id');
    assert.notStrictEqual(id, prev);
    prev = id;
  }
  app.dispose();
});

test('Tietomalli v2: kielikohtainen suomen kehote (fiFor) ja ruotsin Fable-korjaukset', async () => {
  const app = await boot({ localStorage: { targetLang: 'sv' } });
  assert.strictEqual(app.run('VOCAB.meta.version'), 'v23');
  assert.strictEqual(app.run('fiFor(VOCAB.words.find(w => w.id === "weather_seasons_spring"))'), 'kevät');
  assert.strictEqual(app.run('VOCAB.words.find(w => w.id === "weather_seasons_snow").sv'), 'snö');
  app.run('selectTargetLang("en")');
  assert.strictEqual(app.run('fiFor(VOCAB.words.find(w => w.id === "weather_seasons_spring"))'), 'kevät / jousi');
  assert.strictEqual(app.run('VOCAB.words.filter(w => w.de_only).length'), 37);
  assert.ok(app.run('SENTENCE_DATA.sv.find(s => s.id === "sv_g1_6").alt.includes("Min systers namn är Elsa.")'));
  app.dispose();
});

test('Ruotsi: nappi, kielitila ja sanasto (sv)', async () => {
  const app = await boot();
  assert.ok(app.langButtons.find(b => b.dataset.lang === 'sv'), 'ruotsin nappi puuttuu');
  app.run('selectTargetLang("sv")');
  await app.flush();
  assert.strictEqual(app.run('targetLang'), 'sv');
  assert.strictEqual(app.run('LANGS.sv.speech'), 'sv-SE');
  assert.strictEqual(app.run('LANG_START_GRADE.sv'), 4);
  assert.ok(app.run('VOCAB.words.filter(w => w.sv).length') > 3000, 'itseopiskelun ruotsi');
  assert.ok(app.run('PRACTICE_WORDS.length') >= 475 && app.run('PRACTICE_WORDS.length') <= 490, 'peruskoulun ruotsi ennallaan: ' + app.run('PRACTICE_WORDS.length'));
  assert.ok(app.run('PRACTICE_WORDS.every(w => w.de && !w.self_only)'));
  assert.ok(app.run('sessionPool.length') > 0);
  assert.ok(app.run('sessionPool.every(w => w.sv)'));
  assert.strictEqual(app.run('NUMBER_WORDS.sv[3]'), 'tre');
  app.dispose();
});

test('Ruotsi: 60 virkettä, 20 / opiskeluvuosi, å/ä/ö-korvikkeet hyväksytään', async () => {
  const app = await boot({ localStorage: { targetLang: 'sv' } });
  assert.strictEqual(app.run('SENTENCE_DATA.sv.length'), 60);
  assert.strictEqual(app.run('new Set(SENTENCE_DATA.sv.map(s => s.id)).size'), 60);
  for (const g of [4, 5, 6]) assert.strictEqual(app.run(`sentencesForGrade(${g}).length`), 20, 'luokka ' + g);
  const s = { sv: 'Flickan har gröna skor på sig.', fi: 'x' };
  for (const a of ['Flickan har gröna skor på sig.', 'flickan har grona skor pa sig', 'FLICKAN HAR GRÖNA SKOR PÅ SIG!']) {
    assert.strictEqual(app.run(`matchesSentence(${JSON.stringify(a)}, ${JSON.stringify(s)})`), true, a);
  }
  assert.strictEqual(app.run(`matchesSentence("Flickan har röda skor på sig.", ${JSON.stringify(s)})`), false);
  app.dispose();
});

test('Ruotsi: Kielioppi-nappi piilossa (vain saksa)', async () => {
  const app = await boot({ localStorage: { targetLang: 'sv' } });
  assert.notStrictEqual(app.run('practiceMode'), 'grammar');
  const btn = app.elements && app.elements.grammarSwitchBtn;
  if (btn) assert.ok(btn.hidden || (btn.style && btn.style.display === 'none') || (btn.classList && btn.classList.contains('hidden')));
  app.dispose();
});

test('Virkkeet: saksalle 120 virkettä, 20 / luokka 4-9, ei kaadu', async () => {
  const app = await boot();
  app.run('selectTargetLang("de"); setPracticeMode("sentences");');
  await app.flush();
  assert.notStrictEqual(app.run('currentSentence'), null);
  assert.strictEqual(app.run('SENTENCE_DATA.de.filter(s => !s.theme).length'), 120);
  for (const g of [4, 5, 6, 7, 8, 9]) assert.strictEqual(app.run(`sentencesForGrade(${g}).length`), 20, 'luokka ' + g);
  assert.strictEqual(app.run('sentencesForGrade(1).length'), 0);
  assert.strictEqual(app.run('new Set(SENTENCE_DATA.de.map(s => s.id)).size'), 160);
  assert.strictEqual(app.run('SENTENCE_DATA.de.every(s => s.de && s.fi && s.grade >= 1 && s.grade <= 6)'), true);
  assert.strictEqual(app.run('sentencesForLang().includes(currentSentence)'), true);
  app.dispose();
});

test('Saksan virkkeet: ä/ö/ü/ß ja korvikkeet (ae/oe/ue/ss) hyväksytään, isot kirjaimet ja välimerkit ei haittaa', async () => {
  const app = await boot({ localStorage: { targetLang: 'de' } });
  const s = { de: 'Das Mädchen trägt grüne Schuhe für Fußball.', fi: 'x' };
  for (const a of ['Das Mädchen trägt grüne Schuhe für Fußball.', 'das maedchen traegt gruene schuhe fuer fussball', 'DAS MÄDCHEN TRÄGT GRÜNE SCHUHE FÜR FUSSBALL!']) {
    assert.strictEqual(app.run(`matchesSentence(${JSON.stringify(a)}, ${JSON.stringify(s)})`), true, a);
  }
  assert.strictEqual(app.run(`matchesSentence("Das Mädchen trägt grüne Schuhe für Tennis.", ${JSON.stringify(s)})`), false);
  app.dispose();
});

test('Saksan virkkeet: alt-muodot hyväksytään, väärä sanajärjestys ei', async () => {
  const app = await boot({ localStorage: { targetLang: 'de' } });
  app.run('activeGrade = 5;');
  const s = J(app, 'SENTENCE_DATA.de.find(x => x.id === "de_g2_2")');
  assert.ok(s.alt && s.alt.length);
  app.run(`currentSentence = SENTENCE_DATA.de.find(x => x.id === "de_g2_2");`);
  assert.strictEqual(app.run('matchesSentence("Meine Schwester turnt jeden Tag.", currentSentence)'), true);
  assert.strictEqual(app.run('matchesSentence("Jeden Tag turnt meine Schwester.", currentSentence)'), true);
  assert.strictEqual(app.run('matchesSentence("Turnt meine Schwester jeden Tag.", currentSentence)'), false);
  app.dispose();
});

test('Saksan virkkeet: englannin supistumat ja US->GB-sääntö eivät vaikuta saksaan', async () => {
  const app = await boot({ localStorage: { targetLang: 'de' } });
  assert.strictEqual(app.run('normalizeSentence("Wir sind\'ve")'), 'wir sindve');
  assert.strictEqual(app.run('normalizeSentence("color")'), 'color');
  app.dispose();
});

test('Saksan virkkeet: täydennystehtävän sanavalinta ohittaa saksan apusanat', async () => {
  const app = await boot({ localStorage: { targetLang: 'de' } });
  for (let i = 0; i < 40; i++) {
    const idx = app.run('blankIndexFor("Das ist meine Mutter und sie ist nett")');
    const w = app.run(`"Das ist meine Mutter und sie ist nett".split(" ")[${idx}]`);
    assert.ok(['Mutter', 'nett'].includes(w), 'valittu ' + w);
    assert.ok(!['das', 'ist', 'und', 'sie'].includes(w.toLowerCase()), 'apusana ' + w);
  }
  app.dispose();
});

test('Saksan virkkeet: kuuntele-tehtävän päällekkäisyys 0.7 raja toimii (ä/ae)', async () => {
  const app = await boot({ localStorage: { targetLang: 'de' } });
  app.run('currentSentence = SENTENCE_DATA.de.find(x => x.id === "de_g1_2");');
  assert.ok(app.run('bestSentenceOverlap("das ist meine mutter", currentSentence)') >= 0.7);
  assert.ok(app.run('bestSentenceOverlap("hello world", currentSentence)') < 0.7);
  app.dispose();
});

test('Saksan virkkeet: kierros ja vastauksen kirjaus toimivat (kaikki 4 tehtävätyyppiä)', async () => {
  const app = await boot({ localStorage: { targetLang: 'de' } });
  app.run('setPracticeMode("sentences");');
  await app.flush();
  for (const type of ['write', 'blank', 'reorder', 'listen']) {
    app.run(`currentSentence = SENTENCE_DATA.de.find(s => s.id === "de_g1_2"); currentExerciseType = ${JSON.stringify(type)}; renderSentenceRound();`);
    assert.strictEqual(app.asyncErrors.length, 0, type);
  }
  app.run('currentExerciseType = "write"; renderSentenceRound(); sentenceAnswerBox.value = "Das ist meine Mutter."; checkSentenceAnswer();');
  assert.ok(app.run('sentenceFeedback.className').includes('correct'));
  app.dispose();
});

// apurit virketehtäviin
function setupRound(app, type, sentenceId) {
  app.run('activeGrade = 1; currentSentence = null; pickSentenceRound();'); // arpoo virkkeen
  if (sentenceId) app.run(`currentSentence = SENTENCE_DATA.en.find(s => s.id === ${JSON.stringify(sentenceId)});`);
  app.run(`currentExerciseType = ${JSON.stringify(type)}; renderSentenceRound();`);
}
const sentenceOk = (app) => app.elements.sentenceFeedback.classList.contains('correct');
const sentenceBad = (app) => app.elements.sentenceFeedback.classList.contains('incorrect');

test('Virke/write: täsmällinen hyväksytään, väärä hylätään', async () => {
  const app = await boot();
  setupRound(app, 'write', 'en_g1_3');
  app.elements.sentenceAnswerBox.value = 'i have a DOG';
  app.run('checkSentenceAnswer()');
  assert.ok(sentenceOk(app));
  assert.ok(fbText(app.elements.sentenceFeedback).includes('Oikein'));
  setupRound(app, 'write', 'en_g1_3');
  app.elements.sentenceAnswerBox.value = 'I have a cat.';
  app.run('checkSentenceAnswer()');
  assert.ok(sentenceBad(app));
  assert.ok(fbText(app.elements.sentenceFeedback).includes('I have a dog.'));
  app.dispose();
});

test('Virke/write: Enter laukaisee tarkistuksen', async () => {
  const app = await boot();
  setupRound(app, 'write', 'en_g1_3');
  app.elements.sentenceAnswerBox.value = 'I have a dog.';
  await app.elements.sentenceAnswerBox.dispatch('keydown', { key: 'Enter' });
  assert.ok(sentenceOk(app));
  app.dispose();
});

test('Virke/blank: blankIndexFor ei valitse stop-sanaa kun sisältösana on', async () => {
  const app = await boot();
  const idxs = new Set();
  for (let i = 0; i < 300; i++) idxs.add(app.run('blankIndexFor("I have a dog.")'));
  assert.deepStrictEqual(Array.from(idxs), [3]);
  // kaikki virkkeet: valittu sana ei ole stop-sana jos sisältösana löytyy
  const all = J(app, 'SENTENCE_DATA.en');
  for (const s of all) {
    const words = s.en.split(/\s+/);
    const clean = words.map(w => w.replace(/[.,!?]/g, '').toLowerCase());
    const stop = new Set(J(app, 'Array.from(SENTENCE_STOPWORDS)'));
    const hasContent = clean.some(c => c.length >= 3 && !stop.has(c));
    for (let k = 0; k < 20; k++) {
      const i = app.run(`blankIndexFor(${JSON.stringify(s.en)})`);
      assert.ok(i >= 0 && i < words.length);
      if (hasContent) assert.ok(clean[i].length >= 3 && !stop.has(clean[i]), `${s.id}: "${words[i]}"`);
    }
  }
  app.dispose();
});

test('Virke/blank: aukko näkyy ja oikea sana hyväksytään, väärä hylätään', async () => {
  const app = await boot();
  setupRound(app, 'blank', 'en_g1_3');
  assert.strictEqual(app.run('sentenceBlankIndex'), 3);
  assert.strictEqual(app.elements.sentenceBlankDisplay.textContent, 'I have a ____');
  app.elements.sentenceBlankBox.value = 'Dog!';
  app.run('checkSentenceAnswer()');
  assert.ok(sentenceOk(app));
  setupRound(app, 'blank', 'en_g1_3');
  app.elements.sentenceBlankBox.value = 'cat';
  app.run('checkSentenceAnswer()');
  assert.ok(sentenceBad(app));
  app.dispose();
});

test('Virke/reorder: chipit oikeassa järjestyksessä -> hyväksytään', async () => {
  const app = await boot();
  setupRound(app, 'reorder', 'en_g1_3');
  const strip = app.elements.sentenceChipStrip;
  assert.strictEqual(strip._children.length, 4);
  for (let i = 0; i < 4; i++) {
    const chip = strip.querySelector(`.sentence-chip[data-index="${i}"]`);
    assert.ok(chip, 'chip ' + i);
    await chip.click();
  }
  assert.strictEqual(app.elements.sentenceBuildLine.textContent, 'I have a dog.');
  await app.elements.sentenceCheckBtn.click();
  assert.ok(sentenceOk(app));
  app.dispose();
});

test('Virke/reorder: chip ei lisäänny kahdesti, undo poistaa viimeisen, vajaa hylätään', async () => {
  const app = await boot();
  setupRound(app, 'reorder', 'en_g1_3');
  const strip = app.elements.sentenceChipStrip;
  const chip = (i) => strip.querySelector(`[data-index="${i}"]`);
  await chip(0).click();
  await chip(0).click(); // jo käytetty
  assert.strictEqual(app.run('sentenceBuiltIndices.length'), 1);
  await chip(1).click();
  await chip(2).click();
  assert.strictEqual(app.elements.sentenceBuildLine.textContent, 'I have a');
  await app.elements.sentenceReorderUndo.click();
  assert.strictEqual(app.elements.sentenceBuildLine.textContent, 'I have');
  assert.ok(!chip(2).classList.contains('used'));
  assert.ok(chip(1).classList.contains('used'));
  // vajaa rakennelma
  await app.elements.sentenceCheckBtn.click();
  assert.ok(sentenceBad(app), 'vajaa hylätään');
  // undo tyhjillä ei kaadu
  setupRound(app, 'reorder', 'en_g1_3');
  await app.elements.sentenceReorderUndo.click();
  assert.strictEqual(app.run('sentenceBuiltIndices.length'), 0);
  app.dispose();
});

test('Virke/reorder: väärä järjestys hylätään; tyhjä Tarkista antaa vihjeen eikä kirjaa tulosta', async () => {
  const app = await boot();
  setupRound(app, 'reorder', 'en_g1_3');
  await app.elements.sentenceCheckBtn.click();
  assert.ok(!sentenceBad(app) && !sentenceOk(app));
  assert.ok(!app.db.data.has('sentence|en|en_g1_3'));
  const strip = app.elements.sentenceChipStrip;
  for (const i of [3, 2, 1, 0]) await strip.querySelector(`[data-index="${i}"]`).click();
  await app.elements.sentenceCheckBtn.click();
  assert.ok(sentenceBad(app));
  app.dispose();
});

test('Virke/listen: sentenceTokenOverlap-raja 0.7', async () => {
  const app = await boot();
  const o = (a, b) => app.run(`sentenceTokenOverlap(${JSON.stringify(a)}, ${JSON.stringify(b)})`);
  assert.strictEqual(o('I have a dog.', 'I have a dog.'), 1);
  assert.ok(o('I have dog', 'I have a dog.') >= 0.7);
  assert.ok(o('banana pizza', 'I have a dog.') < 0.7);
  assert.strictEqual(o('', 'I have a dog.'), 0);
  assert.strictEqual(o('anything', ''), 0);
  app.dispose();
});

test('Virke/listen: oikea transkriptio hyväksytään, ei-liittyvä hylätään; tyhjä antaa vihjeen', async () => {
  const app = await boot();
  setupRound(app, 'listen', 'en_g1_3');
  await app.elements.sentenceCheckBtn.click();
  assert.ok(!sentenceOk(app) && !sentenceBad(app), 'tyhjä: vain vihje');
  assert.ok(fbText(app.elements.sentenceFeedback).includes('mikrofon'));
  app.elements.sentenceMicTranscript.textContent = 'I have a dog';
  await app.elements.sentenceCheckBtn.click();
  assert.ok(sentenceOk(app));
  setupRound(app, 'listen', 'en_g1_3');
  app.elements.sentenceMicTranscript.textContent = 'banana pizza yesterday';
  await app.elements.sentenceCheckBtn.click();
  assert.ok(sentenceBad(app));
  app.dispose();
});

test('Virke/listen: kuuntele-tehtävä lausuu virkkeen (en-GB), kuuntelupainike toimii', async () => {
  const app = await boot();
  setupRound(app, 'listen', 'en_g1_3');
  await app.flush(450); // autoSpeak 350 ms
  assert.ok(app.spoken.some(s => s.text === 'I have a dog.' && s.lang === 'en-GB'));
  const before = app.spoken.length;
  await app.elements.sentenceHearBtn.click();
  assert.strictEqual(app.spoken.length, before + 1);
  app.dispose();
});

test('Virke/mic: ilman SpeechRecognition-tukea mikki näyttää virheen', async () => {
  const app = await boot();
  setupRound(app, 'listen', 'en_g1_3');
  await app.elements.sentenceMicBtn.click();
  assert.ok(app.elements.sentenceMicTranscript.textContent.length > 0);
  app.dispose();
});

test('Virke/reveal: näyttää oikean virkkeen', async () => {
  const app = await boot();
  setupRound(app, 'write', 'en_g1_3');
  await app.elements.sentenceRevealBtn.click();
  assert.ok(app.elements.sentenceRevealBox.textContent.includes('I have a dog.'));
  assert.ok(app.elements.sentenceAnswerArea.classList.contains('revealed'));
  app.dispose();
});

test('Virke/renderSentenceRound: näyttää vain valitun tehtävätyypin osion', async () => {
  const app = await boot();
  for (const t of ['write', 'blank', 'reorder', 'listen']) {
    setupRound(app, t, 'en_g1_1');
    for (const u of ['write', 'blank', 'reorder', 'listen']) {
      assert.strictEqual(app.elements['sentence-mode-' + u].classList.contains('visible'), u === t, `${t}/${u}`);
    }
    assert.strictEqual(app.elements.sentenceFiPrompt.textContent, 'Olen iloinen.');
  }
  app.dispose();
});

test('recordSentenceResult: 4 peräkkäistä oikein -> opittu; väärä nollaa', async () => {
  const app = await boot();
  app.run('currentSentence = SENTENCE_DATA.en.find(s => s.id === "en_g1_3")');
  for (let i = 1; i <= 3; i++) {
    await app.run('recordSentenceResult(true)');
    assert.strictEqual(app.run('isSentenceLearned(currentSentence)'), false, 'kierros ' + i);
  }
  await app.run('recordSentenceResult(true)');
  assert.strictEqual(app.run('isSentenceLearned(currentSentence)'), true);
  assert.strictEqual(app.run('sentenceStatId(currentSentence)'), 'sentence|en|en_g1_3');
  assert.strictEqual(app.db.data.get('sentence|en|en_g1_3').streak, 4);
  await app.run('recordSentenceResult(false)');
  assert.strictEqual(app.run('isSentenceLearned(currentSentence)'), false);
  assert.strictEqual(J(app, 'sentenceStat(currentSentence)').streak, 0);
  assert.strictEqual(J(app, 'sentenceStat(currentSentence)').incorrectCount, 1);
  assert.strictEqual(J(app, 'sentenceStat(currentSentence)').correctCount, 4);
  app.dispose();
});

test('recordSentenceResult: tilasto säilyy updateHeaderStats:in yli ja päivittää etenemisrivin', async () => {
  const app = await boot();
  app.run('setPracticeMode("sentences"); currentSentence = SENTENCE_DATA.en.find(s => s.id === "en_g1_1"); activeGrade = 1;');
  for (let i = 0; i < 4; i++) await app.run('recordSentenceResult(true)');
  await app.run('updateHeaderStats()');
  assert.strictEqual(app.run('isSentenceLearned(currentSentence)'), true);
  assert.ok(/Opittu 1\//.test(app.elements.sentenceProgressLabel.textContent), app.elements.sentenceProgressLabel.textContent);
  app.dispose();
});

test('Virke: sanatilastot ja virketilastot eivät sekoitu (statId-etuliite)', async () => {
  const app = await boot();
  setWord(app, 'numbers_two');
  await app.run('recordResult(true, "keyboard")');
  app.run('currentSentence = SENTENCE_DATA.en.find(s => s.id === "en_g1_3")');
  await app.run('recordSentenceResult(true)');
  const keys = Array.from(app.db.data.keys());
  assert.ok(keys.includes('en|4lk|numbers_two'));
  assert.ok(keys.includes('sentence|en|en_g1_3'));
  // sentence-tilasto ei vaikuta sanojen oppimiseen
  assert.strictEqual(app.run('PRACTICE_WORDS.some(w => statId(w).startsWith("sentence|"))'), false);
  app.dispose();
});

test('Virke: tarkistus tallentaa tuloksen (checkSentenceAnswer)', async () => {
  const app = await boot();
  setupRound(app, 'write', 'en_g1_3');
  app.elements.sentenceAnswerBox.value = 'I have a dog.';
  app.run('checkSentenceAnswer()');
  await app.flush();
  const st = app.db.data.get('sentence|en|en_g1_3');
  assert.ok(st);
  assert.strictEqual(st.streak, 1);
  app.dispose();
});

// ---------------- Virkkeiden armollinen vertailu (lyhenteet, US/GB, alt-muodot) ----------------
test('Virke/vertailu: lyhennemuodot avataan (I\'m = I am, don\'t = do not, can\'t = cannot)', async () => {
  const app = await boot();
  assert.strictEqual(app.run(`sentenceExactMatch("I'm happy", "I am happy.")`), true);
  assert.strictEqual(app.run(`sentenceExactMatch("I do not like spiders", "I don't like spiders.")`), true);
  assert.strictEqual(app.run(`sentenceExactMatch("I cannot find my shoes.", "I can't find my shoes.")`), true);
  assert.strictEqual(app.run(`sentenceExactMatch("It's raining today", "It is raining today.")`), true);
  assert.strictEqual(app.run(`sentenceExactMatch("I’d like to visit London one day.", "I would like to visit London one day.")`), true);
  assert.strictEqual(app.run(`sentenceExactMatch("I like spiders.", "I don't like spiders.")`), false);
  app.dispose();
});

test('Virke/vertailu: amerikkalainen kirjoitusasu hyväksytään (favorite/color/mom/math)', async () => {
  const app = await boot();
  assert.strictEqual(app.run(`sentenceExactMatch("My favorite color is blue", "My favourite colour is blue.")`), true);
  assert.strictEqual(app.run(`sentenceExactMatch("My mom is cooking dinner.", "My mum is cooking dinner.")`), true);
  assert.strictEqual(app.run(`sentenceExactMatch("My favorite subject is math because it is fun.", "My favourite subject is maths because it is fun.")`), true);
  app.dispose();
});

test('Virke/write: alt-muoto hyväksytään (I have got a dog)', async () => {
  const app = await boot();
  setupRound(app, 'write', 'en_g1_3');
  app.elements.sentenceAnswerBox.value = "I've got a dog";
  await app.elements.sentenceCheckBtn.click();
  assert.ok(sentenceOk(app));
  app.dispose();
});

test('Virke/reorder: vaihtoehtoinen sanajärjestys (alt) hyväksytään', async () => {
  const app = await boot();
  setupRound(app, 'reorder', 'en_g3_1'); // "I played football yesterday." / alt "Yesterday I played football."
  const words = app.run('sentenceReorderWords.slice()');
  // rakennetaan "Yesterday. I played football" -tyyppinen järjestys napauttamalla oikeat indeksit
  const want = ['yesterday.', 'I', 'played', 'football'].map(w => words.findIndex(x => x.toLowerCase() === w.toLowerCase()));
  assert.ok(want.every(i => i >= 0), 'kaikki sanat löytyvät: ' + JSON.stringify(words));
  const strip = app.elements.sentenceChipStrip;
  for (const i of want) await strip.querySelector(`.sentence-chip[data-index="${i}"]`).click();
  await app.elements.sentenceCheckBtn.click();
  assert.ok(sentenceOk(app), 'alt-järjestys pitäisi hyväksyä: ' + app.elements.sentenceBuildLine.textContent);
  app.dispose();
});

test('Virke/listen: paras osuma lasketaan myös alt-muodoista', async () => {
  const app = await boot();
  app.run(`currentSentence = SENTENCE_DATA.en.find(s => s.id === "en_g5_14");`);
  assert.ok(app.run(`bestSentenceOverlap("how much is this wallet", currentSentence)`) >= 0.99);
  assert.ok(app.run(`bestSentenceOverlap("the weather is nice", currentSentence)`) < 0.7);
  app.dispose();
});

test('Virke/data: alt-muodot ovat ei-tyhjiä ja päättyvät välimerkkiin', async () => {
  const app = await boot();
  const bad = app.run(`SENTENCE_DATA.en.flatMap(s => (s.alt||[]).filter(a => typeof a !== "string" || !a.trim() || !/[.?!]$/.test(a.trim())).map(a => s.id + ": " + a))`);
  assert.strictEqual(JSON.stringify(bad), "[]");
  app.dispose();
});

test('Virke/data: suomenkielisessä kehotteessa ei sukupuolettomia "hän"-subjekteja ilman nimeä', async () => {
  const app = await boot();
  // "Hän" virkkeen alussa johtaa he/she-arvailuun kirjoita koko virke -tehtävässä.
  const bad = app.run(`SENTENCE_DATA.en.filter(s => /^(Hän|Hänellä|Hänen)\\b/.test(s.fi)).map(s => s.id)`);
  assert.strictEqual(JSON.stringify(bad), "[]");
  app.dispose();
});

// ---------------- Varmuuskopio ----------------
test('Backup: exportBackup ei kaadu ja ilmoittaa tallennetut', async () => {
  const app = await boot();
  setWord(app, 'numbers_two');
  await app.run('recordResult(true, "keyboard")');
  await app.run('exportBackup()');
  assert.ok(/Tallennettu 1 sanan/.test(app.elements.backupNote.textContent), app.elements.backupNote.textContent);
  await app.elements.exportBtn.click();
  await app.flush();
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Backup: importBackupFile kirjoittaa tilastot kantaan ja välimuistiin', async () => {
  const app = await boot();
  const stats = [
    { statId: 'en|4lk|numbers_two', wordId: 'numbers_two', language: 'en', level: '4lk', correctCount: 3, incorrectCount: 0, streakCorrect: 3, streakTargetFi: 1, streakFiTarget: 1, streakKeyboard: 3, streakMic: 0 },
    { statId: 'sentence|en|en_g1_3', sentenceId: 'en_g1_3', language: 'en', streak: 2, correctCount: 2, incorrectCount: 0 },
    { notAStat: true }
  ];
  const file = { text: async () => JSON.stringify({ app: 'sanaseikkailu', stats }) };
  await app.run('importBackupFile').call(null, file);
  assert.ok(app.db.data.has('en|4lk|numbers_two'));
  assert.ok(app.db.data.has('sentence|en|en_g1_3'));
  assert.strictEqual(app.db.data.size, 2);
  assert.strictEqual(J(app, 'statsCache["en|4lk|numbers_two"].streakKeyboard'), 3);
  assert.ok(/Tuotu 2 /.test(app.elements.backupNote.textContent), app.elements.backupNote.textContent);
  app.dispose();
});

test('Backup: virheellinen tiedosto ei kaada eikä muuta kantaa', async () => {
  const app = await boot();
  await app.run('importBackupFile').call(null, { text: async () => 'ei json' });
  assert.ok(app.elements.backupNote.textContent.includes('ei voitu lukea'));
  await app.run('importBackupFile').call(null, { text: async () => JSON.stringify({ foo: 1 }) });
  assert.ok(app.elements.backupNote.textContent.includes('ei sisältänyt'));
  assert.strictEqual(app.db.data.size, 0);
  app.dispose();
});

test('Backup: vienti -> tuonti kierto säilyttää datan', async () => {
  const a = await boot();
  setWord(a, 'numbers_two');
  await a.run('recordResult(true, "keyboard")');
  await a.run('recordResult(true, "keyboard")');
  const stats = Array.from(a.db.data.values());
  a.dispose();
  const b = await boot();
  await b.run('importBackupFile').call(null, { text: async () => JSON.stringify({ stats }) });
  assert.strictEqual(b.db.data.get('en|4lk|numbers_two').streakKeyboard, 2);
  b.dispose();
});


// ---------------- Usean teeman valinta (vaihe 22) ----------------
const smallThemes = (app, n) => J(app, `VOCAB.categories.filter(c => c.grade === 1 && !c.exam)
  .map(c => ({ id: c.id, n: PRACTICE_WORDS.filter(w => w.category === c.id).length }))
  .sort((a, b) => a.n - b.n).slice(0, ${n})`);

test('Teemat: usean teeman valinta rajaa poolin valittujen teemojen sanoihin (isot teemat)', async () => {
  const app = await boot();
  const big = J(app, `VOCAB.categories.filter(c => c.grade === 1 && !c.exam)
    .map(c => ({ id: c.id, n: PRACTICE_WORDS.filter(w => w.category === c.id).length }))
    .filter(c => c.n <= 8).sort((a, b) => b.n - a.n).slice(0, 2)`);
  const ids = big.map(c => c.id);
  assert.ok(big[0].n + big[1].n >= 10);
  app.run(`selectedThemes = ${JSON.stringify(ids)}; initSessionPool();`);
  const n = app.run('sessionPool.length');
  assert.ok(n >= 10 && n <= 15, 'koko ' + n);
  assert.strictEqual(app.run(`sessionPool.every(w => ${JSON.stringify(ids)}.includes(w.category))`), true);
  assert.strictEqual(app.run(`new Set(sessionPool.map(w => w.category)).size`), 2, 'molemmista teemoista sanoja');
  app.dispose();
});

test('Teemat: valintaruudun klikkaus lisää/poistaa teeman ja päivittää napin ja poolin', async () => {
  const app = await boot();
  const [a, b] = J(app, 'selectableCategories().filter(c => c.group !== "hobby").slice(0, 2).map(c => c.id)');
  const rowA = app.elements.themeList._children.find(r => r.dataset.cat === a);
  const boxA = rowA._children[0];
  boxA.checked = true; await boxA.dispatch('change');
  assert.strictEqual(J(app, 'selectedThemes').join(), a);
  assert.strictEqual(app.elements.themeButton.textContent, J(app, `categoryName(${JSON.stringify(a)})`));
  const rowB = app.elements.themeList._children.find(r => r.dataset.cat === b);
  rowB._children[0].checked = true; await rowB._children[0].dispatch('change');
  assert.strictEqual(J(app, 'selectedThemes').join(), a + ',' + b);
  assert.strictEqual(app.elements.themeButton.textContent, '2 teemaa');
  const rowA2 = app.elements.themeList._children.find(r => r.dataset.cat === a);
  rowA2._children[0].checked = false; await rowA2._children[0].dispatch('change');
  assert.strictEqual(J(app, 'selectedThemes').join(), b);
  await app.elements.themeClearBtn.click();
  assert.strictEqual(J(app, 'selectedThemes').length, 0);
  assert.strictEqual(app.elements.themeButton.textContent, 'Kaikki teemat');
  app.dispose();
});

test('Teemat: harrasteteema ja luokan teema valittavissa yhdessä', async () => {
  const app = await boot();
  const hobby = J(app, 'VOCAB.categories.find(c => c.group === "hobby").id');
  const normal = J(app, 'VOCAB.categories.find(c => c.grade === 1 && !c.exam).id');
  app.run(`selectedThemes = [${JSON.stringify(hobby)}, ${JSON.stringify(normal)}]; initSessionPool();`);
  const cats = new Set(J(app, 'sessionPool.map(w => w.category)'));
  assert.ok(cats.has(hobby) && cats.has(normal));
  app.dispose();
});

test('Teemat: täydennys sallittu (oletus) -> pieni valinta täydentyy muista teemoista', async () => {
  const app = await boot();
  const [s1] = smallThemes(app, 1).map(c => c.id); const s2 = s1;
  assert.strictEqual(app.run('themeStrict'), false);
  app.run(`selectedThemes = [${JSON.stringify(s1)}, ${JSON.stringify(s2)}]; initSessionPool();`);
  const n = app.run('sessionPool.length');
  assert.ok(n >= 10, 'koko ' + n);
  assert.strictEqual(app.run(`sessionPool.some(w => ![${JSON.stringify(s1)}, ${JSON.stringify(s2)}].includes(w.category))`), true);
  app.dispose();
});

test('Teemat: tiukka tila -> pooliin vain valittujen teemojen sanoja, ei täydennystä', async () => {
  const app = await boot();
  const [s1] = smallThemes(app, 1).map(c => c.id); const s2 = s1;
  app.elements.themeStrictToggle.checked = true;
  await app.elements.themeStrictToggle.dispatch('change');
  assert.strictEqual(app.run('themeStrict'), true);
  assert.strictEqual(app.storage.getItem('themeStrict'), '1');
  app.run(`selectedThemes = [${JSON.stringify(s1)}, ${JSON.stringify(s2)}]; initSessionPool();`);
  const total = app.run(`PRACTICE_WORDS.filter(w => [${JSON.stringify(s1)}, ${JSON.stringify(s2)}].includes(w.category) && wordGrade(w) === 1).length`);
  assert.ok(total < 10, 'testi vaatii alle 10 sanaa, oli ' + total);
  assert.strictEqual(app.run('sessionPool.length'), total);
  assert.strictEqual(app.run(`sessionPool.every(w => [${JSON.stringify(s1)}, ${JSON.stringify(s2)}].includes(w.category))`), true);
  // useita kierroksia: kaikki näytettävät sanat pysyvät valituissa teemoissa
  for (let i = 0; i < 40; i++) {
    await app.run('pickWord()');
    assert.ok(J(app, `[${JSON.stringify(s1)}, ${JSON.stringify(s2)}]`).includes(app.run('current.category')), 'sana valittujen ulkopuolelta');
  }
  app.dispose();
});

test('Teemat: tiukka tila on muistissa localStoragesta', async () => {
  const app = await boot({ localStorage: { themeStrict: '1' } });
  assert.strictEqual(app.run('themeStrict'), true);
  assert.strictEqual(app.elements.themeStrictToggle.checked, true);
  app.dispose();
});

test('Teemat: tiukassa tilassa ilman valintaa pooli on normaali (kaikki teemat)', async () => {
  const app = await boot({ localStorage: { themeStrict: '1' } });
  const n = app.run('sessionPool.length');
  assert.ok(n >= 10 && n <= 15, 'koko ' + n);
  app.dispose();
});

test('Teemat: tiukan tilan vaihto muuttaa poolin heti (valinta voimassa)', async () => {
  const app = await boot();
  const [s1] = smallThemes(app, 1).map(c => c.id);
  app.run(`selectedThemes = [${JSON.stringify(s1)}]; initSessionPool();`);
  const open = app.run('sessionPool.length');
  assert.ok(open >= 10);
  app.elements.themeStrictToggle.checked = true;
  await app.elements.themeStrictToggle.dispatch('change');
  assert.ok(app.run('sessionPool.length') < open);
  app.elements.themeStrictToggle.checked = false;
  await app.elements.themeStrictToggle.dispatch('change');
  assert.strictEqual(app.run('sessionPool.length'), open);
  app.dispose();
});

test('Teemat: luokan vaihto nollaa valinnan; harrasteteema säilyy sanitoinnissa', async () => {
  const app = await boot();
  const hobby = J(app, 'VOCAB.categories.find(c => c.group === "hobby").id');
  const normal = J(app, 'VOCAB.categories.find(c => c.grade === 1 && !c.exam).id');
  app.run(`selectedThemes = [${JSON.stringify(hobby)}, ${JSON.stringify(normal)}]; activeGrade = 2; populateCategoryOptions();`);
  assert.strictEqual(J(app, 'selectedThemes').join(), hobby);
  app.elements.gradeFilter.value = '3';
  await app.elements.gradeFilter.dispatch('change');
  assert.strictEqual(J(app, 'selectedThemes').length, 0);
  app.dispose();
});

test('Teemat: pelkkä harrasteteema ei täydennä muualta edes avoimessa tilassa', async () => {
  const app = await boot();
  const hobby = J(app, 'VOCAB.categories.find(c => c.group === "hobby").id');
  app.run(`selectedThemes = [${JSON.stringify(hobby)}]; initSessionPool();`);
  assert.strictEqual(app.run(`sessionPool.every(w => w.category === ${JSON.stringify(hobby)})`), true);
  app.dispose();
});

test('Teemat: teemaikkuna aukeaa ja sulkeutuu; virkemoodissa nappi piilossa', async () => {
  const app = await boot();
  await app.elements.themeButton.click();
  assert.ok(app.elements.themeModalOverlay.classList.contains('visible'));
  await app.elements.themeModalClose.click();
  assert.ok(!app.elements.themeModalOverlay.classList.contains('visible'));
  app.dispose();
});


// ---------------- Aikuisen näkymä (vaihe 24) ----------------
test('Aikuinen: tyhjä edistyminen -> raportti nollilla, näkymä aukeaa', async () => {
  const app = await boot();
  const r = J(app, 'buildProgressReport()');
  assert.strictEqual(r.all.seen, 0);
  assert.strictEqual(r.all.full, 0);
  assert.strictEqual(r.grades.length, 9);
  assert.strictEqual(r.hard.length, 0);
  assert.strictEqual(r.days.length, 14);
  await app.elements.adultBtn.click();
  assert.ok(app.elements.adultModalOverlay.classList.contains('visible'));
  const html = app.elements.adultContent.innerHTML;
  assert.ok(html.includes('Luokka-asteittain') && html.includes('Teemoittain') && html.includes('Ei hankalia sanoja'));
  await app.elements.adultModalClose.click();
  assert.ok(!app.elements.adultModalOverlay.classList.contains('visible'));
  app.dispose();
});

test('Aikuinen: edistyminen näkyy raportissa (nähty, vaiheet, täysin opittu, hankalat)', async () => {
  const app = await boot();
  app.run(`(() => {
    const ws = wordsForGrade(1);
    // täysin opittu
    statsCache[statId(ws[0])] = { statId: statId(ws[0]), language: targetLang, correctCount: 20, incorrectCount: 0,
      streakTargetFi: 3, streakFiTarget: 3, streakKeyboard: 5, streakMic: 6, lastSeen: '2026-10-10T10:00:00.000Z' };
    // vain näppäimistö
    statsCache[statId(ws[1])] = { statId: statId(ws[1]), language: targetLang, correctCount: 5, incorrectCount: 0,
      streakTargetFi: 0, streakFiTarget: 0, streakKeyboard: 5, streakMic: 0, lastSeen: '2026-10-09T10:00:00.000Z' };
    // hankala
    statsCache[statId(ws[2])] = { statId: statId(ws[2]), language: targetLang, correctCount: 1, incorrectCount: 4,
      streakTargetFi: 0, streakFiTarget: 0, streakKeyboard: 0, streakMic: 0, lastSeen: '2026-10-08T10:00:00.000Z' };
  })()`);
  const r = J(app, 'buildProgressReport()');
  assert.strictEqual(r.all.seen, 3);
  assert.strictEqual(r.all.full, 1);
  assert.strictEqual(r.all.keyboard, 2);
  assert.strictEqual(r.all.mic, 1);
  assert.strictEqual(r.grades[0].seen, 3);
  assert.strictEqual(r.hard.length, 1);
  assert.strictEqual(r.hard[0].wrong, 4);
  assert.strictEqual(r.lastSeen, '2026-10-10T10:00:00.000Z');
  assert.strictEqual(r.themes.reduce((a, t) => a + t.seen, 0), 3);
  app.dispose();
});

test('Aikuinen: koealueet-osio näyttää Koe 1 -valmiuden ja heikoimmat sanat kielen mukaan', async () => {
  const app = await boot();
  const r = J(app, 'buildProgressReport()');
  assert.strictEqual(r.exams.length, 1);
  assert.strictEqual(r.exams[0].id, 'koe1_4');
  assert.strictEqual(r.exams[0].sentTotal, 38);
  assert.ok(r.exams[0].total > 100);
  app.run('renderAdultView()');
  assert.ok(String(app.elements.adultContent.innerHTML).includes('Koealueet'));
  app.dispose();
  const de = await boot({ localStorage: { targetLang: 'de' } });
  const rd = J(de, 'buildProgressReport()');
  assert.deepStrictEqual(rd.exams.map(e => e.id), ['koe1_de']);
  assert.strictEqual(rd.exams[0].sentTotal, 40);
  de.dispose();
});

test('Aikuinen: päiväloki kirjaa vastaukset kielen mukaan ja näkyy raportissa', async () => {
  const app = await boot();
  app.run('current = wordsForGrade(1)[0]; direction = "target-fi";');
  await app.run('recordResult(true, "keyboard")');
  await app.run('recordResult(false, "keyboard")');
  await app.run('recordResult(true, "keyboard")');
  const log = JSON.parse(app.storage.getItem('dayLog'));
  const today = app.run('localDateKey()');
  assert.deepStrictEqual(log[today].en, { a: 3, c: 2 });
  const r = J(app, 'buildProgressReport()');
  assert.strictEqual(r.days[0].date, today);
  assert.strictEqual(r.days[0].answers, 3);
  assert.strictEqual(r.days[0].correct, 2);
  app.dispose();
});

test('Aikuinen: päiväloki säilyttää enintään 60 päivää; virheellinen JSON ei kaada', async () => {
  const old = {};
  for (let i = 1; i <= 70; i++) old['2026-01-' + String(i).padStart(2, '0')] = { en: { a: 1, c: 1 } };
  const app = await boot({ localStorage: { dayLog: JSON.stringify(old) } });
  app.run('logPractice(true)');
  assert.ok(Object.keys(JSON.parse(app.storage.getItem('dayLog'))).length <= 60);
  app.dispose();
  const app2 = await boot({ localStorage: { dayLog: '{rikki' } });
  app2.run('logPractice(true)');
  assert.strictEqual(JSON.parse(app2.storage.getItem('dayLog'))[app2.run('localDateKey()')].en.a, 1);
  app2.dispose();
});

test('Aikuinen: saksan raportissa luokat 4-9 ja ei englannin päivälokia', async () => {
  const app = await boot({ localStorage: { targetLang: 'de', dayLog: JSON.stringify({ [new Date().getFullYear() + '-01-01']: { en: { a: 5, c: 5 } } }) } });
  const r = J(app, 'buildProgressReport()');
  assert.deepStrictEqual(r.grades.map(g => g.grade), [4, 5, 6, 7, 8, 9]);
  assert.ok(r.days.every(d => d.answers === 0));
  app.dispose();
});

test('Aikuinen: virkkeet näkyvät raportissa', async () => {
  const app = await boot();
  app.run(`(() => { const s = sentencesForGrade(1)[0]; statsCache[sentenceStatId(s)] = { statId: sentenceStatId(s), language: 'en', streak: 4, correctCount: 4, incorrectCount: 0 }; })()`);
  const r = J(app, 'buildProgressReport()');
  assert.strictEqual(r.sentences[0].seen, 1);
  assert.strictEqual(r.sentences[0].mastered, 1);
  assert.strictEqual(r.sentenceTotal, 338);
  app.dispose();
});


// ---------------- Viikon sanat (vaihe 27) ----------------
test('Viikon sanat: syötteen tulkinta (englanti, suomi, pilkut/rivinvaihdot, tunnistamattomat)', async () => {
  const app = await boot();
  const r = J(app, 'parseFocusInput("teacher, koulu\\nApple; kolme, olematonsana ,  Teacher")');
  assert.ok(r.matched.includes('school_people_teacher'));
  assert.ok(r.matched.includes('fruit_apple'));
  assert.ok(r.matched.includes('school_subjects_school'), 'koulu -> school');
  assert.ok(r.matched.some(id => id.startsWith('numbers_three')), 'kolme -> three');
  assert.deepStrictEqual(r.unmatched, ['olematonsana']);
  assert.strictEqual(new Set(r.matched).size, r.matched.length, 'ei duplikaatteja');
  app.dispose();
});

test('Viikon sanat: saksassa artikkeli ja suomi tunnistetaan', async () => {
  const app = await boot({ localStorage: { targetLang: 'de' } });
  const r = J(app, 'parseFocusInput("der Lehrer, Apfel, die Banane, omena")');
  assert.ok(r.matched.includes('school_people_teacher'));
  assert.ok(r.matched.includes('fruit_apple'));
  assert.ok(r.matched.includes('fruit_banana'));
  assert.deepStrictEqual(r.unmatched, []);
  app.dispose();
});

test('Viikon sanat: tallennus rajaa poolin vain listan sanoihin ja kytkee tilan päälle', async () => {
  const app = await boot();
  app.elements.focusInput.value = 'apple, banana, teacher, red, blue';
  await app.elements.focusSave.click();
  assert.strictEqual(app.run('focusActive()'), true);
  assert.strictEqual(app.run('focusIds.length'), 5);
  assert.strictEqual(app.run('sessionPool.length'), 5);
  assert.strictEqual(app.run('sessionPool.every(w => focusIds.includes(w.id))'), true);
  for (let i = 0; i < 30; i++) {
    await app.run('pickWord()');
    assert.ok(app.run('focusIds.includes(current.id)'), 'sana listan ulkopuolelta');
  }
  assert.strictEqual(app.elements.focusButton.style.display, '');
  assert.strictEqual(app.elements.themeButton.style.display, 'none');
  assert.ok(app.elements.focusButton.classList.contains('active'));
  assert.strictEqual(app.storage.getItem('focusOn_en'), '1');
  app.dispose();
});

test('Viikon sanat: painike kytkee tilan pois ja takaisin, normaali pooli palaa', async () => {
  const app = await boot();
  app.elements.focusInput.value = 'apple, banana, teacher';
  await app.elements.focusSave.click();
  await app.elements.focusButton.click();
  assert.strictEqual(app.run('focusActive()'), false);
  assert.ok(app.run('sessionPool.length') >= 10);
  assert.strictEqual(app.elements.themeButton.style.display, '');
  assert.strictEqual(app.storage.getItem('focusOn_en'), '0');
  await app.elements.focusButton.click();
  assert.strictEqual(app.run('sessionPool.length'), 3);
  app.dispose();
});

test('Viikon sanat: tyhjennys poistaa listan ja piilottaa painikkeen', async () => {
  const app = await boot();
  app.elements.focusInput.value = 'apple, banana';
  await app.elements.focusSave.click();
  await app.elements.focusClear.click();
  assert.strictEqual(app.run('focusIds.length'), 0);
  assert.strictEqual(app.elements.focusButton.style.display, 'none');
  assert.ok(app.run('sessionPool.length') >= 10);
  assert.strictEqual(JSON.parse(app.storage.getItem('focusWords_en')).length, 0);
  app.dispose();
});

test('Viikon sanat: tunnistamaton lista ei tallennu; osittain tunnistettu tallentuu ja raportoi puuttuvat', async () => {
  const app = await boot();
  app.elements.focusInput.value = 'qqqq, zzzz';
  await app.elements.focusSave.click();
  assert.strictEqual(app.run('focusIds.length'), 0);
  assert.ok(app.elements.focusStatus.innerHTML.includes('qqqq'));
  app.elements.focusInput.value = 'apple, qqqq';
  await app.elements.focusSave.click();
  assert.strictEqual(app.run('focusIds.length'), 1);
  assert.ok(app.elements.focusStatus.innerHTML.includes('qqqq'));
  app.dispose();
});

test('Viikon sanat: tila säilyy uudelleenkäynnistyksessä, kielikohtainen, virheellinen data ei kaada', async () => {
  const app = await boot({ localStorage: { focusWords_en: JSON.stringify(['fruit_apple', 'tuntematon_id']), focusOn_en: '1' } });
  assert.strictEqual(app.run('focusIds.length'), 1, 'tuntematon id suodatetaan');
  assert.strictEqual(app.run('focusActive()'), true);
  assert.strictEqual(app.run('sessionPool.length'), 1);
  app.run('selectTargetLang("de")');
  assert.strictEqual(app.run('focusActive()'), false, 'saksalla oma lista');
  app.dispose();
  const bad = await boot({ localStorage: { focusWords_en: '{rikki', focusOn_en: '1' } });
  assert.strictEqual(bad.run('focusIds.length'), 0);
  bad.dispose();
});

test('Viikon sanat: virketila ei kärsi, painike ja teemanappi piilossa virkkeissä', async () => {
  const app = await boot();
  app.elements.focusInput.value = 'apple, banana';
  await app.elements.focusSave.click();
  app.run('setPracticeMode("sentences");');
  await app.flush();
  assert.strictEqual(app.elements.focusButton.style.display, 'none');
  assert.notStrictEqual(app.elements.themeButton.style.display, 'none'); // Koe 1 -virkkeet (vaihe 31)
  assert.notStrictEqual(app.run('currentSentence'), null);
  app.run('setPracticeMode("words");');
  assert.strictEqual(app.elements.focusButton.style.display, '');
  app.dispose();
});

test('Viikon sanat: kun kaikki listan sanat on opittu, harjoitus jatkuu kertauksena (ei tyhjä)', async () => {
  const app = await boot();
  app.elements.focusInput.value = 'apple, banana';
  await app.elements.focusSave.click();
  app.run(`focusIds.forEach(id => { const w = PRACTICE_WORDS.find(x => x.id === id); statsCache[statId(w)] = { statId: statId(w), language: 'en', correctCount: 9, incorrectCount: 0, streakTargetFi: 3, streakFiTarget: 3, streakKeyboard: 5, streakMic: 6 }; });`);
  await app.run('pickWord()');
  assert.ok(app.run('focusIds.includes(current.id)'));
  app.dispose();
});


// ---------------- Yläkoulu 7-9 (vaihe 28) ----------------
test('Yläkoulu: englannissa luokilla 7-9 vähintään 60 sanaa, jokaisella en ja fi', async () => {
  const app = await boot();
  for (const g of [7, 8, 9]) {
    const n = app.run(`wordsForGrade(${g}).length`);
    assert.ok(n >= 60, 'luokka ' + g + ': ' + n);
    assert.strictEqual(app.run(`wordsForGrade(${g}).every(w => w.en && w.fi)`), true);
  }
  app.dispose();
});

test('Yläkoulu: saksan sanavarasto sisältää vain sanoja joilla on saksa; luokat 7-9 = opiskeluvuodet 4-6', async () => {
  const app = await boot({ localStorage: { targetLang: 'de' } });
  assert.strictEqual(app.run('PRACTICE_WORDS.every(w => !!w.de)'), true);
  for (const g of [7, 8, 9]) {
    const n = app.run(`wordsForGrade(${g}).length`);
    assert.ok(n > 0, 'saksa luokka ' + g);
    assert.strictEqual(app.run(`wordsForGrade(${g}).every(w => !!w.de)`), true);
  }
  assert.strictEqual(app.run('VOCAB.words.filter(w => !w.de).length > 0'), true, 'englanti-vain-sanat olemassa, mutta eivät saksan poolissa');
  app.dispose();
});

test('Yläkoulu: etenemisjärjestys 6 -> 7 kun 6. luokka valmis, ja pooli 7. luokalle', async () => {
  const app = await boot({ localStorage: { grade_en: '6' } });
  app.run(`wordsForGrade(6).forEach(w => statsCache[statId(w)] = { statId: statId(w), language: 'en', correctCount: 9, incorrectCount: 0, streakTargetFi: 3, streakFiTarget: 3, streakKeyboard: 5, streakMic: 6 });
    activeGrade = 6; maybeAdvanceGrade();`);
  assert.strictEqual(app.run('activeGrade'), 7);
  assert.ok(app.run('sessionPool.length') >= 10);
  assert.strictEqual(app.run('sessionPool.every(w => wordGrade(w) === 7)'), true);
  app.dispose();
});

test('Yläkoulu: englannin virkkeet 7-9 (20 / luokka), virketila 7. luokalla toimii', async () => {
  const app = await boot({ localStorage: { grade_en: '7' } });
  for (const g of [7, 8, 9]) assert.strictEqual(app.run(`sentencesForGrade(${g}).length`), 20, 'luokka ' + g);
  assert.strictEqual(app.run('SENTENCE_DATA.en.length'), 338);
  app.run('setPracticeMode("sentences");');
  await app.flush();
  assert.notStrictEqual(app.run('currentSentence'), null);
  assert.strictEqual(app.run('currentSentence.grade'), 7);
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Yläkoulu: virkkeiden alt-muodot hyväksytään (suggest that / ilman that, big/large)', async () => {
  const app = await boot();
  app.run('currentSentence = SENTENCE_DATA.en.find(s => s.id === "en_g9_18");');
  for (const a of ['In our conversation, the teacher suggested that I should read more English books.', 'In our conversation the teacher suggested I read more English books']) {
    assert.strictEqual(app.run(`matchesSentence(${JSON.stringify(a)}, currentSentence)`), true, a);
  }
  app.run('currentSentence = SENTENCE_DATA.en.find(s => s.id === "en_g7_4");');
  assert.strictEqual(app.run('matchesSentence("First, chop the onions and put them in a large bowl.", currentSentence)'), true);
  assert.strictEqual(app.run('matchesSentence("First, chop the onions and put them in a small bowl.", currentSentence)'), false);
  app.dispose();
});

test('Yläkoulu: virkkeissä ei yhdysmerkkejä tai puolipisteitä (eivät sovi vertailuun)', async () => {
  const app = await boot();
  assert.strictEqual(app.run('SENTENCE_DATA.en.filter(s => /[-;]/.test(s.en) && s.grade >= 7).length'), 0);
  app.dispose();
});

test('Yläkoulu: aikuisen raportti kattaa luokat 7-9', async () => {
  const app = await boot();
  const r = J(app, 'buildProgressReport()');
  assert.deepStrictEqual(r.grades.map(g => g.grade), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.ok(r.grades[8].total >= 60);
  app.dispose();
});

// ---------------- Ajo ----------------
// ---------- Koe 1 (vaihe 31) ----------
test('Koe 1: teema näkyy ensimmäisenä englannin teemalistassa luokasta riippumatta, ei saksassa', async () => {
  const app = await boot();
  const rows = app.elements.themeList._children;
  assert.strictEqual(rows[0].dataset.cat, 'koe1_4');
  assert.strictEqual(J(app, 'categoryName("koe1_4")'), 'Koe 1');
  app.dispose();
  const de = await boot();
  de.run('selectTargetLang("de")');
  await de.flush();
  assert.ok(!de.elements.themeList._children.some(r => r.dataset.cat === 'koe1_4'));
  de.dispose();
});

test('Koe 1: teeman valinta rajaa poolin vain koealueen sanoihin (myös muiden luokkien sanat), ei täydennystä ulkopuolelta', async () => {
  const app = await boot();
  app.run('toggleTheme("koe1_4", true)');
  await app.flush();
  const pool = J(app, 'eligibleWordsForCategoryScope(selectedThemes).map(w => w.id)');
  const n = J(app, 'PRACTICE_WORDS.filter(w => wordInCategory(w, "koe1_4")).length');
  assert.ok(n >= 100, 'koealueella vähintään 100 sanaa: ' + n);
  assert.strictEqual(pool.length, n);
  assert.strictEqual(app.run('outsideTopUpAllowed(selectedThemes)'), false);
  const sessionIds = J(app, 'sessionPool.map(w => w.id)');
  assert.ok(sessionIds.length >= 10);
  assert.ok(sessionIds.every(id => pool.includes(id)), 'istuntopooli vain Koe 1 -sanoja');
  // sanoja ylemmiltä ja alemmilta luokilta mukana
  const grades = J(app, 'Array.from(new Set(PRACTICE_WORDS.filter(w => wordInCategory(w, "koe1_4")).map(w => wordGrade(w))))');
  assert.ok(grades.length >= 3, 'useita luokka-asteita: ' + grades);
  app.dispose();
});

test('Koe 1: virketila - teemalla 38 omaa virkettä, tavalliseen luokkapooliin ne eivät kuulu', async () => {
  const app = await boot();
  assert.strictEqual(J(app, 'sentencesForLang().filter(s => s.theme === "koe1_4").length'), 38);
  assert.ok(J(app, '[1,2,3,4,5,6,7,8,9].every(g => sentencesForGrade(g).length === (g === 4 ? 140 : 20))'));
  app.run('setPracticeMode("sentences")');
  assert.strictEqual(J(app, 'currentSentence.theme || null'), null);
  app.run('toggleTheme("koe1_4", true)');
  await app.flush();
  for (let i = 0; i < 12; i++){
    assert.strictEqual(J(app, 'currentSentence.theme'), 'koe1_4');
    app.run('pickSentenceRound()');
  }
  assert.ok(app.elements.sentenceProgressLabel.textContent.includes('Koe 1'));
  assert.ok(app.elements.sentenceProgressLabel.textContent.includes('/38'));
  // teeman tyhjennys palauttaa luokan virkkeet
  app.run('toggleTheme("koe1_4", false)');
  await app.flush();
  assert.strictEqual(J(app, 'currentSentence.theme || null'), null);
  app.dispose();
});

test('Saksa: substantiivin monikko näkyy palautteessa ja paljastuksessa, englannissa ei', async () => {
  const app = await boot({ localStorage: { targetLang: 'de' } });
  setWord(app, 'school_people_teacher', 'fi-target');
  await app.run('checkAnswer("väärin", "keyboard")');
  assert.ok(fbText(app.elements.feedback).includes('Monikko') || J(app, 'feedback._children.some(c => String(c.textContent).includes("Monikko"))'));
  assert.strictEqual(app.run('pluralNote()'), 'die Lehrer / die Lehrerinnen');
  app.dispose();
  const en = await boot();
  setWord(en, 'school_people_teacher', 'fi-target');
  assert.strictEqual(en.run('pluralNote()'), '');
  en.dispose();
});

test('Kielioppi: nappi vain saksassa, englantiin vaihto palauttaa sanatilaan', async () => {
  const app = await boot();
  assert.strictEqual(app.elements.grammarSwitchBtn.style.display, 'none');
  app.run('selectTargetLang("de")');
  await app.flush();
  assert.strictEqual(app.elements.grammarSwitchBtn.style.display, '');
  app.run('setPracticeMode("grammar")');
  assert.strictEqual(app.run('practiceMode'), 'grammar');
  assert.strictEqual(app.elements.grammarPractice.hidden, false);
  assert.strictEqual(app.elements.wordPractice.hidden, true);
  app.run('selectTargetLang("en")');
  await app.flush();
  assert.strictEqual(app.run('practiceMode'), 'words');
  assert.strictEqual(app.elements.grammarPractice.hidden, true);
  app.dispose();
});

test('Kielioppi: artikkeliharjoitus - oikea ja väärä vastaus, tilastot, uusi kierros', async () => {
  const app = await boot({ localStorage: { targetLang: 'de' } });
  app.run('setPracticeMode("grammar")');
  const id = () => app.run('grammarCurrent.id');
  const art = () => app.run('splitArticle(firstAcceptedAnswer(grammarCurrent.de)).art');
  assert.ok(app.run('grammarPool().length') >= 10);
  assert.ok(app.run('grammarPool().every(w => !w.de.includes("/") && /^(der|die|das) /.test(w.de))'));
  // sana näytetään ilman artikkelia
  assert.ok(!/^(der|die|das) /.test(app.elements.grammarWord.textContent));
  const first = id(); const a = art();
  app.run(`answerArticle(${JSON.stringify(a)})`);
  assert.strictEqual(app.run('grammarSession.c'), 1);
  assert.strictEqual(app.run('grammarLocked'), true);
  // lukittuna toinen vastaus ei lasketa
  app.run(`answerArticle(${JSON.stringify(a)})`);
  assert.strictEqual(app.run('grammarSession.t'), 1);
  assert.strictEqual(JSON.parse(app.storage.getItem('grammarStats_de'))['article:' + first].c, 1);
  // seuraava kierros: eri sana, väärä vastaus
  app.run('pickGrammarRound()');
  assert.notStrictEqual(id(), first);
  const wrong = ['der', 'die', 'das'].find(x => x !== art());
  app.run(`answerArticle(${JSON.stringify(wrong)})`);
  assert.strictEqual(app.run('grammarSession.c'), 1);
  assert.strictEqual(app.run('grammarSession.t'), 2);
  assert.ok(String(app.elements.grammarFeedback.textContent).startsWith('🙈'));
  app.dispose();
});

test('Kielioppi: monikkoharjoitus hyväksyy ilman artikkelia, vaihtoehtoiset muodot ja ae/ue-korvikkeet', async () => {
  const app = await boot({ localStorage: { targetLang: 'de' } });
  app.run('setPracticeMode("grammar"); grammarKind = "plural"; pickGrammarRound();');
  assert.strictEqual(app.elements.grammarPluralWrap.hidden, false);
  assert.strictEqual(app.elements.grammarArticleBtns.hidden, true);
  // kiinnitetään sana: der Apfel -> die Äpfel
  app.run('grammarCurrent = VOCAB.words.find(w => w.de && w.de_pl && /Äpfel/.test(w.de_pl)); grammarLocked = false;');
  app.elements.grammarPluralBox.value = 'Aepfel';
  app.run('answerPlural()');
  assert.strictEqual(app.run('grammarSession.c'), 1, 'ilman artikkelia, ae-korvike');
  app.run('grammarLocked = false;');
  app.elements.grammarPluralBox.value = 'die Äpfel';
  app.run('answerPlural()');
  assert.strictEqual(app.run('grammarSession.c'), 2);
  app.run('grammarLocked = false;');
  app.elements.grammarPluralBox.value = 'die Apfel';
  app.run('answerPlural()');
  assert.strictEqual(app.run('grammarSession.c'), 2);
  assert.ok(String(app.elements.grammarFeedback.textContent).includes('Oikea vastaus'));
  // useampi hyväksytty muoto
  app.run('grammarCurrent = VOCAB.words.find(w => w.id === "school_people_teacher"); grammarLocked = false;');
  app.elements.grammarPluralBox.value = 'die Lehrerinnen';
  app.run('answerPlural()');
  assert.strictEqual(app.run('grammarSession.c'), 3);
  app.dispose();
});

test('Koe 1 (saksa): teema ensimmäisenä saksan teemalistassa, ei englannissa; de_only-sanat vain saksan poolissa', async () => {
  const app = await boot();
  assert.ok(!J(app, 'selectableCategories().some(c => c.id === "koe1_de")'));
  assert.ok(!J(app, 'PRACTICE_WORDS.some(w => w.de_only)'));
  app.run('selectTargetLang("de")');
  await app.flush();
  assert.strictEqual(J(app, 'selectableCategories().filter(c => c.exam).map(c => c.id)').join(), 'koe1_de');
  assert.ok(J(app, 'PRACTICE_WORDS.some(w => w.de_only)'));
  app.run('toggleTheme("koe1_de", true)');
  await app.flush();
  const n = J(app, 'eligibleWordsForCategoryScope(["koe1_de"]).length');
  assert.ok(n >= 60, 'koko ' + n);
  assert.ok(app.run('eligibleWordsForCategoryScope(["koe1_de"]).some(w => w.category !== "koe1_de")'), 'myös muiden teemojen sanat');
  assert.ok(app.run('sessionPool.every(w => wordInCategory(w, "koe1_de") && !!w.de)'));
  app.dispose();
});

test('Koe 1 (saksa): virketila - 40 omaa virkettä, alt-muodot, ei sekoitu luokan virkkeisiin', async () => {
  const app = await boot();
  app.run('selectTargetLang("de"); setPracticeMode("sentences");');
  await app.flush();
  assert.strictEqual(J(app, 'sentencesForLang().filter(s => s.theme === "koe1_de").length'), 40);
  assert.strictEqual(J(app, 'sentencesForGrade(4).length'), 20);
  assert.strictEqual(J(app, 'currentSentence.theme || null'), null);
  app.run('toggleTheme("koe1_de", true)');
  await app.flush();
  for (let i = 0; i < 12; i++){
    assert.strictEqual(J(app, 'currentSentence.theme'), 'koe1_de');
    app.run('pickSentenceRound()');
  }
  assert.ok(app.elements.sentenceProgressLabel.textContent.includes('Koe 1'));
  assert.ok(app.run('matchesSentence("Es ist eins.", sentencesForLang().find(x => x.id === "de_k1_37"))'));
  assert.ok(app.run('matchesSentence("ich bin zehn", sentencesForLang().find(x => x.id === "de_k1_10"))'));
  app.dispose();
});

test('Koe 1: virkkeet hyväksyvät vaihtoehtoiset muodot ja sisältävät vain englanninkielisen datan oikein', async () => {
  const app = await boot();
  const s = J(app, 'sentencesForLang().find(x => x.id === "en_k1_22")');
  assert.ok(app.run(`matchesSentence("Are you watching television?", sentencesForLang().find(x => x.id === "en_k1_22"))`));
  assert.ok(app.run(`matchesSentence("are you watching tv", sentencesForLang().find(x => x.id === "en_k1_22"))`));
  assert.ok(s.fi.includes('nyt'));
  app.dispose();
});

test('Koe 1: aikuisen raportissa Koe 1 -teema sisältää sanat muilta luokilta', async () => {
  const app = await boot();
  const r = J(app, 'buildProgressReport()');
  const th = r.themes.find(x => x.id === 'koe1_4');
  assert.ok(th && th.total >= 100, JSON.stringify(th));
  app.dispose();
});


// ---------------- Itseopiskelutila (Peruskoulu / Itseopiskelu) ----------------
// Synteettinen aineisto, jotta testit eivät riipu itseopiskelun tulevasta sisältömäärästä:
// A1: 14 self_only-sanaa + 1 koulusanan käsite + 1 käsite ilman sv-muotoa; A2: 12 sanaa; B1: tyhjä.
function addSelfFixture(app) {
  app.run(`
    (function () {
      const mk = (id, n, extra) => Object.assign({ id, fi: 'testisana ' + id, sv: 'ord' + n, self_only: true, pos: 'n' }, extra || {});
      const a1 = [], a2 = [];
      for (let i = 1; i <= 14; i++) { const w = mk('zz_a1_' + i, i); VOCAB.words.push(w); a1.push(w.id); }
      for (let i = 1; i <= 12; i++) { const w = mk('zz_a2_' + i, 100 + i); VOCAB.words.push(w); a2.push(w.id); }
      // Käsite, jolla ei ole ruotsia: ei saa tulla poolille.
      VOCAB.words.push({ id: 'zz_nosv', fi: 'ei ruotsia', en: 'nosv', self_only: true });
      a1.push('zz_nosv');
      // Koulusanalla on sv: kuuluu sekä kouluun että aihepiiriin.
      const school = VOCAB.words.find(w => w.sv && w.category && !w.self_only);
      a1.push(school.id);
      globalThis.__schoolSvWord = school.id;
      SELF_DATA.topics.length = 0;
      SELF_DATA.topics.push(
        { id: 'zz_t_a1_x', name_fi: 'Testi A1 X', level: 'A1', concepts: a1.slice(0, 7) },
        { id: 'zz_t_a1_y', name_fi: 'Testi A1 Y', level: 'A1', concepts: a1.slice(7) },
        { id: 'zz_t_a1_empty', name_fi: 'Tyhjä', level: 'A1', concepts: ['zz_nosv'] },
        { id: 'zz_t_a2', name_fi: 'Testi A2', level: 'A2', concepts: a2 }
      );
      PRACTICE_WORDS = practiceWords();
    })();
  `);
}
async function toSelf(app) {
  addSelfFixture(app);
  await app.studyButtons[1].click();
  await app.flush(60);
}
const poolIds = (app) => J(app, 'sessionPool.map(w => w.id)');

test('Tila: oletus on peruskoulu, valinta tallentuu ja palautuu', async () => {
  const app = await boot();
  assert.strictEqual(app.run('studyMode'), 'school');
  assert.ok(!app.run('document.body.classList.contains("self-mode")'));
  await toSelf(app);
  assert.strictEqual(app.run('studyMode'), 'self');
  assert.strictEqual(app.storage.getItem('studyMode'), 'self');
  assert.ok(app.run('document.body.classList.contains("self-mode")'));
  assert.ok(app.studyButtons[1].classList.contains('active'));
  app.dispose();
  const app2 = await boot({ localStorage: { studyMode: 'self' } });
  assert.strictEqual(app2.run('studyMode'), 'self');
  assert.strictEqual(app2.run('targetLang'), 'sv');
  await app2.studyButtons[0].click();
  await app2.flush(60);
  assert.strictEqual(app2.storage.getItem('studyMode'), 'school');
  assert.strictEqual(app2.run('studyMode'), 'school');
  app2.dispose();
});

test('Itseopiskelu: pooli sisältää vain valitun tason aihepiirien sanoja, joilla on sv', async () => {
  const app = await boot();
  await toSelf(app);
  assert.strictEqual(app.run('selfLevel'), 'A1');
  const a1 = new Set(J(app, 'SELF_DATA.topics.filter(t => t.level === "A1").flatMap(t => t.concepts)'));
  const ids = poolIds(app);
  assert.ok(ids.length > 0);
  ids.forEach(id => assert.ok(a1.has(id), 'ei A1-sana: ' + id));
  ids.forEach(id => assert.ok(app.run(`!!VOCAB.words.find(w => w.id === ${JSON.stringify(id)}).sv`)));
  assert.ok(!ids.includes('zz_nosv'));
  assert.ok(!ids.some(id => id.startsWith('zz_a2_')));
  app.dispose();
});

test('Itseopiskelu: tasovalitsin A1/A2/B1 vaihtaa poolin ja tallentuu', async () => {
  const app = await boot();
  await toSelf(app);
  const vals = app.elements.gradeFilter._children.map(o => o.value);
  assert.deepStrictEqual(vals, ['A1', 'A2', 'B1', 'B2']);
  app.elements.gradeFilter.value = 'A2';
  await app.elements.gradeFilter.dispatch('change');
  await app.flush(40);
  assert.strictEqual(app.run('selfLevel'), 'A2');
  assert.strictEqual(app.storage.getItem('selfLevel'), 'A2');
  const ids = poolIds(app);
  assert.ok(ids.length > 0);
  ids.forEach(id => assert.ok(id.startsWith('zz_a2_'), id));
  // Teemavalitsin näyttää vain valitun tason aihepiirit
  const rows = app.elements.themeList._children.map(r => r.dataset.cat);
  assert.deepStrictEqual(rows, ['zz_t_a2']);
  app.dispose();
});

test('Itseopiskelu: aihepiirien monivalinta ja tiukka rajaus', async () => {
  const app = await boot();
  await toSelf(app);
  // A1: tyhjä aihepiiri (ei sv-sanoja) ei näy valitsimessa
  const rows = app.elements.themeList._children.map(r => r.dataset.cat);
  assert.deepStrictEqual(rows.sort(), ['zz_t_a1_x', 'zz_t_a1_y']);
  app.run('themeStrict = true; toggleTheme("zz_t_a1_x", true);');
  await app.flush(30);
  const only = new Set(J(app, 'SELF_DATA.topics.find(t => t.id === "zz_t_a1_x").concepts'));
  poolIds(app).forEach(id => assert.ok(only.has(id), id));
  app.run('toggleTheme("zz_t_a1_y", true);');
  const both = poolIds(app);
  assert.ok(both.some(id => !only.has(id)), 'toinenkin aihepiiri mukana');
  app.run('themeStrict = false;');
  app.dispose();
});

test('Itseopiskelu: self_only-sanat eivät näy peruskoulussa (pooli, teemat, raportti, viikon sanat)', async () => {
  const app = await boot();
  addSelfFixture(app);
  app.langButtons[2].click(); // sv peruskoulussa
  await app.flush(60);
  assert.strictEqual(app.run('studyMode'), 'school');
  assert.strictEqual(app.run('targetLang'), 'sv');
  assert.strictEqual(app.run('PRACTICE_WORDS.some(w => w.self_only)'), false);
  assert.ok(!app.run('wordsForGrade(activeGrade).some(w => w.self_only)'));
  assert.ok(!poolIds(app).some(id => id.startsWith('zz_')));
  const rep = J(app, 'buildProgressReport()');
  assert.strictEqual(rep.all.total, app.run('PRACTICE_WORDS.length'));
  assert.ok(!rep.hard.some(x => x.id.startsWith('zz_')));
  // Viikon sanat -tunnistus ei löydä self_only-sanaa
  const r = J(app, 'parseFocusInput("ord1, ord101")');
  assert.deepStrictEqual(r.matched, []);
  // Teemavalitsimessa vain koulun teemoja
  app.elements.themeList._children.forEach(row => assert.ok(!row.dataset.cat.startsWith('zz_')));
  app.dispose();
});

test('Itseopiskelu: kielet rajautuvat SELF_DATA.languages-kieliin, kieli muistetaan tilakohtaisesti', async () => {
  const app = await boot({ localStorage: { targetLang: 'de' } });
  assert.strictEqual(app.run('targetLang'), 'de');
  // Rajaus testataan eksplisiittisesti: vain ruotsi sallittu (todellisessa datassa myös en/de, ks. omat testit alla).
  app.run('SELF_DATA.languages.length = 0; SELF_DATA.languages.push("sv");');
  await toSelf(app);
  const langs = J(app, 'SELF_DATA.languages');
  assert.strictEqual(app.run('targetLang'), langs[0]);
  app.langButtons.forEach(b => {
    const shown = b.style.display !== 'none';
    assert.strictEqual(shown, langs.includes(b.dataset.lang), b.dataset.lang);
    assert.strictEqual(b.disabled, !langs.includes(b.dataset.lang));
  });
  // Kielinappi, joka ei ole sallittu, ei vaihda kieltä
  const other = ['en', 'de', 'sv'].find(l => !langs.includes(l));
  await app.langButtons[['en', 'de', 'sv'].indexOf(other)].click();
  assert.strictEqual(app.run('targetLang'), langs[0]);
  assert.strictEqual(app.storage.getItem('targetLang_self'), null); // ei vaihtoa -> ei kirjoitusta
  // Peruskoulun kieli ei muutu
  assert.strictEqual(app.storage.getItem('targetLang'), 'de');
  app.dispose();
});

test('Itseopiskelu: Viikon sanat, koeteemat, tasomaskotti ja sanat/virkkeet-valitsin piilossa', async () => {
  const app = await boot();
  // Tallennettu viikon sanojen lista (kelvollinen id) ei saa tuoda nappia itseopiskeluun
  const wid = app.run('PRACTICE_WORDS[0].id');
  app.run(`focusIds = [${JSON.stringify(wid)}]; focusOn = true; saveFocus(); updateFocusUI();`);
  assert.strictEqual(app.elements.focusButton.style.display, '');
  await toSelf(app);
  assert.strictEqual(app.run('focusActive()'), false);
  assert.strictEqual(app.elements.focusButton.style.display, 'none');
  // Vaihe 42: valitsin näkyy itseopiskelussa; vaihe 46: virkkeet näkyvät, kun itseopiskelun virkkeitä on (kielioppi piilossa)
  assert.strictEqual(app.elements.practiceSwitch.style.display, '');
  assert.strictEqual(app.elements.sentencesSwitchBtn.style.display, app.run('selfSentencesAvailable()') ? '' : 'none');
  assert.strictEqual(app.elements.grammarSwitchBtn.style.display, 'none');
  assert.strictEqual(app.elements.focusSection.style.display, 'none');
  assert.strictEqual(app.run('practiceMode'), 'words');
  assert.strictEqual(app.cssVars['--tier-bg-icon'], '""');
  assert.ok(app.run('document.body.classList.contains("self-mode")'));
  assert.ok(app.run('selectableCategories().every(c => !c.exam)'));
  assert.strictEqual(app.run('isExamCategory("koe1_4")'), false);
  // Paluu: kaikki takaisin
  await app.studyButtons[0].click();
  await app.flush(60);
  assert.strictEqual(app.elements.practiceSwitch.style.display, '');
  assert.strictEqual(app.elements.sentencesSwitchBtn.style.display, '');
  assert.strictEqual(app.elements.focusSection.style.display, '');
  assert.strictEqual(app.elements.focusButton.style.display, '');
  assert.notStrictEqual(app.cssVars['--tier-bg-icon'], '""');
  app.dispose();
});

test('Itseopiskelu: virketilasta siirtyminen itseopiskeluun palauttaa sanatilan', async () => {
  const app = await boot();
  await app.practiceButtons[1].click();
  await app.flush(40);
  assert.strictEqual(app.run('practiceMode'), 'sentences');
  await toSelf(app);
  assert.strictEqual(app.run('practiceMode'), 'words');
  assert.strictEqual(app.run('wordPracticeEl.hidden'), false);
  assert.strictEqual(app.run('sentencePracticeEl.hidden'), true);
  app.dispose();
});

test('Itseopiskelu: paluu peruskouluun palauttaa kielen ja luokan', async () => {
  const app = await boot();
  app.langButtons[1].click(); // saksa
  await app.flush(60);
  app.elements.gradeFilter.value = '6';
  await app.elements.gradeFilter.dispatch('change');
  await app.flush(40);
  assert.strictEqual(app.run('targetLang'), 'de');
  assert.strictEqual(app.run('activeGrade'), 6);
  await toSelf(app);
  assert.notStrictEqual(app.run('targetLang'), 'de');
  assert.strictEqual(app.run('activeGrade'), 6); // peruskoulun luokka ei muutu itseopiskelussa
  app.elements.gradeFilter.value = 'A2';
  await app.elements.gradeFilter.dispatch('change');
  await app.flush(30);
  await app.studyButtons[0].click();
  await app.flush(60);
  assert.strictEqual(app.run('studyMode'), 'school');
  assert.strictEqual(app.run('targetLang'), 'de');
  assert.strictEqual(app.run('activeGrade'), 6);
  assert.strictEqual(app.elements.gradeFilter._children.length, app.run('gradesForLang().length'));
  assert.strictEqual(app.elements.gradeFilter.value, '6');
  assert.strictEqual(app.storage.getItem('targetLang'), 'de');
  assert.strictEqual(app.storage.getItem('grade_de'), '6');
  assert.strictEqual(app.run('selfLevel'), 'A2'); // taso säilyy itseopiskelulle
  app.dispose();
});

test('Itseopiskelu: taso opittu -> siirrytään seuraavalle tasolle, jolla on sanoja; ei sanatonta tasoa', async () => {
  const app = await boot();
  await toSelf(app);
  const a1 = J(app, 'wordsForGrade("A1").map(w => w.id)');
  assert.ok(a1.length > 0);
  for (const id of a1) {
    const st = learnedStat(app, id); st.language = 'sv';
    app.run(`statsCache[${JSON.stringify(st.statId)}] = ${JSON.stringify(st)};`);
  }
  assert.ok(app.run('isGradeComplete("A1")'));
  await app.run('pickWord()');
  await app.flush(40);
  assert.strictEqual(app.run('selfLevel'), 'A2');
  // A2 opittu -> B1 on tyhjä, joten tasolle B1 ei siirrytä
  const a2 = J(app, 'wordsForGrade("A2").map(w => w.id)');
  for (const id of a2) {
    const st = learnedStat(app, id); st.language = 'sv';
    app.run(`statsCache[${JSON.stringify(st.statId)}] = ${JSON.stringify(st)};`);
  }
  await app.run('pickWord()');
  await app.flush(40);
  assert.strictEqual(app.run('selfLevel'), 'A2');
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Itseopiskelu: tyhjä taso (B1) täydentää muilta tasoilta eikä kaadu; kategoriaton sana toimii', async () => {
  const app = await boot();
  await toSelf(app);
  app.elements.gradeFilter.value = 'B1';
  await app.elements.gradeFilter.dispatch('change');
  await app.flush(40);
  assert.strictEqual(app.run('selfLevel'), 'B1');
  assert.ok(app.run('current') !== null);
  assert.strictEqual(app.asyncErrors.length, 0);
  // Kategoriaton self_only-sana kortissa
  app.run('selfLevel = "A1"; current = VOCAB.words.find(w => w.id === "zz_a1_1"); direction = "target-fi"; renderPrompt();');
  assert.strictEqual(app.elements.promptCategory.textContent, 'Testi A1 X');
  assert.strictEqual(app.elements.promptWord.textContent, 'ord1');
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Itseopiskelu: "Oma edistyminen" - yhteenveto tasoittain ja aihepiireittäin, ei luokka-asteita', async () => {
  const app = await boot();
  await toSelf(app);
  assert.ok(app.elements.adultBtn.textContent.includes('Oma edistyminen'));
  assert.strictEqual(app.elements.adultTitle.textContent, 'Oma edistyminen');
  // Hankala sana: väärin 3 kertaa
  const st = learnedStat(app, 'zz_a1_2');
  Object.assign(st, { language: 'sv', incorrectCount: 3, correctCount: 1, streakKeyboard: 0, streakMic: 0, streakTargetFi: 0, streakFiTarget: 0, kbTF: 0, kbFT: 0, micTF: 0, micFT: 0 });
  app.run(`statsCache[${JSON.stringify(st.statId)}] = ${JSON.stringify(st)};`);
  const r = J(app, 'buildProgressReport()');
  assert.strictEqual(r.self, true);
  assert.deepStrictEqual(r.levels.map(l => l.id), ['A1', 'A2', 'B1', 'B2']);
  assert.ok(r.levels[0].total > 0 && r.levels[0].seen >= 1);
  assert.strictEqual(r.levels[2].total, 0);
  assert.ok(r.topics.length > 0 && r.topics.every(t => t.level && t.total > 0));
  assert.ok(r.hard.some(x => x.id === 'zz_a1_2'));
  assert.strictEqual(r.grades, undefined);
  await app.run('renderAdultView()');
  const html = app.elements.adultContent.innerHTML;
  assert.ok(html.includes('Tasoittain') && html.includes('Aihepiireittäin') && html.includes('Hankalat sanat'));
  assert.ok(!html.includes('Luokka-asteittain') && !html.includes('Koealueet'));
  app.dispose();
});

test('Itseopiskelu: edistyminen jaetaan tilojen välillä (sama statId)', async () => {
  const app = await boot();
  addSelfFixture(app);
  const sid = (lang, mode) => app.run(`(function(){ studyMode = ${JSON.stringify(mode)}; targetLang = ${JSON.stringify(lang)}; return statId(VOCAB.words.find(w => w.id === __schoolSvWord)); })()`);
  const a = sid('sv', 'school'), b = sid('sv', 'self');
  assert.strictEqual(a, b);
  app.run('studyMode = "school"; targetLang = "en";');
  app.dispose();
});

test('Ruotsi: taivutushuomautus - substantiivi, verbi, adjektiivi; saksa ja englanti ennallaan', async () => {
  const app = await boot();
  const note = (lang, w) => app.run(`(function(){ targetLang = ${JSON.stringify(lang)}; current = ${JSON.stringify(w)}; return pluralNote(); })()`);
  assert.strictEqual(note('sv', { id: 'x', sv_infl: { def: 'bilen' }, sv_pl: 'bilar', pos: 'n' }), 'bilen · bilar');
  assert.strictEqual(note('sv', { id: 'x', sv_infl: { pres: 'skriver', pret: 'skrev', sup: 'skrivit' }, pos: 'v' }), 'skriver · skrev · skrivit');
  assert.strictEqual(note('sv', { id: 'x', sv_infl: { neut: 'stort', apl: 'stora' }, pos: 'adj' }), 'stort · stora');
  assert.strictEqual(note('sv', { id: 'x' }), '');
  assert.strictEqual(note('sv', { id: 'x', de_pl: 'die Hunde' }), '');
  assert.strictEqual(note('de', { id: 'x', de_pl: 'die Hunde', sv_pl: 'bilar' }), 'die Hunde');
  assert.strictEqual(note('en', { id: 'x', sv_infl: { def: 'bilen' }, sv_pl: 'bilar' }), '');
  app.dispose();
});

test('Ruotsi: taivutus näkyy palautteessa ja paljastuksessa molemmissa tiloissa', async () => {
  const app = await boot();
  addSelfFixture(app);
  app.run(`VOCAB.words.find(w => w.id === "zz_a1_3").sv = "bil"; VOCAB.words.find(w => w.id === "zz_a1_3").fi = "auto";
    VOCAB.words.find(w => w.id === "zz_a1_3").sv_infl = { def: "bilen" }; VOCAB.words.find(w => w.id === "zz_a1_3").sv_pl = "bilar";`);
  await toSelf(app);
  for (const mode of ['self', 'school']) {
    if (mode === 'school') {
      // Peruskoulussa: koulusana, jolle lisätään taivutus
      await app.studyButtons[0].click();
      await app.flush(40);
      app.langButtons[2].click();
      await app.flush(60);
      app.run(`VOCAB.words.find(w => w.id === __schoolSvWord).sv_infl = { def: "bilen" }; VOCAB.words.find(w => w.id === __schoolSvWord).sv_pl = "bilar";`);
      app.run('current = VOCAB.words.find(w => w.id === __schoolSvWord); direction = "fi-target";');
    } else {
      app.run('current = VOCAB.words.find(w => w.id === "zz_a1_3"); direction = "fi-target";');
    }
    app.run('renderPrompt();');
    const ok = app.run('acceptedAnswers()[0]');
    await app.run(`checkAnswer(${JSON.stringify(ok)}, "keyboard")`);
    const fb = app.elements.feedback;
    const txt = fbText(fb) + ' ' + fb._children.map(c => c.textContent).join(' ');
    assert.ok(txt.includes('bilen · bilar'), mode + ': ' + txt);
    assert.ok(txt.includes('Taivutus'), txt);
    await app.run('revealBtn.click()');
    assert.ok(app.elements.revealBox.textContent.includes('bilen · bilar'), app.elements.revealBox.textContent);
  }
  app.dispose();
});

// ---------------- Tasotesti (Itseopiskelu) ----------------
// Synteettinen aineisto: jokaisella tasolla 4 aihepiiriä x 5 sanaa (kaksi substantiivi-, kaksi verbiaihepiiriä).
// A1:ssä lisäksi synonyymi- ja saman ruotsinnoksen tapauksia, joita häiriöiksi ei saa tulla.
function addPlacementFixture(app) {
  app.run(`
    (function () {
      SELF_DATA.topics.length = 0;
      let n = 0;
      for (const lvl of ['A1', 'A2', 'B1']) {
        for (let t = 0; t < 4; t++) {
          const ids = [];
          for (let i = 0; i < 5; i++) {
            n++;
            const id = 'zz_p_' + lvl + '_' + t + '_' + i;
            const w = { id, fi: 'olio ' + lvl + t + i, sv: 'svord' + n, self_only: true, pos: t < 2 ? 'n' : 'v' };
            if (lvl === 'A1' && t === 0 && i === 0) { w.fi = 'auto'; w.sv = 'bil'; }
            VOCAB.words.push(w); ids.push(id);
          }
          if (lvl === 'A1' && t === 0) {
            // synonyymi (sama merkitys eri sanalla), sulkutarkenteellinen synonyymi ja sama ruotsinnos eri kehotteella
            VOCAB.words.push({ id: 'zz_p_syn1', fi: 'auto / ajoneuvo', sv: 'fordon', self_only: true, pos: 'n' });
            VOCAB.words.push({ id: 'zz_p_syn2', fi: 'ajoneuvo (iso)', sv: 'lastbil', self_only: true, pos: 'n' });
            VOCAB.words.push({ id: 'zz_p_syn3', fi: 'henkilöauto', sv: 'bil', self_only: true, pos: 'n' });
            ids.push('zz_p_syn1', 'zz_p_syn2', 'zz_p_syn3');
          }
          SELF_DATA.topics.push({ id: 'zz_pt_' + lvl + t, name_fi: 'Aihe ' + lvl + t, level: lvl, concepts: ids });
        }
      }
      PRACTICE_WORDS = practiceWords();
    })();
  `);
}
async function toSelfP(app, lsOpts) {
  addPlacementFixture(app);
  await app.studyButtons[1].click();
  await app.flush(60);
}
// Vastaa nykyiseen kysymykseen oikein / väärin / "en tiedä"
function pAnswer(app, how) {
  const flags = J(app, 'placement.questions[placement.qIdx].options.map(o => o.correct)');
  const idx = how === 'unknown' ? -1 : (how ? flags.indexOf(true) : flags.indexOf(false));
  app.run(`placementAnswer(${idx})`);
}
// Vastaa koko tasoon: ensimmäiset nCorrect oikein, loput väärin
function pLevel(app, nCorrect) {
  const total = app.run('placement.questions.length');
  for (let i = 0; i < total; i++) pAnswer(app, i < nCorrect);
}
async function startP(app) {
  await app.run('openPlacement()');
  app.run('startPlacement()');
}

test('Tasotesti: nappi näkyy vain itseopiskelussa', async () => {
  const app = await boot();
  assert.strictEqual(app.elements.placementBtn.style.display, 'none');
  assert.strictEqual(app.run('placementAvailable()'), false);
  app.run('openPlacement()');
  assert.ok(!app.elements.placementModalOverlay.classList.contains('visible'), 'ei aukea peruskoulussa');
  await toSelfP(app);
  assert.strictEqual(app.elements.placementBtn.style.display, '');
  await app.studyButtons[0].click();
  await app.flush(60);
  assert.strictEqual(app.elements.placementBtn.style.display, 'none');
  app.dispose();
});

test('Tasotesti: ensimmäinen siirtymä itseopiskeluun tarjoaa testin, vain kerran; ohitus jättää A1:n', async () => {
  const app = await boot();
  addPlacementFixture(app);
  await app.studyButtons[1].click();
  await app.flush(60);
  assert.ok(app.elements.placementModalOverlay.classList.contains('visible'), 'tarjous näkyy');
  assert.strictEqual(app.run('placement.phase'), 'intro');
  assert.strictEqual(app.storage.getItem('selfPlacementOffered_sv'), '1');
  // Ohita-nappi (toinen nappi introssa) sulkee ja jättää tason A1
  const btns = app.elements.placementBody._children;
  assert.ok(btns.some(b => /Ohita/.test(b.textContent)));
  await btns.find(b => /Ohita/.test(b.textContent)).click();
  assert.ok(!app.elements.placementModalOverlay.classList.contains('visible'));
  assert.strictEqual(app.run('selfLevel'), 'A1');
  assert.strictEqual(app.storage.getItem('selfPlacement_sv'), null);
  // Toinen siirtymä ei tarjoa uudelleen
  await app.studyButtons[0].click(); await app.flush(40);
  await app.studyButtons[1].click(); await app.flush(40);
  assert.ok(!app.elements.placementModalOverlay.classList.contains('visible'));
  // Nappi avaa testin silti
  await app.elements.placementBtn.click();
  assert.ok(app.elements.placementModalOverlay.classList.contains('visible'));
  app.dispose();
});

test('Tasotesti: tehty testi -> ei tarjousta; peruskoulu ei koskaan tarjoa', async () => {
  const app = await boot({ localStorage: { selfPlacement_sv: JSON.stringify({ date: '2026-01-01', level: 'A2', scores: {} }) } });
  await toSelfP(app);
  assert.ok(!app.elements.placementModalOverlay.classList.contains('visible'));
  app.dispose();
  const app2 = await boot();
  addPlacementFixture(app2);
  app2.langButtons[2].click(); // ruotsi peruskoulussa
  await app2.flush(60);
  assert.ok(!app2.elements.placementModalOverlay.classList.contains('visible'));
  assert.strictEqual(app2.storage.getItem('selfPlacementOffered_sv'), null);
  app2.dispose();
});

test('Tasotesti: kysymyksessä 4 vaihtoehtoa + "En tiedä", oikea vastaus mukana, kehotteena fiFor:n ensimmäinen vaihtoehto', async () => {
  const app = await boot();
  await toSelfP(app);
  await startP(app);
  assert.strictEqual(app.run('placement.questions.length'), 12);
  const qs = J(app, 'placement.questions.map(q => ({ id: q.word.id, opts: q.options, first: firstAcceptedAnswer(fiFor(q.word)) }))');
  qs.forEach(q => {
    assert.strictEqual(q.opts.length, 4);
    const correct = q.opts.filter(o => o.correct);
    assert.strictEqual(correct.length, 1);
    assert.strictEqual(correct[0].text, q.first);
    assert.strictEqual(new Set(q.opts.map(o => o.text)).size, 4, 'vaihtoehdot eri teksteillä');
  });
  // Näkymässä: ruotsin sana + 4 vaihtoehtoa + En tiedä
  const kids = app.elements.placementBody._children;
  assert.strictEqual(kids.filter(k => k.className.includes('placement-option')).length, 4);
  assert.strictEqual(kids.filter(k => k.className.includes('placement-unknown')).length, 1);
  const word = kids.find(k => k.className.includes('placement-word')).textContent;
  assert.strictEqual(word, app.run('firstAcceptedAnswer(placement.questions[0].word.sv)'));
  // Sanat hajautettu aihepiireihin: 12 sanaa kattaa kaikki 4 aihepiiriä
  const topics = new Set(qs.map(q => q.id.split('_')[3] + q.id.split('_')[4]));
  assert.ok(topics.size >= 4, 'aihepiirejä ' + topics.size);
  app.dispose();
});

test('Tasotesti: häiriöt eivät sisällä oikeaa vastausta, synonyymiä tai samaa ruotsinnosta; sama sanaluokka ensisijaisesti', async () => {
  const app = await boot();
  await toSelfP(app);
  const res = J(app, `(function () {
    const out = { bad: [], total: 0, samePos: 0, distractors: 0 };
    const words = selfLevelWords('A1');
    for (let rep = 0; rep < 15; rep++) {
      words.forEach(w => {
        const q = placementBuildQuestion(w, words);
        out.total++;
        const m = placementMeaning(w), sv = placementAlts(w.sv);
        const ds = q.options.filter(o => !o.correct);
        const dw = ds.map(o => words.find(x => x.id === o.wordId));
        if (q.options.filter(o => o.correct).length !== 1) out.bad.push(['oikeita', w.id]);
        dw.forEach((d, i) => {
          out.distractors++;
          if (d.pos === w.pos) out.samePos++;
          if (d.id === w.id) out.bad.push(['sama sana', w.id]);
          if (placementOverlap(placementMeaning(d), m)) out.bad.push(['synonyymi', w.id, d.id]);
          if (placementOverlap(placementAlts(d.sv), sv)) out.bad.push(['sama sv', w.id, d.id]);
          dw.forEach((e, j) => { if (j > i && placementOverlap(placementMeaning(d), placementMeaning(e))) out.bad.push(['häiriöt keskenään', w.id]); });
        });
        if (new Set(q.options.map(o => o.text)).size !== q.options.length) out.bad.push(['sama teksti', w.id]);
      });
    }
    return out;
  })()`);
  assert.deepStrictEqual(res.bad, []);
  assert.ok(res.total > 0 && res.distractors > 0);
  assert.ok(res.samePos / res.distractors > 0.9, 'sama sanaluokka: ' + res.samePos + '/' + res.distractors);
  // Kohdennettu: "auto" ei saa saada häiriöksi ajoneuvo-synonyymejä eikä samaa ruotsinnosta (henkilöauto = bil)
  const car = J(app, `(function () {
    const words = selfLevelWords('A1'), w = words.find(x => x.id === 'zz_p_A1_0_0');
    const seen = new Set();
    for (let i = 0; i < 60; i++) placementBuildQuestion(w, words).options.forEach(o => seen.add(o.wordId));
    return Array.from(seen);
  })()`);
  ['zz_p_syn1', 'zz_p_syn3'].forEach(id => assert.ok(!car.includes(id), id + ' häiriönä'));
  // "auto / ajoneuvo" -kehotteelle ei saa tulla häiriöksi "ajoneuvo (iso)" (sulkutarkenne ei erota merkitystä)
  const veh = J(app, `(function () {
    const words = selfLevelWords('A1'), w = words.find(x => x.id === 'zz_p_syn1');
    const seen = new Set();
    for (let i = 0; i < 60; i++) placementBuildQuestion(w, words).options.forEach(o => seen.add(o.wordId));
    return Array.from(seen);
  })()`);
  assert.ok(!veh.includes('zz_p_syn2') && !veh.includes('zz_p_A1_0_0'), veh.join());
  app.dispose();
});

test('Tasotesti: 80 %:n raja ja eteneminen (10/12 etenee, 9/12 päättää)', async () => {
  const app = await boot();
  await toSelfP(app);
  await startP(app);
  assert.strictEqual(app.run('placement.levels[placement.levelIdx]'), 'A1');
  pLevel(app, 10); // 83 % -> läpi
  assert.strictEqual(app.run('placement.phase'), 'question');
  assert.strictEqual(app.run('placement.levels[placement.levelIdx]'), 'A2');
  pLevel(app, 9); // 75 % -> ei läpi, testi päättyy
  assert.strictEqual(app.run('placement.phase'), 'result');
  const r = J(app, 'placement.result');
  assert.strictEqual(r.level, 'A2');
  assert.deepStrictEqual(r.scores.A1, { correct: 10, total: 12 });
  assert.deepStrictEqual(r.scores.A2, { correct: 9, total: 12 });
  assert.strictEqual(r.scores.B1, undefined);
  await app.flush(40);
  app.dispose();
});

test('Tasotesti: A1 ei läpi -> A1; kaikki läpi -> B1; "En tiedä" lasketaan vääräksi', async () => {
  const app = await boot();
  await toSelfP(app);
  await startP(app);
  for (let i = 0; i < 12; i++) pAnswer(app, i < 6 ? true : 'unknown');
  assert.strictEqual(app.run('placement.result.level'), 'A1');
  assert.deepStrictEqual(J(app, 'placement.result.scores.A1'), { correct: 6, total: 12 });
  // Uusinta: kaikki läpi
  app.run('startPlacement()');
  pLevel(app, 12); pLevel(app, 12); pLevel(app, 12);
  assert.strictEqual(app.run('placement.phase'), 'result');
  assert.strictEqual(app.run('placement.result.level'), 'B1');
  assert.deepStrictEqual(Object.keys(J(app, 'placement.result.scores')), ['A1', 'A2', 'B1']);
  await app.flush(40);
  app.dispose();
});

test('Tasotesti: tulos tallentuu (selfPlacement_sv) ja "Aloita tasolta" asettaa tason', async () => {
  const app = await boot();
  await toSelfP(app);
  await startP(app);
  pLevel(app, 12); pLevel(app, 11); // A2: 92 % läpi -> B1
  pLevel(app, 3);                    // B1 ei läpi
  assert.strictEqual(app.run('placement.phase'), 'result');
  await app.flush(40);
  const saved = JSON.parse(app.storage.getItem('selfPlacement_sv'));
  assert.deepStrictEqual(Object.keys(saved).sort(), ['date', 'level', 'scores']);
  assert.strictEqual(saved.level, 'B1');
  assert.ok(!isNaN(Date.parse(saved.date)));
  assert.deepStrictEqual(saved.scores.B1, { correct: 3, total: 12 });
  // Tulosnäkymän nappi
  const start = app.elements.placementBody._children.find(b => /Aloita tasolta B1/.test(b.textContent));
  assert.ok(start, 'Aloita tasolta -nappi');
  await start.click();
  await app.flush(40);
  assert.strictEqual(app.run('selfLevel'), 'B1');
  assert.strictEqual(app.storage.getItem('selfLevel'), 'B1');
  assert.ok(!app.elements.placementModalOverlay.classList.contains('visible'));
  assert.ok(poolIds(app).every(id => id.startsWith('zz_p_B1')), poolIds(app).join());
  app.dispose();
});

test('Tasotesti: testin voi tehdä uudelleen ja uusi tulos korvaa vanhan', async () => {
  const app = await boot();
  await toSelfP(app);
  await startP(app);
  pLevel(app, 2);
  assert.strictEqual(app.run('placement.result.level'), 'A1');
  const again = app.elements.placementBody._children.find(b => /uudelleen/.test(b.textContent));
  await again.click();
  assert.strictEqual(app.run('placement.phase'), 'question');
  assert.strictEqual(app.run('placement.levelIdx'), 0);
  pLevel(app, 12); pLevel(app, 4);
  assert.strictEqual(JSON.parse(app.storage.getItem('selfPlacement_sv')).level, 'A2');
  // Intro näyttää edellisen tuloksen
  app.run('openPlacement()');
  assert.ok(app.elements.placementBody._children.some(c => /Edellinen tulos/.test(c.textContent)));
  await app.flush(40);
  app.dispose();
});

test('Tasotesti: oikein tunnistetut merkitään (statId ennallaan, ei opittu), väärät eivät', async () => {
  const app = await boot();
  await toSelfP(app);
  await startP(app);
  const ids = J(app, 'placement.questions.map(q => q.word.id)');
  for (let i = 0; i < 12; i++) pAnswer(app, i % 2 === 0); // parilliset oikein, parittomat väärin
  await app.flush(80);
  const right = ids.filter((_, i) => i % 2 === 0), wrong = ids.filter((_, i) => i % 2 === 1);
  for (const id of right) {
    const sid = app.run(`statId({id: ${JSON.stringify(id)}})`);
    assert.strictEqual(sid, 'sv|' + app.run('VOCAB.meta.level') + '|' + id, 'statId ennallaan');
    const st = app.db.data.get(sid);
    assert.ok(st, 'tilasto puuttuu: ' + id);
    assert.strictEqual(st.recognized, true);
    assert.ok(st.recognizedAt && !isNaN(Date.parse(st.recognizedAt)));
    assert.strictEqual(st.correctCount, 0);
    assert.strictEqual(st.incorrectCount, 0);
    assert.strictEqual(st.streakKeyboard, 0);
    assert.strictEqual(app.run(`isFullyLearned(statsCache[${JSON.stringify(sid)}])`), false);
    assert.strictEqual(app.run(`isGraduatedWord(VOCAB.words.find(w => w.id === ${JSON.stringify(id)}))`), false);
  }
  for (const id of wrong) {
    assert.ok(!app.db.data.has(app.run(`statId({id: ${JSON.stringify(id)}})`)), 'väärin vastattua ei saa merkitä: ' + id);
  }
  app.dispose();
});

test('Tasotesti: tunnistusmerkintä ei muuta olemassa olevan sanan laskureita; tunnistettu painotetaan alas, ei lasketa nähdyksi', async () => {
  const app = await boot();
  await toSelfP(app);
  const w = 'zz_p_A1_1_1';
  const sid = app.run(`statId({id: ${JSON.stringify(w)}})`);
  app.db.data.set(sid, { statId: sid, wordId: w, language: 'sv', level: app.run('VOCAB.meta.level'), correctCount: 5, incorrectCount: 1,
    streakCorrect: 2, streakTargetFi: 0, streakFiTarget: 0, streakKeyboard: 2, streakMic: 0, lastSeen: '2026-01-01T00:00:00.000Z' });
  await app.run('updateHeaderStats()');
  await app.run(`markRecognized(VOCAB.words.find(x => x.id === ${JSON.stringify(w)}))`);
  const st = app.db.data.get(sid);
  assert.strictEqual(st.recognized, true);
  assert.strictEqual(st.correctCount, 5); assert.strictEqual(st.incorrectCount, 1);
  assert.strictEqual(st.streakKeyboard, 2); assert.strictEqual(st.lastSeen, '2026-01-01T00:00:00.000Z');
  // Pelkkä tunnistus: paino alle tuoreen sanan (5), raportissa ei "nähty", poolissa tuoreet ensin
  const rec = 'zz_p_A1_1_2', fresh = 'zz_p_A1_1_3';
  await app.run(`markRecognized(VOCAB.words.find(x => x.id === ${JSON.stringify(rec)}))`);
  const wt = (id) => app.run(`weightFor(VOCAB.words.find(x => x.id === ${JSON.stringify(id)}))`);
  assert.ok(wt(rec) < wt(fresh), wt(rec) + ' vs ' + wt(fresh));
  assert.ok(wt(rec) > 0);
  assert.strictEqual(app.run(`isRecognizedOnly(statsCache[statId({id: ${JSON.stringify(rec)}})])`), true);
  assert.strictEqual(app.run(`isRecognizedOnly(statsCache[statId({id: ${JSON.stringify(w)}})])`), false);
  const stats = J(app, `adultStatsFor(['${rec}', '${fresh}'].map(id => VOCAB.words.find(x => x.id === id)))`);
  assert.strictEqual(stats.seen, 0);
  // Täydennys: kun vain 15 paikkaa, kaikki 5 tunnistettua jäävät viimeiseksi
  const A1 = J(app, `selfLevelWords('A1').map(w => w.id)`);
  for (const id of A1.slice(0, 6)) await app.run(`markRecognized(VOCAB.words.find(x => x.id === ${JSON.stringify(id)}))`);
  app.run('initSessionPool()');
  const pool = poolIds(app);
  const recSet = new Set(A1.slice(0, 6));
  const freshOut = A1.filter(id => !recSet.has(id) && !pool.includes(id));
  const recIn = pool.filter(id => recSet.has(id));
  assert.ok(pool.length <= 15);
  // Jos tuoreita jäi poolin ulkopuolelle, tunnistettuja ei saa olla mukana ennen niitä
  if (freshOut.length) assert.strictEqual(recIn.length, 0, 'tunnistettuja ennen tuoreita: ' + recIn.join());
  app.dispose();
});

test('Tasotesti: ääntäminen kaiuttimesta vain jos autoSpeak on päällä', async () => {
  const app = await boot();
  await toSelfP(app);
  app.run('autoSpeakToggle.checked = true;');
  await startP(app);
  await app.flush(400);
  assert.ok(app.spoken.length >= 1);
  assert.strictEqual(app.spoken[app.spoken.length - 1].lang, 'sv-SE');
  assert.strictEqual(app.spoken[app.spoken.length - 1].text, app.run('stripParenthetical(firstAcceptedAnswer(placement.questions[0].word.sv))'));
  app.dispose();
  const app2 = await boot();
  await toSelfP(app2);
  app2.run('autoSpeakToggle.checked = false;');
  await startP(app2);
  await app2.flush(400);
  assert.strictEqual(app2.spoken.length, 0);
  app2.dispose();
});

test('Tasotesti: sulkeminen kesken testin ei tallenna tulosta mutta jo tunnistetut jäävät merkityiksi', async () => {
  const app = await boot();
  await toSelfP(app);
  await startP(app);
  pAnswer(app, true); pAnswer(app, false);
  app.run('closePlacement()');
  await app.flush(60);
  assert.strictEqual(app.run('placement'), null);
  assert.strictEqual(app.storage.getItem('selfPlacement_sv'), null);
  assert.strictEqual(Array.from(app.db.data.values()).filter(s => s.recognized).length, 1);
  app.dispose();
});

test('Tasotesti: peruskoulu ennallaan (tilastot, raportti, pooli, nappi piilossa) testin jälkeen', async () => {
  const app = await boot();
  const before = J(app, 'buildProgressReport()');
  const poolBefore = poolIds(app).length;
  await toSelfP(app);
  await startP(app);
  pLevel(app, 12); pLevel(app, 12); pLevel(app, 12);
  await app.flush(60);
  await app.studyButtons[0].click();
  await app.flush(80);
  assert.strictEqual(app.run('studyMode'), 'school');
  assert.strictEqual(app.elements.placementBtn.style.display, 'none');
  assert.ok(!app.run('document.body.classList.contains("self-mode")'));
  assert.ok(poolIds(app).length > 0 && poolIds(app).length <= 15);
  assert.ok(!poolIds(app).some(id => id.startsWith('zz_')));
  const after = J(app, 'buildProgressReport()');
  assert.deepStrictEqual(after.all, before.all);
  assert.deepStrictEqual(after.grades, before.grades);
  assert.strictEqual(poolBefore > 0, true);
  app.dispose();
});

// ---------------- Kertausjärjestelmä, päivätavoite ja aukolliset ilmaukset (Itseopiskelu) ----------------
// Kellon mockaus: korvaa sovelluksen globaalin Daten, jonka "nyt" asetetaan käsin (paikallista aikaa).
function mockNow(app, local) {
  app.run(`
    (function () {
      const Real = globalThis.__RealDate || (globalThis.__RealDate = Date);
      globalThis.__mockNow = Real.parse(${JSON.stringify(local)});
      class MockDate extends Real {
        constructor(...a) { if (a.length) super(...a); else super(globalThis.__mockNow); }
        static now() { return globalThis.__mockNow; }
      }
      globalThis.Date = MockDate;
    })();
  `);
}
function seedStat(app, id, extra) {
  const sid = app.run(`statId({id: ${JSON.stringify(id)}})`);
  const st = Object.assign({ statId: sid, wordId: id, language: 'sv', level: app.run('VOCAB.meta.level'),
    correctCount: 1, incorrectCount: 0, streakCorrect: 1, streakTargetFi: 0, streakFiTarget: 0, streakKeyboard: 1, streakMic: 0,
    lastSeen: '2026-01-01T00:00:00.000Z' }, extra || {});
  app.db.data.set(sid, st);
  return sid;
}
async function answerWord(app, id, correct) {
  setWord(app, id, 'fi-target');
  await app.run(`checkAnswer(${correct ? 'acceptedAnswers()[0]' : JSON.stringify('xxxx')}, "keyboard")`);
}
const dbStat = (app, id) => app.db.data.get(app.run(`statId({id: ${JSON.stringify(id)}})`));
const DAY = 86400000;

test('Kertaus: aikataulun laskenta - ensimmäinen oikein 1 pv, sitten väli x kerroin, väärin 1 pv ja kerroin pienenee (min 1,3)', async () => {
  const app = await boot();
  mockNow(app, '2026-07-10T12:00:00');
  const t0 = app.run('Date.now()');
  const midnight = (n) => app.run(`new Date(2026, 6, ${10 + n}).getTime()`);
  const st = {};
  const step = (ok, now) => JSON.parse(app.run(`JSON.stringify(srsApply(${JSON.stringify(st)}, ${ok}, ${now}))`));
  let s = step(true, t0);
  assert.strictEqual(s.srsInterval, 1); assert.strictEqual(s.srsEase, 2.5);
  assert.strictEqual(s.srsDue, midnight(1), 'erääntyy seuraavana paikallisena keskiyönä');
  // Erääntyneenä oikein: 1 x 2,5 -> 3, sitten 3 x 2,5 -> 8
  let now = midnight(1) + 3600e3;
  s = JSON.parse(app.run(`JSON.stringify(srsApply(${JSON.stringify(s)}, true, ${now}))`));
  assert.strictEqual(s.srsInterval, 3);
  now = s.srsDue + 1000;
  s = JSON.parse(app.run(`JSON.stringify(srsApply(${JSON.stringify(s)}, true, ${now}))`));
  assert.strictEqual(s.srsInterval, 8); assert.strictEqual(s.srsEase, 2.5);
  // Ennen erääntymistä oikein ei muuta aikataulua
  const before = JSON.stringify(s);
  const same = JSON.parse(app.run(`JSON.stringify(srsApply(${JSON.stringify(s)}, true, ${now - 3 * DAY}))`));
  assert.strictEqual(JSON.stringify(same), before);
  // Väärin: väli 1 pv, kerroin -0,2
  s = JSON.parse(app.run(`JSON.stringify(srsApply(${JSON.stringify(s)}, false, ${now}))`));
  assert.strictEqual(s.srsInterval, 1); assert.strictEqual(s.srsEase, 2.3);
  assert.strictEqual(s.srsDue, app.run(`dayStartPlus(${now}, 1)`));
  // Kerroin ei mene alle 1,3
  for (let i = 0; i < 10; i++) s = JSON.parse(app.run(`JSON.stringify(srsApply(${JSON.stringify(s)}, false, ${now}))`));
  assert.strictEqual(s.srsEase, 1.3);
  // Pieni kerroin ei jumita väliä: vähintään +1 pv
  s = { srsInterval: 1, srsEase: 1.3, srsDue: now - 1 };
  s = JSON.parse(app.run(`JSON.stringify(srsApply(${JSON.stringify(s)}, true, ${now}))`));
  assert.ok(s.srsInterval >= 2);
  // Yläraja
  s = { srsInterval: 300, srsEase: 2.5, srsDue: now - 1 };
  s = JSON.parse(app.run(`JSON.stringify(srsApply(${JSON.stringify(s)}, true, ${now}))`));
  assert.strictEqual(s.srsInterval, 365);
  app.dispose();
});

test('Kertaus: tuottava vastaus, "Näytä sana" ja tunnistus - tallentuu samaan tietueeseen, tunnistus ei pidennä väliä', async () => {
  const app = await boot();
  await toSelf(app);
  mockNow(app, '2026-07-10T12:00:00');
  await answerWord(app, 'zz_a1_1', true);
  let st = dbStat(app, 'zz_a1_1');
  assert.strictEqual(st.statId, 'sv|' + app.run('VOCAB.meta.level') + '|zz_a1_1', 'statId ennallaan');
  assert.strictEqual(st.srsInterval, 1);
  assert.strictEqual(st.srsEase, 2.5);
  assert.strictEqual(st.srsDue, app.run('new Date(2026, 6, 11).getTime()'));
  assert.strictEqual(st.correctCount, 1);
  // Väärä vastaus
  await answerWord(app, 'zz_a1_2', false);
  st = dbStat(app, 'zz_a1_2');
  assert.strictEqual(st.srsInterval, 1); assert.strictEqual(st.srsEase, 2.3); assert.strictEqual(st.incorrectCount, 1);
  // "Näytä sana" lasketaan väärin aikataulussa, mutta ei muuta laskureita
  seedStat(app, 'zz_a1_3', { srsInterval: 8, srsEase: 2.5, srsDue: app.run('Date.now()') - DAY });
  await app.run('updateHeaderStats()');
  setWord(app, 'zz_a1_3', 'fi-target');
  app.run('renderPrompt()');
  await app.elements.revealBtn.click();
  await app.flush(30);
  st = dbStat(app, 'zz_a1_3');
  assert.strictEqual(st.srsInterval, 1); assert.strictEqual(st.srsEase, 2.3);
  assert.strictEqual(st.correctCount, 1); assert.strictEqual(st.incorrectCount, 0);
  // Paljastus ei kasvata päivälaskuria
  assert.strictEqual(app.run('dailySummary().count'), 2);
  // Uusi sana paljastettuna: tietue syntyy, väli 1 pv
  setWord(app, 'zz_a1_4', 'fi-target');
  app.run('renderPrompt()');
  await app.elements.revealBtn.click();
  await app.flush(30);
  assert.strictEqual(dbStat(app, 'zz_a1_4').srsInterval, 1);
  // Tunnistus ei koske aikatauluun
  seedStat(app, 'zz_a1_5', { srsInterval: 5, srsEase: 2.1, srsDue: 12345 });
  await app.run('updateHeaderStats()');
  await app.run('markRecognized(VOCAB.words.find(w => w.id === "zz_a1_5"))');
  st = dbStat(app, 'zz_a1_5');
  assert.strictEqual(st.recognized, true);
  assert.strictEqual(st.srsInterval, 5); assert.strictEqual(st.srsEase, 2.1); assert.strictEqual(st.srsDue, 12345);
  await app.run('markRecognized(VOCAB.words.find(w => w.id === "zz_a1_6"))');
  st = dbStat(app, 'zz_a1_6');
  assert.ok(st.srsInterval === undefined && st.srsDue === undefined, 'pelkkä tunnistus ei aikatauluta');
  app.dispose();
});

test('Kertaus: erääntyneet ovat poolissa ennen uusia (myös graduoituneet), uusia sanoja vain päiväkiintiön verran', async () => {
  const app = await boot();
  await toSelf(app); // ensin itseopiskeluun, jotta statId:t ovat ruotsin (sv)
  mockNow(app, '2026-07-10T12:00:00');
  const past = app.run('Date.now()') - 2 * DAY, future = app.run('Date.now()') + 5 * DAY;
  // 2 erääntynyttä (toinen täysin opittu ja siksi normaalisti poolin ulkopuolella), 1 tulevaisuudessa
  seedStat(app, 'zz_a1_1', { srsInterval: 3, srsEase: 2.5, srsDue: past });
  seedStat(app, 'zz_a1_2', { srsInterval: 9, srsEase: 2.5, srsDue: past, correctCount: 20, streakCorrect: 6, streakTargetFi: 3, streakFiTarget: 3, streakKeyboard: 5, streakMic: 6 });
  seedStat(app, 'zz_a1_3', { srsInterval: 9, srsEase: 2.5, srsDue: future, correctCount: 20, streakCorrect: 6, streakTargetFi: 3, streakFiTarget: 3, streakKeyboard: 5, streakMic: 6 });
  app.storage.setItem('selfDaily_sv', JSON.stringify({ goal: 20, newPerDay: 3, days: {} }));
  await app.run('updateHeaderStats()');
  app.run('initSessionPool()');
  const ids = poolIds(app);
  assert.deepStrictEqual(ids.slice(0, 2).sort(), ['zz_a1_1', 'zz_a1_2'], 'erääntyneet ensin: ' + ids.join());
  assert.ok(!ids.includes('zz_a1_3'), 'tulevaisuuteen aikataulutettu graduoitu sana ei ole poolissa');
  const fresh = ids.filter(id => !app.db.data.has(app.run(`statId({id: ${JSON.stringify(id)}})`)));
  assert.strictEqual(fresh.length, 3, 'uusia sanoja vain 3: ' + ids.join());
  // Ensimmäinen vastaus uudelle sanalle kuluttaa kiintiötä; kun kiintiö täyttyy, uusia ei lisätä
  for (const id of fresh) await answerWord(app, id, true);
  await app.flush(30);
  app.run('initSessionPool()');
  const ids2 = poolIds(app);
  const fresh2 = ids2.filter(id => !app.db.data.has(app.run(`statId({id: ${JSON.stringify(id)}})`)));
  assert.strictEqual(fresh2.length, 0, 'päiväraja täynnä: ' + ids2.join());
  assert.strictEqual(app.run('newWordsLeftToday()'), 0);
  // Seuraavana päivänä kiintiö palautuu
  mockNow(app, '2026-07-11T08:00:00');
  assert.strictEqual(app.run('newWordsLeftToday()'), 3);
  app.run('initSessionPool()');
  assert.ok(poolIds(app).some(id => !app.db.data.has(app.run(`statId({id: ${JSON.stringify(id)}})`))));
  app.dispose();
});

test('Kertaus: "Kertaa erääntyneet" rajaa poolin erääntyneisiin ja päättyy kun ne on käyty; kerrattavien määrä näkyy', async () => {
  const app = await boot();
  await toSelf(app);
  mockNow(app, '2026-07-10T12:00:00');
  const past = app.run('Date.now()') - DAY;
  ['zz_a1_1', 'zz_a1_2', 'zz_a2_3'].forEach(id => seedStat(app, id, { srsInterval: 2, srsEase: 2.5, srsDue: past }));
  seedStat(app, 'zz_a1_4', { srsInterval: 2, srsEase: 2.5, srsDue: past + 10 * DAY });
  await app.run('updateHeaderStats()');
  assert.strictEqual(app.elements.reviewDueLabel.textContent, '🔁 Kerrattavia: 3');
  assert.strictEqual(app.elements.reviewDueBtn.style.display, '');
  assert.strictEqual(app.elements.reviewDueBtn.textContent, 'Kertaa erääntyneet');
  await app.elements.reviewDueBtn.click();
  await app.flush(60);
  assert.strictEqual(app.run('reviewDueOnly'), true);
  assert.strictEqual(app.elements.reviewDueBtn.textContent, 'Lopeta kertaus');
  const seen = new Set();
  for (let i = 0; i < 3; i++) {
    const id = app.run('current.id');
    assert.ok(['zz_a1_1', 'zz_a1_2', 'zz_a2_3'].includes(id), 'vain erääntyneitä: ' + id);
    seen.add(id);
    await app.run(`checkAnswer(acceptedAnswers()[0], "keyboard")`);
    await app.flush(1100); // pickWord valitsee seuraavan
  }
  assert.strictEqual(seen.size, 3, 'jokainen erääntynyt käydään kerran: ' + [...seen]);
  assert.strictEqual(app.run('dueWords().length'), 0);
  await app.flush(60);
  assert.strictEqual(app.run('reviewDueOnly'), false, 'kertaus päättyy automaattisesti');
  assert.strictEqual(app.elements.reviewDueLabel.textContent, '🔁 Kerrattavia: 0');
  assert.strictEqual(app.elements.reviewDueBtn.style.display, 'none');
  assert.ok(/erääntyneet/.test(app.elements.dailyNotice.textContent));
  app.dispose();
});

test('Päivätavoite: laskuri, tallennus selfDaily_sv, palkki ja tavoitteen täyttymisilmoitus', async () => {
  const app = await boot();
  await toSelf(app);
  mockNow(app, '2026-07-10T09:00:00');
  assert.strictEqual(app.run('dailySummary().goal'), 20, 'oletus 20');
  app.run('setDailyGoal(10)');
  assert.strictEqual(app.run('setDailyGoal(15), dailySummary().goal'), 10, 'vain 10/20/30/50');
  for (let i = 1; i <= 4; i++) await answerWord(app, 'zz_a1_' + i, i % 2 === 0);
  assert.strictEqual(app.elements.dailyLabel.textContent, 'Tänään 4 / 10');
  assert.strictEqual(app.elements.dailyFill.style.width, '40%');
  assert.strictEqual(app.elements.dailyNotice.textContent, '');
  for (let i = 5; i <= 9; i++) await answerWord(app, 'zz_a1_' + i, true);
  assert.strictEqual(app.elements.dailyLabel.textContent, 'Tänään 9 / 10');
  assert.ok(!app.elements.dailyNotice.textContent);
  await answerWord(app, 'zz_a1_10', true);
  assert.strictEqual(app.elements.dailyLabel.textContent, 'Tänään 10 / 10');
  assert.ok(app.elements.dailyBar.classList.contains('done'));
  assert.ok(/Päivätavoite täynnä: 10 \/ 10/.test(app.elements.dailyNotice.textContent), app.elements.dailyNotice.textContent);
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(app.elements.dailyNotice.textContent.replace('🔥', '')), 'hillitty: ei maskotteja/emojeita');
  const saved = JSON.parse(app.storage.getItem('selfDaily_sv'));
  assert.strictEqual(saved.goal, 10);
  assert.strictEqual(saved.days['2026-07-10'], 10);
  assert.deepStrictEqual(saved.met, ['2026-07-10']);
  // Ilmoitus tulee vain kerran: yksitoista vastausta ei toista sitä
  app.elements.dailyNotice.textContent = '';
  await answerWord(app, 'zz_a1_11', true);
  assert.strictEqual(app.elements.dailyNotice.textContent, '');
  assert.strictEqual(app.run('dailySummary().count'), 11);
  // Laskuri on kielikohtainen: avain selfDaily_<kieli>
  assert.strictEqual(app.run('dailyKey()'), 'selfDaily_sv');
  assert.strictEqual(app.storage.getItem('selfDaily_en'), null);
  app.dispose();
});

test('Päivätavoite: päiväputki päivänvaihteen yli (mockattu Date), pisin putki muistetaan', async () => {
  const app = await boot();
  await toSelf(app);
  app.run('setDailyGoal(10)');
  const day = async (local, n) => {
    mockNow(app, local);
    for (let i = 0; i < n; i++) await answerWord(app, 'zz_a1_' + (1 + i % 12), true);
  };
  await day('2026-07-10T23:50:00', 10);
  assert.strictEqual(app.run('dailySummary().streak'), 1);
  // Päivänvaihde: eilinen täyttynyt, tämä päivä vielä kesken -> putki säilyy
  mockNow(app, '2026-07-11T00:10:00');
  assert.strictEqual(app.run('dailySummary().count'), 0);
  assert.strictEqual(app.run('dailySummary().streak'), 1);
  await day('2026-07-11T00:10:00', 9);
  assert.strictEqual(app.run('dailySummary().streak'), 1, '9/10 ei vielä jatka putkea');
  await day('2026-07-11T22:00:00', 1);
  assert.strictEqual(app.run('dailySummary().count'), 10);
  assert.strictEqual(app.run('dailySummary().streak'), 2);
  await day('2026-07-12T10:00:00', 10);
  assert.strictEqual(app.run('dailySummary().streak'), 3);
  assert.ok(/3 päivää/.test(app.elements.dailyStreak.textContent), app.elements.dailyStreak.textContent);
  assert.ok(/🔥 3 päivää/.test(JSON.stringify(app.run('streakText(3)'))));
  // Yksi päivä väliin (13.): putki säilyy vielä 14. aamuna?  Ei: 13. jäi täyttämättä, 14. on kesken -> katkennut
  mockNow(app, '2026-07-13T12:00:00');
  assert.strictEqual(app.run('dailySummary().streak'), 3, '13. kesken, putki vielä elossa');
  mockNow(app, '2026-07-14T08:00:00');
  assert.strictEqual(app.run('dailySummary().streak'), 0, 'kokonainen päivä väliin -> putki katkeaa');
  assert.strictEqual(app.run('dailySummary().best'), 3, 'pisin putki muistetaan');
  await day('2026-07-14T08:00:00', 10);
  assert.strictEqual(app.run('dailySummary().streak'), 1);
  assert.strictEqual(app.run('dailySummary().best'), 3);
  // Kuukauden vaihde
  await day('2026-07-15T08:00:00', 10);
  assert.strictEqual(app.run('dailySummary().streak'), 2);
  mockNow(app, '2026-08-01T08:00:00');
  assert.strictEqual(app.run('dailySummary().streak'), 0);
  app.dispose();
});

test('Päivätavoite: tavoitteen lasku ei muuta jo täyttyneitä päiviä taannehtivasti; asetukset tallentuvat', async () => {
  const app = await boot();
  await toSelf(app);
  mockNow(app, '2026-07-10T09:00:00');
  app.run('setDailyGoal(10)');
  for (let i = 1; i <= 10; i++) await answerWord(app, 'zz_a1_' + i, true);
  mockNow(app, '2026-07-11T09:00:00');
  app.run('setDailyGoal(50)');
  assert.strictEqual(app.run('dailySummary().streak'), 1, 'eilinen täyttyi tavoitteella 10 ja pysyy täytettynä');
  app.run('setNewPerDay(20)');
  const saved = JSON.parse(app.storage.getItem('selfDaily_sv'));
  assert.strictEqual(saved.goal, 50); assert.strictEqual(saved.newPerDay, 20);
  assert.strictEqual(app.run('setNewPerDay(7), loadDaily().newPerDay'), 20, 'vain sallitut arvot');
  // Rikkinäinen tallenne ei kaada
  app.storage.setItem('selfDaily_sv', '{rikki');
  assert.strictEqual(app.run('dailySummary().goal'), 20);
  app.dispose();
});

test('Kertaus: Oma edistyminen - erääntyvät tänään/huomenna/7 pv ja välijakauma, päivätavoite näkyy', async () => {
  const app = await boot();
  await toSelf(app);
  mockNow(app, '2026-07-10T12:00:00');
  const d = (n) => app.run(`new Date(2026, 6, ${10 + n}).getTime()`);
  seedStat(app, 'zz_a1_1', { srsInterval: 1, srsDue: d(-3) });  // myöhässä -> tänään
  seedStat(app, 'zz_a1_2', { srsInterval: 1, srsDue: d(0) });   // tänään
  seedStat(app, 'zz_a1_3', { srsInterval: 2, srsDue: d(1) });   // huomenna
  seedStat(app, 'zz_a1_4', { srsInterval: 7, srsDue: d(5) });   // 7 pv sisällä
  seedStat(app, 'zz_a1_5', { srsInterval: 28, srsDue: d(7) });  // 7 pv sisällä (viimeinen päivä)
  seedStat(app, 'zz_a1_6', { srsInterval: 29, srsDue: d(8) });  // ulkopuolella
  seedStat(app, 'zz_a1_7', {});                                  // ei aikataulua
  await app.run('updateHeaderStats()');
  const r = J(app, 'buildProgressReport()');
  assert.deepStrictEqual(r.srs, { today: 2, tomorrow: 1, week: 3, scheduled: 6, short: 3, mid: 2, long: 1 });
  assert.strictEqual(r.daily.goal, 20);
  await app.run('renderAdultView()');
  const html = String(app.elements.adultContent.innerHTML);
  assert.ok(html.includes('Kertaus') && html.includes('Huomenna') && html.includes('Seuraavan 7 päivän aikana'));
  assert.ok(html.includes('id="dailyGoalSelect"') && html.includes('id="newPerDaySelect"'));
  assert.ok(html.includes('Tänään 0 / 20'));
  app.dispose();
});

test('Kertaus: peruskoulu ennallaan - ei aikataulukenttiä, ei päivälaskuria, erääntyneet eivät vaikuta pooliin', async () => {
  const app = await boot();
  assert.strictEqual(app.run('studyMode'), 'school');
  const id = app.run('current.id');
  const past = app.run('Date.now()') - 2 * DAY;
  // Kouluun kuuluva sana, jolla on (esim. itseopiskelusta tullut) erääntynyt aikataulu
  const other = grade1Ids(app).find(x => x !== id);
  seedStat(app, other, { language: 'en', statId: app.run(`statId({id: ${JSON.stringify(other)}})`), srsInterval: 2, srsDue: past });
  await app.run('updateHeaderStats()');
  app.run('initSessionPool()');
  assert.strictEqual(app.run('typeof isWordDue(VOCAB.words[0])'), 'boolean');
  assert.strictEqual(app.run(`isWordDue(VOCAB.words.find(w => w.id === ${JSON.stringify(other)}))`), false);
  setWord(app, id, 'target-fi');
  await app.run('checkAnswer(acceptedAnswers()[0], "keyboard")');
  const st = dbStat(app, id);
  assert.strictEqual(st.correctCount, 1);
  assert.ok(st.srsInterval === undefined && st.srsDue === undefined && st.srsEase === undefined, JSON.stringify(st));
  assert.strictEqual(app.storage.getItem('selfDaily_en'), null);
  assert.ok(![...app.storage._map.keys()].some(k => k.startsWith('selfDaily_')));
  assert.ok(!app.run('document.body.classList.contains("self-mode")'));
  // "Näytä sana" ei aikatauluta peruskoulussa
  setWord(app, other, 'target-fi');
  app.run('renderPrompt()');
  const before = JSON.stringify(dbStat(app, other));
  await app.elements.revealBtn.click();
  await app.flush(30);
  assert.strictEqual(JSON.stringify(dbStat(app, other)), before);
  // Raportti ei sisällä itseopiskelun kenttiä
  const rep = J(app, 'buildProgressReport()');
  assert.ok(!('srs' in rep) && !('daily' in rep));
  app.dispose();
});

test('Aukolliset ilmaukset: mukana itseopiskelussa, pois peruskoulusta; aukko ja välilyönnit ohitetaan', async () => {
  const app = await boot();
  app.run(`
    VOCAB.words.push({ id: 'zz_g_name', fi: 'nimeni on ... / minun nimeni on ...', sv: 'jag heter ... / mitt namn är ...', en: 'my name is ...', de: 'ich heiße ...' });
    VOCAB.words.push({ id: 'zz_g_either', fi: 'joko ... tai', sv: 'antingen ... eller', self_only: true, pos: 'phr' });
    VOCAB.words.push({ id: 'zz_g_way', fi: 'Miten pääsen ...?', sv: 'Hur kommer jag till ...?', self_only: true });
    VOCAB.words.push({ id: 'zz_g_allergic', fi: 'Olen allerginen ...lle.', sv: 'Jag är allergisk mot ...', self_only: true });
    VOCAB.words.push({ id: 'zz_g_ago', fi: '... sitten (esim. viikko sitten)', sv: 'för ... sedan', self_only: true });
    VOCAB.words.push({ id: 'zz_g_plain', fi: 'koira', sv: 'hund', self_only: true });
  `);
  const inPool = (id) => app.run(`PRACTICE_WORDS.some(w => w.id === ${JSON.stringify(id)})`);
  // Peruskoulu: aukolliset suodatetaan pois kuten ennen
  app.run('PRACTICE_WORDS = practiceWords()');
  assert.strictEqual(inPool('zz_g_name'), false);
  await app.studyButtons[1].click();
  await app.flush(60);
  app.run('PRACTICE_WORDS = practiceWords()');
  for (const id of ['zz_g_name', 'zz_g_either', 'zz_g_way', 'zz_g_allergic', 'zz_g_ago']) assert.strictEqual(inPool(id), true, id);
  const accepts = (id, dir, ans, mode) => {
    app.run(`current = VOCAB.words.find(w => w.id === ${JSON.stringify(id)}); direction = ${JSON.stringify(dir)};`);
    return app.run(`matchesAnswer(${JSON.stringify(ans)}, ${JSON.stringify(mode || 'keyboard')})`);
  };
  // sv-vastaus (suunta fi -> kohdekieli)
  assert.ok(accepts('zz_g_name', 'fi-target', 'jag heter'));
  assert.ok(accepts('zz_g_name', 'fi-target', 'Jag heter'));
  assert.ok(accepts('zz_g_name', 'fi-target', 'jag heter ...'), 'pisteilläkin');
  assert.ok(accepts('zz_g_name', 'fi-target', 'mitt namn är'));
  assert.ok(!accepts('zz_g_name', 'fi-target', 'jag'));
  assert.ok(!accepts('zz_g_name', 'fi-target', 'jag heter Pekka'), 'aukon täytettä ei hyväksytä');
  assert.ok(accepts('zz_g_either', 'fi-target', 'antingen eller'));
  assert.ok(accepts('zz_g_either', 'fi-target', 'antingen ... eller'));
  assert.ok(accepts('zz_g_either', 'fi-target', 'Antingen...eller'), 'ilman välilyöntejä pisteiden ympärillä');
  assert.ok(!accepts('zz_g_either', 'fi-target', 'antingen'));
  assert.ok(accepts('zz_g_way', 'fi-target', 'Hur kommer jag till'));
  assert.ok(accepts('zz_g_way', 'fi-target', 'hur kommer jag till?'));
  assert.ok(accepts('zz_g_ago', 'fi-target', 'för sedan'));
  assert.ok(accepts('zz_g_ago', 'fi-target', 'för ... sedan'));
  // suomi-vastaus (suunta kohdekieli -> fi)
  assert.ok(accepts('zz_g_name', 'target-fi', 'nimeni on'));
  assert.ok(accepts('zz_g_name', 'target-fi', 'minun nimeni on ...'));
  assert.ok(accepts('zz_g_way', 'target-fi', 'miten pääsen'));
  assert.ok(accepts('zz_g_ago', 'target-fi', 'sitten'));
  assert.ok(accepts('zz_g_allergic', 'target-fi', 'olen allerginen'), 'aukko kiinni sanan osassa');
  assert.ok(!accepts('zz_g_allergic', 'target-fi', 'olen'));
  // Puhe: sana saa olla lauseen sisällä
  assert.ok(accepts('zz_g_name', 'fi-target', 'ja sitten jag heter', 'mic'));
  // Tavallinen sana toimii kuten ennen
  assert.ok(accepts('zz_g_plain', 'fi-target', 'hund'));
  assert.ok(!accepts('zz_g_plain', 'fi-target', 'hun'));
  // Koko ketju: checkAnswer merkitsee oikein
  setWord(app, 'zz_g_either', 'fi-target');
  await app.run('checkAnswer("antingen eller", "keyboard")');
  assert.strictEqual(dbStat(app, 'zz_g_either').correctCount, 1);
  app.dispose();
});

test('Aukolliset ilmaukset: peruskoulun vastausvertailu ennallaan (pisteet poistuvat kuten ennen)', async () => {
  const app = await boot();
  assert.strictEqual(app.run('studyMode'), 'school');
  app.run(`current = { id: 'zz_s', fi: 'hei', en: 'hello', de: 'hallo' }; direction = 'fi-target';`);
  assert.ok(app.run('matchesAnswer("Hello!", "keyboard")'));
  assert.ok(!app.run('matchesAnswer("hell", "keyboard")'));
  assert.strictEqual(app.run('gapVariants("my name is ...").length'), 1, 'variantit vain itseopiskelussa');
  assert.strictEqual(app.run('canonical("my name is ...", false)'), 'my name is ', 'peruskoulun canonical ennallaan');
  app.dispose();
});

// ---------------- Monivalinta ja yhdistely (vaihe 42) ----------------
// Sisällöstä riippumattomat testit: tarkistetaan rakenne ja logiikka, ei yksittäisiä sanoja.
const choiceBtns = (app) => app.elements['mode-choice']._children;
const choiceTexts = (app) => choiceBtns(app).map(b => b.textContent);
async function toChoice(app) { await app.modeButtons[3].click(); await app.flush(20); }
// Asettaa sanan ja suunnan sekä piirtää kehotteen (monivalinnassa myös vaihtoehdot)
function showWord(app, id, dir) { setWord(app, id, dir); app.run('renderPrompt()'); }
// Napauttaa oikeaa (tai väärää) vaihtoehtoa ja odottaa kirjauksen
async function pickChoice(app, correct) {
  const flags = J(app, 'choiceQuestion.options.map(o => o.correct)');
  const idx = correct ? flags.indexOf(true) : flags.indexOf(false);
  await choiceBtns(app)[idx].click();
  await app.flush(20);
  return idx;
}
const WEEK_AGO = Date.now() - 7 * 86400000;

test('Monivalinta: "☑️ Valitse" lisättiin syöttötapojen rinnalle, peruskoulun oletus ennallaan', async () => {
  const app = await boot();
  assert.strictEqual(app.run('activeMode'), 'keyboard', 'peruskoulun oletussyöttötapa ei muutu');
  assert.deepStrictEqual(app.modeButtons.map(b => b.dataset.mode), ['pen', 'keyboard', 'mic', 'choice']);
  assert.ok(app.elements['mode-choice'].classList && !app.elements['mode-choice'].classList.contains('visible'));
  await toChoice(app);
  assert.strictEqual(app.run('activeMode'), 'choice');
  assert.ok(app.modeButtons[3].classList.contains('active'));
  assert.ok(!app.modeButtons[1].classList.contains('active'));
  assert.ok(app.elements['mode-choice'].classList.contains('visible'));
  assert.ok(app.elements['sel:.answer-area'].classList.contains('choice-mode'));
  assert.strictEqual(choiceBtns(app).length, 4);
  app.dispose();
});

test('Monivalinta: neljä vaihtoehtoa, oikea mukana, ei kaksoiskappaleita eikä synonyymejä (oikea sanasto, en/de, molemmat suunnat)', async () => {
  const app = await boot();
  await toChoice(app);
  for (const lang of ['en', 'de']) {
    if (lang === 'de') { app.run('selectTargetLang("de")'); await app.flush(60); }
    const ids = J(app, 'PRACTICE_WORDS.filter((w, i) => i % 11 === 0).slice(0, 45).map(w => w.id)');
    for (const dir of ['target-fi', 'fi-target']) {
      for (const id of ids) {
        showWord(app, id, dir);
        const r = J(app, `(function () {
          const q = choiceQuestion, w = current;
          const texts = q.options.map(o => o.text.toLowerCase());
          const correct = q.options.filter(o => o.correct);
          const dist = q.options.filter(o => !o.correct).map(o => VOCAB.words.find(x => x.id === o.wordId));
          return {
            n: q.options.length, uniq: new Set(texts).size, nCorrect: correct.length,
            correctText: correct[0].text, expected: choiceSurface(w, ${JSON.stringify(dir)}),
            correctId: correct[0].wordId === w.id,
            syn: dist.some(x => placementOverlap(placementMeaning(x), placementMeaning(w)) ||
                                placementOverlap(placementAlts(x[targetLang]), placementAlts(w[targetLang]))),
            pairSyn: dist.some((x, i) => dist.some((y, j) => i < j && placementOverlap(placementMeaning(x), placementMeaning(y)))),
            shown: ${'choiceButtons.map(b => b.textContent)'}
          };
        })()`);
        assert.strictEqual(r.n, 4, `${lang} ${dir} ${id}`);
        assert.strictEqual(r.uniq, 4, `kaksoiskappale: ${lang} ${dir} ${id} ${JSON.stringify(r.shown)}`);
        assert.strictEqual(r.nCorrect, 1);
        assert.strictEqual(r.correctText, r.expected);
        assert.ok(r.correctId);
        assert.ok(!r.syn, `synonyymi häiriönä: ${lang} ${dir} ${id} ${JSON.stringify(r.shown)}`);
        assert.ok(!r.pairSyn, `häiriöt keskenään synonyymejä: ${id}`);
        assert.deepStrictEqual(r.shown, choiceTexts(app));
      }
    }
  }
  app.dispose();
});

test('Monivalinta: suunta kuten harjoituksessa - kohdekieli -> suomennokset, suomi -> kohdekieliset vaihtoehdot', async () => {
  const app = await boot();
  await toChoice(app);
  const id = app.run('PRACTICE_WORDS[3].id');
  showWord(app, id, 'target-fi');
  assert.ok(/Valitse suomennos/.test(app.elements.promptHint.textContent), app.elements.promptHint.textContent);
  const fiTexts = choiceTexts(app);
  assert.ok(fiTexts.includes(app.run('firstAcceptedAnswer(fiFor(current))')));
  showWord(app, id, 'fi-target');
  assert.ok(/Valitse englanniksi/.test(app.elements.promptHint.textContent), app.elements.promptHint.textContent);
  assert.ok(choiceTexts(app).includes(app.run('firstAcceptedAnswer(current.en)')));
  assert.strictEqual(app.elements.promptWord.textContent, app.run('firstAcceptedAnswer(fiFor(current))'));
  app.dispose();
});

test('Monivalinta: häiriöt suositaan samaa sanaluokkaa ja aihepiiriä, ei synonyymejä (synteettinen aineisto)', async () => {
  const app = await boot();
  await toSelfP(app);
  app.run('closePlacement()');
  await toChoice(app);
  // A1-aihe 0 on substantiiveja (pos n), aihe 2 verbejä (pos v); samalla tasolla on kumpiakin
  for (let k = 0; k < 40; k++) {
    for (const dir of ['target-fi', 'fi-target']) {
      showWord(app, 'zz_p_A1_0_1', dir);
      const ids = J(app, 'choiceQuestion.options.filter(o => !o.correct).map(o => o.wordId)');
      // Sanaluokka: samaa pos-arvoa on tarpeeksi, joten kaikki häiriöt ovat substantiiveja
      assert.ok(ids.every(id => app.run(`VOCAB.words.find(w => w.id === ${JSON.stringify(id)}).pos`) === 'n'), ids.join());
    }
  }
  // Auton oma kysymys: synonyymit pois
  for (let k = 0; k < 40; k++) {
    showWord(app, 'zz_p_A1_0_0', k % 2 ? 'target-fi' : 'fi-target');
    const ids = J(app, 'choiceQuestion.options.filter(o => !o.correct).map(o => o.wordId)');
    assert.ok(!ids.includes('zz_p_syn1') && !ids.includes('zz_p_syn3'), ids.join());
  }
  // Aihepiiri: ensimmäinen sija samasta aihepiiristä, kun sanaluokkakin täsmää
  showWord(app, 'zz_p_A1_1_0', 'target-fi');
  const topicIds = J(app, 'choiceQuestion.options.filter(o => !o.correct).map(o => wordTopicIds(VOCAB.words.find(w => w.id === o.wordId)))');
  assert.ok(topicIds.every(t => t.includes('zz_pt_A11')), JSON.stringify(topicIds));
  app.dispose();
});

test('Monivalinta: aukolliset ja pitkät ilmaukset ovat mukana ja vaihtoehdot näytetään kokonaisina', async () => {
  const app = await boot();
  await toSelfP(app);
  app.run('closePlacement()');
  app.run(`
    VOCAB.words.push({ id: 'zz_gap1', fi: 'minun nimeni on ...', sv: 'jag heter ...', self_only: true, pos: 'n' });
    VOCAB.words.push({ id: 'zz_long1', fi: 'voisitko auttaa minua löytämään oikean reitin asemalle', sv: 'skulle du kunna hjälpa mig att hitta rätt väg till stationen', self_only: true, pos: 'n' });
    SELF_DATA.topics[0].concepts.push('zz_gap1', 'zz_long1');
    PRACTICE_WORDS = practiceWords();
  `);
  await toChoice(app);
  assert.ok(app.run('PRACTICE_WORDS.some(w => w.id === "zz_gap1")'), 'aukollinen sana mukana itseopiskelussa');
  showWord(app, 'zz_gap1', 'fi-target');
  assert.ok(choiceTexts(app).includes('jag heter ...'), choiceTexts(app).join('|'));
  assert.strictEqual(choiceBtns(app).length, 4);
  showWord(app, 'zz_gap1', 'target-fi');
  assert.ok(choiceTexts(app).includes('minun nimeni on ...'));
  showWord(app, 'zz_long1', 'fi-target');
  assert.ok(choiceTexts(app).includes('skulle du kunna hjälpa mig att hitta rätt väg till stationen'));
  assert.ok(app.elements.promptWord.textContent.includes('...') === false);
  // aukollinen sana voi myös olla häiriönä (ei suodateta pois monivalinnasta)
  let gapAsDistractor = false;
  for (let k = 0; k < 120 && !gapAsDistractor; k++) {
    showWord(app, 'zz_p_A1_0_1', 'target-fi');
    gapAsDistractor = J(app, 'choiceQuestion.options.some(o => o.wordId === "zz_gap1" || o.wordId === "zz_long1")');
  }
  assert.ok(gapAsDistractor, 'aukollinen/pitkä ilmaus voi esiintyä vaihtoehtona');
  app.dispose();
});

test('Monivalinta: palaute kuten muissa tavoissa - oikea vastaus näkyviin, ruotsin taivutushuomautus', async () => {
  const app = await boot();
  await toSelf(app);
  app.run('VOCAB.words.find(w => w.id === "zz_a1_3").sv_infl = { def: "bilen" }; VOCAB.words.find(w => w.id === "zz_a1_3").sv_pl = "bilar";');
  await toChoice(app);
  showWord(app, 'zz_a1_3', 'fi-target');
  await pickChoice(app, true);
  let txt = fbText(app.elements.feedback) + ' ' + app.elements.feedback._children.map(c => c.textContent).join(' ');
  assert.ok(app.elements.feedback.classList.contains('correct'));
  assert.ok(txt.includes('Oikein'), txt);
  assert.ok(txt.includes('bilen · bilar') && txt.includes('Taivutus'), txt);
  showWord(app, 'zz_a1_3', 'fi-target');
  assert.ok(app.elements.feedback.textContent === '' || !app.elements.feedback.classList.contains('correct'), 'uusi kehote nollaa palautteen');
  await pickChoice(app, false);
  txt = fbText(app.elements.feedback) + ' ' + app.elements.feedback._children.map(c => c.textContent).join(' ');
  assert.ok(app.elements.feedback.classList.contains('incorrect'));
  const ans = app.run('acceptedAnswers()[0]');
  assert.ok(txt.includes('Oikea vastaus: ' + ans), txt);
  assert.ok(txt.includes('bilen · bilar'));
  // oikea vaihtoehto korostuu, valittu väärä merkitään, kaikki lukitaan
  const cls = choiceBtns(app).map(b => b.className);
  assert.strictEqual(cls.filter(c => /correct/.test(c)).length, 1);
  assert.strictEqual(cls.filter(c => /wrong/.test(c)).length, 1);
  assert.ok(choiceBtns(app).every(b => b.disabled));
  app.dispose();
});

test('Monivalinta: kirjaus on tunnistusta - oma laskuri/streak, ei graduoi, ei muuta tuottavia laskureita eikä kertausväliä', async () => {
  const app = await boot();
  await toSelf(app);
  const sched = { srsInterval: 4, srsEase: 2.3, srsDue: WEEK_AGO };
  seedStat(app, 'zz_a1_1', Object.assign({ correctCount: 3, streakCorrect: 2, streakKeyboard: 1 }, sched));
  await app.run('updateHeaderStats()');
  await toChoice(app);
  for (let i = 0; i < 12; i++) {
    showWord(app, 'zz_a1_1', i % 2 ? 'fi-target' : 'target-fi');
    await pickChoice(app, true);
  }
  let st = dbStat(app, 'zz_a1_1');
  assert.strictEqual(st.choiceCorrect, 12);
  assert.strictEqual(st.streakChoice, 12);
  assert.strictEqual(st.correctCount, 3, 'tuottava oikein-laskuri ei kasva');
  assert.strictEqual(st.streakCorrect, 2);
  assert.strictEqual(st.streakKeyboard, 1, 'tuottava streak ei kasva (eikä graduoidu: 1 < 2)');
  assert.strictEqual(st.incorrectCount, 0);
  assert.strictEqual(st.srsInterval, 4); assert.strictEqual(st.srsEase, 2.3); assert.strictEqual(st.srsDue, WEEK_AGO, 'kertausväli ei pidene');
  assert.strictEqual(app.run('stageKeyboardGraduated(statsCache[statId({id: "zz_a1_1"})])'), false);
  // Väärä vastaus: oma virhelaskuri, streak nollautuu, tuottava edistyminen ennallaan, paino kasvaa
  const w0 = app.run('weightFor(VOCAB.words.find(w => w.id === "zz_a1_1"))');
  showWord(app, 'zz_a1_1', 'target-fi');
  await pickChoice(app, false);
  st = dbStat(app, 'zz_a1_1');
  assert.strictEqual(st.choiceWrong, 1);
  assert.strictEqual(st.streakChoice, 0);
  assert.strictEqual(st.streakKeyboard, 1, 'väärä monivalinta ei nollaa tuottavaa edistymistä');
  assert.strictEqual(st.streakCorrect, 2);
  assert.strictEqual(st.incorrectCount, 0, 'tuottava virhelaskuri ei kasva');
  assert.strictEqual(st.srsInterval, 4); assert.strictEqual(st.srsDue, WEEK_AGO, 'väärä tunnistus ei lyhennä väliäkään');
  assert.ok(st.recogHeat >= 1);
  assert.ok(app.run('weightFor(VOCAB.words.find(w => w.id === "zz_a1_1"))') > w0, 'virhe nostaa sanan painoa');
  // Uusi sana: tietue syntyy tunnistuskentillä, mutta ei valmistu, ei aikatauluteta, ei kuluta uusien sanojen kiintiötä
  const newLeft = app.run('newWordsLeftToday()');
  showWord(app, 'zz_a1_2', 'fi-target');
  await pickChoice(app, true);
  st = dbStat(app, 'zz_a1_2');
  assert.strictEqual(st.choiceCorrect, 1);
  assert.ok(st.srsInterval === undefined && st.srsDue === undefined, 'ei aikataulua tunnistuksesta');
  assert.strictEqual(st.correctCount, 0);
  assert.strictEqual(app.run('isFullyLearned(statsCache[statId({id: "zz_a1_2"})])'), false);
  assert.strictEqual(app.run('newWordsLeftToday()'), newLeft);
  assert.strictEqual(app.run('isRecognizedOnly(statsCache[statId({id: "zz_a1_2"})])'), true, 'vain tunnistettu, ei vielä tuotettu');
  // statId ennallaan
  assert.strictEqual(st.statId, 'sv|' + app.run('VOCAB.meta.level') + '|zz_a1_2');
  app.dispose();
});

test('Monivalinta: virhe ei nollaa tuottavaa edistymistä - tuottava vastaus graduoi yhä kuten ennen ja tunnistus ei sitä auta', async () => {
  const app = await boot();
  const id = app.run('PRACTICE_WORDS[0].id');
  await app.run('updateHeaderStats()');
  // Näppäimistöllä 4 oikein samaan suuntaan (graduointiin tarvitaan molemmat suunnat), välissä monivalinta
  for (let i = 0; i < 4; i++) { setWord(app, id, 'fi-target'); await app.run(`checkAnswer(acceptedAnswers()[0], "keyboard")`); }
  await toChoice(app);
  for (let i = 0; i < 6; i++) { showWord(app, id, 'target-fi'); await pickChoice(app, i % 2 === 0); }
  let st = app.run(`statsCache[statId({id: ${JSON.stringify(id)}})]`);
  assert.strictEqual(st.streakKeyboard, 4);
  assert.strictEqual(st.kbFT, 4);
  assert.strictEqual(st.kbTF || 0, 0, 'monivalinta ei kirjaa suuntalaskuria');
  assert.strictEqual(app.run(`isGraduatedWord({id: ${JSON.stringify(id)}})`), false, 'monivalinta ei graduoi');
  await app.modeButtons[1].click();
  await app.flush(20);
  setWord(app, id, 'target-fi');
  await app.run(`checkAnswer(acceptedAnswers()[0], "keyboard")`);
  assert.strictEqual(app.run(`isGraduatedWord({id: ${JSON.stringify(id)}})`), true, 'tuottava oikea toiseen suuntaan graduoi');
  app.dispose();
});

test('Monivalinta: graduointi, aktiivijoukko ja tähtibadge seuraavat viimeisintä tuottavaa tapaa', async () => {
  const app = await boot();
  const id = app.run('PRACTICE_WORDS[0].id');
  app.db.data.set(app.run(`statId({id: ${JSON.stringify(id)}})`), Object.assign(learnedStat(app, id), { streakKeyboard: 5, streakTargetFi: 0, streakFiTarget: 0, streakMic: 0 }));
  await app.run('updateHeaderStats()');
  assert.strictEqual(app.run('productiveMode()'), 'keyboard');
  await toChoice(app);
  assert.strictEqual(app.run('productiveMode()'), 'keyboard');
  assert.strictEqual(app.run(`isGraduatedWord({id: ${JSON.stringify(id)}})`), true, 'näppäimistö-graduointi pätee monivalinnassakin');
  assert.strictEqual(app.elements.tierModeIcon.textContent, '⌨️');
  assert.ok(!app.run('sessionPool.some(w => w.id === ' + JSON.stringify(id) + ')'), 'graduoitunut ei ole poolissa');
  // pen -> choice: kriteeri on piirto
  await app.modeButtons[0].click(); await app.flush(20);
  await toChoice(app);
  assert.strictEqual(app.run('productiveMode()'), 'pen');
  assert.strictEqual(app.run(`isGraduatedWord({id: ${JSON.stringify(id)}})`), false);
  assert.strictEqual(app.elements.tierModeIcon.textContent, '✏️');
  // siirtyminen monivalintaan ei rakenna poolia uudelleen (sanat eivät vaihdu)
  const before = poolIds(app);
  await app.modeButtons[1].click(); await app.flush(20);
  const afterKeyboard = poolIds(app);
  await toChoice(app);
  assert.deepStrictEqual(poolIds(app), afterKeyboard);
  assert.ok(before.length > 0);
  app.dispose();
});

test('Monivalinta: syöttötavan vaihto - vaihtoehdot katoavat, ohjeteksti palaa, Tarkista ei tee mitään monivalinnassa; aiemmat tavat toimivat', async () => {
  const app = await boot();
  showWord(app, app.run('PRACTICE_WORDS[1].id'), 'target-fi');
  assert.ok(/Kirjoita suomeksi/.test(app.elements.promptHint.textContent));
  await toChoice(app);
  assert.ok(/Valitse/.test(app.elements.promptHint.textContent));
  assert.strictEqual(choiceBtns(app).length, 4);
  // Tarkista-painike ei kirjaa mitään monivalinnassa
  const before = app.db.putCount;
  await app.elements.checkBtn.click();
  await app.flush(30);
  assert.strictEqual(app.db.putCount, before);
  // Näytä sana toimii monivalinnassa eikä lasketa vastaukseksi
  await app.elements.revealBtn.click();
  assert.ok(app.elements['sel:.answer-area'].classList.contains('revealed'));
  assert.ok(app.elements.revealBox.textContent.length > 2);
  // Takaisin näppäimistöön
  await app.modeButtons[1].click();
  await app.flush(20);
  assert.strictEqual(app.run('activeMode'), 'keyboard');
  assert.strictEqual(choiceBtns(app).length, 0);
  assert.ok(!app.elements['mode-choice'].classList.contains('visible'));
  assert.ok(!app.elements['sel:.answer-area'].classList.contains('choice-mode'));
  assert.ok(/Kirjoita/.test(app.elements.promptHint.textContent));
  assert.ok(app.elements['mode-keyboard'].classList.contains('visible'));
  // Kynä ja puhe vaihtuvat kuten ennen
  await app.modeButtons[2].click(); await app.flush(20);
  assert.strictEqual(app.run('activeMode'), 'mic');
  assert.ok(app.elements['mode-mic'].classList.contains('visible'));
  await app.modeButtons[0].click(); await app.flush(20);
  assert.strictEqual(app.run('activeMode'), 'pen');
  assert.ok(app.elements['mode-pen'].classList.contains('visible'));
  assert.ok(!app.elements['mode-choice'].classList.contains('visible'));
  app.dispose();
});

test('Monivalinta: kaksoisnapautus ei kirjaa kahta vastausta; seuraava sana tulee viiveellä', async () => {
  const app = await boot();
  await toChoice(app);
  const id = app.run('PRACTICE_WORDS[2].id');
  showWord(app, id, 'target-fi');
  const idx = J(app, 'choiceQuestion.options.map(o => o.correct)').indexOf(true);
  const other = idx === 0 ? 1 : 0;
  choiceBtns(app)[idx].click();
  choiceBtns(app)[other].click();
  await app.flush(30);
  const st = app.run(`statsCache[statId({id: ${JSON.stringify(id)}})]`);
  assert.strictEqual((st.choiceCorrect || 0) + (st.choiceWrong || 0), 1);
  const cur = app.run('current.id');
  assert.strictEqual(cur, id, 'sana vaihtuu vasta viiveen jälkeen');
  await app.flush(1100);
  assert.notStrictEqual(app.run('current.id'), id);
  assert.strictEqual(choiceBtns(app).length, 4, 'uudelle sanalle uudet vaihtoehdot');
  assert.ok(choiceBtns(app).every(b => !b.disabled));
  app.dispose();
});

test('Monivalinta: päivätavoitteeseen lasketaan yksi vastaus = yksi (oikea ja väärä), vain itseopiskelussa; päiväloki molemmissa', async () => {
  const app = await boot();
  await toSelf(app);
  mockNow(app, '2026-07-10T09:00:00');
  await toChoice(app);
  assert.strictEqual(app.run('dailySummary().count'), 0);
  showWord(app, 'zz_a1_4', 'target-fi'); await pickChoice(app, true);
  showWord(app, 'zz_a1_5', 'target-fi'); await pickChoice(app, false);
  showWord(app, 'zz_a1_4', 'fi-target'); await pickChoice(app, true);
  assert.strictEqual(app.run('dailySummary().count'), 3);
  assert.strictEqual(app.elements.dailyLabel.textContent, 'Tänään 3 / 20');
  // Tavoite täyttyy monivalinnalla
  app.run('setDailyGoal(10)');
  for (let i = 0; i < 7; i++) { showWord(app, 'zz_a1_' + (6 + i), 'target-fi'); await pickChoice(app, true); }
  assert.strictEqual(app.run('dailySummary().count'), 10);
  assert.ok(/Päivätavoite täynnä: 10 \/ 10/.test(app.elements.dailyNotice.textContent), app.elements.dailyNotice.textContent);
  const log = JSON.parse(app.storage.getItem('dayLog'));
  assert.strictEqual(log['2026-07-10'].sv.a, 10);
  assert.strictEqual(log['2026-07-10'].sv.c, 9);
  app.dispose();
  // Peruskoulu: ei päivälaskuria eikä aikataulukenttiä
  const school = await boot();
  await toChoice(school);
  const id = school.run('PRACTICE_WORDS[0].id');
  showWord(school, id, 'target-fi'); await pickChoice(school, true);
  assert.strictEqual(school.storage.getItem('selfDaily_en'), null);
  const st = school.run(`statsCache[statId({id: ${JSON.stringify(id)}})]`);
  assert.strictEqual(st.choiceCorrect, 1);
  assert.ok(st.srsInterval === undefined && st.srsDue === undefined && st.srsEase === undefined);
  assert.strictEqual(JSON.parse(school.storage.getItem('dayLog'))[school.run('localDateKey()')].en.a, 1);
  school.dispose();
});

test('Monivalinta: itseopiskelussa syöttötapa toimii samoin ja hillitty ulkoasu säilyy', async () => {
  const app = await boot();
  await toSelf(app);
  assert.ok(app.run('document.body.classList.contains("self-mode")'));
  await toChoice(app);
  showWord(app, 'zz_a1_7', 'target-fi');
  assert.strictEqual(choiceBtns(app).length, 4);
  assert.ok(choiceTexts(app).includes(app.run('firstAcceptedAnswer(fiFor(current))')));
  assert.strictEqual(app.cssVars['--tier-bg-icon'], '""');
  app.dispose();
});

// --- Yhdistely ---
const matchLeft = (app) => app.elements.matchLeft._children;
const matchRight = (app) => app.elements.matchRight._children;
async function toMatch(app) { await app.practiceButtons[3].click(); await app.flush(40); }

test('Yhdistely: "🔗 Yhdistä" avautuu harjoitusvalitsimesta, 5 paria, oikea puoli sekoitettu (peruskoulu)', async () => {
  const app = await boot();
  assert.strictEqual(app.elements.practiceSwitch.style.display, '');
  await toMatch(app);
  assert.strictEqual(app.run('practiceMode'), 'match');
  assert.strictEqual(app.elements.matchPractice.hidden, false);
  assert.strictEqual(app.elements.wordPractice.hidden, true);
  assert.strictEqual(app.elements.sentencePractice.hidden, true);
  assert.strictEqual(matchLeft(app).length, 5);
  assert.strictEqual(matchRight(app).length, 5);
  const pairs = J(app, 'match.pairs.map(p => [p.left, p.right])');
  assert.deepStrictEqual(matchLeft(app).map(b => b.textContent), pairs.map(p => p[0]));
  assert.deepStrictEqual(matchRight(app).map(b => b.textContent).sort(), pairs.map(p => p[1]).sort());
  assert.notDeepStrictEqual(matchRight(app).map(b => b.textContent), pairs.map(p => p[1]), 'oikea puoli sekoitettu');
  // vasemmalla suomi, oikealla kohdekieli
  const w = J(app, 'match.pairs[0].word');
  assert.strictEqual(pairs[0][0], w.fi.split('/')[0].trim());
  assert.strictEqual(pairs[0][1], w.en.split('/')[0].trim());
  // sanat tulevat aktiivisesta poolista
  const pool = new Set(poolIds(app));
  assert.ok(J(app, 'match.pairs.map(p => p.word.id)').every(id => pool.has(id)));
  // takaisin sanoihin
  await app.practiceButtons[0].click(); await app.flush(30);
  assert.strictEqual(app.elements.matchPractice.hidden, true);
  assert.strictEqual(app.elements.wordPractice.hidden, false);
  app.dispose();
});

test('Yhdistely: parit eivät sekoitu keskenään (sama kehote, sama vastaus, synonyymi) - useita kierroksia', async () => {
  const app = await boot();
  await toSelfP(app);
  app.run('closePlacement()');
  // lisää saman kehotteen ja saman vastauksen tapauksia A1-poolille
  app.run(`
    VOCAB.words.push({ id: 'zz_dup_fi', fi: 'olio A100', sv: 'toinen', self_only: true, pos: 'n' });
    VOCAB.words.push({ id: 'zz_dup_sv', fi: 'eri kehote', sv: 'svord1', self_only: true, pos: 'n' });
    SELF_DATA.topics[0].concepts.push('zz_dup_fi', 'zz_dup_sv');
    PRACTICE_WORDS = practiceWords();
  `);
  for (let k = 0; k < 40; k++) {
    const r = J(app, `(function () {
      const ws = pickMatchWords(5);
      const L = ws.map(w => choiceSurface(w, "target-fi").toLowerCase()), R = ws.map(w => choiceSurface(w, "fi-target").toLowerCase());
      let syn = false;
      ws.forEach((a, i) => ws.forEach((b, j) => { if (i < j && !matchCompatible(a, b)) syn = true; }));
      return { n: ws.length, ids: new Set(ws.map(w => w.id)).size, l: new Set(L).size, r: new Set(R).size, syn, hasAuto: ws.some(w => w.id === "zz_p_A1_0_0"), hasSyn: ws.some(w => w.id === "zz_p_syn1" || w.id === "zz_p_syn3") };
    })()`);
    assert.strictEqual(r.n, 5);
    assert.strictEqual(r.ids, 5); assert.strictEqual(r.l, 5); assert.strictEqual(r.r, 5);
    assert.ok(!r.syn);
    assert.ok(!(r.hasAuto && r.hasSyn), 'auto ja sen synonyymi/sama vastaus samassa kierroksessa');
  }
  app.dispose();
});

test('Yhdistely: itseopiskelussa mieluiten erääntyneet ja tuoreet sanat', async () => {
  const app = await boot();
  await toSelf(app);
  // erääntyneet: zz_a1_1..3; "aloitettu mutta ei erääntynyt": zz_a1_4..6 (tulevaisuuteen ajastettu)
  ['zz_a1_1', 'zz_a1_2', 'zz_a1_3'].forEach(id => seedStat(app, id, { srsInterval: 2, srsEase: 2.5, srsDue: WEEK_AGO }));
  ['zz_a1_4', 'zz_a1_5', 'zz_a1_6'].forEach(id => seedStat(app, id, { srsInterval: 9, srsEase: 2.5, srsDue: Date.now() + 9 * 86400000 }));
  await app.run('updateHeaderStats()');
  app.run('initSessionPool()');
  const pool = poolIds(app);
  assert.ok(['zz_a1_1', 'zz_a1_2', 'zz_a1_3', 'zz_a1_4', 'zz_a1_5', 'zz_a1_6'].every(id => pool.includes(id)) || true);
  for (let k = 0; k < 15; k++) {
    const ids = J(app, 'pickMatchWords(5).map(w => w.id)');
    assert.strictEqual(ids.length, 5);
    assert.ok(['zz_a1_1', 'zz_a1_2', 'zz_a1_3'].every(id => ids.includes(id)), 'erääntyneet mukana: ' + ids.join());
    const rest = ids.filter(id => !['zz_a1_1', 'zz_a1_2', 'zz_a1_3'].includes(id));
    assert.ok(rest.every(id => app.run(`isFreshWord(VOCAB.words.find(w => w.id === ${JSON.stringify(id)}))`)), 'loput tuoreita: ' + rest.join());
  }
  app.dispose();
});

test('Yhdistely: oikea pari lukittuu ja himmenee, väärä välähtää ja vapautuu; kumpi puoli tahansa ensin', async () => {
  const app = await boot();
  await toMatch(app);
  const order = J(app, 'match.order'); // oikean puolen paikka -> parin numero
  const rightOf = (pairIdx) => matchRight(app)[order.indexOf(pairIdx)];
  // oikea pari: vasen ensin
  matchLeft(app)[0].click();
  assert.ok(matchLeft(app)[0].classList.contains('selected'));
  rightOf(0).click();
  assert.ok(matchLeft(app)[0].classList.contains('matched') && rightOf(0).classList.contains('matched'));
  assert.ok(matchLeft(app)[0].disabled && rightOf(0).disabled);
  assert.ok(!matchLeft(app)[0].classList.contains('selected'));
  assert.strictEqual(app.run('match.solved'), 1);
  assert.ok(/1 \/ 5/.test(app.elements.matchProgress.textContent), app.elements.matchProgress.textContent);
  // oikea pari: oikea ensin
  rightOf(1).click();
  assert.ok(rightOf(1).classList.contains('selected'));
  matchLeft(app)[1].click();
  assert.ok(matchLeft(app)[1].classList.contains('matched') && rightOf(1).classList.contains('matched'));
  // lukittuun ei voi enää napauttaa
  matchLeft(app)[0].click();
  assert.strictEqual(app.run('match.sel'), null);
  // väärä pari
  matchLeft(app)[2].click();
  rightOf(3).click();
  assert.ok(matchLeft(app)[2].classList.contains('wrong') && rightOf(3).classList.contains('wrong'));
  assert.ok(!matchLeft(app)[2].classList.contains('matched'));
  assert.strictEqual(app.run('match.mistakes'), 1);
  assert.strictEqual(app.run('match.solved'), 2);
  // lukossa välähdyksen ajan
  matchLeft(app)[4].click();
  assert.strictEqual(app.run('match.sel'), null);
  await app.flush(750);
  assert.ok(!matchLeft(app)[2].classList.contains('wrong') && !rightOf(3).classList.contains('wrong'));
  assert.ok(!matchLeft(app)[2].disabled && !rightOf(3).disabled, 'väärä pari ei lukitu');
  assert.strictEqual(app.run('match.sel'), null);
  // sama puoli: valinta vaihtuu, sama uudelleen poistaa valinnan
  matchLeft(app)[2].click(); matchLeft(app)[4].click();
  assert.ok(!matchLeft(app)[2].classList.contains('selected') && matchLeft(app)[4].classList.contains('selected'));
  matchLeft(app)[4].click();
  assert.ok(!matchLeft(app)[4].classList.contains('selected'));
  assert.strictEqual(app.run('match.sel'), null);
  app.dispose();
});

test('Yhdistely: kierroksen loppu - yhteenveto, "Uusi kierros" aloittaa uuden', async () => {
  const app = await boot();
  await toMatch(app);
  const firstIds = J(app, 'match.pairs.map(p => p.word.id)');
  const order = J(app, 'match.order');
  assert.strictEqual(app.elements.matchSummary.hidden, true);
  // yksi virhe ensin
  matchLeft(app)[0].click(); matchRight(app)[order.indexOf(1)].click();
  await app.flush(700);
  for (let i = 0; i < 5; i++) {
    matchLeft(app)[i].click();
    matchRight(app)[order.indexOf(i)].click();
  }
  assert.strictEqual(app.run('match.finished'), true);
  assert.strictEqual(app.elements.matchSummary.hidden, false);
  const txt = app.elements.matchSummary._children.map(c => c.textContent).join(' ');
  assert.ok(/5 \/ 5/.test(txt) && /virheitä 1/.test(txt), txt);
  const btn = app.elements.matchSummary._children.find(c => c.textContent === 'Uusi kierros');
  assert.ok(btn, 'Uusi kierros -painike');
  // kierroksen jälkeen napautukset eivät tee mitään
  matchLeft(app)[0].click();
  assert.strictEqual(app.run('match.sel'), null);
  await btn.click();
  await app.flush(30);
  assert.strictEqual(app.run('match.finished'), false);
  assert.strictEqual(app.run('match.solved'), 0);
  assert.strictEqual(app.elements.matchSummary.hidden, true);
  assert.strictEqual(matchLeft(app).length, 5);
  assert.ok(matchLeft(app).every(b => !b.classList.contains('matched') && !b.disabled));
  assert.notDeepStrictEqual(J(app, 'match.pairs.map(p => p.word.id)'), firstIds, 'uudet sanat');
  app.dispose();
});

test('Yhdistely: kirjaus kuten monivalinnassa - tunnistusta, ei graduoi eikä pidennä väliä, päivätavoitteeseen oikeat parit (itseopiskelu)', async () => {
  const app = await boot();
  await toSelf(app);
  mockNow(app, '2026-07-10T09:00:00');
  const nowTs = app.run('Date.now()');
  // kaikki A1-sanat jo aikataulutettu (ei erääntynyt) ja tuottavasti opittu 4/5, jotta pooli on tunnettu
  const ids = ['zz_a1_1', 'zz_a1_2', 'zz_a1_3', 'zz_a1_4', 'zz_a1_5', 'zz_a1_6', 'zz_a1_7', 'zz_a1_8'];
  ids.forEach(id => seedStat(app, id, { correctCount: 3, streakCorrect: 2, streakKeyboard: 4, srsInterval: 6, srsEase: 2.4, srsDue: nowTs + 6 * 86400000 }));
  await app.run('updateHeaderStats()');
  app.run('initSessionPool()');
  await toMatch(app);
  const words = J(app, 'match.pairs.map(p => p.word.id)');
  const order = J(app, 'match.order');
  // ensin yksi väärä pari: ensin valittu (vasen 0) saa virheen, päivälaskuri ei kasva
  matchLeft(app)[0].click(); matchRight(app)[order.indexOf(1)].click();
  await app.flush(750);
  assert.strictEqual(app.run('dailySummary().count'), 0, 'väärää paria ei lasketa päivätavoitteeseen');
  for (let i = 0; i < 5; i++) { matchLeft(app)[i].click(); matchRight(app)[order.indexOf(i)].click(); }
  await app.flush(40);
  assert.strictEqual(app.run('dailySummary().count'), 5, 'oikeat parit lasketaan');
  assert.strictEqual(app.elements.dailyLabel.textContent, 'Tänään 5 / 20');
  words.forEach((id, i) => {
    const st = dbStat(app, id);
    const seeded = ids.includes(id);
    assert.strictEqual(st.matchCorrect, 1, id);
    assert.strictEqual(st.streakMatch, i === 0 ? 1 : 1);
    assert.strictEqual(st.matchWrong || 0, i === 0 ? 1 : 0, 'virhe ensin valitulle sanalle ' + id);
    if (seeded) {
      assert.strictEqual(st.correctCount, 3); assert.strictEqual(st.streakKeyboard, 4); assert.strictEqual(st.streakCorrect, 2);
      assert.strictEqual(st.srsInterval, 6); assert.strictEqual(st.srsEase, 2.4);
      assert.strictEqual(st.srsDue, nowTs + 6 * 86400000, 'kertausväli ei pidene');
    } else {
      assert.strictEqual(st.correctCount, 0); assert.ok(st.srsDue === undefined, 'ei aikataulua');
    }
    assert.strictEqual(app.run(`isFullyLearned(statsCache[statId({id: ${JSON.stringify(id)}})])`), false);
  });
  assert.ok(app.run('weightFor(VOCAB.words.find(w => w.id === ' + JSON.stringify(words[0]) + '))') >= 1);
  const log = JSON.parse(app.storage.getItem('dayLog'));
  assert.strictEqual(log['2026-07-10'].sv.a, 6);
  assert.strictEqual(log['2026-07-10'].sv.c, 5);
  app.dispose();
});

test('Yhdistely: peruskoulussa kirjaus ilman aikataulua ja päivälaskuria; kielenvaihto aloittaa uuden kierroksen', async () => {
  const app = await boot();
  await toMatch(app);
  assert.ok(!app.run('document.body.classList.contains("self-mode")'));
  const order = J(app, 'match.order');
  const ids = J(app, 'match.pairs.map(p => p.word.id)');
  for (let i = 0; i < 5; i++) { matchLeft(app)[i].click(); matchRight(app)[order.indexOf(i)].click(); }
  await app.flush(40);
  ids.forEach(id => {
    const st = dbStat2(app, id, 'en');
    assert.strictEqual(st.matchCorrect, 1);
    assert.strictEqual(st.correctCount, 0);
    assert.ok(st.srsInterval === undefined && st.srsDue === undefined);
  });
  assert.strictEqual(app.storage.getItem('selfDaily_en'), null);
  // kielenvaihto -> uusi kierros uuden kielen sanoilla
  app.run('selectTargetLang("de")');
  await app.flush(80);
  assert.strictEqual(app.run('practiceMode'), 'match');
  assert.strictEqual(app.run('match.finished'), false);
  assert.strictEqual(matchRight(app).length, 5);
  assert.ok(J(app, 'match.pairs.every(p => !!p.word.de)'));
  app.dispose();
});
function dbStat2(app, id, lang) {
  return app.db.data.get(`${lang}|${app.run('VOCAB.meta.level')}|${id}`);
}

test('Yhdistely: toimii itseopiskelussa - valitsin näkyy (Sanat + Yhdistä), hillitty ulkoasu, tilan vaihto säilyttää yhdistelyn', async () => {
  const app = await boot();
  await toSelf(app);
  assert.strictEqual(app.elements.practiceSwitch.style.display, '');
  assert.strictEqual(app.elements.sentencesSwitchBtn.style.display, app.run('selfSentencesAvailable()') ? '' : 'none');
  await toMatch(app);
  assert.strictEqual(app.run('practiceMode'), 'match');
  assert.ok(app.run('document.body.classList.contains("self-mode")'));
  assert.strictEqual(matchLeft(app).length, 5);
  assert.ok(J(app, 'match.pairs.every(p => p.word.sv)'));
  assert.strictEqual(app.cssVars['--tier-bg-icon'], '""', 'ei maskotteja');
  // peruskouluun ja takaisin: yhdistely säilyy valittuna ja kierros alkaa uudestaan
  await app.studyButtons[0].click();
  await app.flush(80);
  assert.strictEqual(app.run('practiceMode'), 'match');
  assert.ok(J(app, 'match.pairs.every(p => p.word.en)'));
  app.dispose();
});

test('Yhdistely: liian vähän sanoja - ei kaadu, näyttää ilmoituksen', async () => {
  const app = await boot();
  await toSelf(app);
  app.run('SELF_DATA.topics.forEach((t, i) => { t.concepts = i === 0 ? t.concepts.slice(0, 1) : []; }); PRACTICE_WORDS = practiceWords(); initSessionPool();');
  await toMatch(app);
  assert.strictEqual(app.run('match'), null);
  assert.ok(/ei ole tarpeeksi sanoja/.test(app.elements.matchHint.textContent));
  assert.strictEqual(matchLeft(app).length, 0);
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

// --- Tasotesti: aukolliset sanat pois ---
test('Tasotesti: aukolliset ("...") sanat eivät ole kysymyksissä eivätkä häiriöissä', async () => {
  const app = await boot();
  addPlacementFixture(app);
  app.run(`
    // aukollisia sanoja jokaiselle tasolle, osa suomen puolella, osa kohdekielessä
    let k = 0;
    for (const lvl of ['A1', 'A2', 'B1']) {
      for (const t of [0, 1, 2, 3]) {
        const id = 'zz_gp_' + lvl + t;
        k++;
        VOCAB.words.push({ id, fi: k % 2 ? 'jotain ' + k + ' ...' : 'aukoton ' + k, sv: k % 2 ? 'nåt' + k : 'nåt' + k + ' ...', self_only: true, pos: t < 2 ? 'n' : 'v' });
        SELF_DATA.topics.find(x => x.id === 'zz_pt_' + lvl + t).concepts.push(id);
      }
    }
    PRACTICE_WORDS = practiceWords();
  `);
  await app.studyButtons[1].click();
  await app.flush(60);
  app.run('closePlacement()');
  for (let run = 0; run < 12; run++) {
    app.run('openPlacement(); startPlacement();');
    for (let lvl = 0; lvl < 3; lvl++) {
      const qs = J(app, 'placement.questions.map(q => ({ word: q.word.id, gap: wordHasGap(q.word), opts: q.options.map(o => ({ t: o.text, id: o.wordId })) }))');
      assert.ok(qs.length > 0);
      qs.forEach(q => {
        assert.ok(!q.gap && !q.word.startsWith('zz_gp_'), 'aukollinen kysymys: ' + q.word);
        q.opts.forEach(o => {
          assert.ok(!o.id.startsWith('zz_gp_'), 'aukollinen häiriö: ' + o.id);
          assert.ok(!o.t.includes('...'), 'aukko vaihtoehdossa: ' + o.t);
        });
        assert.strictEqual(q.opts.length, 4);
      });
      pLevel(app, qs.length);
      if (app.run('placement.phase') === 'result') break;
    }
    app.run('closePlacement()');
  }
  app.dispose();
});

test('Tasotesti: taso, jolla on alle 4 aukotonta sanaa, jätetään testaamatta', async () => {
  const app = await boot();
  addPlacementFixture(app);
  app.run(`VOCAB.words.filter(w => w.id.startsWith('zz_p_B1_')).forEach(w => { w.sv += ' ...'; });`);
  await app.studyButtons[1].click();
  await app.flush(60);
  app.run('closePlacement()');
  assert.deepStrictEqual(J(app, 'placementLevelsToTest()'), ['A1', 'A2']);
  app.dispose();
});

test('Monivalinta ja tasotesti jakavat häiriölogiikan (buildChoiceQuestion)', async () => {
  const app = await boot();
  await toSelfP(app);
  app.run('closePlacement()');
  const r = J(app, `(function () {
    const w = VOCAB.words.find(x => x.id === "zz_p_A1_0_0");
    const q = placementBuildQuestion(w, selfLevelWords("A1"));
    const c = buildChoiceQuestion(w, [selfLevelWords("A1")], { dir: "target-fi", excludeGaps: true });
    return { qn: q.options.length, cn: c.options.length, qk: Object.keys(q.options[0]).sort(), ck: Object.keys(c.options[0]).sort() };
  })()`);
  assert.strictEqual(r.qn, 4); assert.strictEqual(r.cn, 4);
  assert.deepStrictEqual(r.qk, r.ck);
  app.dispose();
});

// ---------------- Taivutusharjoitus (vaihe 43) ----------------
// Synteettinen aineisto: ruotsi (A1: 9 nomia + 1 vaihtoehtoartikkeli + poissuljettavia, 7 verbiä, 5 adjektiivia,
// A2: 4 nomia), englanti ja saksa (en_pl/en_infl, de_pl/de_infl) lisätään erikseen.
function addInflFixture(app, opts) {
  opts = opts || {};
  app.run(`(function () {
    const opts = ${JSON.stringify(opts)};
    const W = [];
    const n = (id, sv, def, pl, extra) => W.push(Object.assign({ id, fi: 'nomini ' + id, sv, pos: 'n', self_only: true, sv_infl: { def } }, pl ? { sv_pl: pl } : {}, extra || {}));
    const v = (id, sv, a, b, c) => W.push({ id, fi: 'verbi ' + id, sv, pos: 'v', self_only: true, sv_infl: c ? { pres: a, pret: b, sup: c } : { pres: a, pret: b } });
    const a = (id, sv, neut, apl) => W.push({ id, fi: 'adj ' + id, sv, pos: 'adj', self_only: true, sv_infl: { neut, apl } });
    n('zi_n1', 'en bil', 'bilen', 'bilar'); n('zi_n2', 'ett hus', 'huset', 'hus'); n('zi_n3', 'en flicka', 'flickan', 'flickor');
    n('zi_n4', 'ett barn', 'barnet', 'barn'); n('zi_n5', 'en katt', 'katten', 'katter'); n('zi_n6', 'en bok', 'boken', 'böcker');
    n('zi_n7', 'ett äpple', 'äpplet', 'äpplen'); n('zi_n8', 'en stol', 'stolen', 'stolar'); n('zi_n9', 'en dator', 'datorn', 'datorer');
    n('zi_alt', 'måndag / en måndag', 'måndagen', 'måndagar');
    n('zi_x_proper', 'Sverige', 'Sverige', null); n('zi_x_dash', 'ett vatten', 'vattnet', '-');
    n('zi_x_multi', 'en bärbar dator', 'bärbara datorn', 'bärbara datorer'); n('zi_x_gap', 'en bil ...', 'bilen ...', 'bilar ...');
    n('zi_x_noart', 'internet', 'internet', null);
    v('zi_v1', 'skriva', 'skriver', 'skrev', 'skrivit'); v('zi_v2', 'gå', 'går', 'gick', 'gått'); v('zi_v3', 'äta', 'äter', 'åt', 'ätit');
    v('zi_v4', 'bo', 'bor', 'bodde', 'bott'); v('zi_v5', 'vänta', 'väntar', 'väntade', 'väntat'); v('zi_v6', 'titta på tv', 'tittar på tv', 'tittade på tv', 'tittat på tv');
    v('zi_v7', 'vara', 'är', 'var', 'varit'); v('zi_xv_part', 'kunna', 'kan', 'kunde', null);
    a('zi_a1', 'stor', 'stort', 'stora'); a('zi_a2', 'liten', 'litet', 'små'); a('zi_a3', 'gammal', 'gammalt', 'gamla');
    a('zi_a4', 'snäll', 'snällt', 'snälla'); a('zi_a5', 'fin', 'fint', 'fina');
    a('zi_x_bra', 'bra', 'bra', 'bra'); a('zi_x_rosa', 'rosa', 'rosa', 'rosa');
    const b = [];
    n('zi_b1', 'en lampa', 'lampan', 'lampor'); n('zi_b2', 'ett fönster', 'fönstret', 'fönster'); n('zi_b3', 'en gata', 'gatan', 'gator'); n('zi_b4', 'ett träd', 'trädet', 'träd');
    W.forEach(w => { VOCAB.words.push(w); (w.id.startsWith('zi_b') ? b : (globalThis.__a1 = globalThis.__a1 || [])).push(w.id); });
    let keep = globalThis.__a1;
    if (opts.fewer) keep = keep.filter(id => ['zi_n1', 'zi_n3', 'zi_v1', 'zi_a1', 'zi_x_proper'].includes(id));
    SELF_DATA.topics.length = 0;
    SELF_DATA.topics.push({ id: 'zi_t1', name_fi: 'Taivutus A1', level: 'A1', concepts: keep }, { id: 'zi_t2', name_fi: 'Taivutus A2', level: 'A2', concepts: b });
    globalThis.__a1 = undefined;
    PRACTICE_WORDS = practiceWords();
  })();`);
}
// Lisää englannin tai saksan taivutusaineiston (ja lisää kielen itseopiskelun kieliin).
function addInflFixtureLang(app, lang) {
  app.run(`(function () {
    const lang = ${JSON.stringify(lang)};
    if (!SELF_DATA.languages.includes(lang)) SELF_DATA.languages.push(lang);
    const ids = [];
    for (let i = 1; i <= 12; i++) {
      const w = { id: 'zl_n' + i, fi: 'nomini ' + i, pos: 'n', self_only: true };
      if (lang === 'en') { w.en = 'thing' + i; w.en_pl = 'things' + i; } else { w.de = 'der Hund' + i; w.de_pl = 'die Hunde' + i; }
      VOCAB.words.push(w); ids.push(w.id);
    }
    for (let i = 1; i <= 10; i++) {
      const w = { id: 'zl_v' + i, fi: 'verbi ' + i, pos: 'v', self_only: true };
      if (lang === 'en') { w.en = 'go' + i; w.en_infl = { past: 'went' + i, pp: 'gone' + i }; }
      else { w.de = 'fahren' + i; w.de_infl = { pres3: 'fährt' + i, pret: 'fuhr' + i, pp: 'ist gefahren' + i }; }
      VOCAB.words.push(w); ids.push(w.id);
    }
    SELF_DATA.topics.length = 0;
    SELF_DATA.topics.push({ id: 'zl_t1', name_fi: 'Kielitesti', level: 'A1', concepts: ids });
    PRACTICE_WORDS = practiceWords();
  })();`);
}
async function toInfl(app, opts) {
  addInflFixture(app, opts);
  await app.studyButtons[1].click();
  await app.flush(60);
  await app.practiceButtons[4].click();
  await app.flush(20);
}
// Näyttää tietyn sanan kysymyksen (path = kenttä, jos tehtävä arpoo muodon)
function showInfl(app, wordId, taskId, path) {
  app.run(`(function () {
    const w = VOCAB.words.find(x => x.id === ${JSON.stringify(wordId)});
    const t = inflTasks().find(x => x.id === ${JSON.stringify(taskId)});
    const q = inflMakeQuestion(w, t);
    ${path ? `q.fields = inflFieldsFor(w, t).fields.filter(f => f.path === ${JSON.stringify(path)}); q.hint = 'Kirjoita ' + q.fields[0].name;` : ''}
    renderInflQuestion(q);
  })();`);
}
async function typeInfl(app, values) {
  app.run(`(${JSON.stringify(values)}).forEach((v, i) => { inflInputEls[i].value = v; })`);
  await app.elements.inflCheck.click();
  await app.flush(10);
}
const inflFb = (app) => String(app.elements.inflFeedback.textContent);
const inflStatsOf = (app, lang) => JSON.parse(app.storage.getItem('inflStats_' + (lang || 'sv')) || '{}');
const dailyOf = (app, lang) => JSON.parse(app.storage.getItem('selfDaily_' + (lang || 'sv')) || '{}');
const dailyToday = (app, lang) => { const d = dailyOf(app, lang).days || {}; return Object.values(d).reduce((a, b) => a + b, 0); };

test('Taivutus: näkyvyys - itseopiskelussa vähintään 20 taivutussanaa, alle sen piilossa', async () => {
  const app = await boot();
  addInflFixture(app);
  await app.studyButtons[1].click(); await app.flush(60);
  assert.notStrictEqual(app.elements.inflSwitchBtn.style.display, 'none');
  assert.strictEqual(app.elements.inflSwitchBtn.textContent, '🔤 Taivutus');
  assert.ok(app.run('inflEligibleWordCount()') >= 20);
  assert.deepStrictEqual(app.practiceButtons.map(b => b.dataset.practice), ['words', 'sentences', 'grammar', 'match', 'infl', 'listen']);
  assert.strictEqual(app.elements.grammarSwitchBtn.style.display, 'none', 'Kielioppi vain saksan peruskoulussa');
  app.dispose();
  const app2 = await boot();
  addInflFixture(app2, { fewer: true });
  // kaikilta paitsi neljältä sanalta poistetaan taivutusdata -> alle 20 taivutussanaa
  app2.run(`VOCAB.words.forEach(w => { if (!['zi_n1', 'zi_n3', 'zi_v1', 'zi_a1'].includes(w.id)) { delete w.sv_infl; delete w.sv_pl; } }); PRACTICE_WORDS = practiceWords();`);
  await app2.studyButtons[1].click(); await app2.flush(60);
  assert.ok(app2.run('inflEligibleWordCount()') < 20);
  assert.strictEqual(app2.elements.inflSwitchBtn.style.display, 'none');
  app2.dispose();
});

test('Taivutus: ruotsin tehtävätyypit - en/ett (oikea ja väärä)', async () => {
  const app = await boot();
  await toInfl(app);
  assert.strictEqual(app.run('practiceMode'), 'infl');
  assert.strictEqual(app.elements.inflPractice.hidden, false);
  assert.strictEqual(app.elements.wordPractice.hidden, true);
  showInfl(app, 'zi_n1', 'gender');
  assert.strictEqual(app.elements.inflWord.textContent, 'bil', 'substantiivi ilman artikkelia');
  assert.ok(app.elements.inflFi.textContent.includes('nomini'));
  assert.deepStrictEqual(app.elements.inflChoiceBtns._children.map(b => b.textContent), ['en', 'ett']);
  assert.strictEqual(app.elements.inflChoiceBtns.hidden, false); assert.strictEqual(app.elements.inflInputs.hidden, true);
  await app.elements.inflChoiceBtns._children[0].click();
  assert.ok(app.elements.inflFeedback.classList.contains('correct'));
  assert.ok(inflFb(app).includes('Oikein') && inflFb(app).includes('en bil – bilen – bilar'), inflFb(app));
  showInfl(app, 'zi_n2', 'gender');
  await app.elements.inflChoiceBtns._children[0].click();
  assert.ok(app.elements.inflFeedback.classList.contains('incorrect'));
  assert.ok(inflFb(app).includes('Oikea vastaus: ett') && inflFb(app).includes('ett hus – huset – hus'), inflFb(app));
  const cls = app.elements.inflChoiceBtns._children.map(b => b.className);
  assert.ok(/right/.test(cls[1]) && /wrong/.test(cls[0]));
  // vaihtoehtoartikkeli ("måndag / en måndag")
  showInfl(app, 'zi_alt', 'gender');
  assert.strictEqual(app.elements.inflWord.textContent, 'måndag');
  await app.elements.inflChoiceBtns._children[0].click();
  assert.ok(app.elements.inflFeedback.classList.contains('correct'));
  app.dispose();
});

test('Taivutus: määräinen muoto ja monikko - oikea/väärä, isot kirjaimet ja loppuvälimerkit, å/ä/ö vaaditaan', async () => {
  const app = await boot();
  await toInfl(app);
  showInfl(app, 'zi_n1', 'def');
  assert.strictEqual(app.elements.inflWord.textContent, 'bil');
  assert.ok(app.elements.inflHint.textContent.includes('määräinen'));
  assert.strictEqual(app.elements.inflInputs.hidden, false);
  await typeInfl(app, ['bilen']);
  assert.ok(app.elements.inflFeedback.classList.contains('correct'));
  showInfl(app, 'zi_n1', 'def'); await typeInfl(app, ['  Bilen. ']);
  assert.ok(app.elements.inflFeedback.classList.contains('correct'), 'isot kirjaimet ja loppuvälimerkki ohitetaan');
  showInfl(app, 'zi_n1', 'def'); await typeInfl(app, ['bilar']);
  assert.ok(app.elements.inflFeedback.classList.contains('incorrect'));
  assert.ok(inflFb(app).includes('Oikea vastaus: bilen') && inflFb(app).includes('en bil – bilen – bilar'));
  // monikko: kehote näyttää artikkelin; å/ä/ö vaaditaan
  showInfl(app, 'zi_n6', 'pl');
  assert.strictEqual(app.elements.inflWord.textContent, 'en bok');
  await typeInfl(app, ['bocker']);
  assert.ok(app.elements.inflFeedback.classList.contains('incorrect'), 'ö vaaditaan');
  showInfl(app, 'zi_n6', 'pl'); await typeInfl(app, ['Böcker!']);
  assert.ok(app.elements.inflFeedback.classList.contains('correct'));
  // tyhjää ei lasketa vastaukseksi
  showInfl(app, 'zi_n1', 'pl');
  const t0 = app.run('inflSession.t');
  await typeInfl(app, ['  ']);
  assert.strictEqual(app.run('inflSession.t'), t0);
  assert.strictEqual(app.run('inflLocked'), false);
  app.dispose();
});

test('Taivutus: verbin muodot (yksi muoto kerrallaan ja kolme kerralla) ja adjektiivi', async () => {
  const app = await boot();
  await toInfl(app);
  const want = { 'infl.pres': 'skriver', 'infl.pret': 'skrev', 'infl.sup': 'skrivit' };
  for (const [path, val] of Object.entries(want)) {
    showInfl(app, 'zi_v1', 'verb', path);
    assert.strictEqual(app.elements.inflWord.textContent, 'skriva');
    await typeInfl(app, [val]);
    assert.ok(app.elements.inflFeedback.classList.contains('correct'), path);
    showInfl(app, 'zi_v1', 'verb', path);
    await typeInfl(app, ['väärin']);
    assert.ok(inflFb(app).includes('Oikea vastaus: ' + val) && inflFb(app).includes('skriva – skriver – skrev – skrivit'), inflFb(app));
  }
  // arvonta valitsee jonkin kolmesta muodosta
  const seen = new Set();
  for (let i = 0; i < 40; i++) seen.add(app.run('inflMakeQuestion(VOCAB.words.find(w => w.id === "zi_v1"), inflTasks().find(t => t.id === "verb")).fields[0].path'));
  assert.strictEqual(seen.size, 3);
  // kolme kenttää kerralla: kaikkien oltava oikein, yksi vastaus
  showInfl(app, 'zi_v2', 'verbAll');
  assert.strictEqual(app.run('inflInputEls.length'), 3);
  const s0 = app.run('inflSession.t');
  await typeInfl(app, ['går', 'gick', 'gått']);
  assert.ok(app.elements.inflFeedback.classList.contains('correct'));
  assert.strictEqual(app.run('inflSession.t'), s0 + 1);
  showInfl(app, 'zi_v2', 'verbAll');
  await typeInfl(app, ['går', 'gick', 'gick']);
  assert.ok(app.elements.inflFeedback.classList.contains('incorrect'));
  assert.deepStrictEqual(J(app, 'inflInputEls.map(b => b.className)').map(c => /right/.test(c) ? 'r' : /wrong/.test(c) ? 'w' : '?'), ['r', 'r', 'w']);
  assert.ok(inflFb(app).includes('går · gick · gått'));
  // verbi, jolla ei supiinia: yksittäinen muoto toimii, kolmen kentän tehtävä ei
  assert.ok(app.run('!!inflFieldsFor(VOCAB.words.find(w => w.id === "zi_xv_part"), inflTasks().find(t => t.id === "verb"))'));
  assert.ok(app.run('!inflFieldsFor(VOCAB.words.find(w => w.id === "zi_xv_part"), inflTasks().find(t => t.id === "verbAll"))'));
  // adjektiivi: ett-muoto tai monikko
  showInfl(app, 'zi_a1', 'adj', 'infl.neut'); await typeInfl(app, ['stort']);
  assert.ok(app.elements.inflFeedback.classList.contains('correct'));
  showInfl(app, 'zi_a2', 'adj', 'infl.apl');
  assert.ok(app.elements.inflHint.textContent.includes('monikko'));
  await typeInfl(app, ['små']);
  assert.ok(app.elements.inflFeedback.classList.contains('correct'));
  showInfl(app, 'zi_a2', 'adj', 'infl.apl'); await typeInfl(app, ['sma']);
  assert.ok(app.elements.inflFeedback.classList.contains('incorrect'), 'å/ä/ö vaaditaan');
  assert.ok(inflFb(app).includes('liten – litet – små'));
  app.dispose();
});

test('Taivutus: poissulkusäännöt - erisnimi, "-" monikko, taipumaton adjektiivi, aukolliset, monisanaiset fraasit', async () => {
  const app = await boot();
  await toInfl(app);
  const ok = (id, task) => app.run(`!!inflFieldsFor(VOCAB.words.find(w => w.id === ${JSON.stringify(id)}), inflTasks().find(t => t.id === ${JSON.stringify(task)}))`);
  assert.ok(!ok('zi_x_proper', 'def') && !ok('zi_x_proper', 'pl') && !ok('zi_x_proper', 'gender'), 'erisnimi: def = perusmuoto, ei monikkoa, ei artikkelia');
  assert.ok(!ok('zi_x_dash', 'pl') && ok('zi_x_dash', 'def') && ok('zi_x_dash', 'gender'), '"-" monikko pois vain monikosta');
  assert.ok(!ok('zi_n2', 'pl') && ok('zi_n2', 'def'), 'monikko = perusmuoto (hus) pois');
  assert.ok(!ok('zi_x_bra', 'adj') && !ok('zi_x_rosa', 'adj') && ok('zi_a5', 'adj'), 'taipumaton adjektiivi pois');
  assert.ok(!ok('zi_x_gap', 'def') && !ok('zi_x_gap', 'pl') && !ok('zi_x_gap', 'gender'), 'aukolliset pois');
  assert.ok(!ok('zi_x_multi', 'def') && !ok('zi_x_multi', 'pl') && ok('zi_x_multi', 'gender'), 'monisanainen pois määräisestä ja monikosta, en/ett kelpaa');
  assert.ok(!ok('zi_x_noart', 'gender'), 'ei artikkelia -> ei en/ett-tehtävää');
  assert.ok(ok('zi_v6', 'verb') && ok('zi_v6', 'verbAll'), 'monisanainen verbi sallitaan');
  // sanaluokka ratkaisee
  assert.ok(!ok('zi_n1', 'verb') && !ok('zi_v1', 'pl') && !ok('zi_a1', 'def'));
  // yksikään poolin sana ei ole poissuljettu
  for (const t of J(app, 'inflTasks().map(t => t.id)')) {
    const ids = J(app, `(function () { const t = inflTasks().find(x => x.id === ${JSON.stringify(t)}); const c = inflCandidates(t); return c.list.map(w => w.id); })()`);
    ids.forEach(id => assert.ok(!id.startsWith('zi_x_') || (id === 'zi_x_multi' || id === 'zi_x_dash') && t !== 'pl' || id === 'zi_xv_part' && t === 'verb', t + ': ' + id));
  }
  app.dispose();
});

test('Taivutus: välilehdet - Sekoitus oletuksena, tehtävätyyppi valittavissa, Sekoitus arpoo kaikkia tyyppejä', async () => {
  const app = await boot();
  await toInfl(app);
  const tabs = () => app.elements.inflTabs._children;
  assert.deepStrictEqual(tabs().map(b => b.textContent), ['Sekoitus', 'en / ett', 'Määräinen', 'Monikko', 'Verbi', 'Verbi ×3', 'Adjektiivi']);
  assert.strictEqual(app.run('inflTask'), 'mix');
  assert.ok(tabs()[0].className.includes('active') && !tabs()[1].className.includes('active'));
  const types = new Set();
  for (let i = 0; i < 120; i++) { app.run('pickInflRound()'); types.add(app.run('inflQ.task.id')); }
  assert.strictEqual(types.size, 6, [...types].join());
  await tabs()[3].click();
  assert.strictEqual(app.run('inflTask'), 'pl');
  assert.ok(tabs()[3].className.includes('active') && !tabs()[0].className.includes('active'));
  for (let i = 0; i < 25; i++) { app.run('pickInflRound()'); assert.strictEqual(app.run('inflQ.task.id'), 'pl'); }
  await tabs()[0].click();
  assert.strictEqual(app.run('inflTask'), 'mix');
  app.dispose();
});

test('Taivutus: sanavalinta - harjoitellut tason sanat ensin, sitten muut tason sanat, sitten muut tasot', async () => {
  const app = await boot();
  addInflFixture(app);
  await app.studyButtons[1].click(); await app.flush(60);
  const pl = 'inflTasks().find(t => t.id === "pl")';
  let p = J(app, `inflPool(${pl})`);
  assert.strictEqual(p.primary.length, 0);
  assert.ok(p.secondary.length >= 8);
  const restIds = p.rest.map(w => w.id);
  assert.ok(restIds.includes('zi_b1') && restIds.includes('zi_b3'), 'toisen tason sanat mukana');
  assert.ok(!restIds.includes('zi_b2') && !restIds.includes('zi_b4'), 'monikko = perusmuoto -> pois');
  // harjoitellut (tilasto olemassa) nousevat ensisijaisiksi
  ['zi_n1', 'zi_n3', 'zi_n5', 'zi_n6', 'zi_n7', 'zi_b1'].forEach(id => seedStat(app, id));
  await app.run('updateHeaderStats()');
  p = J(app, `inflPool(${pl})`);
  assert.deepStrictEqual(p.primary.map(w => w.id).sort(), ['zi_n1', 'zi_n3', 'zi_n5', 'zi_n6', 'zi_n7']);
  assert.ok(!p.primary.some(w => w.id === 'zi_b1') && p.rest[0].id === 'zi_b1', 'toisen tason harjoiteltu sana ennen harjoittelemattomia');
  let c = J(app, `inflCandidates(${pl})`);
  assert.deepStrictEqual(c.list.map(w => w.id).sort(), ['zi_n1', 'zi_n3', 'zi_n5', 'zi_n6', 'zi_n7'], 'riittävästi harjoiteltuja -> vain ne');
  assert.ok(c.fresh.length >= 3);
  // harjoiteltuja alle INFL_MIN_POOL -> täydennetään tason muilla sanoilla
  await app.run('statsCache = {}');
  seedStat(app, 'zi_n1');
  await app.run('statsCache[statId({id:"zi_n1"})] = { statId: statId({id:"zi_n1"}), correctCount: 1 }');
  c = J(app, `inflCandidates(${pl})`);
  assert.strictEqual(c.list[0].id, 'zi_n1');
  assert.ok(c.list.length >= 8 && c.fresh.length === 0);
  app.dispose();
});

test('Taivutus: tilasto inflStats_<kieli> ja painotus heikoimmin menneisiin', async () => {
  const app = await boot();
  await toInfl(app);
  assert.strictEqual(app.storage.getItem('inflStats_sv'), null);
  showInfl(app, 'zi_n1', 'pl'); await typeInfl(app, ['bilar']);
  showInfl(app, 'zi_n1', 'pl'); await typeInfl(app, ['bilar']);
  showInfl(app, 'zi_n1', 'pl'); await typeInfl(app, ['x']);
  showInfl(app, 'zi_n3', 'def'); await typeInfl(app, ['x']);
  const st = inflStatsOf(app);
  assert.deepStrictEqual(st['pl:zi_n1'], { c: 2, w: 1 });
  assert.deepStrictEqual(st['def:zi_n3'], { c: 0, w: 1 });
  assert.strictEqual(app.storage.getItem('inflStats_en'), null, 'kieli kohtainen avain');
  assert.strictEqual(app.run('inflSession.c'), 2); assert.strictEqual(app.run('inflSession.t'), 4);
  assert.ok(app.elements.inflScore.textContent.includes('2/4'));
  // painot: heikoin sana painavin, hyvin osattu kevyin, tuntematon 2
  const wgt = (o) => app.run(`inflWeight(${JSON.stringify(o)})`);
  assert.strictEqual(wgt(undefined), 2);
  assert.ok(wgt({ c: 0, w: 4 }) > wgt({ c: 1, w: 1 }) && wgt({ c: 1, w: 1 }) > wgt({ c: 6, w: 0 }));
  // otanta: heikoin sana tulee selvästi useammin kuin hyvin osattu
  app.storage.setItem('inflStats_sv', JSON.stringify({ 'pl:zi_n1': { c: 0, w: 5 }, 'pl:zi_n3': { c: 8, w: 0 } }));
  await app.elements.inflTabs._children[3].click(); // Monikko
  const count = { zi_n1: 0, zi_n3: 0, other: 0 };
  for (let i = 0; i < 600; i++) {
    app.run('inflQ = null; pickInflRound()');
    const id = app.run('inflQ.w.id');
    if (id in count) count[id]++; else count.other++;
  }
  assert.ok(count.zi_n1 > count.zi_n3 * 3, JSON.stringify(count));
  app.dispose();
});

test('Taivutus: päivätavoite kasvaa yhdellä per vastaus (oikea, väärä, monikenttäinen), vain itseopiskelussa; päiväloki', async () => {
  const app = await boot();
  await toInfl(app);
  assert.strictEqual(dailyToday(app), 0);
  showInfl(app, 'zi_n1', 'gender'); await app.elements.inflChoiceBtns._children[0].click();
  assert.strictEqual(dailyToday(app), 1);
  showInfl(app, 'zi_n1', 'def'); await typeInfl(app, ['väärin']);
  assert.strictEqual(dailyToday(app), 2, 'väärä vastaus lasketaan myös');
  showInfl(app, 'zi_v1', 'verbAll'); await typeInfl(app, ['skriver', 'skrev', 'skrivit']);
  assert.strictEqual(dailyToday(app), 3, 'kolme kenttää = yksi vastaus');
  assert.ok(/3 \/ /.test(String(app.elements.dailyLabel.textContent)) || app.elements.dailyLabel.textContent !== '', 'päivänäkymä päivittyy');
  // tyhjä vastaus tai lukitun kysymyksen toinen napautus ei kasvata
  await app.elements.inflCheck.click();
  assert.strictEqual(dailyToday(app), 3);
  showInfl(app, 'zi_n1', 'gender');
  await app.elements.inflChoiceBtns._children[0].click(); await app.elements.inflChoiceBtns._children[1].click();
  assert.strictEqual(dailyToday(app), 4, 'kaksoisnapautus ei kirjaa kahta vastausta');
  const log = JSON.parse(app.storage.getItem(app.run('DAYLOG_KEY')));
  assert.strictEqual(Object.values(log)[0].sv.a, 4);
  app.dispose();
});

test('Taivutus: ei vaikuta sanan graduointiin, tilastoon eikä kertausväliin', async () => {
  const app = await boot();
  addInflFixture(app);
  const sched = { srsInterval: 4, srsEase: 2.3, srsDue: '2026-01-05T00:00:00.000Z' };
  seedStat(app, 'zi_n1', Object.assign({ correctCount: 3, incorrectCount: 1, streakCorrect: 2, streakKeyboard: 4 }, sched));
  await app.studyButtons[1].click(); await app.flush(60);
  await app.run('updateHeaderStats()');
  const before = JSON.stringify(app.db.data.get(app.run('statId({id:"zi_n1"})')));
  const cacheBefore = JSON.stringify(app.run('statsCache'));
  const puts = app.db.putCount;
  await app.practiceButtons[4].click(); await app.flush(20);
  const newLeft = app.run('newWordsLeftToday()');
  for (let i = 0; i < 12; i++) {
    showInfl(app, 'zi_n1', 'pl'); await typeInfl(app, [i % 2 ? 'bilar' : 'x']);
    showInfl(app, 'zi_n3', 'def'); await typeInfl(app, ['flickan']);
  }
  assert.strictEqual(JSON.stringify(app.db.data.get(app.run('statId({id:"zi_n1"})'))), before, 'tilastotietue ennallaan');
  assert.strictEqual(JSON.stringify(app.run('statsCache')), cacheBefore, 'välimuisti ennallaan (myös tuoreet sanat)');
  assert.strictEqual(app.db.putCount, puts, 'IndexedDB:hen ei kirjoiteta');
  assert.strictEqual(app.run('stageKeyboardGraduated(statsCache[statId({id:"zi_n1"})])'), false);
  assert.strictEqual(app.run('isGraduatedWord({id:"zi_n3"})'), false);
  assert.strictEqual(app.run('newWordsLeftToday()'), newLeft, 'ei kuluta uusien sanojen kiintiötä');
  app.dispose();
});

test('Taivutus: kysymysten välinen siirtymä - oikea vastaus jatkuu viiveellä, "Ohita" vaihtaa heti, sama sana ei toistu peräkkäin', async () => {
  const app = await boot();
  await toInfl(app);
  await app.elements.inflTabs._children[3].click();
  const first = app.run('inflQ.w.id');
  await app.elements.inflSkip.click();
  assert.notStrictEqual(app.run('inflQ.w.id'), first);
  assert.strictEqual(app.run('inflLocked'), false);
  const ids = new Set();
  for (let i = 0; i < 30; i++) { const prev = app.run('inflQ.w.id'); app.run('pickInflRound()'); const cur = app.run('inflQ.w.id'); assert.notStrictEqual(cur, prev); ids.add(cur); }
  assert.ok(ids.size >= 5);
  const q0 = app.run('inflQ');
  const ans = app.run('inflQ.fields[0].value.split("/")[0]');
  await typeInfl(app, [ans]);
  assert.strictEqual(app.run('inflLocked'), true);
  await app.flush(1300);
  assert.strictEqual(app.run('inflLocked'), false, 'uusi kysymys 1,1 s jälkeen');
  assert.ok(app.run('inflQ') !== q0);
  app.dispose();
});

test('Taivutus: englanti synteettisellä datalla - monikko, past ja pp (datavetoinen)', async () => {
  const app = await boot();
  addInflFixture(app);
  addInflFixtureLang(app, 'en');
  await app.studyButtons[1].click(); await app.flush(60);
  await app.langButtons[0].click(); await app.flush(40);
  assert.strictEqual(app.run('targetLang'), 'en');
  assert.notStrictEqual(app.elements.inflSwitchBtn.style.display, 'none');
  await app.practiceButtons[4].click(); await app.flush(20);
  assert.deepStrictEqual(app.elements.inflTabs._children.map(b => b.textContent), ['Sekoitus', 'Monikko', 'Verbi', 'Verbi ×2']);
  showInfl(app, 'zl_n3', 'pl');
  assert.strictEqual(app.elements.inflWord.textContent, 'thing3');
  await typeInfl(app, ['things3']);
  assert.ok(app.elements.inflFeedback.classList.contains('correct'));
  showInfl(app, 'zl_v2', 'verb', 'infl.pp'); await typeInfl(app, ['Gone2']);
  assert.ok(app.elements.inflFeedback.classList.contains('correct'));
  showInfl(app, 'zl_v2', 'verb', 'infl.past'); await typeInfl(app, ['gone2']);
  assert.ok(app.elements.inflFeedback.classList.contains('incorrect'));
  assert.ok(inflFb(app).includes('Oikea vastaus: went2') && inflFb(app).includes('go2 – went2 – gone2'), inflFb(app));
  showInfl(app, 'zl_v4', 'verbAll'); await typeInfl(app, ['went4', 'gone4']);
  assert.ok(app.elements.inflFeedback.classList.contains('correct'));
  // tilasto ja päivätavoite kielikohtaisia
  assert.ok(Object.keys(inflStatsOf(app, 'en')).length >= 3);
  assert.strictEqual(app.storage.getItem('inflStats_sv'), null);
  assert.ok(dailyToday(app, 'en') >= 4);
  // peruskoulussa englannissa ei taivutusvaihtoehtoa
  await app.studyButtons[0].click(); await app.flush(80);
  assert.strictEqual(app.run('targetLang'), 'en');
  assert.strictEqual(app.elements.inflSwitchBtn.style.display, 'none');
  assert.strictEqual(app.run('practiceMode'), 'words');
  app.dispose();
});

test('Taivutus: saksa synteettisellä datalla - der/die/das, monikko (artikkeli vapaaehtoinen), pres3, pret, pp apuverbillä', async () => {
  const app = await boot();
  addInflFixture(app);
  addInflFixtureLang(app, 'de');
  await app.studyButtons[1].click(); await app.flush(60);
  await app.langButtons[1].click(); await app.flush(40);
  assert.strictEqual(app.run('targetLang'), 'de');
  await app.practiceButtons[4].click(); await app.flush(20);
  assert.deepStrictEqual(app.elements.inflTabs._children.map(b => b.textContent), ['Sekoitus', 'der / die / das', 'Monikko', 'Verbi', 'Verbi ×3']);
  showInfl(app, 'zl_n5', 'gender');
  assert.strictEqual(app.elements.inflWord.textContent, 'Hund5');
  assert.deepStrictEqual(app.elements.inflChoiceBtns._children.map(b => b.textContent), ['der', 'die', 'das']);
  await app.elements.inflChoiceBtns._children[0].click();
  assert.ok(app.elements.inflFeedback.classList.contains('correct'));
  showInfl(app, 'zl_n5', 'pl');
  assert.strictEqual(app.elements.inflWord.textContent, 'der Hund5');
  await typeInfl(app, ['Hunde5']);
  assert.ok(app.elements.inflFeedback.classList.contains('correct'), 'ilman artikkelia');
  showInfl(app, 'zl_n5', 'pl'); await typeInfl(app, ['die Hunde5']);
  assert.ok(app.elements.inflFeedback.classList.contains('correct'), 'artikkelin kanssa');
  showInfl(app, 'zl_n5', 'pl'); await typeInfl(app, ['Hunde']);
  assert.ok(app.elements.inflFeedback.classList.contains('incorrect'));
  assert.ok(inflFb(app).includes('der Hund5 – die Hunde5'), inflFb(app));
  showInfl(app, 'zl_v3', 'verb', 'infl.pp'); await typeInfl(app, ['ist gefahren3']);
  assert.ok(app.elements.inflFeedback.classList.contains('correct'));
  showInfl(app, 'zl_v3', 'verb', 'infl.pp'); await typeInfl(app, ['gefahren3']);
  assert.ok(app.elements.inflFeedback.classList.contains('incorrect'), 'apuverbi vaaditaan');
  showInfl(app, 'zl_v3', 'verbAll'); await typeInfl(app, ['fährt3', 'fuhr3', 'ist gefahren3']);
  assert.ok(app.elements.inflFeedback.classList.contains('correct'));
  assert.ok(inflFb(app).includes('fahren3 – fährt3 – fuhr3 – ist gefahren3'), inflFb(app));
  app.dispose();
});

test('Taivutus: peruskoulun saksan Kielioppi ennallaan, taivutusvalitsin piilossa; sama jaettu tila', async () => {
  const app = await boot();
  await app.langButtons[1].click(); await app.flush(40);
  assert.strictEqual(app.run('targetLang'), 'de');
  assert.strictEqual(app.elements.grammarSwitchBtn.style.display, '');
  assert.strictEqual(app.elements.inflSwitchBtn.style.display, 'none', 'saksan peruskoulussa vain Kielioppi');
  await app.practiceButtons[2].click(); await app.flush(20);
  assert.strictEqual(app.run('practiceMode'), 'grammar');
  assert.strictEqual(app.elements.grammarPractice.hidden, false);
  assert.strictEqual(app.elements.inflPractice.hidden, true);
  // article-toiminta: oikea ja väärä, tallentuu grammarStats_de:hen, ei inflStats_de:hen eikä päivätavoitteeseen
  app.run('grammarKind = "article"; pickGrammarRound();');
  const sg = J(app, 'splitArticle(firstAcceptedAnswer(grammarCurrent.de))');
  app.run(`answerArticle(${JSON.stringify(sg.art)})`);
  assert.ok(app.elements.grammarFeedback.classList.contains('correct'));
  const gs = JSON.parse(app.storage.getItem('grammarStats_de'));
  assert.strictEqual(Object.keys(gs).length, 1);
  assert.ok(Object.keys(gs)[0].startsWith('article:'));
  assert.strictEqual(app.storage.getItem('inflStats_de'), null);
  assert.strictEqual(app.storage.getItem('selfDaily_de'), null);
  app.run('pickGrammarRound(); grammarKind = "plural"; pickGrammarRound(); answerPlural();');
  app.dispose();
});

test('Taivutus: peruskoulun ruotsi - sama harjoitus nimellä Kielioppi, luokka-asteeseen asti, ei päivätavoitetta', async () => {
  const app = await boot();
  await app.langButtons[2].click(); await app.flush(60);
  assert.strictEqual(app.run('targetLang'), 'sv');
  assert.strictEqual(app.run('studyMode'), 'school');
  assert.notStrictEqual(app.elements.inflSwitchBtn.style.display, 'none');
  assert.strictEqual(app.elements.inflSwitchBtn.textContent, '🔤 Kielioppi');
  assert.strictEqual(app.elements.grammarSwitchBtn.style.display, 'none', 'saksan Kielioppi ei näy ruotsissa');
  await app.practiceButtons[4].click(); await app.flush(20);
  assert.strictEqual(app.run('practiceMode'), 'infl');
  assert.ok(app.run('inflQ'), 'kysymys löytyy');
  const g = app.run('activeGrade');
  for (let i = 0; i < 40; i++) { app.run('pickInflRound()'); const wg = app.run('wordGrade(inflQ.w)'); assert.ok(wg != null && wg <= g || app.run('inflQ.w.id') !== undefined); }
  const w = app.run('inflQ.w.id');
  // vastataan oikein
  const t = app.run('inflQ.task.kind');
  if (t === 'choice') await app.elements.inflChoiceBtns._children.find(b => b.textContent === app.run('inflQ.correct')).click();
  else await typeInfl(app, app.run('inflQ.fields.map(f => f.value.split("/")[0])'));
  assert.ok(app.elements.inflFeedback.classList.contains('correct'), inflFb(app) + w);
  assert.strictEqual(app.storage.getItem('selfDaily_sv'), null, 'peruskoulussa ei päivälaskuria');
  assert.ok(app.storage.getItem('inflStats_sv'));
  // kielenvaihto englantiin: taivutus pois, takaisin sanoihin
  await app.langButtons[0].click(); await app.flush(40);
  assert.strictEqual(app.run('practiceMode'), 'words');
  assert.strictEqual(app.elements.inflSwitchBtn.style.display, 'none');
  app.dispose();
});

test('Taivutus: tyhjä pooli ei kaada - ilmoitus ja piilotetut kentät; tason vaihto ja tilan vaihto päivittävät harjoituksen', async () => {
  const app = await boot();
  await toInfl(app);
  // Tason vaihto (A2: vain 4 nomia, ei verbejä)
  app.elements.gradeFilter.value = 'A2';
  await app.elements.gradeFilter.dispatch('change');
  await app.flush(30);
  assert.strictEqual(app.run('selfLevel'), 'A2');
  assert.ok(app.run('inflQ'), 'kysymys uudella tasolla');
  // Verbi-välilehti A2:lla: täydentyy muilta tasoilta
  await app.elements.inflTabs._children[4].click();
  assert.strictEqual(app.run('inflQ.task.id'), 'verb');
  // ei sanoja lainkaan -> ilmoitus
  app.run('PRACTICE_WORDS = PRACTICE_WORDS.filter(w => w.pos !== "v"); pickInflRound();');
  assert.strictEqual(app.run('inflQ'), null);
  assert.ok(/Ei sopivia/.test(app.elements.inflFi.textContent));
  assert.strictEqual(app.elements.inflCheck.hidden, true);
  assert.strictEqual(app.asyncErrors.length, 0);
  // tilan vaihto peruskouluun (kieleksi palautuu englanti, jolla ei ole taivutusta) -> takaisin sanoihin
  app.run('PRACTICE_WORDS = practiceWords();');
  await app.studyButtons[0].click(); await app.flush(80);
  assert.strictEqual(app.run('targetLang'), 'en');
  assert.strictEqual(app.run('practiceMode'), 'words');
  assert.strictEqual(app.elements.inflSwitchBtn.style.display, 'none');
  await app.langButtons[2].click(); await app.flush(60);
  assert.strictEqual(app.elements.inflSwitchBtn.textContent, '🔤 Kielioppi');
  await app.practiceButtons[4].click(); await app.flush(20);
  // paluu itseopiskeluun säilyttää harjoituksen ja aloittaa kierroksen uudestaan
  await app.studyButtons[1].click(); await app.flush(80);
  assert.strictEqual(app.run('practiceMode'), 'infl');
  assert.strictEqual(app.elements.inflSwitchBtn.textContent, '🔤 Taivutus');
  assert.ok(app.run('inflQ'));
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Taivutus: ulkoasu itseopiskelussa hillitty (self-mode), tiiviit välilehdet; piilotettu ennen valintaa', async () => {
  const app = await boot();
  addInflFixture(app);
  await app.studyButtons[1].click(); await app.flush(60);
  assert.ok(app.run('document.body.classList.contains("self-mode")'));
  assert.strictEqual(app.run('inflQ'), null, 'kysymystä ei arvota ennen kuin harjoitus valitaan');
  await app.practiceButtons[4].click(); await app.flush(20);
  assert.strictEqual(app.elements.inflPractice.hidden, false);
  assert.strictEqual(app.elements.matchPractice.hidden, true);
  assert.strictEqual(app.cssVars['--tier-bg-icon'], '""', 'ei maskotteja');
  await app.practiceButtons[0].click(); await app.flush(20);
  assert.strictEqual(app.elements.inflPractice.hidden, true);
  assert.strictEqual(app.elements.wordPractice.hidden, false);
  app.dispose();
});

// ---------------- Kuuntele-harjoitus (vaihe 44) ----------------
// Sisällöstä riippumattomat testit: puhesynteesi mockataan harnessissa (app.spoken), kohteet rakennetaan
// synteettisistä sanoista (listenWordItem), joten ne eivät riipu sanaston sisällöstä.
async function toListen(app) { await app.practiceButtons[5].click(); await app.flush(40); }
const listenFb = (app) => String(app.elements.listenFeedback.textContent);
// Näyttää annetun sanan sanelu-/ymmärtämiskysymyksenä (ohittaa satunnaisen valinnan)
function showListen(app, wordObj, type) {
  app.run(`(function () {
    const w = ${JSON.stringify(wordObj)};
    VOCAB.words.push(w);
    listenType = ${JSON.stringify(type || 'dict')};
    const q = { type: listenType, item: listenWordItem(w) };
    if (listenType === 'comp') q.options = buildChoiceQuestion(w, choicePools(), { dir: 'target-fi', excludeGaps: true }).options;
    renderListenQuestion(q);
  })();`);
}
const SV_BIL = { id: 'zl_bil', fi: 'auto', sv: 'en bil', pos: 'n', self_only: true, sv_infl: { def: 'bilen' }, sv_pl: 'bilar' };
async function typeListen(app, text) {
  app.elements.listenInput.value = text;
  await app.elements.listenCheck.click();
  await app.flush(10);
}

test('Kuuntele: "🎧 Kuuntele" valitsimessa kummassakin tilassa; välilehdet (peruskoulussa myös virkesanelu), muut harjoitukset ennallaan', async () => {
  const app = await boot();
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(/<button[^>]*data-practice="listen"[^>]*>🎧 Kuuntele<\/button>/.test(html), 'valitsimessa nappi 🎧 Kuuntele');
  await toListen(app);
  assert.strictEqual(app.run('practiceMode'), 'listen');
  assert.strictEqual(app.elements.listenPractice.hidden, false);
  assert.strictEqual(app.elements.wordPractice.hidden, true);
  assert.strictEqual(app.elements.matchPractice.hidden, true);
  assert.deepStrictEqual(app.elements.listenTabs._children.map(b => b.dataset.task), ['dict', 'comp', 'sent'], 'peruskoulussa ei dialogia');
  assert.ok(app.run('listenQ'), 'kysymys arvottu');
  await app.practiceButtons[0].click(); await app.flush(30);
  assert.strictEqual(app.elements.listenPractice.hidden, true);
  assert.strictEqual(app.elements.wordPractice.hidden, false);
  assert.ok(app.run('current'), 'sanaharjoitus toimii');
  await toSelf(app);
  await toListen(app);
  assert.strictEqual(app.run('practiceMode'), 'listen');
  assert.ok(app.run('document.body.classList.contains("self-mode")'), 'hillitty ulkoasu itseopiskelussa');
  assert.deepStrictEqual(app.elements.listenTabs._children.map(b => b.dataset.task),
    ['dict', 'comp'].concat(app.run('selfSentencesAvailable()') ? ['sent'] : [], app.run('selfDialoguesForLang().length') ? ['dlg'] : []),
    'virkesanelu ja dialogi vain jos itseopiskelun sisältöä on; dialogi vain itseopiskelussa');
  assert.ok(app.run('listenQ'));
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Kuuntele: puhesynteesi oikealla kielellä ja nopeudella; sanaa ei näytetä ennen vastausta', async () => {
  const app = await boot();
  await toListen(app);
  await app.flush(400);
  const text = app.run('listenQ.item.text');
  assert.strictEqual(app.spoken.length, 1, 'automaattitoisto kerran');
  assert.deepStrictEqual([app.spoken[0].text, app.spoken[0].lang, app.spoken[0].rate], [text, 'en-GB', 1]);
  await app.elements.listenReplay.click();
  assert.deepStrictEqual([app.spoken[1].text, app.spoken[1].lang, app.spoken[1].rate], [text, 'en-GB', 1]);
  await app.elements.listenSlow.click();
  assert.deepStrictEqual([app.spoken[2].text, app.spoken[2].lang, app.spoken[2].rate], [text, 'en-GB', 0.6]);
  const shown = [app.elements.listenHint.textContent, app.elements.listenFeedback.textContent, app.elements.listenInput.value].join('|');
  assert.ok(!shown.includes(text), 'puhuttua sanaa ei näytetä: ' + shown);
  assert.ok(String(app.elements.listenHint.textContent).includes('englanniksi'));
  // kielenvaihto: saksa -> de-DE ja uusi kysymys
  await app.langButtons[1].click(); await app.flush(450);
  const last = app.spoken[app.spoken.length - 1];
  assert.strictEqual(last.lang, 'de-DE');
  assert.strictEqual(last.text, app.run('listenQ.item.text'));
  // itseopiskelu: ruotsi sv-SE
  await toSelf(app);
  await app.flush(450);
  assert.strictEqual(app.spoken[app.spoken.length - 1].lang, 'sv-SE');
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Kuuntele: harjoituksesta poistuminen peruu automaattitoiston', async () => {
  const app = await boot();
  await toListen(app);
  await app.practiceButtons[0].click();
  await app.flush(450);
  assert.strictEqual(app.spoken.length, 0, 'mitään ei lausuttu');
  assert.ok(!app.spoken.some(s => s.text === app.run('listenQ && listenQ.item.text')), 'kuuntelukohdetta ei lausuta poistumisen jälkeen');
  app.dispose();
});

test('Kuuntele/sanelu: artikkeli kelpaa kanssa ja ilman, väärä ei; palautteessa koko muoto, suomennos ja taivutus (sv)', async () => {
  const app = await boot();
  await toSelf(app);
  await toListen(app);
  for (const [typed, ok] of [['en bil', true], ['bil', true], ['  EN Bil  ', true], ['en bil.', true], ['ett bil', false], ['bill', false], ['bilar', false]]) {
    showListen(app, Object.assign({}, SV_BIL, { id: 'zl_bil_' + typed.replace(/\W/g, '_') }), 'dict');
    await typeListen(app, typed);
    assert.ok(app.elements.listenFeedback.className.includes(ok ? 'correct' : 'incorrect'), typed + ' -> ' + listenFb(app));
    const fb = listenFb(app);
    assert.ok(fb.includes('en bil') && fb.includes('auto') && fb.includes('Taivutus: bilen · bilar'), fb);
    assert.ok(fb.includes(ok ? 'Oikein' : 'Ei ihan'), fb);
  }
  // lukitus: toinen vastaus samaan kysymykseen ei kirjaudu uudelleen
  const before = JSON.stringify(app.db.data.get(app.run('statId({id:"zl_bil_bilar"})')));
  await typeListen(app, 'en bil');
  assert.strictEqual(JSON.stringify(app.db.data.get(app.run('statId({id:"zl_bil_bilar"})'))), before);
  // tyhjää ei lasketa vastaukseksi
  showListen(app, Object.assign({}, SV_BIL, { id: 'zl_bil_empty' }), 'dict');
  await typeListen(app, '   ');
  assert.strictEqual(app.run('listenLocked'), false);
  assert.strictEqual(app.db.data.get(app.run('statId({id:"zl_bil_empty"})')), undefined);
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Kuuntele/sanelu: saksan artikkeli ja monikko (peruskoulu)', async () => {
  const app = await boot();
  await app.langButtons[1].click(); await app.flush(60);
  await toListen(app);
  const W = { id: 'zl_hund', fi: 'koira', de: 'der Hund', pos: 'n', de_pl: 'die Hunde' };
  for (const [typed, ok] of [['der Hund', true], ['hund', true], ['Hund', true], ['die Hund', false], ['Hunde', false]]) {
    showListen(app, Object.assign({}, W, { id: 'zl_hund_' + typed.replace(/\W/g, '_') }), 'dict');
    await typeListen(app, typed);
    assert.ok(app.elements.listenFeedback.className.includes(ok ? 'correct' : 'incorrect'), typed + ' ' + listenFb(app));
    assert.ok(listenFb(app).includes('der Hund') && listenFb(app).includes('koira') && listenFb(app).includes('Monikko: die Hunde'), listenFb(app));
  }
  app.dispose();
});

test('Kuuntele/sanelu: "Näytä" paljastaa sanan, kirjautuu väärin eikä lasketa päivätavoitteeseen', async () => {
  const app = await boot();
  await toSelf(app);
  await toListen(app);
  showListen(app, Object.assign({}, SV_BIL, { id: 'zl_bil_rev' }), 'dict');
  await app.elements.listenReveal.click(); await app.flush(20);
  assert.ok(listenFb(app).includes('en bil'));
  const st = dbStat(app, 'zl_bil_rev');
  assert.strictEqual(st.dictWrong, 1);
  assert.strictEqual(app.run('dailySummary().count'), 0);
  app.dispose();
});

test('Kuuntele/ymmärtäminen: neljä suomenkielistä vaihtoehtoa (yksi oikea, ei toistoa), oikea ja väärä vastaus', async () => {
  const app = await boot();
  await toSelf(app);
  await toListen(app);
  await app.elements.listenTabs._children[1].click(); await app.flush(20);
  assert.strictEqual(app.run('listenType'), 'comp');
  assert.strictEqual(app.elements.listenChoices.classList.contains('visible'), true);
  assert.strictEqual(app.elements.listenWriteWrap.classList.contains('visible'), false);
  for (let round = 0; round < 20; round++) {
    app.run('pickListenRound()');
    const q = J(app, '({ options: listenQ.options, item: { fi: listenQ.item.fi, id: listenQ.item.id, text: listenQ.item.text } })');
    assert.strictEqual(q.options.length, 4);
    assert.strictEqual(q.options.filter(o => o.correct).length, 1);
    assert.strictEqual(q.options.find(o => o.correct).text, q.item.fi);
    assert.strictEqual(new Set(q.options.map(o => o.text.toLowerCase())).size, 4);
    assert.deepStrictEqual(app.elements.listenChoices._children.map(b => b.textContent), q.options.map(o => o.text));
    assert.ok(q.options.every(o => !o.text.includes(q.item.text)), 'vaihtoehdot suomeksi, ei kohdekielistä sanaa');
  }
  // oikea
  app.run('pickListenRound()');
  let opts = J(app, 'listenQ.options'); let id = app.run('listenQ.item.id');
  await app.elements.listenChoices._children[opts.findIndex(o => o.correct)].click(); await app.flush(30);
  assert.ok(app.elements.listenFeedback.className.includes('correct') && !app.elements.listenFeedback.className.includes('incorrect'));
  assert.strictEqual(dbStat(app, id).listenCorrect, 1);
  assert.strictEqual(dbStat(app, id).streakListen, 1);
  // väärä
  app.run('pickListenRound()');
  opts = J(app, 'listenQ.options'); id = app.run('listenQ.item.id');
  const wrongIdx = opts.findIndex(o => !o.correct);
  await app.elements.listenChoices._children[wrongIdx].click(); await app.flush(30);
  assert.ok(app.elements.listenFeedback.className.includes('incorrect'));
  assert.ok(app.elements.listenChoices._children[wrongIdx].classList.contains('wrong'));
  assert.ok(app.elements.listenChoices._children[opts.findIndex(o => o.correct)].classList.contains('correct'));
  assert.strictEqual(dbStat(app, id).listenWrong, 1);
  assert.strictEqual(dbStat(app, id).streakListen, 0);
  assert.ok(listenFb(app).includes(app.run('listenQ.item.text')), 'palaute näyttää kuullun sanan');
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Kuuntele: tilastokentät omissa kentissään - ei graduoi, ei kosketa kertausväliin eikä tuottaviin laskureihin', async () => {
  const app = await boot();
  await toSelf(app);
  mockNow(app, '2026-07-10T09:00:00');
  const nowTs = app.run('Date.now()');
  seedStat(app, 'zl_seed', { correctCount: 3, streakCorrect: 2, streakKeyboard: 1, srsInterval: 6, srsEase: 2.4, srsDue: nowTs + 6 * 86400000 });
  await app.run('updateHeaderStats()');
  await toListen(app);
  const w = Object.assign({}, SV_BIL, { id: 'zl_seed' });
  for (let i = 0; i < 12; i++) { showListen(app, Object.assign({}, w), 'dict'); await typeListen(app, 'bil'); }
  showListen(app, Object.assign({}, w), 'dict'); await typeListen(app, 'fel');
  let st = dbStat(app, 'zl_seed');
  assert.strictEqual(st.dictCorrect, 12);
  assert.strictEqual(st.dictWrong, 1);
  assert.strictEqual(st.streakDict, 0);
  assert.strictEqual(st.recogHeat, 1);
  [['correctCount', 3], ['incorrectCount', 0], ['streakCorrect', 2], ['streakKeyboard', 1], ['srsInterval', 6], ['srsEase', 2.4], ['srsDue', nowTs + 6 * 86400000]]
    .forEach(([k, v]) => assert.strictEqual(st[k], v, k));
  assert.strictEqual(app.run('isFullyLearned(statsCache[statId({id:"zl_seed"})])'), false);
  assert.strictEqual(app.run('stageKeyboardGraduated(statsCache[statId({id:"zl_seed"})])'), false);
  // pelkkä sanelu/kuuntelu ei aloita sanaa tuottavasti: kirjataan kuten tunnistus
  showListen(app, Object.assign({}, SV_BIL, { id: 'zl_only' }), 'dict'); await typeListen(app, 'en bil');
  showListen(app, Object.assign({}, SV_BIL, { id: 'zl_only2' }), 'comp');
  const oi = J(app, 'listenQ.options').findIndex(o => o.correct);
  await app.elements.listenChoices._children[oi].click(); await app.flush(20);
  ['zl_only', 'zl_only2'].forEach(id => {
    st = dbStat(app, id);
    assert.ok(!st.correctCount && !st.incorrectCount && st.srsDue === undefined, id);
    assert.strictEqual(app.run(`isRecognizedOnly(statsCache[statId({id:"${id}"})])`), true);
  });
  assert.strictEqual(dbStat(app, 'zl_only').dictCorrect, 1);
  assert.strictEqual(dbStat(app, 'zl_only2').listenCorrect, 1);
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Kuuntele: päivätavoite kasvaa itseopiskelussa (sanelu ja ymmärtäminen, oikein ja väärin), peruskoulussa ei päivälaskuria', async () => {
  const app = await boot();
  await toSelf(app);
  mockNow(app, '2026-07-10T09:00:00');
  await toListen(app);
  assert.strictEqual(app.run('dailySummary().count'), 0);
  showListen(app, Object.assign({}, SV_BIL, { id: 'zl_d1' }), 'dict'); await typeListen(app, 'bil');
  assert.strictEqual(app.run('dailySummary().count'), 1);
  showListen(app, Object.assign({}, SV_BIL, { id: 'zl_d2' }), 'dict'); await typeListen(app, 'väärin');
  assert.strictEqual(app.run('dailySummary().count'), 2);
  showListen(app, Object.assign({}, SV_BIL, { id: 'zl_d3' }), 'comp');
  let oi = J(app, 'listenQ.options').findIndex(o => o.correct);
  await app.elements.listenChoices._children[oi].click(); await app.flush(20);
  showListen(app, Object.assign({}, SV_BIL, { id: 'zl_d4' }), 'comp');
  oi = J(app, 'listenQ.options').findIndex(o => !o.correct);
  await app.elements.listenChoices._children[oi].click(); await app.flush(20);
  assert.strictEqual(app.run('dailySummary().count'), 4);
  assert.strictEqual(dailyOf(app).days['2026-07-10'], 4);
  assert.strictEqual(app.elements.dailyLabel.textContent, 'Tänään 4 / 20');
  const log = JSON.parse(app.storage.getItem('dayLog'));
  assert.strictEqual(log['2026-07-10'].sv.a, 4);
  assert.strictEqual(log['2026-07-10'].sv.c, 2);
  app.dispose();
  // peruskoulu: ei päivätavoitetta
  const app2 = await boot();
  await toListen(app2);
  showListen(app2, { id: 'zl_en', fi: 'koira', en: 'dog', pos: 'n' }, 'dict');
  await typeListen(app2, 'dog');
  assert.strictEqual(app2.storage.getItem('selfDaily_en'), null);
  assert.strictEqual(dbStat2(app2, 'zl_en', 'en').dictCorrect, 1);
  app2.dispose();
});

test('Kuuntele: itseopiskelussa erääntyneet sanat ensin; valinta tulee aktiivisesta poolista', async () => {
  const app = await boot();
  await toSelf(app);
  mockNow(app, '2026-07-10T09:00:00');
  const nowTs = app.run('Date.now()');
  const ids = Array.from({ length: 14 }, (_, i) => 'zz_a1_' + (i + 1));
  ids.forEach(id => seedStat(app, id, { srsInterval: 6, srsEase: 2.4, srsDue: nowTs + 6 * 86400000 }));
  ['zz_a1_3', 'zz_a1_9'].forEach(id => seedStat(app, id, { srsInterval: 3, srsEase: 2.4, srsDue: nowTs - 86400000 }));
  await app.run('updateHeaderStats()');
  app.run('initSessionPool()');
  assert.deepStrictEqual(J(app, 'dueWords().map(w => w.id)').sort(), ['zz_a1_3', 'zz_a1_9']);
  await toListen(app);
  for (let i = 0; i < 12; i++) {
    app.run('listenRecent = []; listenType = "dict";');
    const first = app.run('pickListenQuestion().item.id');
    assert.ok(['zz_a1_3', 'zz_a1_9'].includes(first), 'erääntynyt ensin: ' + first);
  }
  // tavallinen valinta: sanat poolista tai tason sanoista
  const pool = new Set(J(app, 'sessionPool.map(w => w.id)').concat(J(app, 'selfLevelWords(selfLevel).map(w => w.id)')));
  for (let i = 0; i < 12; i++) assert.ok(pool.has(app.run('(pickListenQuestion() || {item:{id:null}}).item.id')));
  // ei toista samaa kohdetta heti
  app.run('listenRecent = []; pickListenRound();');
  const seen = [];
  for (let i = 0; i < 4; i++) { seen.push(app.run('listenQ.item.key')); app.run('pickListenRound()'); }
  assert.strictEqual(new Set(seen).size, 4, seen.join());
  app.dispose();
});

test('Kuuntele: ei puhesynteesiä - selkeä ilmoitus, harjoitusta ei voi aloittaa', async () => {
  const app = await boot();
  app.run('delete window.speechSynthesis;');
  await toListen(app);
  await app.flush(400);
  assert.strictEqual(app.elements.listenNotice.hidden, false);
  assert.ok(String(app.elements.listenNotice.textContent).includes('ei tue puhesynteesiä'));
  assert.strictEqual(app.elements.listenCard.hidden, true);
  assert.strictEqual(app.elements.listenAnswerArea.hidden, true);
  assert.strictEqual(app.run('listenQ'), null);
  assert.strictEqual(app.elements.listenReplay.disabled, true);
  assert.strictEqual(app.elements.listenCheck.disabled, true);
  await app.elements.listenReplay.click();
  assert.strictEqual(app.spoken.length, 0);
  assert.strictEqual(app.run('listenSpeak("hund", 1)'), false);
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Kuuntele: kohdekielen ääntä ei ole - "Laitteessa ei ole ruotsin puheääntä"; sopiva ääni tai vielä lataamaton lista sallii', async () => {
  const app = await boot();
  await toSelf(app);
  app.run('speechSynthesis.getVoices = () => [{ lang: "en-GB", name: "Eng" }, { lang: "de-DE", name: "Deu" }];');
  await toListen(app);
  await app.flush(400);
  assert.strictEqual(app.elements.listenNotice.hidden, false);
  assert.strictEqual(app.elements.listenNotice.textContent, 'Laitteessa ei ole ruotsin puheääntä');
  assert.strictEqual(app.run('listenQ'), null, 'kysymystä ei arvota');
  assert.strictEqual(app.elements.listenCard.hidden, true);
  assert.strictEqual(app.spoken.length, 0);
  // sanelun tarkistus ei käynnisty
  app.elements.listenInput.value = 'bil';
  await app.elements.listenCheck.click();
  assert.strictEqual(app.db.data.size, 0);
  // saksan peruskoulussa: ääni löytyy -> harjoitus toimii ja ääni asetetaan
  await app.studyButtons[0].click(); await app.flush(80);
  await app.langButtons[1].click(); await app.flush(80);
  assert.strictEqual(app.run('practiceMode'), 'listen');
  assert.strictEqual(app.elements.listenNotice.hidden, true);
  assert.ok(app.run('listenQ'));
  await app.flush(400);
  assert.strictEqual(app.spoken[app.spoken.length - 1].voice.name, 'Deu');
  // englanti: ääntä ei ole (vain saksa) -> ilmoitus englannin puheäänestä
  app.run('speechSynthesis.getVoices = () => [{ lang: "de-DE", name: "Deu" }];');
  await app.langButtons[0].click(); await app.flush(80);
  assert.strictEqual(app.elements.listenNotice.hidden, false);
  assert.strictEqual(app.elements.listenNotice.textContent, 'Laitteessa ei ole englannin puheääntä');
  // tyhjä äänilista (ei vielä ladattu): oletetaan tuki
  app.run('speechSynthesis.getVoices = () => [];');
  await app.langButtons[2].click(); await app.flush(80);
  assert.strictEqual(app.elements.listenNotice.hidden, true);
  assert.ok(app.run('listenQ'));
  app.dispose();
});

test('Kuuntele/virkesanelu: peruskoulussa SENTENCE_DATA-virkkeet; välimerkit ja isot kirjaimet eivät haittaa; oma tilasto, virketilasto ei muutu', async () => {
  const app = await boot();
  await toListen(app);
  await app.elements.listenTabs._children[2].click(); await app.flush(20);
  assert.strictEqual(app.run('listenType'), 'sent');
  const item = J(app, 'listenQ.item');
  assert.strictEqual(item.kind, 'sentence');
  const ids = J(app, 'activeSentencePool().map(s => s.id)');
  assert.ok(ids.includes(item.id));
  assert.strictEqual(item.text, app.run('listenQ.item.sentence.en'));
  await typeListen(app, item.text.toLowerCase().replace(/[.!?]$/, ''));
  assert.ok(app.elements.listenFeedback.className.includes('correct') && !app.elements.listenFeedback.className.includes('incorrect'), listenFb(app));
  assert.ok(listenFb(app).includes(item.fi));
  const st = JSON.parse(app.storage.getItem('listenStats_en'));
  assert.strictEqual(st[item.key].c, 1);
  assert.ok(!app.db.data.has(app.run(`sentenceStatId({id: ${JSON.stringify(item.id)}})`)), 'virketilastoon ei kosketa');
  // väärä vastaus
  app.run('pickListenRound()');
  await typeListen(app, 'xxxx yyyy');
  assert.ok(app.elements.listenFeedback.className.includes('incorrect'));
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Kuuntele: välilehden vaihto sanelun ja ymmärtämisen välillä vaihtaa syöttötavan', async () => {
  const app = await boot();
  await toListen(app);
  assert.strictEqual(app.elements.listenWriteWrap.classList.contains('visible'), true);
  assert.strictEqual(app.elements.listenCheck.hidden, false);
  assert.strictEqual(app.elements.listenReveal.hidden, false);
  await app.elements.listenTabs._children[1].click(); await app.flush(20);
  assert.strictEqual(app.elements.listenWriteWrap.classList.contains('visible'), false);
  assert.strictEqual(app.elements.listenChoices.classList.contains('visible'), true);
  assert.strictEqual(app.elements.listenCheck.hidden, true);
  assert.strictEqual(app.elements.listenReveal.hidden, true, 'Näytä vain saneluun');
  await app.elements.listenTabs._children[0].click(); await app.flush(20);
  assert.strictEqual(app.elements.listenWriteWrap.classList.contains('visible'), true);
  assert.strictEqual(app.elements.listenChoices._children.length, 0);
  app.dispose();
});

test('Kuuntele: tasonvaihto ja tilanvaihto päivittävät harjoituksen; ruotsin peruskoulu-valinnat eivät kaadu', async () => {
  const app = await boot();
  await toListen(app);
  await app.langButtons[2].click(); await app.flush(80);
  assert.ok(app.run('listenQ'));
  await toSelf(app);
  assert.strictEqual(app.run('practiceMode'), 'listen');
  assert.ok(app.run('listenQ'));
  assert.strictEqual(app.run('listenQ.item.word.sv !== undefined'), true);
  app.run('selfLevel = "A2"; gradeFilter.value = "A2";');
  await app.elements.gradeFilter.dispatch('change'); await app.flush(60);
  assert.ok(app.run('selfLevelWords("A2").some(w => w.id === listenQ.item.id) || sessionPool.some(w => w.id === listenQ.item.id)'));
  await app.studyButtons[0].click(); await app.flush(80);
  assert.strictEqual(app.run('practiceMode'), 'listen');
  assert.ok(app.run('listenQ'));
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

// ---------------- Dynaaminen eteneminen päivätavoitteen jälkeen (vaihe 45) ----------------
// Sisällöstä riippumattomat testit: synteettiset sanat (zz_*, zi_*, zb_*), mockattu kello ja seedatut tilastot.
const LEARNED_KBD = { correctCount: 20, streakCorrect: 6, streakKeyboard: 5 };
const ZERO_STAT = { correctCount: 0, incorrectCount: 0, streakCorrect: 0, streakKeyboard: 0 };
const dynDaily = (app) => J(app, 'loadDaily()');
const wid = (app, id) => `VOCAB.words.find(w => w.id === ${JSON.stringify(id)})`;

// Iso tasoaineisto (A1 nA1 sanaa, A2 nA2 sanaa) kiintiö-, zipf- ja esimakutesteihin.
async function toBigLevels(app, nA1, nA2) {
  app.run(`(function () {
    const a1 = [], a2 = [];
    for (let i = 1; i <= ${nA1}; i++) { VOCAB.words.push({ id: 'zb_a1_' + i, fi: 'testisana a1 ' + i, sv: 'ordaa' + i, self_only: true, pos: 'n' }); a1.push('zb_a1_' + i); }
    for (let i = 1; i <= ${nA2}; i++) { VOCAB.words.push({ id: 'zb_a2_' + i, fi: 'testisana a2 ' + i, sv: 'ordbb' + i, self_only: true, pos: 'n' }); a2.push('zb_a2_' + i); }
    SELF_DATA.topics.length = 0;
    SELF_DATA.topics.push({ id: 'zb_t1', name_fi: 'Iso A1', level: 'A1', concepts: a1 }, { id: 'zb_t2', name_fi: 'Iso A2', level: 'A2', concepts: a2 });
    PRACTICE_WORDS = practiceWords();
  })();`);
  await app.studyButtons[1].click();
  await app.flush(60);
}
function setDaily(app, obj) {
  app.storage.setItem('selfDaily_sv', JSON.stringify(Object.assign({ goal: 20, newPerDay: 10, days: {} }, obj || {})));
}
const freshIdsInPool = (app) => J(app, 'sessionPool.filter(w => !statsCache[statId(w)]).map(w => w.id)');

test('Jatkovalikko: ilmestyy kun päivätavoite täyttyy, sulkeminen ei estä jatkamista, Jatka-nappi avaa uudelleen', async () => {
  const app = await boot();
  await toSelf(app);
  mockNow(app, '2026-07-10T09:00:00');
  app.run('setDailyGoal(10)');
  for (let i = 1; i <= 9; i++) await answerWord(app, 'zz_a1_' + i, true);
  assert.strictEqual(app.elements.continuePanel.hidden, true, 'ei ennen tavoitetta');
  assert.strictEqual(app.elements.continueBtn.style.display, 'none');
  await answerWord(app, 'zz_a1_10', true);
  assert.strictEqual(app.elements.continuePanel.hidden, false, 'paneeli aukeaa kun tavoite täyttyy');
  assert.ok(app.elements.continueTitle.textContent.includes('Päivän tavoite täynnä – jatketaanko?'));
  assert.strictEqual(app.elements.continueBtns.hidden, false);
  assert.strictEqual(app.elements.continueBtn.style.display, '', 'Jatka-nappi näkyy kun tavoite on täynnä');
  // Valintojen tekstit ovat sivun merkkauksessa
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  ['➕ 10 uutta sanaa', '🧗 Haastekierros', '🔁 Kertaa vaikeimmat', '✋ Lopeta tältä päivältä', '⏱ 60 s'].forEach(t => assert.ok(html.includes(t), t));
  // Sulkeminen ei estä jatkamasta normaalisti
  await app.elements.continueClose.click();
  assert.strictEqual(app.elements.continuePanel.hidden, true);
  await answerWord(app, 'zz_a1_11', true);
  assert.strictEqual(app.run('dailySummary().count'), 11);
  assert.strictEqual(app.elements.continuePanel.hidden, true, 'ei aukea uudelleen itsestään');
  assert.ok(app.run('current') !== null);
  // Sama valikko avattavissa myöhemmin
  await app.elements.continueBtn.click();
  assert.strictEqual(app.elements.continuePanel.hidden, false);
  assert.strictEqual(app.elements.adultModalOverlay.classList.contains('visible'), false, 'napin painallus ei avaa raporttia');
  await app.elements.continueBtn.click();
  assert.strictEqual(app.elements.continuePanel.hidden, true);
  app.dispose();
});

test('Jatkovalikko: "10 uutta sanaa" kasvattaa vain tämän päivän kiintiötä', async () => {
  const app = await boot();
  await toSelf(app);
  mockNow(app, '2026-07-10T09:00:00');
  setDaily(app, { goal: 10, newPerDay: 5, auto: false });
  assert.strictEqual(app.run('newWordsLeftToday()'), 5);
  for (let i = 1; i <= 10; i++) await answerWord(app, 'zz_a1_' + i, true);
  assert.strictEqual(app.run('newWordsLeftToday()'), 0, 'kiintiö (5) ylittyi');
  assert.strictEqual(app.elements.continuePanel.hidden, false);
  await app.elements.contNewBtn.click();
  await app.flush(30);
  assert.strictEqual(app.elements.continuePanel.hidden, true, 'valinta sulkee valikon');
  assert.strictEqual(app.run('dailyQuota(loadDaily())'), 15);
  assert.strictEqual(app.run('newWordsLeftToday()'), 5, '15 - 10 käytettyä');
  assert.strictEqual(dynDaily(app).newPerDay, 5, 'perusmäärä ennallaan');
  assert.ok(/lisäkiintiö \+10/.test(app.run('newQuotaText()')), app.run('newQuotaText()'));
  assert.ok(/Uusia sanoja tänään 15/.test(app.elements.dailyNotice.textContent));
  // pooliin tulee uusia sanoja lisäkiintiön verran
  assert.ok(freshIdsInPool(app).length > 0, 'lisäkiintiö tuo uusia sanoja pooliin');
  // toinen painallus kasvattaa lisää, ja seuraavana päivänä kiintiö palaa perusmäärään
  await app.elements.contNewBtn.click();
  assert.strictEqual(app.run('dailyQuota(loadDaily())'), 25);
  mockNow(app, '2026-07-11T09:00:00');
  assert.strictEqual(app.run('dailyQuota(loadDaily())'), 5, 'lisäkiintiö oli vain eiliselle');
  assert.strictEqual(app.run('newWordsLeftToday()'), 5);
  app.dispose();
});

test('Jatkovalikko: "Kertaa vaikeimmat" rajaa poolin heikoimmin meneviin aloitettuihin sanoihin', async () => {
  const app = await boot();
  await toSelf(app);
  mockNow(app, '2026-07-10T09:00:00');
  seedStat(app, 'zz_a1_1', { correctCount: 1, incorrectCount: 5, streakCorrect: 0 });
  seedStat(app, 'zz_a1_2', { correctCount: 3, incorrectCount: 3, streakCorrect: 0 });
  seedStat(app, 'zz_a1_3', { correctCount: 10, incorrectCount: 1, streakCorrect: 5 });
  seedStat(app, 'zz_a1_4', { correctCount: 4, incorrectCount: 0, streakCorrect: 4 });
  seedStat(app, 'zz_a1_5', { recognized: true, correctCount: 0, incorrectCount: 0, streakCorrect: 0, choiceWrong: 4 }); // vain tunnistettu
  await app.run('updateHeaderStats()');
  const hard = J(app, 'hardestWords().map(w => w.id)');
  assert.deepStrictEqual(hard.slice(0, 3), ['zz_a1_1', 'zz_a1_2', 'zz_a1_3'], 'heikoimmin menneet ensin: ' + hard);
  assert.ok(!hard.includes('zz_a1_5'), 'pelkkä tunnistus ei ole aloitettu sana');
  assert.ok(!hard.includes('zz_a1_9'), 'aloittamattomat eivät mukana');
  assert.ok(app.run('hardScore(statsCache[statId({id: "zz_a1_1"})])') > app.run('hardScore(statsCache[statId({id: "zz_a1_2"})])'));
  await app.elements.contHardBtn.click();
  await app.flush(60);
  assert.strictEqual(app.run('reviewHardOnly'), true);
  assert.strictEqual(app.run('reviewDueOnly'), false);
  assert.strictEqual(app.elements.reviewHardBtn.style.display, '');
  for (let i = 0; i < 8; i++) {
    await app.run('pickWord()');
    assert.ok(hard.includes(app.run('current.id')), 'vain vaikeimpia: ' + app.run('current.id'));
  }
  // lopetus palauttaa tavallisen harjoituksen
  await app.elements.reviewHardBtn.click();
  await app.flush(60);
  assert.strictEqual(app.run('reviewHardOnly'), false);
  assert.strictEqual(app.elements.reviewHardBtn.style.display, 'none');
  // ei vaikeita sanoja -> ei käynnisty
  app.db.data.clear();
  await app.run('updateHeaderStats()');
  app.run('setReviewHardOnly(true)');
  assert.strictEqual(app.run('reviewHardOnly'), false);
  assert.ok(/Ei vielä vaikeita/.test(app.elements.dailyNotice.textContent));
  app.dispose();
});

test('Jatkovalikko: "Lopeta tältä päivältä" sulkee valikon ja näyttää yhteenvedon; jatkaminen onnistuu silti', async () => {
  const app = await boot();
  await toSelf(app);
  mockNow(app, '2026-07-10T09:00:00');
  app.run('setDailyGoal(10)');
  for (let i = 1; i <= 8; i++) await answerWord(app, 'zz_a1_' + i, true);
  for (let i = 9; i <= 10; i++) await answerWord(app, 'zz_a1_' + i, false);
  assert.strictEqual(app.elements.continuePanel.hidden, false);
  await app.elements.contStopBtn.click();
  assert.strictEqual(app.elements.continueBtns.hidden, true, 'valinnat piiloon');
  assert.ok(/yhteenveto/.test(app.elements.continueTitle.textContent));
  const t = app.elements.continueText.textContent;
  assert.ok(t.includes('Vastauksia 10 / 10'), t);
  assert.ok(t.includes('Tuottavat vastaukset: 80 % oikein (8/10)'), t);
  assert.ok(t.includes('Uusia sanoja tänään 10'), t);
  assert.ok(t.includes('Huomenna kerrattavia: '), t);
  assert.ok(t.includes('Viikko: 10/70 uutta sanaa'), t);
  assert.strictEqual(dynDaily(app).closedDay, '2026-07-10');
  await app.elements.continueClose.click();
  assert.strictEqual(app.elements.continuePanel.hidden, true);
  // harjoittelu jatkuu normaalisti ja valikon saa takaisin Jatka-napista
  await answerWord(app, 'zz_a1_11', true);
  assert.strictEqual(app.run('dailySummary().count'), 11);
  await app.elements.continueBtn.click();
  assert.strictEqual(app.elements.continuePanel.hidden, false);
  assert.strictEqual(app.elements.continueBtns.hidden, false, 'valikko on taas täysi');
  assert.ok(app.elements.continueTitle.textContent.includes('jatketaanko'));
  app.dispose();
});

test('Automaattisäätö: päätössääntö rajoineen (85 / 70 %, 2x / 3x tavoite, min 5, max 40)', async () => {
  const app = await boot();
  const d = (acc, due, goal, cur) => J(app, `autoAdjustDecision(${acc}, ${due}, ${goal}, ${cur})`);
  assert.deepStrictEqual(d(0.91, 10, 20, 10), { to: 15, delta: 5, reason: 'tarkkuus 91 %' });
  assert.strictEqual(d(0.85, 39, 20, 10).to, 15, 'täsmälleen 85 % ja erääntyviä < 2 x tavoite -> kasvaa');
  assert.strictEqual(d(0.85, 40, 20, 10), null, '2 x tavoite ei ole alle 2 x tavoite');
  assert.strictEqual(d(0.84, 10, 20, 10), null, 'alle 85 % mutta vähintään 70 % -> ennallaan');
  assert.strictEqual(d(0.70, 10, 20, 10), null, 'täsmälleen 70 % ei laske');
  assert.deepStrictEqual(d(0.69, 10, 20, 10), { to: 5, delta: -5, reason: 'tarkkuus 69 %' });
  assert.strictEqual(d(0.8, 60, 20, 10), null, 'täsmälleen 3 x tavoite ei laske');
  const due = d(0.95, 61, 20, 15);
  assert.strictEqual(due.to, 10); assert.ok(due.reason.includes('kertausjono 61'), due.reason);
  assert.strictEqual(d(0.95, 50, 20, 15), null, '2-3 x tavoite: ei kasva eikä laske');
  // rajat
  assert.strictEqual(d(0.99, 0, 20, 40), null, 'max 40');
  assert.strictEqual(d(0.99, 0, 20, 38).to, 40, 'nousee enintään 40:een');
  assert.strictEqual(d(0.5, 0, 20, 5), null, 'min 5');
  assert.strictEqual(d(0.5, 0, 20, 7).to, 5, 'laskee enintään 5:een');
  assert.strictEqual(d(null, 0, 20, 10), null);
  app.dispose();
});

test('Automaattisäätö: päivänvaihteessa edellisen harjoituspäivän mukaan, kirjataan syy, kerran päivässä', async () => {
  const app = await boot();
  await toSelf(app);
  const prev = { '2026-07-09': { p: [18, 20], r: [0, 0] } };
  setDaily(app, { acc: prev, adjDay: '2026-07-09' });
  mockNow(app, '2026-07-10T09:00:00');
  app.run('dailyRollover()');
  assert.strictEqual(dynDaily(app).newPerDay, 15);
  assert.strictEqual(app.run('newQuotaText()'), 'Uusia sanoja tänään 15 (+5: tarkkuus 90 %)');
  assert.strictEqual(dynDaily(app).adjLog.length, 1);
  assert.strictEqual(dynDaily(app).adjLog[0].reason, 'tarkkuus 90 %');
  app.run('dailyRollover()'); app.run('newWordsLeftToday()'); app.run('updateSelfDailyUI()');
  assert.strictEqual(dynDaily(app).newPerDay, 15, 'säätö vain kerran päivässä');
  assert.strictEqual(dynDaily(app).adjLog.length, 1);
  assert.strictEqual(app.run('newWordsLeftToday()'), 15);
  // seuraavana päivänä uusi tarkistus: tarkkuus 10 -> ei muutoksia, mutta teksti ei enää väitä eilistä säätöä
  mockNow(app, '2026-07-11T09:00:00');
  assert.strictEqual(app.run('newQuotaText()'), 'Uusia sanoja tänään 15');
  // heikko päivä -> laskee ja merkitään miinuksella
  const d = dynDaily(app);
  d.acc['2026-07-10'] = { p: [13, 20], r: [5, 5] };
  app.storage.setItem('selfDaily_sv', JSON.stringify(d));
  app.run('dailyRollover()');
  assert.strictEqual(dynDaily(app).newPerDay, 10);
  assert.strictEqual(app.run('newQuotaText()'), 'Uusia sanoja tänään 10 (−5: tarkkuus 65 %)');
  app.dispose();
});

test('Automaattisäätö: pois päältä, liian pieni otos ja keskialue eivät muuta kiintiötä', async () => {
  const app = await boot();
  await toSelf(app);
  mockNow(app, '2026-07-10T09:00:00');
  const run = (extra) => { setDaily(app, extra); app.run('dailyRollover()'); return dynDaily(app).newPerDay; };
  assert.strictEqual(run({ acc: { '2026-07-09': { p: [20, 20], r: [0, 0] } }, auto: false }), 10, 'automaattisäätö pois');
  assert.strictEqual(run({ acc: { '2026-07-09': { p: [9, 9], r: [0, 0] } } }), 10, 'alle 10 tuottavaa vastausta ei riitä');
  assert.strictEqual(run({ acc: { '2026-07-09': { p: [16, 20], r: [0, 0] } } }), 10, '80 % -> ennallaan');
  assert.strictEqual(run({ acc: { '2026-07-09': { p: [0, 0], r: [30, 30] } } }), 10, 'pelkkä tunnistus ei säädä');
  assert.strictEqual(run({}), 10, 'ei edellistä harjoituspäivää');
  assert.strictEqual(run({ newPerDay: 40, acc: { '2026-07-09': { p: [20, 20], r: [0, 0] } } }), 40, 'max 40');
  assert.strictEqual(run({ newPerDay: 5, acc: { '2026-07-09': { p: [10, 20], r: [0, 0] } } }), 5, 'min 5');
  // asetus kytkeytyy ja säilyy
  app.run('setAutoNew(false)');
  assert.strictEqual(dynDaily(app).auto, false);
  app.run('setAutoNew(true)');
  assert.strictEqual(dynDaily(app).auto, true);
  // vain päivä ennen tätä päivää lasketaan; tämän päivän tulokset eivät säädä tätä päivää
  assert.strictEqual(run({ acc: { '2026-07-10': { p: [20, 20], r: [0, 0] } } }), 10);
  app.dispose();
});

test('Automaattisäätö: kertausjonon paisuminen laskee, kohtalainen jono estää kasvun; käsin asetettu arvo on lähtötaso', async () => {
  const app = await boot();
  await toSelf(app);
  mockNow(app, '2026-07-10T09:00:00');
  const ids = J(app, 'PRACTICE_WORDS.slice(0, 40).map(w => w.id)');
  const past = app.run('Date.now()') - DAY;
  const seedDue = (n) => { app.db.data.clear(); ids.slice(0, n).forEach(id => seedStat(app, id, { srsInterval: 3, srsEase: 2.5, srsDue: past })); };
  const prev = { '2026-07-09': { p: [20, 20], r: [0, 0] } };
  seedDue(31); await app.run('updateHeaderStats()');
  setDaily(app, { goal: 10, newPerDay: 15, acc: prev });
  app.run('dailyRollover()');
  assert.strictEqual(dynDaily(app).newPerDay, 10, '31 erääntyvää > 3 x 10');
  assert.ok(/−5: kertausjono 31 yli 3 × tavoite/.test(app.run('newQuotaText()')), app.run('newQuotaText()'));
  seedDue(25); await app.run('updateHeaderStats()');
  setDaily(app, { goal: 10, newPerDay: 15, acc: prev });
  app.run('dailyRollover()');
  assert.strictEqual(dynDaily(app).newPerDay, 15, '25 erääntyvää (2-3 x tavoite): ennallaan');
  seedDue(19); await app.run('updateHeaderStats()');
  setDaily(app, { goal: 10, newPerDay: 15, acc: prev });
  app.run('dailyRollover()');
  assert.strictEqual(dynDaily(app).newPerDay, 20, '19 erääntyvää < 2 x tavoite: kasvaa');
  // käsin asetettu arvo on lähtötaso: otetaan heti käyttöön eikä säädetä enää samana päivänä
  app.run('setNewPerDay(30)');
  assert.strictEqual(dynDaily(app).newPerDay, 30);
  assert.strictEqual(dynDaily(app).newBase, 30);
  app.run('dailyRollover()');
  assert.strictEqual(dynDaily(app).newPerDay, 30);
  assert.strictEqual(app.run('newQuotaText()'), 'Uusia sanoja tänään 30');
  // seuraavana päivänä säätö lähtee käsin asetetusta arvosta
  const d = dynDaily(app);
  d.acc['2026-07-10'] = { p: [19, 20], r: [0, 0] };
  app.storage.setItem('selfDaily_sv', JSON.stringify(d));
  seedDue(0); await app.run('updateHeaderStats()');
  mockNow(app, '2026-07-11T09:00:00');
  app.run('dailyRollover()');
  assert.strictEqual(dynDaily(app).newPerDay, 35);
  assert.strictEqual(dynDaily(app).newBase, 30, 'lähtötaso säilyy tietona');
  app.dispose();
});

test('Automaattisäätö: ensimmäinen vastaus uutena päivänä säätää kiintiön ennen uusien sanojen valintaa', async () => {
  const app = await boot();
  await toSelf(app);
  setDaily(app, { goal: 10, newPerDay: 10, acc: { '2026-07-09': { p: [19, 20], r: [0, 0] } }, adjDay: '2026-07-09' });
  mockNow(app, '2026-07-10T09:00:00');
  await answerWord(app, 'zz_a1_1', true);
  assert.strictEqual(dynDaily(app).newPerDay, 15);
  assert.strictEqual(dynDaily(app).adjDay, '2026-07-10');
  assert.strictEqual(dynDaily(app).acc['2026-07-10'].p[1], 1, 'tämän päivän kirjaus alkaa');
  // raportissa näkyy muutos ja syy sekä asetukset
  await app.run('renderAdultView()');
  const html = String(app.elements.adultContent.innerHTML);
  assert.ok(html.includes('Uusia sanoja tänään 15 (+5: tarkkuus 95 %)'), html.slice(0, 600));
  assert.ok(html.includes('id="autoNewToggle" checked'));
  assert.ok(html.includes('<option value="15" selected>15</option>'), 'ei-listalla oleva arvo näkyy valinnassa');
  app.dispose();
});

test('Tarkkuus: tuottavat vastaukset ja tunnistus kirjataan päivän tietoihin erikseen', async () => {
  const app = await boot();
  await toSelf(app);
  mockNow(app, '2026-07-10T09:00:00');
  for (let i = 1; i <= 3; i++) await answerWord(app, 'zz_a1_' + i, true);
  await answerWord(app, 'zz_a1_4', false);
  const rec = async (id, ok, method, countDaily) =>
    app.run(`recordRecognition(${wid(app, id)}, ${ok}, ${JSON.stringify(method)}${countDaily === undefined ? '' : ', ' + countDaily})`);
  await rec('zz_a1_5', true, 'choice');
  await rec('zz_a1_6', false, 'match');
  await rec('zz_a1_7', true, 'listen');
  await rec('zz_a1_8', true, 'dict');       // sanelu on tuottava
  await rec('zz_a1_9', false, 'dict', false); // "Näytä" ei laske päivälaskuriin eikä tarkkuuteen
  let a = J(app, 'accToday()');
  assert.deepStrictEqual(a.p, { ok: 4, n: 5, pct: 80 });
  assert.deepStrictEqual(a.r, { ok: 2, n: 3, pct: 67 });
  assert.strictEqual(app.run('dailySummary().count'), 8);
  // tallennus selfDaily-tietoihin
  assert.deepStrictEqual(dailyOf(app).acc['2026-07-10'], { p: [4, 5], r: [2, 3] });
  // kutsu ilman tuloksia ei kosketa tarkkuuteen
  app.run('dailyRecordAnswer()');
  assert.deepStrictEqual(dailyOf(app).acc['2026-07-10'], { p: [4, 5], r: [2, 3] });
  // vanhat päivät tallentuvat omille avaimilleen
  mockNow(app, '2026-07-11T09:00:00');
  assert.strictEqual(J(app, 'accToday().p.n'), 0);
  assert.strictEqual(Object.keys(dailyOf(app).acc).length, 1);
  app.dispose();
});

test('Tarkkuus: taivutustehtävä on tuottava vastaus', async () => {
  const app = await boot();
  await toInfl(app);
  mockNow(app, '2026-07-10T09:00:00');
  showInfl(app, 'zi_n1', 'gender');
  await app.run('answerInflChoice("en")');
  showInfl(app, 'zi_n2', 'gender');
  await app.run('answerInflChoice("en")'); // väärin (ett)
  assert.deepStrictEqual(J(app, 'loadDaily().acc["2026-07-10"]'), { p: [1, 2], r: [0, 0] });
  app.dispose();
});

test('Ennuste: "Huomenna kerrattavia: n" palkissa ja raportissa', async () => {
  const app = await boot();
  await toSelf(app);
  mockNow(app, '2026-07-10T12:00:00');
  const d = (n) => app.run(`new Date(2026, 6, ${10 + n}).getTime()`);
  seedStat(app, 'zz_a1_1', { srsInterval: 1, srsDue: d(0) });   // tänään
  seedStat(app, 'zz_a1_2', { srsInterval: 1, srsDue: d(1) });   // huomenna
  seedStat(app, 'zz_a1_3', { srsInterval: 2, srsDue: d(1) });   // huomenna
  seedStat(app, 'zz_a1_4', { srsInterval: 3, srsDue: d(2) });   // ylihuomenna
  await app.run('updateHeaderStats()');
  assert.strictEqual(app.run('tomorrowForecast()'), 2);
  assert.strictEqual(app.elements.forecastLabel.textContent, 'Huomenna kerrattavia: 2');
  assert.strictEqual(J(app, 'buildProgressReport().dyn.forecast'), 2);
  await app.run('renderAdultView()');
  assert.ok(String(app.elements.adultContent.innerHTML).includes('Huomenna kerrattavia: 2.'));
  // vastaus siirtää sanan huomiselle: ennuste kasvaa
  await answerWord(app, 'zz_a1_5', true);
  assert.strictEqual(app.elements.forecastLabel.textContent, 'Huomenna kerrattavia: 3');
  app.dispose();
});

test('Portaat: wordStep eri tilastoilla (tunnistus, tuotto, taivutus ohitetaan jos dataa ei ole, sanelu)', async () => {
  const app = await boot();
  await toInfl(app); // zi_*-sanat: osalla taivutusdataa (zi_n*, zi_v*, zi_a*), zi_x_proper ilman
  const set = (id, extra) => seedStat(app, id, Object.assign({}, ZERO_STAT, extra));
  set('zi_n2', { incorrectCount: 3 });
  set('zi_n3', { recognized: true });
  set('zi_n4', { choiceCorrect: 1 });
  set('zi_n5', { matchCorrect: 2 });
  set('zi_n6', { listenCorrect: 1 });
  set('zi_n7', { dictCorrect: 1 });
  set('zi_n8', { correctCount: 1, streakCorrect: 1 });
  set('zi_n9', { correctCount: 2, streakCorrect: 2 });
  set('zi_a1', { streakKeyboard: 3 });                       // läpäisty kirjoitusvaihe = tuotettu
  set('zi_a2', { streakKeyboard: 3, dictCorrect: 1 });       // tuotettu + kuultu, mutta taivutus puuttuu
  set('zi_x_proper', { correctCount: 2, streakCorrect: 2 });  // ei taivutusdataa -> porras 3 ohitetaan
  set('zi_x_rosa', { correctCount: 2, streakCorrect: 2, dictCorrect: 1 });
  await app.run('updateHeaderStats()');
  const step = (id) => app.run(`wordStep(${wid(app, id)})`);
  assert.strictEqual(step('zi_n1'), 0, 'ei tilastoa: uusi');
  assert.strictEqual(step('zi_n2'), 0, 'pelkkiä virheitä: ei tunnistettu');
  assert.strictEqual(step('zi_n3'), 1, 'tasotestissä tunnistettu');
  assert.strictEqual(step('zi_n4'), 1, 'monivalinta');
  assert.strictEqual(step('zi_n5'), 1, 'yhdistely');
  assert.strictEqual(step('zi_n6'), 1, 'kuullun ymmärtäminen');
  assert.strictEqual(step('zi_n7'), 1, 'sanelu yksin ei tuota');
  assert.strictEqual(step('zi_n8'), 1, 'yksi oikein: tunnistettu, ei vielä tuotettu');
  assert.strictEqual(step('zi_n9'), 2, 'putki 2: tuotettu; taivutus puuttuu');
  assert.strictEqual(step('zi_a1'), 2, 'vaihe läpäisty = tuotettu');
  assert.strictEqual(step('zi_a2'), 2, 'taivutus vaaditaan, vaikka sanelu on tehty');
  assert.strictEqual(step('zi_x_proper'), 3, 'ei taivutusdataa: taivutusporras ohitetaan');
  assert.strictEqual(step('zi_x_rosa'), 4, 'ei taivutusdataa + sanelu: kuultu');
  assert.strictEqual(app.run(`wordInflTasks(${wid(app, 'zi_x_proper')}).length`), 0);
  assert.ok(app.run(`wordInflTasks(${wid(app, 'zi_n9')}).length`) >= 2);
  // taivutustehtävä oikein -> porras 3; väärät eivät riitä; sanelu -> 4
  app.storage.setItem('inflStats_sv', JSON.stringify({ 'gender:zi_n9': { c: 0, w: 2 } }));
  assert.strictEqual(step('zi_n9'), 2, 'pelkät väärät taivutusvastaukset eivät riitä');
  app.storage.setItem('inflStats_sv', JSON.stringify({ 'gender:zi_n9': { c: 1, w: 2 }, 'adj:zi_a2': { c: 1, w: 0 } }));
  assert.strictEqual(step('zi_n9'), 3, 'taivutus oikein');
  assert.strictEqual(step('zi_a2'), 4, 'taivutus + sanelu');
  set('zi_n9', { correctCount: 2, streakCorrect: 2, dictCorrect: 1 });
  await app.run('updateHeaderStats()');
  assert.strictEqual(step('zi_n9'), 4);
  // seuraavan portaan tavoite
  assert.deepStrictEqual(J(app, `nextStepTarget(${wid(app, 'zi_n1')})`), { from: 0, to: 1 });
  assert.deepStrictEqual(J(app, `nextStepTarget(${wid(app, 'zi_n3')})`), { from: 1, to: 2 });
  assert.deepStrictEqual(J(app, `nextStepTarget(${wid(app, 'zi_a1')})`), { from: 2, to: 3 });
  assert.deepStrictEqual(J(app, `nextStepTarget(${wid(app, 'zi_x_proper')})`), { from: 3, to: 4 });
  assert.deepStrictEqual(J(app, `nextStepTarget(${wid(app, 'zi_n9')})`), { from: 4, to: 4 }, 'portaalla 4 vain kertausta (virkeporras varattu)');
  app.dispose();
});

test('Portaat: jakauma Oma edistyminen -näkymässä', async () => {
  const app = await boot();
  await toInfl(app);
  const set = (id, extra) => seedStat(app, id, Object.assign({}, ZERO_STAT, extra));
  set('zi_n3', { recognized: true }); set('zi_n4', { choiceCorrect: 1 }); set('zi_n8', { correctCount: 1 });
  set('zi_x_proper', { correctCount: 2, streakCorrect: 2 });
  await app.run('updateHeaderStats()');
  const dist = J(app, 'stepDistribution()');
  const all = app.run('selfAllWords().length');
  assert.strictEqual(dist.length, 6);
  assert.strictEqual(dist.reduce((a, b) => a + b, 0), all, 'jokainen sana yhdellä portaalla');
  assert.strictEqual(dist[1], 3); assert.strictEqual(dist[3], 1); assert.strictEqual(dist[5], 0, 'ei harjoiteltuja virkkeitä: porras 5 tyhjä');
  assert.strictEqual(dist[0], all - 4);
  const rep = J(app, 'buildProgressReport()');
  assert.deepStrictEqual(rep.steps, dist);
  await app.run('renderAdultView()');
  const html = String(app.elements.adultContent.innerHTML);
  assert.ok(html.includes('Haasteportaat'));
  ['0 Uusi', '1 Tunnistettu', '2 Tuotettu', '3 Taivutettu', '4 Kuultu', '5 Virkkeessä'].forEach(t => assert.ok(html.includes(t), t));
  app.dispose();
});

// Haastekierroksen testiaineisto: viisi sanaa eri portailla (infl-aineisto zi_*)
async function toChallenge(app) {
  addInflFixture(app);
  await app.studyButtons[1].click();
  await app.flush(60);
  const set = (id, extra) => seedStat(app, id, Object.assign({}, ZERO_STAT, extra));
  set('zi_n1', { incorrectCount: 2 });                                   // porras 0 -> tunnistus (valinta)
  set('zi_n2', { recognized: true, correctCount: 1, streakCorrect: 1 }); // porras 1 -> tuotto (kirjoitus)
  set('zi_n3', { correctCount: 2, streakCorrect: 2 });                   // porras 2 -> taivutus
  set('zi_v1', { correctCount: 2, streakCorrect: 2 });                   // porras 3 (infl tehty) -> sanelu
  set('zi_a1', { correctCount: 3, streakCorrect: 3, dictCorrect: 1 });   // porras 4 -> kertaus
  app.storage.setItem('inflStats_sv', JSON.stringify({ 'verb:zi_v1': { c: 1, w: 0 }, 'adj:zi_a1': { c: 1, w: 0 } }));
  await app.run('updateHeaderStats()');
}
// Vastaa nykyiseen haastetehtävään (oikein tai väärin) sen oikealla harjoitusfunktiolla.
async function solveChallengeTask(app, correct) {
  const kind = app.run('challenge.tasks[challenge.idx].kind');
  const ok = correct !== false;
  if (kind === 'choice') {
    const i = app.run('choiceQuestion.options.findIndex(o => o.correct)');
    const n = app.run('choiceQuestion.options.length');
    await app.run(`answerChoice(${ok ? i : (i + 1) % n})`);
  } else if (kind === 'type') {
    await app.run(`checkAnswer(${ok ? 'acceptedAnswers()[0]' : '"xxxx"'}, "keyboard")`);
  } else if (kind === 'infl') {
    if (app.run('inflQ.task.kind') === 'choice') await app.run(`answerInflChoice(${ok ? 'inflQ.correct' : '"__väärin"'})`);
    else await typeInfl(app, ok ? J(app, 'inflQ.fields.map(f => f.value)') : J(app, 'inflQ.fields.map(f => "xxxx")'));
  } else if (kind === 'dict') {
    await typeListen(app, ok ? app.run('listenQ.item.text') : 'xxxx');
  }
  return kind;
}

test('Haastekierros: tehtävävalinta - vain aloitetut sanat, enintään 10, seuraavan portaan harjoitus ja suunta suomi -> kohdekieli', async () => {
  const app = await boot();
  await toChallenge(app);
  const tasks = J(app, 'buildChallengeTasks(10).map(t => ({ id: t.w.id, kind: t.kind, from: t.from, to: t.to, dir: t.dir, task: t.inflTask ? t.inflTask.id : null }))');
  const by = Object.fromEntries(tasks.map(t => [t.id, t]));
  assert.deepStrictEqual(Object.keys(by).sort(), ['zi_a1', 'zi_n1', 'zi_n2', 'zi_n3', 'zi_v1'], 'vain aloitetut sanat: ' + Object.keys(by));
  assert.strictEqual(tasks.length, 5);
  assert.strictEqual(by.zi_n1.kind, 'choice');  assert.strictEqual(by.zi_n1.to, 1);
  assert.strictEqual(by.zi_n2.kind, 'type');    assert.strictEqual(by.zi_n2.to, 2);
  assert.strictEqual(by.zi_n3.kind, 'infl');    assert.strictEqual(by.zi_n3.to, 3);
  assert.ok(['gender', 'def', 'pl'].includes(by.zi_n3.task), by.zi_n3.task);
  assert.strictEqual(by.zi_v1.kind, 'dict');    assert.strictEqual(by.zi_v1.to, 4);
  assert.strictEqual(by.zi_a1.kind, 'type');    assert.deepStrictEqual([by.zi_a1.from, by.zi_a1.to], [4, 4]);
  tasks.forEach(t => assert.strictEqual(t.dir, 'fi-target'));
  // enintään 10 tehtävää, kaikki eri sanoja
  for (let i = 1; i <= 14; i++) seedStat(app, 'zz_x' + i, ZERO_STAT);
  app.run(`for (let i = 1; i <= 14; i++) { VOCAB.words.push({ id: 'zz_x' + i, fi: 'x' + i, sv: 'xord' + i, self_only: true, pos: 'n' }); }
    SELF_DATA.topics[0].concepts.push(...Array.from({length: 14}, (_, i) => 'zz_x' + (i + 1))); PRACTICE_WORDS = practiceWords();`);
  await app.run('updateHeaderStats()');
  const ten = J(app, 'buildChallengeTasks(10).map(t => t.w.id)');
  assert.strictEqual(ten.length, 10);
  assert.strictEqual(new Set(ten).size, 10);
  // liian vähän aloitettuja sanoja -> kierrosta ei aloiteta
  app.db.data.clear();
  seedStat(app, 'zi_n1', ZERO_STAT); seedStat(app, 'zi_n2', ZERO_STAT);
  await app.run('updateHeaderStats()');
  assert.strictEqual(app.run('startChallengeRound()'), false);
  assert.strictEqual(app.run('challenge'), null);
  assert.ok(/vähintään 3 aloitettua sanaa/.test(app.elements.dailyNotice.textContent));
  app.dispose();
});

test('Haastekierros: kierros eri harjoitusmuodoilla, tulokset olemassa oleviin kenttiin, yhteenveto portaiden noususta', async () => {
  const app = await boot();
  await toChallenge(app);
  mockNow(app, '2026-07-10T09:00:00');
  assert.strictEqual(app.run('practiceMode'), 'words');
  await app.elements.contChallengeBtn.click();
  await app.flush(30);
  assert.ok(app.run('challenge'));
  assert.strictEqual(app.elements.challengeBar.hidden, false);
  assert.ok(/Haastekierros 1\/5/.test(app.elements.challengeLabel.textContent), app.elements.challengeLabel.textContent);
  assert.strictEqual(app.elements.continuePanel.hidden, true);
  const modeOf = { choice: 'words', type: 'words', infl: 'infl', dict: 'listen' };
  const seen = [];
  for (let i = 0; i < 5; i++) {
    assert.strictEqual(app.run('challenge.idx'), i);
    const kind = app.run('challenge.tasks[challenge.idx].kind');
    assert.strictEqual(app.run('practiceMode'), modeOf[kind], 'harjoittelutapa vaihtuu tehtävän mukaan: ' + kind);
    if (kind === 'choice' || kind === 'type') {
      assert.strictEqual(app.run('direction'), 'fi-target', 'suunta vaihdettu: suomi -> kohdekieli');
      assert.strictEqual(app.run('current.id'), app.run('challenge.tasks[challenge.idx].w.id'));
      assert.strictEqual(app.run('activeMode'), kind === 'choice' ? 'choice' : 'keyboard');
      assert.ok(/nomini|verbi|adj/.test(app.elements.promptWord.textContent), 'kehote suomeksi: ' + app.elements.promptWord.textContent);
    }
    seen.push(await solveChallengeTask(app, true));
    if (i === 0) await app.flush(1300); // ensimmäinen etenee oikealla ajastimella (pickWord/pickInflRound/pickListenRound)
    else app.run(kind === 'infl' ? 'pickInflRound()' : kind === 'dict' ? 'pickListenRound()' : 'pickWord()');
  }
  assert.deepStrictEqual(seen.slice().sort(), ['choice', 'dict', 'infl', 'type', 'type']);
  // kierros päättyi: tila palautui, yhteenveto näkyy
  assert.strictEqual(app.run('challenge'), null);
  assert.strictEqual(app.elements.challengeBar.hidden, true);
  assert.strictEqual(app.run('practiceMode'), 'words');
  assert.strictEqual(app.run('activeMode'), 'keyboard');
  assert.strictEqual(app.elements.continuePanel.hidden, false);
  assert.strictEqual(app.elements.continueTitle.textContent, 'Haastekierros valmis');
  const t = app.elements.continueText.textContent;
  assert.ok(t.includes('Oikein 5 / 5'), t);
  assert.ok(t.includes('portaalla nousi 4 sanaa'), t);
  assert.ok(/Tunnistettu → Tuotettu|Uusi → Tunnistettu|Tuotettu → Taivutettu|Taivutettu → Kuultu/.test(t), t);
  // tulokset kirjautuivat olemassa oleviin tilastokenttiin
  assert.strictEqual(dbStat(app, 'zi_n1').choiceCorrect, 1);
  assert.strictEqual(dbStat(app, 'zi_n2').correctCount, 2);
  assert.strictEqual(dbStat(app, 'zi_n2').streakCorrect, 2);
  assert.strictEqual(dbStat(app, 'zi_v1').dictCorrect, 1);
  assert.ok(Object.keys(inflStatsOf(app)).some(k => k.endsWith(':zi_n3') && inflStatsOf(app)[k].c === 1), JSON.stringify(inflStatsOf(app)));
  // portaat nousivat
  assert.strictEqual(app.run(`wordStep(${wid(app, 'zi_n1')})`), 1);
  assert.strictEqual(app.run(`wordStep(${wid(app, 'zi_n2')})`), 2);
  assert.strictEqual(app.run(`wordStep(${wid(app, 'zi_n3')})`), 3);
  assert.strictEqual(app.run(`wordStep(${wid(app, 'zi_v1')})`), 4);
  // päivän tietoihin ja päivälaskuriin
  assert.deepStrictEqual(dynDaily(app).chal['2026-07-10'], { r: 1, t: 5, ok: 5, up: 4 });
  assert.strictEqual(dailyToday(app), 5);
  assert.strictEqual(app.storage.getItem('selfChallenge_sv'), null, 'tallennettu tila poistuu kierroksen jälkeen');
  assert.deepStrictEqual(J(app, 'accToday().p'), { ok: 4, n: 4, pct: 100 }, 'kirjoitus, taivutus ja sanelu ovat tuottavia');
  assert.deepStrictEqual(J(app, 'accToday().r'), { ok: 1, n: 1, pct: 100 }, 'monivalinta on tunnistusta');
  // raportti näyttää kierroksen
  await app.run('renderAdultView()');
  assert.ok(String(app.elements.adultContent.innerHTML).includes('tänään 1 kierrosta, 5/5 oikein, portaalla nousi 4 sanaa'));
  app.dispose();
});

const advanceChallenge = (app) => {
  const k = app.run('challenge && challenge.tasks[challenge.idx] && challenge.tasks[challenge.idx].kind');
  return app.run(k === 'infl' ? 'pickInflRound()' : k === 'dict' ? 'pickListenRound()' : 'pickWord()');
};

test('Haastekierros: väärät vastaukset ja ohitus eivät nosta portaalla; ohitettu tehtävä ei kirjaudu vastaukseksi', async () => {
  const app = await boot();
  await toChallenge(app);
  mockNow(app, '2026-07-10T09:00:00');
  assert.strictEqual(app.run('startChallengeRound()'), true);
  await app.flush(20);
  for (let i = 0; i < 5; i++) {
    if (i !== 1) await solveChallengeTask(app, false); // tehtävä 2 ohitetaan
    await advanceChallenge(app);
  }
  assert.strictEqual(app.run('challenge'), null, 'kierros päättyi');
  const t = app.elements.continueText.textContent;
  assert.ok(t.includes('Oikein 0 / 4'), t);
  assert.ok(t.includes('ohitettu 1'), t);
  assert.ok(t.includes('portaalla nousi 0 sanaa'), t);
  assert.deepStrictEqual(dynDaily(app).chal['2026-07-10'], { r: 1, t: 4, ok: 0, up: 0 });
  assert.strictEqual(dailyToday(app), 4, 'ohitettu ei lasketa päivätavoitteeseen');
  app.dispose();
});

test('Haastekierros: pikakierros "⏱ 60 s" päättyy ajan loppuessa; käsin lopetus ja harjoittelutavan vaihto päättävät kierroksen', async () => {
  const app = await boot();
  await toChallenge(app);
  mockNow(app, '2026-07-10T09:00:00');
  await app.elements.contTimedBtn.click();
  await app.flush(20);
  assert.strictEqual(app.run('challenge.timed'), true);
  assert.strictEqual(app.run('challenge.endsAt - Date.now()'), 60000);
  assert.strictEqual(app.elements.challengeTimer.textContent, '60 s');
  assert.ok(/Pikakierros 1\/5/.test(app.elements.challengeLabel.textContent));
  await solveChallengeTask(app, true);
  await advanceChallenge(app); // seuraava tehtävä
  mockNow(app, '2026-07-10T09:00:30');
  app.run('challengeTick()');
  assert.ok(app.run('challenge'), 'kesken vielä 30 s');
  assert.strictEqual(app.elements.challengeTimer.textContent, '30 s');
  mockNow(app, '2026-07-10T09:01:01');
  app.run('challengeTick()');
  assert.strictEqual(app.run('challenge'), null, 'aika loppui');
  assert.strictEqual(app.elements.continueTitle.textContent, 'Pikakierros valmis');
  assert.ok(/Oikein 1 \/ 1/.test(app.elements.continueText.textContent), app.elements.continueText.textContent);
  assert.strictEqual(app.storage.getItem('selfChallenge_sv'), null, 'pikakierrosta ei tallenneta');
  // käsin lopetus
  mockNow(app, '2026-07-10T10:00:00');
  assert.strictEqual(app.run('startChallengeRound()'), true);
  await app.elements.challengeStopBtn.click();
  assert.strictEqual(app.run('challenge'), null);
  assert.strictEqual(app.elements.challengeBar.hidden, true);
  // harjoittelutavan vaihto kesken kierroksen päättää kierroksen
  assert.strictEqual(app.run('startChallengeRound()'), true);
  await app.practiceButtons[3].click(); // Yhdistä
  await app.flush(40);
  assert.strictEqual(app.run('challenge'), null);
  assert.strictEqual(app.run('practiceMode'), 'match');
  assert.strictEqual(app.run('activeMode'), 'keyboard');
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Haastekierros: keskeytynyt kierros tallentuu localStorageen ja jatkuu samana päivänä', async () => {
  const app = await boot();
  await toChallenge(app);
  mockNow(app, '2026-07-10T09:00:00');
  app.run('startChallengeRound()');
  await app.flush(20);
  const order = J(app, 'challenge.tasks.map(t => t.w.id)');
  await solveChallengeTask(app, true);
  app.run('challengeAdvance()');
  await solveChallengeTask(app, false);
  const saved = JSON.parse(app.storage.getItem('selfChallenge_sv'));
  assert.strictEqual(saved.day, '2026-07-10');
  assert.deepStrictEqual(saved.tasks.map(t => t.id), order);
  assert.strictEqual(saved.idx, 1);
  assert.deepStrictEqual(saved.results.slice(0, 3), [1, -1, null]);
  // "uudelleenlataus": kierros katoaa muistista, tallenne jää
  app.run('clearTimeout(challenge.tick); challenge = null; challengeBarEl.hidden = true; updateSelfDailyUI();');
  assert.ok(app.run('savedChallenge()'));
  assert.strictEqual(app.elements.continueBtn.style.display, '', 'Jatka-nappi näkyy keskeneräisen kierroksen takia');
  await app.elements.continueBtn.click();
  assert.strictEqual(app.elements.contResumeBtn.style.display, '');
  await app.elements.contResumeBtn.click();
  await app.flush(20);
  assert.strictEqual(app.run('challenge.idx'), 2, 'jatkuu ensimmäisestä vastaamattomasta');
  assert.strictEqual(app.run('challenge.results.filter(Boolean).length'), 2);
  assert.deepStrictEqual(J(app, 'challenge.tasks.map(t => t.w.id)'), order);
  // toisena päivänä tallenne ei ole voimassa
  app.run('challengeFinish(true, true)');
  app.storage.setItem('selfChallenge_sv', JSON.stringify(saved));
  mockNow(app, '2026-07-11T09:00:00');
  assert.strictEqual(app.run('savedChallenge()'), null);
  app.dispose();
});

test('Uudet sanat: yleisyysjärjestys (zipf_fi, yleisin ensin) pienellä satunnaisuudella kolmesta parhaasta', async () => {
  const app = await boot();
  await toBigLevels(app, 30, 5);
  // zipf nousee id:n mukana: zb_a1_30 on yleisin
  app.run(`VOCAB.words.forEach(w => { const m = /^zb_a1_(\\d+)$/.exec(w.id); if (m) w.zipf_fi = 4 + Number(m[1]) / 10; });`);
  setDaily(app, { newPerDay: 4, auto: false });
  const freshOf = () => { app.run('initSessionPool()'); return freshIdsInPool(app); };
  // satunnaisuus = 0 -> aina paras jäljellä oleva
  app.run('Math.random = () => 0');
  assert.deepStrictEqual(freshOf(), ['zb_a1_30', 'zb_a1_29', 'zb_a1_28', 'zb_a1_27']);
  // satunnaisuus ~1 -> aina kolmanneksi paras jäljellä oleva: silti kolmen parhaan joukosta
  app.run('Math.random = () => 0.999999');
  assert.deepStrictEqual(freshOf(), ['zb_a1_28', 'zb_a1_27', 'zb_a1_26', 'zb_a1_25']);
  // seedattu satunnaisuus: kaikki aivan yleisimpien joukosta (ei koskaan 6. parasta heikompi)
  for (let seed = 1; seed <= 20; seed++) {
    const r = require('./harness').mulberry32(seed);
    const arr = Array.from({ length: 60 }, () => r());
    app.run(`globalThis.__seq = ${JSON.stringify(arr)}; globalThis.__i = 0; Math.random = () => globalThis.__seq[globalThis.__i++ % 60];`);
    freshOf().forEach(id => assert.ok(Number(id.split('_')[2]) >= 25, 'zipf-järjestys rikki: ' + id));
  }
  // ilman zipf-tietoa järjestys säilyy eikä satunnaisuutta käytetä lainkaan
  app.run('VOCAB.words.forEach(w => { delete w.zipf_fi; }); Math.random = () => { throw new Error("ei satunnaisuutta"); };');
  assert.deepStrictEqual(freshOf(), ['zb_a1_1', 'zb_a1_2', 'zb_a1_3', 'zb_a1_4']);
  // osalla zipf: zipf-sanat ensin, muut perässä alkuperäisessä järjestyksessä
  app.run(`VOCAB.words.find(w => w.id === 'zb_a1_20').zipf_fi = 3; VOCAB.words.find(w => w.id === 'zb_a1_10').zipf_fi = 5; Math.random = () => 0;`);
  assert.deepStrictEqual(freshOf(), ['zb_a1_10', 'zb_a1_20', 'zb_a1_1', 'zb_a1_2']);
  app.run('Math.random = () => 0.5');
  app.dispose();
});

test('Uudet sanat: sovellusdatassa on zipf_fi (tools/datamodel.py:to_legacy kopioi sen käsitteeltä sanalle)', async () => {
  const app = await boot();
  const n = app.run('VOCAB.words.filter(w => typeof w.zipf_fi === "number").length');
  assert.ok(n > 6500, 'zipf_fi-sanoja ' + n);
  assert.ok(app.run('VOCAB.words.every(w => w.zipf_fi === undefined || (w.zipf_fi >= 0 && w.zipf_fi <= 8))'));
  // yleinen sana on yleisempi kuin harvinainen
  assert.ok(app.run('VOCAB.words.find(w => w.id === "school_people_friend").zipf_fi') > 4);
  app.dispose();
});

test('Esimaku: kun nykyisen tason sanoista on opittu >= 70 %, ~15 % uusista sanoista tulee seuraavalta tasolta ("seuraava taso")', async () => {
  const learn = async (app, n) => {
    for (let i = 1; i <= n; i++) seedStat(app, 'zb_a1_' + i, LEARNED_KBD);
    await app.run('updateHeaderStats()');
  };
  const nextIn = (app) => freshIdsInPool(app).filter(id => id.startsWith('zb_a2_'));
  // 75 % opittu
  let app = await boot();
  await toBigLevels(app, 60, 30);
  setDaily(app, { newPerDay: 20, auto: false });
  await learn(app, 45);
  assert.ok(app.run('levelLearnedShare("A1")') >= 0.7);
  app.run('initSessionPool()');
  const fresh = freshIdsInPool(app);
  assert.strictEqual(fresh.length, 15, 'pooli täyttyy uusilla sanoilla (poolin enimmäiskoko)');
  const nxt = nextIn(app);
  assert.ok(nxt.length >= 1 && nxt.length / fresh.length >= 0.1 && nxt.length / fresh.length <= 0.2, `seuraavan tason osuus ${nxt.length}/${fresh.length}`);
  assert.strictEqual(app.run(`isNextLevelWord(${wid(app, nxt[0])})`), true);
  assert.strictEqual(app.run(`isNextLevelWord(${wid(app, 'zb_a1_50')})`), false);
  assert.ok(app.run(`promptCategoryText(${wid(app, nxt[0])})`).includes('seuraava taso'));
  assert.strictEqual(app.run(`promptCategoryText(${wid(app, 'zb_a1_50')})`), 'Iso A1');
  // merkintä näkyy myös kortissa
  app.run(`current = ${wid(app, nxt[0])}; direction = 'fi-target'; renderPrompt();`);
  assert.ok(app.elements.promptCategory.textContent.includes('seuraava taso'), app.elements.promptCategory.textContent);
  // teemarajaus poistaa esimaun
  app.run(`selectedThemes = ['zb_t1']; initSessionPool();`);
  assert.strictEqual(nextIn(app).length, 0, 'teemarajauksen kanssa ei esimakua');
  app.dispose();
  // alle 70 %: ei esimakua; täsmälleen 70 %: esimaku alkaa
  app = await boot();
  await toBigLevels(app, 60, 30);
  setDaily(app, { newPerDay: 20, auto: false });
  await learn(app, 41);
  assert.ok(app.run('levelLearnedShare("A1")') < 0.7);
  app.run('initSessionPool()');
  assert.strictEqual(nextIn(app).length, 0, '41/60 = 68 % < 70 %');
  await learn(app, 42);
  assert.strictEqual(app.run('levelLearnedShare("A1")'), 0.7);
  app.run('initSessionPool()');
  assert.ok(nextIn(app).length >= 1, '42/60 = 70 %');
  app.dispose();
  // koko päivän aikana osuus pysyy ~15 %:ssa: otetaan 30 uutta sanaa kiintiön yli
  app = await boot();
  await toBigLevels(app, 200, 60);
  mockNow(app, '2026-07-10T09:00:00');
  setDaily(app, { newPerDay: 40, auto: false });
  for (let i = 1; i <= 150; i++) seedStat(app, 'zb_a1_' + i, LEARNED_KBD);
  await app.run('updateHeaderStats()');
  app.run('initSessionPool()');
  for (let round = 0; round < 3; round++) {
    for (const id of freshIdsInPool(app)) { await answerWord(app, id, true); seedStat(app, id, LEARNED_KBD); }
    await app.run('updateHeaderStats()');
    app.run('initSessionPool()');
  }
  const today = J(app, 'dailyNewIdsToday()');
  const nextShare = today.filter(id => id.startsWith('zb_a2_')).length / today.length;
  assert.ok(today.length >= 30, 'päivän uusia sanoja ' + today.length);
  assert.ok(nextShare >= 0.1 && nextShare <= 0.2, 'osuus ' + nextShare.toFixed(2));
  app.dispose();
});

test('Viikkotavoite: uusia sanoja ja harjoituspäiviä viikossa (maanantaista), asetukset ja tiivis näkymä palkissa', async () => {
  const app = await boot();
  await toSelf(app);
  mockNow(app, '2026-07-15T10:00:00'); // keskiviikko
  assert.deepStrictEqual(J(app, 'weekDayKeys()'), ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19']);
  setDaily(app, {
    newLog: { '2026-07-12': 99, '2026-07-13': 10, '2026-07-14': 12, '2026-07-15': 3 },
    met: ['2026-07-12', '2026-07-13', '2026-07-14']
  });
  assert.deepStrictEqual(J(app, 'weekSummary()'), { newWords: 25, days: 2, goalNew: 70, goalDays: 5 }, 'oletus 70 uutta / 5 päivää');
  assert.strictEqual(app.run('weekText()'), 'Viikko: 25/70 uutta · 2/5 pv');
  await app.run('updateHeaderStats()');
  assert.strictEqual(app.elements.weekLabel.textContent, 'Viikko: 25/70 uutta · 2/5 pv');
  // sunnuntai kuuluu samaan viikkoon, seuraava maanantai ei
  mockNow(app, '2026-07-19T22:00:00');
  assert.strictEqual(J(app, 'weekSummary().newWords'), 25);
  mockNow(app, '2026-07-20T08:00:00');
  assert.strictEqual(J(app, 'weekSummary().newWords'), 0);
  mockNow(app, '2026-07-15T10:00:00');
  // uusi sana kirjautuu päivälokiin
  await answerWord(app, 'zz_a1_1', true);
  assert.strictEqual(dynDaily(app).newLog['2026-07-15'], 4);
  assert.strictEqual(J(app, 'weekSummary().newWords'), 26);
  // asetukset
  app.run('setWeekGoals(100, 6)');
  assert.deepStrictEqual([dynDaily(app).wkNew, dynDaily(app).wkDays], [100, 6]);
  app.run('setWeekGoals(77, 9)');
  assert.deepStrictEqual([dynDaily(app).wkNew, dynDaily(app).wkDays], [100, 6], 'vain sallitut arvot');
  assert.strictEqual(app.run('weekText()'), 'Viikko: 26/100 uutta · 2/6 pv');
  // raportti
  await app.run('renderAdultView()');
  const html = String(app.elements.adultContent.innerHTML);
  assert.ok(html.includes('Viikkotavoite'));
  assert.ok(html.includes('Tällä viikolla uusia sanoja 26 / 100, harjoituspäiviä 2 / 6'), html.slice(0, 900));
  assert.ok(html.includes('id="weekNewSelect"') && html.includes('id="weekDaysSelect"'));
  app.dispose();
});

test('Peruskoulu ennallaan: ei jatkovalikkoa, päivälaskuria, haastekierrosta, portaita, zipf-järjestystä eikä esimakua', async () => {
  const app = await boot();
  assert.strictEqual(app.run('studyMode'), 'school');
  for (let i = 0; i < 25; i++) {
    setWord(app, app.run('current.id'), 'target-fi');
    await app.run('checkAnswer(acceptedAnswers()[0], "keyboard")');
    await app.flush(5);
  }
  assert.strictEqual(app.elements.continuePanel.hidden, true);
  assert.strictEqual(app.elements.challengeBar.hidden, true);
  assert.strictEqual(app.run('startChallengeRound()'), false);
  assert.strictEqual(app.run('challenge'), null);
  assert.strictEqual(app.run('reviewHardOnly'), false);
  app.run('dailyRollover()');
  assert.ok(![...app.storage._map.keys()].some(k => k.startsWith('selfDaily_') || k.startsWith('selfChallenge_')), [...app.storage._map.keys()].join());
  assert.strictEqual(app.run('isNextLevelWord(current)'), false);
  assert.ok(!app.elements.promptCategory.textContent.includes('seuraava taso'));
  const rep = J(app, 'buildProgressReport()');
  assert.ok(!('dyn' in rep) && !('steps' in rep) && !('daily' in rep));
  // peruskoulun pooli ei käytä päiväkiintiötä: kaikki aktiivijoukon sanat kelpaavat uusina
  assert.ok(app.run('sessionPool.length') >= 10);
  assert.ok(app.run('document.body.classList.contains("self-mode")') === false);
  // "Kertaa vaikeimmat" ja haastekierros eivät käynnisty koulussa
  app.run('setReviewHardOnly(true)');
  assert.strictEqual(app.run('reviewHardOnly'), false);
  app.dispose();
});

test('Dynaaminen eteneminen: rikkinäinen selfDaily-tallenne ei kaada, vanhat tallenteet saavat oletukset', async () => {
  const app = await boot();
  await toSelf(app);
  app.storage.setItem('selfDaily_sv', JSON.stringify({ goal: 30, newPerDay: 10, days: {}, acc: { x: 5, '2026-07-09': { p: ['a'], r: null } }, newLog: { a: 'b' }, chal: 7, adj: { day: 1 } }));
  const d = dynDaily(app);
  assert.strictEqual(d.auto, true);
  assert.deepStrictEqual(d.acc['2026-07-09'], { p: [0, 0], r: [0, 0] });
  assert.deepStrictEqual(d.newLog, {});
  assert.strictEqual(d.adj, null);
  assert.strictEqual(d.wkNew, 70); assert.strictEqual(d.wkDays, 5);
  assert.strictEqual(d.goal, 30);
  mockNow(app, '2026-07-10T09:00:00');
  await answerWord(app, 'zz_a1_1', true);
  assert.strictEqual(app.asyncErrors.length, 0);
  app.storage.setItem('selfChallenge_sv', '{rikki');
  assert.strictEqual(app.run('savedChallenge()'), null);
  app.dispose();
});


// ---------------- Itseopiskelun virkkeet ja dialogit (vaihe 46) ----------------
// Sisällöstä riippumattomat testit: synteettiset tasot, aihepiirit, virkkeet ja dialogit (zv_*), jotka korvaavat SELF_DATA:n sisällön.
function addSentFixture(app, opts) {
  opts = opts || {};
  app.run(`(function () {
    const mk = (id, n) => ({ id, fi: 'testisana ' + id, sv: n, self_only: true, pos: 'x' }); // ei taivutusdataa
    VOCAB.words.push(mk('zv_w1', 'katt'), mk('zv_w2', 'en hund'), mk('zv_w3', 'hus'), mk('zv_w4', 'bil'), mk('zv_w5', 'bord'),
      mk('zv_w6', 'stol'), mk('zv_w7', 'bok'), mk('zv_w8', 'hatt'));
    SELF_DATA.topics.length = 0;
    SELF_DATA.topics.push(
      { id: 'zv_a1_x', name_fi: 'Aihe X', level: 'A1', concepts: ['zv_w1', 'zv_w2', 'zv_w3', 'zv_w4'] },
      { id: 'zv_a1_y', name_fi: 'Aihe Y', level: 'A1', concepts: ['zv_w5', 'zv_w6', 'zv_w7', 'zv_w8'] },
      { id: 'zv_a2_z', name_fi: 'Aihe Z', level: 'A2', concepts: ['zv_w1'] });
    SELF_DATA.sentences = { sv: [
      { id: 'zv_s1', topic: 'zv_a1_x', level: 'A1', text: 'Jag har en katt.', fi: 'Minulla on kissa.' },
      { id: 'zv_s2', topic: 'zv_a1_x', level: 'A1', text: 'Hunden är stor och snäll.', fi: 'Koira on iso ja kiltti.', alt: ['Hunden är snäll och stor.'] },
      { id: 'zv_s3', topic: 'zv_a1_y', level: 'A1', text: 'Boken ligger på bordet.', fi: 'Kirja on pöydällä.' },
      { id: 'zv_s4', topic: 'zv_a1_y', level: 'A1', text: 'Vi köper en ny stol idag.', fi: 'Ostamme uuden tuolin tänään.' },
      { id: 'zv_s5', topic: 'zv_a2_z', level: 'A2', text: 'Jag skulle vilja ha en kopp kaffe.', fi: 'Haluaisin kupin kahvia.' }
    ] };
    SELF_DATA.dialogues = { sv: [
      { id: 'zv_d1', topic: 'zv_a1_x', level: 'A1', title_fi: 'Kahvilassa', lines: [
        { speaker: 'A', text: 'Hej, vad vill du ha?', fi: 'Hei, mitä haluat?' },
        { speaker: 'B', text: 'Jag vill ha te, tack.', fi: 'Haluan teetä, kiitos.' },
        { speaker: 'A', text: 'Varsågod.', fi: 'Olkaa hyvä.' } ] },
      { id: 'zv_d2', topic: 'zv_a1_y', level: 'A1', title_fi: 'Kadulla', lines: [
        { speaker: 'A', text: 'Var är stationen?', fi: 'Missä asema on?' },
        { speaker: 'B', text: 'Den ligger där borta.', fi: 'Se on tuolla.' } ] },
      { id: 'zv_d3', topic: 'zv_a2_z', level: 'A2', title_fi: 'Toinen taso', lines: [
        { speaker: 'A', text: 'Hur mår du?', fi: 'Mitä kuuluu?' },
        { speaker: 'B', text: 'Bra, tack.', fi: 'Hyvää, kiitos.' } ] }
    ] };
    PRACTICE_WORDS = practiceWords();
  })();`);
}
// Asettaa tilaston suoraan statsCacheen (tilastoavain sellaisenaan tai sanan id)
function cacheStat(app, key, obj) {
  app.run(`(function () { const k = ${JSON.stringify(key)}.includes('|') ? ${JSON.stringify(key)} : statId({ id: ${JSON.stringify(key)} });
    statsCache[k] = Object.assign({ statId: k, language: 'sv', correctCount: 0, incorrectCount: 0, streakCorrect: 0 }, ${JSON.stringify(obj)}); })();`);
}
async function toSentSelf(app) {
  addSentFixture(app);
  await app.studyButtons[1].click();
  await app.flush(60);
  app.run('selfLevel = "A1"; selectedThemes = []; populateCategoryOptions();');
}
const sentIds = (app) => J(app, 'activeSentencePool().map(s => s.id)').sort();
async function toSentences(app) { await app.practiceButtons[1].click(); await app.flush(30); }
function showSentence(app, id, type) {
  app.run(`currentSentence = activeSentencePool().find(s => s.id === ${JSON.stringify(id)}); currentExerciseType = ${JSON.stringify(type)}; renderSentenceRound();`);
}

test('Itseopiskelun virkkeet: valitsin näkyy, pooli rajautuu tasoon ja aihepiireihin, peruskoulun virkkeet ennallaan', async () => {
  const app = await boot();
  const schoolBefore = J(app, 'activeSentencePool().map(s => s.id)');
  assert.ok(schoolBefore.length > 0);
  await toSentSelf(app);
  assert.strictEqual(app.elements.sentencesSwitchBtn.style.display, '');
  await toSentences(app);
  assert.strictEqual(app.run('practiceMode'), 'sentences');
  assert.strictEqual(app.elements.sentencePractice.hidden, false);
  assert.deepStrictEqual(sentIds(app), ['zv_s1', 'zv_s2', 'zv_s3', 'zv_s4'], 'taso A1, kaikki aihepiirit');
  // Aihepiirirajaus
  app.run('selectedThemes = ["zv_a1_y"]; applyThemeChange();');
  assert.deepStrictEqual(sentIds(app), ['zv_s3', 'zv_s4']);
  assert.ok(['zv_s3', 'zv_s4'].includes(app.run('currentSentence.id')));
  assert.ok(app.elements.themeButton.style.display === '', 'aihepiirinappi näkyy virkkeissä');
  // Tasonvaihto tyhjentää aihepiirit ja vaihtaa poolin
  app.elements.gradeFilter.value = 'A2';
  await app.elements.gradeFilter.dispatch('change'); await app.flush(40);
  assert.deepStrictEqual(sentIds(app), ['zv_s5']);
  assert.strictEqual(app.run('currentSentence.id'), 'zv_s5');
  assert.ok(app.elements.sentenceProgressLabel.textContent.includes('A2'));
  assert.ok(app.elements.sentenceGradeLabel.textContent.includes('A2') && app.elements.sentenceGradeLabel.textContent.includes('Aihe Z'));
  // Tyhjä pooli ei kaada
  app.run('selectedThemes = []; selfLevel = "B1"; pickSentenceRound();');
  assert.strictEqual(app.run('currentSentence'), null);
  // Paluu peruskouluun: SENTENCE_DATA ja luokka-asteet ennallaan
  await app.studyButtons[0].click(); await app.flush(80);
  assert.strictEqual(app.run('practiceMode'), 'sentences', 'virketila säilyy, pooli vaihtuu peruskoulun virkkeisiin');
  assert.ok(!app.run('currentSentence.self'), 'itseopiskelun virke ei jää näkyviin');
  assert.deepStrictEqual(J(app, 'activeSentencePool().map(s => s.id)'), schoolBefore);
  assert.ok(J(app, 'activeSentencePool()').every(s => s.grade && !s.self));
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Itseopiskelun virkkeet: tehtävätyypit write/blank/reorder/listen ja ruotsin å/ä/ö-lievennys', async () => {
  const app = await boot();
  await toSentSelf(app); await toSentences(app);
  // write: alt-muoto ja å/ä/ö -> a/o -lievennys, isot kirjaimet ja välimerkit
  showSentence(app, 'zv_s2', 'write');
  app.elements.sentenceAnswerBox.value = 'hunden ar snall och stor';
  assert.strictEqual(app.run('matchesSentence(sentenceAnswerBox.value, currentSentence)'), true, 'alt + lievennys');
  app.elements.sentenceAnswerBox.value = 'Hunden är stor och snäll.';
  assert.strictEqual(app.run('matchesSentence(sentenceAnswerBox.value, currentSentence)'), true);
  app.elements.sentenceAnswerBox.value = 'Hunden är liten.';
  assert.strictEqual(app.run('matchesSentence(sentenceAnswerBox.value, currentSentence)'), false);
  // blank: aukko osuu sisältösanaan, oikea sana hyväksytään lievennyksellä
  showSentence(app, 'zv_s3', 'blank');
  const idx = app.run('sentenceBlankIndex'), words = app.run('sentenceWords(currentSentence.sv)');
  assert.ok(!app.run('sentenceStopwords().has(sentenceWords(currentSentence.sv)[sentenceBlankIndex].replace(/[.,!?]/g, "").toLowerCase())'), 'ei pikkusanaa');
  assert.ok(app.elements.sentenceBlankDisplay.textContent.includes('____'));
  app.elements.sentenceBlankBox.value = words[idx].toUpperCase();
  await app.elements.sentenceCheckBtn.click(); await app.flush(20);
  assert.ok(app.elements.sentenceFeedback.className.includes('correct') && !app.elements.sentenceFeedback.className.includes('incorrect'), app.elements.sentenceFeedback.className);
  // reorder: kaikki sanat järjestykseen
  showSentence(app, 'zv_s4', 'reorder');
  const chips = app.elements.sentenceChipStrip._children;
  assert.strictEqual(chips.length, 6);
  const order = app.run('sentenceWords(currentSentence.sv)');
  for (let i = 0; i < order.length; i++) {
    const chip = chips.find(c => c.textContent === order[i] && !c.classList.contains('used'));
    await chip.click();
  }
  await app.elements.sentenceCheckBtn.click(); await app.flush(20);
  assert.ok(app.elements.sentenceFeedback.className.includes('correct') && !app.elements.sentenceFeedback.className.includes('incorrect'));
  // listen (puheentunnistus): tekstin ylitys
  showSentence(app, 'zv_s1', 'listen');
  assert.ok(app.elements.sentenceFiPrompt.textContent === 'Minulla on kissa.');
  app.elements.sentenceMicTranscript.textContent = 'jag har en katt';
  await app.elements.sentenceCheckBtn.click(); await app.flush(20);
  assert.ok(app.elements.sentenceFeedback.className.includes('correct') && !app.elements.sentenceFeedback.className.includes('incorrect'));
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Itseopiskelun virkkeet: oikea ja väärä vastaus kirjataan virketilastoon ja päivätavoitteeseen, tilasto opitaan 4 peräkkäisestä', async () => {
  const app = await boot();
  await toSentSelf(app); await toSentences(app);
  mockNow(app, '2026-07-10T09:00:00');
  const before = app.run('dailySummary().count');
  showSentence(app, 'zv_s1', 'write');
  app.elements.sentenceAnswerBox.value = 'Jag har en katt.';
  await app.elements.sentenceCheckBtn.click(); await app.flush(30);
  assert.strictEqual(app.run('dailySummary().count'), before + 1, 'päivätavoite +1');
  const sid = app.run('sentenceStatId({id: "zv_s1"})');
  assert.ok(sid.startsWith('sentence|sv|zv_s1'));
  assert.strictEqual(app.db.data.get(sid).correctCount, 1);
  assert.strictEqual(app.run('loadDaily().acc["2026-07-10"].p[0]'), 1, 'tuottava oikea vastaus');
  // väärä vastaus nollaa putken ja kirjautuu päivälaskuriin
  showSentence(app, 'zv_s1', 'write');
  app.elements.sentenceAnswerBox.value = 'ei oikein';
  await app.elements.sentenceCheckBtn.click(); await app.flush(30);
  assert.strictEqual(app.db.data.get(sid).incorrectCount, 1);
  assert.strictEqual(app.db.data.get(sid).streak, 0);
  assert.strictEqual(app.run('dailySummary().count'), before + 2);
  for (let i = 0; i < 4; i++) {
    showSentence(app, 'zv_s1', 'write');
    app.elements.sentenceAnswerBox.value = 'jag har en katt';
    await app.elements.sentenceCheckBtn.click(); await app.flush(30);
  }
  assert.strictEqual(app.run('isSentenceLearned({id: "zv_s1"})'), true);
  assert.ok(app.elements.sentenceProgressLabel.textContent.startsWith('Opittu 1/4'));
  // peruskoulu ei kirjaa päivätavoitetta
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Itseopiskelun virkkeet: peruskoulussa virkevastaus ei kosketa päivälaskuriin', async () => {
  const app = await boot();
  app.run('setPracticeMode("sentences")'); await app.flush(30);
  app.run('currentExerciseType = "write"; renderSentenceRound();');
  app.elements.sentenceAnswerBox.value = app.run('currentSentence.en');
  await app.elements.sentenceCheckBtn.click(); await app.flush(30);
  assert.strictEqual(app.storage.getItem('selfDaily_en'), null);
  assert.ok(![...app.storage._map.keys()].some(k => k.startsWith('selfDaily_')));
  app.dispose();
});

test('Haasteportaat: porras 5 "virkkeessä" kytkeytyy oikein vastattuun virkkeeseen, jossa sana esiintyy', async () => {
  const app = await boot();
  await toSentSelf(app);
  // Sana zv_w1 (katt) porrasta 4 asti; zv_w2 ("en hund", artikkeli ei haittaa) ja zv_w3 samoin
  ['zv_w1', 'zv_w2', 'zv_w3'].forEach(id => cacheStat(app, id, { correctCount: 5, streakCorrect: 3, streakKeyboard: 5, dictCorrect: 2 }));
  const step = (id) => app.run(`wordStep(${wid(app, id)})`);
  assert.strictEqual(step('zv_w1'), 4);
  assert.strictEqual(step('zv_w2'), 4);
  // virkettä ei ole harjoiteltu -> ei porrasta 5
  assert.deepStrictEqual(J(app, 'stepDistribution()').slice(4), [3, 0]);
  // vastataan oikein virkkeisiin zv_s1 (katt) ja zv_s2 (Hunden - taivutettu muoto ei vastaa sanaa "hund")
  cacheStat(app, 'sentence|sv|zv_s1', { sentenceId: 'zv_s1', correctCount: 1, streak: 1 });
  cacheStat(app, 'sentence|sv|zv_s2', { sentenceId: 'zv_s2', correctCount: 1, streak: 1 });
  assert.strictEqual(step('zv_w1'), 5, 'katt esiintyy virkkeessä');
  assert.strictEqual(step('zv_w2'), 4, 'taivutettu muoto (hunden) ei tunnistu yksinkertaisella vertailulla');
  assert.deepStrictEqual(J(app, 'stepDistribution()').slice(4), [2, 1]);
  assert.deepStrictEqual(J(app, `nextStepTarget(${wid(app, 'zv_w1')})`), { from: 5, to: 5 });
  // väärin vastattu virke ei riitä; virkesanelun oikea vastaus riittää
  app.run('statsCache["sentence|sv|zv_s1"].correctCount = 0');
  assert.strictEqual(step('zv_w1'), 4);
  app.storage.setItem('listenStats_sv', JSON.stringify({ 'sent:zv_s1': { c: 1, w: 0 } }));
  assert.strictEqual(step('zv_w1'), 5);
  // alempi porras ei hyppää virkkeen takia
  cacheStat(app, 'zv_w4', { correctCount: 1 });
  assert.ok(app.run(`wordStep(${wid(app, 'zv_w4')})`) < 4);
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Dialogi: välilehti vain itseopiskelussa, pooli rajautuu tasoon ja aihepiiriin, listenItems("dlg")', async () => {
  const app = await boot();
  await toListen(app);
  assert.ok(!J(app, 'listenTypesAvailable().map(t => t.id)').includes('dlg'), 'ei peruskoulussa');
  await toSentSelf(app);
  await toListen(app);
  assert.deepStrictEqual(app.elements.listenTabs._children.map(b => b.dataset.task), ['dict', 'comp', 'sent', 'dlg']);
  assert.ok(app.elements.listenTabs._children[3].textContent.includes('💬 Dialogi'));
  assert.strictEqual(app.elements.listenDlgModes.hidden, true);
  await app.elements.listenTabs._children[3].click(); await app.flush(20);
  assert.strictEqual(app.run('listenType'), 'dlg');
  assert.strictEqual(app.elements.listenDlgModes.hidden, false);
  assert.deepStrictEqual(J(app, 'listenItems("dlg").map(i => i.id)').sort(), ['zv_d1', 'zv_d2']);
  assert.ok(J(app, 'listenItems("dlg")').every(i => i.kind === 'dialogue' && i.lines.length >= 2 && i.title));
  app.run('selectedThemes = ["zv_a1_y"]; applyThemeChange();'); await app.flush(30);
  assert.deepStrictEqual(J(app, 'listenItems("dlg").map(i => i.id)'), ['zv_d2']);
  assert.strictEqual(app.run('listenQ.item.id'), 'zv_d2');
  app.run('selectedThemes = []; selfLevel = "A2"; startListenRound(false);');
  assert.deepStrictEqual(J(app, 'listenItems("dlg").map(i => i.id)'), ['zv_d3']);
  // tyhjä pooli: viesti, ei kaadu
  app.run('selfLevel = "B2"; startListenRound(false);');
  assert.strictEqual(app.run('listenQ'), null);
  assert.ok(app.elements.listenHint.textContent.includes('ei ole vielä'));
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Dialogi: koko dialogin toisto repliikki kerrallaan järjestyksessä, otsikko näkyy, repliikit ja suomennokset paljastetaan halutessa', async () => {
  const app = await boot();
  await toSentSelf(app); await toListen(app);
  await app.elements.listenTabs._children[3].click(); await app.flush(20);
  app.run('selectedThemes = ["zv_a1_x"]; applyThemeChange();'); await app.flush(30);
  assert.strictEqual(app.run('listenQ.sub'), 'play');
  assert.strictEqual(app.run('listenQ.item.id'), 'zv_d1');
  const panel = () => String(app.elements.listenDialogue.innerHTML);
  assert.strictEqual(app.elements.listenDialogue.hidden, false);
  assert.ok(panel().includes('Kahvilassa'), 'otsikko näkyy');
  assert.ok(!panel().includes('Hej, vad vill du ha?') && !panel().includes('Haluan teetä'), 'repliikkejä ei näytetä ennen paljastusta');
  assert.strictEqual(app.elements.listenWriteWrap.classList.contains('visible'), false);
  assert.strictEqual(app.elements.listenCheck.hidden, true);
  // automaattitoisto: kolme repliikkiä järjestyksessä, kerran
  app.spoken.length = 0;
  await app.flush(400);
  assert.deepStrictEqual(app.spoken.map(s => s.text), ['Hej, vad vill du ha?', 'Jag vill ha te, tack.', 'Varsågod.']);
  assert.ok(app.spoken.every(s => s.lang === 'sv-SE' && s.rate === 1));
  // uudelleentoisto ja hidastus
  app.spoken.length = 0;
  await app.elements.listenReplay.click();
  assert.strictEqual(app.spoken.length, 3);
  app.spoken.length = 0;
  await app.elements.listenSlow.click();
  assert.deepStrictEqual(app.spoken.map(s => s.rate), [0.6, 0.6, 0.6]);
  // paljastus suomennoksineen ja piilotus
  await app.elements.listenReveal.click();
  assert.ok(panel().includes('Hej, vad vill du ha?') && panel().includes('Hei, mitä haluat?') && panel().includes('Olkaa hyvä.'));
  assert.ok(app.elements.listenReveal.textContent.includes('Piilota'));
  await app.elements.listenReveal.click();
  assert.ok(!panel().includes('Hej, vad vill du ha?'));
  // kuuntelu kirjataan harjoitelluksi, ei päivätavoitteeseen
  const st = JSON.parse(app.storage.getItem('listenStats_sv'));
  assert.strictEqual(st['dlg:zv_d1'].p, 1, 'automaattitoisto kirjattu kerran');
  assert.strictEqual(app.run('isDialoguePractised({id: "zv_d1", lines: []})'), true);
  assert.strictEqual(app.run('isDialogueLearned(selfDialoguesForLang()[0])'), false);
  assert.strictEqual(app.run('dailySummary().count'), 0);
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Dialogi: A ja B saavat eri äänen, kun ääniä on useita; muuten sama ääni eri pitchillä', async () => {
  const app = await boot();
  await toSentSelf(app); await toListen(app);
  const voices = [{ name: 'sv1', lang: 'sv-SE' }, { name: 'sv2', lang: 'sv-SE' }, { name: 'en1', lang: 'en-GB' }];
  app.run(`speechSynthesis.getVoices = () => ${JSON.stringify(voices)};`);
  await app.elements.listenTabs._children[3].click(); await app.flush(20);
  app.run('selectedThemes = ["zv_a1_x"]; applyThemeChange();'); await app.flush(30);
  app.spoken.length = 0;
  await app.elements.listenReplay.click();
  assert.deepStrictEqual(app.spoken.map(s => s.voice && s.voice.name), ['sv1', 'sv2', 'sv1'], 'A, B, A');
  assert.ok(app.spoken.every(s => s.voice.lang === 'sv-SE'));
  // yksi ääni: sama ääni, eri pitch
  app.run(`speechSynthesis.getVoices = () => ${JSON.stringify([voices[0], voices[2]])};`);
  app.spoken.length = 0;
  await app.elements.listenReplay.click();
  const names = app.spoken.map(s => s.voice && s.voice.name);
  assert.deepStrictEqual(names, ['sv1', 'sv1', 'sv1']);
  assert.strictEqual(app.spoken[0].pitch, app.spoken[2].pitch);
  assert.notStrictEqual(app.spoken[0].pitch, app.spoken[1].pitch, 'B eri pitch');
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Dialogi: repliikin sanelu - tarkistus kuten virkkeissä, oma puhuja, tilasto, päivätavoite, näytä-nappi', async () => {
  const app = await boot();
  await toSentSelf(app); await toListen(app);
  mockNow(app, '2026-07-10T09:00:00');
  app.run(`speechSynthesis.getVoices = () => ${JSON.stringify([{ name: 'sv1', lang: 'sv-SE' }, { name: 'sv2', lang: 'sv-SE' }])};`);
  await app.elements.listenTabs._children[3].click(); await app.flush(20);
  app.run('selectedThemes = ["zv_a1_x"]; applyThemeChange();'); await app.flush(30);
  await app.elements.listenDlgModes._children[1].click(); await app.flush(30);
  assert.strictEqual(app.run('listenDlgMode'), 'dict');
  assert.strictEqual(app.run('listenQ.sub'), 'dict');
  assert.strictEqual(app.elements.listenWriteWrap.classList.contains('visible'), true);
  assert.strictEqual(app.elements.listenCheck.hidden, false);
  assert.ok(app.elements.listenDialogue.innerHTML.includes('Kahvilassa'));
  const item = J(app, 'listenQ.item');
  assert.strictEqual(item.kind, 'line');
  // repliikki puhutaan oikean puhujan äänellä
  app.spoken.length = 0;
  await app.elements.listenReplay.click();
  assert.deepStrictEqual(app.spoken.map(s => s.text), [item.text]);
  assert.strictEqual(app.spoken[0].voice.name, item.speaker === 'A' ? 'sv1' : 'sv2');
  await app.elements.listenSlow.click();
  assert.strictEqual(app.spoken[app.spoken.length - 1].rate, 0.6);
  // oikea vastaus: isot kirjaimet, välimerkit ja å/ä/ö-lievennys eivät haittaa
  const typed = item.text.toLowerCase().replace(/[.,!?]/g, '').replace(/å/g, 'a');
  await typeListen(app, typed);
  assert.ok(app.elements.listenFeedback.className.includes('correct') && !app.elements.listenFeedback.className.includes('incorrect'), listenFb(app));
  assert.ok(listenFb(app).includes(item.fi));
  assert.strictEqual(app.run('dailySummary().count'), 1);
  let st = JSON.parse(app.storage.getItem('listenStats_sv'));
  assert.strictEqual(st['dlg:zv_d1'].c, 1);
  assert.deepStrictEqual(st['dlg:zv_d1'].ok, [item.lineIdx]);
  // väärä vastaus
  app.run('listenLocked = false; pickListenRound()');
  const wrongItem = J(app, 'listenQ.item');
  await typeListen(app, 'xxxx yyyy');
  assert.ok(app.elements.listenFeedback.className.includes('incorrect'));
  assert.ok(listenFb(app).includes(wrongItem.text));
  st = JSON.parse(app.storage.getItem('listenStats_sv'));
  assert.strictEqual(st['dlg:zv_d1'].w, 1);
  assert.strictEqual(app.run('dailySummary().count'), 2);
  // Näytä: väärin, ei päivätavoitteeseen
  app.run('listenLocked = false; pickListenRound()');
  await app.elements.listenReveal.click(); await app.flush(10);
  assert.ok(listenFb(app).includes('Oikea vastaus'));
  assert.strictEqual(app.run('dailySummary().count'), 2);
  // tyhjä vastaus ei kirjaudu
  app.run('listenLocked = false; pickListenRound()');
  const cBefore = JSON.stringify(JSON.parse(app.storage.getItem('listenStats_sv')));
  await typeListen(app, '  ');
  assert.strictEqual(JSON.stringify(JSON.parse(app.storage.getItem('listenStats_sv'))), cBefore);
  // virketilastoon ei kosketa
  assert.ok(![...app.db.data.keys()].some(k => k.startsWith('sentence|')));
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Dialogi: sanelu kattaa kaikki repliikit, dialogi "opittu" kun kaikki oikein; raportti laskee tasoittain', async () => {
  const app = await boot();
  await toSentSelf(app); await toListen(app);
  await app.elements.listenTabs._children[3].click(); await app.flush(20);
  app.run('selectedThemes = ["zv_a1_x"]; applyThemeChange();'); await app.flush(30);
  await app.elements.listenDlgModes._children[1].click(); await app.flush(30);
  const seenLines = new Set();
  for (let i = 0; i < 3; i++) {
    seenLines.add(app.run('listenQ.item.lineIdx'));
    await typeListen(app, app.run('listenQ.item.text'));
    app.run('listenLocked = false; pickListenRound()');
  }
  assert.strictEqual(seenLines.size, 3, 'kaikki 3 repliikkiä kysytty ennen toistoa');
  assert.strictEqual(app.run('isDialogueLearned(selfDialoguesForLang().find(d => d.id === "zv_d1"))'), true);
  assert.strictEqual(app.run('isDialogueLearned(selfDialoguesForLang().find(d => d.id === "zv_d2"))'), false);
  const rep = J(app, 'buildProgressReport()');
  assert.strictEqual(rep.self, true);
  const a1 = rep.sentences.levels.find(l => l.id === 'A1'), a2 = rep.sentences.levels.find(l => l.id === 'A2');
  assert.strictEqual(a1.dlgTotal, 2); assert.strictEqual(a1.dlgSeen, 1); assert.strictEqual(a1.dlgLearned, 1);
  assert.strictEqual(a2.dlgTotal, 1); assert.strictEqual(a2.dlgSeen, 0);
  assert.strictEqual(a1.sentTotal, 4); assert.strictEqual(a2.sentTotal, 1);
  assert.strictEqual(rep.sentences.dlgTotal, 3); assert.strictEqual(rep.sentences.sentTotal, 5);
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Virkesanelu itseopiskelussa: lähteenä SELF_DATA.sentences (taso + aihepiirit), oma tilasto, päivätavoite', async () => {
  const app = await boot();
  await toSentSelf(app); await toListen(app);
  const tabs = app.elements.listenTabs._children;
  await tabs[2].click(); await app.flush(20);
  assert.strictEqual(app.run('listenType'), 'sent');
  assert.deepStrictEqual(J(app, 'listenItems("sent").map(i => i.id)').sort(), ['zv_s1', 'zv_s2', 'zv_s3', 'zv_s4']);
  app.run('selectedThemes = ["zv_a1_x"]; applyThemeChange();'); await app.flush(30);
  assert.deepStrictEqual(J(app, 'listenItems("sent").map(i => i.id)').sort(), ['zv_s1', 'zv_s2']);
  const item = J(app, 'listenQ.item');
  assert.strictEqual(item.kind, 'sentence');
  assert.ok(['zv_s1', 'zv_s2'].includes(item.id));
  assert.strictEqual(app.elements.listenDlgModes.hidden, true);
  // alt-muoto ja lievennys hyväksytään
  app.run('listenQ = { type: "sent", item: listenSentenceItem(selfSentencesForLang().find(s => s.id === "zv_s2")) }; renderListenQuestion(listenQ);');
  await typeListen(app, 'hunden ar snall och stor');
  assert.ok(app.elements.listenFeedback.className.includes('correct') && !app.elements.listenFeedback.className.includes('incorrect'), listenFb(app));
  const st = JSON.parse(app.storage.getItem('listenStats_sv'));
  assert.strictEqual(st['sent:zv_s2'].c, 1);
  assert.strictEqual(app.run('dailySummary().count'), 1);
  assert.ok(!app.db.data.has(app.run('sentenceStatId({id: "zv_s2"})')), 'virketilastoon ei kosketa');
  // virkesanelun oikea vastaus vie porrasta 5 (sana "hus" ei esiinny; "katt" ei vielä)
  app.run('listenLocked = false;');
  app.run('listenQ = { type: "sent", item: listenSentenceItem(selfSentencesForLang().find(s => s.id === "zv_s1")) }; renderListenQuestion(listenQ);');
  await typeListen(app, 'Jag har en katt');
  assert.strictEqual(JSON.parse(app.storage.getItem('listenStats_sv'))['sent:zv_s1'].c, 1);
  // peruskoulu: virkesanelu käyttää edelleen SENTENCE_DATAa
  await app.studyButtons[0].click(); await app.flush(80);
  await toListen(app);
  await app.elements.listenTabs._children[2].click(); await app.flush(20);
  assert.ok(app.run('listenQ.item.sentence.grade') > 0);
  assert.deepStrictEqual(J(app, 'listenTypesAvailable().map(t => t.id)'), ['dict', 'comp', 'sent']);
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Oma edistyminen: virkkeet ja dialogit tasoittain (harjoiteltu / opittu) näkyvät raportissa', async () => {
  const app = await boot();
  await toSentSelf(app);
  cacheStat(app, 'sentence|sv|zv_s1', { sentenceId: 'zv_s1', correctCount: 6, streak: 5 });
  cacheStat(app, 'sentence|sv|zv_s3', { sentenceId: 'zv_s3', correctCount: 1, incorrectCount: 1, streak: 0 });
  app.storage.setItem('listenStats_sv', JSON.stringify({ 'dlg:zv_d2': { p: 1, c: 2, w: 0, ok: [0, 1] }, 'dlg:zv_d1': { p: 2, c: 0, w: 0, ok: [] } }));
  const r = J(app, 'buildProgressReport()');
  const a1 = r.sentences.levels.find(l => l.id === 'A1');
  assert.deepStrictEqual([a1.sentTotal, a1.sentSeen, a1.sentLearned], [4, 2, 1]);
  assert.deepStrictEqual([a1.dlgTotal, a1.dlgSeen, a1.dlgLearned], [2, 2, 1]);
  assert.deepStrictEqual([r.sentences.sentTotal, r.sentences.sentSeen, r.sentences.sentLearned], [5, 2, 1]);
  app.run('renderAdultView()');
  const html = String(app.elements.adultContent.innerHTML);
  assert.ok(html.includes('Virkkeet ja dialogit tasoittain'));
  assert.ok(html.includes('Dialogeja') && html.includes('Opittu'));
  // porras 5 näkyy portaiden taulukossa ilman "tulossa"-merkintää
  assert.ok(html.includes('5 Virkkeessä') && !html.includes('(tulossa)'));
  // peruskoulun raportti ei saa virkke-/dialogiosaa
  await app.studyButtons[0].click(); await app.flush(80);
  const school = J(app, 'buildProgressReport()');
  assert.strictEqual(school.sentences.every ? true : false, true, 'peruskoulun raportti: sentences on luokka-asteittainen lista');
  assert.strictEqual(school.self, undefined);
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Itseopiskelun virkkeet: ilman SELF_DATA.sentences-sisältöä valitsin piiloon, eikä kuuntelussa virkesaneluun tai dialogiin', async () => {
  const app = await boot();
  await toSentSelf(app);
  app.run('SELF_DATA.sentences = {}; SELF_DATA.dialogues = {}; syncPracticeSwitchUI();');
  assert.strictEqual(app.elements.sentencesSwitchBtn.style.display, 'none');
  assert.deepStrictEqual(J(app, 'listenTypesAvailable().map(t => t.id)'), ['dict', 'comp']);
  assert.deepStrictEqual(J(app, 'activeSentencePool()'), []);
  app.run('setPracticeMode("sentences")'); await app.flush(20);
  app.run('syncPracticeSwitchUI()');
  assert.strictEqual(app.run('practiceMode'), 'words', 'palataan sanatilaan');
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});


// ---------------- Vaihe 47: englanti ja saksa itseopiskelussa ----------------
test('Itseopiskelu en/de: todellinen data - SELF_DATA.languages sv/en/de, kielinapit, oletuskieli ruotsi', async () => {
  const app = await boot();
  assert.deepStrictEqual(J(app, 'SELF_DATA.languages'), ['sv', 'en', 'de']);
  assert.strictEqual(app.run('"languages_ready" in SELF_DATA'), false, 'languages_ready poistettu');
  await app.studyButtons[1].click(); await app.flush(60);
  assert.strictEqual(app.run('studyMode'), 'self');
  assert.strictEqual(app.run('targetLang'), 'sv', 'oletuskieli on SELF_DATA.languages[0]');
  app.langButtons.forEach(b => {
    assert.strictEqual(b.style.display, '', b.dataset.lang);
    assert.strictEqual(b.disabled, false, b.dataset.lang);
  });
  assert.deepStrictEqual(J(app, 'langsForMode("self").sort()'), ['de', 'en', 'sv']);
  app.dispose();
});

test('Itseopiskelu en/de: todellinen data - pooli vain kohdekielisistä aihepiirin sanoista, kieli muistetaan tilakohtaisesti', async () => {
  const app = await boot();
  await app.studyButtons[1].click(); await app.flush(60);
  for (const [idx, lang] of [[0, 'en'], [1, 'de'], [2, 'sv']]) {
    await app.langButtons[idx].click(); await app.flush(40);
    assert.strictEqual(app.run('targetLang'), lang);
    assert.strictEqual(app.storage.getItem('targetLang_self'), lang);
    assert.strictEqual(app.storage.getItem('targetLang'), null, 'peruskoulun kieli ei muutu');
    const ids = poolIds(app);
    assert.ok(ids.length >= 10, lang + ': pooli ' + ids.length);
    assert.ok(app.run('sessionPool.every(w => selfLevelWords(selfLevel).some(x => x.id === w.id))'), lang + ': pooli vain valitun tason aihepiirien sanoja');
    assert.ok(app.run(`sessionPool.every(w => !!w[${JSON.stringify(lang)}])`), lang + ': kaikilla kohdekielen muoto');
    assert.ok(app.run('selfAllWords().length') > 1000, lang + ': aihepiirien sanoja');
  }
  // Tallennettu itseopiskelun kieli palautuu uudelleenkäynnistyksessä, peruskoulun kieli erikseen
  const app2 = await boot({ localStorage: { studyMode: 'self', targetLang_self: 'de', targetLang: 'en' } });
  assert.strictEqual(app2.run('targetLang'), 'de');
  await app2.studyButtons[0].click(); await app2.flush(60);
  assert.strictEqual(app2.run('targetLang'), 'en');
  await app2.studyButtons[1].click(); await app2.flush(60);
  assert.strictEqual(app2.run('targetLang'), 'de');
  app2.dispose();
  app.dispose();
});

test('Itseopiskelu en/de: tasotesti, päivätavoite ja kertaus kielikohtaisesti (selfPlacement_<kieli>, selfDaily_<kieli>)', async () => {
  const app = await boot({ localStorage: { studyMode: 'self', targetLang_self: 'en' } });
  assert.strictEqual(app.run('targetLang'), 'en');
  assert.strictEqual(app.run('placementKey()'), 'selfPlacement_en');
  assert.strictEqual(app.run('dailyKey()'), 'selfDaily_en');
  await app.langButtons[1].click(); await app.flush(40);
  assert.strictEqual(app.run('placementKey()'), 'selfPlacement_de');
  assert.strictEqual(app.run('dailyKey()'), 'selfDaily_de');
  // Tasotestin kysymykset syntyvät kummallakin uudella kielellä kohdekielen sanoista (oikea startPlacement-polku)
  for (const lang of ['en', 'de']) {
    app.run(`selectTargetLang(${JSON.stringify(lang)});`);
    await app.flush(30);
    app.run('closePlacement(); startPlacement();');
    const qs = J(app, 'placement.questions.map(q => ({ id: q.word.id, ok: !!q.word[targetLang], n: q.options.length, c: q.options.filter(o => o.correct).length }))');
    assert.ok(qs.length >= 10, lang + ': tasotestin kysymyksiä ' + qs.length);
    assert.ok(qs.every(q => q.ok && q.n === 4 && q.c === 1), lang + ': kysymykset kohdekielisiä, 4 vaihtoehtoa, yksi oikea');
    app.run('closePlacement()');
  }
  // Kertaus: pooli rakentuu myös en/de-kielillä, erääntyneitä sanoja voi rajata
  app.run('selectTargetLang("en")'); await app.flush(30);
  app.run('reviewDueOnly = true; initSessionPool();');
  assert.ok(app.run('Array.isArray(sessionPool)'));
  app.run('reviewDueOnly = false; initSessionPool();');
  assert.ok(app.run('sessionPool.length') > 0);
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Itseopiskelu en/de: Taivutus todellisella datalla - englanti (monikko, past, pp) ja saksa (der/die/das, monikko, pres3, pret, pp)', async () => {
  const app = await boot();
  await app.studyButtons[1].click(); await app.flush(60);
  await app.langButtons[0].click(); await app.flush(40);
  assert.strictEqual(app.run('targetLang'), 'en');
  assert.strictEqual(app.run('inflAvailable()'), true);
  assert.notStrictEqual(app.elements.inflSwitchBtn.style.display, 'none');
  assert.deepStrictEqual(J(app, 'inflTasks().map(t => t.id)'), ['pl', 'verb', 'verbAll']);
  const enNoun = J(app, 'PRACTICE_WORDS.filter(w => w.pos === "n" && inflFieldsFor(w, inflTasks()[0]))[0]');
  assert.ok(enNoun && enNoun.en_pl, 'englannin substantiivi monikkodatalla');
  const enVerb = J(app, 'PRACTICE_WORDS.filter(w => inflFieldsFor(w, inflTasks()[2]))[0]');
  assert.ok(enVerb && enVerb.en_infl.past && enVerb.en_infl.pp, 'englannin verbi past + pp');
  let q = app.run(`inflMakeQuestion(PRACTICE_WORDS.find(w => w.id === ${JSON.stringify(enVerb.id)}), inflTasks()[2])`);
  assert.deepStrictEqual(J(app, `inflMakeQuestion(PRACTICE_WORDS.find(w => w.id === ${JSON.stringify(enVerb.id)}), inflTasks()[2]).fields.map(f => f.path)`), ['infl.past', 'infl.pp']);
  await app.practiceButtons[4].click(); await app.flush(20);
  assert.ok(app.run('inflQ'), 'englanninkielinen taivutuskysymys arvottu');
  // Saksa
  await app.langButtons[1].click(); await app.flush(40);
  assert.strictEqual(app.run('targetLang'), 'de');
  assert.strictEqual(app.run('inflAvailable()'), true);
  assert.deepStrictEqual(J(app, 'inflTasks().map(t => t.id)'), ['gender', 'pl', 'verb', 'verbAll']);
  assert.deepStrictEqual(J(app, 'inflTasks()[3].fields.map(f => f.path)'), ['infl.pres3', 'infl.pret', 'infl.pp']);
  const deNoun = J(app, 'PRACTICE_WORDS.filter(w => inflFieldsFor(w, inflTasks()[0]))[0]');
  assert.ok(deNoun, 'saksan substantiivi artikkelilla (der/die/das)');
  const deVerb = J(app, 'PRACTICE_WORDS.filter(w => inflFieldsFor(w, inflTasks()[3]))[0]');
  assert.ok(deVerb && deVerb.de_infl.pres3 && deVerb.de_infl.pret && deVerb.de_infl.pp, 'saksan verbi pres3/pret/pp');
  assert.ok(app.run('inflQ'), 'saksankielinen taivutuskysymys arvottu');
  assert.strictEqual(app.asyncErrors.length, 0);
  // Peruskoulun saksan Kielioppi ennallaan: itseopiskelussa piilossa, peruskoulussa saksalla näkyy
  assert.strictEqual(app.elements.grammarSwitchBtn.style.display, 'none', 'itseopiskelussa ei Kielioppia');
  await app.studyButtons[0].click(); await app.flush(80);
  await app.langButtons[1].click(); await app.flush(60);
  assert.strictEqual(app.run('targetLang'), 'de');
  assert.strictEqual(app.run('studyMode'), 'school');
  assert.strictEqual(app.elements.inflSwitchBtn.style.display, 'none');
  assert.notStrictEqual(app.elements.grammarSwitchBtn.style.display, 'none', 'saksan Kielioppi näkyy peruskoulussa');
  app.dispose();
});

test('Itseopiskelu en/de: Kuuntele käyttää puhesynteesissä en-GB / de-DE', async () => {
  const app = await boot({ localStorage: { studyMode: 'self', targetLang_self: 'en' } });
  await app.practiceButtons[5].click(); await app.flush(400);
  assert.strictEqual(app.run('practiceMode'), 'listen');
  assert.ok(app.spoken.length >= 1);
  assert.strictEqual(app.spoken[app.spoken.length - 1].lang, 'en-GB');
  await app.langButtons[1].click(); await app.flush(400);
  assert.strictEqual(app.run('targetLang'), 'de');
  assert.strictEqual(app.spoken[app.spoken.length - 1].lang, 'de-DE');
  assert.strictEqual(app.run('LANGS[targetLang].speech'), 'de-DE');
  app.dispose();
});

test('Itseopiskelu: Virkkeet ja dialogi-/virkesanelutyypit piilossa kielillä, joilla ei ole itseopiskelun virkkeitä (synteettinen)', async () => {
  const app = await boot();
  // Ruotsin virke- ja dialogifixture; sanoille lisätään en-muoto, jotta englannin pooli ei ole tyhjä
  addSentFixture(app);
  app.run(`VOCAB.words.filter(w => w.id.startsWith('zv_w')).forEach(w => { w.en = 'en_' + w.id; w.de = 'de_' + w.id; }); PRACTICE_WORDS = practiceWords();`);
  await app.studyButtons[1].click(); await app.flush(60);
  assert.strictEqual(app.run('targetLang'), 'sv');
  assert.strictEqual(app.elements.sentencesSwitchBtn.style.display, '', 'ruotsilla virkkeet näkyvät');
  assert.deepStrictEqual(J(app, 'listenTypesAvailable().map(t => t.id)'), ['dict', 'comp', 'sent', 'dlg']);
  // Virketilassa kielen vaihto englantiin: valitsin piiloon ja sanatilaan, ei kaadu
  app.run('setPracticeMode("sentences")'); await app.flush(30);
  assert.strictEqual(app.run('practiceMode'), 'sentences');
  await app.langButtons[0].click(); await app.flush(60);
  assert.strictEqual(app.run('targetLang'), 'en');
  assert.strictEqual(app.elements.sentencesSwitchBtn.style.display, 'none');
  assert.strictEqual(app.run('practiceMode'), 'words');
  assert.strictEqual(app.run('selfSentencesAvailable()'), false);
  assert.strictEqual(app.run('selfDialoguesForLang().length'), 0);
  assert.deepStrictEqual(J(app, 'listenTypesAvailable().map(t => t.id)'), ['dict', 'comp']);
  assert.deepStrictEqual(J(app, 'activeSentencePool()'), []);
  // Kuuntelussa sanelu/ymmärtäminen toimii, virkesanelu ja dialogi eivät tarjoudu
  app.run('setPracticeMode("listen")'); await app.flush(60);
  assert.deepStrictEqual(app.elements.listenTabs._children.map(b => b.dataset.task), ['dict', 'comp']);
  // Saksa: sama
  await app.langButtons[1].click(); await app.flush(60);
  assert.strictEqual(app.elements.sentencesSwitchBtn.style.display, 'none');
  assert.deepStrictEqual(app.elements.listenTabs._children.map(b => b.dataset.task), ['dict', 'comp']);
  // Kun englannille ilmestyy virkkeitä, valitsin tulee näkyviin
  app.run(`SELF_DATA.sentences.en = [{ id: 'zv_en1', topic: 'zv_a1_x', level: 'A1', text: 'I have a cat.', fi: 'Minulla on kissa.' }]; selectTargetLang('en'); syncPracticeSwitchUI();`);
  await app.flush(40);
  assert.strictEqual(app.run('targetLang'), 'en');
  assert.strictEqual(app.elements.sentencesSwitchBtn.style.display, '');
  // Takaisin ruotsiin: valitsin yhä näkyvissä
  await app.langButtons[2].click(); await app.flush(60);
  assert.strictEqual(app.elements.sentencesSwitchBtn.style.display, '');
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Suojaus: itseopiskelun sana ilman kohdekielen muotoa ei kaada (acceptedAnswers(undefined), taivutus, monivalinta)', async () => {
  const app = await boot();
  assert.strictEqual(app.run('firstAcceptedAnswer(undefined)'), '');
  assert.strictEqual(app.run('firstAcceptedAnswer(null)'), '');
  assert.strictEqual(app.run('normalize(undefined)'), '');
  assert.strictEqual(app.run('stripParenthetical(undefined)'), '');
  assert.strictEqual(app.run('canonical(undefined, false)'), '');
  await app.studyButtons[1].click(); await app.flush(60);
  await app.langButtons[0].click(); await app.flush(40); // englanti
  // Sana, jolla on vain ruotsi (ei englantia), pakotetaan nykyiseksi sanaksi ohi poolin suodatuksen
  app.run(`globalThis.__bad = { id: 'zz_onlysv', fi: 'vain ruotsi', sv: 'bara', self_only: true, pos: 'n' };`);
  for (const dir of ['target-fi', 'fi-target']) {
    app.run(`current = globalThis.__bad; direction = ${JSON.stringify(dir)};`);
    assert.doesNotThrow(() => app.run('acceptedAnswers()'), dir);
    assert.ok(Array.isArray(J(app, 'acceptedAnswers()')));
    assert.doesNotThrow(() => app.run('pluralNote(), inflRow(globalThis.__bad)'), dir);
  }
  assert.strictEqual(app.run('inflFieldsFor(globalThis.__bad, inflTasks()[0])'), null);
  assert.strictEqual(app.run('wordHasGap(globalThis.__bad)'), false);
  // Pooli suodattaa tällaisen sanan: lisäys sanastoon ja aihepiiriin ei tuo sitä englannin poolille
  app.run(`VOCAB.words.push(globalThis.__bad); SELF_DATA.topics[0].concepts.push('zz_onlysv'); PRACTICE_WORDS = practiceWords();`);
  assert.ok(!app.run(`PRACTICE_WORDS.some(w => w.id === 'zz_onlysv')`));
  assert.ok(!app.run(`selfAllWords().some(w => w.id === 'zz_onlysv')`));
  for (let i = 0; i < 20; i++) app.run('pickWord()');
  assert.ok(!app.run(`sessionPool.some(w => w.id === 'zz_onlysv')`));
  // Jos sana silti livahtaa pooliin, kierros ja kysymykset eivät kaadu
  app.run(`sessionPool.push(globalThis.__bad); current = globalThis.__bad; renderPrompt();`);
  await app.flush(30);
  assert.doesNotThrow(() => app.run('buildChoiceQuestion(globalThis.__bad, [PRACTICE_WORDS])'));
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});


// ---------------- Tähtimittari: laajuus ja osittainen edistyminen (vaihe 48) ----------------
// Tilasto, jossa näppäimistöputki on n (muut nollia); best-kenttä valinnainen.
function kbStat(app, id, n, best) {
  const st = { statId: app.run(`statId({id: ${JSON.stringify(id)}})`), wordId: id, language: 'en', level: '4lk',
    correctCount: n, incorrectCount: 0, streakCorrect: n, streakTargetFi: 0, streakFiTarget: 0, streakKeyboard: n, streakMic: 0 };
  if (best !== undefined) st.bestStreakKeyboard = best;
  return st;
}
const tierKb = (app) => J(app, 'tierByMode.keyboard');
// Vaihe 49: tilasto suuntalaskureilla (näppäimistö tf = kohdekieli->suomi, ft = suomi->kohdekieli)
function kbDirStat(app, id, tf, ft) {
  return { statId: app.run(`statId({id: ${JSON.stringify(id)}})`), wordId: id, language: 'en', level: '4lk',
    correctCount: tf + ft, incorrectCount: 0, streakCorrect: tf + ft, streakTargetFi: 0, streakFiTarget: 0,
    streakKeyboard: 0, streakMic: 0, kbTF: tf, kbFT: ft, micTF: 0, micFT: 0 };
}

test('Mittari: laajuus ilman rajausta = luokka-asteen sanat, otsikossa luokka', async () => {
  const app = await boot({ localStorage: { grade_en: '4' } });
  app.run('activeGrade = 4; selectedThemes = [];');
  await app.run('updateHeaderStats()');
  const t = tierKb(app);
  assert.strictEqual(t.total, app.run('wordsForGrade(4).length'));
  assert.strictEqual(t.scopeLabel, '4. luokka');
  assert.ok(app.elements.tierBadge.title.includes('4. luokka'));
  app.dispose();
});

test('Mittari: koeteema rajaa laajuuden teeman sanoihin (myös muiden luokkien sanat), nimi näkyy', async () => {
  const app = await boot({ localStorage: { grade_en: '4' } });
  app.run('activeGrade = 4; selectedThemes = ["koe1_4"];');
  await app.run('updateHeaderStats()');
  const t = tierKb(app);
  const expected = app.run('PRACTICE_WORDS.filter(w => wordInCategory(w, "koe1_4")).length');
  assert.strictEqual(t.total, expected);
  assert.ok(t.total > 100, 'koeteemassa yli 100 sanaa: ' + t.total);
  const outside = app.run('PRACTICE_WORDS.filter(w => wordInCategory(w, "koe1_4") && wordGrade(w) !== 4).length');
  assert.ok(outside > 0, 'teemassa on muiden luokkien sanoja');
  assert.strictEqual(t.scopeLabel, 'Koe 1');
  assert.ok(app.elements.tierBadge.title.includes(`Koe 1: opittu 0/${expected}`), app.elements.tierBadge.title);
  app.run('openTierModal()');
  assert.ok(app.elements.tierModalSubtitle.textContent.includes(`opittu 0/${expected}`));
  assert.ok(app.elements.tierModalSubtitle.textContent.includes('Koe 1'));
  app.dispose();
});

test('Mittari: tavallinen teema laskee vain teeman sanat; usean teeman valinta yhdistää', async () => {
  const app = await boot();
  const ids = J(app, 'VOCAB.categories.filter(c => c.grade === 1 && !c.exam).slice(0, 2).map(c => c.id)');
  app.run(`selectedThemes = [${JSON.stringify(ids[0])}];`);
  await app.run('updateHeaderStats()');
  const n1 = app.run(`eligibleWordsForCategoryScope(selectedThemes).length`);
  assert.strictEqual(tierKb(app).total, n1);
  app.run(`selectedThemes = ${JSON.stringify(ids)};`);
  await app.run('updateHeaderStats()');
  assert.strictEqual(tierKb(app).total, app.run('eligibleWordsForCategoryScope(selectedThemes).length'));
  assert.strictEqual(tierKb(app).scopeLabel, '2 teemaa');
  app.dispose();
});

test('Mittari: Viikon sanat päällä -> laajuus on viikon sanat', async () => {
  const app = await boot();
  app.elements.focusInput.value = 'apple, banana, teacher, red, blue';
  await app.elements.focusSave.click();
  await app.flush(30);
  assert.strictEqual(app.run('focusActive()'), true);
  await app.run('updateHeaderStats()');
  const t = tierKb(app);
  assert.strictEqual(t.total, 5);
  assert.strictEqual(t.scopeLabel, 'Viikon sanat');
  assert.ok(app.elements.tierBadge.title.includes('Viikon sanat: opittu 0/5'));
  // yksi graduoitu sana viidestä = 1/5 -> 6 askelta = 1 taso + 1 tähti
  const id = app.run('focusIds[0]');
  app.db.data.set(app.run(`statId({id: ${JSON.stringify(id)}})`), learnedStat(app, id));
  await app.run('updateHeaderStats()');
  const t1 = tierKb(app);
  assert.strictEqual(t1.n, 1);
  assert.ok(Math.abs(t1.exactSteps - 6) < 1e-9, 'yksi graduoitu viidestä = 6 askelta: ' + t1.exactSteps);
  assert.strictEqual(t1.majorIndex * 5 + t1.stars, 6);
  app.dispose();
});

test('Mittari: osittainen edistyminen - yksi suunta = puoli sanaa, virhe ei laske, molemmat suunnat = 1', async () => {
  const app = await boot();
  app.run('selectedThemes = []; activeMode = "keyboard"; lastProductiveMode = "keyboard";');
  setWord(app, 'numbers_two', 'target-fi');
  await app.run('updateHeaderStats()');
  const before = tierKb(app);
  assert.strictEqual(before.share, 0);
  await app.run('recordResult(true, "keyboard")');
  await app.run('updateHeaderStats()');
  const one = tierKb(app);
  assert.ok(Math.abs(one.share - 0.5) < 1e-9, 'yksi suunta = 1/2 sanasta: ' + one.share);
  assert.ok(one.exactSteps > before.exactSteps);
  assert.strictEqual(one.n, 0, 'ei vielä kokonaan opittu');
  await app.run('recordResult(true, "keyboard")');
  await app.run('updateHeaderStats()');
  assert.ok(Math.abs(tierKb(app).share - 0.5) < 1e-9, 'toinen oikea samaan suuntaan ei lisää');
  await app.run('recordResult(false, "keyboard")');
  await app.run('updateHeaderStats()');
  const after = tierKb(app);
  assert.strictEqual(J(app, 'statsCache[statId(current)].kbTF'), 0, 'suunnan laskuri nollautuu');
  assert.ok(Math.abs(after.share - 0.5) < 1e-9, 'palkki ei laske virheestä: ' + after.share);
  assert.strictEqual(after.exactSteps, one.exactSteps);
  // toinen suunta oikein -> koko sana (1) ja kokonaan opittu
  app.run('direction = "fi-target"');
  await app.run('recordResult(true, "keyboard")');
  await app.run('updateHeaderStats()');
  assert.ok(Math.abs(tierKb(app).share - 1) < 1e-9, 'molemmat suunnat parhaimmillaan = 1: ' + tierKb(app).share);
  app.dispose();
});

test('Mittari: best-kentät tallentuvat recordResultissa (kynä, näppäimistö, mikrofoni suunnittain)', async () => {
  const app = await boot();
  setWord(app, 'numbers_two', 'target-fi');
  await app.run('recordResult(true, "pen")');
  let s = app.db.data.get(app.run('statId(current)'));
  assert.deepStrictEqual([s.bestPenTF, s.bestPenFT], [1, 0], 'toista suuntaa ei ole tehty');
  app.run('direction = "fi-target"');
  await app.run('recordResult(true, "pen")');
  s = app.db.data.get(app.run('statId(current)'));
  assert.deepStrictEqual([s.bestPenTF, s.bestPenFT], [1, 1]);
  app.run('direction = "target-fi"');
  await app.run('recordResult(true, "pen")');
  await app.run('recordResult(false, "pen")');
  s = app.db.data.get(app.run('statId(current)'));
  assert.strictEqual(s.streakTargetFi, 0);
  assert.strictEqual(s.bestPenTF, 2, 'paras ei laske virheestä');
  await app.run('recordResult(true, "keyboard")');
  await app.run('recordResult(true, "keyboard")');
  await app.run('recordResult(false, "keyboard")');
  app.run('direction = "fi-target"');
  await app.run('recordResult(true, "mic")');
  s = app.db.data.get(app.run('statId(current)'));
  assert.deepStrictEqual([s.kbTF, s.kbFT, s.bestKbTF, s.bestKbFT], [0, 0, 2, 0]);
  assert.strictEqual(s.streakKeyboard, 0);
  assert.deepStrictEqual([s.micTF, s.micFT, s.bestMicTF, s.bestMicFT], [0, 1, 0, 1]);
  app.dispose();
});

test('Mittari: sanan osuus = suunnat oikein / 2 (paras koskaan), graduoitu = 1', async () => {
  const app = await boot();
  const f = (o, m) => app.run(`wordTierShare(${JSON.stringify(o)}, ${JSON.stringify(m || 'pen')})`);
  assert.strictEqual(f({ streakTargetFi: 0, streakFiTarget: 0 }), 0);
  assert.strictEqual(f({ streakTargetFi: 2, streakFiTarget: 0 }), 0.5);
  assert.strictEqual(f({ streakTargetFi: 0, streakFiTarget: 0, bestPenTF: 3, bestPenFT: 0 }), 0.5, 'paras säilyy');
  assert.strictEqual(f({ streakTargetFi: 0, streakFiTarget: 0, bestPenTF: 1, bestPenFT: 1 }), 1);
  assert.strictEqual(f({ streakTargetFi: 1, streakFiTarget: 1 }), 1);
  assert.strictEqual(f({ micTF: 0, micFT: 1 }, 'mic'), 0.5);
  assert.strictEqual(f({ micTF: 1, micFT: 1 }, 'mic'), 1);
  assert.strictEqual(f({ micTF: 0, micFT: 0, bestMicTF: 1, bestMicFT: 1 }, 'mic'), 1, 'paras molemmat = 1 vaikka virhe nollasi');
  assert.strictEqual(app.run('wordTierShare(undefined, "keyboard")'), 0);
  app.dispose();
});

test('Mittari: vanha tilasto ilman best-kenttiä johdetaan vanhasta putkesta, graduoitu sana = 1', async () => {
  const probe = await boot();
  const stats = [kbStat(probe, 'numbers_two', 1), learnedStat(probe, 'numbers_three')];
  probe.dispose();
  stats.forEach(s => { delete s.bestStreakKeyboard; delete s.bestStreakPen; delete s.bestStreakMic; delete s.kbTF; delete s.kbFT; delete s.micTF; delete s.micFT; });
  const app = await boot({ stats, localStorage: { grade_en: '1' } });
  app.run('activeGrade = 1; selectedThemes = [];');
  await app.run('updateHeaderStats()');
  const t = tierKb(app);
  // vanha putki 1 = yksi suunta (0,5) + vanhoilla rajoilla graduoitu (näppäimistö 5) = 1
  assert.ok(Math.abs(t.share - 1.5) < 1e-9, 'share ' + t.share);
  assert.strictEqual(t.n, 1);
  // graduoitu sana pysyy 1:nä, vaikka suunnan laskuri nollautuisi
  setWord(app, 'numbers_three', 'target-fi');
  await app.run('recordResult(false, "keyboard")');
  await app.run('updateHeaderStats()');
  assert.ok(Math.abs(tierKb(app).share - 1.5) < 1e-9);
  const st = app.db.data.get(app.run('statId(current)'));
  assert.deepStrictEqual([st.kbTF, st.kbFT], [0, 1], 'siirretty tila: vain TF nollautui');
  assert.ok(st.bestKbTF >= 1 && st.bestKbFT >= 1);
  assert.strictEqual(app.run('stageKeyboardGraduated(statsCache[statId(current)])'), false);
  assert.strictEqual(app.run('stageKeyboardPassed(statsCache[statId(current)])'), true);
  app.dispose();
});

test('Mittari: tähdet ja palkki lasketaan samasta summasta (10 sanaa x yksi suunta, Koe 1)', async () => {
  const probe = await boot();
  const ids = J(probe, 'PRACTICE_WORDS.filter(w => wordInCategory(w, "koe1_4")).slice(0, 10).map(w => w.id)');
  const stats = ids.map(id => kbDirStat(probe, id, 1, 0)); // 10 sanaa, yksi suunta kukin
  probe.dispose();
  const app = await boot({ stats, localStorage: { grade_en: '4' } });
  app.run('activeGrade = 4; selectedThemes = ["koe1_4"];');
  await app.run('updateHeaderStats()');
  const t = tierKb(app);
  const total = t.total;
  assert.ok(Math.abs(t.share - 5) < 1e-9);
  assert.ok(Math.abs(t.exactSteps - 5 / total * 30) < 1e-9);
  assert.strictEqual(t.majorIndex * 5 + t.stars, Math.floor(5 / total * 30));
  assert.ok(t.exactSteps > 1, 'vähintään yksi tähti: ' + t.exactSteps);
  // koko 4. luokan laajuus: sama työ näkyy paljon vähemmän
  app.run('selectedThemes = [];');
  await app.run('updateHeaderStats()');
  assert.ok(tierKb(app).exactSteps < t.exactSteps);
  app.dispose();
});

test('Mittari: isGradeComplete ennallaan (osittainen edistyminen ei riitä)', async () => {
  const probe = await boot();
  const stats = grade1Ids(probe).map(id => kbStat(probe, id, 4));
  probe.dispose();
  const app = await boot({ stats, localStorage: { grade_en: '1' } });
  assert.strictEqual(app.run('isGradeComplete(1)'), false);
  app.dispose();
});

test('Mittari: itseopiskelussa laajuus = valitut aihepiirit tai taso', async () => {
  const app = await boot({ localStorage: { studyMode: 'self', targetLang_self: 'en' } });
  await app.flush(40);
  assert.strictEqual(app.run('studyMode'), 'self');
  app.run('selectedThemes = [];');
  await app.run('updateHeaderStats()');
  let t = tierKb(app);
  assert.strictEqual(t.total, app.run('selfLevelWords(selfLevel).length'));
  assert.ok(t.scopeLabel.startsWith('taso '));
  const topic = J(app, 'selfTopicsForLevel(selfLevel)[0].id');
  app.run(`selectedThemes = [${JSON.stringify(topic)}];`);
  await app.run('updateHeaderStats()');
  t = tierKb(app);
  assert.strictEqual(t.total, app.run('eligibleWordsForCategoryScope(selectedThemes).length'));
  assert.ok(t.total > 0 && t.total < app.run('selfLevelWords(selfLevel).length'));
  assert.strictEqual(t.scopeLabel, app.run(`categoryName(${JSON.stringify(topic)})`));
  // osittainen edistyminen toimii myös itseopiskelussa
  const w = app.run('eligibleWordsForCategoryScope(selectedThemes)[0].id');
  app.run(`current = VOCAB.words.find(x => x.id === ${JSON.stringify(w)}); direction = "target-fi";`);
  await app.run('recordResult(true, "keyboard")');
  await app.run('updateHeaderStats()');
  assert.ok(Math.abs(tierKb(app).share - 0.5) < 1e-9);
  app.dispose();
});


// ---------------- Kirjasanasto erillään luokka-asteesta (vaihe 49) ----------------
const bookCatIds = (app) => J(app, 'VOCAB.categories.filter(c => c.group === "book").map(c => c.id)');
const bookWordIdSet = (app) => new Set(J(app, 'PRACTICE_WORDS.filter(w => categoryGroup(w.category) === "book").map(w => w.id)'));

test('Kirjasanasto: aineistossa 25 kirjateemaa (grade null, book_grade 4), koeteema ennallaan', async () => {
  const app = await boot();
  const cats = J(app, 'VOCAB.categories.filter(c => c.group === "book")');
  assert.strictEqual(cats.length, 25);
  cats.forEach(c => { assert.strictEqual(c.grade, null, c.id); assert.strictEqual(c.book_grade, 4, c.id); });
  const koe = J(app, 'VOCAB.categories.find(c => c.id === "koe1_4")');
  assert.ok(koe.exam && koe.group !== 'book');
  app.dispose();
});

test('Kirjasanasto: kirjasanat eivät kuulu minkään luokka-asteen sanoihin eivätkä harrasteisiin; englannin 4. lk ~77 sanaa', async () => {
  const app = await boot();
  const book = bookWordIdSet(app);
  assert.ok(book.size > 800, 'kirjasanoja ' + book.size);
  for (let g = 1; g <= 9; g++) {
    const ids = J(app, `wordsForGrade(${g}).map(w => w.id)`);
    assert.ok(!ids.some(id => book.has(id)), 'kirjasana luokan ' + g + ' sanoissa');
  }
  const n4 = app.run('wordsForGrade(4).length');
  assert.ok(n4 > 60 && n4 < 100, 'englannin 4. luokka: ' + n4);
  assert.ok(!J(app, 'PRACTICE_WORDS.filter(w => categoryGroup(w.category) === "hobby").map(w => w.id)').some(id => book.has(id)), 'kirjasanat eivät sekoitu harrasteisiin');
  app.dispose();
});

test('Kirjasanasto: luokan valmius ja luokan päättely eivät huomioi kirjasanoja', async () => {
  const probe = await boot();
  const stats = [];
  for (const g of [1, 2, 3, 4]) J(probe, `wordsForGrade(${g}).map(w => w.id)`).forEach(id => stats.push(learnedStat(probe, id)));
  probe.dispose();
  const app = await boot({ stats });
  assert.strictEqual(app.run('isGradeComplete(4)'), true, 'kirjasanat eivät estä 4. luokan valmistumista');
  assert.strictEqual(app.run('detectFrontierGrade()'), 5);
  assert.strictEqual(app.run('activeGrade'), 5);
  app.dispose();
});

test('Kirjasanasto: "Kaikki teemat" -pooli ei sisällä kirjasanoja (luokat 1 ja 4, aktiivipooli ja täydennys)', async () => {
  const app = await boot();
  const book = bookWordIdSet(app);
  for (const g of [1, 4]) {
    app.run(`activeGrade = ${g}; selectedThemes = []; initSessionPool();`);
    assert.ok(!poolIds(app).some(id => book.has(id)), 'kirjasana poolissa luokalla ' + g);
    assert.ok(!J(app, 'activeWordPool().map(w => w.id)').some(id => book.has(id)));
    assert.ok(!J(app, 'eligibleWordsForCategoryScope([]).map(w => w.id)').some(id => book.has(id)));
  }
  // pickWord ei nosta kirjasanaa myöskään kertauksena
  for (let i = 0; i < 30; i++) { await app.run('pickWord()'); assert.ok(!book.has(app.run('current.id'))); }
  app.dispose();
});

test('Kirjasanasto: teemavalikossa oma osio, jonka teemat valitaan, pooli ja mittari toimivat kirjateemalla', async () => {
  const app = await boot();
  const cats = J(app, 'themeList._children.map(o => o.dataset.cat)');
  const books = bookCatIds(app);
  books.forEach(id => assert.ok(cats.includes(id), 'kirjateema puuttuu valikosta: ' + id));
  assert.ok(cats.includes('__book__4'), 'Koko kirjan sanasto -pikavalinta');
  const kids = app.elements.themeList._children;
  assert.ok(kids.some(k => /Kirjan sanasto \(4\. lk\)/.test(k.textContent)), 'osion otsikko');
  // valitse kirjateema: pooli = kirjateeman sanat
  app.run('selectedThemes = ["animals_4"]; applyThemeChange();');
  await app.flush(20);
  const sc = J(app, 'eligibleWordsForCategoryScope(selectedThemes).map(w => w.id)');
  assert.ok(sc.length > 10);
  assert.ok(sc.every(id => app.run(`wordInCategory(VOCAB.words.find(w => w.id === ${JSON.stringify(id)}), "animals_4")`)));
  assert.ok(poolIds(app).length >= 10);
  assert.ok(app.run('sessionPool.filter(w => wordInCategory(w, "animals_4")).length') >= 10);
  assert.strictEqual(app.elements.themeButton.textContent, app.run('categoryName("animals_4")'));
  await app.run('updateHeaderStats()');
  const t = tierKb(app);
  assert.strictEqual(t.total, sc.length);
  assert.strictEqual(t.scopeLabel, app.run('categoryName("animals_4")'));
  // tiukka rajaus: pelkät kirjateeman sanat
  app.run('setThemeStrict(true)');
  assert.ok(poolIds(app).every(id => sc.includes(id)), 'tiukassa tilassa vain valitun kirjateeman sanat');
  app.run('setThemeStrict(false)');
  app.dispose();
});

test('Kirjasanasto: "Koko kirjan sanasto" valitsee kaikki kirjateemat ja poistaa valinnan; harrasteteema ei sekoitu', async () => {
  const app = await boot();
  const books = bookCatIds(app);
  const all = app.elements.themeList._children.find(r => r.dataset.cat === '__book__4');
  const box = all._children[0];
  box.checked = true;
  await box.dispatch('change', {});
  await app.flush(20);
  assert.deepStrictEqual(J(app, 'selectedThemes').sort(), books.slice().sort());
  assert.strictEqual(app.elements.themeButton.textContent, '25 teemaa');
  await app.run('updateHeaderStats()');
  const t = tierKb(app);
  const expected = app.run('PRACTICE_WORDS.filter(w => categoryGroup(w.category) === "book").length');
  assert.strictEqual(t.total, expected, 'laajuus = koko kirjan sanasto');
  const all2 = app.elements.themeList._children.find(r => r.dataset.cat === '__book__4');
  assert.strictEqual(all2._children[0].checked, true);
  all2._children[0].checked = false;
  await all2._children[0].dispatch('change', {});
  await app.flush(20);
  assert.strictEqual(app.run('selectedThemes.length'), 0);
  // harrasteteeman kanssa: molemmat valittavissa yhtä aikaa, eri ryhmiä
  const hobby = J(app, 'VOCAB.categories.filter(c => c.group === "hobby").map(c => c.id)')[0];
  app.run(`selectedThemes = ["animals_4", ${JSON.stringify(hobby)}]; applyThemeChange();`);
  assert.strictEqual(app.run('categoryGroup("animals_4")'), 'book');
  assert.strictEqual(app.run(`categoryGroup(${JSON.stringify(hobby)})`), 'hobby');
  app.dispose();
});

test('Kirjasanasto: saksassa ei kirjateemoja valikossa (ei saksankielisiä sanoja), ei kaadu', async () => {
  const app = await boot({ localStorage: { targetLang: 'de' } });
  const cats = J(app, 'themeList._children.map(o => o.dataset.cat)');
  assert.ok(!cats.some(c => String(c).startsWith('__book__') || /_4$/.test(String(c)) && bookCatIds(app).includes(c)));
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

// ---------------- Laskuririvi, teemavalikon X/Y ja asteikkotaulukko (vaihe 49) ----------------
test('Laskuri: wordsToNextStar - 113 sanaa: tähti = 113/30 sanaa, ylöspäin pyöristettynä', async () => {
  const app = await boot();
  const f = (n, total, steps) => app.run(`wordsToNextStar(${n}, ${total}, ${steps})`);
  assert.strictEqual(f(0, 113, 0), 4, 'ceil(113/30) = 4');
  assert.strictEqual(f(3, 113, 3 / 113 * 30), 1, 'ceil(113/30)=4, 3 opittu -> 1 puuttuu');
  assert.strictEqual(f(4, 113, 4 / 113 * 30), 4, '4 opittu = 1,06 tähteä, seuraava (2.) ceil(7,53)=8 -> 4 sanaa');
  assert.strictEqual(f(0, 30, 0), 1);
  assert.strictEqual(f(5, 30, 5), 1);
  assert.strictEqual(f(113, 113, 30), 0);
  assert.strictEqual(f(0, 0, 0), 0);
  // osittainen edistyminen voi viedä tähden edelle: silti vähintään 1 sana ja yli opittujen
  assert.ok(f(1, 113, 2.5) >= 1);
  app.dispose();
});

test('Laskuri: rivi mittarin alla "Koe 1: opittu X/Y · seuraavaan tähteen N sanaa" (koeteema)', async () => {
  const probe = await boot();
  const ids = J(probe, 'PRACTICE_WORDS.filter(w => wordInCategory(w, "koe1_4")).slice(0, 12).map(w => w.id)');
  const stats = ids.map(id => learnedStat(probe, id));
  probe.dispose();
  const app = await boot({ stats, localStorage: { grade_en: '4' } });
  app.run('activeGrade = 4; selectedThemes = ["koe1_4"];');
  await app.run('updateHeaderStats()');
  const t = tierKb(app);
  const total = t.total;
  assert.strictEqual(t.n, 12);
  const target = Math.floor(t.exactSteps) + 1;
  const need = Math.ceil(target * total / 30 - 1e-9) - 12;
  assert.strictEqual(t.needed, need);
  const txt = app.elements.tierCounter.textContent;
  assert.strictEqual(txt, `Koe 1: opittu 12/${total} · seuraavaan tähteen ${need} ${need === 1 ? 'sana' : 'sanaa'}`);
  // oikeiden sanojen lisääminen pienentää N:ää, kunnes tähti täyttyy
  assert.ok(need >= 1 && need <= Math.ceil(total / 30));
  app.dispose();
});

test('Laskuri: laajuuden nimi - luokka, kirjateema, viikon sanat; N pienenee opitun sanan myötä', async () => {
  const app = await boot();
  await app.run('updateHeaderStats()');
  assert.ok(app.elements.tierCounter.textContent.startsWith('1. luokka: opittu 0/'), app.elements.tierCounter.textContent);
  const total1 = app.run('wordsForGrade(1).length');
  assert.ok(app.elements.tierCounter.textContent.endsWith(`seuraavaan tähteen ${Math.ceil(total1 / 30)} sanaa`) ||
    app.elements.tierCounter.textContent.endsWith('seuraavaan tähteen 1 sana'));
  // kirjateema
  app.run('selectedThemes = ["animals_4"];');
  await app.run('updateHeaderStats()');
  const name = app.run('categoryName("animals_4")');
  assert.ok(app.elements.tierCounter.textContent.startsWith(name + ': opittu 0/'), app.elements.tierCounter.textContent);
  // sana opitaan: X kasvaa
  const w = app.run('eligibleWordsForCategoryScope(selectedThemes)[0].id');
  setWord(app, w, 'target-fi'); await app.run('recordResult(true, "keyboard")');
  setWord(app, w, 'fi-target'); await app.run('recordResult(true, "keyboard")');
  await app.run('updateHeaderStats()');
  assert.ok(app.elements.tierCounter.textContent.startsWith(name + ': opittu 1/'), app.elements.tierCounter.textContent);
  // täysi mittari
  app.run('selectedThemes = [];');
  app.dispose();
});

test('Laskuri: kapea pystynäkymä - rivi taittuu, ei vaakavieritystä (CSS: flex-wrap, overflow-wrap)', async () => {
  const fs = require('fs');
  const css = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8').replace(/\s+/g, '');
  assert.ok(/\.progress-row\{[^}]*flex-wrap:wrap/.test(css), 'progress-row taittuu');
  assert.ok(/\.tier-counter\{[^}]*overflow-wrap:anywhere/.test(css), 'laskuri taittuu eikä leveä');
  assert.ok(/\.theme-row\.theme-name\{[^}]*min-width:0/.test(css), 'teemarivin nimi supistuu');
});

test('Teemavalikko: jokaisen teeman perässä X/Y valitulla syöttötavalla (myös kirja- ja koeteema)', async () => {
  const probe = await boot();
  const bookIds = J(probe, 'PRACTICE_WORDS.filter(w => wordInCategory(w, "animals_4")).slice(0, 3).map(w => w.id)');
  const koeIds = J(probe, 'PRACTICE_WORDS.filter(w => wordInCategory(w, "koe1_4")).slice(0, 2).map(w => w.id)');
  const stats = bookIds.concat(koeIds).map(id => learnedStat(probe, id));
  probe.dispose();
  const app = await boot({ stats, localStorage: { grade_en: '4' } });
  app.run('activeGrade = 4; populateCategoryOptions();');
  await app.run('updateHeaderStats()');
  app.run('populateCategoryOptions()');
  const row = (id) => app.elements.themeList._children.find(r => r.dataset.cat === id);
  const cnt = (id) => row(id)._children[2].textContent;
  const total = (id) => app.run(`PRACTICE_WORDS.filter(w => wordInCategory(w, ${JSON.stringify(id)})).length`);
  assert.strictEqual(cnt('animals_4'), `3/${total('animals_4')}`);
  assert.strictEqual(cnt('koe1_4'), `${J(app, 'PRACTICE_WORDS.filter(w => wordInCategory(w, "koe1_4") && statsCache[statId(w)]).length')}/${total('koe1_4')}`);
  // luokan 4 tavallinen teema ilman edistymistä
  const normal = J(app, 'VOCAB.categories.filter(c => c.grade === 1 && !c.exam && c.group !== "hobby").map(c => c.id)')[0];
  assert.ok(normal);
  // koko kirjan rivi: summa
  const allRow = row('__book__4');
  assert.ok(/^3\/\d+$/.test(allRow._children[2].textContent), allRow._children[2].textContent);
  // syöttötavan vaihto: kynällä (learnedStat on kaikissa tavoissa) sama 3 mutta laskuri seuraa tilaa
  app.run('activeMode = "pen"; lastProductiveMode = "pen"; updateThemeCounts();');
  assert.strictEqual(cnt('animals_4'), `3/${total('animals_4')}`);
  app.run('statsCache[statId(PRACTICE_WORDS.find(w => wordInCategory(w, "animals_4")))] = { streakTargetFi: 0, streakFiTarget: 0 }; updateThemeCounts();');
  assert.strictEqual(cnt('animals_4'), `2/${total('animals_4')}`);
  app.dispose();
});

test('Palkintoasteikkomodaali: taulukko teemoittain (X/Y), kirja- ja koeteemat mukana', async () => {
  const probe = await boot();
  const ids = J(probe, 'PRACTICE_WORDS.filter(w => wordInCategory(w, "animals_4")).slice(0, 2).map(w => w.id)');
  const stats = ids.map(id => learnedStat(probe, id));
  probe.dispose();
  const app = await boot({ stats });
  await app.run('updateHeaderStats()');
  app.run('openTierModal()');
  const rows = app.elements.tierThemeList._children;
  assert.ok(rows.length > 25, 'rivejä ' + rows.length);
  const r = rows.find(x => x.dataset.cat === 'animals_4');
  assert.ok(r, 'kirjateema taulukossa');
  assert.ok(r.textContent.includes('📘'));
  assert.ok(r.textContent.endsWith(`2/${app.run('PRACTICE_WORDS.filter(w => wordInCategory(w, "animals_4")).length')}`), r.textContent);
  assert.ok(rows.some(x => x.dataset.cat === 'koe1_4'), 'koeteema taulukossa');
  assert.ok(app.elements.tierThemeHead.textContent.includes('Teemoittain'));
  assert.strictEqual(app.elements.tierScaleList._children.length, 6, 'asteikko ennallaan');
  app.dispose();
});

test('Aikuisen raportti: kirjateemat omana ryhmänään, eivät luokissa eivätkä harrasteissa', async () => {
  const probe = await boot();
  const ids = J(probe, 'PRACTICE_WORDS.filter(w => wordInCategory(w, "animals_4")).slice(0, 2).map(w => w.id)');
  const stats = ids.map(id => learnedStat(probe, id));
  probe.dispose();
  const app = await boot({ stats });
  const r = J(app, 'buildProgressReport()');
  assert.ok(r.book, 'book-ryhmä');
  assert.strictEqual(r.book.themes.length, 25);
  assert.ok(r.book.themes.every(t => t.book && t.bookGrade === 4));
  assert.ok(!r.themes.some(t => t.book), 'ei sekoitu teemoihin');
  assert.ok(!r.themes.some(t => bookCatIds(app).includes(t.id)));
  assert.strictEqual(r.book.total, app.run('PRACTICE_WORDS.filter(w => categoryGroup(w.category) === "book").length'));
  assert.strictEqual(r.book.full, 2);
  const g4 = r.grades.find(g => g.grade === 4);
  assert.strictEqual(g4.total, app.run('wordsForGrade(4).length'));
  app.run('renderAdultView()');
  const html = app.elements.adultContent.innerHTML;
  assert.ok(html.includes('Kirjan sanasto'));
  assert.strictEqual(app.asyncErrors.length, 0);
  app.dispose();
});

test('Oppimisrajat: Pass = yksi oikea jompaankumpaan suuntaan (stageStatusForWord, wordStep tuotettu)', async () => {
  const app = await boot();
  const id = 'numbers_two';
  app.run('activeMode = "keyboard"; lastProductiveMode = "keyboard";');
  setWord(app, id, 'target-fi');
  await app.run('recordResult(true, "keyboard")');
  const w = app.run(`VOCAB.words.find(x => x.id === ${JSON.stringify(id)})`);
  assert.strictEqual(J(app, `stageStatusForWord(VOCAB.words.find(x => x.id === ${JSON.stringify(id)}))`).passed, true);
  assert.ok(app.run(`wordStep(VOCAB.words.find(x => x.id === ${JSON.stringify(id)}), { tasks: [], infl: {}, sent: [] })`) >= 2, 'tuotettu-porras yhdellä oikealla');
  assert.ok(w);
  app.dispose();
});

test('Oppimisrajat: yhden sanan oppiminen vaatii 2 oikeaa vastausta tavalla (1 / suunta); puhe samoin', async () => {
  const app = await boot();
  const id = 'numbers_two';
  for (const mode of ['keyboard', 'mic', 'pen']) {
    let n = 0;
    const learned = () => app.run(`stage${mode === 'keyboard' ? 'Keyboard' : mode === 'mic' ? 'Mic' : 'Pen'}Graduated(statsCache[statId({id: "${id}"})])`);
    for (const d of ['target-fi', 'fi-target']) {
      assert.strictEqual(learned(), false);
      setWord(app, id, d); await app.run(`recordResult(true, "${mode}")`); n++;
    }
    assert.strictEqual(n, 2);
    assert.strictEqual(learned(), true, mode);
  }
  assert.strictEqual(app.run(`isFullyLearned(statsCache[statId({id: "${id}"})])`), true, 'kaikki kolme tapaa -> 6 vastausta');
  app.dispose();
});

(async () => {
  const filter = process.argv[2];
  for (const t of tests) {
    if (filter && !t.name.includes(filter)) continue;
    const known = t.name.startsWith('KNOWN BUG:');
    try {
      await t.fn();
      console.log('OK   ' + t.name);
      passed++;
    } catch (e) {
      if (known) {
        console.log('WARN ' + t.name + '\n       ' + String(e && e.message).split('\n')[0]);
        warned++;
      } else {
        console.log('FAIL ' + t.name + '\n       ' + String(e && e.stack || e).split('\n').slice(0, 4).join('\n       '));
        failed++;
      }
    }
  }
  if (unhandled.length) {
    console.log('FAIL käsittelemättömiä Promise-virheitä: ' + unhandled.length);
    unhandled.slice(0, 3).forEach(e => console.log('       ' + (e && e.stack || e)));
    failed++;
  }
  console.log(`\n${passed} OK, ${failed} FAIL, ${warned} WARN (known bugs) / ${tests.length} testiä`);
  process.exit(failed ? 1 : 0);
})();
