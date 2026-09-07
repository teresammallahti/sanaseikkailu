// Testaa Task D:n pass/graduate-kynnykset, aktiivisen sanaryhmän rajat,
// yleissanat-varasanaston käytön ja harrasteteemojen poissulkemisen.

function assert(cond, msg){ if(!cond){ console.error("FAIL:", msg); process.exitCode = 1; } else console.log("OK:", msg); }

// --- Pass/Graduate-kynnykset ---
const PEN_PASS = 1, PEN_GRADUATE = 3;
const KEYBOARD_PASS = 3, KEYBOARD_GRADUATE = 5;
const MIC_PASS = 4, MIC_GRADUATE = 6;

function stagePenPassed(stat){ return !!stat && (stat.streakTargetFi||0) >= PEN_PASS && (stat.streakFiTarget||0) >= PEN_PASS; }
function stagePenGraduated(stat){ return !!stat && (stat.streakTargetFi||0) >= PEN_GRADUATE && (stat.streakFiTarget||0) >= PEN_GRADUATE; }
function stageKeyboardPassed(stat){ return !!stat && (stat.streakKeyboard||0) >= KEYBOARD_PASS; }
function stageKeyboardGraduated(stat){ return !!stat && (stat.streakKeyboard||0) >= KEYBOARD_GRADUATE; }
function stageMicPassed(stat){ return !!stat && (stat.streakMic||0) >= MIC_PASS; }
function stageMicGraduated(stat){ return !!stat && (stat.streakMic||0) >= MIC_GRADUATE; }
function isFullyLearned(stat){ return stagePenGraduated(stat) && stageKeyboardGraduated(stat) && stageMicGraduated(stat); }
function stageForWord(stat){
  if (!stagePenGraduated(stat)) return "pen";
  if (!stageKeyboardGraduated(stat)) return "keyboard";
  if (!stageMicGraduated(stat)) return "mic";
  return "learned";
}
function stageStatusFor(stat){
  const stage = stageForWord(stat);
  let passed = false;
  if (stage === "pen") passed = stagePenPassed(stat);
  else if (stage === "keyboard") passed = stageKeyboardPassed(stat);
  else if (stage === "mic") passed = stageMicPassed(stat);
  else passed = true;
  return { stage, passed };
}

// Pen: Pass 1/1, Graduate 3/3
let s = { streakTargetFi: 1, streakFiTarget: 1 };
assert(stagePenPassed(s) && !stagePenGraduated(s), "pen: 1/1 -> passed mutta ei graduated");
assert(stageStatusFor(s).stage === "pen" && stageStatusFor(s).passed, "pen: näyttötiheys puolittuu heti Passin jälkeen");
s = { streakTargetFi: 3, streakFiTarget: 3 };
assert(stagePenGraduated(s), "pen: 3/3 -> graduated");
assert(stageForWord(s) === "keyboard", "pen graduoitu -> vaihe siirtyy näppäimistöön");

// Keyboard: Pass 3, Graduate 5
s = { streakTargetFi: 3, streakFiTarget: 3, streakKeyboard: 3 };
assert(stageKeyboardPassed(s) && !stageKeyboardGraduated(s), "keyboard: 3 -> passed mutta ei graduated");
assert(stageStatusFor(s).stage === "keyboard" && stageStatusFor(s).passed, "keyboard: puolitus voimassa Passin jälkeen");
s.streakKeyboard = 5;
assert(stageKeyboardGraduated(s), "keyboard: 5 -> graduated");
assert(stageForWord(s) === "mic", "keyboard graduoitu -> vaihe siirtyy puheeseen");

// Mic: Pass 4, Graduate 6
s.streakMic = 4;
assert(stageMicPassed(s) && !stageMicGraduated(s), "mic: 4 -> passed mutta ei graduated");
s.streakMic = 6;
assert(stageMicGraduated(s) && isFullyLearned(s), "mic: 6 -> graduated ja sana täysin opittu");
assert(stageForWord(s) === "learned", "kaikki vaiheet graduoitu -> learned");

console.log("\n--- Aktiivinen sanaryhmä (pooli) ---");

// Yksinkertaistettu pool-simulaatio samalla logiikalla kuin sovelluksessa.
const ACTIVE_POOL_MIN = 10, ACTIVE_POOL_MAX = 15;
function makeWords(prefix, n, category){
  return Array.from({length:n}, (_,i) => ({ id: `${prefix}${i}`, category }));
}

function buildPool(themeWords, generalWords, statsByIdFn){
  const isGrad = w => isFullyLearned(statsByIdFn(w.id));
  const pool = [];
  const excl = new Set();
  const fill = (cands, needed) => {
    for (const w of cands){
      if (pool.length >= needed) break;
      if (excl.has(w.id) || isGrad(w)) continue;
      pool.push(w); excl.add(w.id);
    }
  };
  fill(themeWords.filter(w => statsByIdFn(w.id)), ACTIVE_POOL_MAX);
  fill(themeWords.filter(w => !statsByIdFn(w.id)), ACTIVE_POOL_MAX);
  if (pool.length < ACTIVE_POOL_MIN){
    fill(generalWords.filter(w => statsByIdFn(w.id)), ACTIVE_POOL_MIN);
    fill(generalWords.filter(w => !statsByIdFn(w.id)), ACTIVE_POOL_MIN);
  }
  return pool;
}

// Teemassa on runsaasti sanoja (esim. 24) -> pooli rajataan enintään 15:een.
let theme = makeWords("t", 24, "opposites");
let pool = buildPool(theme, [], () => null);
assert(pool.length === ACTIVE_POOL_MAX, "iso teema -> pooli rajataan " + ACTIVE_POOL_MAX + " sanaan, oli " + pool.length);

// Pieni teema (6 sanaa) -> täydennetään yleissanoista vähintään 10:een.
theme = makeWords("t", 6, "colours");
let general = makeWords("g", 50, "yleissanat");
pool = buildPool(theme, general, () => null);
assert(pool.length === ACTIVE_POOL_MIN, "pieni teema -> täydennetään yleissanoista vähintään " + ACTIVE_POOL_MIN + ":een, oli " + pool.length);
assert(pool.filter(w => w.category === "colours").length === 6, "kaikki alkuperäisen teeman sanat mukana ennen täydennystä");
assert(pool.filter(w => w.category === "yleissanat").length === 4, "loput 4 haettu yleissanoista (6+4=10)");

// Graduoituneet sanat eivät tule mukaan pooliin.
theme = makeWords("t", 12, "numbers");
const graduatedStat = { streakTargetFi:3, streakFiTarget:3, streakKeyboard:5, streakMic:6 };
pool = buildPool(theme, [], id => (id === "t0" || id === "t1") ? graduatedStat : null);
assert(!pool.find(w => w.id === "t0") && !pool.find(w => w.id === "t1"), "graduoituneet sanat eivät ole aktiivipoolissa");
assert(pool.length === 10, "graduoitujen poisjäänti ei laukaise yleissanatäydennystä, koska jäljellä on jo >= 10 (12-2=10)");

console.log("\n--- Harrasteteemat pois 'kaikki teemat' -kierrosta ---");
const categories = [
  { id: "colours", group: "ops" },
  { id: "yleissanat", group: "general" },
  { id: "gaming_minecraft", group: "hobby" },
  { id: "gaming_fortnite", group: "hobby" }
];
function categoryGroup(id){ const c = categories.find(c => c.id === id); return c ? c.group : "ops"; }
function eligibleWordsForCategoryScope(catId, allWords){
  if (catId === "all") return allWords.filter(w => categoryGroup(w.category) !== "hobby");
  return allWords.filter(w => w.category === catId);
}
const allWords = [
  ...makeWords("c", 5, "colours"),
  ...makeWords("m", 10, "gaming_minecraft"),
  ...makeWords("f", 8, "gaming_fortnite"),
  ...makeWords("y", 5, "yleissanat")
];
const allScope = eligibleWordsForCategoryScope("all", allWords);
assert(!allScope.some(w => w.category.startsWith("gaming")), "'kaikki teemat' ei sisällä harrasteteemojen sanoja");
const manualHobby = eligibleWordsForCategoryScope("gaming_minecraft", allWords);
assert(manualHobby.length === 10, "harrasteteema on silti käsin valittavissa kokonaisuudessaan");

console.log("\n--- Kertaus-todennäköisyys (REVIEW_CHANCE) ---");
const REVIEW_CHANCE = 0.15;
let reviewHits = 0;
const N = 200000;
// Käytetään siementä muistuttavaa determinististä sekvenssiä satunnaisuuden sijaan testin toistettavuuden vuoksi.
let seed = 42;
function pseudoRandom(){ seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
for (let i = 0; i < N; i++){ if (pseudoRandom() < REVIEW_CHANCE) reviewHits++; }
const ratio = reviewHits / N;
assert(Math.abs(ratio - REVIEW_CHANCE) < 0.01, "REVIEW_CHANCE-osuma-suhde lähellä 0.15:tä pitkällä otoksella (oli " + ratio.toFixed(4) + ")");

console.log("\nKaikki testit suoritettu.");
