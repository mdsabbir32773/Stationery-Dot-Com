import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const workflow = read('../.github/workflows/deploy-cloudflare.yml');
const navbar = read('../src/components/Navbar.jsx');
const responsive = read('../src/global-responsive.css');

const deployStart = workflow.indexOf('      - name: Deploy to Cloudflare Workers');
const healthStart = workflow.indexOf('      - name: Verify production HTTP health', deployStart);
const smokeStart = workflow.indexOf('      - name: Trigger live UI smoke test', healthStart);
if (deployStart < 0 || healthStart < 0 || smokeStart < 0) {
  throw new Error('Deployment workflow is missing a required deploy, health-check, or smoke-test step.');
}

const deployStep = workflow.slice(deployStart, healthStart);
const healthStep = workflow.slice(healthStart, smokeStart);
const smokeStep = workflow.slice(smokeStart);
const tokenReference = 'CLOUDFLARE_API_TOKEN: $' + '{{ secrets.CLOUDFLARE_API_TOKEN }}';
const tokenAccount = 'CLOUDFLARE_ACCOUNT_ID: 5048da0aa184b4fbb033f13a83d1cac6';

if (!deployStep.includes(tokenReference) || !deployStep.includes(tokenAccount)) {
  throw new Error('Cloudflare token/account configuration must be attached to the deploy step.');
}
if (healthStep.includes('CLOUDFLARE_API_TOKEN') || healthStep.includes('CLOUDFLARE_ACCOUNT_ID')) {
  throw new Error('Cloudflare deploy credentials must not be attached to the public HTTP health-check step.');
}
if (!healthStep.includes('run: npm run check:live-site')) {
  throw new Error('Post-deploy production HTTP health check is missing.');
}
if (!smokeStep.includes('GH_TOKEN: $' + '{{ github.token }}') || !smokeStep.includes('gh workflow run sdc-ui-smoke.yml')) {
  throw new Error('Deployment must trigger the live UI smoke workflow with the GitHub token.');
}
if (!workflow.includes('timeout-minutes: 15')) {
  throw new Error('Deployment job must have a bounded timeout.');
}
if (!workflow.includes('actions/checkout@v5') || !workflow.includes('actions/setup-node@v5')) {
  throw new Error('Deployment workflow must use the maintained Node 24-compatible GitHub Actions.');
}
if (!navbar.includes('className="sdc-mobile-nav"')) {
  throw new Error('Navbar component is missing the mobile quick navigation.');
}
if (!/header\s+\.nav\s+\.sdc-mobile-nav\s*\{\s*display\s*:\s*grid\s*!important\s*;\s*\}/.test(responsive)) {
  throw new Error('Mobile quick navigation must not be hidden by the global responsive CSS override.');
}
if (/header\s+\.nav\s+\.sdc-mobile-nav\s*\{\s*display\s*:\s*none\s*!important/.test(responsive)) {
  throw new Error('Global responsive CSS hides the mobile quick navigation.');
}

console.log('PASS: deployment credentials, post-deploy checks, workflow timeout, action runtimes and mobile quick-nav CSS are correctly configured.');
