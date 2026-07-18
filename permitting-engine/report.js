/*
 * Mini·O Permitting Triage — full-report HTML renderer.
 * Pure functions, no DOM. Runs in Node (send-details email function) and the
 * browser (client-facing download/view). Inline-styled so the same markup
 * works in an email body and a print-ready page.
 *
 * render(out, quick, address) — out is PermittingEngine.evaluate() output,
 * quick is PermittingSummary.summarize(out), address is a display string or
 * null. Returns body-inner HTML (no <html>/<head> shell).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PermittingReport = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PERMIT_LABELS = {
    building_permit: 'Building permit',
    electrical_permit: 'Electrical permit',
    plumbing_permit: 'Plumbing permit',
    zoning_review: 'Zoning review',
  };

  var POSTURE_LABELS = {
    likely_exempt: 'Likely exempt',
    likely_required: 'Likely required',
    depends: 'Depends',
    not_applicable: 'Not applicable',
    footings_likely_required: 'Footings likely required',
    standard_ok: 'Standard slab/pier OK',
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

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function render(out, quick, address) {
    var td = 'padding:8px 10px;border-bottom:1px solid #eee;font-size:14px;';
    var h = '';

    h += '<div style="font-family:Georgia,serif;font-size:22px;color:#535266;margin-bottom:4px;">Mini&middot;O</div>';
    h += '<h1 style="font-family:Georgia,serif;font-size:24px;color:#535266;margin:12px 0 4px;">' + esc(quick.headline) + '</h1>';
    h += '<p style="color:#535266;font-size:15px;margin:0 0 16px;">' +
      esc(out.jurisdiction) + (address ? ' &middot; ' + esc(address) : '') +
      '<br>Configuration: ' + esc(out.config_summary) + '</p>';

    h += '<h2 style="font-size:16px;color:#535266;margin:20px 0 6px;">Permits at a glance</h2>';
    h += '<table style="border-collapse:collapse;width:100%;max-width:560px;">';
    Object.keys(out.permits).forEach(function (p) {
      h += '<tr><td style="' + td + '">' + esc(PERMIT_LABELS[p] || p) + '</td><td style="' + td + 'font-weight:bold;">' +
        esc(POSTURE_LABELS[out.permits[p]] || out.permits[p]) + '</td></tr>';
    });
    h += '<tr><td style="' + td + '">Energy compliance' + (out.energy_compliance.code ? ' (' + esc(out.energy_compliance.code) + ')' : '') +
      '</td><td style="' + td + 'font-weight:bold;">' + esc(POSTURE_LABELS[out.energy_compliance.posture] || out.energy_compliance.posture) + '</td></tr>';
    h += '<tr><td style="' + td + '">Foundation</td><td style="' + td + 'font-weight:bold;">' +
      esc(POSTURE_LABELS[out.foundation_requirement.posture] || out.foundation_requirement.posture) + '</td></tr>';
    h += '</table>';

    h += '<h2 style="font-size:16px;color:#535266;margin:20px 0 6px;">Notes</h2><ul style="font-size:14px;color:#333;">';
    h += '<li>' + esc(out.energy_compliance.note) + '</li>';
    h += '<li>' + esc(out.foundation_requirement.note) + '</li>';
    out.notes.forEach(function (n) { h += '<li>' + esc(n) + '</li>'; });
    if (out.config_lock_note) h += '<li>' + esc(out.config_lock_note) + '</li>';
    h += '</ul>';

    var reqs = out.construction_requirements;
    h += '<h2 style="font-size:16px;color:#535266;margin:20px 0 6px;">Building requirements</h2>';
    if (reqs.status === 'listed') {
      if (reqs.verified.length) {
        h += '<ul style="font-size:14px;color:#333;">';
        reqs.verified.forEach(function (r) {
          h += '<li><strong>' + esc(CATEGORY_LABELS[r.category] || r.category) + ':</strong> ' + esc(r.requirement) +
            ' <span style="color:#777;">(' + esc(r.citation.code_section) + ', confidence: ' + esc(r.confidence) + ')</span></li>';
        });
        h += '</ul>';
      }
      if (reqs.unverified.length) {
        h += '<p style="font-size:14px;font-weight:bold;color:#333;">Unverified — confirm with the office:</p><ul style="font-size:14px;color:#555;">';
        reqs.unverified.forEach(function (r) {
          h += '<li><strong>' + esc(CATEGORY_LABELS[r.category] || r.category) + ':</strong> ' + esc(r.requirement) + '</li>';
        });
        h += '</ul>';
      }
    } else {
      h += '<p style="font-size:14px;color:#333;">' + esc(reqs.note) + '</p>';
    }

    if (out.citations.length) {
      h += '<h2 style="font-size:16px;color:#535266;margin:20px 0 6px;">Citations</h2>';
      out.citations.forEach(function (c) {
        h += '<p style="font-size:13px;color:#333;background:#fafafa;border:1px solid #eee;border-radius:6px;padding:8px 10px;">' +
          '<strong>' + esc(c.code_section) + '</strong> — ' + esc(c.title) + ' (confidence: ' + esc(c.confidence) + ')<br>' +
          (c.snippet ? '&ldquo;' + esc(c.snippet) + '&rdquo;<br>' : '') +
          '<a href="' + esc(c.url) + '" style="color:#535266;">' + esc(c.url) + '</a></p>';
      });
    }

    h += '<h2 style="font-size:16px;color:#535266;margin:20px 0 6px;">Next step</h2>';
    h += '<p style="font-size:14px;color:#333;">' + esc(out.next_step.contact) + '</p><ul style="font-size:14px;color:#333;">';
    out.next_step.questions.forEach(function (q) { h += '<li>' + esc(q) + '</li>'; });
    h += '</ul>';

    if (out.zoning_note) {
      h += '<h2 style="font-size:16px;color:#535266;margin:20px 0 6px;">Zoning</h2><p style="font-size:14px;color:#333;">' + esc(out.zoning_note) + '</p>';
    }
    h += '<h2 style="font-size:16px;color:#535266;margin:20px 0 6px;">HOA</h2><p style="font-size:14px;color:#333;">' + esc(out.hoa_note) + '</p>';

    h += '<div style="background:#E3CDBF;border-radius:8px;padding:14px 16px;font-size:14px;color:#3d3c4b;margin:18px 0;">' +
      '<strong>Don&rsquo;t want to deal with any of this?</strong> Mini&middot;O&rsquo;s permitting package handles the whole thing — ' +
      'research, drawings, submitting, and any back-and-forth with your city.</div>';

    h += '<p style="font-size:12px;color:#9398A5;border-top:1px solid #eee;padding-top:10px;">' + esc(out.disclaimer) + '</p>';

    return h;
  }

  return { render: render };
});
