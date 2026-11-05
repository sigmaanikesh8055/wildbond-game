import * as THREE from 'three';
import type { Engine } from './engine';
import { buildHuman, animateHuman } from './models';
import { buildWeapon, type DimensionWorld, type WeaponKind, WEAPONS, FOURTH_Y, animateFourthWorld } from './dimension';
import { sfx } from './audio';

type Projectile = { mesh: THREE.Mesh; direction: THREE.Vector3; age: number; heavy: boolean };

export class FourthDuel {
  hp = 120; maxHp = 120; foeHP: number; maxFoe: number; energy = 100;
  phase: 'duel' | 'won' | 'lost' = 'duel';
  attackCd = 0; dodgeCd = 0; dodgeT = 0; invul = 0; heavyCd = 0;
  foeCd = 1.2; foeWindup = 0; foeMove = 0; blocking = false;
  opponent: THREE.Group; enemyKind: WeaponKind;
  playerWeapon: THREE.Group; enemyWeapon: THREE.Group;
  projectiles: Projectile[] = [];
  private tempo = 0;

  constructor(private host: Engine, public world: DimensionWorld, public weapon: WeaponKind) {
    const wins = host.save.dimensionWins ?? 0;
    this.maxFoe = 105 + Math.min(175, wins * 14);
    this.foeHP = this.maxFoe;
    this.enemyKind = (['blade', 'staff', 'bow'] as WeaponKind[])[wins % 3];
    this.opponent = buildHuman({ body: wins % 2 ? 'female' : 'male', skin: '#d9c0c9', hair: wins % 2 ? 'pony' : 'short', hairColor: '#d4c9ec', top: '#432f5c', bottom: '#2c2944', shoes: '#b4a5d9', acc: 'none', pack: 'none', eye: '#a987df' });
    this.opponent.position.set(0, FOURTH_Y, 9);
    this.opponent.rotation.y = Math.PI;
    host.scene.add(this.opponent);
    this.playerWeapon = buildWeapon(weapon);
    this.enemyWeapon = buildWeapon(this.enemyKind);
    (host.player.userData.arms[1].el as THREE.Group).add(this.playerWeapon);
    (this.opponent.userData.arms[1].el as THREE.Group).add(this.enemyWeapon);
    this.world.group.visible = true;
  }

  dispose() {
    for (const p of this.projectiles) { this.host.scene.remove(p.mesh); p.mesh.geometry.dispose(); (p.mesh.material as THREE.Material).dispose(); }
    this.projectiles = [];
    this.host.scene.remove(this.opponent);
    this.playerWeapon.parent?.remove(this.playerWeapon);
    this.enemyWeapon.parent?.remove(this.enemyWeapon);
    this.world.group.visible = false;
  }

  retry() {
    if (this.phase === 'duel') return;
    this.phase = 'duel'; this.hp = this.maxHp; this.foeHP = this.maxFoe;
    this.energy = 100; this.attackCd = 0; this.heavyCd = 0; this.foeCd = 1.3; this.foeWindup = 0; this.invul = 0;
    this.host.player.position.set(0, FOURTH_Y, -12); this.host.player.rotation.set(0, 0, 0);
    this.opponent.position.set(0, FOURTH_Y, 9);
    this.host.camFollowSnap = true;
    this.host.cb.onToast('The next duel begins.', 'info');
  }

  private face(a: THREE.Group, b: THREE.Group, amount: number) {
    const angle = Math.atan2(b.position.x - a.position.x, b.position.z - a.position.z);
    const diff = Math.atan2(Math.sin(angle - a.rotation.y), Math.cos(angle - a.rotation.y));
    a.rotation.y += diff * amount;
  }

  private strike(heavy: boolean) {
    if (this.phase !== 'duel' || this.attackCd > 0 || (heavy && (this.energy < 25 || this.heavyCd > 0))) return;
    const p = this.host.player, foe = this.opponent, info = WEAPONS[this.weapon];
    const dir = foe.position.clone().sub(p.position).setY(0).normalize();
    this.face(p, foe, 1);
    const power = (heavy ? info.heavy : info.power) + Math.min(26, (this.host.save.dimensionWins ?? 0) * 3);
    this.attackCd = info.cooldown * (heavy ? 1.65 : 1); if (heavy) { this.heavyCd = 1.1; this.energy -= 25; }
    p.userData.emote = heavy ? 0.67 : 0.43; p.userData.emoteKind = 15;
    this.host.combatFx.slash(p.position.clone().add(new THREE.Vector3(0, 1.2, 0)), dir, info.color, heavy);
    if (heavy) this.host.combatFx.cast(p.position.clone().add(new THREE.Vector3(0, 1, 0)), this.weapon === 'blade' ? 'fire' : 'aether', true);
    sfx(heavy ? 'crit' : 'swing');
    if (this.weapon === 'blade') {
      this.host.later(heavy ? 0.31 : 0.18, () => { if (this.host.fourth !== this || this.phase !== 'duel') return; if (p.position.distanceTo(foe.position) < info.range + (heavy ? 1 : 0)) this.damageFoe(power, heavy); });
    } else {
      const mesh = new THREE.Mesh(this.weapon === 'bow' ? new THREE.ConeGeometry(0.11, 0.9, 6) : new THREE.OctahedronGeometry(0.25), new THREE.MeshBasicMaterial({ color: info.color, transparent: true }));
      mesh.position.copy(p.position).add(new THREE.Vector3(0, 1.25, 0));
      mesh.rotation.x = this.weapon === 'bow' ? Math.PI / 2 : 0;
      this.host.scene.add(mesh);
      this.projectiles.push({ mesh, direction: dir, age: 0, heavy });
    }
  }

  private damageFoe(amount: number, heavy: boolean) {
    if (this.phase !== 'duel') return;
    this.foeHP = Math.max(0, this.foeHP - amount);
    const pos = this.opponent.position.clone().add(new THREE.Vector3(0, 1.3, 0));
    this.host.combatFx.impact(pos, this.weapon === 'blade' ? 'fire' : 'aether', heavy);
    this.host.burst(pos, WEAPONS[this.weapon].color, heavy ? 17 : 8, 4);
    this.host.popText(pos, String(amount), heavy ? '#ffe292' : '#ffffff');
    this.opponent.userData.emote = 0.24; this.opponent.userData.emoteKind = 2;
    this.opponent.userData.expression = 'hurt'; this.opponent.userData.exprT = 0.4;
    if (heavy) this.host.shake = this.host.settings.reduceMotion ? 0 : 0.18;
    sfx(heavy ? 'crit' : 'hit');
    if (this.foeHP <= 0) {
      this.phase = 'won';
      this.host.player.userData.expression = 'happy'; this.host.player.userData.exprT = 2.5;
      const wins = (this.host.save.dimensionWins ?? 0) + 1;
      this.host.save.dimensionWins = wins;
      const prize = 200 + wins * 55;
      this.host.save.money += prize;
      this.host.ach('duelist');
      this.host.cb.onToast(`Duel won! ${prize} coins added.`, 'good');
      sfx('victory'); this.host.cb.onChange(); this.host.autosave();
    }
  }

  private damagePlayer(amount: number) {
    if (this.phase !== 'duel' || this.invul > 0) return;
    const blocked = this.blocking && this.energy > 5;
    const hit = blocked ? Math.max(2, Math.floor(amount * 0.27)) : amount;
    this.hp = Math.max(0, this.hp - hit);
    this.host.player.userData.expression = blocked ? 'focused' : 'hurt'; this.host.player.userData.exprT = 0.48;
    this.energy = Math.max(0, this.energy - (blocked ? 10 : 0));
    const pos = this.host.player.position.clone().add(new THREE.Vector3(0, 1.25, 0));
    this.host.combatFx.impact(pos, 'shadow', !blocked);
    this.host.popText(pos, String(hit), blocked ? '#9ce9fb' : '#ff8b9b');
    this.host.shake = this.host.settings.reduceMotion ? 0 : blocked ? 0.05 : 0.17;
    sfx(blocked ? 'block' : 'hit');
    if (this.hp <= 0) { this.phase = 'lost'; this.host.cb.onToast('You fell in the duel. Nothing was lost.', 'bad'); sfx('faint'); }
  }

  update(dt: number) {
    animateFourthWorld(this.world, this.host.clock.elapsedTime);
    const player = this.host.player, foe = this.opponent;
    const hero = player.userData;
    if (this.phase !== 'duel') {
      animateHuman(player, dt, 0); animateHuman(foe, dt, 0);
      return;
    }
    this.tempo += dt; this.attackCd -= dt; this.heavyCd -= dt; this.dodgeCd -= dt; this.invul -= dt; this.foeCd -= dt;
    this.energy = Math.min(100, this.energy + dt * 15);
    this.blocking = this.host.held('block') && this.energy > 4 && this.attackCd < 0.2;
    if (this.blocking) this.energy = Math.max(0, this.energy - dt * 5);

    const v = this.host.moveVec(); let moving = false;
    if (this.host.act('dodge') && this.dodgeCd <= 0 && this.energy >= 13) {
      this.energy -= 13; this.dodgeCd = 1; this.dodgeT = 0.23; this.invul = 0.38;
      sfx('dodge');
      this.host.combatFx.dash(player.position, v.lengthSq() > 0 ? v.clone().normalize() : new THREE.Vector3(0, 0, -1), 'light');
    }
    if (this.dodgeT > 0) { this.dodgeT -= dt; const d = v.lengthSq() > 0 ? v.clone().normalize() : foe.position.clone().sub(player.position).setY(0).normalize().negate(); player.position.addScaledVector(d, dt * 17); moving = true; }
    else if (v.lengthSq() > 0.01) { player.position.addScaledVector(v, dt * (this.blocking ? 2.8 : 6.2)); moving = true; }
    const fromCenter = player.position.clone().setY(0); if (fromCenter.length() > 19) player.position.set(fromCenter.setLength(19).x, FOURTH_Y, fromCenter.z);
    this.face(player, foe, Math.min(1, dt * (moving ? 5 : 10)));
    if (this.host.act('light')) this.strike(false);
    if (this.host.act('heavy') || this.host.act('ult')) this.strike(true);
    hero.emote = Math.max(hero.emote, this.blocking ? 0.1 : 0); hero.emoteKind = this.blocking ? 4 : hero.emoteKind;
    animateHuman(player, dt, moving ? 6 : 0);

    // The rival has a visible wind-up before each strike so blocking/dodging matters.
    const dist = player.position.distanceTo(foe.position), toPlayer = player.position.clone().sub(foe.position).setY(0).normalize();
    if (this.foeWindup > 0) {
      this.foeWindup -= dt;
      if (this.foeWindup <= 0) {
        foe.userData.emote = 0.45; foe.userData.emoteKind = 15;
        this.host.combatFx.slash(foe.position.clone().add(new THREE.Vector3(0, 1.2, 0)), toPlayer, '#bd86ec', true);
        if (dist < 3.7) this.damagePlayer(16 + Math.min(20, (this.host.save.dimensionWins ?? 0) * 2));
        this.foeCd = 1.2 + Math.random() * 0.7;
      }
    } else if (dist > 2.7 && this.foeCd < 0.7) {
      foe.position.addScaledVector(toPlayer, dt * 3.8);
      const p = foe.position.clone().setY(0); if (p.length() > 18) foe.position.set(p.setLength(18).x, FOURTH_Y, p.z);
    } else if (dist < 3.1 && this.foeCd <= 0) {
      this.foeWindup = 0.62;
      this.host.combatFx.cast(foe.position.clone().add(new THREE.Vector3(0, 1, 0)), 'shadow');
      this.host.cb.onToast('Incoming strike! Dodge or block.', 'info');
    }
    this.face(foe, player, Math.min(1, dt * 8));
    animateHuman(foe, dt, dist > 2.7 && this.foeCd < 0.7 ? 3.8 : 0);

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]; p.age += dt;
      p.mesh.position.addScaledVector(p.direction, dt * (this.weapon === 'bow' ? 21 : 14));
      p.mesh.rotation.z += dt * 8;
      if (p.mesh.position.distanceTo(foe.position.clone().add(new THREE.Vector3(0, 1, 0))) < 1.25) {
        this.damageFoe((p.heavy ? WEAPONS[this.weapon].heavy : WEAPONS[this.weapon].power), p.heavy);
        this.host.scene.remove(p.mesh); p.mesh.geometry.dispose(); (p.mesh.material as THREE.Material).dispose(); this.projectiles.splice(i, 1);
      } else if (p.age > 1.7) { this.host.scene.remove(p.mesh); p.mesh.geometry.dispose(); (p.mesh.material as THREE.Material).dispose(); this.projectiles.splice(i, 1); }
    }
  }
}