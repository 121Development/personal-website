# Homepage Project - Claude.md

## Project Overview

A minimal, SEO-optimized personal homepage built with Astro and TypeScript, deployed to Cloudflare Workers. Content is managed as Markdown files within the repository for simple updates and version control.

### Tech Stack
- **Framework**: Astro v4.16+ (Static Site Generation)
- **Language**: TypeScript (strict mode)
- **Deployment**: Cloudflare Workers with static assets
- **CI/CD**: GitHub Actions
- **Content**: Markdown files in `/content` directory
- **Styling**: Vanilla CSS (inline in Layout.astro)
- **Package Manager**: pnpm (always use pnpm, not npm)

### Design Philosophy
- **Minimal**: Zero unnecessary dependencies, clean code
- **Fast**: SSG with no client-side JavaScript
- **SEO-first**: Server-rendered, semantic HTML, proper meta tags
- **Type-safe**: TypeScript throughout
- **Simple**: Edit markdown → push → deployed

---

## Project Structure

```
homepage/
├── src/
│   ├── pages/                  # Astro pages (routes)
│   │   ├── index.astro         # Homepage (/)
│   │   ├── about.astro         # About page (/about)
│   │   ├── cv.astro            # CV page (/cv)
│   │   ├── contact.astro       # Contact page (/contact)
│   │   ├── projects/
│   │   │   └── index.astro     # Projects list (/projects)
│   │   └── blog/
│   │       ├── index.astro     # Blog list (/blog)
│   │       └── [slug].astro    # Dynamic blog posts (/blog/[slug])
│   ├── layouts/
│   │   └── Layout.astro        # Base layout with nav, meta tags, styles
│   └── lib/
│       ├── content.ts          # Content reading functions
│       └── types.ts            # TypeScript type definitions
├── content/                    # Markdown content (user-editable)
│   ├── about.md                # About page content
│   ├── cv.md                   # CV content
│   ├── contact.md              # Contact info
│   ├── projects/               # Project descriptions
│   │   ├── *.md                # One file per project
│   └── blog/                   # Blog posts
│       └── YYYY-MM-DD-*.md     # Date-prefixed blog posts
├── public/                     # Static assets
│   ├── robots.txt              # SEO/crawler config
│   └── .well-known/
│       └── ai-plugin.json      # AI agent discoverability
├── .github/
│   └── workflows/
│       └── deploy.yml          # Auto-deploy on push
├── astro.config.mjs            # Astro config
├── wrangler.jsonc              # Cloudflare Workers config
├── tsconfig.json               # TypeScript config
├── package.json                # Dependencies & scripts
└── README.md                   # User documentation
```

---

## Core Functionality

### Content Management (`src/lib/content.ts`)

**Purpose**: Read and parse markdown files from `/content` directory at build time.

**Key Functions**:

1. **`fetchBlogPosts(): Promise<BlogPost[]>`**
   - Reads all `.md` files from `content/blog/`
   - Extracts date and title from filename (format: `YYYY-MM-DD-title.md`)
   - Parses first paragraph as excerpt
   - Returns sorted by date (newest first)

2. **`fetchBlogPost(slug: string): Promise<BlogPost | null>`**
   - Reads single blog post by slug
   - Returns null if not found

3. **`fetchContentSection(filename: string): Promise<ContentSection | null>`**
   - Reads single markdown file (about.md, cv.md, contact.md)
   - Extracts H1 as title if present
   - Returns content as-is

4. **`fetchProjects(): Promise<Project[]>`**
   - Reads all `.md` files from `content/projects/`
   - Returns array of project objects

**Implementation Details**:
- Uses Astro's `import.meta.glob` for build-time file reading
- Uses `marked` library for markdown to HTML parsing
- All reading happens at build time (SSG)
- No runtime API calls
- Content changes require rebuild/redeploy

### Page Components

**Layout.astro**:
- Base HTML structure
- Navigation menu
- Meta tags (title, description, Open Graph)
- Global styles (inline CSS)
- Responsive, minimal design

**Dynamic Routes**:
- `blog/[slug].astro` uses `getStaticPaths()` to generate pages for all blog posts at build time
- Pre-renders all possible routes during build

### Type System (`src/lib/types.ts`)

```typescript
interface BlogPost {
  slug: string;         // URL-friendly identifier
  title: string;        // Extracted from filename
  date: string;         // ISO format (YYYY-MM-DD)
  content: string;      // Raw markdown
  excerpt?: string;     // First paragraph
}

interface ContentSection {
  title: string;        // From H1 or filename
  content: string;      // Raw markdown
}

interface Project {
  name: string;         // From filename
  content: string;      // Raw markdown
}
```

---

## Deployment Architecture

### Build Process

1. **Trigger**: Push to `master` branch
2. **GitHub Actions** (`.github/workflows/deploy.yml`):
   - Checkout repo
   - Setup pnpm and Node.js 20
   - Run `pnpm install` (install dependencies)
   - Run `pnpm build` (Astro build)
   - Deploy to Cloudflare Workers via `pnpm exec wrangler deploy`

3. **Astro Build**:
   - Reads all content from `/content` directory
   - Generates static HTML for all pages
   - Outputs to `/dist` directory
   - Creates `_worker.js` for Cloudflare Workers

4. **Cloudflare Workers**:
   - Serves static assets from `/dist`
   - Runs on global edge network
   - No server-side logic (pure SSG)

### Environment Variables & Secrets

**GitHub Secrets Required**:
- `CLOUDFLARE_API_TOKEN`: Cloudflare API token (Workers Deploy scope)
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID

**Configuration Files**:
- `wrangler.jsonc`: Workers name, compatibility date, assets directory
- `astro.config.mjs`: Site URL, build settings

---

## Content Authoring Guide

### Blog Posts

**Filename Format**: `YYYY-MM-DD-title-slug.md`

**Example**: `content/blog/2025-01-25-my-first-post.md`

**Parsing Logic**:
- Date: Extracted from filename prefix
- Title: Extracted from filename, hyphens → spaces, capitalized
- Excerpt: First paragraph after removing H1
- Slug: Filename without `.md` extension

**Content Example**:
```markdown
# My First Post

This paragraph becomes the excerpt shown in blog list.

Rest of your content here. Supports standard markdown:
- Lists
- **Bold** and *italic*
- [Links](https://example.com)
- Code blocks
```

### Projects

**Filename Format**: `project-name.md` (any name)

**Location**: `content/projects/`

**Example**:
```markdown
# Project Name

Description of the project...

## Features
- Feature 1
- Feature 2

## Tech Stack
- TypeScript
- React

**Links**: [GitHub](https://github.com/...)
```

### Static Pages (About, CV, Contact)

**Files**: `content/about.md`, `content/cv.md`, `content/contact.md`

**Format**: Standard markdown, optional H1 for title

---

## SEO & Discoverability

### Meta Tags
- Dynamic per page (title, description)
- Open Graph tags for social sharing
- Twitter Card tags

### robots.txt
- Allows all search engines
- Specifically allows: GPTBot, ChatGPT-User, Claude-Web, anthropic-ai
- Sitemap reference (implement later if needed)

### AI Agent Discoverability
- `.well-known/ai-plugin.json` manifest
- Describes site purpose for AI agents
- Enables discovery by OpenAI plugins, etc.

### Performance
- Static HTML (no JavaScript hydration)
- Global CDN (Cloudflare edge)
- Minimal CSS (inline, ~2KB)
- Fast First Contentful Paint

---

## Development Workflow

### Local Development

```bash
# Install dependencies
pnpm install

# Start dev server (http://localhost:4321)
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview

# Deploy to Cloudflare Workers
pnpm deploy
```

### Adding New Content

1. **Blog Post**:
   ```bash
   # Create file
   touch content/blog/2025-01-26-new-post.md
   
   # Edit content
   # Commit and push
   git add content/blog/2025-01-26-new-post.md
   git commit -m "Add new blog post"
   git push
   ```

2. **Project**:
   ```bash
   touch content/projects/new-project.md
   # Edit, commit, push
   ```

3. **Update About/CV/Contact**:
   ```bash
   # Edit existing file
   vim content/about.md
   # Commit and push
   ```

### Adding New Page Type

1. Create markdown file in `/content`
2. Create Astro page in `/src/pages`
3. Import and use `fetchContentSection()`
4. Add navigation link in `Layout.astro`

**Example** (`src/pages/skills.astro`):
```astro
---
import Layout from '../layouts/Layout.astro';
import { fetchContentSection } from '../lib/content';

const skills = await fetchContentSection('skills.md');
---

<Layout title="Skills">
  {skills ? (
    <div class="content" set:html={skills.content} />
  ) : (
    <p>Content not found</p>
  )}
</Layout>
```

---

## Code Conventions

### TypeScript
- Strict mode enabled
- Explicit return types preferred
- Async/await over promises
- Type imports with `import type`

### Astro
- Component props interfaces defined inline
- Frontmatter (---) contains all logic
- Minimal client-side JavaScript (none currently)
- HTML in template, CSS in `<style>` tags

### File Naming
- Components: PascalCase (Layout.astro)
- Utilities: camelCase (content.ts)
- Content: kebab-case (my-blog-post.md)

### Styling
- No CSS framework (intentional)
- Inline styles in Layout.astro
- Semantic HTML (nav, main, article)
- Minimal, functional design
- Mobile-responsive (max-width: 800px, padding)

---

## Common Tasks

### Change Site Styling

**File**: `src/layouts/Layout.astro`

**Section**: `<style>` tag

**Examples**:
- Font: Change `font-family`
- Colors: Update `color`, `background`
- Layout: Adjust `max-width`, `padding`
- Navigation: Modify `nav` styles

### Add External CSS/JS

**Not recommended** (goes against minimal philosophy), but if needed:

```astro
<!-- In Layout.astro <head> -->
<link rel="stylesheet" href="/styles.css">
<script src="/script.js"></script>
```

### Change Content Directory Structure

1. Update `content.ts` functions
2. Update path references
3. Update type definitions if needed

### Generate Sitemap (Future Enhancement)

Add to `astro.config.mjs`:
```javascript
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  integrations: [sitemap()],
  // ...
});
```

---

## Troubleshooting

### Build Fails
- Check TypeScript errors: `pnpm build`
- Verify all imports resolve
- Check content file syntax (valid markdown)

### Content Not Showing
- Verify file exists in `/content` directory
- Check filename format (especially blog posts)
- Ensure file committed to git
- Check build logs for errors

### Deployment Fails
- Verify GitHub secrets set correctly
- Check Cloudflare account ID
- Ensure wrangler.jsonc `name` is unique
- Review GitHub Actions logs

### Styling Issues
- All styles in `Layout.astro`
- Check browser DevTools
- Clear browser cache
- Verify build output in `/dist`

---

## Limitations & Constraints

### No Client-Side Rendering
- All content pre-rendered at build time
- No dynamic filtering/search without rebuild
- Good for: static content
- Not good for: real-time data, user interactions

### No Database
- Content stored as files
- No user-generated content
- No comments, likes, etc.
- Good for: personal blog/portfolio
- Not good for: collaborative sites

### Rebuild Required
- Content changes need redeploy
- ~2 min from push to live
- Can't edit content via web interface
- Good for: developer workflows
- Not good for: non-technical editors

### Cloudflare Workers Limits
- Free tier: 100,000 requests/day
- Build time: GitHub Actions limits
- File size: Workers script size limits
- See: Cloudflare Workers docs

---

## Future Enhancements

### Potential Additions (Not Implemented)

1. **Sitemap Generation**
   - Add `@astrojs/sitemap` integration
   - Automatic XML sitemap

2. **RSS Feed**
   - Add RSS generation for blog
   - Use `@astrojs/rss`

3. **Search**
   - Client-side search with lunr.js
   - Or API-based search

4. **Analytics**
   - Cloudflare Web Analytics
   - Privacy-focused tracking

5. **Comments**
   - Third-party: Giscus, utterances
   - GitHub discussions integration

6. **Markdown Extensions**
   - Syntax highlighting (Shiki)
   - Math rendering (KaTeX)
   - Mermaid diagrams

7. **Image Optimization**
   - Astro Image integration
   - WebP conversion
   - Lazy loading

---

## Dependencies

### Production
- `astro`: ^4.16.18 - Framework
- `marked`: ^17.0.1 - Markdown parser

### Development
- `typescript`: ^5.7.2 - Type checking
- `wrangler`: ^4.60.0 - Cloudflare CLI

### Node.js
- Required: v20 or higher
- Package manager: pnpm (required)

---

## Security Considerations

### No User Input
- Static site = no injection vectors
- No forms, no database
- Content controlled via git

### Content Security
- All content version controlled
- Review before deploy (git workflow)
- No runtime content modifications

### Secrets Management
- API tokens in GitHub Secrets
- Never commit tokens to repo
- Cloudflare API scoped to Workers deploy

### Dependencies
- Minimal dependency tree
- Regularly update Astro, Wrangler
- No client-side dependencies

---

## Performance Metrics

### Target Metrics
- **LCP** (Largest Contentful Paint): < 1.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1
- **TTFB** (Time to First Byte): < 200ms

### Optimization Strategies
- Static HTML (instant rendering)
- Minimal CSS (inline, no external requests)
- No JavaScript (zero parse/execute time)
- Edge deployment (low latency)
- No images yet (add optimization when needed)

---

## Maintenance

### Regular Tasks
- Update dependencies: `pnpm update`
- Review GitHub Actions runs
- Monitor Cloudflare analytics
- Update content regularly

### Version Control
- Master branch = production
- Direct commits acceptable (solo developer)
- Or use feature branches for major changes

### Backup
- Git repo IS the backup
- Content version controlled
- Deploy from any commit

---

## Claude Code Usage Notes

### Best Use Cases
- Adding new pages
- Refactoring content readers
- Styling updates
- Type system improvements
- Build configuration changes

### Provide Context
- "I want to add a new section called 'talks'"
- "Change the color scheme to dark mode"
- "Add markdown syntax highlighting"

### Project-Specific Patterns
- All content reading happens at build time
- Markdown rendered as raw HTML (`set:html`)
- No client-side state management
- TypeScript strict mode throughout

---

## Contact & Support

For issues with this codebase:
1. Check troubleshooting section
2. Review GitHub Actions logs
3. Check Astro documentation: https://docs.astro.build
4. Check Cloudflare Workers docs: https://developers.cloudflare.com/workers

Project Philosophy: Keep it simple, keep it fast, keep it maintainable.
