/*
 * Mini·O Permitting Triage — plain-English summary of an engine result.
 * Pure functions, no DOM. Runs in Node (tests, email function) and the browser
 * (client-facing page).
 *
 * Guardrails enforced here (same spirit as engine.js):
 *  - Never renders a green "no permits" headline unless the jurisdiction is
 *    verified AND nothing is likely_required or depends. Draft/product-default
 *    coverage always reads as "likely" or "quick check" — the safe error.
 *  - Translates postures to friendly language without ever turning guidance
 *    into a verdict.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PermittingSummary = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Plain-English row text per permit type and posture. */
  var ROW_TEXT = {
    building_permit: {
      label: 'Building permit',
      likely_required: 'Your city will likely want to approve the structure itself.',
      depends: 'Your city may want to approve the structure — it depends on your exact setup.',
      likely_exempt: 'The structure itself likely won’t need its own permit.',
    },
    electrical_permit: {
      label: 'Electrical sign-off',
      likely_required: 'Every pod plugs into a dedicated 50-amp line, and cities sign off on that hookup.',
      depends: 'The 50-amp hookup may need an electrical sign-off — your office will confirm.',
      likely_exempt: 'The electrical hookup likely won’t need its own permit.',
    },
    plumbing_permit: {
      label: 'Plumbing permit',
      likely_required: 'Adding water (bath or kitchenette) means a plumbing sign-off.',
      depends: 'Your plumbing setup may need a sign-off — your office will confirm.',
      likely_exempt: 'Your plumbing setup likely won’t need its own permit.',
    },
    zoning_review: {
      label: 'Zoning check',
      likely_required: 'The city will look at where the pod sits on your lot (setbacks and coverage).',
      depends: 'Where the pod sits on your lot may need a quick zoning look.',
      likely_exempt: 'Placement on your lot likely won’t need a separate review.',
    },
  };

  var STATUS_BY_POSTURE = {
    likely_required: 'likely',
    depends: 'check',
    likely_exempt: 'clear',
  };

  var FINAL_SAY_LINE =
    'Your local permitting office always has the final say — treat this as a friendly heads-up, not a ruling.';

  /* Short names used in the one-paragraph brief. */
  var BRIEF_NAMES = {
    building_permit: 'a building permit',
    electrical_permit: 'an electrical sign-off',
    plumbing_permit: 'a plumbing permit',
    zoning_review: 'a zoning check',
  };

  function joinList(items) {
    if (items.length <= 1) return items.join('');
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }

  /* One-paragraph plain-English brief: what's likely in play, in general terms. */
  function buildBrief(out, rows, tone) {
    if (tone === 'green') {
      return 'Based on verified local rules, none of the usual permits look necessary for this setup — we still recommend a quick confirmation before you build.';
    }
    var likely = rows
      .filter(function (r) { return r.status === 'likely'; })
      .map(function (r) { return BRIEF_NAMES[r.key]; });
    var check = rows
      .filter(function (r) { return r.status === 'check'; })
      .map(function (r) { return BRIEF_NAMES[r.key]; });
    if (out.energy_compliance.posture === 'likely_required') {
      likely.push(
        'an energy report' + (out.energy_compliance.code ? ' (' + out.energy_compliance.code + ')' : '')
      );
    }
    var s;
    if (likely.length && check.length) {
      s = 'Expect ' + joinList(likely) + ' — and your city may also take a quick look at ' + joinList(check) + '.';
    } else if (likely.length) {
      s = 'Expect ' + joinList(likely) + '.';
    } else if (check.length) {
      s = 'Your city will want a quick look at ' + joinList(check) + ' before you build.';
    } else {
      s = 'We’ll confirm the exact requirements for your setup with your local office.';
    }
    return s;
  }

  /*
   * summarize(out) — out is the object returned by PermittingEngine.evaluate().
   * Returns:
   * {
   *   tone: 'green' | 'amber',
   *   headline, subline,
   *   rows: [{ key, label, status: 'likely'|'check'|'clear', text }],
   *   extra_lines: [string],       // energy + foundation, plain English
   *   final_say_line, package_cta, disclaimer, jurisdiction, config_summary
   * }
   */
  function summarize(out) {
    var rows = [];
    Object.keys(ROW_TEXT).forEach(function (key) {
      var posture = out.permits[key];
      if (!posture || posture === 'not_applicable') return;
      var entry = ROW_TEXT[key];
      rows.push({
        key: key,
        label: entry.label,
        status: STATUS_BY_POSTURE[posture] || 'check',
        text: entry[posture] || entry.depends,
      });
    });

    var anyLikely = rows.some(function (r) { return r.status === 'likely'; });
    var anyCheck = rows.some(function (r) { return r.status === 'check'; });

    var place =
      out.coverage === 'product_default' ? 'your area' : out.jurisdiction;

    var tone;
    var headline;
    var subline;
    if (out.coverage === 'verified' && !anyLikely && !anyCheck) {
      tone = 'green';
      headline = 'Good news — this setup likely skips the permit line.';
      subline = 'We still recommend a quick confirmation with ' + place + ' before you build.';
    } else if (anyLikely) {
      tone = 'amber';
      headline = 'Heads up: permits are likely — and that’s okay.';
      subline = 'Here’s the quick version for ' + place + '. Mini·O can handle every step for you.';
    } else {
      tone = 'amber';
      headline = 'Almost there — your city needs a quick check first.';
      subline = 'Here’s the quick version for ' + place + '. Mini·O can run that check for you.';
    }
    if (out.coverage === 'product_default') {
      subline += ' We haven’t mapped your city’s exact rules yet — we confirm the specifics for every order.';
    }

    var extraLines = [];
    if (out.energy_compliance.posture === 'likely_required') {
      extraLines.push(
        'Expect an energy-efficiency report' +
        (out.energy_compliance.code ? ' (' + out.energy_compliance.code + ')' : '') +
        ' — standard paperwork for heated spaces in your state. We prepare it.'
      );
    } else if (out.energy_compliance.posture === 'depends') {
      extraLines.push('We’ll confirm the energy-code paperwork for your state.');
    }
    var f = out.foundation_requirement.posture;
    if (f === 'footings_likely_required') {
      extraLines.push('Plan for real footings, not just a bare slab — permitted builds need them.');
    } else if (f === 'depends') {
      extraLines.push('Foundation depends on the permit path — don’t pour anything yet.');
    } else if (f === 'standard_ok') {
      extraLines.push('A standard slab or pier foundation should do it.');
    }

    return {
      tone: tone,
      headline: headline,
      subline: subline,
      brief: buildBrief(out, rows, tone),
      rows: rows,
      extra_lines: extraLines,
      final_say_line: FINAL_SAY_LINE,
      package_cta: Boolean(out.package_cta),
      disclaimer: out.disclaimer,
      jurisdiction: out.jurisdiction,
      config_summary: out.config_summary,
    };
  }

  return { summarize: summarize };
});
