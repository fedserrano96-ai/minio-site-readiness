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
    address: document.getElementById('address'),
    addressSearch: document.getElementById('address-search'),
    addressStatus: document.getElementById('address-status'),
    manualPick: document.getElementById('manual-pick'),
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

  var CATEGORY_LABELS = {
    insulation: 'Insulation',
    foundation: 'Foundation',
    snow_load: 'Snow load',
    wind: 'Wind',
    seismic: 'Seismic',
    energy: 'Energy',
    other: 'Other',
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

  function setAddressStatus(message, kind) {
    el.addressStatus.hidden = false;
    el.addressStatus.className = 'address-status address-status-' + kind;
    el.addressStatus.textContent = message;
  }

  function jurisdictionLabel(j) {
    return j.name + ', ' + (j.county ? j.county + ' County, ' : '') + j.state + ' [' + j.status + ']';
  }

  function onAddressSearch() {
    if (!data) return;
    var address = el.address.value.trim();
    if (!address) {
      setAddressStatus('Type an address first.', 'error');
      return;
    }
    setAddressStatus('Looking up address…', 'pending');
    fetch('/.netlify/functions/geocode?address=' + encodeURIComponent(address))
      .then(function (res) {
        if (!res.ok) throw new Error('geocode ' + res.status);
        return res.json();
      })
      .then(function (json) {
        if (!json.result) {
          setAddressStatus('No match for that address — check it or pick the jurisdiction manually below.', 'error');
          el.manualPick.open = true;
          return;
        }
        var resolved = window.PermittingResolver.resolve(json.result, data.jurisdictions);
        if (resolved.jurisdictionId) {
          el.jurisdiction.value = resolved.jurisdictionId;
          var j = data.jurisdictions.find(function (x) { return x.id === resolved.jurisdictionId; });
          setAddressStatus('Matched: ' + resolved.matchedAddress + ' → ' + jurisdictionLabel(j), 'ok');
        } else {
          el.jurisdiction.value = '__other';
          setAddressStatus(
            'Matched: ' + resolved.matchedAddress + ' → not yet researched. Using generic product guidance — we’ll confirm this city.',
            'warn'
          );
        }
        onEvaluate();
      })
      .catch(function () {
        setAddressStatus('Couldn’t look up that address — pick the jurisdiction manually below.', 'error');
        el.manualPick.open = true;
      });
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

    var reqs = out.construction_requirements;
    html += '<div class="section-block"><h3>Building requirements</h3>';
    if (reqs.status === 'listed') {
      if (reqs.verified.length) {
        html += '<ul>';
        reqs.verified.forEach(function (r) {
          html += '<li><strong>' + esc(CATEGORY_LABELS[r.category] || r.category) + ':</strong> ' +
            esc(r.requirement) +
            ' <span class="req-cite">(' + esc(r.citation.code_section) +
            ', confidence: ' + esc(r.confidence) + ')</span></li>';
        });
        html += '</ul>';
      }
      if (reqs.unverified.length) {
        html += '<p class="req-unverified-head">Unverified — confirm with the office:</p><ul class="req-unverified">';
        reqs.unverified.forEach(function (r) {
          html += '<li><strong>' + esc(CATEGORY_LABELS[r.category] || r.category) + ':</strong> ' +
            esc(r.requirement) + '</li>';
        });
        html += '</ul>';
      }
    } else {
      html += '<p>' + esc(reqs.note) + '</p>';
    }
    html += '</div>';

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
  el.addressSearch.addEventListener('click', onAddressSearch);
  el.address.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') onAddressSearch();
  });

  onModelChange();
  loadData();
})();
