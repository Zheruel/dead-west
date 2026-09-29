// Global event bus: thin singleton over Phaser.Events.EventEmitter.
//
// EVENT NAMES (payload):
//   'bullet:fired'      {bullet, sixth, owner:'player'|'enemy'}        a bullet was spawned
//   'player:fired'      {sixth, count}                                  player shot (count = shots in cylinder after shot)
//   'player:hurt'       {units, source, hp, tin}                        player took damage
//   'player:healed'     {units}
//   'player:rolled'     {}
//   'player:died'       {source}
//   'player:stats'      {stats}                                         stats recomputed
//   'enemy:spawned'     {enemy}
//   'enemy:hit'         {enemy, damage}
//   'enemy:died'        {enemy, x, y, cursed, boss}
//   'room:entered'      {room, roomId, type, first}                    room fully entered (after slide)
//   'room:locked'       {room}
//   'room:cleared'      {room, roomId, type}
//   'room:transition'   {from, to, dir}                                 slide started
//   'boss:intro'        {boss, name, title, portrait}                  HUD shows intro card
//   'boss:spawned'      {boss, name, hp, maxHp}
//   'boss:hp'           {hp, maxHp}
//   'boss:phase'        {phase}
//   'boss:defeated'     {boss}
//   'item:picked'       {id, def, source}                               triggers banner
//   'pickup:collected'  {type, amount}
//   'pickup:denied'     {type, price}
//   'shop:bought'       {price}
//   'floor:changed'     {floor, name}                                   new floor built
//   'floor:intro'       {floor, name, subtitle}
//   'run:ended'         {variant:'death'|'complete', stats}
//   'active:changed'    {id, charge, max}
//   'dynamite:placed'   {x,y}
//   'explosion'         {x,y,radius}
//   'hud:flash'         {color, alpha}                                  screen flash (HUD vignette)
//   'ui:toast'          {text, color}
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
