/* Mini·O Permitting Triage — internal UI glue. All logic lives in engine.js. */

(function () {
  'use strict';

  var engine = window.PermittingEngine;
  var data = null;

  var el = {
    model: document.getElementById('model'),
    footprint: document.getElementById('footprint'),
    plumbing: document.getElementById('plumbing'),
    sleeping: document.getElementById('sleeping'),
    trailer: document.getElementById('trailer'),
    jurisdiction: document.getElementById('jurisdiction'),
    evaluate: document.getElementById('evaluate'),
    output: document.getElementById('output'),
  };

  var POSTURE_LABELS = {
    likely_exempt: 'Likely exempt',
    likely_required: 'Likely required',
    depends: 'Depends',
    not_applicable: 'Not applicable',
    footings_likely_required: 'Footings likely required',
    standard_ok: 'Standard slab/pier OK',
  };

  var PERMIT_LABELS = {
    building_permit: 'Building permit',
    electrical_permit: 'Electrical permit',
    plumbing_permit: 'Plumbing permit',
    zoning_review: 'Zoning review',
  };

  var COVERAGE_LABELS = {
    draft: 'DRAFT — unverified research. Confirm everything with the office before quoting it.',
    verified: 'Verified entry',
    product_default: 'Not researched yet — generic product guidance. We’ll confirm the specific city.',
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function postureChip(value) {
    return '<span class="posture posture-' + esc(value) + '">' + esc(POSTURE_LABELS[value] || value) + '</span>';
  }

  function loadData() {
    return fetch('data/jurisdictions.json')
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load jurisdictions.json (' + res.status + ')');
        return res.json();
      })
      .then(function (json) {
        data = json;
        populateJurisdictions();
      })
      .catch(function (err) {
        el.output.innerHTML = '<p class="output-empty">Could not load jurisdiction data: ' + esc(err.message) + '</p>';
      });
  }

  function populateJurisdictions() {
    var html = '';
    data.jurisdictions.forEach(function (j) {
      var label = j.name + ', ' + (j.county ? j.county + ' County, ' : '') + j.state + ' [' + j.status + ']';
      html += '<option value="' + esc(j.id) + '">' + esc(label) + '</option>';
    });
    html += '<option value="__other">Other / not listed (not researched)</option>';
    el.jurisdiction.innerHTML = html;
  }

  function currentPodConfig() {
    return {
      model: el.model.value,
      footprint_sqft: parseInt(el.footprint.value, 10) || 0,
      plumbing: el.plumbing.value,
      sleeping_intended: el.sleeping.checked,
      on_trailer: el.trailer.checked,
      electrical: 'standard',
    };
  }

  function currentJurisdiction() {
    var id = el.jurisdiction.value;
    if (id === '__other') return null;
    return data.jurisdictions.find(function (j) { return j.id === id; }) || null;
  }

  function onModelChange() {
    var model = el.model.value;
    if (model === 'custom') {
      el.footprint.disabled = false;
    } else {
      el.footprint.disabled = true;
      el.footprint.value = engine.MODEL_FOOTPRINTS[model];
    }
  }

  function render(out) {
    var html = '';

    html += '<div class="coverage-banner coverage-' + esc(out.coverage) + '">' +
      esc(COVERAGE_LABELS[out.coverage] || out.coverage) + '</div>';

    html += '<div class="result-meta"><strong>' + esc(out.jurisdiction) + '</strong>';
    if (out.verified_as_of) html += ' · verified as of ' + esc(out.verified_as_of);
    html += '<br>' + esc(out.config_summary) + '</div>';

    html += '<table class="permit-table">';
    Object.keys(out.permits).forEach(function (p) {
      html += '<tr><td>' + esc(PERMIT_LABELS[p] || p) + '</td><td>' + postureChip(out.permits[p]) + '</td></tr>';
    });
    html += '<tr><td>Energy compliance' + (out.energy_compliance.code ? ' (' + esc(out.energy_compliance.code) + ')' : '') +
      '</td><td>' + postureChip(out.energy_compliance.posture) + '</td></tr>';
    html += '<tr><td>Foundation</td><td>' + postureChip(out.foundation_requirement.posture) + '</td></tr>';
    html += '</table>';

    html += '<div class="section-block"><h3>Notes</h3><ul>';
    html += '<li>' + esc(out.energy_compliance.note) + '</li>';
    html += '<li>' + esc(out.foundation_requirement.note) + '</li>';
    out.notes.forEach(function (n) { html += '<li>' + esc(n) + '</li>'; });
    if (out.config_lock_note) html += '<li>' + esc(out.config_lock_note) + '</li>';
    html += '</ul></div>';

    if (out.citations.length) {
      html += '<div class="section-block"><h3>Citations</h3>';
      out.citations.forEach(function (c) {
        html += '<div class="citation"><strong>' + esc(c.code_section) + '</strong> — ' + esc(c.title) +
          ' (confidence: ' + esc(c.confidence) + ')<br>' +
          (c.snippet ? '“' + esc(c.snippet) + '”<br>' : '') +
          '<a href="' + esc(c.url) + '" target="_blank" rel="noopener">' + esc(c.url) + '</a></div>';
      });
      html += '</div>';
    } else {
      html += '<div class="section-block"><h3>Citations</h3><p>None verified yet — determinations above are shown conservatively.</p></div>';
    }

    html += '<div class="section-block"><h3>Next step</h3><p>' + esc(out.next_step.contact) + '</p><ul>';
    out.next_step.questions.forEach(function (q) { html += '<li>' + esc(q) + '</li>'; });
    html += '</ul></div>';

    if (out.zoning_note) {
      html += '<div class="section-block"><h3>Zoning</h3><p>' + esc(out.zoning_note) + '</p></div>';
    }
    html += '<div class="section-block"><h3>HOA</h3><p>' + esc(out.hoa_note) + '</p></div>';

    if (out.package_cta) {
      html += '<div class="cta-box">Mini·O’s permitting package handles all of this for the customer — research, drawings, submittal, and corrections. Lead with it.</div>';
    }

    html += '<div class="disclaimer">' + esc(out.disclaimer) + '</div>';

    el.output.innerHTML = html;
  }

  function onEvaluate() {
    if (!data) return;
    var out = engine.evaluate(currentPodConfig(), currentJurisdiction(), {
      productDefault: data.product_default,
    });
    render(out);
  }

  el.model.addEventListener('change', onModelChange);
  el.evaluate.addEventListener('click', onEvaluate);

  onModelChange();
  loadData();
})();
