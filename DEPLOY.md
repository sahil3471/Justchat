# Deploying Nadi Tracker for free

Pick one of the options below. All are free. The app is the contents of the
`app/` folder — that's the only thing that needs to be hosted.

---

## Option A — Netlify Drop (recommended, no account needed)

1. Download the repo:
   [Download ZIP](https://github.com/sahil3471/Justchat/archive/refs/heads/main.zip)
   (or click **Code → Download ZIP** on GitHub).
2. Unzip it on your computer. Find the `app/` folder inside.
3. Open https://app.netlify.com/drop
4. Drag the entire `app/` folder onto the drop zone.
5. Netlify gives you an HTTPS URL like `https://random-name-xyz.netlify.app/`.
6. On your phone, open that URL in Chrome (Android) or Safari (iOS).
7. **Add to Home Screen / Install:**
   - **Chrome (Android):** menu (⋮) → *Install app*.
   - **Safari (iOS):** share button → *Add to Home Screen*.

> The free Netlify URL stays alive for ~24 hours unless you sign up. Signing up
> is free and lets you keep the URL forever, plus you can rename it.

---

## Option B — Make this repo public, use GitHub Pages (free for public repos)

1. On GitHub: **Settings → General → Danger Zone → Change visibility → Public**.
2. **Settings → Pages → Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: **main** (or `feat/nadi-tracker-pwa`)
   - Folder: **`/app`**
   - Save.
3. Wait ~30 seconds. GitHub shows a URL like
   `https://sahil3471.github.io/Justchat/`.
4. Install on phone the same way as Option A.

---

## Option C — Cloudflare Pages (free, works with private repos)

1. Sign up at https://pages.cloudflare.com (free).
2. **Create a project → Connect to Git → pick `Justchat`**.
3. Build settings:
   - Framework preset: **None**
   - Build command: *(leave blank)*
   - Build output directory: **`app`**
4. Deploy. You get an HTTPS URL like `https://justchat.pages.dev/`.

---

## Option D — Vercel (free, works with private repos)

1. Sign up at https://vercel.com (free).
2. **Add new → Project → Import GitHub repo `Justchat`**.
3. Set **Root Directory** to `app/`. Leave framework preset as *Other*.
4. Deploy. You get an HTTPS URL like `https://justchat.vercel.app/`.

---

## Why not just open `index.html` from a downloaded folder?

It will partially load, but several things break:

- "Add to Home Screen" / PWA install requires **HTTPS** or `localhost`.
  Browsers refuse to install PWAs served from `file://`.
- The service worker (offline cache) cannot register on `file://`.
- iOS Safari blocks several PWA features for local files.

You can do this for a quick preview on a desktop, but for daily use on your
phone you want one of the options above.

## Updating the app later

If you change a file in `app/`, just:

- **Netlify Drop:** drag the updated `app/` folder onto the same site
  (or a fresh drop for a new URL).
- **GitHub Pages / Cloudflare / Vercel:** push to the branch, the host
  redeploys automatically.

When you reload the app on your phone the service worker will fetch the new
version. If you don't see the update, close the app fully and reopen it.
