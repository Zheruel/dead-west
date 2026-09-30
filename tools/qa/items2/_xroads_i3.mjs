// FE-I3: all 10 devil deals through the real Crossroads pocket room (api.enterCrossroads -> CrossroadsRoom controller -> sign):
// cost deducted exactly as ITEMS 4.3, item granted, deal:signed / deal:paid emitted, run.deals recorded, unaffordable tables greyed, container price
// converted to a curse at one container, pool rules (crossroads only, c2 items only from floor 4, gates honoured).
export default {
  id: '_xroads_i3',
  async run({ g, ev, ok }) {
    const settle = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev((src) => { window.__i3.ff(20); return (0, eval)('(' + src + ')')(); }, fn.toString())) return true; await g.wait(100); } return false; };
    const GROUPS = [['devils_own_colt', 'cylinder_of_sin', 'bloodletter'], ['reapers_bargain', 'gold_fever', 'brimstone_bandolier'], ['lazarus_pact', 'pact_of_ashes', 'devils_dice'], ['leech_contract']];
    const EXPECT = {
      devils_own_colt: { hearts: 1 }, cylinder_of_sin: { keys: 2 }, bloodletter: { coins: 15 }, reapers_bargain: { tin: 4 }, gold_fever: { coins: 25 },
      brimstone_bandolier: { hearts: 1 }, lazarus_pact: { hearts: 1 }, pact_of_ashes: { dynamite: 3 }, devils_dice: { keys: 3 }, leech_contract: { coins: 12 },
    };
    // ------------------------------------------------------------------------------------------ pool rules
    const pool = await ev(async () => {
      const dw = window.__dw, sc = dw.scene, o = {};
      const { allItems } = await import('/src/items/registry.js');
      const { Save } = await import('/src/core/Save.js');
      const { subRng } = await import('/src/core/rng.js');
      const deals = allItems().filter((d) => d.pool.includes('crossroads')).map((d) => d.id).sort();
      for (const id of deals) sc.items.release(id); // earlier plugins in a full run may already have claimed them
      o.deals = deals;
      o.onlyXr = allItems().filter((d) => d.pool.includes('crossroads')).every((d) => d.pool.every((x) => x === 'crossroads' || x === 'c2') && d.deal && d.deal.pay);
      const seen = (floor) => { const s = new Set(); const r = subRng('i3-pool', floor); for (let i = 0; i < 400; i++) { const id = sc.items.roll('crossroads', r, { floor, fallback: false }); if (id) { s.add(id); sc.items.release(id); } } return [...s].sort(); };
      const want = (floor) => allItems().filter((d) => d.pool.includes('crossroads') && !(d.pool.includes('c2') && floor < 4) && (!d.gate || Save.itemUnlocked(d.id))).map((d) => d.id).sort();
      o.f1 = [seen(1), want(1)]; o.f4 = [seen(4), want(4)];
      // never in another pool
      const other = new Set(); const r = subRng('i3-pool2', 1);
      for (const pl of ['treasure', 'shop', 'boss', 'secret']) for (let i = 0; i < 200; i++) { const id = sc.items.roll(pl, r, { floor: 5 }); if (id) { other.add(id); sc.items.release(id); } }
      o.leak = deals.filter((d) => other.has(d));
      o.startUnlocked = ['devils_own_colt', 'gold_fever', 'leech_contract'].every((id) => Save.itemUnlocked(id));
      // gates open (Daily / contract / ?unlockall): all ten from floor 4, the six non-c2 deals before that
      Save.itemsOpen = true;
      o.open1 = [seen(1), want(1)]; o.open4 = [seen(4), want(4)]; o.open1n = o.open1[0].length; o.open4n = o.open4[0].length;
      Save.itemsOpen = false;
      return o;
    });
    ok('10 deal defs, crossroads(+c2) pool only, each with deal.pay', pool.deals.length === 10 && pool.onlyXr, pool.deals.join(','));
    ok('floor 1 crossroads rolls: exactly the unlocked non-c2 deals', JSON.stringify(pool.f1[0]) === JSON.stringify(pool.f1[1]), `${pool.f1[0]} | ${pool.f1[1]}`);
    ok('floor 4 crossroads rolls: the unlocked deals incl. c2 ones', JSON.stringify(pool.f4[0]) === JSON.stringify(pool.f4[1]), `${pool.f4[0]} | ${pool.f4[1]}`);
    ok('gates open: floors 1-3 offer the 6 non-c2 deals, floor 4+ all 10 (c2 marker)', pool.open1n === 6 && pool.open4n === 10 && JSON.stringify(pool.open1[0]) === JSON.stringify(pool.open1[1]) && JSON.stringify(pool.open4[0]) === JSON.stringify(pool.open4[1]), `${pool.open1n} ${pool.open4n}`);
    ok('deals never appear in treasure / shop / boss / secret pools', pool.leak.length === 0, pool.leak.join(','));
    ok('colt, gold_fever, leech_contract are start-unlocked', pool.startUnlocked);

    // ------------------------------------------------------------------------------------------ scripted visits
    await ev(() => window.__dw.scene.roomMgr.jump(window.__dw.scene.roomMgr.floor.bossId));
    await g.wait(700);
    for (let gi = 0; gi < GROUPS.length; gi++) {
      const ids = GROUPS[gi];
      await ev(async (ids) => {
        const dw = window.__dw, p = dw.player, sc = dw.scene, mgr = sc.roomMgr;
        const { buildOffers } = await import('/src/systems/Crossroads.js');
        const { bus } = await import('/src/core/events.js');
        // fresh, generous player: 4 extra hearts, plenty of everything
        p.restore({ items: [], active: null, hp: 99, tin: 0, coins: 90, keys: 6, dyn: 6 });
        p.heartDebt = 0; p.reviveCharges = 0; p.extraHearts = 3; p.recomputeStats(); p.hp = p.maxHp; p.addTin(6); p.godMode = true;
        if (window.__qa3 && window.__qa3.off) window.__qa3.off();
        const q = window.__qa3 = { signed: [], paid: [] };
        const fs = (e) => q.signed.push(e), fp = (e) => q.paid.push(e);
        bus.on('deal:signed', fs); bus.on('deal:paid', fp); q.off = () => { bus.off('deal:signed', fs); bus.off('deal:paid', fp); };
        const offers = ids.map((id, i) => buildOffers({ floor: 1, player: p, items: { roll: () => id } })[0]);
        offers.forEach((o, i) => { o.id = 'LCR'[i]; });
        while (offers.length < 3) offers.push({ id: 'R', kind: 'item_goods', itemId: null, cost: {}, taken: true });
        window.__qa3.offers = offers.map((o) => ({ kind: o.kind, itemId: o.itemId, cost: { ...o.cost } }));
        mgr.stateFor('xroads').ctl = { visits: 0, offers };
        mgr.enterPocket();
      }, ids);
      const inside = await settle(() => window.__dw.scene.roomMgr.currentId === 'xroads' && !window.__dw.scene.transitioning && !!window.__dw.scene.room.controller('xroads'));
      ok(`visit ${gi + 1}: entered the pocket through api-style enterPocket`, inside);
      if (!inside) continue;
      await g.wait(900);
      const res = await ev(async (ids) => {
        const dw = window.__dw, p = dw.player, sc = dw.scene, o = { per: [] };
        const { canAfford } = await import('/src/systems/Crossroads.js');
        const c = sc.room.controller('xroads');
        o.tables = c.tables.length;
        for (let i = 0; i < ids.length; i++) {
          const offer = c.state.offers[i];
          const before = { hearts: p.stats.maxHearts, coins: p.coins, keys: p.keys, dyn: p.dynamite, tin: p.tin, items: p.items.length };
          o.can = canAfford(p, offer);
          c.sign(i);
          const after = { hearts: p.stats.maxHearts, coins: p.coins, keys: p.keys, dyn: p.dynamite, tin: p.tin };
          o.per.push({ id: ids[i], can: o.can, taken: offer.taken, owned: p.hasItem(ids[i]), d: { hearts: before.hearts - after.hearts, coins: before.coins - after.coins, keys: before.keys - after.keys, dynamite: before.dyn - after.dyn, tin: before.tin - after.tin } });
          c.sign(i); // a spent table cannot be signed twice
        }
        const q = window.__qa3;
        o.signed = q.signed.map((e) => e.itemId); o.paid = q.paid.length; o.runDeals = (sc.run.deals || []).filter((d) => ids.includes(d.itemId)).length;
        o.spent = c.state.offers.every((x) => x.taken);
        o.rings = c.rings.every((r) => !r.enabled);
        return o;
      }, ids);
      ok(`visit ${gi + 1}: three tables built (${ids.join(', ')})`, res.tables === 3);
      for (const t of res.per) {
        const e = EXPECT[t.id];
        const got = t.d;
        const exact = ['hearts', 'coins', 'keys', 'dynamite', 'tin'].every((k) => (got[k] || 0) === (e[k] || 0));
        ok(`${t.id}: signed, item owned, cost exactly ${JSON.stringify(e)}`, t.can === true && t.taken && t.owned && exact, `can ${t.can} got ${JSON.stringify(got)}`);
      }
      ok(`visit ${gi + 1}: deal:signed x${ids.length} with the item ids, deal:paid emitted, tables spent (no double charge)`, JSON.stringify(res.signed) === JSON.stringify(ids) && res.paid >= ids.length && res.spent && res.rings && res.runDeals === ids.length, JSON.stringify(res.signed));
      await ev(() => window.__dw.scene.roomMgr.leavePocket());
      const left = await settle(() => window.__dw.scene.roomMgr.currentId !== 'xroads' && !window.__dw.scene.transitioning);
      await g.wait(500);
      const at = await ev(() => ({ id: window.__dw.scene.roomMgr.currentId, boss: window.__dw.scene.roomMgr.floor.bossId, tr: !!window.__dw.scene.transitioning, dead: window.__dw.player.dead }));
      ok(`visit ${gi + 1}: the return portal path lands in the boss room`, left && at.id === at.boss, JSON.stringify(at));
      await ev(() => { window.__qa3.off(); });
    }

    // ------------------------------------------------------------------------------------------ pricing edge cases
    const edge = await ev(async () => {
      const dw = window.__dw, p = dw.player, o = {};
      const { buildOffers, canAfford } = await import('/src/systems/Crossroads.js');
      const items = (id) => ({ roll: () => id });
      p.restore({ items: [], active: null, hp: 99, tin: 0, coins: 0, keys: 0, dyn: 0 }); p.heartDebt = 0; p.extraHearts = 0; p.curses = []; p.recomputeStats();
      // unaffordable tables show their reason and change nothing
      const mk = (id) => buildOffers({ floor: 1, player: p, items: items(id) })[0];
      o.reasons = { reaper: canAfford(p, mk('reapers_bargain')), dice: canAfford(p, mk('devils_dice')), bloodletter: canAfford(p, mk('bloodletter')), ashes: canAfford(p, mk('pact_of_ashes')), fever: canAfford(p, mk('gold_fever')) };
      // one container left: a heart-priced deal becomes a curse deal (EVENTS 2.4); refuse when no curse room either
      p.heartDebt = p.stats.maxHearts - 1; p.recomputeStats(); o.one = p.stats.maxHearts;
      const l = mk('devils_own_colt'); o.conv = [l.kind, JSON.stringify(l.cost)];
      const lz = mk('lazarus_pact'); o.conv2 = lz.kind;
      o.heartNeed = canAfford(p, { id: 'L', kind: 'item_hearts', itemId: 'devils_own_colt', cost: { hearts: 1 }, taken: false });
      return o;
    });
    ok('unaffordable tables show their reason (tin / keys / coins / dynamite)', edge.reasons.reaper === 'NEED MORE TIN' && edge.reasons.dice === 'NEED 3 KEYS' && edge.reasons.bloodletter === 'NEED 15 COINS' && edge.reasons.ashes === 'NEED 3 DYNAMITE' && edge.reasons.fever === 'NEED 25 COINS', JSON.stringify(edge.reasons));
    ok('at one heart container a heart deal is converted to a curse deal, and a heart price alone is refused (NEED MORE BLOOD)', edge.one === 1 && edge.conv[0] === 'item_curse' && edge.conv2 === 'item_curse' && edge.heartNeed === 'NEED MORE BLOOD', JSON.stringify(edge));
  },
};
