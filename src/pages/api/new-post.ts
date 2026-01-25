import type { APIRoute } from 'astro';

export const prerender = false;

// Convert string to base64 (Workers-compatible, handles UTF-8)
function stringToBase64(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Brute force protection (in-memory, resets on cold start)
const failedAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION = 60 * 60 * 1000; // 1 hour
const CAPTCHA_THRESHOLD = 2; // Show CAPTCHA after 2 failed attempts

interface AuthCheck {
  allowed: boolean;
  locked: boolean;
  requiresCaptcha: boolean;
  retryAfter?: number;
  failedCount: number;
}

function checkBruteForce(ip: string): AuthCheck {
  const now = Date.now();
  const record = failedAttempts.get(ip);

  // No record = first attempt
  if (!record) {
    return { allowed: true, locked: false, requiresCaptcha: false, failedCount: 0 };
  }

  // Check if locked out
  if (record.lockedUntil > now) {
    const retryAfter = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      allowed: false,
      locked: true,
      requiresCaptcha: true,
      retryAfter,
      failedCount: record.count
    };
  }

  // Lockout expired, reset
  if (record.lockedUntil > 0 && record.lockedUntil <= now) {
    failedAttempts.delete(ip);
    return { allowed: true, locked: false, requiresCaptcha: false, failedCount: 0 };
  }

  // Check if CAPTCHA required (2+ failed attempts)
  const requiresCaptcha = record.count >= CAPTCHA_THRESHOLD;

  return {
    allowed: true,
    locked: false,
    requiresCaptcha,
    failedCount: record.count
  };
}

function recordFailedAttempt(ip: string): { locked: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = failedAttempts.get(ip) || { count: 0, lockedUntil: 0 };

  record.count++;

  // Lock out after MAX_ATTEMPTS
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION;
    failedAttempts.set(ip, record);
    return { locked: true, retryAfter: Math.ceil(LOCKOUT_DURATION / 1000) };
  }

  failedAttempts.set(ip, record);
  return { locked: false };
}

function clearFailedAttempts(ip: string): void {
  failedAttempts.delete(ip);
}

// Verify Cloudflare Turnstile CAPTCHA
async function verifyCaptcha(token: string, secretKey: string, ip: string): Promise<boolean> {
  if (!token || !secretKey) return false;

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
        remoteip: ip,
      }),
    });

    const result = await response.json() as { success: boolean };
    return result.success;
  } catch {
    return false;
  }
}

// GitHub API helper with retry logic
async function githubAPI(
  endpoint: string,
  token: string,
  method: string = 'GET',
  body?: object
): Promise<Response> {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': '121eliasson-blog',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return response;
}

function generateSlug(title: string): string {
  const date = new Date().toISOString().split('T')[0];
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50)
    .replace(/-$/, '');

  return `${date}-${titleSlug}`;
}

export const POST: APIRoute = async ({ request, clientAddress, locals }) => {
  const ip = clientAddress || 'unknown';

  // Check brute force protection
  const authCheck = checkBruteForce(ip);

  if (authCheck.locked) {
    return new Response(
      JSON.stringify({
        error: 'Too many failed attempts. Try again later.',
        locked: true,
        retryAfter: authCheck.retryAfter
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(authCheck.retryAfter),
        },
      }
    );
  }

  try {
    const body = await request.json();
    const { password, title, content, tags, featured, image, captchaToken } = body;

    // Get environment variables from Cloudflare runtime
    const runtime = (locals as any).runtime;
    const cfEnv = runtime?.env || {};

    // Fallback to import.meta.env for local dev
    const ADMIN_PASSWORD = cfEnv.ADMIN_PASSWORD || import.meta.env.ADMIN_PASSWORD;
    const GITHUB_TOKEN = cfEnv.GITHUB_TOKEN || import.meta.env.GITHUB_TOKEN;
    const GITHUB_OWNER = cfEnv.GITHUB_OWNER || import.meta.env.GITHUB_OWNER;
    const GITHUB_REPO = cfEnv.GITHUB_REPO || import.meta.env.GITHUB_REPO;
    const GITHUB_BRANCH = cfEnv.GITHUB_BRANCH || import.meta.env.GITHUB_BRANCH || 'master';
    const TURNSTILE_SECRET = cfEnv.TURNSTILE_SECRET_KEY || import.meta.env.TURNSTILE_SECRET_KEY;

    // If CAPTCHA is required (2+ failed attempts), verify it
    if (authCheck.requiresCaptcha) {
      if (!captchaToken) {
        return new Response(
          JSON.stringify({
            error: 'CAPTCHA required',
            requiresCaptcha: true,
            failedAttempts: authCheck.failedCount
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const captchaValid = await verifyCaptcha(captchaToken, TURNSTILE_SECRET, ip);
      if (!captchaValid) {
        return new Response(
          JSON.stringify({
            error: 'CAPTCHA verification failed',
            requiresCaptcha: true
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate password
    if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
      const lockResult = recordFailedAttempt(ip);
      const failedRecord = failedAttempts.get(ip);

      return new Response(
        JSON.stringify({
          error: 'Invalid password',
          locked: lockResult.locked,
          retryAfter: lockResult.retryAfter,
          requiresCaptcha: (failedRecord?.count || 0) >= CAPTCHA_THRESHOLD,
          attemptsRemaining: MAX_ATTEMPTS - (failedRecord?.count || 0)
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Password correct - clear failed attempts
    clearFailedAttempts(ip);

    // Validate required fields
    if (!title || !content) {
      return new Response(
        JSON.stringify({ error: 'Title and content are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate environment
    if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
      return new Response(
        JSON.stringify({
          error: 'Server configuration error: Missing GitHub settings',
          debug: {
            hasToken: !!GITHUB_TOKEN,
            hasOwner: !!GITHUB_OWNER,
            hasRepo: !!GITHUB_REPO
          }
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const slug = generateSlug(title);
    const commits: Array<{ path: string; content: string }> = [];

    // Process image if provided
    let imagePath = '';
    if (image && image.base64) {
      const imageFilename = `${slug}.${image.format || 'webp'}`;
      imagePath = `/images/blog/${imageFilename}`;

      commits.push({
        path: `public${imagePath}`,
        content: image.base64,
      });
    }

    // Generate markdown content
    const frontmatter = [
      '---',
      `tags: [${tags?.join(', ') || ''}]`,
    ];

    if (featured) {
      frontmatter.push('featured: true');
    }

    frontmatter.push('---');

    let markdownContent = frontmatter.join('\n') + '\n\n';
    markdownContent += `# ${title}\n\n`;

    if (imagePath) {
      markdownContent += `![](${imagePath})\n\n`;
    }

    markdownContent += content;

    commits.push({
      path: `content/blog/${slug}.md`,
      content: stringToBase64(markdownContent),
    });

    // Get current commit SHA (needed for creating new commits)
    const refResponse = await githubAPI(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${GITHUB_BRANCH}`,
      GITHUB_TOKEN
    );

    if (!refResponse.ok) {
      const error = await refResponse.text();
      throw new Error(`Failed to get branch ref: ${error}`);
    }

    const refData = await refResponse.json();
    const baseSha = refData.object.sha;

    // Get base tree
    const baseCommitResponse = await githubAPI(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits/${baseSha}`,
      GITHUB_TOKEN
    );

    if (!baseCommitResponse.ok) {
      throw new Error('Failed to get base commit');
    }

    const baseCommit = await baseCommitResponse.json();
    const baseTreeSha = baseCommit.tree.sha;

    // Create blobs for each file
    const treeItems = [];

    for (const commit of commits) {
      const blobResponse = await githubAPI(
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/blobs`,
        GITHUB_TOKEN,
        'POST',
        {
          content: commit.content,
          encoding: 'base64',
        }
      );

      if (!blobResponse.ok) {
        const error = await blobResponse.text();
        throw new Error(`Failed to create blob for ${commit.path}: ${error}`);
      }

      const blob = await blobResponse.json();

      treeItems.push({
        path: commit.path,
        mode: '100644',
        type: 'blob',
        sha: blob.sha,
      });
    }

    // Create tree
    const treeResponse = await githubAPI(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees`,
      GITHUB_TOKEN,
      'POST',
      {
        base_tree: baseTreeSha,
        tree: treeItems,
      }
    );

    if (!treeResponse.ok) {
      const error = await treeResponse.text();
      throw new Error(`Failed to create tree: ${error}`);
    }

    const tree = await treeResponse.json();

    // Create commit
    const commitResponse = await githubAPI(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/commits`,
      GITHUB_TOKEN,
      'POST',
      {
        message: `Add blog post: ${title}`,
        tree: tree.sha,
        parents: [baseSha],
      }
    );

    if (!commitResponse.ok) {
      const error = await commitResponse.text();
      throw new Error(`Failed to create commit: ${error}`);
    }

    const newCommit = await commitResponse.json();

    // Update branch reference
    const updateRefResponse = await githubAPI(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs/heads/${GITHUB_BRANCH}`,
      GITHUB_TOKEN,
      'PATCH',
      {
        sha: newCommit.sha,
      }
    );

    if (!updateRefResponse.ok) {
      const error = await updateRefResponse.text();
      throw new Error(`Failed to update branch: ${error}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        slug,
        message: 'Post created successfully. Site will rebuild automatically.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Error creating post:', err);

    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Unknown error occurred',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
