import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://alexemm.com',
  integrations: [
    sitemap({
      // The form thank-you page is not a destination anyone should arrive
      // at from search. It is also noindexed at the page level - this just
      // stops us advertising it.
      filter: (page) => !page.includes('/contact/success'),
      lastmod: new Date(),
    }),
  ],
});
