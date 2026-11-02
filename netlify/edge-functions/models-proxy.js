/**
 * Netlify Edge Function: same-origin GitHub Release model proxy.
 * Required environment variables: MODEL_OWNER, MODEL_REPO, MODEL_TAG.
 *
 * Frontend asks for /models-cdn/inswapper_128_fp16.onnx.
 * A compatibility alias for /models-cdn/inswapper_128.onnx is also accepted.
 */
const ASSETS = Object.freeze({
  "det_10g.onnx": "det_10g.onnx",
  "w600k_r50.onnx": "w600k_r50.onnx",
  "inswapper_128.onnx": "inswapper_128_fp16.onnx",
  "inswapper_128_fp16.onnx": "inswapper_128_fp16.onnx",
  "bisenet_resnet_34.onnx": "bisenet_resnet_34.onnx",
  "emap.bin": "emap.bin",
  "SHA256SUMS.txt": "SHA256SUMS.txt",
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type, Accept",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, ETag",
  "Vary": "Origin",
  "X-Content-Type-Options": "nosniff",
};

function errorResponse(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export default async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "GET" && request.method !== "HEAD") {
    return errorResponse("Method not allowed", 405);
  }

  const pathname = new URL(request.url).pathname;
  const prefix = "/models-cdn/";
  if (!pathname.startsWith(prefix)) return errorResponse("Not found", 404);

  let name;
  try { name = decodeURIComponent(pathname.slice(prefix.length)); }
  catch { return errorResponse("Invalid asset path", 400); }

  if (!name || name.includes("/") || name.includes("\\") || !Object.hasOwn(ASSETS, name)) {
    return errorResponse("Unknown model asset", 404);
  }

  const owner = (Netlify.env.get("MODEL_OWNER") || "").trim();
  const repo = (Netlify.env.get("MODEL_REPO") || "").trim();
  const tag = (Netlify.env.get("MODEL_TAG") || "").trim();
  if (!owner || !repo || !tag) {
    return errorResponse("Model proxy is not configured. Set MODEL_OWNER, MODEL_REPO and MODEL_TAG.", 503);
  }

  const asset = ASSETS[name];
  const target = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}` +
    `/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(asset)}`;

  const headers = new Headers();
  const range = request.headers.get("Range");
  if (range) headers.set("Range", range);

  let upstream;
  try {
    upstream = await fetch(target, { method: request.method, headers, redirect: "follow" });
  } catch (e) {
    console.error("GitHub model request failed", e);
    return errorResponse("Unable to reach model storage", 502);
  }

  const responseHeaders = new Headers(upstream.headers);
  for (const [k, v] of Object.entries(cors)) responseHeaders.set(k, v);
  responseHeaders.set("Cache-Control", upstream.ok || upstream.status === 206
    ? "public, max-age=86400" : "no-store");
  if (asset.endsWith(".onnx") || asset.endsWith(".bin")) {
    responseHeaders.set("Content-Type", "application/octet-stream");
  }

  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
};

export const config = { path: "/models-cdn/*" };
