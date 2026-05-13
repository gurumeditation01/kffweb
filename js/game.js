/* ═══════════════════════════════════════════════════════════════
   KFF — Reaction Game
   ═══════════════════════════════════════════════════════════════

   FIREBASE SETUP (einmalig, ~5 Minuten):
   ─────────────────────────────────────
   1. https://console.firebase.google.com → Neues Projekt anlegen
   2. Projekt → "Web-App hinzufügen" → firebaseConfig kopieren
   3. Firestore Database → "Datenbank erstellen" (Testmodus reicht zum Start)
   4. Die 6 Werte unten in FIREBASE_CONFIG einfügen
   5. Firestore → Rules → folgende Regeln einfügen und veröffentlichen:

      rules_version = '2';
      service cloud.firestore {
        match /databases/{database}/documents {
          match /scores/{doc} {
            allow read: if true;
            allow create: if request.resource.data.name is string
                          && request.resource.data.name.size() >= 1
                          && request.resource.data.name.size() <= 20
                          && request.resource.data.deviation is number
                          && request.resource.data.deviation >= 0
                          && request.resource.data.deviation <= 30000;
          }
        }
      }
   ═══════════════════════════════════════════════════════════════ */

// ─── Firebase Config — WERTE ERSETZEN ────────────────────────
const FIREBASE_CONFIG = {
    apiKey:            'AIzaSyAMeha9gHwdHt7qKoGNv6LAlN1GWbyewR0',
    authDomain:        'kffweb-2d35f.firebaseapp.com',
    projectId:         'kffweb-2d35f',
    storageBucket:     'kffweb-2d35f.firebasestorage.app',
    messagingSenderId: '300069520510',
    appId:             '1:300069520510:web:8c04d9a70292d81a5a842f'
};

// ─── Profanity-Filter ─────────────────────────────────────────
const BLOCKED = [
    'arsch','scheiß','scheiss','ficken','hurensohn','wichser','wichse',
    'fotze','hure','schlampe','spast','schwuchtel','idiot',
    'fuck','shit','bitch','asshole','cunt','nigger','nazi','hitler','siegheil',
    'dick','cock','pussy','whore','slut','faggot','retard','bastard','motherfuck',
    'trump','netanjahu','netanyahu','heil',
];
function isProfane(s) {
    const l = s.toLowerCase();
    return BLOCKED.some(w => l.includes(w));
}

// ─── Firebase Init ────────────────────────────────────────────
let db = null;
(function () {
    try {
        firebase.initializeApp(FIREBASE_CONFIG);
        db = firebase.firestore();
    } catch (e) {
        console.warn('[game] Firebase nicht konfiguriert:', e.message);
    }
})();

// ─── DOM-Referenzen ───────────────────────────────────────────
const el = {
    countdown:   document.getElementById('game-countdown'),
    result:      document.getElementById('game-result'),
    resultValue: document.getElementById('game-result-value'),
    resultDir:   document.getElementById('game-result-dir'),
    btns:        document.getElementById('game-btns'),
    btnL:        document.getElementById('game-btn-l'),
    btnR:        document.getElementById('game-btn-r'),
    startWrap:   document.getElementById('game-start-wrap'),
    start:       document.getElementById('game-start'),
    post:        document.getElementById('game-post'),
    nameWrap:    document.getElementById('game-name-wrap'),
    nameInput:   document.getElementById('game-name'),
    nameSubmit:  document.getElementById('game-name-submit'),
    scores:      document.getElementById('game-scores'),
};

// ─── Spielparameter ───────────────────────────────────────────
const COUNTDOWN_MS  = 3000; // Ziel: genau diese ms nach Start
const AUTO_FAIL_MS  = 3000; // Fenster nach 0 bis Auto-Timeout
const PERFECT_MS    = 50;   // Abweichung < 50ms gilt als "PERFEKT"

// ─── Spielzustand ─────────────────────────────────────────────
let state     = 'idle';
let zeroTime  = null;  // performance.now() wenn Countdown 0 erreicht
let rafHandle = null;
let failTimer = null;
let lastDev   = null;  // vorzeichenbehaftete Abweichung in ms

// ─── Spiel starten ────────────────────────────────────────────
function startGame() {
    state = 'countdown';
    lastDev = null;

    el.startWrap.hidden      = true;
    el.result.hidden         = true;
    el.post.hidden           = true;
    el.btns.hidden           = false;
    el.countdown.hidden      = false;
    el.countdown.className   = 'game-number';
    el.resultValue.textContent = '';
    el.resultDir.textContent   = '';

    el.btnL.disabled = false;
    el.btnR.disabled = false;

    const t0 = performance.now();
    zeroTime = t0 + COUNTDOWN_MS;

    (function frame(now) {
        const remaining = zeroTime - now;
        if (remaining <= 0) {
            el.countdown.textContent = '0';
            el.countdown.classList.add('game-number--zero');
            state = 'active';
            failTimer = setTimeout(function () {
                if (state === 'active') onClick();
            }, AUTO_FAIL_MS);
            return;
        }
        el.countdown.textContent = Math.ceil(remaining / 1000);
        rafHandle = requestAnimationFrame(frame);
    })(t0);
}

// ─── Klick verarbeiten ────────────────────────────────────────
function onClick() {
    if (state !== 'countdown' && state !== 'active') return;
    state = 'result';

    cancelAnimationFrame(rafHandle);
    clearTimeout(failTimer);

    const dev = performance.now() - zeroTime; // negativ = zu früh
    lastDev = dev;
    const absMs = Math.abs(dev);

    el.resultValue.textContent = (absMs / 1000).toFixed(3) + ' SEK';

    if (absMs < PERFECT_MS) {
        el.resultDir.textContent = 'PERFEKT';
        el.resultDir.className   = 'game-result-dir game-result-dir--perfect';
    } else if (dev < 0) {
        el.resultDir.textContent = 'ZU FRÜH';
        el.resultDir.className   = 'game-result-dir game-result-dir--early';
    } else {
        el.resultDir.textContent = 'ZU SPÄT';
        el.resultDir.className   = 'game-result-dir game-result-dir--late';
    }

    el.btns.hidden      = true;
    el.countdown.hidden = true;
    el.result.hidden    = false;

    el.post.hidden       = false;
    el.nameWrap.hidden   = false;
    el.startWrap.hidden  = false;

    el.nameInput.value       = '';
    el.nameInput.placeholder = 'Dein Name';
    el.nameInput.focus();
}

// ─── Score speichern ──────────────────────────────────────────
async function submitScore() {
    const name = el.nameInput.value.trim();
    if (!name) { el.nameInput.focus(); return; }
    if (isProfane(name)) {
        el.nameInput.value       = '';
        el.nameInput.placeholder = 'Name nicht erlaubt';
        return;
    }

    el.nameSubmit.disabled      = true;
    el.nameSubmit.textContent   = '…';

    if (db && lastDev !== null) {
        try {
            await db.collection('scores').add({
                name:      name,
                deviation: Math.round(Math.abs(lastDev)),
                signed:    Math.round(lastDev),
                ts:        firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (e) {
            console.error('[game] submit fehler:', e);
        }
    }

    el.nameWrap.hidden          = true;
    el.nameSubmit.disabled      = false;
    el.nameSubmit.textContent   = 'EINTRAGEN';
    await loadScores();
}

// ─── Highscore laden ──────────────────────────────────────────
async function loadScores() {
    if (!db) {
        el.scores.innerHTML = '<li class="game-score-empty">Firebase nicht verbunden</li>';
        return;
    }
    try {
        const snap = await db.collection('scores')
            .orderBy('deviation', 'asc')
            .limit(10)
            .get();

        el.scores.innerHTML = '';

        if (snap.empty) {
            el.scores.innerHTML = '<li class="game-score-empty">Noch keine Einträge</li>';
            return;
        }

        snap.forEach(function (doc) {
            const d  = doc.data();
            const ms = d.deviation;
            const dir = ms < PERFECT_MS ? '✓'
                      : d.signed < 0    ? '←'
                      : '→';
            const li = document.createElement('li');
            li.className = 'game-score-entry';
            li.innerHTML =
                '<span class="gs-name">' + esc(d.name) + '</span>' +
                '<span class="gs-val">'  + (ms / 1000).toFixed(3) + ' sek</span>' +
                '<span class="gs-dir">'  + dir + '</span>';
            el.scores.appendChild(li);
        });
    } catch (e) {
        console.error('[game] laden fehler:', e);
        el.scores.innerHTML = '<li class="game-score-empty">Fehler beim Laden</li>';
    }
}

function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Event Listeners ─────────────────────────────────────────
el.start.addEventListener('click', startGame);
el.btnL.addEventListener('click', onClick);
el.btnR.addEventListener('click', onClick);
el.nameSubmit.addEventListener('click', submitScore);
el.nameInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') submitScore();
});

// ─── Init ────────────────────────────────────────────────────
loadScores();
