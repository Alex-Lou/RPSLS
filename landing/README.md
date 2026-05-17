# RPSLS — Landing page

A single-file marketing page for the RPSLS game.

- `index.html` — everything (HTML, Tailwind via CDN, inline CSS, vanilla JS).
- `logo.png` — copied from the app.

## Local preview

```bash
# from this directory
python -m http.server 5500
# or any static server
npx serve
```

Then open <http://localhost:5500>.

## Deploy (100% free)

Drop the `landing/` folder on any static host. No build step.

- **Cloudflare Pages** — connect the GitHub repo, build command empty, output directory `landing`.
- **Netlify** — drag-and-drop the folder onto https://app.netlify.com/drop.
- **GitHub Pages** — set Pages → source = `develop`/`landing` (or move the contents under `docs/`).

## Tech

Pure HTML + Tailwind Play CDN + a tiny vanilla `IntersectionObserver` for
reveal-on-scroll + a `pointermove` parallax loop. No bundler, no framework.
~16KB gzipped, instant first paint.
