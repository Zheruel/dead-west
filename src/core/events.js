// Global event bus: thin singleton over Phaser.Events.EventEmitter.
//
// EVENT NAMES (payload). Canonical list for Round 2 (docs/v2/ARCH_V2.md s2 + EVENTS s0). Emitter in [brackets].
//
// -- combat / player
//   'bullet:fired'      {bullet, sixth, owner:'player'|'enemy'}        a bullet was spawned
//   'player:fired'      {sixth, count}                                  player shot (count = shots in cylinder after shot)
//   'player:hurt'       {units, source, hp, tin}                        player took damage
//   'player:healed'     {units}
//   'player:rolled'     {}
//   'player:died'       {source}
//   'player:revived'    {source}                                        [Player] a revive fired (black_cat_bone | ace_in_hole | lazarus_pact)
//   'player:stats'      {stats}                                         stats recomputed
//   'coins:changed'     {coins}                                         [Player]
//   'enemy:spawned'     {enemy}
//   'enemy:hit'         {enemy, damage}
//   'enemy:died'        {enemy, x, y, cursed, boss, id, by:'bullet|sixth|deadeye|explosion|dot|familiar|other', elite, affixes[], marked, info, st}
//   'elite:spawned'     {enemy, affixes} / 'elite:killed' {id, affixes}  [Affixes]
//   'mini:spawned'      {id} / 'mini:defeated' {id, flawless, time}     [MiniBoss]
//   'synergy:activated' {id, def} / 'synergy:lost' {id}                 [synergies]
// -- rooms / floors
//   'room:entered'      {room, roomId, type, first}                    room fully entered (after slide)
//   'room:locked'       {room}
//   'room:wave'         {room, enemies}                                 [Room] a wave was spawned
//   'room:cleared'      {room, roomId, type}
//   'room:transition'   {from, to, dir}                                 slide started
//   'floor:changed'     {floor, name, chapter}                          [RoomManager] new floor built
//   'floor:intro'       {floor, name, subtitle}                         floor card
//   'chapter:intro'     {chapter, title, tagline}                       [flow] chapter card (F1 start / after the interlude)
//   'checkpoint:saved'  {floor}                                         [flow] after the F4-F6 fade-in
//   'pocket:entered' / 'pocket:left'  {id}                              [RoomManager] crossroads pocket room
//   'gate:opened'       {floor}                                         [Crossroads] hell gate appeared after a boss
//   'deal:signed'       {offerId, kind, cost, itemId} / 'deal:refused' {offerId, reason} / 'deal:paid' {id, pay}
//   'event:started'     {id} / 'event:done' {id, outcome, net}          [events] event rooms
//   'bet:result'        {bet, outcome, payout}                          [CardSharp]
//   'curse:gained' / 'curse:removed' / 'blessing:gained'  {id}          [Boons]
//   'potion:drunk'      {color, effect} / 'hazard:hurt' {type} / 'modifier:entered' | 'modifier:cleared' {id}
//   'secret:found' {variant} / 'secret:hint' {tell} / 'supersecret:entered' {}
//   'mark:collected' 'item:seen' 'chest:opened' 'key:used'              [WantedMark, Pedestal/Shop, Chest, Door]
// -- bosses / run flow
//   'boss:intro'        {boss, name, title, portrait, mini?, bounty?}  HUD shows intro card (mini: compact WANTED card)
//   'boss:spawned'      {boss, name, hp, maxHp}
//   'boss:hp'           {hp, maxHp}
//   'boss:phase'        {phase, boss, id}                               [Boss] audio stems + cards
//   'boss:defeated'     {boss, id, floor, fightTime, noHit}             [Boss] (never emitted by minis)
//   'run:started'       {char, mode, seed, contract?, mutators[], daily?}   [GameScene]
//   'run:ended'         {variant:'death'|'complete'|'contract', ending:'a'|'true'|null, won, stats, ...run}
//   'game:ending'       {ending:'devil_defeated'|'true', run, character, difficulty, seed}   [flow] once, when Ol' Scratch falls
//   'story:cutscene'    {id} / 'story:trueFinale' {}                    [CutsceneScene / finale]
// -- items / pickups / HUD
//   'item:picked'       {id, def, source}                               triggers banner
//   'pickup:collected'  {type, amount}
//   'pickup:denied'     {type, price}
//   'shop:bought'       {price}
//   'active:changed'    {id, charge, max}
//   'dynamite:placed'   {x,y}
//   'explosion'         {x,y,radius}
//   'hud:flash'         {color, alpha}                                  screen flash (HUD vignette)
//   'ui:toast'          {text, color}
// -- meta (Meta engine, FN-3)
//   'meta:unlocked' 'meta:achievement' 'meta:rank' 'codex:discovered' 'bounty:completed' 'daily:finished'
//
// Removed / aliased names (do NOT emit): crossroads:deal, crossroads:refused, event:resolved, miniboss:defeated, curse:changed.
//
// Scenes must unsubscribe on shutdown. Use bus.scoped(scene) which auto-removes on scene shutdown.
import Phaser from 'phaser';

class Bus extends Phaser.Events.EventEmitter {
  /** Subscribe with automatic cleanup when `scene` shuts down / is destroyed. Returns an unsubscribe fn. */
  scoped(scene, event, fn, ctx) {
    this.on(event, fn, ctx);
    // both scene hooks are removed as soon as either fires (or off() is called): a never-firing 'destroy' hook used to pile up on the
    // reused scene's emitter by ~10 per run (closures kept alive forever)
    const off = () => {
      this.off(event, fn, ctx);
      scene.events.off('shutdown', off);
      scene.events.off('destroy', off);
    };
    scene.events.once('shutdown', off);
    scene.events.once('destroy', off);
    return off;
  }
}
export const bus = new Bus();
export default bus;
