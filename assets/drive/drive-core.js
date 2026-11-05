/*! ARAH drive core v0.1.4 - pure maths for the drive view (no DOM): route ahead of the car, next turn, camera projection of a road
 * ribbon, gauge geometry and the three drive-mode themes. Works in the browser (window.__arahDriveCore) and under node --test.
 * Local frame: x = east, y = north, metres, origin at the car. Camera frame: forward / right / up, camera 1.3 m above the road. */
(function (root) {
  'use strict';
  var R = 6378137, D2R = Math.PI / 180;

  // Equirectangular offset of p [lng,lat] from o [lng,lat] in metres: exact enough over the ~300 m the HUD looks ahead.
  function toXY(o, p) { return [(p[0] - o[0]) * D2R * R * Math.cos(o[1] * D2R), (p[1] - o[1]) * D2R * R]; }
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  function norm360(d) { d %= 360; return d < 0 ? d + 360 : d; }
  function angDiff(a, b) { var d = norm360(a - b); return d > 180 ? d - 360 : d; } // signed, degrees, -180..180
  function lerpAngle(a, b, k) { return norm360(a + angDiff(b, a) * k); }
  function bearingOf(a, b) { return norm360(Math.atan2(b[0] - a[0], b[1] - a[1]) / D2R); } // 0 = north, 90 = east

  // Nearest point of a [lng,lat] polyline to pos. `hint` is the previous segment index: search a window around it first so a
  // route that doubles back never snaps the car to the wrong leg; only if that window is farther than 60 m scan everything.
  function snap(line, pos, hint) {
    function scan(a, b) {
      var best = { d: Infinity, i: 0, t: 0 };
      for (var i = Math.max(0, a); i < Math.min(line.length - 1, b); i++) {
        var A = toXY(pos, line[i]), B = toXY(pos, line[i + 1]), vx = B[0] - A[0], vy = B[1] - A[1], l2 = vx * vx + vy * vy;
        var t = l2 ? Math.max(0, Math.min(1, -(A[0] * vx + A[1] * vy) / l2)) : 0, d = Math.hypot(A[0] + vx * t, A[1] + vy * t);
        if (d < best.d) best = { d: d, i: i, t: t };
      }
      return best;
    }
    var h = hint | 0, w = scan(h - 15, h + 60);
    return w.d > 60 ? scan(0, line.length - 1) : w;
  }

  // The route from the car forward, as local metres with cumulative distance, up to maxDist.
  function ahead(line, pos, maxDist, hint) {
    if (!line || line.length < 2) return { pts: [], total: 0, index: 0, off: Infinity };
    var s = snap(line, pos, hint), pts = [], acc = 0, A = toXY(pos, line[s.i]), B = toXY(pos, line[s.i + 1]);
    var first = [A[0] + (B[0] - A[0]) * s.t, A[1] + (B[1] - A[1]) * s.t];
    pts.push({ x: first[0], y: first[1], d: 0 });
    var prev = first;
    for (var i = s.i + 1; i < line.length && acc <= maxDist; i++) {
      var P = toXY(pos, line[i]); acc += dist(prev, P); pts.push({ x: P[0], y: P[1], d: acc }); prev = P;
    }
    // remaining distance to the end of the route (for the destination flag and "arriving")
    var remain = acc; for (var j = s.i + 1; j < line.length - 1; j++) { if (acc > maxDist) remain += dist(toXY(pos, line[j]), toXY(pos, line[j + 1])); }
    return { pts: pts, total: remain, index: s.i, off: s.d };
  }

  // First real turn: heading change over a +-12 m window above `minAngle` degrees. Returns { d, angle (+ right, - left), at:{x,y}, dirIn } or null.
  function nextTurn(pts, minAngle) {
    minAngle = minAngle || 38;
    if (pts.length < 3) return null;
    function at(dd) { // point on the path at distance dd
      for (var i = 1; i < pts.length; i++) if (pts[i].d >= dd) { var a = pts[i - 1], b = pts[i], k = (dd - a.d) / ((b.d - a.d) || 1); return [a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k]; }
      var l = pts[pts.length - 1]; return [l.x, l.y];
    }
    var end = pts[pts.length - 1].d;
    for (var d = 12; d <= end - 12; d += 4) {
      var p0 = at(d - 12), p1 = at(d), p2 = at(d + 12), ang = angDiff(bearingOf(p1, p2), bearingOf(p0, p1));
      if (Math.abs(ang) >= minAngle) {
        // walk on to the sharpest point of this bend so the marker sits at the corner, not at its start
        var bestD = d, bestA = ang;
        for (var e = d + 4; e <= Math.min(end - 12, d + 30); e += 4) { var q0 = at(e - 12), q1 = at(e), q2 = at(e + 12), a2 = angDiff(bearingOf(q1, q2), bearingOf(q0, q1)); if (Math.abs(a2) > Math.abs(bestA)) { bestA = a2; bestD = e; } }
        var c = at(bestD); return { d: bestD, angle: bestA, at: { x: c[0], y: c[1] }, dirIn: bearingOf(at(Math.max(0, bestD - 12)), c) };
      }
    }
    return null;
  }

  // Pinhole camera. cam = { heading, hfov, w, h, horizon (px from top), camH }. Local point (x east, y north) at ground level + height z.
  function camera(heading, hfov, w, h, horizon, camH) {
    var f = (w / 2) / Math.tan(hfov * D2R / 2), sh = Math.sin(heading * D2R), ch = Math.cos(heading * D2R);
    return { heading: heading, f: f, w: w, h: h, horizon: horizon, camH: camH || 1.3, sh: sh, ch: ch, near: 3 };
  }
  function project(c, x, y, z) {
    var fwd = x * c.sh + y * c.ch, right = x * c.ch - y * c.sh;
    if (fwd < c.near) return null;
    return [c.w / 2 + c.f * right / fwd, c.horizon + c.f * (c.camH - (z || 0)) / fwd, fwd];
  }

  // Road ribbon of constant width following the path, as screen quads. Segments crossing the near plane are clipped, those past
  // `far` are dropped. Each quad carries its distance so the painter can fade it out.
  function ribbon(pts, c, halfW, far) {
    var quads = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1], vx = b.x - a.x, vy = b.y - a.y, l = Math.hypot(vx, vy);
      if (l < 0.01 || a.d > far) continue;
      var nx = -vy / l * halfW, ny = vx / l * halfW; // left normal
      var A = { x: a.x, y: a.y }, B = { x: b.x, y: b.y }, ta = A.x * c.sh + A.y * c.ch, tb = B.x * c.sh + B.y * c.ch;
      if (ta < c.near && tb < c.near) continue;
      if (ta < c.near) { var k = (c.near + 0.01 - ta) / (tb - ta); A = { x: A.x + vx * k, y: A.y + vy * k }; }
      else if (tb < c.near) { var k2 = (c.near + 0.01 - ta) / (tb - ta); B = { x: A.x + vx * k2, y: A.y + vy * k2 }; }
      var p1 = project(c, A.x + nx, A.y + ny), p2 = project(c, B.x + nx, B.y + ny), p3 = project(c, B.x - nx, B.y - ny), p4 = project(c, A.x - nx, A.y - ny);
      if (p1 && p2 && p3 && p4) quads.push({ poly: [p1, p2, p3, p4], d: a.d, d2: b.d });
    }
    return quads;
  }

  // Gauge: 270 degree sweep, 0 at lower left (135 deg from 12 o'clock going clockwise... in SVG angles measured from +x, clockwise).
  var SWEEP = { start: 135, end: 405 };
  function gaugeAngle(speed, max) { var f = Math.max(0, Math.min(1, speed / max)); return SWEEP.start + (SWEEP.end - SWEEP.start) * f; }
  function arcPoint(cx, cy, r, deg) { return [cx + r * Math.cos(deg * D2R), cy + r * Math.sin(deg * D2R)]; }
  function arcPath(cx, cy, r, a0, a1) {
    var p0 = arcPoint(cx, cy, r, a0), p1 = arcPoint(cx, cy, r, a1), large = (a1 - a0) % 360 > 180 ? 1 : 0;
    return 'M' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + 'A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2);
  }

  // The three drive-mode themes. `max` = gauge full scale, `redFrom` = start of the warning zone (km/h): a road-speed gauge, not a tachometer.
  var THEMES = {
    normal: { id: 'normal', name: { en: 'Normal', ms: 'Biasa' }, max: 180, redFrom: 110, accent: '#2fd0ec', accent2: '#7be3f5', face: '#0f1226', ink: '#eef0fa', warn: '#ff5a7a', ribbon: ['47,208,236', '47,91,255'], font: '"Ubuntu","Segoe UI",system-ui,sans-serif', italic: false, ledN: 0 },
    sports: { id: 'sports', name: { en: 'Sports', ms: 'Sukan' }, max: 240, redFrom: 150, accent: '#ff3b3b', accent2: '#ffd23b', face: '#0b0b0e', ink: '#ffffff', warn: '#ff2d2d', ribbon: ['255,59,59', '255,160,40'], font: '"Ubuntu","Segoe UI",system-ui,sans-serif', italic: true, ledN: 9 },
    luxury: { id: 'luxury', name: { en: 'Luxury', ms: 'Mewah' }, max: 200, redFrom: 120, accent: '#d9b86a', accent2: '#f3e3b0', face: '#0c0f0d', ink: '#f6efe0', warn: '#e0735a', ribbon: ['217,184,106', '243,227,176'], font: 'Georgia,"Times New Roman",serif', italic: false, ledN: 0 },
  };
  function theme(id) { return THEMES[id] || THEMES.normal; }

  // Distance for a label: 450 m / 1.2 km.
  function fmtDist(m) { return m >= 1000 ? (m / 1000).toFixed(m >= 9500 ? 0 : 1) + ' km' : Math.max(10, Math.round(m / 10) * 10) + ' m'; }

  var api = { toXY: toXY, dist: dist, norm360: norm360, angDiff: angDiff, lerpAngle: lerpAngle, bearingOf: bearingOf, snap: snap, ahead: ahead, nextTurn: nextTurn, camera: camera, project: project, ribbon: ribbon, gaugeAngle: gaugeAngle, arcPoint: arcPoint, arcPath: arcPath, SWEEP: SWEEP, THEMES: THEMES, theme: theme, fmtDist: fmtDist, version: '0.1.4' };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.__arahDriveCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
