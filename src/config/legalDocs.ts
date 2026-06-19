/**
 * Public URLs for the Privacy Policy and Terms of Service.
 *
 * Both documents live in `docs/PRIVACY_POLICY.md` and
 * `docs/TERMS_OF_SERVICE.md` in the repo. To make them reachable to
 * App Store + Play Store reviewers (which both require) push those
 * markdown files to a public GitHub repo and enable GitHub Pages
 * (Settings → Pages → main branch → /docs folder). GitHub will host
 * them at the URLs below.
 *
 * Until that's done, the App Store / Play Store reviewers cannot
 * follow these links, which is a SUBMISSION BLOCKER. After hosting,
 * confirm the URLs render and replace the GITHUB_USER placeholder.
 */

// Repo hosted at github.com/ttradez/trading-app — legal docs render
// via GitHub Pages from the /docs folder on the main branch. Confirm
// at https://ttradez.github.io/trading-app/PRIVACY_POLICY after
// enabling Pages in repo Settings.
const GITHUB_USER = 'ttradez';
const REPO        = 'trading-app';
const BRANCH      = 'main';

export const PRIVACY_POLICY_URL =
  `https://${GITHUB_USER}.github.io/${REPO}/PRIVACY_POLICY`;

export const TERMS_OF_SERVICE_URL =
  `https://${GITHUB_USER}.github.io/${REPO}/TERMS_OF_SERVICE`;

/**
 * Fallback raw-markdown URLs in case GitHub Pages isn't set up.
 * These resolve to the raw .md files in the repo — readable but
 * unformatted. Some reviewers will accept these; some will reject
 * them as not user-facing. Use ONLY as a temporary backup.
 */
export const PRIVACY_POLICY_RAW =
  `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO}/${BRANCH}/docs/PRIVACY_POLICY.md`;

export const TERMS_OF_SERVICE_RAW =
  `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO}/${BRANCH}/docs/TERMS_OF_SERVICE.md`;
