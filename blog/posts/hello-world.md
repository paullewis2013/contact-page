# Hello, world

This is the first post on the new writing section. Posts are plain Markdown
files rendered in the browser — no build step, no static site generator,
same zero-dependency spirit as the pond on the home page.

## How a post gets here

- Write a Markdown file and drop it in `blog/posts/`, e.g. `my-post.md`
- Add an entry to `blog/posts.js`
- Commit and push. That's it.

A manifest entry looks like this:

```js
{
  slug: 'my-post',
  title: 'My Post',
  date: '2026-07-02',
  summary: 'One line shown in the list.',
}
```

## What Markdown works?

Standard GitHub-flavored Markdown: **bold**, *italics*, `inline code`,
[links](https://paullew.is), lists, blockquotes, tables, and fenced code
blocks:

```js
const pond = new KoiPond({ fish: 12, weather: 'occasional rain' });
pond.drift();
```

| feature     | supported |
| ----------- | --------- |
| headings    | yes       |
| tables      | yes       |
| koi         | implied   |

---

> The koi do not read the blog, but they appreciate that it exists.
