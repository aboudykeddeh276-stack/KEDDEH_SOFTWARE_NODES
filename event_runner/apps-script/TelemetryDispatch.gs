function kexNextSequence_(props) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var current = Number(props.getProperty('KEX_EVENT_SEQUENCE') || '0');
    if (!Number.isSafeInteger(current) || current < 0) current = 0;
    var next = current + 1;
    props.setProperty('KEX_EVENT_SEQUENCE', String(next));
    return next;
  } finally {
    lock.releaseLock();
  }
}

function kexTelemetryDispatch(e) {
  var props = PropertiesService.getScriptProperties();
  var endpoint = props.getProperty('KEX_INGRESS_URL');
  var secret = props.getProperty('KEX_INGRESS_SECRET');
  if (!endpoint || !secret) throw new Error('KEX_DISPATCH_CONFIGURATION_REQUIRED');
  var r = e && e.range;
  if (!r) throw new Error('SHEET_EVENT_RANGE_REQUIRED');

  var observed = new Date();
  var expires = new Date(observed.getTime() + 5 * 60 * 1000);
  var payload = {
    source: 'google-sheet',
    sheet_id: r.getSheet().getParent().getId(),
    event_id: Utilities.getUuid(),
    sequence: kexNextSequence_(props),
    observed_at: observed.toISOString(),
    expires_at: expires.toISOString(),
    data_class: 'EVENT',
    delta: {sheet:r.getSheet().getName(),a1:r.getA1Notation(),value:r.getValue()},
    node_id: 'sheet:' + r.getSheet().getSheetId(),
    capability: 'telemetry.apply'
  };
  var response = UrlFetchApp.fetch(endpoint + '/telemetry', {
    method:'post',
    contentType:'application/json',
    headers:{'X-KEX-Secret':secret},
    payload:JSON.stringify(payload),
    muteHttpExceptions:true
  });
  if (response.getResponseCode() !== 202) {
    throw new Error('KEX_DISPATCH_FAILED:' + response.getResponseCode() + ':' + response.getContentText());
  }
  return JSON.parse(response.getContentText());
}
