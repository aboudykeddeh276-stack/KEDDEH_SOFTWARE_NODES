function kexTelemetryDispatch(e) {
  var props = PropertiesService.getScriptProperties();
  var endpoint = props.getProperty('KEX_INGRESS_URL');
  var secret = props.getProperty('KEX_INGRESS_SECRET');
  if (!endpoint || !secret) throw new Error('KEX_DISPATCH_CONFIGURATION_REQUIRED');
  var r = e && e.range;
  if (!r) throw new Error('SHEET_EVENT_RANGE_REQUIRED');
  var payload = {
    source: 'google-sheet',
    sheet_id: r.getSheet().getParent().getId(),
    event_id: Utilities.getUuid(),
    observed_at: new Date().toISOString(),
    data_class: 'EVENT',
    delta: {sheet:r.getSheet().getName(),a1:r.getA1Notation(),value:r.getValue()},
    node_id: 'sheet:' + r.getSheet().getSheetId(),
    capability: 'telemetry.apply'
  };
  var response = UrlFetchApp.fetch(endpoint + '/telemetry', {
    method:'post',contentType:'application/json',
    headers:{'X-KEX-Secret':secret},payload:JSON.stringify(payload),muteHttpExceptions:true
  });
  if (response.getResponseCode() !== 202) throw new Error('KEX_DISPATCH_FAILED:' + response.getResponseCode() + ':' + response.getContentText());
  return JSON.parse(response.getContentText());
}
