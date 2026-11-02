# Fresh deployment — GitHub + Netlify

This walkthrough uses the website repository `kaysicc-gif/newface-live-netlify` and the separate model repository `kaysicc-gif/newface-models`. Do not mix their contents.

## 1. Prepare the GitHub website repository

1. Open GitHub and create a **new public repository** named `newface-live-netlify`. If you already created that repository, use it rather than creating a duplicate.
2. Do not initialize the repository with an extra README, license, or `.gitignore`.
3. Extract this ZIP on your computer. Open the extracted `NewFace-Live-FRESH-START-GitHub` folder.
4. Upload the **contents of the folder** to the repository root, not the ZIP file by itself. The root must contain `public/`, `netlify/`, `netlify.toml`, `MODEL_SOURCE.json`, `README.md`, and `NETLIFY_DEPLOY.md`.
5. Commit the files to the `main` branch.

## 2. Create/connect the Netlify website

1. Sign in at https://app.netlify.com/ and choose **Add new project → Import an existing project** (wording may vary).
2. Choose GitHub and select **`kaysicc-gif/newface-live-netlify`**. Do not select `newface-models` for the website deployment.
3. In build settings, clear any manual **Build command** and **Publish directory** values so they are blank and the repository's `netlify.toml` is used. In particular, never type a sentence such as `Follow the repository's netlify.toml` into a command field.
4. Deploy the site. The configuration file sets `publish = "public"` and the Edge Function directory.

## 3. Add environment variables

In the NewFace Live site's environment variable settings, add these three variables as separate key/value entries:

- `MODEL_OWNER` = `kaysicc-gif`
- `MODEL_REPO` = `newface-models`
- `MODEL_TAG` = `models-v1`

Save, then trigger a new deployment. These variables must be available to the Edge Function at runtime.

## 4. Test the deployment

First open the main Netlify site URL (the root, ending in `.netlify.app`). It should show the NewFace Live app. Then test the small manifest endpoint:

`https://YOUR-SITE.netlify.app/models-cdn/SHA256SUMS.txt`

Replace `YOUR-SITE` with the exact hostname shown by Netlify. A 503 usually means the environment variables are not available to the function; a 404 usually means the release/tag/asset is missing or mismatched; a 502 indicates an upstream fetch problem. If the manifest works, test large model files sparingly to avoid unnecessary bandwidth.

## 5. Validate inference separately

A successful page load or model download does not prove the AI pipeline works. Confirm all release assets exist, then test model session initialization and real inference. The app attempts WebGPU and falls back to WASM CPU where possible; the FP16 model and `emap.bin` compatibility must be verified at runtime.

## Keep the model repo separate

The website repo contains the frontend and proxy only. The large model binaries stay in the public `kaysicc-gif/newface-models` release.

## Browser model storage

The app saves downloaded model bytes in IndexedDB under the `newface-live-models` database. It attempts to request persistent storage where supported. Browser quotas, private mode, or storage pressure may prevent or remove cache entries; missing models are fetched again. The five models total roughly 563 MB, so ensure sufficient free storage. To force a refresh after changing model assets without changing their URLs, increment `CACHE_VERSION` in `public/js/models.js` and redeploy.
