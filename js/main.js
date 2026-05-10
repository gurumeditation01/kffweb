/* ═══════════════════════════════════════════════════════════════
   KFF WEBSITE — main.js
   ═══════════════════════════════════════════════════════════════ */

// ─── Countdown ────────────────────────────────────────────────
// Target: June 3rd 2026, midnight local time
const COUNTDOWN_TARGET = new Date('2026-06-03T00:00:00');

const $days    = document.getElementById('days');
const $hours   = document.getElementById('hours');
const $minutes = document.getElementById('minutes');
const $seconds = document.getElementById('seconds');

function pad(n) {
    return String(Math.max(0, n)).padStart(2, '0');
}

function tick() {
    const diff = COUNTDOWN_TARGET - Date.now();

    if (diff <= 0) {
        $days.textContent    = '00';
        $hours.textContent   = '00';
        $minutes.textContent = '00';
        $seconds.textContent = '00';
        return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600)  / 60);
    const s = totalSeconds % 60;

    $days.textContent    = pad(d);
    $hours.textContent   = pad(h);
    $minutes.textContent = pad(m);
    $seconds.textContent = pad(s);
}

tick();
setInterval(tick, 1000);

// ─── Autoplay fallback ────────────────────────────────────────
// Some browsers block autoplay even with muted. Force play on
// first user interaction if the video has stalled.
const heroVideo = document.querySelector('.hero-video');

if (heroVideo) {
    heroVideo.play().catch(() => {
        const resume = () => {
            heroVideo.play();
            document.removeEventListener('pointerdown', resume);
            document.removeEventListener('keydown', resume);
        };
        document.addEventListener('pointerdown', resume, { once: true });
        document.addEventListener('keydown', resume, { once: true });
    });
}
