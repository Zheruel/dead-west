// QA-5 audit helper: collect rows {id,item,expected,actual,pass,sev,area,ref}, print, append markdown table to docs/v2/qa/QA-5.md
import fs from 'node:fs';
import path from 'node:path';
const DOC = path.resolve('docs/v2/qa/QA-5.md');
export function audit(doc) {
  const rows = [];
  const esc = (s) => String(s ?? '').replace(/\|/g, '/').replace(/\n/g, ' ').slice(0, 220);
  const A = {
    rows,
    /** chk(item, expected, actual, pass, {sev,area,ref}) */
    chk(item, expected, actual, pass, o = {}) { rows.push({ item, expected, actual, pass: !!pass, sev: o.sev || 'P2', area: o.area || '', ref: o.ref || '' }); if (!pass) console.log(`FAIL [${o.sev || 'P2'}] ${item} | exp ${expected} | got ${actual}`); return !!pass; },
    eq(item, expected, actual, o = {}) { return A.chk(item, JSON.stringify(expected), JSON.stringify(actual), JSON.stringify(expected) === JSON.stringify(actual), o); },
    near(item, expected, actual, tol, o = {}) { return A.chk(item, expected, actual, Math.abs(expected - actual) <= tol, o); },
    flush(title, { verbose = false } = {}) {
      const pass = rows.filter((r) => r.pass).length, fail = rows.length - pass;
      let md = `\n### ${doc}: ${title}  (pass ${pass} / fail ${fail})\n\n| item | expected | actual | result | sev | area | ref |\n|---|---|---|---|---|---|---|\n`;
      for (const r of rows) { if (r.pass && !verbose) continue; md += `| ${esc(r.item)} | ${esc(r.expected)} | ${esc(r.actual)} | ${r.pass ? 'pass' : 'FAIL'} | ${r.pass ? '' : r.sev} | ${r.area} | ${esc(r.ref)} |\n`; }
      if (!fail) md += `| (all ${pass} checks pass) | | | pass | | | |\n`;
      fs.mkdirSync(path.dirname(DOC), { recursive: true });
      // idempotent: drop a previous section with the same heading (up to the next '### ' or EOF), then append
      let cur = fs.existsSync(DOC) ? fs.readFileSync(DOC, 'utf8') : '';
      const head = `### ${doc}: ${title}  (`;
      const i = cur.indexOf('\n' + head);
      if (i >= 0) { const j = cur.indexOf('\n### ', i + 5); cur = cur.slice(0, i) + (j >= 0 ? cur.slice(j) : ''); fs.writeFileSync(DOC, cur); }
      fs.appendFileSync(DOC, md);
      console.log(`== ${doc}: ${title}: pass ${pass} fail ${fail}`);
      return { pass, fail };
    },
  };
  return A;
}
