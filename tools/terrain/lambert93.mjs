// WGS84 lat/lon (degrees) <-> Lambert-93 (EPSG:2154) metres. GRS80, LCC 2SP.
const a = 6378137, f = 1 / 298.257222101, e = Math.sqrt(2 * f - f * f);
const rad = d => d * Math.PI / 180;
const lat1 = rad(49), lat2 = rad(44), lat0 = rad(46.5), lon0 = rad(3), x0 = 700000, y0 = 6600000;
const m = p => Math.cos(p) / Math.sqrt(1 - e * e * Math.sin(p) ** 2);
const t = p => Math.tan(Math.PI / 4 - p / 2) / ((1 - e * Math.sin(p)) / (1 + e * Math.sin(p))) ** (e / 2);
const n = (Math.log(m(lat1)) - Math.log(m(lat2))) / (Math.log(t(lat1)) - Math.log(t(lat2)));
const F = m(lat1) / (n * t(lat1) ** n), r0 = a * F * t(lat0) ** n;
export function toL93(lat, lon) {
  const r = a * F * t(rad(lat)) ** n, th = n * (rad(lon) - lon0);
  return [x0 + r * Math.sin(th), y0 + r0 - r * Math.cos(th)];
}
export function fromL93(x, y) {
  const dx = x - x0, dy = r0 - (y - y0), r = Math.sign(n) * Math.hypot(dx, dy), th = Math.atan2(dx, dy);
  const tt = (r / (a * F)) ** (1 / n);
  let p = Math.PI / 2 - 2 * Math.atan(tt);
  for (let i = 0; i < 10; i++) p = Math.PI / 2 - 2 * Math.atan(tt * ((1 - e * Math.sin(p)) / (1 + e * Math.sin(p))) ** (e / 2));
  return [p * 180 / Math.PI, (th / n + lon0) * 180 / Math.PI];
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const [la, lo] = process.argv.slice(2).map(Number);
  const [x, y] = toL93(la, lo); console.log(x.toFixed(1), y.toFixed(1), fromL93(x, y).map(v => v.toFixed(6)).join(' '));
}
