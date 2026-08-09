/**
 * Deletes contact form submissions older than the retention period stated in
 * the privacy policy.
 *
 * Netlify has no retention setting for form submissions. Deploys are cleaned
 * up after 90 days; submissions are kept forever until someone deletes them.
 * The privacy policy at /privacy promises 6 months, so something has to
 * enforce it, otherwise the policy is simply untrue.
 *
 * Deliberately dependency-free: Node 20 has fetch built in, and this keeps
 * the site's dependency tree unchanged.
 *
 * Environment:
 *   NETLIFY_AUTH_TOKEN  required, a personal access token
 *   NETLIFY_SITE_ID     required, the site's API ID
 *   RETENTION_MONTHS    optional, defaults to 6
 *   DRY_RUN             optional, "true" reports without deleting anything
 *
 * Note this only clears the Netlify side. The notification copies sitting in
 * the mailbox are a separate store and still have to be cleared by hand.
 */

const API = 'https://api.netlify.com/api/v1';

const token = process.env.NETLIFY_AUTH_TOKEN;
const siteId = process.env.NETLIFY_SITE_ID;
const retentionMonths = Number(process.env.RETENTION_MONTHS ?? 6);
const dryRun = process.env.DRY_RUN === 'true';

if (!token || !siteId) {
  console.error(
    'Missing NETLIFY_AUTH_TOKEN or NETLIFY_SITE_ID. Refusing to run rather ' +
      'than silently doing nothing and reporting success.',
  );
  process.exit(1);
}

if (!Number.isInteger(retentionMonths) || retentionMonths < 1) {
  console.error(`RETENTION_MONTHS must be a positive integer, got: ${process.env.RETENTION_MONTHS}`);
  process.exit(1);
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.status === 204 ? null : res.json();
}

/** Netlify paginates submissions. Walk every page, not just the first. */
async function allSubmissions(formId) {
  const out = [];
  const perPage = 100;
  for (let page = 1; ; page++) {
    const batch = await api(`/forms/${formId}/submissions?page=${page}&per_page=${perPage}`);
    if (!Array.isArray(batch)) {
      throw new Error(`Expected an array of submissions, got ${typeof batch}`);
    }
    out.push(...batch);
    if (batch.length < perPage) return out;
  }
}

const cutoff = new Date();
cutoff.setMonth(cutoff.getMonth() - retentionMonths);

console.log(
  `Retention: ${retentionMonths} months. Deleting submissions created before ` +
    `${cutoff.toISOString()}.${dryRun ? ' DRY RUN - nothing will be deleted.' : ''}`,
);

const forms = await api(`/sites/${siteId}/forms`);
if (!Array.isArray(forms)) {
  throw new Error('Expected an array of forms from the Netlify API.');
}
if (forms.length === 0) {
  console.log('No forms on this site. Nothing to do.');
  process.exit(0);
}

let deleted = 0;
let kept = 0;
let failed = 0;

for (const form of forms) {
  const submissions = await allSubmissions(form.id);
  console.log(`\nForm "${form.name}" (${form.id}): ${submissions.length} submission(s)`);

  for (const submission of submissions) {
    const created = new Date(submission.created_at);
    if (Number.isNaN(created.getTime())) {
      console.warn(`  ! ${submission.id} has an unreadable created_at, keeping it to be safe`);
      kept++;
      continue;
    }

    if (created >= cutoff) {
      kept++;
      continue;
    }

    const age = created.toISOString().slice(0, 10);
    if (dryRun) {
      console.log(`  would delete ${submission.id} (${age})`);
      deleted++;
      continue;
    }

    try {
      await api(`/submissions/${submission.id}`, { method: 'DELETE' });
      console.log(`  deleted ${submission.id} (${age})`);
      deleted++;
    } catch (err) {
      console.error(`  FAILED to delete ${submission.id} (${age}): ${err.message}`);
      failed++;
    }
  }
}

console.log(
  `\n${dryRun ? 'Would delete' : 'Deleted'}: ${deleted}. Kept: ${kept}. Failed: ${failed}.`,
);

// A failed delete means data outlived the policy. Surface it rather than
// letting the run go green.
if (failed > 0) process.exit(1);
