import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://alexemm.com',
  // Astro inlines small hoisted scripts into the HTML. That would force the
  // CSP to carry either 'unsafe-inline' or a hash of the script, and a hash
  // silently breaks the mobile nav the moment the script changes. Emitting a
  // real file instead lets script-src stay a plain 'self'.
  vite: {
    build: {
      assetsInlineLimit: 0,
    },
  },
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
