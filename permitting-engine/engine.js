/*
 * Mini·O Permitting Triage Engine — core evaluation logic.
 * Pure functions, no DOM. Runs in Node (tests) and the browser (UI).
 *
 * Guardrails enforced here:
 *  - Outcomes are only ever: likely_exempt | likely_required | depends | not_applicable.
 *  - A determination from a rule whose citation is incomplete (empty or <<verify>>)
 *    is downgraded to "depends" with a confirm-with-the-office note.
 *  - Unknown / not_researched jurisdictions fall back to the product-default rule
 *    set (passed in from the data file) and never output likely_exempt.
 *  - When uncertain, the safe error is "a permit is likely, and we handle it."
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PermittingEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var POSTURES = ['likely_exempt', 'likely_required', 'depends', 'not_applicable'];
  var PERMIT_TYPES = ['building_permit', 'electrical_permit', 'plumbing_permit', 'zoning_review'];
  var CONFIDENCE_RANK = { high: 3, medium: 2, low: 1 };

  /* Fixed Mini·O product facts (see permitting_engine_data_model.md §2). */
  var MODEL_FOOTPRINTS = { twelve: 96, sixteen: 160, station: 300 };
  var MODEL_LABELS = { twelve: 'The Twelve', sixteen: 'The Sixteen', station: 'The Station', custom: 'Custom' };
  var PLUMBING_LABELS = {
    none: 'no plumbing',
    half_bath: 'half bath',
    kitchenette: 'kitchenette',
    full_bath: 'full bath',
  };

  /* Energy code deliverable by state (domain fact from CLAUDE.md). All pods are conditioned. */
  var STATE_ENERGY_CODES = {
    CA: { code: 'Title 24', deliverable: 'California Title 24 energy compliance report' },
    WA: { code: 'WSEC', deliverable: 'Washington State Energy Code (WSEC) compliance report' },
  };

  var DISCLAIMER_TEMPLATE =
    'This is general guidance based on our reading of publicly available requirements as of ' +
    '[DATE], not a permitting determination. Requirements change and are interpreted by your ' +
    'local office. Confirming what applies to your property is the property owner’s ' +
    'responsibility. Mini·O offers a permitting package that handles this for you.';

  var CONFIG_LOCK_NOTE =
    'Lock your pod configuration before permitting starts: size changes, window removals, or ' +
    'other config changes after a permit set is underway force a restart.';

  var TRAILER_NOTE =
    'Trailer-mounted units may be treated as a vehicle/RV rather than a structure in some ' +
    'jurisdictions — confirm how your local office classifies them.';

  var REQUIREMENTS_NOT_RESEARCHED_NOTE =
    'Construction requirements not yet researched for this jurisdiction.';

  var REQUIREMENTS_PRODUCT_DEFAULT_NOTE =
    'Requirements like insulation depth, footing depth, and snow load vary by climate and ' +
    'city — we’ll confirm what applies to your specific location.';

  /* ── Config helpers ────────────────────────────────────────────── */

  function resolveFootprint(podConfig) {
    if (typeof podConfig.footprint_sqft === 'number' && podConfig.footprint_sqft > 0) {
      return podConfig.footprint_sqft;
    }
    return MODEL_FOOTPRINTS[podConfig.model] || 0;
  }

  function configSummary(podConfig) {
    var parts = [];
    var label = MODEL_LABELS[podConfig.model] || 'Custom';
    parts.push(label + ' (' + resolveFootprint(podConfig) + ' sqft)');
    parts.push(PLUMBING_LABELS[podConfig.plumbing] || 'no plumbing');
    if (podConfig.on_trailer) parts.push('trailer-mounted');
    if (podConfig.sleeping_intended) parts.push('sleeping intended');
    return parts.join(', ');
  }

  /* ── Rule matching ─────────────────────────────────────────────── */

  function isWildcard(v) {
    return v === undefined || v === null || v === 'any';
  }

  function footprintMatches(cond, footprint) {
    if (isWildcard(cond)) return true;
    if (typeof cond.min === 'number' && footprint < cond.min) return false;
    if (typeof cond.max === 'number' && footprint > cond.max) return false;
    return true;
  }

  function ruleMatches(rule, podConfig) {
    var when = rule.when || {};
    var footprint = resolveFootprint(podConfig);
    if (!footprintMatches(when.footprint, footprint)) return false;
    if (!isWildcard(when.plumbing)) {
      var plumbing = podConfig.plumbing || 'none';
      if (when.plumbing.indexOf(plumbing) === -1) return false;
    }
    if (!isWildcard(when.on_trailer)) {
      if (Boolean(when.on_trailer) !== Boolean(podConfig.on_trailer)) return false;
    }
    if (!isWildcard(when.sleeping)) {
      if (Boolean(when.sleeping) !== Boolean(podConfig.sleeping_intended)) return false;
    }
    return true;
  }

  function ruleSpecificity(rule) {
    var when = rule.when || {};
    var n = 0;
    if (!isWildcard(when.footprint)) n++;
    if (!isWildcard(when.plumbing)) n++;
    if (!isWildcard(when.on_trailer)) n++;
    if (!isWildcard(when.sleeping)) n++;
    return n;
  }

  /* Most-specific-rule-wins. Tie: higher confidence wins; still tied: first in file order. */
  function selectRule(rules, podConfig) {
    var best = null;
    var bestSpec = -1;
    var bestConf = -1;
    (rules || []).forEach(function (rule) {
      if (!ruleMatches(rule, podConfig)) return;
      var spec = ruleSpecificity(rule);
      var conf = CONFIDENCE_RANK[rule.confidence] || 0;
      if (spec > bestSpec || (spec === bestSpec && conf > bestConf)) {
        best = rule;
        bestSpec = spec;
        bestConf = conf;
      }
    });
    return best;
  }

  /* ── Citation completeness / downgrade ─────────────────────────── */

  function isVerifyPlaceholder(s) {
    return typeof s !== 'string' || s.trim() === '' || s.indexOf('<<') !== -1;
  }

  function citationComplete(citation) {
    if (!citation) return false;
    return (
      !isVerifyPlaceholder(citation.code_section) &&
      !isVerifyPlaceholder(citation.title) &&
      !isVerifyPlaceholder(citation.url)
    );
  }

  /* ── Output assembly ───────────────────────────────────────────── */

  function energyCompliance(jurisdiction) {
    var state = jurisdiction && jurisdiction.state;
    var entry = state ? STATE_ENERGY_CODES[state] : null;
    if (entry) {
      return {
        code: entry.code,
        posture: 'likely_required',
        note: entry.deliverable + ' is a required deliverable for conditioned pods.',
      };
    }
    return {
      code: null,
      posture: 'depends',
      note: 'We’ll confirm the energy code requirements for your state.',
    };
  }

  function foundationRequirement(podConfig, buildingPosture, jurisdiction) {
    if (podConfig.on_trailer) {
      return {
        posture: 'not_applicable',
        note: 'Trailer-mounted: no permanent foundation required.',
      };
    }
    var isCA = Boolean(jurisdiction && jurisdiction.state === 'CA');
    if (buildingPosture === 'likely_required') {
      return {
        posture: 'footings_likely_required',
        note: isCA
          ? 'Permitted CA projects: a plain slab is not enough — footings are required for code compliance and city approval.'
          : 'Permitted builds typically need footings, not a bare slab — confirm the foundation detail with the plan reviewer.',
      };
    }
    if (buildingPosture === 'depends') {
      return {
        posture: 'depends',
        note: 'If a building permit applies, expect footing requirements — a bare slab may not be sufficient.',
      };
    }
    return {
      posture: 'standard_ok',
      note: 'Exempt path: a standard slab or pier foundation per Mini·O spec is typically fine. Re-check if your config changes.',
    };
  }

  /*
   * Construction requirements (data model v0.3): cited plain-English guidance
   * notes per jurisdiction. Same guardrail as permits: an incomplete citation
   * moves the item to the "unverified" bucket (and its citation is never
   * rendered); it can never appear as a clean claim.
   */
  function buildConstructionRequirements(jurisdiction, coverage) {
    if (coverage === 'product_default') {
      return { status: 'product_default', verified: [], unverified: [], note: REQUIREMENTS_PRODUCT_DEFAULT_NOTE };
    }
    var raw = jurisdiction && jurisdiction.construction_requirements;
    var list = Array.isArray(raw) ? raw : [];
    if (!list.length) {
      return { status: 'not_researched', verified: [], unverified: [], note: REQUIREMENTS_NOT_RESEARCHED_NOTE };
    }
    var verified = [];
    var unverified = [];
    list.forEach(function (req) {
      if (citationComplete(req.citation)) {
        verified.push({
          id: req.id,
          category: req.category,
          requirement: req.requirement,
          citation: {
            code_section: req.citation.code_section,
            title: req.citation.title,
            url: req.citation.url,
            snippet: req.citation.snippet || '',
          },
          confidence: req.confidence || 'low',
        });
      } else {
        unverified.push({ id: req.id, category: req.category, requirement: req.requirement });
      }
    });
    return { status: 'listed', verified: verified, unverified: unverified, note: null };
  }

  function buildNextStep(jurisdiction, coverage) {
    var questions = [
      'Is a prefabricated accessory structure of this footprint exempt from a building permit?',
      'Does adding plumbing reclassify it as a dwelling unit (DADU/ADU)?',
      'What setbacks and zoning review apply for this lot?',
    ];
    if (coverage === 'product_default') {
      return {
        contact: 'Your city or county building department — we’ll confirm your specific city.',
        questions: questions,
      };
    }
    var auth = (jurisdiction && jurisdiction.authority) || {};
    var contactParts = [];
    if (auth.dept) contactParts.push(auth.dept);
    if (auth.phone && !isVerifyPlaceholder(auth.phone)) contactParts.push(auth.phone);
    if (auth.url && !isVerifyPlaceholder(auth.url)) contactParts.push(auth.url);
    return {
      contact: contactParts.join(' · ') || 'Local building department',
      questions: questions,
    };
  }

  function isoToday() {
    var d = new Date();
    var m = String(d.getMonth() + 1);
    var day = String(d.getDate());
    if (m.length < 2) m = '0' + m;
    if (day.length < 2) day = '0' + day;
    return d.getFullYear() + '-' + m + '-' + day;
  }

  /*
   * evaluate(podConfig, jurisdiction, opts)
   *  podConfig    — see data model §2.
   *  jurisdiction — a jurisdiction record, or null/undefined if unknown.
   *  opts.productDefault — the product-default record from the data file (rules used
   *                        when the jurisdiction is unknown or not_researched).
   *  opts.today   — ISO date string for the disclaimer (defaults to today).
   */
  function evaluate(podConfig, jurisdiction, opts) {
    opts = opts || {};
    podConfig = podConfig || {};
    var today = opts.today || isoToday();

    var notResearched =
      !jurisdiction ||
      jurisdiction.status === 'not_researched' ||
      !(jurisdiction.rules && jurisdiction.rules.length);

    var coverage;
    var ruleSource;
    if (notResearched) {
      coverage = 'product_default';
      ruleSource = (opts.productDefault && opts.productDefault.rules) || [];
    } else {
      coverage = jurisdiction.status === 'verified' ? 'verified' : 'draft';
      ruleSource = jurisdiction.rules;
    }

    var rule = selectRule(ruleSource, podConfig);

    var permits = {};
    var citations = [];
    var downgraded = [];
    var notes = [];

    if (!rule) {
      /* No rule matched: never guess. Everything is "depends" + confirm. */
      PERMIT_TYPES.forEach(function (p) {
        permits[p] = 'depends';
      });
      notes.push('No specific rule matched this configuration — confirm with the office.');
    } else {
      var cited = coverage === 'product_default' ? true : citationComplete(rule.citation);
      PERMIT_TYPES.forEach(function (p) {
        var outcome = (rule.result && rule.result[p]) || 'depends';
        if (POSTURES.indexOf(outcome) === -1) outcome = 'depends';
        if (!cited && outcome !== 'not_applicable' && outcome !== 'depends') {
          downgraded.push({ permit: p, from: outcome, to: 'depends' });
          outcome = 'depends';
        }
        permits[p] = outcome;
      });
      if (!cited) {
        notes.push(
          'This rule’s citation is not yet verified, so its determinations are shown as ' +
          '"depends" — confirm with the office.'
        );
      }
      if (rule.rationale) notes.push(rule.rationale);
      if (cited && coverage !== 'product_default') {
        citations.push({
          rule_id: rule.id,
          permits: PERMIT_TYPES.filter(function (p) {
            return permits[p] !== 'not_applicable';
          }),
          code_section: rule.citation.code_section,
          title: rule.citation.title,
          url: rule.citation.url,
          snippet: rule.citation.snippet || '',
          confidence: rule.confidence || 'low',
        });
      }
    }

    if (podConfig.on_trailer) notes.push(TRAILER_NOTE);

    var anyPermitLikely = PERMIT_TYPES.some(function (p) {
      return permits[p] === 'likely_required' || permits[p] === 'depends';
    });

    var verifiedAsOf =
      coverage !== 'product_default' && jurisdiction.last_verified && !isVerifyPlaceholder(jurisdiction.last_verified)
        ? jurisdiction.last_verified
        : null;

    var jurisdictionLabel;
    if (coverage === 'product_default') {
      jurisdictionLabel = 'Your area (not yet researched)';
    } else {
      jurisdictionLabel =
        jurisdiction.name +
        (jurisdiction.county ? ', ' + jurisdiction.county + ' County' : '') +
        (jurisdiction.state ? ', ' + jurisdiction.state : '');
    }

    return {
      jurisdiction: jurisdictionLabel,
      coverage: coverage,
      verified_as_of: verifiedAsOf,
      config_summary: configSummary(podConfig),
      permits: permits,
      citations: citations,
      downgraded: downgraded,
      energy_compliance: energyCompliance(coverage === 'product_default' ? null : jurisdiction),
      foundation_requirement: foundationRequirement(
        podConfig,
        permits.building_permit,
        coverage === 'product_default' ? null : jurisdiction
      ),
      construction_requirements: buildConstructionRequirements(
        coverage === 'product_default' ? null : jurisdiction,
        coverage
      ),
      notes: notes,
      next_step: buildNextStep(jurisdiction, coverage),
      config_lock_note: anyPermitLikely ? CONFIG_LOCK_NOTE : null,
      package_cta: anyPermitLikely,
      disclaimer: DISCLAIMER_TEMPLATE.replace('[DATE]', verifiedAsOf || today),
      hoa_note:
        (coverage !== 'product_default' && jurisdiction.hoa_note) ||
        'An HOA may impose separate requirements regardless of city rules.',
      zoning_note: (coverage !== 'product_default' && jurisdiction.zoning_note) || '',
    };
  }

  return {
    evaluate: evaluate,
    selectRule: selectRule,
    ruleMatches: ruleMatches,
    ruleSpecificity: ruleSpecificity,
    citationComplete: citationComplete,
    resolveFootprint: resolveFootprint,
    POSTURES: POSTURES,
    PERMIT_TYPES: PERMIT_TYPES,
    MODEL_FOOTPRINTS: MODEL_FOOTPRINTS,
  };
});
