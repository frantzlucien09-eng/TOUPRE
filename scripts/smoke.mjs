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
  'src/lib/payments/moncash.ts',
  'src/lib/legal.ts',
  'src/lib/monitoring.ts',
  'src/lib/health.ts',
  'src/pages/CustomerHome.tsx',
  'src/pages/ProductsPage.tsx',
  'src/pages/AdminProductsPage.tsx',
  'src/pages/AdminPaymentsPage.tsx',
  'src/pages/LegalPage.tsx',
  'src/pages/PaymentReturnPage.tsx',
  'supabase/migrations/20260730200000_harden_payment_rpc_security.sql',
  'supabase/migrations/20260730210000_moncash_enable_and_legal_acceptance.sql',
  'supabase/functions/send-email-otp/index.ts',
  'supabase/functions/moncash-create-payment/index.ts',
  'supabase/functions/moncash-verify-payment/index.ts',
  'supabase/functions/payment-webhook/index.ts',
  'supabase/functions/health/index.ts',
  'supabase/functions/_shared/moncash.ts',
  'docs/MONCASH_INTEGRATION.md',
  'docs/BACKUP_AND_RESTORE.md',
  'docs/PRODUCTION_OPS.md',
  'docs/FINAL_PRODUCTION_READINESS_REPORT.md',
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

// 7. App has ErrorBoundary + lazy routes + legal + payment return
{
  const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
  assert(app.includes('ErrorBoundary'), 'App wraps ErrorBoundary');
  assert(app.includes('lazy('), 'App uses lazy route loading');
  assert(app.includes('AdminAuthProvider'), 'Admin auth gated for admin route');
  assert(app.includes('legal/'), 'App routes legal pages');
  assert(app.includes('payment/return'), 'App routes MonCash return');
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

// 11. Phase 1 customer commerce present
assert(existsSync(join(root, 'src/lib/cart.ts')), 'cart module exists');
assert(existsSync(join(root, 'src/pages/CustomerCartPage.tsx')), 'CustomerCartPage exists');
assert(existsSync(join(root, 'src/pages/CustomerCheckoutPage.tsx')), 'CustomerCheckoutPage exists');
{
  const cart = readFileSync(join(root, 'src/lib/cart.ts'), 'utf8');
  assert(cart.includes('assertCanAddProductToCart'), 'cart blocks classified ads');
  const checkout = readFileSync(join(root, 'src/pages/CustomerCheckoutPage.tsx'), 'utf8');
  assert(checkout.includes('initiatePaymentWithProvider'), 'checkout wires MonCash initiate');
  assert(checkout.includes('isMonCashLiveEnabled'), 'checkout gates on MonCash UI flag');
}

// 12. MonCash adapter + secrets not in client
{
  const moncash = readFileSync(join(root, 'src/lib/payments/moncash.ts'), 'utf8');
  assert(moncash.includes('moncash-create-payment'), 'MonCash client invokes create edge');
  assert(moncash.includes('moncash-verify-payment'), 'MonCash client invokes verify edge');
  assert(!moncash.includes('MONCASH_CLIENT_SECRET'), 'client moncash adapter has no client secret');
  const shared = readFileSync(join(root, 'supabase/functions/_shared/moncash.ts'), 'utf8');
  assert(shared.includes('CreatePayment'), 'shared MonCash CreatePayment helper');
  assert(shared.includes('RetrieveOrderPayment'), 'shared MonCash capture-by-order');
  assert(shared.includes('verifyMoncashWebhookSecret'), 'shared webhook secret helper');
  const envEx = readFileSync(join(root, '.env.example'), 'utf8');
  assert(envEx.includes('VITE_MONCASH_ENABLED'), '.env.example documents UI gate');
  assert(envEx.includes('MONCASH_CLIENT_SECRET'), '.env.example documents Edge secrets');
}

// 13. Legal docs + signup acceptance
{
  const legal = readFileSync(join(root, 'src/lib/legal.ts'), 'utf8');
  assert(legal.includes('privacy:'), 'legal privacy doc');
  assert(legal.includes('terms:'), 'legal terms doc');
  assert(legal.includes("'vendor-terms'") || legal.includes('vendor-terms:'), 'legal vendor-terms doc');
  assert(legal.includes("'classified-policy'") || legal.includes('classified-policy:'), 'legal classified policy');
  assert(legal.includes("'payment-policy'") || legal.includes('payment-policy:'), 'legal payment policy');
  assert(legal.includes("'refund-policy'") || legal.includes('refund-policy:'), 'legal refund policy');
  const auth = readFileSync(join(root, 'src/pages/AuthPage.tsx'), 'utf8');
  assert(auth.includes('terms_accepted_at'), 'signup records terms acceptance');
  assert(auth.includes('privacy_accepted_at'), 'signup records privacy acceptance');
  assert(auth.includes('#/legal/'), 'signup links to legal routes');
}

// 14. Ops / monitoring bootstrapped
{
  const main = readFileSync(join(root, 'src/main.tsx'), 'utf8');
  assert(main.includes('initClientMonitoring'), 'main initializes client monitoring');
  const health = readFileSync(join(root, 'supabase/functions/health/index.ts'), 'utf8');
  assert(health.includes('moncash'), 'health reports MonCash credential presence');
}

console.log(failed === 0 ? '\nAll smoke checks passed.\n' : `\n${failed} smoke check(s) failed.\n`);
process.exit(failed === 0 ? 0 : 1);
