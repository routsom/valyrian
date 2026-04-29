/**
 * Valyrian Edge - Dashboard HTML
 * Single-file embedded dashboard. Uses SSE for real-time updates.
 * No build step required — pure HTML/CSS/JS inlined here.
 */

export function getDashboardHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Valyrian Edge Dashboard</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0d1117; color: #e6edf3; font-family: 'Segoe UI', system-ui, sans-serif; padding: 24px; }
  h1 { font-size: 1.5rem; color: #f78166; margin-bottom: 4px; }
  .subtitle { color: #8b949e; font-size: 0.85rem; margin-bottom: 24px; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
  .dot.live { background: #3fb950; animation: pulse 2s infinite; }
  .dot.error { background: #f85149; }
  @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  th { text-align: left; padding: 10px 14px; color: #8b949e; border-bottom: 1px solid #21262d; font-weight: 500; }
  td { padding: 10px 14px; border-bottom: 1px solid #161b22; vertical-align: middle; }
  tr:hover td { background: #161b22; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
  .badge.reconnaissance { background: #388bfd22; color: #388bfd; }
  .badge.analysis { background: #d2992244; color: #e3b341; }
  .badge.reporting { background: #bc8cff22; color: #bc8cff; }
  .badge.completed { background: #3fb95022; color: #3fb950; }
  .badge.failed { background: #f8514922; color: #f85149; }
  .badge.unknown { background: #8b949e22; color: #8b949e; }
  .bar { background: #21262d; border-radius: 4px; height: 6px; width: 100px; overflow: hidden; display: inline-block; vertical-align: middle; }
  .fill { height: 100%; background: #388bfd; border-radius: 4px; transition: width 0.4s; }
  .empty { text-align: center; padding: 60px; color: #8b949e; }
  #ts { color: #8b949e; font-size: 0.75rem; margin-top: 16px; }
  code { font-size: 0.8em; background: #161b22; padding: 1px 5px; border-radius: 4px; }
  a { color: #58a6ff; text-decoration: none; }
</style>
</head>
<body>
<h1>&#9876;&#65039; Valyrian Edge</h1>
<p class="subtitle"><span class="dot live" id="dot"></span>Live Dashboard</p>
<table>
  <thead><tr>
    <th>Session ID</th><th>Target</th><th>Started</th><th>Phase</th><th>Progress</th><th>Findings</th>
  </tr></thead>
  <tbody id="tbody">
    <tr><td colspan="6" class="empty">No sessions yet. Run <code>valyrian start -c config.yaml</code> to begin.</td></tr>
  </tbody>
</table>
<p id="ts"></p>
<script>
const src = new EventSource('/events');
const dot = document.getElementById('dot');
const tbody = document.getElementById('tbody');
const ts = document.getElementById('ts');

src.onmessage = e => {
  const state = JSON.parse(e.data);
  dot.className = 'dot live';
  ts.textContent = 'Updated: ' + new Date(state.lastUpdated).toLocaleTimeString();
  if (!state.sessions.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">No sessions yet. Run <code>valyrian start -c config.yaml</code> to begin.</td></tr>';
    return;
  }
  tbody.innerHTML = state.sessions.map(s => {
    const sid = s.sessionId.length > 14 ? s.sessionId.slice(0,14) + '&hellip;' : s.sessionId;
    return '<tr>'
      + '<td><code title="' + s.sessionId + '">' + sid + '</code></td>'
      + '<td><a href="' + s.targetUrl + '" target="_blank" rel="noopener">' + s.targetName + '</a></td>'
      + '<td>' + new Date(s.startedAt).toLocaleString() + '</td>'
      + '<td><span class="badge ' + s.phase + '">' + s.phase + '</span></td>'
      + '<td><span class="bar"><span class="fill" style="width:' + s.progress + '%"></span></span> ' + s.progress + '%</td>'
      + '<td>' + s.findingCount + '</td>'
      + '</tr>';
  }).join('');
};
src.onerror = () => { dot.className = 'dot error'; };
</script>
</body>
</html>`;
}
