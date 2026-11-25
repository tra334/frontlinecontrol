#!/usr/bin/env node
/* Generates js/data/uk-stations.json from OpenStreetMap (Overpass API).
 * Run on a machine with internet access:  node tools/generate-uk-stations.js
 *   --region uk        (default) whole United Kingdom
 *   --region scotland  Scotland only (ISO3166-2 GB-SCT)
 *   --out path.json    output file (default js/data/uk-stations.json)
 * Output: { generated, region, stations:[{sv,name,lat,lon,osm}], bases:[{sv,ty,name,lat,lon,osm}] }
 *   sv: f = fire, p = police, a = ambulance
 *   bases: air ambulance (aa) and police helicopter (ph) bases, which get 2 aircraft each in the dev tool.
 */
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const region = arg("--region", "uk").toLowerCase();
const outFile = arg("--out", path.join(__dirname, "..", "js", "data", "uk-stations.json"));
const ENDPOINT = "https://overpass-api.de/api/interpreter";

const areaFilter = region === "scotland"
  ? 'area["ISO3166-2"="GB-SCT"]->.a;'
  : 'area["ISO3166-1"="GB"][admin_level=2]->.a;';

const query = `[out:json][timeout:600];
${areaFilter}
(
  nwr["amenity"="fire_station"](area.a);
  nwr["amenity"="police"](area.a);
  nwr["amenity"="ambulance_station"](area.a);
  nwr["emergency"="ambulance_station"](area.a);
  nwr["aeroway"="heliport"]["name"~"air ambulance|air medical|police|helicopter",i](area.a);
);
out center tags;`;

const SV_WORD = { f: "Fire Station", p: "Police Station", a: "Ambulance Station" };

function classify(tags) {
  if (tags.amenity === "fire_station") return "f";
  if (tags.amenity === "police") return "p";
  if (tags.amenity === "ambulance_station" || tags.emergency === "ambulance_station") return "a";
  return null;
}

function nameFor(tags, sv) {
  let n = (tags["name:en"] || tags.name || "").trim();
  const town = tags["addr:city"] || tags["addr:town"] || tags["addr:village"] || "";
  if (!n) n = town ? `${town} ${SV_WORD[sv]}` : "";
  if (!n) return null;
  // Keep the service word in the name so stations read like real ones ("Leeds Fire Station")
  const word = { f: /fire/i, p: /police/i, a: /ambulance/i }[sv];
  if (!word.test(n)) n = `${n} ${SV_WORD[sv]}`;
  return n;
}

function dedupe(list) {
  const seen = new Map();
  return list.map(s => {
    const key = s.name.toLowerCase();
    const c = (seen.get(key) || 0) + 1;
    seen.set(key, c);
    return c > 1 ? { ...s, name: `${s.name} #${c}` } : s;
  });
}

async function main() {
  console.log(`Querying Overpass for region: ${region} ...`);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(query)
  });
  if (!res.ok) throw new Error("Overpass returned HTTP " + res.status);
  const json = await res.json();

  const stations = [];
  const bases = [];
  for (const el of json.elements) {
    const tags = el.tags || {};
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const osm = `${el.type}/${el.id}`;

    if (tags.aeroway === "heliport") {
      const n = (tags.name || "").toLowerCase();
      const ty = /police/.test(n) ? "ph" : "aa";
      bases.push({ sv: ty, name: tags.name || (ty === "aa" ? "Air Ambulance Base" : "Police Helicopter Base"), lat, lon, osm });
      continue;
    }
    const sv = classify(tags);
    if (!sv) continue;
    const name = nameFor(tags, sv);
    if (!name) continue;
    stations.push({ sv, name, lat: +lat.toFixed(6), lon: +lon.toFixed(6), osm });
  }

  const out = {
    generated: new Date().toISOString(),
    region,
    counts: {
      fire: stations.filter(s => s.sv === "f").length,
      police: stations.filter(s => s.sv === "p").length,
      ambulance: stations.filter(s => s.sv === "a").length,
      airAmbulanceBases: bases.filter(b => b.sv === "aa").length,
      policeHelicopterBases: bases.filter(b => b.sv === "ph").length
    },
    stations: dedupe(stations.sort((a, b) => a.name.localeCompare(b.name))),
    bases
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
  console.log("Wrote", outFile, out.counts);
}

main().catch(e => { console.error(e.message); process.exit(1); });
