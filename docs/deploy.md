# Deploying to GitHub Pages

`.github/workflows/deploy.yml` builds and publishes the game on every push to `main`
(and on manual "Run workflow"). It runs `npm ci`, `npm test`, `npm run build`, then uploads `dist/`
with `actions/upload-pages-artifact` and publishes it with `actions/deploy-pages`.
Vite is configured with `base: './'`, so the build works at `https://cosminova.github.io/sol-survivor/`.

## One-time setup (repository admin only)

The workflow cannot publish until Pages is switched to the Actions source. A collaborator without admin rights
cannot do this, so a repo admin must:

1. Open the repository on GitHub → **Settings** → **Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions** (not "Deploy from a branch").
3. Save. No branch or folder selection is needed.

Then merge or push to `main` (or go to **Actions** → **Deploy to GitHub Pages** → **Run workflow**).
The first run creates the `github-pages` environment automatically. The published URL appears on the
workflow run summary and under Settings → Pages.

## Checks

- `npm test` must pass or the deploy step never runs.
- The bundled NASA data in `public/` is committed, so no network access or API keys are needed in CI.
- If the site shows a blank page, confirm `vite.config.js` still has `base: './'`.
