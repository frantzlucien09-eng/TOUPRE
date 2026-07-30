#!/usr/bin/env node
/**
 * TOUPRE production smoke checks (no live DB required).
 * Run: npm run smoke
 *
 * Verifies build artifacts, critical modules, and static flow contracts.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
let failed = 0;

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}
function fail(msg) {
  failed += 1;
  console.error(`  ✗ ${msg}`);
}

function assert(cond, msg) {
  if (cond) ok(msg);
  else fail(msg);
}

console.log('\nTOUPRE smoke tests\n');

// 1. Critical source modules exist
const criticalPaths = [
  'src/App.tsx',
  'src/main.tsx',
  'src/components/ErrorBoundary.tsx',
  'src/lib/supabase.ts',
  'src/lib/auth.tsx',
  'src/lib/listingStatus.ts',
  'src/lib/classifiedRules.ts',
  'src/lib/storageUrls.ts',
  'src/lib/payments/providers.ts',
  'src/pages/CustomerHome.tsx',
  'src/pages/ProductsPage.tsx',
  'src/pages/AdminProductsPage.tsx',
  'src/pages/AdminPaymentsPage.tsx',
  'supabase/migrations/20260730200000_harden_payment_rpc_security.sql',
  'supabase/functions/send-email-otp/index.ts',
  'vercel.json',
  '.env.example',
];
for (const p of criticalPaths) {
  assert(existsSync(join(root, p)), `exists ${p}`);
}

// 2. Security: OTP must not log plaintext codes
{
  const otp = readFileSync(join(root, 'supabase/functions/send-email-otp/index.ts'), 'utf8');
  assert(!otp.includes('${code})'), 'OTP edge function does not log raw OTP code');
  assert(otp.includes('buildCorsHeaders'), 'OTP edge function uses shared CORS helper');
  assert(otp.includes('ALLOW_DEV_OTP'), 'OTP echo gated by ALLOW_DEV_OTP');
}

// 3. Payment settle cannot be owner-forged (migration present)
{
  const mig = readFileSync(
    join(root, 'supabase/migrations/20260730200000_harden_payment_rpc_security.sql'),
    'utf8'
  );
  assert(mig.includes('v_is_settlement'), 'Payment RPC hardens settlement transitions');
  assert(mig.includes("auth.role() = 'service_role'"), 'Payment RPC checks service_role');
}

// 4. Classified contact-only helper
{
  const rules = readFileSync(join(root, 'src/lib/classifiedRules.ts'), 'utf8');
  assert(rules.includes('canAddProductToCart'), 'Classified cart gate helper exists');
  const listing = readFileSync(join(root, 'src/lib/listingStatus.ts'), 'utf8');
  assert(listing.includes('isClassifiedPubliclyVisible'), 'Public visibility helper exists');
}

// 5. Avatar path uses auth user id
{
  const profile = readFileSync(join(root, 'src/pages/ProfilePage.tsx'), 'utf8');
  assert(profile.includes('user.id'), 'Avatar upload uses auth user id');
  assert(!profile.includes('`${vendor.id}/${Date.now()}'), 'Avatar path not vendor.id');
}

// 6. Private buckets use signed URLs
{
  const media = readFileSync(join(root, 'src/lib/media.ts'), 'utf8');
  assert(media.includes('createSignedUrl'), 'Delivery proofs use signed URLs');
  const kyc = readFileSync(join(root, 'src/pages/KycOnboardingPage.tsx'), 'utf8');
  assert(!kyc.includes("getPublicUrl(path)"), 'KYC upload does not use getPublicUrl');
}

// 7. App has ErrorBoundary + lazy routes
{
  const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
  assert(app.includes('ErrorBoundary'), 'App wraps ErrorBoundary');
  assert(app.includes('lazy('), 'App uses lazy route loading');
  assert(app.includes('AdminAuthProvider'), 'Admin auth gated for admin route');
}

// 8. Package identity
{
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert(pkg.name === 'toupre', 'package.json name is toupre');
  assert(pkg.scripts?.smoke, 'smoke script defined');
}

// 9. Dist build optional (if present after npm run build)
const dist = join(root, 'dist');
if (existsSync(dist)) {
  assert(existsSync(join(dist, 'index.html')), 'dist/index.html present');
  const assets = join(dist, 'assets');
  if (existsSync(assets)) {
    const js = readdirSync(assets).filter((f) => f.endsWith('.js'));
    assert(js.length >= 2, `code-split produced multiple JS chunks (${js.length})`);
    const total = js.reduce((s, f) => s + statSync(join(assets, f)).size, 0);
    ok(`total JS assets ${(total / 1024).toFixed(0)} KB across ${js.length} files`);
  }
} else {
  console.log('  · dist/ missing — run npm run build before release smoke');
}

// 10. Demo seed file exists
assert(
  existsSync(join(root, 'supabase/seed/demo_production_data.sql')),
  'demo production seed SQL exists'
);

  // 11. Phase 1 customer commerce present on staging
  assert(existsSync(join(root, 'src/lib/cart.ts')), 'cart module exists');
  assert(existsSync(join(root, 'src/pages/CustomerCartPage.tsx')), 'CustomerCartPage exists');
  assert(existsSync(join(root, 'src/pages/CustomerCheckoutPage.tsx')), 'CustomerCheckoutPage exists');
  {
    const cart = readFileSync(join(root, 'src/lib/cart.ts'), 'utf8');
    assert(cart.includes('assertCanAddProductToCart'), 'cart blocks classified ads');
  }

console.log(failed === 0 ? '\nAll smoke checks passed.\n' : `\n${failed} smoke check(s) failed.\n`);
process.exit(failed === 0 ? 0 : 1);
