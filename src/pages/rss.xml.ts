import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { fetchBlogPosts } from '../lib/content';

export async function GET(context: APIContext) {
  const posts = await fetchBlogPosts();

  return rss({
    title: '121Eliasson - Erik\'s Blog',
    description: 'Security, AI, Technology and Health insights from Erik Eliasson',
    site: context.site || 'https://121eliasson.com',
    items: posts.map((post) => ({
      title: post.title,
      pubDate: new Date(post.date),
      description: post.excerpt || '',
      link: `/blog/${post.slug}/`,
    })),
    customData: `<language>en-us</language>
<copyright>Copyright ${new Date().getFullYear()} Erik Eliasson</copyright>
<managingEditor>erik@121eliasson.com (Erik Eliasson)</managingEditor>
<webMaster>erik@121eliasson.com (Erik Eliasson)</webMaster>
<category>Technology</category>
<category>Security</category>
<category>Artificial Intelligence</category>`,
  });
}
