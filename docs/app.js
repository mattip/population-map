/* Israel population by locality, 2023 — static map with area selection.
   No build step and no plugins: Leaflet core plus the selection tools below. */
'use strict';

var GROUPS = [
  { key: 'jews',    en: 'Jews & others', he: 'יהודים ואחרים' },
  { key: 'arabs',   en: 'Arabs',         he: 'ערבים' },
  { key: 'foreign', en: 'Foreign',       he: 'זרים' }
];

var fmt = new Intl.NumberFormat('en-US');

var colorCache = {};

function cssVar(name) {
  if (!(name in colorCache)) {
    colorCache[name] = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  return colorCache[name];
}

function pct(part, whole) {
  if (!whole) return '0%';
  var p = (part / whole) * 100;
  return (p >= 10 ? p.toFixed(0) : p >= 1 ? p.toFixed(1) : p > 0 ? '<1' : '0') + '%';
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

/* ------------------------------------------------------------------ map */

var map = L.map('map', {
  preferCanvas: true,
  zoomControl: true,
  attributionControl: true,
  minZoom: 6,
  maxZoom: 15
}).setView([31.45, 34.95], 8);

map.attributionControl.setPrefix('');

// Esri's gray canvas: a quiet basemap, keyless, base and labels as separate
// layers so the place names can sit above the data dots.
var ESRI = 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/';
var TILES = {
  light: ESRI + 'World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  dark: ESRI + 'World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
};
var LABELS = {
  light: ESRI + 'World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
  dark: ESRI + 'World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}'
};
var ATTR = 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, ' +
           '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

var darkMedia = window.matchMedia('(prefers-color-scheme: dark)');

// Place names ride in their own pane above the data dots (overlayPane is 400),
// so the map stays readable under a crowd of circles.
map.createPane('labels').style.zIndex = 450;
map.getPane('labels').style.pointerEvents = 'none';

var baseTiles, labelTiles;

function paintBasemap() {
  var mode = darkMedia.matches ? 'dark' : 'light';
  if (baseTiles) map.removeLayer(baseTiles);
  if (labelTiles) map.removeLayer(labelTiles);
  baseTiles = L.tileLayer(TILES[mode], { attribution: ATTR, maxZoom: 16 }).addTo(map);
  labelTiles = L.tileLayer(LABELS[mode], { maxZoom: 16, pane: 'labels' }).addTo(map);
}
paintBasemap();
darkMedia.addEventListener('change', function () {
  colorCache = {};
  paintBasemap();
  restyleShape();
  if (places.length) render();
});

/* ----------------------------------------------------------------- data */

var places = [];      // {lat, lon, total, jews, arabs, foreign, name_he, ...}
var markers = [];     // one L.circleMarker per place, same order
var national = null;
var maxPop = 1;
var countryBounds = null;

function start(data) {
  places = data.places.map(function (row) {
    var p = {};
    data.fields.forEach(function (f, i) { p[f] = row[i]; });
    return p;
  });
  maxPop = places.reduce(function (m, p) { return Math.max(m, p.total); }, 1);
  national = summarize(places);

  var layer = L.layerGroup().addTo(map);
  places.forEach(function (p) {
    var m = L.circleMarker([p.lat, p.lon], markerStyle(p, true));
    m.setRadius(radius(p.total));
    m.bindTooltip(tooltip.bind(null, p), { direction: 'top', offset: [0, -2], opacity: 1 });
    m.on('click', function () { flyTo(p); });
    m.addTo(layer);
    markers.push(m);
  });

  countryBounds = L.latLngBounds(places.map(function (p) { return [p.lat, p.lon]; }));
  renderLegend();
  applyHash(location.hash);   // calls render(), and sets the view if one was shared
  map.on('moveend', writeHash);
  window.addEventListener('hashchange', function () {
    if (location.hash !== lastHash) applyHash(location.hash);
  });
}

function dominant(p) {
  if (p.arabs > p.jews && p.arabs > p.foreign) return 'arabs';
  if (p.foreign > p.jews && p.foreign > p.arabs) return 'foreign';
  return 'jews';
}

function markerStyle(p, selected) {
  var color = cssVar('--series-' + dominant(p));
  return {
    fillColor: color,
    fillOpacity: selected ? 0.78 : 0.12,
    color: cssVar('--surface-1'),
    weight: selected ? 1.2 : 0,
    opacity: selected ? 0.9 : 0
  };
}

function radius(total) {
  var base = 2 + 16 * Math.sqrt(total / maxPop);
  var factor = Math.min(Math.pow(1.22, map.getZoom() - 8), 2.2);
  return Math.max(2.2, base * factor);
}

map.on('zoomend', function () {
  markers.forEach(function (m, i) { m.setRadius(radius(places[i].total)); });
  // A zoom changes how big the selection looks, so whether the centre handle
  // fits can change with it.
  if (selection && !tool) drawHandles();
});

function tooltip(p) {
  var rows = GROUPS.map(function (g) {
    if (!p[g.key]) return '';
    return '<div class="tip-row"><span class="chip ' + g.key + '"></span>' +
           '<span>' + g.en + '</span>' +
           '<span class="tip-total">' + fmt.format(p[g.key]) + '</span></div>';
  }).join('');
  return '<div class="tip-name"><bdi>' + esc(p.name_he) + '</bdi></div>' +
         '<div class="tip-sub">' + esc(p.name_en) + ' &middot; ' + esc(p.subdistrict) + '</div>' +
         '<div class="tip-row"><strong class="tip-total">' + fmt.format(p.total) + '</strong>' +
         '<span class="tip-sub">total</span></div>' + rows;
}

function flyTo(p) {
  map.flyTo([p.lat, p.lon], Math.max(map.getZoom(), 12), { duration: 0.6 });
}

/* ------------------------------------------------------------ selection */

var selection = null;   // {kind:'rect'|'poly', bounds, ring?}
var shape = null;       // the L.Rectangle / L.Polygon showing it

function shapeStyle(preview) {
  return {
    color: cssVar('--select-ink'),
    weight: 1.5,
    dashArray: preview ? '4 4' : null,
    // While dragging, a wash shows what is being enclosed; once committed the
    // dimmed dots outside carry that job and a fill would only tint the map.
    fill: preview,
    fillColor: cssVar('--select-ink'),
    fillOpacity: 0.06,
    interactive: false
  };
}

function restyleShape() {
  if (shape) shape.setStyle(shapeStyle(false));
}

function inPolygon(lat, lon, ring) {
  var inside = false;
  for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    var yi = ring[i][0], xi = ring[i][1];
    var yj = ring[j][0], xj = ring[j][1];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function contains(p) {
  if (!selection) return true;
  if (!selection.bounds.contains([p.lat, p.lon])) return false;
  return selection.kind === 'rect' || inPolygon(p.lat, p.lon, selection.ring);
}

function setSelection(sel, layer) {
  if (shape) map.removeLayer(shape);
  shape = layer || null;
  if (shape) shape.setStyle(shapeStyle(false)).addTo(map);
  selection = sel;
  render();
  drawHandles();
  writeHash();
}

function clearSelection() {
  setSelection(null, null);
}

/* Editing an existing selection: every corner of the shape gets a drag handle,
   and one handle at the centre slides the whole shape without reshaping it.
   Leaflet markers are draggable with mouse and touch alike, so the handles need
   no pointer plumbing of their own. */

var handles = [];        // vertex handles, in ring order
var moveHandle = null;
var dragFrom = null;     // geometry captured at the start of a centre drag

function clearHandles() {
  handles.forEach(function (h) { map.removeLayer(h); });
  handles = [];
  if (moveHandle) map.removeLayer(moveHandle);
  moveHandle = null;
}

function handleIcon(kind, size) {
  return L.divIcon({
    className: 'sel-handle sel-handle-' + kind,
    html: '<i></i>',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

function rectCorners(bounds) {
  return [[bounds.getSouth(), bounds.getWest()], [bounds.getNorth(), bounds.getWest()],
          [bounds.getNorth(), bounds.getEast()], [bounds.getSouth(), bounds.getEast()]];
}

function selectionPoints() {
  return selection.kind === 'rect' ? rectCorners(selection.bounds) : selection.ring;
}

/* How big the selection currently looks, in screen pixels. */
function shapePixelSize() {
  var nw = map.latLngToContainerPoint(selection.bounds.getNorthWest());
  var se = map.latLngToContainerPoint(selection.bounds.getSouthEast());
  return [Math.abs(se.x - nw.x), Math.abs(se.y - nw.y)];
}

function drawHandles() {
  clearHandles();
  document.getElementById('edit-hint').hidden = !selection;
  if (!selection || tool) return;

  selectionPoints().forEach(function (pt, i) {
    var h = L.marker(pt, {
      icon: handleIcon('vertex', 22),
      draggable: true,
      keyboard: false,
      zIndexOffset: 1000,
      title: selection.kind === 'rect' ? 'Drag to resize' : 'Drag to reshape'
    });
    h.on('drag', function () { dragVertex(i, h.getLatLng()); });
    h.on('dragend', commitEdit);
    h.addTo(map);
    handles.push(h);
  });

  // The centre handle is wide enough to bury the corner handles of a small
  // shape, so it only appears once there is room for both.
  var size = shapePixelSize();
  if (Math.min(size[0], size[1]) < 44) return;

  moveHandle = L.marker(selection.bounds.getCenter(), {
    icon: handleIcon('move', 30),
    draggable: true,
    keyboard: false,
    zIndexOffset: 1001,
    title: 'Drag to move the whole selection'
  });
  moveHandle.on('dragstart', function () {
    dragFrom = {
      center: moveHandle.getLatLng(),
      ring: selection.kind === 'rect' ? null : selection.ring.map(function (p) { return p.slice(); }),
      bounds: selection.bounds
    };
  });
  moveHandle.on('drag', function () { dragWhole(moveHandle.getLatLng()); });
  moveHandle.on('dragend', commitEdit);
  moveHandle.addTo(map);
}

function dragVertex(i, latlng) {
  if (selection.kind === 'rect') {
    var opposite = rectCorners(selection.bounds)[(i + 2) % 4];
    var next = L.latLngBounds(opposite, latlng);
    // Refuse to collapse the box: at zero area every handle lands on the same
    // spot and there is nothing left to grab to open it up again.
    var was = selection.bounds;
    selection.bounds = next;
    var size = shapePixelSize();
    if (size[0] < 12 || size[1] < 12) {
      selection.bounds = was;
      return;
    }
    shape.setBounds(selection.bounds);
  } else {
    selection.ring[i] = [latlng.lat, latlng.lng];
    selection.bounds = L.latLngBounds(selection.ring);
    shape.setLatLngs(selection.ring);
  }
  syncHandles(i);
  render(true);
}

function dragWhole(latlng) {
  if (!dragFrom) return;
  var dLat = latlng.lat - dragFrom.center.lat;
  var dLon = latlng.lng - dragFrom.center.lng;

  if (selection.kind === 'rect') {
    var b = dragFrom.bounds;
    selection.bounds = L.latLngBounds(
      [b.getSouth() + dLat, b.getWest() + dLon],
      [b.getNorth() + dLat, b.getEast() + dLon]);
    shape.setBounds(selection.bounds);
  } else {
    selection.ring = dragFrom.ring.map(function (p) { return [p[0] + dLat, p[1] + dLon]; });
    selection.bounds = L.latLngBounds(selection.ring);
    shape.setLatLngs(selection.ring);
  }
  syncHandles(-1);
  render(true);
}

/* Reposition the handles the user is not currently holding; moving the dragged
   one out from under the pointer would fight Leaflet's own drag. */
function syncHandles(held) {
  var pts = selectionPoints();
  handles.forEach(function (h, i) {
    if (i !== held) h.setLatLng(pts[i]);
  });
  if (moveHandle && held >= 0) moveHandle.setLatLng(selection.bounds.getCenter());
}

function commitEdit() {
  dragFrom = null;
  render();
  drawHandles();
  writeHash();
}

/* Drawing. Pointer events (not Leaflet's mouse events) so a finger drag
   traces a lasso the same way a mouse does. */

var container = map.getContainer();
var tool = null;
var drag = null;    // {points: [[lat,lng], ...], ghost: layer}
var polyDraft = null;

function containerLatLng(ev) {
  var r = container.getBoundingClientRect();
  return map.containerPointToLatLng(L.point(ev.clientX - r.left, ev.clientY - r.top));
}

function setTool(next) {
  cancelDraft();
  tool = tool === next ? null : next;
  if (tool) clearHandles();
  else drawHandles();

  document.querySelectorAll('.tool[data-tool]').forEach(function (b) {
    b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
  });
  container.classList.toggle('drawing', !!tool);
  container.style.touchAction = tool && tool !== 'poly' ? 'none' : '';

  if (tool === 'rect' || tool === 'lasso') {
    map.dragging.disable();
    map.boxZoom.disable();
  } else {
    map.dragging.enable();
    map.boxZoom.enable();
  }
  if (tool === 'poly') map.doubleClickZoom.disable();
  else map.doubleClickZoom.enable();

  hint(tool === 'rect' ? 'Drag to draw a rectangle' :
       tool === 'lasso' ? 'Drag to trace an outline' :
       tool === 'poly' ? 'Click to add corners · double-click or Enter to close · Esc to cancel' : '');
}

function hint(text) {
  var el = document.getElementById('hint');
  el.textContent = text;
  el.hidden = !text;
}

function cancelDraft() {
  if (drag) {
    if (drag.ghost) map.removeLayer(drag.ghost);
    drag = null;
  }
  if (polyDraft) {
    map.removeLayer(polyDraft.line);
    if (polyDraft.marks) polyDraft.marks.forEach(function (m) { map.removeLayer(m); });
    polyDraft = null;
  }
}

container.addEventListener('pointerdown', function (ev) {
  if (tool !== 'rect' && tool !== 'lasso') return;
  if (ev.button !== undefined && ev.button !== 0) return;
  if (ev.target.closest('.leaflet-control')) return;
  ev.preventDefault();
  container.setPointerCapture(ev.pointerId);
  var at = containerLatLng(ev);
  drag = { id: ev.pointerId, origin: at, points: [[at.lat, at.lng]], ghost: null };
});

container.addEventListener('pointermove', function (ev) {
  if (!drag || ev.pointerId !== drag.id) return;
  ev.preventDefault();
  var at = containerLatLng(ev);

  if (tool === 'rect') {
    var b = L.latLngBounds(drag.origin, at);
    if (!drag.ghost) drag.ghost = L.rectangle(b, shapeStyle(true)).addTo(map);
    else drag.ghost.setBounds(b);
  } else {
    var last = drag.points[drag.points.length - 1];
    if (map.latLngToContainerPoint(at).distanceTo(map.latLngToContainerPoint(L.latLng(last))) < 4) return;
    drag.points.push([at.lat, at.lng]);
    if (!drag.ghost) drag.ghost = L.polyline(drag.points, shapeStyle(true)).addTo(map);
    else drag.ghost.setLatLngs(drag.points);
  }
});

function finishDrag(ev) {
  if (!drag || (ev && ev.pointerId !== drag.id)) return;
  var at = ev ? containerLatLng(ev) : null;
  var points = drag.points;
  var wasRect = tool === 'rect';
  cancelDraft();

  if (wasRect) {
    var b = L.latLngBounds(points[0], at || points[0]);
    var px = map.latLngToContainerPoint(b.getNorthWest()).distanceTo(map.latLngToContainerPoint(b.getSouthEast()));
    if (px < 8) return;                     // a stray click, not a rectangle
    setSelection({ kind: 'rect', bounds: b }, L.rectangle(b));
  } else {
    var ring = simplifyRing(points);
    if (ring.length < 3) return;
    setSelection({ kind: 'poly', ring: ring, bounds: L.latLngBounds(ring) }, L.polygon(ring));
  }
  setTool(null);
}

container.addEventListener('pointerup', finishDrag);
container.addEventListener('pointercancel', function () { cancelDraft(); });

map.on('click', function (e) {
  if (tool !== 'poly') return;
  var pt = [e.latlng.lat, e.latlng.lng];
  if (!polyDraft) {
    polyDraft = { points: [pt], marks: [], line: L.polyline([pt], shapeStyle(true)).addTo(map) };
  } else {
    var first = polyDraft.points[0];
    var nearFirst = polyDraft.points.length >= 3 &&
      map.latLngToContainerPoint(e.latlng).distanceTo(map.latLngToContainerPoint(L.latLng(first))) < 12;
    if (nearFirst) { closePolygon(); return; }
    polyDraft.points.push(pt);
    polyDraft.line.setLatLngs(polyDraft.points);
  }
  polyDraft.marks.push(
    L.circleMarker(pt, {
      radius: 3.5, color: cssVar('--select-ink'), weight: 1.5,
      fillColor: cssVar('--surface-1'), fillOpacity: 1, interactive: false
    }).addTo(map)
  );
  hint(polyDraft.points.length < 3
    ? 'Click to add corners · ' + polyDraft.points.length + ' so far'
    : 'Double-click, press Enter, or click the first corner to close');
});

map.on('dblclick', function () { if (tool === 'poly') closePolygon(); });

/* A freehand trace lands a point every few pixels; thinning it to the corners
   that matter keeps the shared URL short and changes the shape sub-pixel. */
function simplifyRing(ring) {
  var pts = ring.map(function (ll) { return map.latLngToLayerPoint(L.latLng(ll)); });
  return L.LineUtil.simplify(pts, 2).map(function (pt) {
    var ll = map.layerPointToLatLng(pt);
    return [+ll.lat.toFixed(5), +ll.lng.toFixed(5)];
  });
}

function closePolygon() {
  if (!polyDraft || polyDraft.points.length < 3) return;
  var ring = polyDraft.points.slice();
  cancelDraft();
  setSelection({ kind: 'poly', ring: ring, bounds: L.latLngBounds(ring) }, L.polygon(ring));
  setTool(null);
}

/* ------------------------------------------------------------ permalink */

/* The selection travels in the URL hash. Coordinates are varint-packed as
   deltas at 1e-5 degrees (about a metre) in a URL-safe alphabet, the same
   trick as encoded polylines, so even a 100-point lasso stays a short link. */

var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
var B64_INDEX = {};
for (var bi = 0; bi < B64.length; bi++) B64_INDEX[B64[bi]] = bi;

function encodePath(ring) {
  var out = '';
  var lat = 0;
  var lon = 0;
  ring.forEach(function (pt) {
    var y = Math.round(pt[0] * 1e5);
    var x = Math.round(pt[1] * 1e5);
    out += encodeSigned(y - lat) + encodeSigned(x - lon);
    lat = y;
    lon = x;
  });
  return out;
}

function encodeSigned(value) {
  var v = value < 0 ? ~(value << 1) : value << 1;
  var out = '';
  while (v >= 0x20) {
    out += B64[(v & 0x1f) | 0x20];
    v >>>= 5;
  }
  return out + B64[v];
}

function decodePath(str) {
  var ring = [];
  var i = 0;
  var lat = 0;
  var lon = 0;
  while (i < str.length) {
    var pair = [0, 0];
    for (var k = 0; k < 2; k++) {
      var shift = 0;
      var result = 0;
      var chunk;
      do {
        chunk = B64_INDEX[str[i++]];
        if (chunk === undefined) throw new Error('bad path');
        result |= (chunk & 0x1f) << shift;
        shift += 5;
      } while (chunk & 0x20);
      pair[k] = result & 1 ? ~(result >> 1) : result >> 1;
    }
    lat += pair[0];
    lon += pair[1];
    ring.push([lat / 1e5, lon / 1e5]);
  }
  return ring;
}

var lastHash = '';

function writeHash() {
  if (!places.length) return;
  var c = map.getCenter();
  var parts = ['v=' + map.getZoom() + '/' + c.lat.toFixed(5) + '/' + c.lng.toFixed(5)];
  if (selection) {
    var ring = selection.kind === 'rect'
      ? [[selection.bounds.getSouth(), selection.bounds.getWest()],
         [selection.bounds.getNorth(), selection.bounds.getEast()]]
      : selection.ring;
    parts.push((selection.kind === 'rect' ? 'r=' : 'p=') + encodePath(ring));
  }
  lastHash = '#' + parts.join('&');
  try {
    history.replaceState(null, '', location.pathname + location.search + lastHash);
  } catch (err) {
    location.hash = lastHash;   // some browsers refuse replaceState on file://
  }
}

function applyHash(hash) {
  lastHash = hash;
  var query = {};
  hash.replace(/^#/, '').split('&').forEach(function (kv) {
    var eq = kv.indexOf('=');
    if (eq > 0) query[kv.slice(0, eq)] = kv.slice(eq + 1);
  });

  var restored = null;
  try {
    if (query.r) {
      var corners = decodePath(query.r);
      if (corners.length === 2) restored = { kind: 'rect', bounds: L.latLngBounds(corners) };
    } else if (query.p) {
      var ring = decodePath(query.p);
      if (ring.length >= 3) restored = { kind: 'poly', ring: ring, bounds: L.latLngBounds(ring) };
    }
  } catch (err) {
    restored = null;                       // a mangled link just shows everything
  }

  if (shape) map.removeLayer(shape);
  shape = null;
  if (restored) {
    shape = (restored.kind === 'rect' ? L.rectangle(restored.bounds) : L.polygon(restored.ring))
      .setStyle(shapeStyle(false)).addTo(map);
  }
  selection = restored;
  drawHandles();

  var view = /^(\d+)\/(-?[\d.]+)\/(-?[\d.]+)$/.exec(query.v || '');
  if (view) map.setView([+view[2], +view[3]], +view[1]);
  else if (restored) map.fitBounds(restored.bounds, { padding: [24, 24] });
  else if (countryBounds) map.fitBounds(countryBounds, { padding: [20, 20] });

  render();
}

function copyLink() {
  writeHash();
  var url = location.href;
  var button = document.getElementById('permalink');
  var said = function (text) {
    button.textContent = text;
    clearTimeout(copyLink.timer);
    copyLink.timer = setTimeout(function () { button.textContent = 'Copy link'; }, 2000);
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(url).then(function () { said('Copied'); },
                                            function () { said('Press Ctrl+C'); fallbackCopy(url, said); });
  } else {
    // file:// and plain http are not secure contexts, so the clipboard API is
    // unavailable there; select the text instead and let the user copy it.
    fallbackCopy(url, said);
  }
}

function fallbackCopy(url, said) {
  var box = document.createElement('textarea');
  box.value = url;
  box.setAttribute('readonly', '');
  box.style.cssText = 'position:fixed;top:50%;left:50%;width:1px;height:1px;opacity:0';
  document.body.appendChild(box);
  box.select();
  var ok = false;
  try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
  document.body.removeChild(box);
  said(ok ? 'Copied' : 'Copy from the address bar');
}

/* --------------------------------------------------------------- totals */

function summarize(list) {
  var out = { count: list.length, total: 0, jews: 0, arabs: 0, foreign: 0 };
  list.forEach(function (p) {
    out.total += p.total;
    out.jews += p.jews;
    out.arabs += p.arabs;
    out.foreign += p.foreign;
  });
  return out;
}

var selected = [];

function render(skipList) {
  selected = places.filter(contains);
  var sum = summarize(selected);

  markers.forEach(function (m, i) {
    var want = !selection || contains(places[i]);
    m.setStyle(markerStyle(places[i], want));
  });

  document.getElementById('scope-label').textContent =
    selection ? (selection.kind === 'rect' ? 'Inside the rectangle' : 'Inside the traced area')
              : 'All localities, whole country';
  document.getElementById('zoom-sel').hidden = !selection;

  document.getElementById('total-value').textContent = fmt.format(sum.total);
  document.getElementById('place-count').textContent =
    sum.count === 1 ? '1 locality' : fmt.format(sum.count) + ' localities';
  document.getElementById('total-share').textContent = selection && national
    ? pct(sum.total, national.total) + ' of the ' + fmt.format(national.total) + ' nationwide'
    : '';

  renderStack(sum);
  renderBreakdown(sum);
  if (!skipList) renderList();
}

function renderStack(sum) {
  var stack = document.getElementById('stack');
  stack.className = 'stack' + (sum.total ? '' : ' empty');
  stack.innerHTML = !sum.total ? '' : GROUPS.map(function (g) {
    var share = sum[g.key] / sum.total;
    if (!sum[g.key]) return '';
    var label = share >= 0.09 ? '<span>' + pct(sum[g.key], sum.total) + '</span>' : '';
    return '<div class="seg ' + g.key + '" style="flex: ' + share.toFixed(5) + ' 1 0">' + label + '</div>';
  }).join('');

  document.getElementById('stack-desc').textContent = GROUPS.map(function (g) {
    return g.en + ' ' + fmt.format(sum[g.key]) + ' (' + pct(sum[g.key], sum.total) + ')';
  }).join(', ');
}

function renderBreakdown(sum) {
  document.getElementById('breakdown').innerHTML = GROUPS.map(function (g) {
    return '<tr>' +
      '<td><span class="label"><span class="chip ' + g.key + '"></span>' + g.en +
      ' <bdi class="he">' + g.he + '</bdi></span></td>' +
      '<td>' + fmt.format(sum[g.key]) + '</td>' +
      '<td class="share">' + pct(sum[g.key], sum.total) + '</td></tr>';
  }).join('') +
    '<tr><td><span class="label"><strong>Total</strong> <bdi class="he">סך הכל</bdi></span></td>' +
    '<td><strong>' + fmt.format(sum.total) + '</strong></td><td class="share">100%</td></tr>';
}

var LIST_CAP = 250;   // keep the DOM light; the CSV carries every row

function renderList() {
  document.getElementById('list-count').textContent =
    selected.length ? '(' + fmt.format(selected.length) + ', largest first)' : '';

  var note = document.getElementById('list-note');
  note.hidden = selected.length <= LIST_CAP;
  note.textContent = note.hidden ? '' :
    'Showing the largest ' + LIST_CAP + ' of ' + fmt.format(selected.length) +
    ' localities. The totals above and the CSV cover all of them.';

  var body = document.getElementById('list');
  if (!selected.length) {
    body.innerHTML = '<tr class="empty-row"><td colspan="5">No localities inside the selection</td></tr>';
    return;
  }
  body.innerHTML = selected.slice(0, LIST_CAP).map(function (p, i) {
    return '<tr data-i="' + i + '">' +
      '<td class="name" title="' + esc(p.name_he) + ' — ' + esc(p.name_en) + ', ' + esc(p.subdistrict) + '">' +
      '<bdi>' + esc(p.name_he) + '</bdi><span class="en">' + esc(p.name_en) + '</span></td>' +
      '<td class="num">' + fmt.format(p.total) + '</td>' +
      '<td class="num">' + fmt.format(p.jews) + '</td>' +
      '<td class="num">' + fmt.format(p.arabs) + '</td>' +
      '<td class="num">' + fmt.format(p.foreign) + '</td></tr>';
  }).join('');
}

document.getElementById('list').addEventListener('click', function (ev) {
  var tr = ev.target.closest('tr[data-i]');
  if (tr) flyTo(selected[+tr.dataset.i]);
});

function renderLegend() {
  document.getElementById('legend-colors').innerHTML =
    '<span class="legend-text" style="margin:0">Largest group:</span>' +
    GROUPS.map(function (g) {
      return '<span class="legend-item"><span class="chip ' + g.key + '"></span>' + g.en + '</span>';
    }).join('');
}

/* ---------------------------------------------------------------- chrome */

document.querySelectorAll('.tool[data-tool]').forEach(function (b) {
  b.addEventListener('click', function () { setTool(b.dataset.tool); });
});

document.getElementById('clear').addEventListener('click', function () {
  setTool(null);
  clearSelection();
});

document.getElementById('permalink').addEventListener('click', copyLink);

document.getElementById('zoom-sel').addEventListener('click', function () {
  if (selection) map.fitBounds(selection.bounds, { padding: [24, 24] });
});

var CSV_COLUMNS = [
  ['name_he', 'name_he'], ['name_en', 'name_en'], ['code', 'code'],
  ['district', 'district'], ['subdistrict', 'subdistrict'],
  ['lat', 'lat'], ['lon', 'lon'],
  ['total_2023', 'total'], ['jews_and_others', 'jews'],
  ['arabs', 'arabs'], ['foreign', 'foreign']
];

document.getElementById('csv').addEventListener('click', function () {
  var head = CSV_COLUMNS.map(function (c) { return c[0]; });
  var rows = selected.map(function (p) {
    return CSV_COLUMNS.map(function (c) {
      var v = p[c[1]];
      return /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v;
    }).join(',');
  });
  // BOM so spreadsheets read the Hebrew names as UTF-8.
  var blob = new Blob(['﻿' + head.join(',') + '\n' + rows.join('\n')],
                      { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'population-selection.csv';
  a.click();
  URL.revokeObjectURL(a.href);
});

document.addEventListener('keydown', function (ev) {
  if (ev.target.matches('input, textarea')) return;
  if (ev.key === 'Escape') {
    if (polyDraft || drag) { cancelDraft(); hint(''); }
    else if (tool) setTool(null);
    else clearSelection();
  } else if (ev.key === 'Enter' && polyDraft) {
    closePolygon();
  } else if (ev.key === 'r' || ev.key === 'R') {
    setTool('rect');
  } else if (ev.key === 'l' || ev.key === 'L') {
    setTool('lasso');
  } else if (ev.key === 'p' || ev.key === 'P') {
    setTool('poly');
  }
});

/* ----------------------------------------------------------------- boot */

/* Last, so every `var` above (the permalink codec tables in particular) is
   initialised before start() runs — function declarations hoist, assignments
   do not. */

function loadFailed(err) {
  document.getElementById('total-value').textContent = 'no data';
  document.getElementById('scope-label').textContent = 'could not load the data — ' + err.message;
}

if (window.POPULATION_DATA) {
  start(window.POPULATION_DATA);
} else {
  // data.js missing (someone rebuilt only the JSON) — fall back to fetching it.
  // That works over http, but not over file://, where browsers refuse fetch().
  fetch('data.json')
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(start)
    .catch(loadFailed);
}
