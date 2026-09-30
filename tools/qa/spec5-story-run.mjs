// QA-5 STORY s18 acceptance (browser): every cutscene plays, skip() advances, `next` starts even with all images missing (?noassets=1).
import { launch } from './harness.mjs';
import { audit } from './spec5-lib.mjs';
const A = audit('STORY_PRESENTATION');
const R = (ref, sev = 'P2') => ({ sev, area: 'story', ref });
async function run(noassets) {
  const g = await launch({ query: `?debug=1&seed=42${noassets ? '&noassets=1' : ''}`, name: 'spec5-story', quiet: true });
  await g.wait(1500);
  const ids = await g.eval(() => window.__game.story.ids);
  for (const id of ids) {
    for (const char of (id.startsWith('ledger_') || id === 'card_f4_f5' ? ['gunslinger'] : ['gunslinger', 'queen'])) {
      const info = await g.eval(async (id, char) => {
        const G = window.__game; const st = G.story;
        st.play(id, { char, hell: id === 'intro_hell' });
        const t0 = performance.now();
        let started = false;
        for (let i = 0; i < 200; i++) { await new Promise((r) => setTimeout(r, 50)); if (G.scene.isActive('Cutscene')) { started = true; break; } }
        let n = 0; let panels = 0; let last = null;
        for (let i = 0; i < 400 && G.scene.isActive('Cutscene'); i++) { const s = st.state(); if (s && s.panel !== last) { panels++; last = s.panel; } st.skip(); await new Promise((r) => setTimeout(r, 100)); n++; }
        await new Promise((r) => setTimeout(r, 900));
        return { started, ended: !G.scene.isActive('Cutscene'), menu: G.scene.isActive('Menu'), ms: Math.round(performance.now() - t0) };
      }, id, char);
      A.chk(`${noassets ? 'noassets ' : ''}cutscene ${id} [${char}]: starts, skip() ends it, returns to menu`, 'started+ended+Menu', JSON.stringify(info), info.started && info.ended && info.menu, R('s18.1', 'P1'));
    }
  }
  // credits
  for (const e of ['a', 'true']) {
    const info = await g.eval(async (e) => { const G = window.__game; G.story.credits(e); let s = false; for (let i = 0; i < 100; i++) { await new Promise((r) => setTimeout(r, 50)); if (G.scene.isActive('Credits')) { s = true; break; } } for (let i = 0; i < 100 && G.scene.isActive('Credits'); i++) { G.story.skip(); await new Promise((r) => setTimeout(r, 100)); } await new Promise((r) => setTimeout(r, 700)); return { s, ended: !G.scene.isActive('Credits') }; }, e);
    A.chk(`${noassets ? 'noassets ' : ''}credits ${e}: plays and skips`, 'ok', JSON.stringify(info), info.s && info.ended, R('s5.6'));
  }
  if (!noassets) {
    // storyQueueFor + trueEligible truth table in-page (imports Phaser)
    const q = await g.eval(async () => { const m = await import('/src/scenes/ending.js'); return { hell: m.storyQueueFor({ char: 'queen', mode: 'hell' }), gs: m.storyQueueFor({ char: 'gunslinger', mode: 'normal' }), preachNormal: m.storyQueueFor({ char: 'preacher', mode: 'normal' }) }; });
    A.chk('run-start queue: hell -> intro_hell', '["intro_hell"]', JSON.stringify(q.hell), q.hell.length === 1 && q.hell[0] === 'intro_hell', R('s6.1'));
    A.chk('run-start queue: non-gunslinger gets ledger, not intro', 'ledger_preacher or []', JSON.stringify(q.preachNormal), !q.preachNormal.includes('intro'), R('s6.1'));
    // daily / contract never play cutscenes: onRunStarted gate
    const gate = await g.eval(async () => { const { bus } = await import('/src/core/events.js'); const G = window.__game; let played = 0; const f = () => { played++; }; bus.on('story:cutscene', f); for (const p of [{ daily: true, mode: 'normal', char: 'gunslinger' }, { contract: 'x', mode: 'normal', char: 'gunslinger' }, { resume: true, mode: 'normal', char: 'gunslinger' }]) { bus.emit('run:started', p); await new Promise((r) => setTimeout(r, 400)); } bus.off('story:cutscene', f); return { played, active: G.scene.isActive('Cutscene') }; });
    A.chk('daily / contract / CONTINUE (resume) run:started never plays a cutscene', 0, `${gate.played} ${gate.active}`, gate.played === 0 && !gate.active, R('s18.1 / s5.1', 'P1'));
  }
  A.chk(`${noassets ? 'noassets ' : ''}no console errors during cutscenes`, 0, g.errors.slice(0, 3).join(' | ').slice(0, 200) || 0, g.errors.length === 0, R('s18.1', 'P2'));
  await g.close();
}
await run(false);
await run(true);
A.flush('acceptance in browser (s18.1, s5.6)');
