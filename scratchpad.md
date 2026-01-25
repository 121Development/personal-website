/new Route Features

  - Password-protected form with title, tags, content, image upload, featured checkbox
  - Client-side image processing - resizes to max 1024px width, converts to WebP
  - Rate limiting - 5 requests/minute per IP
  - Retry logic - exponential backoff for GitHub API rate limits

  Setup Required

  In Cloudflare Dashboard → Workers → Your Worker → Settings → Variables:

  Add these secrets (encrypted):
  ┌────────────────┬───────────────────────────────────────┐
  │    Variable    │                 Value                 │
  ├────────────────┼───────────────────────────────────────┤
  │ ADMIN_PASSWORD │ Your chosen password for /new         │
  ├────────────────┼───────────────────────────────────────┤
  │ GITHUB_TOKEN   │ Personal Access Token with repo scope │
  ├────────────────┼───────────────────────────────────────┤
  │ GITHUB_OWNER   │ Your GitHub username                  │
  ├────────────────┼───────────────────────────────────────┤
  │ GITHUB_REPO    │ Repository name (e.g., personal-blog) │
  └────────────────┴───────────────────────────────────────┘
  Creating GitHub Token

  1. Go to GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
  2. Create token with:
    - Repository access: Only select your blog repo
    - Permissions: Contents (Read and write)

  How It Works

  User fills form at /new
      ↓ client resizes image to WebP
      ↓ submits with password
  API validates & rate-checks
      ↓ uses GitHub API to commit:
         - Image to public/images/blog/
         - Markdown to content/blog/
      ↓ GitHub Actions triggers rebuild
  Site deploys with new post (~2 min)


    Brute Force Protection
  ┌──────────┬────────────────────────────────────────┐
  │ Attempts │                Behavior                │
  ├──────────┼────────────────────────────────────────┤
  │ 1-2      │ Normal login, shows remaining attempts │
  ├──────────┼────────────────────────────────────────┤
  │ 2+       │ CAPTCHA required                       │
  ├──────────┼────────────────────────────────────────┤
  │ 3        │ 1 hour lockout                         │
  └──────────┴────────────────────────────────────────┘
  Setup Required

  In Cloudflare Dashboard:

  1. Go to Turnstile → Add Site
  2. Choose "Managed" widget type
  3. Add your domain
  4. Get the Site Key and Secret Key

  Add to Workers secrets:
  ┌──────────────────────┬───────────────────────┐
  │       Variable       │         Type          │
  ├──────────────────────┼───────────────────────┤
  │ TURNSTILE_SITE_KEY   │ Can be plain variable │
  ├──────────────────────┼───────────────────────┤
  │ TURNSTILE_SECRET_KEY │ Should be secret      │
  └──────────────────────┴───────────────────────┘