import {
  AdditiveAnimationBlendMode,
  AnimationClip,
  AnimationMixer,
  BoxGeometry,
  Group,
  LoopRepeat,
  Mesh,
  MeshStandardMaterial,
  NormalAnimationBlendMode,
  type Object3D,
  PointLight,
  VectorKeyframeTrack,
} from 'three';
import { describe, expect, it } from 'vitest';
import { prepareModule } from '../scene/prepareModule';
import {
  applyParty,
  applyToggles,
  driveClip,
  oneShot,
  PARTY_PERIOD,
  partyHue,
  playOnce,
  prepareInteractions,
} from './effects';
import { DAY_SCREEN_GLOW } from './toggles';

function node<T extends Object3D>(
  object: T,
  name: string,
  extras: Record<string, unknown> = {},
): T {
  object.name = name;
  object.userData = { name, ...extras };
  return object;
}

const glowing = () => new MeshStandardMaterial({ emissive: 0xffffff, emissiveIntensity: 3 });
const emissive = (object: Object3D) =>
  ((object as Mesh).material as MeshStandardMaterial).emissiveIntensity;

/** A small house as GLTFLoader and prepareModule leave it: two TVs sharing one screen material, a lit room, a shower. */
function house() {
  const screen = glowing();
  const tv = node(new Group(), 'TV_wall', {
    interact: 'tv:TV_wall',
    label: 'TV phòng khách',
    night_light: true,
  });
  const tvScreen = new Mesh(new BoxGeometry(), screen);
  tv.add(tvScreen);
  const tv2 = node(new Mesh(new BoxGeometry(), screen), 'TV_master', {
    interact: 'tv:TV_master',
    label: 'TV',
    night_light: true,
  });
  const led = node(new Mesh(new BoxGeometry(), glowing()), 'LT_led_plinth', { night_light: true });
  const light = node(new PointLight(0xffaa66, 80), 'L_living', {
    interact: 'light:living',
    label: 'Đèn',
    night_light: true,
  });
  const lamp = node(new Mesh(new BoxGeometry(), glowing()), 'Floor_lamp', {
    interact: 'light:living',
    label: 'Đèn',
    night_light: true,
  });
  const shower = node(new Mesh(new BoxGeometry()), 'Shower_master', {
    interact: 'shower:Shower_master',
    label: 'Vòi sen',
  });
  const flow = node(new Mesh(new BoxGeometry()), 'WATER_Shower_master_flow', {
    interact: 'shower:Shower_master',
    label: 'Vòi sen',
  });
  const fountain = node(new Mesh(new BoxGeometry()), 'fountain', {
    interact: 'fountain',
    label: 'Tường nước',
  });
  const sheet = node(new Mesh(new BoxGeometry()), 'WATER_fountain_sheet', {
    interact: 'fountain',
    label: 'Tường nước',
  });
  const basin = node(new Mesh(new BoxGeometry()), 'WATER_fountain', {
    interact: 'fountain',
    label: 'Tường nước',
  });
  const door = node(new Mesh(new BoxGeometry()), 'Door_main', {
    interact: 'door:main',
    label: 'Cửa chính',
    clip: 'act_door_open',
  });
  const root = new Group();
  root.add(tv, tv2, led, light, lamp, shower, flow, fountain, sheet, basin, door);
  const prepared = prepareModule(root);
  return {
    root,
    prepared,
    model: prepareInteractions(root, prepared),
    tvScreen,
    tv2,
    led,
    light,
    lamp,
    flow,
    sheet,
    basin,
    door,
  };
}

describe('prepareInteractions', () => {
  it("hides a shower's falling water from the start", () => {
    const { flow, sheet } = house();
    expect(flow.visible).toBe(false);
    expect(sheet.visible).toBe(true);
  });

  it('lists the clips the groups play', () => {
    expect(house().model.clips).toEqual([
      { group: 'door:main', kind: 'door', clip: 'act_door_open' },
    ]);
  });
});

describe('applyToggles', () => {
  it('leaves everything to the night factor while every group is on auto, as before', () => {
    const { prepared, model, tvScreen, tv2, led, light, lamp, flow, sheet } = house();
    applyToggles(model, prepared, {}, 0.5);
    for (const mesh of [tvScreen, tv2, led, lamp]) expect(emissive(mesh)).toBeCloseTo(1.5, 9);
    expect([light.intensity, light.visible]).toEqual([40, true]);
    expect([flow.visible, sheet.visible]).toEqual([false, true]);
    applyToggles(model, prepared, {}, 0);
    expect([light.intensity, light.visible, emissive(lamp)]).toEqual([0, false, 0]);
  });

  it("switches a room's lights on by day, point light and lamps alike, and nothing else", () => {
    const { prepared, model, tvScreen, led, light, lamp } = house();
    applyToggles(model, prepared, { 'light:living': 'on' }, 0);
    expect([light.intensity, light.visible]).toEqual([80, true]);
    expect(emissive(lamp)).toBe(3);
    expect([emissive(tvScreen), emissive(led)]).toEqual([0, 0]);
  });

  it("switches a room's lights off at night while the others stay lit", () => {
    const { prepared, model, led, light, lamp } = house();
    applyToggles(model, prepared, { 'light:living': 'off' }, 1);
    expect([light.intensity, light.visible, emissive(lamp)]).toEqual([0, false, 0]);
    expect(emissive(led)).toBe(3);
  });

  it('lights one TV on its own, though both TVs came with the same screen material', () => {
    const { prepared, model, tvScreen, tv2 } = house();
    expect(tvScreen.material).not.toBe(tv2.material);
    applyToggles(model, prepared, { 'tv:TV_wall': 'on' }, 0);
    expect(emissive(tvScreen)).toBeCloseTo(3 * DAY_SCREEN_GLOW, 9); // by day: a lit panel, not a white one
    expect(emissive(tv2)).toBe(0);
    applyToggles(model, prepared, { 'tv:TV_wall': 'off', 'tv:TV_master': 'on' }, 1);
    expect([emissive(tvScreen), emissive(tv2)]).toEqual([0, 3]); // at night the exported emission
  });

  it('caps a screen switched on by day only: a lamp on by day, and any lit screen at night, keep the full emission', () => {
    const { prepared, model, tvScreen, lamp } = house();
    applyToggles(model, prepared, { 'tv:TV_wall': 'on', 'light:living': 'on' }, 0);
    expect(emissive(tvScreen)).toBeCloseTo(3 * DAY_SCREEN_GLOW, 9);
    expect(emissive(lamp)).toBe(3);
    applyToggles(model, prepared, {}, 1); // auto at night, as before
    expect([emissive(tvScreen), emissive(lamp)]).toEqual([3, 3]);
  });

  it("shows the shower's water while it runs and hides the fountain's sheet while it is off", () => {
    const { prepared, model, flow, sheet, basin } = house();
    applyToggles(model, prepared, { 'shower:Shower_master': 'on', fountain: 'off' }, 0);
    expect([flow.visible, sheet.visible, basin.visible]).toEqual([true, false, true]); // the basin keeps its water
    applyToggles(model, prepared, { 'shower:Shower_master': 'off', fountain: 'on' }, 0);
    expect([flow.visible, sheet.visible]).toEqual([false, true]);
  });

  it("keeps a light the cut turned off dark (cutaway applyCut: the house's under the basement's cut), still drawn", () => {
    const { prepared, model, light } = house();
    light.userData.cutDark = true;
    applyToggles(model, prepared, {}, 0.5);
    expect([light.intensity, light.visible, light.userData.lit]).toEqual([0, true, 40]); // no light count change
    light.userData.cutDark = false;
    applyToggles(model, prepared, {}, 0.5);
    expect([light.intensity, light.userData.lit]).toEqual([40, 40]);
  });
});

/**
 * The garden as two modules leave it (garden/interact.py): the gate lanterns (fence) and the bollards (garden_paths) are
 * one click group across modules, lights:garden; the barbecue terrace has its string lights in that group too and the
 * grill, whose coals glow, in the group bbq.
 */
function garden() {
  const lanterns = node(new Mesh(new BoxGeometry(), glowing()), 'Gate_lamps', {
    interact: 'lights:garden',
    label: 'Đèn sân vườn',
    night_light: true,
  });
  const fence = new Group();
  fence.add(lanterns);
  const strings = node(new Mesh(new BoxGeometry(), glowing()), 'String_lights_bbq', {
    interact: 'lights:garden',
    label: 'Đèn sân vườn',
    night_light: true,
  });
  const grill = node(new Mesh(new BoxGeometry(), glowing()), 'BBQ_grill', {
    interact: 'bbq',
    label: 'Bếp nướng',
    night_light: true,
  });
  const bbq = new Group();
  bbq.add(strings, grill);
  const modules = [fence, bbq].map((root) => {
    const prepared = prepareModule(root);
    return { prepared, model: prepareInteractions(root, prepared) };
  });
  return { modules, lanterns, strings, grill };
}

describe('the garden groups', () => {
  it('switch the garden lights of every module together and the grill on its own', () => {
    const { modules, lanterns, strings, grill } = garden();
    const apply = (toggles: Record<string, 'on' | 'off'>, night: number) => {
      for (const { model, prepared } of modules) applyToggles(model, prepared, toggles, night);
    };
    apply({}, 1); // auto at night: everything glows, the coals too
    expect([emissive(lanterns), emissive(strings), emissive(grill)]).toEqual([3, 3, 3]);
    apply({ 'lights:garden': 'off' }, 1);
    expect([emissive(lanterns), emissive(strings), emissive(grill)]).toEqual([0, 0, 3]);
    apply({ bbq: 'on' }, 0); // lit by day: the coals glow in full, the lights stay off
    expect([emissive(lanterns), emissive(strings), emissive(grill)]).toEqual([0, 0, 3]);
    apply({ bbq: 'off' }, 1); // put out at night
    expect(emissive(grill)).toBe(0);
  });

  it("fade the light pools under the lamps with the night and the garden lights' toggle, at full emission", () => {
    const pool = new MeshStandardMaterial({ emissive: 0xffb070, emissiveIntensity: 1.5 });
    pool.name = 'GLOW_pool';
    const bollards = node(new Group(), 'Garden_lamps', {
      interact: 'lights:garden',
      label: 'Đèn sân vườn',
      night_light: true,
    });
    const disc = new Mesh(new BoxGeometry(), pool);
    bollards.add(new Mesh(new BoxGeometry(), glowing()), disc);
    const root = new Group();
    root.add(bollards);
    const prepared = prepareModule(root);
    const model = prepareInteractions(root, prepared);
    const glow = disc.material as MeshStandardMaterial;
    const seen = () => [glow.visible, glow.opacity, glow.emissiveIntensity];
    applyToggles(model, prepared, {}, 0); // noon: not drawn at all
    expect(seen()).toEqual([false, 0, 1.5]);
    applyToggles(model, prepared, {}, 0.6); // dusk on auto: as strong as the night
    expect(seen()).toEqual([true, 0.6, 1.5]);
    applyToggles(model, prepared, { 'lights:garden': 'off' }, 1);
    expect(seen()).toEqual([false, 0, 1.5]);
    applyToggles(model, prepared, { 'lights:garden': 'on' }, 0); // switched on by day
    expect(seen()).toEqual([true, 1, 1.5]);
  });
});

/** The koi pond as pond/interact.py tags it: the rockery, the falling sheet of water and its foam are the waterfall. */
function pond() {
  const rockery = node(new Mesh(new BoxGeometry()), 'Rockery', {
    interact: 'waterfall',
    label: 'Thác nước',
  });
  const sheet = node(new Mesh(new BoxGeometry()), 'WATER_waterfall_sheet', {
    interact: 'waterfall',
    label: 'Thác nước',
  });
  const foam = node(new Mesh(new BoxGeometry()), 'Waterfall_foam', {
    interact: 'waterfall',
    label: 'Thác nước',
  });
  const water = node(new Mesh(new BoxGeometry()), 'WATER_surface');
  const root = new Group();
  root.add(rockery, sheet, foam, water);
  const prepared = prepareModule(root);
  return { prepared, model: prepareInteractions(root, prepared), rockery, sheet, foam, water };
}

describe('the waterfall', () => {
  it('runs on auto like the fountain, its foam with it, and a click stops it while the rockery and the pond stay', () => {
    const { prepared, model, rockery, sheet, foam, water } = pond();
    expect([sheet.visible, foam.visible]).toEqual([true, true]);
    applyToggles(model, prepared, {}, 1); // auto, at night too
    expect([sheet.visible, foam.visible]).toEqual([true, true]);
    applyToggles(model, prepared, { waterfall: 'off' }, 0);
    expect([sheet.visible, foam.visible, rockery.visible, water.visible]).toEqual([
      false,
      false,
      true,
      true,
    ]);
    applyToggles(model, prepared, { waterfall: 'on' }, 0);
    expect([sheet.visible, foam.visible]).toEqual([true, true]);
  });
});

describe('an air conditioner', () => {
  function unit() {
    const led = glowing();
    const body = node(new Mesh(new BoxGeometry(), [new MeshStandardMaterial(), led]), 'AC_master', {
      interact: 'ac:master',
      label: 'Máy lạnh phòng master',
      night_light: true,
    });
    const flap = node(new Mesh(new BoxGeometry()), 'AC_master_flap', {
      interact: 'ac:master',
      label: 'Máy lạnh phòng master',
      clip: 'act_ac_master',
    });
    body.add(flap);
    const root = new Group();
    root.add(body);
    const prepared = prepareModule(root);
    return { body, prepared, model: prepareInteractions(root, prepared) };
  }
  const ledOf = (body: Mesh) => (body.material as MeshStandardMaterial[])[1].emissiveIntensity;

  it('keeps its LED dark on auto, even at night, and lights it while on, by day too', () => {
    const { body, prepared, model } = unit();
    expect(model.clips).toEqual([{ group: 'ac:master', kind: 'ac', clip: 'act_ac_master' }]);
    applyToggles(model, prepared, {}, 1);
    expect(ledOf(body)).toBe(0);
    applyToggles(model, prepared, { 'ac:master': 'on' }, 0);
    expect(ledOf(body)).toBe(3);
    applyToggles(model, prepared, { 'ac:master': 'off' }, 1);
    expect(ledOf(body)).toBe(0);
  });
});

describe('the karaoke\'s party mode (party, villa v2 spec §12 "Tầng hầm")', () => {
  function karaoke() {
    const leds = node(
      new Mesh(new BoxGeometry(), [
        new MeshStandardMaterial({ name: 'M_party_led', emissive: 0xff40d0, emissiveIntensity: 4 }),
        new MeshStandardMaterial({
          name: 'GLOW_party',
          emissive: 0xff4ce6,
          emissiveIntensity: 1.8,
        }),
      ]),
      'LED_party',
      { interact: 'party', label: 'Chế độ tiệc', night_light: true },
    );
    const tv = node(
      new Mesh(
        new BoxGeometry(),
        new MeshStandardMaterial({ name: 'M_screen_on', emissive: 0x8cbfff }),
      ),
      'Karaoke_party',
      { interact: 'party', label: 'Chế độ tiệc', night_light: true },
    );
    const ball = node(
      new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name: 'M_chrome' })),
      'Disco_ball',
      { interact: 'party', label: 'Chế độ tiệc', clip: 'ambient_disco_ball' },
    );
    const lamp = node(new Mesh(new BoxGeometry(), glowing()), 'LT_down_karaoke', {
      interact: 'light:karaoke',
      label: 'Đèn',
      night_light: true,
    });
    const root = new Group();
    root.add(leds, tv, ball, lamp);
    const prepared = prepareModule(root);
    return { prepared, model: prepareInteractions(root, prepared), leds, tv, lamp };
  }
  const materials = (mesh: Mesh) => mesh.material as MeshStandardMaterial[];

  it("finds the party group's LED strips and the light they cast, and the disco ball's turn among the clips", () => {
    const { model, leds } = karaoke();
    expect(model.party.map((m) => m.name).sort()).toEqual(['GLOW_party', 'M_party_led']);
    expect(model.party).toEqual(materials(leds));
    expect(model.clips).toEqual([{ group: 'party', kind: 'party', clip: 'ambient_disco_ball' }]);
  });

  it('is off on auto, its TV and LEDs dark at night too, and a click lights them all', () => {
    const { prepared, model, leds, tv, lamp } = karaoke();
    applyToggles(model, prepared, {}, 1);
    expect(materials(leds)[0].emissiveIntensity).toBe(0);
    expect(materials(leds)[1].visible).toBe(false); // the light pool on the carpet costs no draw call
    expect(emissive(tv)).toBe(0);
    expect(emissive(lamp)).toBeCloseTo(3, 9); // the room's own lights follow the night
    applyToggles(model, prepared, { party: 'on' }, 0);
    expect(materials(leds)[0].emissiveIntensity).toBeCloseTo(4, 9);
    expect(materials(leds)[1].visible).toBe(true);
    expect(emissive(tv)).toBeGreaterThan(0);
  });

  it("cycles the LEDs' colour through the hues while on, a turn every PARTY_PERIOD seconds, and leaves it alone while off", () => {
    expect(PARTY_PERIOD).toBeGreaterThan(1);
    expect(PARTY_PERIOD).toBeLessThan(20);
    expect(partyHue(0)).toBeCloseTo(partyHue(PARTY_PERIOD), 9);
    expect(partyHue(PARTY_PERIOD / 2)).toBeCloseTo((partyHue(0) + 0.5) % 1, 9);
    const { model, leds } = karaoke();
    const [led, pool] = materials(leds);
    applyParty(model, true, PARTY_PERIOD / 4);
    const quarter = led.emissive.clone();
    applyParty(model, true, (3 * PARTY_PERIOD) / 4);
    expect(led.emissive.equals(quarter)).toBe(false);
    expect(pool.emissive.equals(led.emissive)).toBe(true); // the light on the carpet the colour of the strips
    const hsl = { h: 0, s: 0, l: 0 };
    led.emissive.getHSL(hsl);
    expect(hsl.h).toBeCloseTo(partyHue((3 * PARTY_PERIOD) / 4), 2);
    const now = led.emissive.clone();
    applyParty(model, false, 0);
    expect(led.emissive.equals(now)).toBe(true);
    applyParty(model, false, PARTY_PERIOD / 4); // however the clock runs on while off
    expect(led.emissive.getHex()).toBe(now.getHex());
    expect(pool.emissive.getHex()).toBe(now.getHex());
  });

  it('gives the disco ball mirror tiles that glow while the party is on and turn through the hues with the LEDs', () => {
    const tiles = new MeshStandardMaterial({
      name: 'M_disco',
      color: 0xcccccf,
      metalness: 0.5,
      emissive: 0xff4ce6,
      emissiveIntensity: 1.2,
    });
    const cap = new MeshStandardMaterial({ name: 'M_chrome', metalness: 1 });
    const ball = node(new Group(), 'Disco_ball', {
      interact: 'party',
      label: 'Chế độ tiệc',
      clip: 'ambient_disco_ball',
      night_light: true,
    });
    const facets = new Mesh(new BoxGeometry(), [tiles, cap]);
    ball.add(facets);
    const root = new Group();
    root.add(ball);
    const prepared = prepareModule(root);
    const model = prepareInteractions(root, prepared);
    const [mirror, chrome] = facets.material as MeshStandardMaterial[];
    expect(model.party).toEqual([mirror]); // the cap stays chrome
    applyToggles(model, prepared, {}, 1);
    expect(mirror.emissiveIntensity).toBe(0); // off on auto, as the LEDs
    applyToggles(model, prepared, { party: 'on' }, 0);
    expect(mirror.emissiveIntensity).toBeCloseTo(1.2, 9);
    const hsl = { h: 0, s: 0, l: 0 };
    for (const time of [PARTY_PERIOD / 4, (3 * PARTY_PERIOD) / 4]) {
      applyParty(model, true, time);
      mirror.emissive.getHSL(hsl);
      expect(hsl.h).toBeCloseTo(partyHue(time), 2);
    }
    expect(chrome.emissive.getHex()).toBe(0);
  });
});

describe("the sauna and the spa's hot tub (sauna, jacuzzi:spa)", () => {
  it("keeps the sauna's stones cold on auto and makes them glow while on; the hot tub's bubbles run on auto", () => {
    const stones = node(
      new Mesh(
        new BoxGeometry(),
        new MeshStandardMaterial({ name: 'M_ember', emissive: 0xff3308, emissiveIntensity: 1.6 }),
      ),
      'Sauna_stove',
      { interact: 'sauna', label: 'Phòng xông hơi', night_light: true },
    );
    const tub = node(new Mesh(new BoxGeometry()), 'Hot_tub', {
      interact: 'jacuzzi:spa',
      label: 'Bể ngâm',
      clip: 'ambient_hot_tub',
    });
    const root = new Group();
    root.add(stones, tub);
    const prepared = prepareModule(root);
    const model = prepareInteractions(root, prepared);
    applyToggles(model, prepared, {}, 1);
    expect(emissive(stones)).toBe(0);
    applyToggles(model, prepared, { sauna: 'on' }, 0);
    expect(emissive(stones)).toBeCloseTo(1.6, 9);
    expect(model.clips).toEqual([
      { group: 'jacuzzi:spa', kind: 'jacuzzi', clip: 'ambient_hot_tub' },
    ]);
  });
});

describe('driveClip', () => {
  it('opens the door with its act_ clip and closes it by playing the clip backwards', () => {
    const door = new Group();
    const mixer = new AnimationMixer(door);
    const clip = new AnimationClip('act_door_open', 1, [
      new VectorKeyframeTrack('.position', [0, 1], [0, 0, 0, 1.2, 0, 0]),
    ]);
    const action = mixer.clipAction(clip);
    driveClip(action, false); // closed and never opened: nothing to play
    expect(action.isScheduled()).toBe(false);
    driveClip(action, true);
    mixer.update(0.5);
    expect(door.position.x).toBeCloseTo(0.6, 6);
    mixer.update(2);
    expect(door.position.x).toBeCloseTo(1.2, 6); // and it stays open
    driveClip(action, false);
    mixer.update(0.25);
    expect(door.position.x).toBeCloseTo(0.9, 6);
    mixer.update(2);
    expect(door.position.x).toBeCloseTo(0, 6);
    driveClip(action, true); // reopens from shut
    mixer.update(0.5);
    expect(door.position.x).toBeCloseTo(0.6, 6);
  });

  it("pauses and resumes an ambient_ loop (the jacuzzi's bubbles)", () => {
    const bubbles = new Group();
    const mixer = new AnimationMixer(bubbles);
    const clip = new AnimationClip('ambient_jacuzzi', 2, [
      new VectorKeyframeTrack('.position', [0, 1, 2], [0, 0, 0, 0, 1, 0, 0, 0, 0]),
    ]);
    const action = mixer.clipAction(clip).setLoop(LoopRepeat, Infinity).play();
    mixer.update(0.5);
    driveClip(action, false);
    const y = bubbles.position.y;
    mixer.update(0.3);
    expect(bubbles.position.y).toBe(y);
    driveClip(action, true);
    mixer.update(0.3);
    expect(bubbles.position.y).not.toBe(y);
  });
});

describe('one-shot clips', () => {
  /** The Akita's tail: an ambient loop sways it along X, the happy clip lifts it along Y and adds a quicker swing. */
  function dog() {
    const root = new Group();
    const tail = new Group();
    tail.name = 'Akita_tail';
    root.add(tail);
    const mixer = new AnimationMixer(root);
    const wag = new AnimationClip('ambient_dog_tail', 2, [
      new VectorKeyframeTrack('Akita_tail.position', [0, 1, 2], [0, 0, 0, 1, 0, 0, 0, 0, 0]),
    ]);
    mixer.clipAction(wag).setLoop(LoopRepeat, Infinity).play();
    const happy = new AnimationClip('act_dog_happy', 1, [
      new VectorKeyframeTrack('Akita_tail.position', [0, 0.5, 1], [0, 0, 0, 0.2, 0.5, 0, 0, 0, 0]),
    ]);
    return { tail, mixer, happy };
  }

  it("plays the dog's happy clip once from its start, on top of the ambient loop, and leaves the dog at rest", () => {
    const { tail, mixer, happy } = dog();
    const action = oneShot(mixer, happy);
    mixer.update(0.25);
    expect(tail.position.y).toBe(0); // nothing until a click
    playOnce(action);
    mixer.update(0.25); // 0.5 s into the loop, 0.25 s into the happy clip
    expect(tail.position.x).toBeCloseTo(0.5 + 0.1, 6); // the loop's sway with the happy one added
    expect(tail.position.y).toBeCloseTo(0.25, 6);
    mixer.update(1); // past the happy clip's end: the loop alone again
    expect(tail.position.x).toBeCloseTo(0.5, 6);
    expect(tail.position.y).toBeCloseTo(0, 6);
    expect(action.isRunning()).toBe(false);
  });

  it('lets a click while it plays go by: the run goes on to its end, and a click after it plays it again', () => {
    const { tail, mixer, happy } = dog();
    const action = oneShot(mixer, happy);
    playOnce(action);
    mixer.update(0.75);
    playOnce(action); // mid-hop: not snapped back to the start
    mixer.update(0.1);
    expect(action.time).toBeCloseTo(0.85, 6);
    expect(tail.position.y).toBeCloseTo(0.15, 6);
    mixer.update(0.5); // past its end
    expect(action.isRunning()).toBe(false);
    playOnce(action);
    mixer.update(0.25);
    expect(action.time).toBeCloseTo(0.25, 6);
    expect(tail.position.y).toBeCloseTo(0.25, 6);
  });

  it("leaves the GLB's clip as it was: the module's clones share it", () => {
    const { mixer, happy } = dog();
    oneShot(mixer, happy);
    expect(happy.blendMode).toBe(NormalAnimationBlendMode);
    expect(Array.from(happy.tracks[0].values)).toEqual(
      Array.from(new Float32Array([0, 0, 0, 0.2, 0.5, 0, 0, 0, 0])),
    );
    expect(oneShot(mixer, happy).getClip().blendMode).toBe(AdditiveAnimationBlendMode);
  });
});
