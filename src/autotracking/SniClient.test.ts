import { afterEach, describe, expect, it, vi } from "vitest";
import { SniClient, type SniStatus } from "./SniClient";
import {
  detectSecretOfMana,
  readMantisAntState,
  readPotosChestState,
} from "./potosEvent";
import { readMidgeMalletState, readSpearState } from "./inventory";
import {
  PotosAutotracker,
  type PotosAutotrackerSnapshot,
} from "./PotosAutotracker";
import { LocationAutotracker } from "./LocationAutotracker";
import type { LocationDefinition } from "../domain/tracker";
import { LOCATION_DEFINITIONS } from "../data/locationDefinitions";
import { SandshipAutotracker, SANDSHIP_EVENT_SIGNATURES } from "./SandshipAutotracker";
import { SANDSHIP } from "../data/sandship";

type Listener = (event: { data?: string | ArrayBuffer }) => void;

const EVENT_POINTER_TABLE = 0xe16b53;
const POTOS_POINTER_ADDRESS = 0x216b53 + 0x680 * 3;
const MANTIS_POINTER_ADDRESS = 0x216b53 + 0x112 * 3;
function createMockMemory(): Map<number, Uint8Array> {
  return new Map<number, Uint8Array>([
  [0xf500dc, new Uint8Array([0x01, 0x00])],
  [0xf500d1, new Uint8Array([0x00, 0x00, 0x00])],
  [0xf50100, new Uint8Array([0x00])],
  [0xf5cf0c, new Uint8Array([0x01, 0x00, 0x00])],
  [0x01e7a3, new Uint8Array([0x53, 0x6b, 0xe1])],
  [POTOS_POINTER_ADDRESS, new Uint8Array([0x34, 0x49, 0xe1])],
  [MANTIS_POINTER_ADDRESS, new Uint8Array([0xd4, 0x45, 0xe1])],
  [0x214934, new Uint8Array([0x50, 0x42, 0x29, 0x1f, 0x13, 0x96, 0x30, 0x29, 0x01, 0xa0, 0x00])],
  [0x2145d4, new Uint8Array([0x25, 0x01, 0x30, 0x10, 0x0c, 0x50, 0x42, 0x76, 0x1f, 0x13, 0x96, 0x30, 0x76, 0x01, 0x00])],
  [0xf5cf29, new Uint8Array([0x01])],
  [0xf5cf76, new Uint8Array([0x01])],
  [0xf5cf5c, new Uint8Array([0x01])],
  [0xf5cfcb, new Uint8Array([0x01])],
  ]);
}

let mockMemory = createMockMemory();

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly sentRequests: Array<Record<string, unknown>> = [];
  readyState = MockWebSocket.CONNECTING;
  binaryType = "blob";
  private readonly listeners = new Map<string, Listener[]>();

  constructor(readonly url: string) {
    MockWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = MockWebSocket.OPEN;
      this.emit("open", {});
    });
  }

  static instances: MockWebSocket[] = [];

  addEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  send(data: string): void {
    const request = JSON.parse(data) as {
      Opcode: string;
      Operands?: string[];
    };
    this.sentRequests.push(request);

    if (request.Opcode === "DeviceList") {
      this.emitText({ Results: ["Mock SNES"] });
    } else if (request.Opcode === "Info") {
      this.emitText({ Results: ["mock", "MockDevice", "Secret of Mana"] });
    } else if (request.Opcode === "GetAddress") {
      const address = Number.parseInt(request.Operands?.[0] ?? "", 16);
      const size = Number.parseInt(request.Operands?.[1] ?? "", 16);
      const response = new Uint8Array(size);
      for (const [segmentAddress, source] of mockMemory) {
        const overlapStart = Math.max(address, segmentAddress);
        const overlapEnd = Math.min(address + size, segmentAddress + source.length);
        if (overlapStart < overlapEnd) {
          response.set(
            source.subarray(overlapStart - segmentAddress, overlapEnd - segmentAddress),
            overlapStart - address,
          );
        }
      }
      queueMicrotask(() => this.emit("message", { data: response.buffer }));
    }
  }

  close(): void {
    if (this.readyState === MockWebSocket.CLOSED) {
      return;
    }
    this.readyState = MockWebSocket.CLOSED;
    this.emit("close", {});
  }

  private emitText(reply: unknown): void {
    queueMicrotask(() => this.emit("message", { data: JSON.stringify(reply) }));
  }

  private emit(type: string, event: { data?: string | ArrayBuffer }): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

async function waitForAttached(client: SniClient): Promise<SniStatus> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Mock SNI did not attach")), 1_000);
    const unsubscribe = client.subscribe((status) => {
      if (status.phase === "attached") {
        clearTimeout(timer);
        unsubscribe();
        resolve(status);
      }
    });
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  MockWebSocket.instances.length = 0;
  mockMemory = createMockMemory();
});

function waitForTrackerSnapshot(
  tracker: PotosAutotracker,
  predicate: (snapshot: PotosAutotrackerSnapshot) => boolean,
): Promise<PotosAutotrackerSnapshot> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error("Autotracker did not reach the expected state"));
    }, 2_500);
    let unsubscribe = () => {};
    unsubscribe = tracker.subscribe((snapshot) => {
      if (predicate(snapshot)) {
        clearTimeout(timer);
        unsubscribe();
        resolve(snapshot);
      }
    });
  });
}

describe("SniClient usb2snes flow", () => {
  it("feeds independent main/pop-out SNI clients and keeps the pop-out live after the main window stops", async () => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    const main = new PotosAutotracker("ws://mock-sni:23074"), popout = new PotosAutotracker("ws://mock-sni:23074");
    main.start(); popout.start();
    try {
      await Promise.all([main, popout].map(tracker => waitForTrackerSnapshot(tracker, s => s.gameDetected && s.ram.inventory["weapon-spear"] === true)));
      expect(MockWebSocket.instances).toHaveLength(2);
      mockMemory.set(0xf5cfcb, new Uint8Array([0]));
      await Promise.all([main, popout].map(tracker => waitForTrackerSnapshot(tracker, s => s.gameDetected && s.ram.inventory["weapon-spear"] === false)));
      main.stop(); mockMemory.set(0xf5cfcb, new Uint8Array([1]));
      const acquired = await waitForTrackerSnapshot(popout, s => s.gameDetected && s.ram.inventory["weapon-spear"] === true);
      expect(acquired.sni.phase).toBe("attached");
      expect(MockWebSocket.instances[0].readyState).toBe(MockWebSocket.CLOSED);
      expect(MockWebSocket.instances[1].readyState).toBe(MockWebSocket.OPEN);
    } finally { main.stop(); popout.stop(); }
  }, 10000);

  it("rehydrates Pandora Girl from the reported $E17420/$E151C8/$CFAF trace on a fresh tracker, not browser persistence", async () => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    mockMemory.set(0x01e7a3, new Uint8Array([0x20,0x74,0xe1]));
    mockMemory.set(0x217420 + 0x188 * 3, new Uint8Array([0xc8,0x51,0xe1]));
    mockMemory.set(0x2151c8, new Uint8Array([0x50,0x42,0xaf,0x1f,0x13,0x96,0x39,0x02,0xcf,0x38,0x39,0x03,0xcf,0x07,0x30,0xaf,0x01,0x28,0x00,0x51,0x00]));
    mockMemory.set(0xf5cfaf, new Uint8Array([1]));
    for (let reload = 0; reload < 2; reload++) {
      const tracker = new PotosAutotracker("ws://mock-sni:23074"); tracker.start();
      try {
        const restored = await waitForTrackerSnapshot(tracker, s => s.gameDetected && s.ram.checks["pandora-castle-girl"] === true);
        expect(restored.locations["pandora-castle-girl"].events[0]).toMatchObject({
          eventPointerTable: 0xe17420, eventPointer: 0xe151c8,
          strategy: { kind: "flag", flagAddress: 0x7ecfaf }, flagValue: 1, error: null,
        });
        mockMemory.set(0xf5cfaf, new Uint8Array([0]));
        await waitForTrackerSnapshot(tracker, s => s.gameDetected && s.ram.checks["pandora-castle-girl"] === false);
        mockMemory.set(0xf5cfaf, new Uint8Array([1]));
        await waitForTrackerSnapshot(tracker, s => s.gameDetected && s.ram.checks["pandora-castle-girl"] === true);
      } finally { tracker.stop(); }
    }
  }, 10000);

  it.each([
    // PrizeEvents.cs $188 injects one randomized prize, not the vanilla $13
    // story flag or physical party bit. OpenWorldPrizes.cs prize shapes:
    ["weapon", 0xc8, [0x1e,0x80,0x29,0xc0,0x29,0xc8]],
    ["weapon orb", 0x06, [0x29,0x06,0x42,0xba,0x08,0x29,0xba,0x42,0xc2,0x08,0x29,0xc2]],
    ["magic", 0xa8, [0x39,0x02,0xc8,0x38,0x39,0x03,0xc8,0x07,0x30,0xa8,0x01]],
    ["seed", 0x96, [0x30,0x96,0x01,0x25,0x94]],
    ["gold", 0x77, [0x36,0x90,0x01,0xa8,0x89,0x83,0x85,0x80,0x29,0x77]],
    ["character reward", 0x0e, [0x51,0x1f,0x02,0x29,0x0e,0x29,0xc9,0x2b,0x02]],
  ] as const)("Pandora Girl $188 dynamically follows its %s prize flag through collection, rollback and reattachment", async (_name, flag, body) => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    mockMemory.set(0x216b53 + 0x188 * 3, new Uint8Array([0x00,0x50,0xe1]));
    mockMemory.set(0x215000, new Uint8Array([0x50,0x42,flag,0x1f,0x13,0x96,...body,0x28,0x00,0x51,0x00]));
    mockMemory.set(0xf5cf00 + flag, new Uint8Array([0]));
    mockMemory.set(0xf5cf13, new Uint8Array([7])); // pre-set by InitialEventFlagStates.cs
    mockMemory.set(0xf500d9, new Uint8Array([2])); // Girl present is unrelated
    const definitions = LOCATION_DEFINITIONS.filter(check => check.id === "pandora-castle-girl");
    expect(definitions[0].events).toEqual([{ eventNumber: 0x188 }]);
    const client = new SniClient("ws://mock-sni:23074"); client.start();
    try {
      await waitForAttached(client);
      const tracker = new LocationAutotracker(client, definitions);
      expect((await tracker.poll()).checks["pandora-castle-girl"]).toBe(false);
      mockMemory.set(0xf5cf00 + flag, new Uint8Array([1]));
      const claimed = await tracker.poll();
      expect(claimed.checks["pandora-castle-girl"]).toBe(true);
      expect(claimed.diagnostics["pandora-castle-girl"].events[0]).toMatchObject({
        eventNumber: 0x188, strategy: { kind: "flag", flagAddress: 0x7ecf00 + flag }, error: null,
      });
      mockMemory.set(0xf5cf00 + flag, new Uint8Array([0]));
      expect((await tracker.poll()).checks["pandora-castle-girl"]).toBe(false);
      expect((await new LocationAutotracker(client, definitions).poll()).checks["pandora-castle-girl"]).toBe(false);
    } finally { client.stop(); }
  });

  it("tracks Girl's native physical membership with zero reward flags through rollback and socket reconnect", async () => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    mockMemory.set(0xf5cf0c, new Uint8Array([0,0,0]));
    mockMemory.set(0xf500d9, new Uint8Array([2]));
    const tracker = new PotosAutotracker("ws://mock-sni:23074"); tracker.start();
    try {
      const girl = await waitForTrackerSnapshot(tracker, (s) => s.gameDetected && s.ram.inventory.girl === true);
      expect(girl.ram.inventory.boy).toBe(false); expect(girl.game?.partyMask).toBe(2);
      mockMemory.set(0xf500d9, new Uint8Array([6]));
      await waitForTrackerSnapshot(tracker, (s) => s.ram.inventory.sprite === true);
      mockMemory.set(0xf500d9, new Uint8Array([2]));
      await waitForTrackerSnapshot(tracker, (s) => s.ram.inventory.sprite === false && s.ram.inventory.girl === true);
      const previousSockets = MockWebSocket.instances.length;
      MockWebSocket.instances.at(-1)!.close();
      const reconnected = await waitForTrackerSnapshot(tracker, (s) => MockWebSocket.instances.length > previousSockets && s.gameDetected && s.ram.inventory.girl === true);
      expect(reconnected.ram.inventory.sprite).toBe(false);
      expect(reconnected.inventory.girl).toMatchObject({ address: 0x7e00d9, rawValue: 2, decodedValue: true });
    } finally { tracker.stop(); }
  }, 10000);
  function installSandship(claimFlag = 0xca) {
    for (const [index, signature] of SANDSHIP_EVENT_SIGNATURES.entries()) {
      const pointer = 0xe16000 + index * 0x100;
      mockMemory.set(0x216b53 + signature.event * 3, new Uint8Array([pointer & 0xff, pointer >> 8 & 0xff, pointer >> 16]));
      const bytes: number[] = [...signature.bytes];
      if (signature.event === SANDSHIP.captainEvent) {
        bytes.push(0x42, claimFlag, 0x1f, 0x13, 0x96);
        // OpenWorldPrizes.cs: weapon acquisition increments both stage/ownership;
        // the first (C2) is NOT the persistent acquired flag (CA).
        if (claimFlag === 0xca) bytes.push(0x1e, 0x92, 0x29, 0xc2, 0x29, claimFlag, 0x1f, 0x08, 0x2f, 0x44, 0x00);
        else bytes.push(0x30, claimFlag, 0x01, 0x00);
      }
      mockMemory.set(pointer - 0xc00000, new Uint8Array(bytes));
    }
    mockMemory.set(0xf5cf28, new Uint8Array([14]));
    mockMemory.set(0xf5cf00 + claimFlag, new Uint8Array([0]));
  }

  it.each([0xca, 0x77])("resolves Captain dynamically to flag 0x%s, independently of boss clear, with rollback", async (claimFlag) => {
    vi.stubGlobal("WebSocket", MockWebSocket); installSandship(claimFlag);
    const client = new SniClient("ws://mock-sni:23074"); client.start();
    try {
      await waitForAttached(client);
      const boss = new SandshipAutotracker(client);
      const checks = new LocationAutotracker(client, LOCATION_DEFINITIONS.filter((check) => check.id === SANDSHIP.captainId || check.id === "potos-chest"));
      expect(await boss.poll()).toMatchObject({ supported: true, bossDefeated: false, bossFlagValue: 14, error: null });
      expect((await checks.poll(true)).checks[SANDSHIP.captainId]).toBe(false);
      mockMemory.set(0xf5cf28, new Uint8Array([15]));
      expect((await boss.poll()).bossDefeated).toBe(true);
      expect((await checks.poll(true)).checks[SANDSHIP.captainId]).toBe(false);
      mockMemory.set(0xf5cf00 + claimFlag, new Uint8Array([1]));
      const claimed = await checks.poll(true);
      expect(claimed.checks[SANDSHIP.captainId]).toBe(true);
      expect(claimed.diagnostics[SANDSHIP.captainId].events[0].strategy).toMatchObject({ kind: "flag", flagAddress: 0x7ecf00 + claimFlag });
      mockMemory.set(0xf5cf28, new Uint8Array([14])); mockMemory.set(0xf5cf00 + claimFlag, new Uint8Array([0]));
      expect((await boss.poll()).bossDefeated).toBe(false);
      expect((await checks.poll(true)).checks[SANDSHIP.captainId]).toBe(false);
      const unsupported = await checks.poll(false);
      expect(unsupported.checks[SANDSHIP.captainId]).toBeNull();
      expect(unsupported.checks["potos-chest"]).toBe(true);
    } finally { client.stop(); }
  });

  it("requires every patched signature, rejects invalid boss values and does not infer support from event IDs", async () => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    const client = new SniClient("ws://mock-sni:23074"); client.start();
    try {
      await waitForAttached(client); const tracker = new SandshipAutotracker(client);
      expect(await tracker.poll()).toMatchObject({ supported: false, bossDefeated: null, error: null });
      installSandship();
      mockMemory.set(0xf5cf28, new Uint8Array([16]));
      expect(await tracker.poll()).toMatchObject({ supported: true, bossDefeated: null, bossFlagValue: null, error: "Invalid Sandship boss flag value: 16" });
      for (const [index] of SANDSHIP_EVENT_SIGNATURES.entries()) {
        installSandship(); mockMemory.set(0x216000 + index * 0x100, new Uint8Array([0]));
        expect((await tracker.poll()).supported).toBe(false);
      }
    } finally { client.stop(); }
  });

  it("isolates Sandship compatibility/claim failures while game, Potos, Mantis and inventory keep polling", async () => {
    vi.stubGlobal("WebSocket", MockWebSocket); installSandship();
    mockMemory.set(0xf5cf28, new Uint8Array([15]));
    mockMemory.set(0x216200, new Uint8Array([...SANDSHIP_EVENT_SIGNATURES[2].bytes, 0x00]));
    mockMemory.set(0xf500d1, new Uint8Array([0x00, 0x62, 0xe1]));
    let failCompatibility = false;
    const originalRead = SniClient.prototype.readMemory;
    vi.spyOn(SniClient.prototype, "readMemory").mockImplementation(function (this: SniClient, address, size) {
      if (failCompatibility && address === 0x216b53 + SANDSHIP.entranceEvent * 3 && size === 3) return Promise.reject(new Error("Mock Sandship compatibility failure"));
      return originalRead.call(this, address, size);
    });
    const tracker = new PotosAutotracker("ws://mock-sni:23074"); tracker.start();
    try {
      const failedClaim = await waitForTrackerSnapshot(tracker, (s) => s.gameDetected && s.ram.sandship.bossDefeated === true);
      expect(failedClaim.ram.checks["potos-chest"]).toBe(true);
      expect(failedClaim.ram.checks["mantis-ant"]).toBe(true);
      expect(failedClaim.ram.inventory["weapon-spear"]).toBe(true);
      expect(failedClaim.ram.checks[SANDSHIP.captainId]).toBeNull();
      expect(failedClaim.locations[SANDSHIP.captainId].error).toContain("persistent prize-claim flag");
      failCompatibility = true; mockMemory.set(0xf5cf29, new Uint8Array([0]));
      const later = await waitForTrackerSnapshot(tracker, (s) => s.ram.sandship.error === "Mock Sandship compatibility failure");
      expect(later.gameDetected).toBe(true);
      expect(later.game?.currentMap).toBe(1);
      expect(later.ram.checks["potos-chest"]).toBe(false);
      expect(later.ram.inventory["weapon-spear"]).toBe(true);
      expect(later.ram.sandship.supported).toBeNull();
    } finally { tracker.stop(); }
  });
  it("autotracks independent Pandora chest events and rolls one back without completing its sibling", async () => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    const definitions = LOCATION_DEFINITIONS.filter((check) => check.legacyPath === "@Pandora/Pandora Castle Chests");
    definitions.forEach((check, index) => {
      const address = 0xe15000 + index * 16;
      mockMemory.set(0x216b53 + check.events[0].eventNumber * 3,
        new Uint8Array([address & 0xff, (address >> 8) & 0xff, address >> 16]));
      mockMemory.set(address - 0xc00000, new Uint8Array([0x30, 0x90 + index, 0x01, 0x00]));
      mockMemory.set(0xf5cf90 + index, new Uint8Array([index === 0 ? 1 : 0]));
    });
    const client = new SniClient("ws://mock-sni:23074"); client.start();
    try {
      await waitForAttached(client);
      const tracker = new LocationAutotracker(client, definitions);
      const first = await tracker.poll();
      expect(first.checks["pandora-castle-chest-673"]).toBe(true);
      expect(first.checks["pandora-castle-chest-67c"]).toBe(false);
      expect(Object.values(first.checks).filter(Boolean)).toHaveLength(1);
      mockMemory.set(0xf5cf90, new Uint8Array([0]));
      mockMemory.set(0xf5cf91, new Uint8Array([1]));
      const changed = await tracker.poll();
      expect(changed.checks["pandora-castle-chest-673"]).toBe(false);
      expect(changed.checks["pandora-castle-chest-67c"]).toBe(true);
      expect(Object.values(changed.checks).filter(Boolean)).toHaveLength(1);
      expect(Object.values(changed.diagnostics).every((entry) => entry.error === null)).toBe(true);
    } finally { client.stop(); }
  });
  it("tracks Orb open-state and rollback through the mock socket, isolating failed Orb reads", async () => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    let failOrbRead = false;
    const originalRead = SniClient.prototype.readMemory;
    vi.spyOn(SniClient.prototype, "readMemory").mockImplementation(function (this: SniClient, address, size) {
      if (failOrbRead && address === 0xf5cf18 && size === 0xd7) return Promise.reject(new Error("Mock Orb memory failure"));
      return originalRead.call(this, address, size);
    });
    mockMemory.set(0xf5cf20, new Uint8Array([4]));
    const tracker = new PotosAutotracker("ws://mock-sni:23074");
    tracker.start();
    try {
      const open = await waitForTrackerSnapshot(tracker, (s) => s.gameDetected && s.ram.orbs.uf_orb === true);
      expect(open.ram.checks["potos-chest"]).toBe(true);
      expect(open.ram.inventory["weapon-spear"]).toBe(true);
      expect(open.orbs.uf_orb).toMatchObject({ address: 0x7ecf20, value: 4, error: null });
      mockMemory.set(0xf5cf20, new Uint8Array([0]));
      const rolledBack = await waitForTrackerSnapshot(tracker, (s) => s.ram.orbs.uf_orb === false);
      expect(rolledBack.gameDetected).toBe(true);
      failOrbRead = true;
      const failed = await waitForTrackerSnapshot(tracker, (s) => s.orbs.uf_orb?.error === "Mock Orb memory failure");
      expect(failed.gameDetected).toBe(true);
      expect(failed.game?.currentMap).toBe(1);
      expect(failed.ram.checks["potos-chest"]).toBe(true);
      expect(failed.ram.inventory["midge-mallet"]).toBe(true);
      expect(failed.ram.orbs.uf_orb).toBeNull();
      expect(failed.subsystemErrors.orbs).toBe("Mock Orb memory failure");
      failOrbRead = false; mockMemory.set(0xf5cf20, new Uint8Array([4]));
      const recovered = await waitForTrackerSnapshot(tracker, (s) => s.ram.orbs.uf_orb === true);
      expect(recovered.gameDetected).toBe(true);
      expect(recovered.subsystemErrors.orbs).toBeNull();
    } finally { tracker.stop(); }
  });
  it("reads Potos, Mantis Ant, Midge Mallet, and Spear through the usb2snes flow", async () => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    const client = new SniClient("ws://mock-sni:23074");

    client.start();
    const status = await waitForAttached(client);
    expect(status.devices).toEqual(["Mock SNES"]);
    expect(status.attachedDevice).toBe("Mock SNES");

    const game = await detectSecretOfMana(client);
    expect(game.detected).toBe(true);

    const potos = await readPotosChestState(client);
    expect(potos).toMatchObject({
      complete: true,
      eventNumber: 0x680,
      eventFlagOffset: 0x29,
      eventFlagValue: 1,
      eventPointerTable: EVENT_POINTER_TABLE,
      eventPointer: 0xe14934,
      strategy: {
        kind: "flag",
        flagAddress: 0x7ecf29,
        completedValue: 1,
      },
    });

    const mantisAnt = await readMantisAntState(client);
    expect(mantisAnt).toMatchObject({
      complete: true,
      eventNumber: 0x112,
      eventFlagOffset: 0x76,
      eventFlagValue: 1,
      eventPointerTable: EVENT_POINTER_TABLE,
      eventPointer: 0xe145d4,
      strategy: {
        kind: "flag",
        flagAddress: 0x7ecf76,
        completedValue: 1,
      },
    });

    expect(await readMidgeMalletState(client)).toBe(true);
    expect(await readSpearState(client)).toBe(true);

    const opcodes = MockWebSocket.instances[0].sentRequests.map(
      (request) => request.Opcode,
    );
    expect(opcodes.slice(0, 3)).toEqual(["DeviceList", "Attach", "Info"]);
    expect(opcodes).toContain("GetAddress");
    client.stop();
  });

  it("tracks a flagless Mantis event by execution pointer exactly once", async () => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    mockMemory.set(
      0x2145d4,
      new Uint8Array([
        0x25, 0x01, 0x30, 0x10, 0x0c, 0x50,
        0xa9, 0x8f, 0x90, 0x93, 0x80, 0x8e, 0x8f, 0x80, 0x89,
        0x94, 0x85, 0x8d, 0x28, 0x00, 0x51,
        0x40, 0x01, 0x14, 0x00, 0xff, 0x18, 0x8e, 0x00,
      ]),
    );

    const tracker = new PotosAutotracker("ws://mock-sni:23074");
    let mantisCompletionTransitions = 0;
    let mantisWasComplete = false;
    const unsubscribeTransitions = tracker.subscribe((snapshot) => {
      const complete = snapshot.ram.checks["mantis-ant"] === true;
      if (complete && !mantisWasComplete) {
        mantisCompletionTransitions += 1;
      }
      mantisWasComplete = complete;
    });
    tracker.start();
    try {
      const first = await waitForTrackerSnapshot(
        tracker,
        (snapshot) =>
          snapshot.gameDetected &&
          snapshot.locations["mantis-ant"]?.events[0]?.strategy?.kind === "execution-pointer",
      );
      expect(first.sni.phase).toBe("attached");
      expect(first.gameDetected).toBe(true);
      expect(first.game?.currentMap).toBe(1);
      expect(first.ram.checks["potos-chest"]).toBe(true);
      expect(first.ram.inventory["midge-mallet"]).toBe(true);
      expect(first.ram.inventory["weapon-spear"]).toBe(true);
      expect(first.ram.checks["mantis-ant"]).toBe(false);
      expect(first.locations["mantis-ant"]?.events[0]?.strategy).toEqual({
        kind: "execution-pointer",
        eventStart: 0xe145d4,
        eventEnd: 0xe145f0,
      });
      expect(first.locations["potos-chest"]?.error).toBeNull();
      expect(first.inventory["midge-mallet"]?.error).toBeNull();
      expect(first.inventory["weapon-spear"]?.error).toBeNull();
      expect(first.locations["mantis-ant"]?.error).toBeNull();

      mockMemory.set(0xf500d1, new Uint8Array([0xda, 0x45, 0xe1]));
      const completed = await waitForTrackerSnapshot(
        tracker,
        (snapshot) => snapshot.ram.checks["mantis-ant"] === true,
      );
      expect(completed.locations["mantis-ant"]?.events[0]?.currentEventPointer).toBe(0xe145da);
      expect(mantisCompletionTransitions).toBe(1);

      const completedPollAt = completed.lastPollAt;
      mockMemory.set(0xf500d1, new Uint8Array([0xe0, 0x45, 0xe1]));
      await waitForTrackerSnapshot(
        tracker,
        (snapshot) => snapshot.lastPollAt !== completedPollAt,
      );
      expect(mantisCompletionTransitions).toBe(1);

      mockMemory.set(0xf500d1, new Uint8Array([0x00, 0x00, 0x00]));
      mockMemory.set(0xf5cf5c, new Uint8Array([0x00]));
      mockMemory.set(0xf5cfcb, new Uint8Array([0x00]));
      const next = await waitForTrackerSnapshot(
        tracker,
        (snapshot) =>
          snapshot.ram.inventory["midge-mallet"] === false &&
          snapshot.ram.inventory["weapon-spear"] === false,
      );
      expect(next.gameDetected).toBe(true);
      expect(next.ram.checks["potos-chest"]).toBe(true);
      expect(next.ram.checks["mantis-ant"]).toBe(true);
      expect(next.locations["mantis-ant"]?.error).toBeNull();
      expect(mantisCompletionTransitions).toBe(1);
      const mantisScriptReads = MockWebSocket.instances[0].sentRequests.filter(
        (request) =>
          request.Opcode === "GetAddress" &&
          (request.Operands as string[] | undefined)?.[0] === "2145d4",
      );
      expect(mantisScriptReads).toHaveLength(1);

      mockMemory.set(MANTIS_POINTER_ADDRESS, new Uint8Array([0x20, 0x46, 0xe1]));
      mockMemory.set(0x214620, new Uint8Array([0x30, 0x77, 0x01, 0x00]));
      mockMemory.set(0xf5cf77, new Uint8Array([0x01]));
      const changedPointer = await waitForTrackerSnapshot(
        tracker,
        (snapshot) =>
          snapshot.locations["mantis-ant"]?.events[0]?.strategy?.kind === "flag" &&
          snapshot.locations["mantis-ant"]?.events[0]?.eventPointer === 0xe14620,
      );
      expect(changedPointer.ram.checks["mantis-ant"]).toBe(true);
      const requests = MockWebSocket.instances[0].sentRequests;
      expect(requests.filter((request) =>
        request.Opcode === "GetAddress" &&
        (request.Operands as string[] | undefined)?.[0] === "214620"
      )).toHaveLength(1);
      expect(requests.filter((request) =>
        request.Opcode === "GetAddress" &&
        (request.Operands as string[] | undefined)?.[0] === "214934"
      )).toHaveLength(1);
    } finally {
      unsubscribeTransitions();
      tracker.stop();
    }
  });

  it("isolates a malformed Mantis event and continues polling other state", async () => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    mockMemory.set(0x2145d4, new Uint8Array(0xff).fill(0x60));

    const tracker = new PotosAutotracker("ws://mock-sni:23074");
    tracker.start();
    try {
      const first = await waitForTrackerSnapshot(
        tracker,
        (snapshot) => snapshot.gameDetected && snapshot.locations["mantis-ant"]?.error !== null,
      );
      expect(first.ram.checks["potos-chest"]).toBe(true);
      expect(first.ram.inventory["midge-mallet"]).toBe(true);
      expect(first.ram.inventory["weapon-spear"]).toBe(true);
      expect(first.ram.checks["mantis-ant"]).toBeNull();
      expect(first.locations["mantis-ant"]?.error).toContain("did not terminate");

      mockMemory.set(0xf5cf5c, new Uint8Array([0x00]));
      const next = await waitForTrackerSnapshot(
        tracker,
        (snapshot) => snapshot.ram.inventory["midge-mallet"] === false,
      );
      expect(next.gameDetected).toBe(true);
      expect(next.ram.checks["potos-chest"]).toBe(true);
      expect(next.locations["mantis-ant"]?.error).not.toBeNull();
    } finally {
      tracker.stop();
    }
  });

  it("tracks Potos and Spear together and lets both RAM states roll back", async () => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    mockMemory.set(0xf5cf29, new Uint8Array([0x00]));
    mockMemory.set(0xf5cfcb, new Uint8Array([0x00]));

    const tracker = new PotosAutotracker("ws://mock-sni:23074");
    tracker.start();
    try {
      const before = await waitForTrackerSnapshot(
        tracker,
        (snapshot) =>
          snapshot.gameDetected &&
          snapshot.ram.checks["potos-chest"] === false &&
          snapshot.ram.inventory["weapon-spear"] === false,
      );
      expect(before.locations["potos-chest"]?.error).toBeNull();
      expect(before.inventory["weapon-spear"]?.error).toBeNull();

      mockMemory.set(0xf5cf29, new Uint8Array([0x01]));
      mockMemory.set(0xf5cfcb, new Uint8Array([0x01]));
      const acquired = await waitForTrackerSnapshot(
        tracker,
        (snapshot) =>
          snapshot.ram.checks["potos-chest"] === true &&
          snapshot.ram.inventory["weapon-spear"] === true,
      );
      expect(acquired.gameDetected).toBe(true);

      mockMemory.set(0xf5cf29, new Uint8Array([0x00]));
      mockMemory.set(0xf5cfcb, new Uint8Array([0x00]));
      const rolledBack = await waitForTrackerSnapshot(
        tracker,
        (snapshot) =>
          snapshot.ram.checks["potos-chest"] === false &&
          snapshot.ram.inventory["weapon-spear"] === false,
      );
      expect(rolledBack.gameDetected).toBe(true);
      expect(rolledBack.ram.checks["mantis-ant"]).toBe(true);
    } finally {
      tracker.stop();
    }
  });

  it("uses one current-event-pointer read for multiple execution-pointer checks", async () => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    const flaglessEvent = new Uint8Array([0x25, 0x01, 0x30, 0x10, 0x0c, 0x00]);
    mockMemory.set(0x2145d4, flaglessEvent);
    mockMemory.set(MANTIS_POINTER_ADDRESS + 3, new Uint8Array([0xd4, 0x45, 0xe1]));

    const client = new SniClient("ws://mock-sni:23074");
    client.start();
    await waitForAttached(client);
    const definitions = [
      { id: "first", name: "First", legacyPath: "@Test/First", completionMode: "any", events: [{ eventNumber: 0x112 }] },
      { id: "second", name: "Second", legacyPath: "@Test/Second", completionMode: "any", events: [{ eventNumber: 0x113 }] },
    ] as const satisfies readonly LocationDefinition[];
    const tracker = new LocationAutotracker(client, definitions);

    const outside = await tracker.poll();
    expect(outside.checks).toMatchObject({ first: false, second: false });
    const pointerReadsBefore = MockWebSocket.instances[0].sentRequests.filter(
      (request) =>
        request.Opcode === "GetAddress" &&
        (request.Operands as string[] | undefined)?.[0] === "f500d1",
    );
    expect(pointerReadsBefore).toHaveLength(1);

    mockMemory.set(0xf500d1, new Uint8Array([0xd6, 0x45, 0xe1]));
    const entered = await tracker.pollExecutionPointer();
    expect(entered?.checks).toMatchObject({ first: true, second: true });
    const pointerReadsAfter = MockWebSocket.instances[0].sentRequests.filter(
      (request) =>
        request.Opcode === "GetAddress" &&
        (request.Operands as string[] | undefined)?.[0] === "f500d1",
    );
    expect(pointerReadsAfter).toHaveLength(2);

    mockMemory.set(0xf500d1, new Uint8Array([0x00, 0x00, 0x00]));
    expect(await tracker.pollExecutionPointer()).toBeNull();
    expect(MockWebSocket.instances[0].sentRequests.filter(
      (request) =>
        request.Opcode === "GetAddress" &&
        (request.Operands as string[] | undefined)?.[0] === "f500d1",
    )).toHaveLength(2);
    tracker.resetSession();
    expect(tracker.getSnapshot().checks).toMatchObject({ first: null, second: null });
    client.stop();
  });

  it("aggregates multi-event locations and honors per-binding completion values", async () => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    mockMemory.set(MANTIS_POINTER_ADDRESS + 3, new Uint8Array([0x20, 0x46, 0xe1]));
    mockMemory.set(0x214620, new Uint8Array([0x30, 0x77, 0x01, 0x00]));
    mockMemory.set(0xf5cf77, new Uint8Array([0x01]));

    const client = new SniClient("ws://mock-sni:23074");
    client.start();
    await waitForAttached(client);
    const definitions = [{
      id: "multi",
      name: "Multi",
      legacyPath: "@Test/Multi",
      completionMode: "all",
      events: [
        { eventNumber: 0x112 },
        { eventNumber: 0x113, completedValue: 2 },
      ],
    }] as const satisfies readonly LocationDefinition[];
    const tracker = new LocationAutotracker(client, definitions);

    expect((await tracker.poll()).checks.multi).toBe(false);
    mockMemory.set(0xf5cf77, new Uint8Array([0x02]));
    expect((await tracker.poll()).checks.multi).toBe(true);
    client.stop();
  });
});
