import { test, expect } from '@playwright/test';

test('basic: marker replaced, template removed', async ({ page }) => {
    await page.goto('./tests/basic.html');
    await page.waitForTimeout(2000);
    await expect(page.locator('#target')).toHaveAttribute('mark', 'good');
});

test('gist-in-for-hint scopes the patch to the matching parent only', async ({ page }) => {
    await page.goto('./tests/hint.html');
    await page.waitForTimeout(2000);
    await expect(page.locator('#target')).toHaveAttribute('mark', 'good');
});

test('marker not found: template is left alone', async ({ page }) => {
    await page.goto('./tests/not-found.html');
    await page.waitForTimeout(2000);
    await expect(page.locator('#target')).toHaveAttribute('mark', 'good');
});

test('default sanitizing strips scripts and dangerous attributes', async ({ page }) => {
    await page.goto('./tests/sanitize.html');
    await page.waitForTimeout(2000);
    await expect(page.locator('#target')).toHaveAttribute('mark', 'good');
});

test('gist-in-show-edit-link renders a working GitHub edit URL', async ({ page }) => {
    await page.goto('./tests/edit-link.html');
    await page.waitForTimeout(2000);
    await expect(page.locator('#target')).toHaveAttribute('mark', 'good');
});

test('gist:// USL (explicit owner/id/raw form) resolves via fifteenth', async ({ page }) => {
    await page.goto('./tests/gist-usl.html');
    await page.waitForTimeout(2000);
    await expect(page.locator('#target')).toHaveAttribute('mark', 'good');
});

test('?gist-in-show-edit-link=true shows the edit link with no attribute needed', async ({ page }) => {
    await page.goto('./tests/query-override.html?gist-in-show-edit-link=true');
    await page.waitForTimeout(2000);
    await expect(page.locator('#target')).toHaveAttribute('mark', 'good');
});

test('without the query string or attribute, no edit link appears', async ({ page }) => {
    await page.goto('./tests/query-override.html');
    await page.waitForTimeout(2000);
    // content still patches in either way
    await expect(page.locator('#host em')).toHaveCount(1);
    await expect(page.locator('a[href*="gist.github.com"]')).toHaveCount(0);
});

// Documents a real, verified limitation (see implementation notes): the
// *default* Sanitizer configuration gist-in always applies strips real
// <option> elements entirely — the README's own flagship <select> example
// needs an explicit sanitizer/unsafe opt-in to actually retain them.
test('known limitation: default sanitizer strips real <option> elements', async ({ page }) => {
    await page.goto('./tests/select-options-stripped.html');
    await page.waitForTimeout(2000);
    await expect(page.locator('#target')).toHaveAttribute('mark', 'good');
});

test('gist-in-unsafe keeps real <option> elements (setHTMLUnsafe, no sanitizing)', async ({ page }) => {
    await page.goto('./tests/unsafe.html');
    await page.waitForTimeout(2000);
    await expect(page.locator('#target')).toHaveAttribute('mark', 'good');
});

test('gist-in-sanitizer allow-lists <option> without going fully unsafe', async ({ page }) => {
    await page.goto('./tests/custom-sanitizer.html');
    await page.waitForTimeout(2000);
    await expect(page.locator('#target')).toHaveAttribute('mark', 'good');
});

// Security gate, mirroring pipe-in.js exactly: setHTMLUnsafe / a custom
// sanitizer is only honored for a same-origin path, an import-map-mapped bare
// specifier, or a gist:// USL — never a literal cross-origin URL.
test('security gate: a literal cross-origin URL cannot use gist-in-method=setHTMLUnsafe', async ({ page }) => {
    const warnings = [];
    page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); });
    await page.goto('./tests/untrusted-unsafe.html');
    await page.waitForTimeout(2000);
    await expect(page.locator('#target')).toHaveAttribute('mark', 'good');
    expect(warnings.some(w => w.includes('[gist-in] Security'))).toBe(true);
});

test('security gate: an import-map-mapped bare specifier is trusted for setHTMLUnsafe', async ({ page }) => {
    await page.goto('./tests/trusted-bare-specifier.html');
    await page.waitForTimeout(2000);
    await expect(page.locator('#target')).toHaveAttribute('mark', 'good');
});
