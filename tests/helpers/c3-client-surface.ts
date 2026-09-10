import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { C3_CLIENT_SCRIPT } from '../../src/c3/render.ts';

// Exact reviewed browser surface. These local routes do not authorize provider use:
// generate/cancel retain service gating; generation-status observes the owned operation only;
// revise/instruction/apply/discard manage proposals;
// note/section-note and planning manage session text; work-state/save/save-copy/reopen
// inspect or explicitly retain private local work. No arbitrary request target is admitted.
const fixed = ['/api/apply-revision', '/api/cancel', '/api/discard-revision', '/api/generate', '/api/generation-status',
  '/api/note', '/api/reopen', '/api/revise', '/api/revision-instruction', '/api/revision-invalidate', '/api/save',
  '/api/save-copy', '/api/section-note', '/api/work-state', '/api/work/title'];
const planning = ['/api/planning/strategy', '/api/planning/next-steps', '/api/section-note'];

export function assertC3ClientSurface(script = C3_CLIENT_SCRIPT): void {
  const renderer = readFileSync(new URL('../../src/c3/render.ts', import.meta.url), 'utf8');
  for (const name of ['WORKING_DOCUMENT', 'PLANNING']) {
    assert.equal(renderer.split('${' + name + '_CLIENT_SCRIPT}').length - 1, 1, 'inspect the actual composed client');
  }
  const tree = ts.createSourceFile('composed-client.js', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const endpoints: string[] = [];
  let fetches = 0, branches = 0, dynamic = 0;
  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && node.text === 'requestJson') {
      const parent = node.parent;
      const directCall = ts.isCallExpression(parent) && parent.expression === node;
      const declaration = (ts.isVariableDeclaration(parent) || ts.isParameter(parent)) && parent.name === node;
      const planningHandoff = ts.isCallExpression(parent) && parent.arguments.length === 1 && parent.arguments[0] === node &&
        ts.isParenthesizedExpression(parent.expression) && ts.isArrowFunction(parent.expression.expression) &&
        parent.expression.expression.parameters[0]?.name.getText(tree) === 'requestJson';
      assert.ok(directCall || declaration || planningHandoff, 'requestJson cannot escape into an unreviewed alias or indirect call');
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'fetch') {
      fetches++;
      assert.match(node.getText(tree), /^fetch\(url, \{ method: 'POST', headers: \{ 'content-type': 'application\/json', 'x-c3-csrf': csrf, 'x-c3-document': workDocumentId \}, body: JSON.stringify\(body\), signal \}\)$/);
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'requestJson') {
      const target = node.arguments[0]!;
      if (ts.isStringLiteral(target)) endpoints.push(target.text);
      else if (ts.isConditionalExpression(target)) {
        assert.equal(target.condition.getText(tree), 'copy');
        assert.equal(target.whenTrue.getText(tree), "'/api/save-copy'");
        assert.equal(target.whenFalse.getText(tree), "'/api/save'");
        endpoints.push('/api/save-copy', '/api/save'); branches++;
      } else {
        assert.equal(target.getText(tree), 'form.dataset.endpoint', 'unreviewed dynamic target'); dynamic++;
        let block: ts.Node = node;
        while (block.parent && !ts.isBlock(block)) block = block.parent;
        assert.ok(ts.isBlock(block), 'planning request must remain in the guarded block');
        const guard = block.statements[0]!.getText(tree);
        assert.equal(guard, "if (!['/api/planning/strategy', '/api/planning/next-steps', '/api/section-note'].includes(form.dataset.endpoint)) throw new Error('Unknown session edit route');");
        endpoints.push(...planning);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.equal(fetches, 1, 'one shared same-origin POST helper');
  assert.equal(branches, 1, 'Save and Save a copy require the explicit fixed branch');
  assert.equal(dynamic, 1, 'only the guarded planning form selects a target');
  assert.deepEqual([...new Set(endpoints)].sort(), [...new Set([...fixed, ...planning])].sort());
  assert.match(script, /\[data-save-work\]'\)\?\.addEventListener\('click',\(\)=>saveWork\(\)\)/);
  assert.match(script, /\[data-save-copy\]'\)\?\.addEventListener\('click',\(\)=>saveWork\(true\)\)/);
  assert.match(script, /const saveWork = async\(copy=false\)/);
}
