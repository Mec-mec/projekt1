'use strict';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const fejfajasSlider  = document.getElementById('fejfajas');
const faradsagSlider  = document.getElementById('faradsag');
const fejfajasValue   = document.getElementById('fejfajasValue');
const faradsagValue   = document.getElementById('faradsagValue');
const submitBtn       = document.getElementById('submitBtn');
const statusEl        = document.getElementById('status');
const formCard        = document.getElementById('formCard');
const resultCard      = document.getElementById('resultCard');
const resultIcon      = document.getElementById('resultIcon');
const resultLabel     = document.getElementById('resultLabel');
const resultCount     = document.getElementById('resultCount');
const resultRadius    = document.getElementById('resultRadius');
const resultBar       = document.getElementById('resultBar');
const resetBtn        = document.getElementById('resetBtn');

// ── Slider fill: update CSS custom property so the filled track renders ───────
function updateSliderFill(slider) {
  const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
  slider.style.setProperty('--fill', pct + '%');
}

function bindSlider(slider, display) {
  const refresh = () => {
    display.textContent = slider.value;
    updateSliderFill(slider);
  };
  slider.addEventListener('input', refresh);
  refresh(); // initialise on load
}

bindSlider(fejfajasSlider, fejfajasValue);
bindSlider(faradsagSlider, faradsagValue);

// ── Icons per result level ────────────────────────────────────────────────────
const LEVEL_ICONS = {
  'none':      '😶',
  'few':       '🙁',
  'many':      '😰',
  'very-many': '🤯',
};

// Bar width targets per level (purely visual feel)
const LEVEL_BAR_WIDTH = {
  'none':      '5%',
  'few':       '30%',
  'many':      '65%',
  'very-many': '95%',
};

// ── Show result ───────────────────────────────────────────────────────────────
function showResult(data) {
  resultIcon.textContent  = LEVEL_ICONS[data.level] || '🔍';
  resultLabel.textContent = data.label;
  resultCount.textContent = data.count;
  resultRadius.textContent =
    data.radiusKm
      ? `A keresési sugár: ${data.radiusKm} km`
      : '';

  // Bar
  resultBar.className = 'result__bar result__bar--' + data.level;
  // Trigger CSS transition (set to 0 first, then animate)
  resultBar.style.width = '0%';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      resultBar.style.width = LEVEL_BAR_WIDTH[data.level] || '10%';
    });
  });

  formCard.hidden   = true;
  resultCard.hidden = false;
}

// ── Set status / error ────────────────────────────────────────────────────────
function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className   = isError ? 'status status--error' : 'status';
}

// ── Set loading state ─────────────────────────────────────────────────────────
function setLoading(on) {
  submitBtn.disabled = on;
  if (on) {
    submitBtn.innerHTML =
      '<span class="spinner"></span>&nbsp;Helyadatok lekérése…';
  } else {
    submitBtn.innerHTML =
      '<span class="btn__text">Megnézem, mások is így érzik?</span><span class="btn__icon">→</span>';
  }
}

// ── Main submit flow ──────────────────────────────────────────────────────────
submitBtn.addEventListener('click', () => {
  setStatus('');
  setLoading(true);

  if (!navigator.geolocation) {
    setStatus('A böngésződ nem támogatja a helymeghatározást.', true);
    setLoading(false);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      const fejfajas = parseInt(fejfajasSlider.value, 10);
      const faradsag = parseInt(faradsagSlider.value, 10);

      submitBtn.innerHTML =
        '<span class="spinner"></span>&nbsp;Küldés folyamatban…';

      try {
        const response = await fetch('/api/report', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ latitude, longitude, fejfajas, faradsag }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || `Szerverhiba (${response.status})`);
        }

        const data = await response.json();
        showResult(data);
      } catch (err) {
        setStatus('Hiba: ' + err.message, true);
      } finally {
        setLoading(false);
      }
    },
    (geoErr) => {
      setLoading(false);
      const msg = {
        1: 'A helyadatok engedélye megtagadva. Kérlek, engedélyezd a helymeghatározást.',
        2: 'A helyadatok nem érhetők el. Próbáld újra.',
        3: 'A helyadatok lekérése túl sokáig tartott. Próbáld újra.',
      }[geoErr.code] || 'Ismeretlen helymeghatározási hiba.';
      setStatus(msg, true);
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
  );
});

// ── Reset ─────────────────────────────────────────────────────────────────────
resetBtn.addEventListener('click', () => {
  resultCard.hidden = false;   // keep visible briefly during transition
  formCard.hidden   = false;
  resultCard.hidden = true;
  setStatus('');
});
