// Post manifest. Add an entry per post; the list is sorted newest-first
// by date, so order here doesn't matter. `draft: true` keeps a post out of
// the list while it's being written (it still opens via #/<slug>).
//
// This is a script rather than JSON so the post list renders even when
// the site is opened directly from disk (file://), where fetch() of
// local files is blocked by browsers.
window.BLOG_POSTS = [
  {
    slug: 'hello-world',
    title: 'Hello, world',
    date: '2026-07-02',
    summary: 'First post — how this blog works and why the site got rebuilt.',
  },
  {
    slug: 'homelab-2026',
    title: 'How I would start a homelab in 2026',
    date: '2026-07-07',
    summary: 'Tailscale, Proxmox, Docker, Caddy, and a homepage to keep track of it all.',
    draft: true,
  },
];
