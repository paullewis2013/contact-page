// Post manifest. Add an entry per post; the list is sorted newest-first
// by date, so order here doesn't matter.
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
];
