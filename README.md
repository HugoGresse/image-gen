# Image Gen

Frontend-only image generation dashboard built with Vite, React, and the OpenRouter-compatible `openai` SDK.

## Features

- Generate 1–8 images from a text prompt
- Choose the model and aspect ratio for each generation
- Browse results by session in a gallery
- Select images from a single session and create a revamped batch using that session's prompt, model, and aspect ratio
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
