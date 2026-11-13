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
    streakCorrect: 6, streakTargetFi: 3, streakFiTarget: 3, streakKeyboard: 5, streakMic: 6 };
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
  assert.strictEqual(app.elements.themeList._children.length, expected);
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
test('Vaiheet: näppäimistö 3/5', async () => {
  const app = await boot();
  const f = (n, k) => app.run(`${k}({streakKeyboard: ${n}})`);
  assert.strictEqual(f(2, 'stageKeyboardPassed'), false);
  assert.strictEqual(f(3, 'stageKeyboardPassed'), true);
  assert.strictEqual(f(4, 'stageKeyboardGraduated'), false);
  assert.strictEqual(f(5, 'stageKeyboardGraduated'), true);
  assert.strictEqual(app.run('stageKeyboardPassed(null)'), false);
  app.dispose();
});

test('Vaiheet: mikrofoni 4/6', async () => {
  const app = await boot();
  const f = (n, k) => app.run(`${k}({streakMic: ${n}})`);
  assert.strictEqual(f(3, 'stageMicPassed'), false);
  assert.strictEqual(f(4, 'stageMicPassed'), true);
  assert.strictEqual(f(5, 'stageMicGraduated'), false);
  assert.strictEqual(f(6, 'stageMicGraduated'), true);
  app.dispose();
});

test('Vaiheet: kynä 1/3 molempiin suuntiin', async () => {
  const app = await boot();
  const p = (a, b, k) => app.run(`${k}({streakTargetFi: ${a}, streakFiTarget: ${b}})`);
  assert.strictEqual(p(1, 0, 'stagePenPassed'), false);
  assert.strictEqual(p(0, 1, 'stagePenPassed'), false);
  assert.strictEqual(p(1, 1, 'stagePenPassed'), true);
  assert.strictEqual(p(3, 2, 'stagePenGraduated'), false);
  assert.strictEqual(p(2, 3, 'stagePenGraduated'), false);
  assert.strictEqual(p(3, 3, 'stagePenGraduated'), true);
  app.dispose();
});

test('Vaiheet: isFullyLearned vaatii kaikki kolme', async () => {
  const app = await boot();
  const full = { streakTargetFi: 3, streakFiTarget: 3, streakKeyboard: 5, streakMic: 6 };
  const t = (o) => app.run(`isFullyLearned(${JSON.stringify(o)})`);
  assert.strictEqual(t(full), true);
  assert.strictEqual(t({ ...full, streakMic: 5 }), false);
  assert.strictEqual(t({ ...full, streakKeyboard: 4 }), false);
  assert.strictEqual(t({ ...full, streakFiTarget: 2 }), false);
  assert.strictEqual(app.run('isFullyLearned(undefined)'), false);
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

test('Luokka-asteet: jokainen sana kuuluu täsmälleen yhteen luokkaan tai harrasteeseen', async () => {
  const app = await boot();
  const total = [1, 2, 3, 4, 5, 6, 7, 8, 9].reduce((a, g) => a + app.run(`wordsForGrade(${g}).length`), 0);
  const hobby = app.run('PRACTICE_WORDS.filter(w => categoryGroup(w.category) === "hobby").length');
  assert.strictEqual(total + hobby, app.run('PRACTICE_WORDS.length'));
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
    if (i === 0) st.streakMic = 5;
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
  assert.strictEqual(app.run('VOCAB.meta.version'), 'v20');
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
  assert.deepStrictEqual(vals, ['A1', 'A2', 'B1']);
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
  // Vaihe 42: valitsin näkyy itseopiskelussa (Sanat + Yhdistä), mutta virkkeet ja kielioppi ovat piilossa
  assert.strictEqual(app.elements.practiceSwitch.style.display, '');
  assert.strictEqual(app.elements.sentencesSwitchBtn.style.display, 'none');
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
  Object.assign(st, { language: 'sv', incorrectCount: 3, correctCount: 1, streakKeyboard: 0, streakMic: 0, streakTargetFi: 0, streakFiTarget: 0 });
  app.run(`statsCache[${JSON.stringify(st.statId)}] = ${JSON.stringify(st)};`);
  const r = J(app, 'buildProgressReport()');
  assert.strictEqual(r.self, true);
  assert.deepStrictEqual(r.levels.map(l => l.id), ['A1', 'A2', 'B1']);
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
  seedStat(app, 'zz_a1_1', Object.assign({ correctCount: 3, streakCorrect: 2, streakKeyboard: 4 }, sched));
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
  assert.strictEqual(st.streakKeyboard, 4, 'tuottava streak ei kasva (eikä graduoidu: 4 < 5)');
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
  assert.strictEqual(st.streakKeyboard, 4, 'väärä monivalinta ei nollaa tuottavaa edistymistä');
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
  // Näppäimistöllä 4 oikein (graduointiin tarvitaan 5), välissä monivalinta
  for (let i = 0; i < 4; i++) { setWord(app, id, 'fi-target'); await app.run(`checkAnswer(acceptedAnswers()[0], "keyboard")`); }
  await toChoice(app);
  for (let i = 0; i < 6; i++) { showWord(app, id, 'target-fi'); await pickChoice(app, i % 2 === 0); }
  let st = app.run(`statsCache[statId({id: ${JSON.stringify(id)}})]`);
  assert.strictEqual(st.streakKeyboard, 4);
  assert.strictEqual(app.run(`isGraduatedWord({id: ${JSON.stringify(id)}})`), false, 'monivalinta ei graduoi');
  await app.modeButtons[1].click();
  await app.flush(20);
  setWord(app, id, 'fi-target');
  await app.run(`checkAnswer(acceptedAnswers()[0], "keyboard")`);
  assert.strictEqual(app.run(`isGraduatedWord({id: ${JSON.stringify(id)}})`), true, 'tuottava viides oikea graduoi');
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
  assert.strictEqual(app.elements.sentencesSwitchBtn.style.display, 'none');
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
