/*
 * Mini·O Permitting Triage — address → jurisdiction resolution.
 * Pure functions, no DOM, no network. Runs in Node (tests, Netlify function)
 * and the browser (UI).
 *
 * parseCensusResponse(raw): trims a raw Census geocoder "geographies" response
 * down to the fields we use. Returns null when there is no usable match.
 *
 * resolve(parsed, jurisdictions): maps a parsed result to a KB entry by GEOID.
 * Correctness rule: an address inside an incorporated place with no KB entry
 * resolves to null (product-default) — it NEVER falls through to the county's
 * unincorporated entry.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PermittingResolver = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function parseCensusResponse(raw) {
    var matches = raw && raw.result && raw.result.addressMatches;
    if (!Array.isArray(matches) || matches.length === 0) return null;
    var m = matches[0] || {};
    var geos = m.geographies || {};
    var county = (geos['Counties'] || [])[0] || null;
    var place = (geos['Incorporated Places'] || [])[0] || null;
    return {
      matched_address: m.matchedAddress || '',
      coords: m.coordinates ? { lat: m.coordinates.y, lon: m.coordinates.x } : null,
      state_fips: county ? county.STATE || null : null,
      county_geoid: county ? county.GEOID || null : null,
      county_name: county ? county.BASENAME || null : null,
      place_geoid: place ? place.GEOID || null : null,
      place_name: place ? place.BASENAME || null : null,
    };
  }

  function resolve(parsed, jurisdictions) {
    var out = {
      jurisdictionId: null,
      matchedAddress: parsed ? parsed.matched_address : null,
      coords: parsed ? parsed.coords : null,
    };
    if (!parsed || !Array.isArray(jurisdictions)) return out;
    var match = null;
    if (parsed.place_geoid) {
      match = jurisdictions.find(function (j) {
        return j.geo && j.geo.place_geoid === parsed.place_geoid;
      }) || null;
      /* Unresearched incorporated place: fall to product-default, not the county. */
    } else if (parsed.county_geoid) {
      match = jurisdictions.find(function (j) {
        return j.geo && j.geo.unincorporated === true && j.geo.county_geoid === parsed.county_geoid;
      }) || null;
    }
    if (match) out.jurisdictionId = match.id;
    return out;
  }

  return {
    parseCensusResponse: parseCensusResponse,
    resolve: resolve,
  };
});
