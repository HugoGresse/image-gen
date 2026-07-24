# Image Gen

Frontend-only image generation dashboard built with Vite, React, and the OpenRouter-compatible `openai` SDK.

## Features

- Generate 1–8 images from a text prompt through OpenRouter's dedicated Images API (`POST /api/v1/images`)
- Attach reference images and documents to the prompt (drag & drop, paste, or browse): images are sent as `input_references`, text documents (`.txt`, `.md`, `.csv`, `.json`, `.yaml`) are inlined as reference blocks
- Pick from every image model OpenRouter exposes, with per-model pricing, batch size, reference-image limit, and release date in the picker
- Aspect ratios come from the selected model, and requests are batched to the number of images that model returns per call
- Browse results by session in a gallery
- Open any image in a fullscreen viewer: click a card, then use the slider, on-screen arrows, or the keyboard (`←`/`→`, `Home`/`End`, `F` for native fullscreen, `Esc` to close)
- Select images from a single session and create a revamped batch using that session's prompt, model, and aspect ratio
- See the API key's remaining credit in the header (refreshed after each generation) and what OpenRouter billed for each generation in the gallery
- Past generations (prompts, settings, and images) are kept in the browser via IndexedDB and restored on the next visit — the 30 most recent sessions, clearable from the gallery header
- Save your OpenRouter API key locally in the browser for convenience
- Send lightweight analytics events to `plausible.gresse.io`

## OpenRouter API key handling

This project is intentionally browser-only. Your OpenRouter API key is stored in `localStorage` under the `openrouter_api_key` key and is sent directly from the browser to `https://openrouter.ai/api/v1`.

## Development

```bash
npm ci
npm run dev
```

## Validation

```bash
npm run lint
npm run build
```

## GitHub Pages deployment

GitHub Pages deployment is configured in `.github/workflows/deploy.yml`.

- Pushes to `main` build the app and deploy `dist/` with GitHub Actions
- `vite.config.ts` sets the correct `base` path automatically from `GITHUB_REPOSITORY`
- In the repository settings, set **Pages → Source** to **GitHub Actions**
