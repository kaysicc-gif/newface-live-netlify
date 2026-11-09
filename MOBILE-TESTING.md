# NewFace Live — mobile test checklist

Use the Netlify Deploy Preview for pull request #1, not the production site, while validating this branch.

## Test on Android Chrome

1. Open the Deploy Preview URL shown by the Netlify bot on pull request #1.
2. Allow camera access and use a well-lit, front-facing camera view.
3. Start the app and let the required models finish loading. Keep the page open while the first download is cached.
4. Upload a reference photo with one clearly visible face.
5. Confirm that the app detects the reference face, then start the live camera preview and test the swap.
6. Repeat after refreshing the page to check that cached model files are reused.

## If model initialization fails

Copy or screenshot the complete in-app error, including the **Device diagnostics** section. It records the browser/runtime version, available device memory and CPU threads when exposed by the browser, WASM SIMD support, model byte count, and the original ONNX Runtime error.

Do not send API keys, private photos, or other personal information with diagnostics. Camera frames and reference images should remain on-device.

## What passing checks mean

The repository CI checks JavaScript syntax, required files, model registry byte sizes, and published model release assets. Passing CI does **not** prove that ONNX sessions initialize or that real-time face swapping works on every phone. Confirm those behaviors on the target device before merging or treating the app as production-ready.
