# NewFace Live — browser-only online models

NewFace Live is a static web application for Chrome and Edge. It fetches model assets from the configured online GitHub Release through a same-origin Netlify Edge Function and runs ONNX inference in the browser. It does not upload camera frames to a cloud inference server. Downloaded model bytes are saved in IndexedDB for reuse when browser storage permits; the Fetch API cache is not used for model persistence.

## Important performance note

This project attempts WebGPU where the browser exposes it, then attempts ONNX Runtime Web WASM CPU inference. A fallback attempt does not guarantee every model can run on every browser: the supplied `inswapper_128_fp16.onnx` may require compatible FP16 operators/backend support. The Toshiba Satellite Pro C850-10Z with an Intel Core i3-2350M and Intel HD Graphics 3000 is old hardware; CPU mode may be slow, and smooth real-time swapping is not guaranteed. Close other apps before testing.

## Models

The online release must contain these exact assets under the `models-v1` tag in `kaysicc-gif/newface-models`:

- `det_10g.onnx` — face detection
- `w600k_r50.onnx` — face recognition
- `inswapper_128_fp16.onnx` — face swapping
- `bisenet_resnet_34.onnx` — face-region parsing
- `emap.bin` — embedding mapping data

The model files are not bundled into this source ZIP. The website fetches them from online hosting at runtime. The browser must receive model bytes to run inference. After a successful download, the app attempts to save each model in IndexedDB so later visits can reuse it. Cache entries are keyed by model URL and cache version. Browser storage limits, private-browsing settings, or storage pressure may prevent or remove the saved copies; the app then downloads missing models again.

## Deploy to Netlify

1. Upload the contents of this ZIP to a GitHub repository (the files must be at the repository root; keep `netlify.toml` at root).
2. In Netlify, import that GitHub repository.
3. In Site configuration → Environment variables, set:
   - `MODEL_OWNER` = `kaysicc-gif`
   - `MODEL_REPO` = `newface-models`
   - `MODEL_TAG` = `models-v1`
4. Ensure the Netlify build settings do not override `netlify.toml`. The publish directory is `public`; no build command is required.
5. Deploy the site and open the deployed HTTPS URL in Chrome or Edge.
6. Press **Get Started**, wait for the model-loading progress, upload a reference image containing a face, and allow camera access.
7. Start with **Fast** processing quality. Use Balanced or High only if your laptop can keep up.

## Local website preview

The website can also be served through `RUN-NEWFACE.bat` at `http://localhost:8080`, but model assets still load from the online release because no model files are bundled. Internet access is required.

## Browser-only behavior and privacy

- Camera frames are processed in the browser by the app's ONNX pipeline.
- The camera is requested only after you press Start camera.
- Missing model assets are fetched with `cache: no-store` and then saved in IndexedDB when browser storage permits.
- The app requests persistent browser storage where supported, but the browser may deny the request or later clear data.
- Camera frames remain in the browser pipeline and are not sent to a cloud inference server.
- Use reference images only with appropriate permission and consent.

## Current features

- Online model fetch with progress and actionable HTTP errors
- IndexedDB model cache with cache-first loading and download fallback
- WebGPU-first / WASM CPU fallback attempt
- Camera start/stop, reference photo upload, face swapping
- Full-face and selected facial-region modes
- Opacity and sharpening controls
- Mirror control and Fast/Balanced/High camera quality presets
- FPS indicator and saved UI preferences

## Validation status

Static JavaScript syntax checks and package structure checks are performed when this ZIP is built. They do not replace testing the actual GitHub Release assets, a live Netlify deployment, model initialization, inference output, or real-time speed on the target laptop.
