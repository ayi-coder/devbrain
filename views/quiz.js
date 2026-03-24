// Stub -- full implementation in Plan 5.
export function renderQuiz(container, params = {}, dbName = 'devbrain') {
  const preloadNote = params.preload
    ? '<div style="margin-top:12px;font-size:12px;color:#3e4451">Preloading: ' + params.preload + '</div>'
    : '';
  container.innerHTML =
    '<div style="padding:60px 0;text-align:center;color:#4b5263">' +
    '<div style="font-size:32px;margin-bottom:12px">&#x26A1;</div>' +
    '<div style="font-size:15px;font-weight:600;color:#5c6370;margin-bottom:6px">Coming in Plan 5</div>' +
    '<div style="font-size:13px">Session builder and SRS recommendations</div>' +
    preloadNote +
    '</div>';
}
