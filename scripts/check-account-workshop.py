"""Browser checks for a separately running synthetic preview. Requires Playwright Python/Chromium."""
import argparse
import json
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:4321')
parser.add_argument('--output', default='/tmp/atliera-workshop-browser')
parser.add_argument('--context-only', action='store_true')
args = parser.parse_args()
assert urlparse(args.url).hostname == '127.0.0.1', 'Synthetic loopback preview only'
out = Path(args.output)
out.mkdir(parents=True, exist_ok=True)
results = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for width, height in [(1440, 1100), (1024, 900), (390, 844)]:
        context = browser.new_context(viewport={'width': width, 'height': height})
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))

        def capture(kind):
            metrics = page.evaluate('''() => ({width: innerWidth, document: document.documentElement.scrollWidth,
                textSize: parseFloat(getComputedStyle(document.querySelector('main p')).fontSize)})''')
            assert metrics['document'] <= metrics['width'], metrics
            assert metrics['textSize'] >= 12, metrics
            assert page.locator('[id]').evaluate_all('nodes => new Set(nodes.map(n => n.id)).size === nodes.length')
            page.screenshot(path=str(out / f'{width}-{kind}.png'), full_page=True)
            results.append({'viewport': [width, height], 'page': kind, **metrics})

        page.goto(args.url)
        expect(page.locator('.recorded-mode').first).to_contain_text('Synthetic local preview')
        capture('account')
        page.get_by_role('link', name='Open Workshop', exact=False).click()
        for kind, label in [('strategy', 'Strategy'), ('next-steps', 'Next steps')]:
            page.get_by_role('link', name=label, exact=True).click()
            page.get_by_text('Edit brief setup', exact=True).click()
            setup = page.locator(f'[data-edit-key="{kind}-setup"]')
            setup.locator('[name="audience"]').fill(f'{label} audience')
            setup.locator('[name="intendedOutcome"]').fill(f'{label} outcome')
            setup.get_by_role('button', name='Keep brief setup').click()
            expect(setup.locator('[data-local-status]')).to_contain_text('Session edit kept')
            page.get_by_text('Edit brief setup', exact=True).click()
            capture(kind)
        page.go_back()
        expect(page.locator('main h1')).to_have_text('Strategy brief')
        page.get_by_text('Edit Options and tradeoffs', exact=True).click()
        form = page.locator('[data-edit-key="strategy-options"]')
        form.locator('textarea').fill('Compare an investigation with waiting for evidence.')
        form.get_by_role('button', name='Keep section edit').click()
        expect(form.locator('[data-local-status]')).to_contain_text('Session edit kept')
        form.locator('textarea').fill('Unsubmitted typing to recover')
        page.reload()
        form = page.locator('[data-edit-key="strategy-options"]')
        expect(form.locator('textarea')).to_have_value('Unsubmitted typing to recover')
        form.get_by_role('button', name='Cancel edit').click()
        expect(form.locator('textarea')).to_have_value('Compare an investigation with waiting for evidence.')
        page.get_by_role('link', name='Next steps', exact=True).click()
        expect(page.locator('main')).not_to_contain_text('Compare an investigation')
        page.get_by_role('link', name='Account Intel', exact=True).click()
        expect(page.locator('main')).not_to_contain_text('Compare an investigation')
        if not args.context_only:
            page.get_by_role('link', name='Workshop', exact=True).click()
            page.get_by_role('button', name='Replay exact recorded response', exact=True).click()
            page.get_by_role('button', name='Cancel', exact=True).click()
            expect(page.locator('[data-status]')).to_contain_text('stopped')
            page.get_by_role('button', name='Replay exact recorded response', exact=True).click()
            expect(page.get_by_role('heading', name='Your meeting brief')).to_be_visible()
            capture('meeting')
            page.locator('[data-evidence-link]').first.click()
            expect(page.locator('#evidence-1')).to_have_attribute('open', '')
            page.locator('#evidence-1 [data-evidence-return]').click()
            note = page.locator('[data-correction-note]')
            note.fill('User note only')
            page.get_by_role('button', name='Keep note for this session').click()
            expect(page.locator('[data-review-status]')).to_contain_text('Note kept')
            page.get_by_role('button', name='Keep note for this session').click()
            expect(page.locator('[data-review-status]')).to_contain_text('unchanged')
            note.fill('')
            page.get_by_role('button', name='Keep note for this session').click()
            expect(page.locator('[data-review-status]')).to_contain_text('Note kept')
            page.reload()
            expect(page.locator('[data-correction-note]')).to_have_value('')
            page.get_by_role('link', name='Return to recorded request').click()
            page.locator('[name="audience"]').fill('Unmatched audience')
            page.get_by_role('button', name='Replay exact recorded response', exact=True).click()
            expect(page.locator('[data-status]')).to_contain_text('exact-match refused')
            page.get_by_role('link', name='Reopen session draft', exact=True).click()
            page.get_by_text('Exact correction available for the recorded revision', exact=True).click()
            page.get_by_role('button', name='Use exact recorded correction').click()
            page.get_by_role('button', name='Request revised draft').click()
            page.get_by_role('button', name='Replay exact recorded response', exact=True).click()
            expect(page.get_by_role('heading', name='Your meeting brief')).to_be_visible()
            expect(page.locator('main')).to_contain_text('Confirm who could own a useful follow-up')
            capture('revised-meeting')
        page.keyboard.press('Tab')
        assert page.evaluate('document.activeElement !== document.body')
        assert not errors, errors
        context.close()
    browser.close()
(out / 'measurements.json').write_text(json.dumps(results, indent=2))
print(f'Browser assertions passed. Inspect screenshots in {out}; synthetic testing is not real-user acceptance.')
