/**
 * SUNSUZZER Google Maps place lookup worker
 * Deploy as a Cloudflare Worker and set GOOGLE_MAPS_API_KEY as a secret.
 * Endpoint: POST /lookup { "mapsUrl": "https://maps.app.goo.gl/..." }
 */
const ALLOWED_ORIGINS = [
  "https://janeking301.github.io",
  "https://sunsuzzer-realtw.netlify.app"
];

function cors(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}
function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origin) }
  });
}
function extractQuery(url) {
  try {
    const u = new URL(url);
    const q = u.searchParams.get("query") || u.searchParams.get("q");
    if (q) return q;
    const placeMatch = u.pathname.match(/\/place\/([^/]+)/i);
    if (placeMatch) return decodeURIComponent(placeMatch[1]).replace(/\+/g, " ");
    const dataMatch = url.match(/!1s(ChI[^!]+)/);
    if (dataMatch) return dataMatch[1];
    return "";
  } catch { return ""; }
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    const endpoint = new URL(request.url);
    if (request.method !== "POST" || endpoint.pathname !== "/lookup") {
      return json({ error: "Not found" }, 404, origin);
    }
    if (!env.GOOGLE_MAPS_API_KEY) return json({ error: "後台尚未設定 Google Maps API 金鑰。" }, 503, origin);
    let body;
    try { body = await request.json(); } catch { return json({ error: "請提供有效的 JSON。" }, 400, origin); }
    const mapsUrl = String(body.mapsUrl || "").trim();
    if (!/^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|www\.google\.com\/maps|maps\.google\.com|maps\.google\.com\.tw)\//i.test(mapsUrl)) {
      return json({ error: "請貼上有效的 Google Maps 網址。" }, 400, origin);
    }

    let expandedUrl = mapsUrl;
    try {
      const response = await fetch(mapsUrl, { redirect: "follow" });
      expandedUrl = response.url || mapsUrl;
    } catch {}
    const query = extractQuery(expandedUrl) || extractQuery(mapsUrl);
    const placeIdMatch = (expandedUrl + " " + mapsUrl).match(/[?&]query_place_id=([^&]+)/) ||
      (expandedUrl + " " + mapsUrl).match(/!1s(ChI[^!&]+)/);
    let place = null;
    const headers = { "Content-Type": "application/json", "X-Goog-Api-Key": env.GOOGLE_MAPS_API_KEY };

    if (placeIdMatch) {
      const placeId = decodeURIComponent(placeIdMatch[1]);
      const detailRes = await fetch("https://places.googleapis.com/v1/places/" + encodeURIComponent(placeId), {
        headers: { ...headers, "X-Goog-FieldMask": "id,displayName,formattedAddress,nationalPhoneNumber,internationalPhoneNumber,regularOpeningHours.weekdayDescriptions,googleMapsUri" }
      });
      if (detailRes.ok) place = await detailRes.json();
    }
    if (!place && query && !/^ChI/.test(query)) {
      const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: { ...headers, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.regularOpeningHours.weekdayDescriptions,places.googleMapsUri" },
        body: JSON.stringify({ textQuery: query, languageCode: "ja", maxResultCount: 5 })
      });
      if (searchRes.ok) {
        const data = await searchRes.json();
        const places = data.places || [];
        place = places[0] || null;
        if (places.length > 1) {
          return json({ matches: places.map(p => ({
            id: p.id, name: p.displayName?.text || "", address: p.formattedAddress || "",
            phone: p.internationalPhoneNumber || p.nationalPhoneNumber || "",
            openingHours: p.regularOpeningHours?.weekdayDescriptions || [],
            mapsUrl: p.googleMapsUri || ""
          })) }, 200, origin);
        }
      }
    }
    if (!place) return json({ error: "無法從這個網址辨識店家。請改貼 Google Maps 分享連結，或在網站搜尋店名。" }, 404, origin);
    return json({ place: {
      id: place.id || "",
      name: place.displayName?.text || "",
      address: place.formattedAddress || "",
      phone: place.internationalPhoneNumber || place.nationalPhoneNumber || "",
      openingHours: place.regularOpeningHours?.weekdayDescriptions || [],
      mapsUrl: place.googleMapsUri || expandedUrl
    } }, 200, origin);
  }
};