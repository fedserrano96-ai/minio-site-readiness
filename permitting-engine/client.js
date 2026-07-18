/* Mini·O Permitting — client-facing page glue. Logic lives in engine.js/summary.js. */

(function () {
  'use strict';

  var engine = window.PermittingEngine;
  var summary = window.PermittingSummary;
  var report = window.PermittingReport;
  var data = null;
  var searchSeq = 0;
  var matchedAddress = null;
  var lastResult = null; /* { out, quick } from the latest evaluate — feeds the full-report view */

  var el = {
    address: document.getElementById('address'),
    addressSearch: document.getElementById('address-search'),
    addressStatus: document.getElementById('address-status'),
    manualPick: document.getElementById('manual-pick'),
    jurisdiction: document.getElementById('jurisdiction'),
    plumbing: document.getElementById('plumbing'),
    sleeping: document.getElementById('sleeping'),
    trailer: document.getElementById('trailer'),
    evaluate: document.getElementById('evaluate'),
    result: document.getElementById('result'),
    resultHeadline: document.getElementById('result-headline'),
    resultBrief: document.getElementById('result-brief'),
    resultCta: document.getElementById('result-cta'),
    resultDisclaimer: document.getElementById('result-disclaimer'),
    email: document.getElementById('email'),
    emailSend: document.getElementById('email-send'),
    emailStatus: document.getElementById('email-status'),
    reportView: document.getElementById('report-view'),
    reportPage: document.getElementById('report-page'),
    reportBody: document.getElementById('report-body'),
    reportBack: document.getElementById('report-back'),
    reportPrint: document.getElementById('report-print'),
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
      .catch(function () {
        setAddressStatus('Something went wrong loading our data — please refresh the page.', 'error');
      });
  }

  function populateJurisdictions() {
    var html = '';
    data.jurisdictions.forEach(function (j) {
      html += '<option value="' + esc(j.id) + '">' + esc(j.name + ', ' + j.state) + '</option>';
    });
    html += '<option value="__other">Somewhere else</option>';
    el.jurisdiction.innerHTML = html;
    /* Until an address matches, evaluate against generic product guidance —
       never silently assume the first jurisdiction in the file. */
    el.jurisdiction.value = '__other';
  }

  function currentModel() {
    var checked = document.querySelector('input[name="model"]:checked');
    return checked ? checked.value : 'twelve';
  }

  function currentPodConfig() {
    var model = currentModel();
    return {
      model: model,
      footprint_sqft: engine.MODEL_FOOTPRINTS[model],
      plumbing: el.plumbing.value,
      sleeping_intended: el.sleeping.checked,
      on_trailer: el.trailer.checked,
      electrical: 'standard',
    };
  }

  function currentJurisdiction() {
    var id = el.jurisdiction.value;
    if (!id || id === '__other') return null;
    return data.jurisdictions.find(function (j) { return j.id === id; }) || null;
  }

  function setAddressStatus(message, kind) {
    el.addressStatus.hidden = false;
    el.addressStatus.className = 'c-address-status c-address-status-' + kind;
    el.addressStatus.textContent = message;
  }

  function setEmailStatus(message, kind) {
    el.emailStatus.hidden = false;
    el.emailStatus.className = 'c-email-status c-email-status-' + kind;
    el.emailStatus.textContent = message;
  }

  function onAddressSearch() {
    if (!data) return;
    var address = el.address.value.trim();
    if (!address) {
      setAddressStatus('Type your address first.', 'error');
      return;
    }
    var seq = ++searchSeq;
    setAddressStatus('Finding your city…', 'pending');
    fetch('/.netlify/functions/geocode?address=' + encodeURIComponent(address))
      .then(function (res) {
        if (!res.ok) throw new Error('geocode ' + res.status);
        return res.json();
      })
      .then(function (json) {
        if (seq !== searchSeq) return;
        if (!json.result) {
          setAddressStatus('We couldn’t find that address — double-check it, or choose your area below.', 'error');
          el.manualPick.hidden = false;
          return;
        }
        matchedAddress = json.result.matched_address || address;
        var resolved = window.PermittingResolver.resolve(json.result, data.jurisdictions);
        if (resolved.jurisdictionId) {
          el.jurisdiction.value = resolved.jurisdictionId;
          setAddressStatus('Found it: ' + matchedAddress, 'ok');
        } else {
          el.jurisdiction.value = '__other';
          setAddressStatus(
            'Found it: ' + matchedAddress + '. We haven’t mapped your city’s exact rules yet, so you’ll see our general guidance — we confirm the specifics for every order.',
            'warn'
          );
        }
        onEvaluate();
      })
      .catch(function () {
        if (seq !== searchSeq) return;
        setAddressStatus('Address lookup isn’t responding — choose your area below instead.', 'error');
        el.manualPick.hidden = false;
      });
  }

  function render(s) {
    el.resultHeadline.textContent = s.headline;
    el.resultBrief.textContent = s.brief + ' ' + s.final_say_line;
    el.resultCta.hidden = !s.package_cta;
    el.resultDisclaimer.textContent = s.disclaimer;

    el.result.hidden = false;
    el.result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function onEvaluate() {
    if (!data) return;
    var out = engine.evaluate(currentPodConfig(), currentJurisdiction(), {
      productDefault: data.product_default,
    });
    var quick = summary.summarize(out);
    lastResult = { out: out, quick: quick };
    render(quick);
  }

  /* Show the full report in-page, print-ready (browser print → save as PDF).
     In-page rather than window.open so popup blockers can't eat it. */
  function onReportView() {
    if (!lastResult) return;
    var address = matchedAddress || el.address.value.trim() || null;
    el.reportBody.innerHTML = report.render(lastResult.out, lastResult.quick, address);
    document.body.classList.add('report-open');
    el.reportPage.hidden = false;
    window.scrollTo(0, 0);
  }

  function onReportBack() {
    el.reportPage.hidden = true;
    document.body.classList.remove('report-open');
  }

  function onEmailSend() {
    if (!data) return;
    var email = el.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailStatus('That email doesn’t look right — give it another look.', 'error');
      return;
    }
    setEmailStatus('Sending…', 'pending');
    el.emailSend.disabled = true;
    fetch('/.netlify/functions/send-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        address: matchedAddress || el.address.value.trim() || null,
        jurisdiction_id: el.jurisdiction.value || '__other',
        pod_config: currentPodConfig(),
      }),
    })
      .then(function (res) {
        return res.json().then(function (body) { return { ok: res.ok, body: body }; });
      })
      .then(function (r) {
        if (r.ok) {
          setEmailStatus('Sent! Check your inbox for the full breakdown.', 'ok');
        } else {
          setEmailStatus(r.body.error || 'We couldn’t send that just now — try again in a minute.', 'error');
        }
      })
      .catch(function () {
        setEmailStatus('We couldn’t send that just now — try again in a minute.', 'error');
      })
      .finally(function () {
        el.emailSend.disabled = false;
      });
  }

  el.addressSearch.addEventListener('click', onAddressSearch);
  el.address.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') onAddressSearch();
  });
  el.evaluate.addEventListener('click', onEvaluate);
  el.emailSend.addEventListener('click', onEmailSend);
  el.reportView.addEventListener('click', onReportView);
  el.reportBack.addEventListener('click', onReportBack);
  el.reportPrint.addEventListener('click', function () { window.print(); });
  el.jurisdiction.addEventListener('change', function () {
    matchedAddress = null;
    onEvaluate();
  });

  loadData();
})();
