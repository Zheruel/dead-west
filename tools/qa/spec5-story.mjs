// QA-5 STORY_PRESENTATION audit (node, static): parses the doc tables/lists and checks every line/field exists in src/data/story (+dealerLines).
import fs from 'node:fs';
import { audit } from './spec5-lib.mjs';
import { CUTSCENES, panelCaption } from '../../src/data/story/cutscenes.js';
import * as TX from '../../src/data/story/text.js';
import * as BL from '../../src/data/story/bosslines.js';
import * as EP from '../../src/data/story/epitaphs.js';
import * as DL from '../../src/data/story/dialogue.js';
import * as TP from '../../src/data/story/tips.js';
import { BESTIARY, BIOS } from '../../src/data/story/bestiary.js';
import { STORY_LORE, STORY_DEEDS } from '../../src/data/story/lore.js';
import { ITEM_LORE } from '../../src/data/story/lore_items.js';
const A = audit('STORY_PRESENTATION');
const md = fs.readFileSync('docs/v2/STORY_PRESENTATION.md', 'utf8');
const sec = (a, b) => { const i = md.indexOf(a); const j = md.indexOf(b, i + 1); return md.slice(i, j < 0 ? undefined : j); };
const rows = (t) => t.split('\n').filter((l) => /^\|/.test(l) && !/^\|[-| ]+\|$/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
const N = (s) => String(s).toLowerCase().replace(/[`*_"'‘’“”]/g, '').replace(/[^a-z0-9$ ]+/g, ' ').replace(/\s+/g, ' ').trim();
const strip = (s) => s.replace(/`/g, '').trim();
// pool of every string in the story data
const pool = new Set(); const poolJoin = [];
const walk = (v) => { if (typeof v === 'string') pool.add(N(v)); else if (Array.isArray(v)) { const ss = v.filter((x) => typeof x === 'string'); if (ss.length > 1 && ss.length === v.length) pool.add(N(ss.join(' '))); v.forEach(walk); } else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
[CUTSCENES, TX, BL, EP, DL, TP, BESTIARY, BIOS, STORY_LORE, STORY_DEEDS, ITEM_LORE].forEach(walk);
// alternative pool: also word-stream (for captions that split over lines / 52 char rewording)
const has = (line) => pool.has(N(line));
const R = (ref, sev = 'P3') => ({ sev, area: 'story', ref });
const line = (item, txt, ref, sev) => { const t = strip(txt); if (!t || t === '-') return; A.chk(item, t, has(t) ? 'present' : 'NOT FOUND verbatim', has(t), R(ref, sev || 'P2')); };
const alts = (cell) => cell.split(' / ').map(strip).filter(Boolean);

// ---- 5.2 cards / whispers
const s52 = sec('### 5.2', '### 5.3');
for (const r of rows(s52).filter((r) => /^\d$/.test(r[0]))) {
  const f = +r[0]; const T = TX.FLOOR_TEXT[f];
  A.eq(`floor card ${f} name/primary/alt/hell`, [r[1], r[2], r[3], r[4]], [T.name, T.primary, T.alt, T.hell], R('s5.2'));
}
for (const m of s52.matchAll(/^\s+- F(\d): (.+)$/gm)) alts(m[2]).forEach((w, i) => A.chk(`whisper F${m[1]}#${i}`, w, TX.WHISPERS[m[1]]?.[i], TX.WHISPERS[m[1]]?.[i] === w, R('s5.2')));
line('rider whisper F4', 'A queen of hearts drifts past on the hot wind.', 's5.2'); line('rider whisper F6', 'Somewhere above the piano, a woman hums a hymn. You know the words.', 's5.2');
A.chk('checkpoint toast', 'CHECKPOINT - THE HOUSE KEEPS YOUR PLACE', TX.CHECKPOINT_TOAST, TX.CHECKPOINT_TOAST === 'CHECKPOINT - THE HOUSE KEEPS YOUR PLACE', R('s5.2'));
A.eq('chapter card 2', ['CHAPTER II', "HELL'S FRONTIER", "The Devil's Own Country"], [TX.CHAPTER_CARDS[2].line, TX.CHAPTER_CARDS[2].name, TX.CHAPTER_CARDS[2].tagline], R('s5.2'));
A.eq('chapter card 1', ['CHAPTER I', 'PERDITION COUNTY', 'Every debt comes due.'], [TX.CHAPTER_CARDS[1].line, TX.CHAPTER_CARDS[1].name, TX.CHAPTER_CARDS[1].tagline], R('s5.2'));
A.eq('text card F4->F5', ['The bull went down. Somewhere, a whistle blew.', 'Hell has a railway. Of course it does.'], TX.TEXT_CARDS.f4_f5, R('s5.2'));
A.eq('floor accents F4/F5/F6', [0xff7a1f, 0x6fe0d0, 0xd4a537], [TX.FLOOR_ACCENT[4], TX.FLOOR_ACCENT[5], TX.FLOOR_ACCENT[6]], R('s5.2'));

// ---- cutscene tables 6.1, 6.2, 6.4, 6.5, 6.6
const cs = (id) => CUTSCENES[id];
const findPanel = (key) => { for (const [id, c] of Object.entries(CUTSCENES)) { if (id === 'intro_hell') continue; for (const p of c.panels || []) if (p.image === key) return { id, p }; } return null; };
const RID = ['gunslinger', 'preacher', 'hunter', 'queen'];
function panelRows(a, b, ref) {
  for (const r of rows(sec(a, b)).filter((r) => /^`cutscene_/.test(r[0]))) {
    const key = strip(r[0]); const f = findPanel(key); const p = f && f.p;
    A.chk(`${key} in a cutscene`, 'present', f ? f.id : 'MISSING', !!f, R(ref, 'P1'));
    if (!p) continue;
    const sfx = strip(r[3]).split(',').map((x) => x.trim()); const got = (p.sfx || []).map((x) => (typeof x === 'string' ? x : x.key));
    A.eq(`${key} sfx`, sfx, got, R(ref));
    A.chk(`${key} duration`, +r[4], p.duration, +r[4] === p.duration, R(ref));
    A.chk(`${key} transition out`, r[5], p.transition, r[5] === p.transition, R(ref));
    // caption
    const cap = r[2];
    if (/`gunslinger`:/.test(cap)) {
      for (const m of cap.matchAll(/`(gunslinger|preacher|hunter|queen)`: ([^`]+?)(?=\s*`(?:gunslinger|preacher|hunter|queen)`:|$)/g)) {
        const want = N(m[2].replace(/ \/ /g, ' ')); const gotc = panelCaption(p, { char: m[1] }); const stamp = p.overlay && p.overlay.type === 'stamp' && (!p.overlay.only_char || p.overlay.only_char.includes(m[1])) ? p.overlay.text : ''; const g = N(gotc.join(' ') + ' ' + stamp);
        const tooLong = m[2].split(' / ').some((l) => l.length > 52);
        A.chk(`${key} caption [${m[1]}]`, m[2], gotc.join(' / '), want === g, R(ref, tooLong ? 'P3' : 'P2'));
      }
    } else if (cap && !/^"/.test(cap.slice(0, 0))) {
      const want = N(cap.replace(/ \/ /g, ' ')); const gotc = panelCaption(p, { char: 'gunslinger' }); const g = N(gotc.join(' '));
      const tooLong = cap.split(' / ').some((l) => l.length > 52);
      A.chk(`${key} caption`, cap, gotc.join(' / '), want === g, R(ref, tooLong ? 'P3' : 'P2'));
    }
  }
}
panelRows('### 6.1', '`intro_hell`', 's6.1'); panelRows('### 6.2', '### 6.3', 's6.2'); panelRows('### 6.4', '### 6.5', 's6.4'); panelRows('### 6.5', '### 6.6', 's6.5'); panelRows('### 6.6', '---\n## 7.', 's6.6');
A.eq('intro panels 7, end_a 5, end_true 6, interlude 1, saloon 1, intro_hell 2', [7, 5, 6, 1, 1, 2], [cs('intro').panels.length, cs('end_a').panels.length, cs('end_true').panels.length, cs('interlude_ch1').panels.length, cs('saloon_arrival').panels.length, cs('intro_hell').panels.length], R('s6', 'P1'));
A.eq('cutscene music: intro/intro_hell/interlude/saloon/end_a/end_true', ['mus_cutscene_intro', 'mus_cutscene_intro', 'mus_interlude', 'mus_floor6', 'mus_ending_a', 'mus_ending_true'], [cs('intro').music, cs('intro_hell').music, cs('interlude_ch1').music, cs('saloon_arrival').music, cs('end_a').music, cs('end_true').music], R('s6/s15'));
A.chk('letterbox 96', 96, cs('intro').letterbox, cs('intro').letterbox === 96, R('s5.1'));
for (const t of ["The Devil's books always balance.", 'Somebody new is always owing.', 'Six chambers. Same debt. Higher interest.', 'The House has read your file.']) line('intro_hell caption', t, 's6.1');
A.eq('intro_hell A=end_a_5 red ink 5s / B=intro_7 fade 5s', [['cutscene_end_a_5', 'ink', 5], ['cutscene_intro_7', 'fade', 5]], cs('intro_hell').panels.map((p) => [p.image, p.transition, p.duration]), R('s6.1'));
for (const t of ["The shaft doesn't end in rock.", 'It ends in brimstone.', 'Something down there', 'is holding the other end of your debt.']) { const t2 = N(t); const flow = N(fs.readFileSync('src/scenes/flow.js', 'utf8').slice(0, 4000)); const found = [...pool].some((x) => x.includes(t2)) || flow.includes(t2) || flow.includes(N(t.replace(/ down there$/, ' down there is holding').slice(0, 20))); A.chk('interlude line (CHAPTER2 typed lines over img_interlude_ch2)', t, found ? 'present' : 'NOT FOUND in story data', found, R('s6.2', 'P3')); }
// interlude overlays
const ov = cs('interlude_ch1').panels[0].overlay;
const ovDoc = { gunslinger: "PAGE TWO. SURETY. Upon the Debtor's default, the Debtor's wife shall be held at the House until the account is settled in full. Signed: A. Marrow, in her own hand.", preacher: "PAGE TWO. SURETY. Upon default, the Debtor's flock, fifty souls blessed by his own hand, shall be held at the House until the account is settled in full. Witnessed: J. Thorne. Amen.", hunter: "PAGE TWO. SURETY. Upon default, the Debtor's name shall be posted and its price held at the House until the account is settled in full. Signed: C. Rook. Paid In Full.", queen: "PAGE TWO. SURETY. Upon default, the Debtor's winnings, every chip she ever won, shall be held at the House until the account is settled in full. Signed: M. Marlowe. Queen of Spades." };
for (const r of RID) A.chk(`interlude overlay [${r}]`, ovDoc[r].slice(0, 50) + '...', (ov.text_if?.char?.[r] || '').slice(0, 50) + '...', N(ov.text_if?.char?.[r] || '') === N(ovDoc[r]), R('s6.2', 'P2'));
const after = { gunslinger: ['Ada had read page two.', 'She signed it anyway.'], preacher: ['The Amen was the signature.', 'It always was.'], hunter: ['He had priced everyone else\'s head.', 'He never checked his own.'], queen: ['The Devil let her win.', 'Now she saw the receipt.'] };
for (const r of RID) { const p = cs('interlude_ch1').panels[0]; const got = (p.caption_after_if?.char?.[r] || p.caption_after || []); A.chk(`interlude caption_after [${r}]`, after[r].join(' / '), got.join(' / '), N(after[r].join(' ')) === N(got.join(' ')), R('s6.2', 'P2')); }
A.chk('interlude overlay: gunslinger 60 ms/char', 60, ov.ms_if?.char?.gunslinger, ov.ms_if?.char?.gunslinger === 60, R('s6.2', 'P3'));
A.chk('interlude overlay hold 5 s (doc: typed 5 s)', 5, ov.hold, ov.hold === 5, R('s6.2', 'P3'));
// ledger, taglines
for (const r of rows(sec('### 6.3', '### 6.4')).filter((r) => RID.includes(strip(r[0])))) A.eq(`ledger ${strip(r[0])}`, [r[1], r[2], r[3]], TX.LEDGER_CARDS[strip(r[0])], R('s6.3'));
const tg = sec('### 6.3', '### 6.4').split('Character-select taglines')[1] || '';
for (const m of tg.matchAll(/`(gunslinger|preacher|hunter|queen)` ([^/\n]+?)(?= \/ `|\n|$)/g)) A.chk(`tagline ${m[1]}`, m[2].trim(), TX.CHAR_TAGLINES[m[1]], TX.CHAR_TAGLINES[m[1]] === m[2].trim(), R('s6.3'));
for (const id of RID) A.chk(`ledger cutscene ledger_${id}`, 'kind ledger, 3 lines', `${cs('ledger_' + id)?.kind}/${cs('ledger_' + id)?.lines?.length}`, cs('ledger_' + id)?.kind === 'ledger' && cs('ledger_' + id).lines.length === 3, R('s6.3'));

// ---- 7 bosses
for (const r of rows(sec('### 7.1', '### 7.2')).filter((r) => /^`/.test(r[0]))) {
  const id = strip(r[0]); const L = BL.BOSS_LINES[id]; if (!L) { A.chk(`boss lines ${id}`, 'present', 'MISSING', false, R('s7.1', 'P1')); continue; }
  A.eq(`boss ${id} name/title/intro/death`, [r[1], r[2], r[3], r[4]], [L.name, L.title, L.intro, L.death], R('s7.1'));
}
for (const r of rows(sec('### 7.2', '### 7.3')).filter((r) => /^`/.test(r[0]))) {
  const boss = strip(r[0]), rider = strip(r[1]);
  if (rider.startsWith('any')) { A.chk('scratch true-eligible intro', r[2], BL.SCRATCH_TRUE_INTRO, BL.SCRATCH_TRUE_INTRO === r[2], R('s7.2')); continue; }
  const o = BL.RIDER_INTROS[boss]?.[rider]; A.chk(`${boss}/${rider} intro`, r[2], o?.intro, o?.intro === r[2], R('s7.2'));
  if (r[3] !== '-') A.chk(`${boss}/${rider} death`, r[3], o?.death, o?.death === r[3], R('s7.2'));
}
A.chk('scratch barks (page nine / finale)', 'as doc', JSON.stringify(BL.SCRATCH_BARKS), BL.SCRATCH_BARKS.page === 'Page nine. Do read along.' && BL.SCRATCH_BARKS.finale === 'Nobody hurts a man who holds the paper!', R('s7.2'));
A.chk('scratch extra line delay 1.4 s', 1400, BL.SCRATCH_TRUE_EXTRA_MS, BL.SCRATCH_TRUE_EXTRA_MS === 1400, R('s7.2'));
const banners = { toro: { 1: 'THE FURNACE ROARS', 2: 'HELLFIRE!' }, engine: { 1: 'ALL ABOARD THE DEAD', 2: 'FULL STEAM AHEAD' }, scratch: { 0: 'DEAL ME IN', 1: 'I RAISE', 2: 'ALL IN', 3: 'READ THE FINE PRINT' }, cascabel: { 2: 'THE RATTLE QUICKENS' }, grimm: { 2: 'DEPUTIES, ARREST HIM', 3: 'ORDER IN THE COURT' }, undertaker: { 2: 'EVERY BOX HAS A TENANT', 3: 'THE LID CLOSES' } };
for (const [b, m] of Object.entries(banners)) for (const [ph, t] of Object.entries(m)) A.chk(`phase banner ${b} P${ph}`, t, BL.phaseBanner(b, +ph), BL.phaseBanner(b, +ph) === t, R('s7.3'));
for (const r of rows(sec('### 7.4', '### 7.5')).filter((r) => /^`/.test(r[0]))) {
  const id = strip(r[0]).replace(/ \(mini\)/, '').replace('bouncer', 'head_bouncer'); const L = BL.MINI_LINES[id];
  if (!L) { A.chk(`mini lines ${id}`, 'present', 'MISSING', false, R('s7.4', 'P1')); continue; }
  A.eq(`mini ${id} title/wantedFor/banner/death`, [r[1], r[2], r[3], r[4]], [L.title, L.wantedFor, L.banner, L.death], R('s7.4'));
}
for (const m of sec('### 7.5', '---').matchAll(/^- `(\w+)`: (.+)$/gm)) A.chk(`codex bio ${m[1]}`, m[2], BIOS[m[1]], BIOS[m[1]] === m[2], R('s7.5'));

// ---- 8 item lore (28 existing)
const s8 = rows(sec('## 8. ITEM', '(Ids follow')).filter((r) => /^`/.test(r[0]));
A.chk('item lore rows in doc (28 said, table has)', 28, s8.length, s8.length === 28, R('s8', 'P3'));
for (const r of s8) { const id = strip(r[0]); A.chk(`item lore ${id}`, r[1], ITEM_LORE[id], ITEM_LORE[id] === r[1], R('s8')); A.chk(`item lore ${id} <= 72`, '<=72', String((ITEM_LORE[id] || '').length), (ITEM_LORE[id] || '').length <= 72, R('s8')); }
// ---- 9 bestiary
for (const [a, b, ref] of [['### 9.1', '### 9.2', 's9.1'], ['### 9.2', '---\n## 10', 's9.2']]) for (const r of rows(sec(a, b)).filter((r) => /^`/.test(r[0]))) {
  const id = strip(r[0]).replace(/ \(.*\)/, ''); const B = BESTIARY[id]; if (!B) { A.chk(`bestiary ${id}`, 'present', 'MISSING', false, R(ref, 'P1')); continue; }
  A.eq(`bestiary ${id} name/lore/tip`, [r[1], r[2], r[3]], [B.name, B.lore, B.tip], R(ref, 'P3'));
  A.chk(`bestiary ${id} limits (lore<=30w, tip<=64)`, 'ok', `${B.lore.split(/\s+/).length}w/${B.tip.length}c`, B.lore.split(/\s+/).length <= 30 && B.tip.length <= 64, R(ref, 'P3'));
}
// ---- 10 epitaphs
const epi = { ...EP.EPITAPHS.byCause, generic: EP.EPITAPHS.generic, hard: EP.EPITAPHS.hard };
for (const r of rows(sec('## 10. DEATH', '---\n## 11')).filter((r) => r.length === 2 && r[0] !== 'key')) {
  const keys = r[0].replace(/ \(.*\)/, '').split(',').map((k) => strip(k)).filter(Boolean);
  if (/rider keys/.test(r[0])) { for (const m of r[1].matchAll(/`(\w+)`: ([^/`]+?)(?= \/ `|$)/g)) { const l = [EP.EPITAPHS.riders[m[1]]].filter(Boolean); A.chk(`epitaph rider ${m[1]}`, m[2].trim(), l.join(' | ') || 'none', l.some((x) => N(x) === N(m[2])), R('s10')); } continue; }
  for (const w of alts(r[1])) { const k = keys[0]; const ok = (epi[k] || []).some((x) => N(x) === N(w)); A.chk(`epitaph ${k}: ${w.slice(0, 40)}`, w, ok ? 'present' : (epi[k] ? 'missing in key' : 'NO KEY'), ok, R('s10', 'P2')); }
}
for (const k of ['toro', 'engine', 'scratch']) A.chk(`causeOf ${k}`, 'non-empty', EP.causeOf(k), !!EP.causeOf(k) && EP.causeOf(k) !== 'generic', R('s10'));
A.chk('causeOf toro/engine/scratch names', "El Toro Infernal / Engine No. 666 / Ol' Scratch", [EP.causeOf('toro'), EP.causeOf('engine'), EP.causeOf('scratch')].join(' / '), EP.causeOf('toro') === 'El Toro Infernal' && EP.causeOf('engine') === 'Engine No. 666' && EP.causeOf('scratch') === "Ol' Scratch", R('s10'));
A.chk('retry hint + Hell line', 'R  -  DEAL ME IN AGAIN / Dealt a dead man\'s hand.', `${TX.UI.retry} / ${TX.UI.hellDead}`, TX.UI.retry === 'R  -  DEAL ME IN AGAIN' && TX.UI.hellDead === "Dealt a dead man's hand.", R('s10'));
// ---- 11 dialogue: verbatim presence for every alternative
for (const [a, b, ref] of [['### 11.1', '### 11.2', 's11.1'], ['### 11.2', '### 11.3', 's11.2'], ['### 11.3', '---\n## 12', 's11.3']]) {
  for (const r of rows(sec(a, b)).filter((r) => r.length === 2 && !/^(category|event)$/.test(r[0]))) {
    for (let ci = 1; ci < r.length; ci++) for (let w of alts(r[ci])) {
      w = w.replace(/^(?:`\w+`|F\d|\w+ \w+|[\w ]+ \([^)]*\)|[\w' ]+):\s+/, (m) => (m.length < 40 ? '' : m)); // drop "label: " prefix
      const t = w.replace(/^[^:]{1,30}: /, '').trim();
      if (!t || /^\d/.test(t) && t.length < 3) continue;
      A.chk(`${ref} ${r[0]}: ${t.slice(0, 44)}`, t, has(t) ? 'present' : 'NOT FOUND', has(t) || has(w), R(ref, 'P2'));
    }
  }
}
A.eq('DEALER_LINES counts 4/6/5/3/4/3', [4, 6, 5, 3, 4, 3], ['greet', 'hover', 'signed', 'refused', 'leaving', 'curse'].map((k) => DL.DEALER_LINES[k].length), R('s11.2', 'P1'));
// ---- 12 tips
const s12 = sec('## 12. LOADING', '---\n## 13');
const bootDoc = s12.match(/plus: (.+)\n/)[1].split(/\.\.\.\s*\/?\s*/).map((x) => x.replace(/^[,\s]+/, '').trim()).filter(Boolean).map((x) => x + '...');
A.eq('boot lines extra 8', bootDoc, TX.BOOT_LINES_EXTRA, R('s12'));
A.chk('boot lines total 18 (10 existing + 8)', 18, TP.BOOT_LINES.length, TP.BOOT_LINES.length === 18, R('s12'));
const tipRows = rows(s12).filter((r) => TP.TIP_NEEDS.includes(r[0]));
A.chk('tip count', tipRows.length, TP.TIPS.length, tipRows.length === TP.TIPS.length, R('s12', 'P3'));
for (const r of tipRows) { const t = TP.TIPS.find((x) => x.t === r[1]); A.chk(`tip [${r[0]}] ${r[1].slice(0, 40)}`, r[0], t ? t.needs : 'NOT FOUND', !!t && t.needs === r[0] && r[1].length <= 96, R('s12', 'P3')); }
// ---- 13 lore / deeds
for (const r of rows(sec('### 13.1', '### 13.2')).filter((r) => /^`lore_/.test(r[0]))) {
  const id = strip(r[0]); const L = STORY_LORE.find((x) => x.id === id); if (!L) { A.chk(`lore ${id}`, 'present', 'MISSING', false, R('s13.1', 'P1')); continue; }
  A.eq(`lore ${id} title/unlock/text/reread`, [r[1], strip(r[2]), r[3], r[4] === '-' ? undefined : strip(r[4])], [L.title, L.unlock, L.text, L.reread], R('s13.1'));
}
for (const r of rows(sec('### 13.2', '---\n## 14')).filter((r) => /^`/.test(r[0]))) {
  const id = strip(r[0]); const D = STORY_DEEDS.find((x) => x.id === id); if (!D) { A.chk(`deed ${id}`, 'present', 'MISSING', false, R('s13.2', 'P1')); continue; }
  A.eq(`deed ${id} name/desc/cond`, [r[1], r[2], strip(r[3])], [D.name, D.desc, D.cond], R('s13.2'));
}
// ---- 14 credits
const credDoc = sec('## 14. CREDITS', '---\n## 15').match(/```\n([\s\S]*?)```/)[1].split('\n').filter((l) => l.trim() && l !== '--');
const credGot = TX.creditsRows('a').flatMap((r) => (r.kind === 'line' ? [`${r.label} ${r.text}`] : r.text ? [r.text] : []));
for (const l of credDoc.filter((l) => !/^END A tail/.test(l))) { const t = N(l.replace(/\{\{music_credits_ch2\}\}/, '')); const found = credGot.some((g) => N(g).startsWith(t.slice(0, Math.min(t.length, 40)))); A.chk(`credits: ${l.slice(0, 40)}`, l.trim().slice(0, 50), found ? 'present' : 'NOT FOUND', found, R('s14', 'P3')); }
A.chk('credits tails', 'The deck is warm. / ACCOUNT CLOSED.', `${TX.CREDITS_TAIL.a} / ${TX.CREDITS_TAIL.true}`, TX.CREDITS_TAIL.a === 'The deck is warm.' && TX.CREDITS_TAIL.true === 'ACCOUNT CLOSED.', R('s14'));
// ---- reachability: are the data modules consumed by the game?
import path from 'node:path';
let srcAll = ''; (function w(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) w(p); else if (p.endsWith('.js') && !p.includes('src/data/story/')) srcAll += fs.readFileSync(p, 'utf8') + '\n'; } })('src');
const used = (id) => new RegExp('\\b' + id + '\\b').test(srcAll);
for (const [id, ref, sev] of [['peddlerGreeting', 's11.1 peddler speech tags (24 lines)', 'P1'], ['EVENT_LINES', 's11.3 event NPC/closing lines (45)', 'P2'], ['POTION_NAMES', 's11.3 potion names', 'P3'], ['pickWhisper', 's5.2 whispers'], ['bossIntro', 's7.1/7.2 boss card lines'], ['miniLines', 's7.4 mini WANTED/banner/quip'], ['pickEpitaph', 's10 epitaphs'], ['availableTips', 's12 tips'], ['creditsRows', 's14 credits'], ['ENDING_TOASTS', 's6.5/6.6 toasts'], ['TEXT_CARDS', 's5.2 text cards f4->f5'], ['LEDGER_CARDS', 's6.3 ledger cards'], ['CHAR_TAGLINES', 's6.3 char-select taglines'], ['ITEM_LORE', 's8 item lore'], ['BIOS', 's7.5 codex bios'], ['STORY_LORE', 's13.1 lore entries']]) {
  const alt = id === 'TEXT_CARDS' ? /card_f4_f5/.test(srcAll) : id === 'LEDGER_CARDS' ? /ledger_/.test(srcAll) : id === 'STORY_LORE' ? /lore_prologue/.test(srcAll) : id === 'CHAR_TAGLINES' ? /Owes one soul\. Pays in lead/.test(srcAll) : false;
  A.chk('consumed by game code: ' + id, 'used in src/', used(id) || alt ? 'used' : 'NOT REFERENCED outside data/story', used(id) || alt, R(ref, sev || 'P2'));
}
{ const ok = (l) => srcAll.includes(l); const P = Object.values(DL.PEDDLER).flatMap((v) => (typeof v === 'string' ? [v] : Array.isArray(v) ? v : Object.values(v))); A.chk('peddler lines present anywhere in game code (24)', 24, P.filter(ok).length, P.filter(ok).length >= 20, R('s11.1', 'P1')); const E = []; const fl = (v) => (typeof v === 'string' ? E.push(v) : Object.values(v).forEach(fl)); fl(DL.EVENT_LINES); A.chk('event NPC lines (s11.3) present in event room code', E.length, E.filter(ok).length, E.filter(ok).length >= E.length * 0.9, R('s11.3', 'P2')); }
A.flush('data vs doc text (s5-s14)');
