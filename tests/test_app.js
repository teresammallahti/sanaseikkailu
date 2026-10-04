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

test('Boot: luokka-asteen valinnassa 6 vaihtoehtoa', async () => {
  const app = await boot();
  assert.strictEqual(app.elements.gradeFilter._children.length, 6);
  assert.strictEqual(app.elements.gradeFilter._children[0].value, '1');
  app.dispose();
});

test('Boot: teemavalikko sisältää "all" + luokka-asteen teemat + harrasteteemat', async () => {
  const app = await boot();
  const expected = app.run('VOCAB.categories.filter(c => c.grade === 1 || c.group === "hobby").length') + 1;
  assert.strictEqual(app.elements.categoryFilter._children.length, expected);
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
test('Saksa: luokka-asteet ovat vain 4-6, englanti 1-6', async () => {
  const app = await boot();
  assert.strictEqual(JSON.stringify(app.run('gradesForLang()')), '[1,2,3,4,5,6]');
  app.run('selectTargetLang("de")');
  await app.flush();
  assert.strictEqual(JSON.stringify(app.run('gradesForLang()')), '[4,5,6]');
  assert.strictEqual(app.elements.gradeFilter._children.length, 3, 'valikossa 3 luokkaa');
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
  const cats = J(app, 'categoryFilter._children.map(o => o.value)');
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
  const total = [1, 2, 3, 4, 5, 6].reduce((a, g) => a + app.run(`wordsForGrade(${g}).length`), 0);
  const hobby = app.run('PRACTICE_WORDS.filter(w => categoryGroup(w.category) === "hobby").length');
  assert.strictEqual(total + hobby, app.run('PRACTICE_WORDS.length'));
  app.dispose();
});

test('Luokka-asteet: isGradeComplete epätosi tyhjillä tilastoilla', async () => {
  const app = await boot();
  for (let g = 1; g <= 6; g++) assert.strictEqual(app.run(`isGradeComplete(${g})`), false);
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
  assert.strictEqual(app.run('currentCategory'), 'all');
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
  app.run('activeGrade = 1; currentCategory = "all"; initSessionPool();');
  const n = app.run('sessionPool.length');
  assert.ok(n >= 10 && n <= 15, 'koko ' + n);
  assert.strictEqual(app.run('sessionPool.every(w => wordGrade(w) === 1)'), true);
  assert.strictEqual(app.run('new Set(sessionPool.map(w => w.id)).size'), n, 'ei duplikaatteja');
  app.dispose();
});

test('Pooli: pieni yksittäinen teema täydentyy >=10 saman luokan sanoilla', async () => {
  const app = await boot();
  const small = J(app, `VOCAB.categories.filter(c => c.grade === 1)
    .map(c => ({ id: c.id, n: PRACTICE_WORDS.filter(w => w.category === c.id).length }))
    .sort((a, b) => a.n - b.n)[0]`);
  assert.ok(small.n < 10, 'tarvitaan alle 10 sanan teema, pienin: ' + small.n);
  app.run(`activeGrade = 1; currentCategory = ${JSON.stringify(small.id)}; initSessionPool();`);
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
  app.run(`activeGrade = 1; currentCategory = "all"; activeMode = "keyboard";
    [...wordsForGrade(1), ...wordsForGrade(2)].forEach(w => statsCache[statId(w)] = { statId: statId(w), streakKeyboard: 5 });
    initSessionPool();`);
  const n = app.run('sessionPool.length');
  assert.ok(n >= 10, 'pooli vajaa: ' + n);
  assert.strictEqual(app.run('sessionPool.every(w => wordGrade(w) === 3)'), true, 'sanat luokalta 3');
  app.dispose();
});

test('Pooli: 6. luokalla täydennetään alempien luokkien kesken jääneillä sanoilla (vaihe 20)', async () => {
  const app = await boot();
  app.run(`activeGrade = 6; currentCategory = "all"; activeMode = "keyboard";
    wordsForGrade(6).forEach(w => statsCache[statId(w)] = { statId: statId(w), streakKeyboard: 5 });
    initSessionPool();`);
  const n = app.run('sessionPool.length');
  assert.ok(n >= 10, 'pooli vajaa: ' + n);
  assert.strictEqual(app.run('sessionPool.every(w => wordGrade(w) === 5)'), true, 'lähin alempi luokka ensin');
  app.dispose();
});

test('Pooli: täydennysjärjestys = ylemmät nousevasti, sitten alemmat laskevasti', async () => {
  const app = await boot();
  app.run('activeGrade = 3;');
  assert.strictEqual(JSON.stringify(app.run('fallbackGradeOrder()')), '[4,5,6,2,1]');
  app.dispose();
});

test('Pooli: graduoidut sanat (nykyinen tila) jätetään pois', async () => {
  const app = await boot();
  app.run('activeGrade = 1; currentCategory = "all"; activeMode = "keyboard"; initSessionPool();');
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
  app.run('activeGrade = 1; currentCategory = "all"; activeMode = "keyboard"; initSessionPool();');
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
  for (let g = 1; g <= 6; g++) {
    assert.ok(app.run(`SENTENCE_DATA.en.filter(s => s.grade === ${g}).length`) >= 10, 'luokka ' + g);
  }
  const all = J(app, 'SENTENCE_DATA.en');
  for (const s of all) {
    assert.ok(s.id && typeof s.id === 'string', 'id');
    assert.ok(Number.isInteger(s.grade) && s.grade >= 1 && s.grade <= 6, 'grade ' + s.id);
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
  assert.strictEqual(app.elements.categoryFilter.style.display, 'none');
  assert.ok(app.run('currentSentence') !== null);
  assert.ok(app.elements.sentenceFiPrompt.textContent.length > 0);
  app.run('setPracticeMode("words")');
  assert.strictEqual(wp.hidden, false);
  assert.strictEqual(sp.hidden, true);
  assert.notStrictEqual(app.elements.categoryFilter.style.display, 'none');
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

test('Virkkeet: saksalle ei vielä virkkeitä -> ei kaadu', async () => {
  const app = await boot();
  app.run('selectTargetLang("de"); setPracticeMode("sentences");');
  await app.flush();
  assert.strictEqual(app.run('currentSentence'), null);
  assert.ok(app.elements.sentenceProgressLabel.textContent.includes('Ei vielä'));
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

// ---------------- Ajo ----------------
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
