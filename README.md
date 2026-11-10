# paullew.is

Personal contact page — an ASCII-art koi pond rendered with Three.js and
[pretext.js](pretext.js), plus a zero-build Markdown blog.

## Structure

```
index.html        home — the koi pond (Three.js via an import map). The page's text
                  (h1, about, links) is static HTML in #fallback: the visible page
                  without JS or if the pond fails, screen-reader-only otherwise.
                  Person JSON-LD in the head.
pretext.js        canvas ASCII renderer (WebGL scene → coloured characters)
vendor/           self-hosted third-party files, so the page makes no outside requests:
  three.module.min.js   Three.js r160 (MIT), from the three npm package
  caveat-notes.woff2    Caveat 600 (OFL), subset to the glyphs of the two hand-written
                        notes. Reword a note and the subset must be regenerated:
                        fonts.googleapis.com/css2?family=Caveat:wght@600&text=<all the letters>
  OFL-Caveat.txt        the font's licence
paul-lewis.vcf    the "save contact" card: name, title, email and profile links only
favicon.svg
robots.txt        allows all crawlers (AI crawlers named explicitly); points at the sitemap
sitemap.xml       hand-maintained: add a <url> per new page (the blog isn't listed yet)
llms.txt          markdown summary for LLMs (llmstxt.org); keep it in step with the about text
.nojekyll         tells GitHub Pages to serve files verbatim (no Jekyll pass)
og-image.png      link-preview card (OpenGraph/Twitter)
apple-touch-icon.png / icon-*.png / site.webmanifest — home-screen icons
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
3. The page title, contact hint, and `[?]` toggle are stamped into the same
   character grid as the water each frame (`stampUI`). Invisible hit
   elements on top of the stamped cells provide real links, clicks, hover,
   and keyboard focus. The contact block opens under the title, with a
   ripple burst in the pond, as a small terminal-style window: its link
   rows are real HTML laid onto the grid (selectable, copyable). On phones
   in portrait the same rows dock to the bottom edge as a sheet with
   finger-sized targets, laid out by CSS (`html.sheet`); the hint becomes
   `[ close ]` and the title rises if the sheet would cover it. The last
   row saves a contact card (`paul-lewis.vcf`) and, where the browser has a
   share sheet, shares the page. A
   hand-drawn layer (SVG ink plus notes in a self-hosted Caveat subset) draws
   a loop around the hint and a note pointing at the email. Koi are steered
   clear of the text and the notes by a keep-out zone projected from their
   screen rectangle into the pond.
4. The simulation runs on a fixed 60 Hz timestep decoupled from
   `requestAnimationFrame`, so it plays at the same speed on 60/120/144 Hz
   displays and doesn't stutter in Chrome/Safari the way per-frame DOM
   mutation did.
5. Robustness on phones. The intro plays at 8× after a tap or key press,
   and from the start on a repeat visit in the same tab. When frames run
   slow for a second or two the character size steps up (fewer cells), at
   most three sizes and never back down; using the scrubber turns that
   off. If the browser drops the WebGL context (common for background tabs
   on iOS) the last frame is held until the context returns; if it hasn't
   after four seconds the page reloads once, and failing that shows the
   static page.

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
     draft: true,  // optional — hides it from the list until you're ready
   }
   ```

3. Commit and push. Posts are fetched and rendered client-side by
   `blog/md.js` (a small self-contained Markdown renderer — no build step,
   no CDN dependency). Newest date sorts first. Nest lists by indenting
   with spaces; ordered lists keep their start number.

## Previewing locally

Browsers block `fetch()` of local files, so post bodies won't load if you
open the html files straight from disk (and `file://` shows directory
listings instead of resolving `index.html`). Double-click
`preview.command` (macOS) to serve the site at http://localhost:8437 and
open it — this matches exactly how GitHub Pages serves it in production
(internal links are root-relative, so the site must be served from its
root as it is there).

Direct links to posts look like `https://paullew.is/blog/#/<slug>`.

The home page doesn't link to the blog yet. It's live at `/blog/` but
only reachable by URL until the link is added back.

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
- **Post niceties:** prev/next links at the bottom of a post and a
  reading-time estimate in the list.

### Pond

- **Ambient sound toggle** — a soft water loop, off by default.

### Housekeeping

- **`404.html`** in the site's style — GitHub Pages picks it up
  automatically.
- **Home-page nav** — restore the `/ writing` link once the blog is ready
  to show, and add `/ work` whenever that content exists.
