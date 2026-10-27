// The 3D cube: 26 cubies, each a rounded body with a tile on every outside face, lit like plastic on a desk, turned
// one layer at a time. It draws only when something changes (a turn animating, a resize), not every frame.
//
// Turns queue up; while more are waiting the one in progress speeds up, so a fast run of smart-cube turns stays
// live rather than falling behind. show() drops whatever is queued and jumps straight to a state.
//
// The cubies sit in one body that can be tilted as a whole (setAttitude), so the cube on screen can be held the way a
// smart cube is: its gyro reports a few times a second, and the body glides from one report to the next.

import {
  BufferGeometry,
  Color,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  PMREMGenerator,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Shape,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Material,
  type Texture,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { LOOKS, type CubeLook, type FaceName, type LookSpec } from "./looks";
import { applyTurn, inLayers, parseTurn, snap, turnRotation, type LayerTurn } from "./moves";

/** A quarter turn at tempo 1, as in cubing.js; a half turn takes a little longer, as fingers do. */
const QUARTER_MS = 500;
const HALF_TURN_FACTOR = 1.35;
/** Cubies nearly touch, as on a real cube, so the gaps between them are thin dark lines. */
const BODY_SIZE = 0.985;
const BODY_RADIUS = 0.08;
/** A tile's rounded edge is this much as deep as it is wide. */
const BEVEL_DEPTH = 0.7;
/** How much darker a stickerless body is than its tile, so the seams between tiles read as shadow. */
const SEAM_SHADE = 0.62;

/** Where the camera looks from, as cubing.js put it (degrees): above the cube and round to the right. */
const LATITUDE = 30;
const LONGITUDE = 32;
const FIELD_OF_VIEW = 22;
/**
 * How much room the cube gets, as the radius (in cubie widths; the cube spans 3) the view fits: about cubing.js's
 * framing, which every page's layout was drawn around, with room for the cube however it's turned.
 */
const CUBE_RADIUS = 3.1;
const DISTANCE = CUBE_RADIUS / Math.sin((FIELD_OF_VIEW * Math.PI) / 360);
/** The cube's outer corners (cubie widths from its centre), tiles included. */
const CORNER = 1.52;
/** Dragging: degrees of turn per pixel, and how far over or under the cube the view may go. */
const DRAG_DEGREES = 0.45;
const MAX_LATITUDE = 80;

/** The six outward normals in BoxGeometry's group order (+x, -x, +y, -y, +z, -z) and the WCA face each one is. */
const NORMALS: readonly { normal: Vector3; face: FaceName }[] = [
  { normal: new Vector3(1, 0, 0), face: "R" },
  { normal: new Vector3(-1, 0, 0), face: "L" },
  { normal: new Vector3(0, 1, 0), face: "U" },
  { normal: new Vector3(0, -1, 0), face: "D" },
  { normal: new Vector3(0, 0, 1), face: "F" },
  { normal: new Vector3(0, 0, -1), face: "B" },
];

const FORWARD = new Vector3(0, 0, 1);

/**
 * Gliding to a new attitude takes about as long as the gyro's reports are apart (ms), so the body moves steadily
 * rather than jumping at each report; a big swing (turning the cube over) takes at least this long per degree.
 */
const TILT_MIN_MS = 30;
const TILT_MAX_MS = 160;
const TILT_MS_PER_DEGREE = 1.2;

/** A whole-cube rotation as a smart cube's gyro reads it, in three.js's axes (+x R, +y U, +z F). */
export type Attitude = { w: number; x: number; y: number; z: number };

type Tilt = { from: Quaternion; to: Quaternion; start: number; duration: number };

function ease(t: number): number {
  return 0.5 - Math.cos(Math.PI * t) / 2;
}

function roundedSquare(side: number, radius: number): Shape {
  const h = side / 2;
  const r = Math.min(radius, h);
  const shape = new Shape();
  shape.moveTo(-h + r, -h);
  shape.lineTo(h - r, -h);
  shape.quadraticCurveTo(h, -h, h, -h + r);
  shape.lineTo(h, h - r);
  shape.quadraticCurveTo(h, h, h - r, h);
  shape.lineTo(-h + r, h);
  shape.quadraticCurveTo(-h, h, -h, h - r);
  shape.lineTo(-h, -h + r);
  shape.quadraticCurveTo(-h, -h, -h + r, -h);
  return shape;
}

/** A tile lying on z = 0 and facing +z, its rounded edge included in `size`. */
function tileGeometry(spec: LookSpec["tile"], radius: number): BufferGeometry {
  const inner = spec.size - 2 * spec.bevel;
  const geometry = new ExtrudeGeometry(roundedSquare(inner, Math.max(0.005, radius - spec.bevel)), {
    depth: spec.height,
    bevelEnabled: true,
    bevelThickness: spec.bevel * BEVEL_DEPTH,
    bevelSize: spec.bevel,
    bevelSegments: 5,
    curveSegments: 10,
  });
  geometry.translate(0, 0, spec.bevel * BEVEL_DEPTH);
  return geometry;
}

type LookParts = {
  body: BufferGeometry;
  tile: BufferGeometry;
  centreTile: BufferGeometry;
  tiles: Readonly<Record<FaceName, Material>>;
  bodies: Readonly<Record<FaceName, Material>>;
  core: Material;
};

function byFace<T>(make: (face: FaceName) => T): Record<FaceName, T> {
  return { U: make("U"), R: make("R"), F: make("F"), D: make("D"), L: make("L"), B: make("B") };
}

// Each cube owns its geometry and materials: three.js hangs a listener for every renderer that drew them, so parts
// shared between cubes would keep every closed cube's renderer alive.
function buildParts(look: CubeLook): LookParts {
  const spec = LOOKS[look];
  const tile = (face: FaceName) =>
    new MeshPhysicalMaterial({
      color: spec.colours[face],
      roughness: spec.roughness,
      clearcoat: spec.clearcoat,
      clearcoatRoughness: 0.25,
      envMapIntensity: spec.environment,
    });
  const shaded = (face: FaceName) =>
    new MeshStandardMaterial({
      color: spec.body === null ? new Color(spec.colours[face]).multiplyScalar(SEAM_SHADE) : spec.body,
      roughness: 0.7,
      envMapIntensity: spec.environment * 0.6,
    });
  return {
    body: new RoundedBoxGeometry(BODY_SIZE, BODY_SIZE, BODY_SIZE, 3, BODY_RADIUS),
    tile: tileGeometry(spec.tile, spec.tile.radius),
    centreTile: tileGeometry(spec.tile, spec.tile.centreRadius),
    tiles: byFace(tile),
    bodies: byFace(shaded),
    core: new MeshStandardMaterial({ color: spec.core, roughness: 0.8, envMapIntensity: spec.environment * 0.4 }),
  };
}

function disposeParts(parts: LookParts): void {
  for (const geometry of [parts.body, parts.tile, parts.centreTile]) geometry.dispose();
  for (const material of [...Object.values(parts.tiles), ...Object.values(parts.bodies), parts.core]) material.dispose();
}

/** The cubie that starts at `home`, in solved colours, as a group placed at `home`. */
function buildCubie(home: Vector3, parts: LookParts, look: CubeLook): Group {
  const { body, tile, centreTile, tiles, bodies, core } = parts;
  const outside = NORMALS.map(({ normal }) => normal.dot(home) > 0.5);
  const cubie = new Group();
  cubie.add(new Mesh(body, NORMALS.map(({ face }, i) => (outside[i] ? bodies[face] : core))));
  const isCentre = Math.abs(home.x) + Math.abs(home.y) + Math.abs(home.z) === 1;
  NORMALS.forEach(({ normal, face }, i) => {
    if (!outside[i]) return;
    const mesh = new Mesh(isCentre ? centreTile : tile, tiles[face]);
    mesh.quaternion.setFromUnitVectors(FORWARD, normal);
    // Its back bevel sunk into the body, so only the pillowed top stands proud and no gap shows under its edge.
    mesh.position.copy(normal).multiplyScalar(BODY_SIZE / 2 - LOOKS[look].tile.bevel * BEVEL_DEPTH - 0.004);
    cubie.add(mesh);
  });
  cubie.position.copy(home);
  cubie.userData.home = home.clone();
  return cubie;
}

type Active = { turn: LayerTurn; pivot: Group; elapsed: number; duration: number };

export class CubeRenderer {
  readonly #host: HTMLElement;
  readonly #renderer: WebGLRenderer;
  readonly #scene = new Scene();
  readonly #camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 100);
  readonly #environment: Texture;
  readonly #resize: ResizeObserver;
  /** Every cubie, and each turn's pivot while it turns: tilting it tilts the whole cube. */
  readonly #body = new Group();
  #tilt: Tilt | null = null;
  #lastAttitudeAt = 0;
  #cubies: Group[] = [];
  #look: CubeLook;
  #parts: LookParts | null = null;
  #queue: LayerTurn[] = [];
  #active: Active | null = null;
  #tempo = 1;
  #frame: number | null = null;
  #lastFrame = 0;
  #latitude = LATITUDE;
  #longitude = LONGITUDE;
  /** The view can be dragged round (not while a smart cube's gyro tilts the cube instead). */
  #draggable = true;

  constructor(host: HTMLElement, look: CubeLook) {
    this.#host = host;
    this.#look = look;
    this.#renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.#renderer.setClearColor(0x000000, 0);
    this.#renderer.outputColorSpace = SRGBColorSpace;
    // Neutral keeps the plastic's own colours (ACES washes oranges and greens out to pastel).
    this.#renderer.toneMapping = NeutralToneMapping;
    this.#renderer.toneMappingExposure = LOOKS[look].exposure;
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.append(this.#renderer.domElement);

    const pmrem = new PMREMGenerator(this.#renderer);
    const room = new RoomEnvironment();
    this.#environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    this.#scene.environment = this.#environment;

    // A soft key light from above, front and left: the top brightest, the front lit, the right in light shade.
    const key = new DirectionalLight(0xffffff, 1.5);
    key.position.set(-2, 8, 3.5);
    this.#scene.add(key);
    const fill = new DirectionalLight(0xfff4e8, 0.35);
    fill.position.set(5, 1, 2);
    this.#scene.add(fill);

    this.#placeCamera();
    this.#listenForDrags(this.#renderer.domElement);

    this.#scene.add(this.#body);
    this.#build();
    this.#resize = new ResizeObserver(() => this.#fit());
    this.#resize.observe(host);
    // After a GPU reset three.js restores its own state; the cube only needs drawing again.
    this.#renderer.domElement.addEventListener("webglcontextrestored", () => this.#invalidate());
    this.#fit();
  }

  /** Solved, then `moves` applied at once, nothing queued. */
  show(moves: readonly string[]): void {
    this.#cancel();
    for (const cubie of this.#cubies) {
      cubie.position.copy(cubie.userData.home as Vector3);
      cubie.quaternion.identity();
    }
    for (const move of moves) {
      const turn = this.#parse(move);
      if (turn) applyTurn(this.#cubies, turn);
    }
    this.#invalidate();
  }

  /** Animate one more move after everything queued. */
  turn(move: string): void {
    const turn = this.#parse(move);
    if (!turn) return;
    this.#queue.push(turn);
    this.#invalidate();
  }

  /**
   * Tilts the whole cube to `attitude` (null: upright), gliding there from wherever it is unless `jump`. The turns it
   * shows are unaffected: they turn its layers, wherever the tilt has put them.
   */
  setAttitude(attitude: Attitude | null, jump = false): void {
    const to = attitude ? new Quaternion(attitude.x, attitude.y, attitude.z, attitude.w).normalize() : new Quaternion();
    const now = performance.now();
    const since = now - this.#lastAttitudeAt;
    this.#lastAttitudeAt = now;
    if (jump) {
      this.#tilt = null;
      this.#body.quaternion.copy(to);
    } else {
      const from = this.#body.quaternion.clone();
      const degrees = (from.angleTo(to) * 180) / Math.PI;
      const duration = Math.max(Math.min(Math.max(since, TILT_MIN_MS), TILT_MAX_MS), degrees * TILT_MS_PER_DEGREE);
      this.#tilt = { from, to, start: now, duration };
    }
    this.#invalidate();
  }

  /** Back to the usual view (above the cube, round to the right), as after a double click. */
  resetView(): void {
    this.#latitude = LATITUDE;
    this.#longitude = LONGITUDE;
    this.#placeCamera();
    this.#invalidate();
  }

  setTempo(scale: number): void {
    this.#tempo = scale > 0 ? scale : 1;
  }

  /** Whether the view can be dragged round; turning it off puts the usual view back. */
  setDraggable(draggable: boolean): void {
    if (draggable === this.#draggable) return;
    this.#draggable = draggable;
    this.#renderer.domElement.classList.toggle("fixed-view", !draggable);
    if (!draggable) this.resetView();
  }

  setLook(look: CubeLook): void {
    if (look === this.#look) return;
    this.#look = look;
    this.#renderer.toneMappingExposure = LOOKS[look].exposure;
    this.#build();
    this.#invalidate();
  }

  dispose(): void {
    if (this.#frame !== null) cancelAnimationFrame(this.#frame);
    this.#frame = null;
    this.#resize.disconnect();
    if (this.#parts) disposeParts(this.#parts);
    this.#parts = null;
    this.#environment.dispose();
    this.#renderer.dispose();
    // Browsers allow only a handful of live WebGL contexts; free this one now rather than at garbage collection.
    this.#renderer.forceContextLoss();
    this.#renderer.domElement.remove();
  }

  #placeCamera(): void {
    const lat = (this.#latitude * Math.PI) / 180;
    const lon = (this.#longitude * Math.PI) / 180;
    this.#camera.position.set(DISTANCE * Math.cos(lat) * Math.sin(lon), DISTANCE * Math.sin(lat), DISTANCE * Math.cos(lat) * Math.cos(lon));
    this.#camera.lookAt(0, 0, 0);
    this.#camera.updateMatrixWorld();
    this.#markDrawnBox();
  }

  /**
   * Where the cube is drawn in the canvas, in CSS px, so layout checks (e2e/layout.spec.ts) can tell the cube from the
   * canvas's empty margin: data-cube-points, its eight corners on screen, and data-cube-box, their bounding box
   * (left, top, width, height). The corners stay where they are however the cube turns.
   */
  #markDrawnBox(): void {
    const canvas = this.#renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    const points: [number, number][] = [];
    for (const x of [-CORNER, CORNER])
      for (const y of [-CORNER, CORNER])
        for (const z of [-CORNER, CORNER]) {
          const p = new Vector3(x, y, z).project(this.#camera);
          points.push([((p.x + 1) / 2) * width, ((1 - p.y) / 2) * height]);
        }
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const [left, top] = [Math.min(...xs), Math.min(...ys)];
    canvas.dataset.cubeBox = [left, top, Math.max(...xs) - left, Math.max(...ys) - top].map((v) => v.toFixed(1)).join(",");
    canvas.dataset.cubePoints = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  }

  /** Drag to look at the cube from anywhere; a double click puts the view back. Turns are unaffected. */
  #listenForDrags(canvas: HTMLCanvasElement): void {
    let last: { x: number; y: number } | null = null;
    canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !this.#draggable) return;
      last = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add("dragging");
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!last) return;
      this.#longitude -= (event.clientX - last.x) * DRAG_DEGREES;
      this.#latitude = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, this.#latitude + (event.clientY - last.y) * DRAG_DEGREES));
      last = { x: event.clientX, y: event.clientY };
      this.#placeCamera();
      this.#invalidate();
    });
    const stop = (event: PointerEvent) => {
      if (!last) return;
      last = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.classList.remove("dragging");
    };
    canvas.addEventListener("pointerup", stop);
    canvas.addEventListener("pointercancel", stop);
    // Capture can go without either (a window switch mid-drag): the drag ends there too.
    canvas.addEventListener("lostpointercapture", stop);
    canvas.addEventListener("dblclick", () => {
      if (this.#draggable) this.resetView();
    });
  }

  #parse(move: string): LayerTurn | null {
    const turn = parseTurn(move);
    if (!turn) console.error(`CubeRenderer: "${move}" is not a move`);
    return turn;
  }

  /** The cubies afresh for the current look, each kept where it is; turns still queued play on after. */
  #build(): void {
    if (this.#active) this.#finish(this.#active);
    this.#active = null;
    const placed = this.#cubies.map((cubie) => ({ position: cubie.position.clone(), quaternion: cubie.quaternion.clone() }));
    for (const cubie of this.#cubies) this.#body.remove(cubie);
    const previous = this.#parts;
    const parts = buildParts(this.#look);
    const cubies: Group[] = [];
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++) if (x !== 0 || y !== 0 || z !== 0) cubies.push(buildCubie(new Vector3(x, y, z), parts, this.#look));
    cubies.forEach((cubie, i) => {
      const was = placed[i];
      if (was) {
        cubie.position.copy(was.position);
        cubie.quaternion.copy(was.quaternion);
      }
      this.#body.add(cubie);
    });
    this.#cubies = cubies;
    this.#parts = parts;
    if (previous) disposeParts(previous);
  }

  #fit(): void {
    const width = this.#host.clientWidth;
    const height = this.#host.clientHeight;
    if (width === 0 || height === 0) return;
    this.#renderer.setSize(width, height, false);
    this.#camera.aspect = width / height;
    // Keep the whole cube in a narrow box too: widen the view when the box is taller than it is wide.
    const fov = width >= height ? FIELD_OF_VIEW : (2 * Math.atan(Math.tan((FIELD_OF_VIEW * Math.PI) / 360) / this.#camera.aspect) * 180) / Math.PI;
    this.#camera.fov = fov;
    this.#camera.updateProjectionMatrix();
    this.#markDrawnBox();
    this.#invalidate();
  }

  #begin(turn: LayerTurn): Active {
    const pivot = new Group();
    this.#body.add(pivot);
    for (const cubie of this.#cubies) if (inLayers(cubie.position, turn)) pivot.attach(cubie);
    const duration = (QUARTER_MS * (Math.abs(turn.quarters) >= 2 ? HALF_TURN_FACTOR : 1)) / this.#tempo;
    return { turn, pivot, elapsed: 0, duration };
  }

  #finish(active: Active): void {
    turnRotation(active.turn, 1, active.pivot.quaternion);
    active.pivot.updateMatrixWorld(true);
    for (const cubie of [...active.pivot.children] as Group[]) {
      this.#body.attach(cubie);
      snap(cubie);
    }
    this.#body.remove(active.pivot);
  }

  /** Lands the turn in progress where it would end and drops the queue. */
  #cancel(): void {
    if (this.#active) this.#finish(this.#active);
    this.#active = null;
    this.#queue = [];
  }

  #invalidate(): void {
    if (this.#frame !== null) return;
    this.#lastFrame = performance.now();
    this.#frame = requestAnimationFrame((now) => this.#draw(now));
  }

  #draw(now: number): void {
    this.#frame = null;
    let dt = Math.max(0, now - this.#lastFrame);
    this.#lastFrame = now;
    for (;;) {
      if (!this.#active) {
        const next = this.#queue.shift();
        if (!next) break;
        this.#active = this.#begin(next);
      }
      const active = this.#active;
      // Catch up: the more turns waiting, the faster this one goes.
      const speed = 1 + this.#queue.length;
      const remaining = (active.duration - active.elapsed) / speed;
      if (dt >= remaining) {
        this.#finish(active);
        this.#active = null;
        dt -= remaining;
        continue;
      }
      active.elapsed += dt * speed;
      break;
    }
    if (this.#active) {
      const { turn, pivot, elapsed, duration } = this.#active;
      turnRotation(turn, ease(elapsed / duration), pivot.quaternion);
    }
    const tilting = this.#stepTilt(now);
    this.#renderer.render(this.#scene, this.#camera);
    if (this.#active || this.#queue.length > 0 || tilting) {
      this.#frame = requestAnimationFrame((next) => this.#draw(next));
    }
  }

  /** The body's tilt at `now`, gliding at a steady pace (an eased glide would pulse at every report); whether it's still moving. */
  #stepTilt(now: number): boolean {
    const tilt = this.#tilt;
    if (!tilt) return false;
    const fraction = Math.min(1, Math.max(0, (now - tilt.start) / tilt.duration));
    this.#body.quaternion.slerpQuaternions(tilt.from, tilt.to, fraction);
    if (fraction < 1) return true;
    this.#tilt = null;
    return false;
  }
}
