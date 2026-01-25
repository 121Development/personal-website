---
tags: [technology, coding]
featured: true
---

# New Personal Site

![](/images/blog/lighthouse.webp)

I've rebuilt my personal site from scratch with a focus on simplicity, speed, and SEO. Here's the stack and thinking behind it.

## Tech Stack

**Astro** as the framework - it's perfect for content-heavy sites. Static Site Generation (SSG) means zero JavaScript shipped to the browser by default. Pages are pre-rendered at build time, resulting in lightning-fast load times.

**TypeScript** throughout for type safety and better developer experience.

**Cloudflare Workers** for hosting - global edge deployment means low latency worldwide. The free tier is generous and the performance is excellent.

## Content Management

No CMS, no database. Just **Markdown files in the repo**.

Each blog post is a `.md` file in `/content/blog/`. I edit locally or via GitHub's web interface, commit, and the site rebuilds automatically. Version control for content is underrated - I can see the history of every edit, revert mistakes, and branch for draft posts.

The frontmatter is minimal:
```yaml
---
tags: [technology, coding]
featured: true
---
```

## CI/CD with GitHub Actions

Push to `master` triggers a GitHub Action that:
1. Builds the Astro site
2. Deploys to Cloudflare Workers via Wrangler

From commit to live in about 2 minutes. No manual deployments, no FTP, no clicking around in dashboards.

## SEO & GEO (Generative Engine Optimization)

The site is built with both traditional SEO and AI discoverability in mind:

- **Semantic HTML** - proper use of article, nav, header tags
- **Meta tags** - Open Graph, Twitter Cards, canonical URLs
- **Structured data** - JSON-LD for Person and BlogPosting schemas
- **RSS feed** - for readers and crawlers
- **Sitemap** - auto-generated
- **robots.txt** - explicitly allows AI crawlers (GPTBot, Claude-Web, etc.)

GEO is the new frontier. As AI search and summaries become dominant, being discoverable and correctly parsed by LLMs matters. The `.well-known/ai-plugin.json` manifest helps AI agents understand the site's purpose.

## Performance

Lighthouse scores are where they should be - high 90s across the board.

Key optimizations:
- No client-side JavaScript (except theme toggle and search)
- Inline critical CSS
- WebP images
- Edge caching via Cloudflare

## Features

- **Dark/light mode** with system preference detection
- **Search** - client-side search across all posts
- **Tag filtering** on the blog page
- **Featured posts** section on homepage
- **Web-based post editor** at `/new` and `/edit` for quick updates

## Why Build From Scratch?

I wanted full control and understanding of every line. No bloated themes, no plugin conflicts, no framework lock-in beyond Astro itself.

The result is a site that loads fast, ranks well, and is easy to maintain. The entire codebase is small enough to keep in my head.

Sometimes the best stack is the simplest one that gets the job done.
