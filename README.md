# paullew.is

Personal contact page — an ASCII-art koi pond rendered with Three.js and
[pretext.js](pretext.js), plus a zero-build Markdown blog.

## Structure

```
index.html        home — the koi pond
pretext.js        canvas ASCII renderer (WebGL scene → coloured characters)
favicon.svg
.nojekyll         tells GitHub Pages to serve files verbatim (no Jekyll pass)
preview.command   double-click to preview the site locally (macOS)
smoke.js          `node smoke.js` — executes the page under mocks; run before pushing
blog/
  index.html      blog shell (list + article views, hash-routed)
  md.js           self-contained Markdown renderer
  posts.js        post manifest (a script, so the list works over file://)
  posts/*.md      the posts themselves
```

## How rendering works

1. The koi pond is a Three.js scene rendered offscreen at 2× the character
   grid resolution (~300×160 px), not at full window resolution.
2. Each frame, `Pretext.frame()` samples that tiny buffer down to one pixel
   per character cell, stamps pre-rasterised glyphs from a white glyph atlas
   with `drawImage`, and colourises them all at once with a single
   `source-in` composite — no per-cell `fillText` or `fillStyle` calls,
   which is what made Chrome choppy. Splashes are the 3D ripple rings
   only, seen through the ASCII filter — there is no separate character
   overlay drawn on top of them.
3. The page title, contact section, and nav link are stamped into the same
   character grid as the water each frame (`stampUI`) — there is no HTML
   overlay UI at all. Invisible hit elements on top of the stamped cells
   provide real links, clicks, hover, and keyboard focus; the contact
   block expands inline under the title with a ripple burst in the pond.
4. The simulation runs on a fixed 60 Hz timestep decoupled from
   `requestAnimationFrame`, so it plays at the same speed on 60/120/144 Hz
   displays and doesn't stutter in Chrome/Safari the way per-frame DOM
   mutation did.

Controls: press `?` or tap the `[?]` stamped in the bottom-left corner to
toggle the control bar — a character-size scrubber (`a ····●···· A`, click
or drag) and pause. Ambient weather (rain, mist, petal gusts) cycles on
its own. `prefers-reduced-motion` users get a single settled frame,
paused, with controls visible.

## Adding a blog post

1. Create `blog/posts/<slug>.md` (plain GitHub-flavored Markdown).
2. Add an entry to `blog/posts.js`:

   ```js
   {
     slug: '<slug>',
     title: 'Post Title',
     date: 'YYYY-MM-DD',
     summary: 'One line shown in the post list.',
   }
   ```

3. Commit and push. Posts are fetched and rendered client-side by
   `blog/md.js` (a small self-contained Markdown renderer — no build step,
   no CDN dependency). Newest date sorts first.

## Previewing locally

Browsers block `fetch()` of local files, so post bodies won't load if you
open the html files straight from disk (and `file://` shows directory
listings instead of resolving `index.html`). Double-click
`preview.command` (macOS) to serve the site at http://localhost:8437 and
open it — this matches exactly how GitHub Pages serves it in production.

Direct links to posts look like `https://paullew.is/blog/#/<slug>`.

## Roadmap

Ideas queued up, roughly in order of value:

### Blog

- **Pre-render posts at deploy time.** Posts currently render client-side,
  so search engines and link previews see an empty shell. A small GitHub
  Action can reuse `md.js` in Node to emit a static HTML page per post,
  which also enables per-post OpenGraph tags (real preview cards when a
  link is shared) without changing the write-markdown-and-push workflow.
- **RSS feed.** The same action can generate `feed.xml` from `posts.js`
  for free.
- **Syntax highlighting** for code blocks — a ~50-line tokenizer for
  JS/JSON fits the zero-dependency ethos better than pulling in
  highlight.js.
- **Post niceties:** prev/next links at the bottom of a post, a
  reading-time estimate in the list, and a `draft: true` manifest flag for
  posts that aren't ready to be listed.

### Pond

- **Tap to ripple.** Click or touch the water to spawn a ripple at that
  spot, with nearby koi startling away or drifting over to investigate —
  the ripple pool already exists, so this is ~30 lines and turns the
  scene into a toy.
- **Ambient sound toggle** — a soft water loop, off by default.
- **Screen-reader description** — an `aria-label` on the canvas describing
  the scene.

### Housekeeping

- **OpenGraph image + meta description** for the home page (currently a
  bare `<title>`).
- **`apple-touch-icon` / web manifest** so the site looks right saved to a
  phone home screen.
- **`404.html`** in the site's style — GitHub Pages picks it up
  automatically.
- **The `/ work` section**, whenever the content exists — the nav is ready
  for it.
