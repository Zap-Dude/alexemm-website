import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  // The blog is empty, so this feed ships empty. That is the point: it
  // works from the first post rather than being remembered afterwards.
  const posts = await getCollection('blog', ({ data }) => !data.draft);

  return rss({
    title: 'Alex Emmanouilidis',
    description:
      'Writing from Alexandros Emmanouilidis - Computer Science student, fencer, and writer based in Cyprus.',
    site: context.site,
    items: posts
      .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
      .map((post) => ({
        title: post.data.title,
        description: post.data.description,
        pubDate: post.data.date,
        categories: post.data.tags,
        link: `/blog/${post.id}/`,
      })),
    customData: '<language>en-gb</language>',
  });
}
