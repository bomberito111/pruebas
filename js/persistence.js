/* ═══════════════════════════════════════════
   persistence.js — State persistence for field use
   Bosques Urbanos

   Saves ISA form progress to localStorage so
   evaluators can close the app mid-evaluation
   and resume exactly where they left off.
   ═══════════════════════════════════════════ */
(function () {
  'use strict';

  var FORM_KEY  = 'bu_form_persist_v2';
  var VIEW_KEY  = 'bu_view_persist_v1';
  var MAX_AGE   = 7 * 24 * 60 * 60 * 1000; // 7 days

  /* ─────────────────────────────────────────
     SAVE FORM STATE
  ───────────────────────────────────────── */
  window._persistSaveForm = function () {
    try {
      var answers = window.getFormAnswers ? window.getFormAnswers() : {};
      if (!answers || Object.keys(answers).length === 0) return;
      var state = {
        answers:      JSON.parse(JSON.stringify(answers)),
        wizArbolId:   window._wizArbolId   || null,
        wizEspecie:   window._wizEspecie   || null,
        wizCliente:   window._wizCliente   || null,
        wizEvaluador: window._wizEvaluador || null,
        wizGps:       window._wizGPS       || null,
        ts:           Date.now()
      };
      localStorage.setItem(FORM_KEY, JSON.stringify(state));
    } catch (e) { /* storage full or private mode */ }
  };

  /* ─────────────────────────────────────────
     CLEAR FORM STATE (called after save/discard)
  ───────────────────────────────────────── */
  window._persistClearForm = function () {
    try { localStorage.removeItem(FORM_KEY); } catch (e) {}
    window._persistedFormState = null;
    var b = document.getElementById('persist-banner');
    if (b) b.remove();
  };

  /* ─────────────────────────────────────────
     SAVE ACTIVE VIEW
  ───────────────────────────────────────── */
  window._persistSaveView = function (viewId) {
    try { localStorage.setItem(VIEW_KEY, viewId); } catch (e) {}
  };

  /* ─────────────────────────────────────────
     RESTORE — called after app boots
  ───────────────────────────────────────── */
  window._persistRestore = function () {
    try {
      var raw = localStorage.getItem(FORM_KEY);
      if (!raw) return;
      var state = JSON.parse(raw);
      if (!state || !state.answers) return;
      var answeredCount = Object.keys(state.answers).length;
      if (answeredCount === 0) { localStorage.removeItem(FORM_KEY); return; }
      if (Date.now() - (state.ts || 0) > MAX_AGE) { localStorage.removeItem(FORM_KEY); return; }

      window._persistedFormState = state;

      // Build info for banner
      var arbolId = state.answers.arbolId || state.wizArbolId || '';
      var especie = state.answers.especie || state.wizEspecie || '';
      var cliente = state.answers.cliente || state.wizCliente || '';

      _showRestoreBanner(answeredCount, arbolId, especie, cliente);
    } catch (e) {}
  };

  /* ─────────────────────────────────────────
     BANNER UI
  ───────────────────────────────────────── */
  function _showRestoreBanner(count, arbolId, especie, cliente) {
    var existing = document.getElementById('persist-banner');
    if (existing) existing.remove();

    var banner = document.createElement('div');
    banner.id = 'persist-banner';
    banner.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'right:0',
      'z-index:99999',
      'background:linear-gradient(135deg,#0a2410 0%,#0f3320 100%)',
      'color:#fff',
      'padding:12px 16px',
      'display:flex',
      'align-items:center',
      'gap:12px',
      'box-shadow:0 4px 20px rgba(0,0,0,.35)',
      'font-family:\'IBM Plex Sans\',sans-serif'
    ].join(';');

    var info = count + ' respuesta' + (count !== 1 ? 's' : '') + ' guardada' + (count !== 1 ? 's' : '');
    if (arbolId) info += ' · Árbol: ' + arbolId;
    if (especie)  info += ' · ' + especie;
    if (cliente)  info += ' · ' + cliente;

    banner.innerHTML =
      '<div style="font-size:22px;flex-shrink:0;">💾</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:13px;font-weight:700;line-height:1.2;">Evaluación en progreso</div>' +
        '<div style="font-size:11px;opacity:.75;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + info + '</div>' +
      '</div>' +
      '<button onclick="window._persistDoRestore()" style="padding:9px 16px;background:#22c55e;color:#fff;border:none;border-radius:9px;font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap;font-family:inherit;">▶ Continuar</button>' +
      '<button onclick="window._persistClearForm()" style="padding:9px 12px;background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:9px;font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap;font-family:inherit;">✕</button>';

    document.body.appendChild(banner);
  }

  /* ─────────────────────────────────────────
     DO RESTORE — user pressed "Continuar"
  ───────────────────────────────────────── */
  window._persistDoRestore = function () {
    var state = window._persistedFormState;
    if (!state) return;

    // Restore wizard globals so form header shows correct data
    if (state.wizArbolId)   window._wizArbolId   = state.wizArbolId;
    if (state.wizEspecie)   window._wizEspecie   = state.wizEspecie;
    if (state.wizCliente)   window._wizCliente   = state.wizCliente;
    if (state.wizEvaluador) window._wizEvaluador = state.wizEvaluador;
    if (state.wizGps)       window._wizGPS       = state.wizGps;

    // Close banner
    var b = document.getElementById('persist-banner');
    if (b) b.remove();

    // Navigate to form view
    if (window.showView) {
      window.showView('viewForm');
    } else if (window.switchTab) {
      window.switchTab('form');
    }

    // After navigation, restore answers and rebuild form
    setTimeout(function () {
      // 1. Reset form without clearing client
      if (window.resetFormFn) window.resetFormFn(false);

      // 2. Inject saved answers
      if (window.setFormAnswers) window.setFormAnswers(state.answers);

      // 3. Rebuild the form UI with restored answers
      if (window.buildForm) window.buildForm();

      // 4. Scroll to first unanswered question
      setTimeout(function () {
        var qs = window.QS || [];
        var firstUnanswered = -1;
        for (var i = 0; i < qs.length; i++) {
          if (!state.answers.hasOwnProperty(qs[i].id)) { firstUnanswered = i; break; }
        }
        var targetEl = firstUnanswered >= 0
          ? document.getElementById('qblock-' + firstUnanswered)
          : document.getElementById('formResultsArea');
        if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Update progress bar
        if (window.updateProgress) window.updateProgress();
      }, 200);
    }, 400);
  };

  /* ─────────────────────────────────────────
     HOOK INTO showView TO SAVE ACTIVE VIEW
  ───────────────────────────────────────── */
  // Wait for app to load, then wrap showView
  function _hookShowView() {
    var origShowView = window.showView;
    if (typeof origShowView === 'function') {
      window.showView = function (viewId) {
        origShowView.apply(this, arguments);
        window._persistSaveView(viewId);
      };
    }
  }

  /* ─────────────────────────────────────────
     BOOT — run after all scripts load
  ───────────────────────────────────────── */
  window.addEventListener('load', function () {
    _hookShowView();
    // Delay restore check to let auth/data load first
    setTimeout(window._persistRestore, 1500);
  });

})();
