export type SniPhase =
  | "disconnected"
  | "connecting"
  | "discovering"
  | "attaching"
  | "attached";

export interface SniStatus {
  phase: SniPhase;
  endpoint: string;
  devices: string[];
  attachedDevice: string | null;
  serverInfo: string[];
  error: string | null;
}

type SniStatusListener = (status: SniStatus) => void;
type IncomingMessage =
  | { kind: "text"; data: string }
  | { kind: "binary"; data: Uint8Array };

interface MessageWaiter {
  resolve: (message: IncomingMessage) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface Usb2SnesRequest {
  Opcode: string;
  Space?: "SNES" | "CMD";
  Operands?: string[];
}

interface Usb2SnesReply {
  Results?: string[];
}

const DEFAULT_ENDPOINT = "ws://localhost:23074";
const RECONNECT_DELAY_MS = 2_000;
const REQUEST_TIMEOUT_MS = 5_000;

export class SniClient {
  private socket: WebSocket | null = null;
  private status: SniStatus;
  private readonly listeners = new Set<SniStatusListener>();
  private readonly messageQueue: IncomingMessage[] = [];
  private readonly messageWaiters: MessageWaiter[] = [];
  private operationTail: Promise<void> = Promise.resolve();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private preferredDevice: string | null = null;

  constructor(endpoint = DEFAULT_ENDPOINT) {
    this.status = {
      phase: "disconnected",
      endpoint,
      devices: [],
      attachedDevice: null,
      serverInfo: [],
      error: null,
    };
  }

  getStatus(): SniStatus {
    return { ...this.status, devices: [...this.status.devices], serverInfo: [...this.status.serverInfo] };
  }

  subscribe(listener: SniStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  start(): void {
    if (!this.stopped) {
      return;
    }
    this.stopped = false;
    void this.openAndAttach();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.rejectMessageWaiters(new Error("SNI client stopped"));
    this.socket?.close();
    this.socket = null;
    this.setStatus({
      phase: "disconnected",
      attachedDevice: null,
      error: null,
    });
  }

  async selectDevice(device: string): Promise<void> {
    this.preferredDevice = device;
    await this.enqueue(async () => {
      this.ensureOpen();
      await this.attachToDevice(device);
    });
  }

  readMemory(address: number, size: number): Promise<Uint8Array> {
    if (!Number.isInteger(address) || address < 0 || address > 0xffffff) {
      return Promise.reject(new Error(`Invalid usb2snes address: ${address}`));
    }
    if (!Number.isInteger(size) || size <= 0) {
      return Promise.reject(new Error(`Invalid read size: ${size}`));
    }

    return this.enqueue(async () => {
      this.ensureAttached();
      this.send({
        Opcode: "GetAddress",
        Space: "SNES",
        Operands: [address.toString(16), size.toString(16)],
      });

      const result = new Uint8Array(size);
      let received = 0;
      while (received < size) {
        const message = await this.nextMessage();
        if (message.kind !== "binary") {
          throw new Error("Expected binary memory data from SNI");
        }
        if (received + message.data.length > size) {
          throw new Error("SNI returned more memory data than requested");
        }
        result.set(message.data, received);
        received += message.data.length;
      }
      return result;
    });
  }

  private async openAndAttach(): Promise<void> {
    if (this.stopped || this.status.phase !== "disconnected") {
      return;
    }

    this.setStatus({ phase: "connecting", error: null, attachedDevice: null });
    try {
      const socket = new WebSocket(this.status.endpoint);
      socket.binaryType = "arraybuffer";
      this.socket = socket;
      this.installSocketHandlers(socket);
      await this.waitForOpen(socket);

      await this.enqueue(async () => {
        this.setStatus({ phase: "discovering" });
        const reply = await this.requestJson({ Opcode: "DeviceList", Space: "SNES" });
        const devices = reply.Results ?? [];
        this.setStatus({ devices });
        if (devices.length === 0) {
          throw new Error("SNI is running, but no SNES device was found");
        }

        const selected =
          (this.preferredDevice && devices.includes(this.preferredDevice)
            ? this.preferredDevice
            : devices[0]) ?? null;
        if (!selected) {
          throw new Error("No SNI device is available to attach");
        }
        await this.attachToDevice(selected);
      });
    } catch (error) {
      this.handleConnectionFailure(error);
    }
  }

  private async attachToDevice(device: string): Promise<void> {
    this.setStatus({ phase: "attaching", attachedDevice: null, error: null });
    this.send({ Opcode: "Attach", Space: "SNES", Operands: [device] });
    const info = await this.requestJson({ Opcode: "Info", Space: "SNES" });
    this.preferredDevice = device;
    this.setStatus({
      phase: "attached",
      attachedDevice: device,
      serverInfo: info.Results ?? [],
      error: null,
    });
  }

  private installSocketHandlers(socket: WebSocket): void {
    socket.addEventListener("message", (event) => {
      if (typeof event.data === "string") {
        this.deliverMessage({ kind: "text", data: event.data });
        return;
      }
      if (event.data instanceof ArrayBuffer) {
        this.deliverMessage({ kind: "binary", data: new Uint8Array(event.data) });
        return;
      }
      if (event.data instanceof Blob) {
        void event.data.arrayBuffer().then((data) => {
          this.deliverMessage({ kind: "binary", data: new Uint8Array(data) });
        });
      }
    });

    socket.addEventListener("close", () => {
      if (this.socket !== socket) {
        return;
      }
      this.socket = null;
      this.rejectMessageWaiters(new Error("SNI WebSocket disconnected"));
      this.messageQueue.length = 0;
      this.setStatus({ phase: "disconnected", attachedDevice: null });
      this.scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      this.setStatus({ error: "SNI WebSocket error" });
    });
  }

  private waitForOpen(socket: WebSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out connecting to SNI")), REQUEST_TIMEOUT_MS);
      socket.addEventListener(
        "open",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
      socket.addEventListener(
        "close",
        () => {
          clearTimeout(timer);
          reject(new Error("SNI WebSocket closed while connecting"));
        },
        { once: true },
      );
    });
  }

  private async requestJson(request: Usb2SnesRequest): Promise<Usb2SnesReply> {
    this.send(request);
    const message = await this.nextMessage();
    if (message.kind !== "text") {
      throw new Error(`Expected a JSON response for ${request.Opcode}`);
    }
    try {
      return JSON.parse(message.data) as Usb2SnesReply;
    } catch {
      throw new Error(`SNI returned invalid JSON for ${request.Opcode}`);
    }
  }

  private send(request: Usb2SnesRequest): void {
    this.ensureOpen();
    this.socket!.send(JSON.stringify(request));
  }

  private nextMessage(): Promise<IncomingMessage> {
    const queued = this.messageQueue.shift();
    if (queued) {
      return Promise.resolve(queued);
    }

    return new Promise((resolve, reject) => {
      const waiter: MessageWaiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const index = this.messageWaiters.indexOf(waiter);
          if (index >= 0) {
            this.messageWaiters.splice(index, 1);
          }
          reject(new Error("Timed out waiting for an SNI response"));
        }, REQUEST_TIMEOUT_MS),
      };
      this.messageWaiters.push(waiter);
    });
  }

  private deliverMessage(message: IncomingMessage): void {
    const waiter = this.messageWaiters.shift();
    if (!waiter) {
      this.messageQueue.push(message);
      return;
    }
    clearTimeout(waiter.timer);
    waiter.resolve(message);
  }

  private rejectMessageWaiters(error: Error): void {
    for (const waiter of this.messageWaiters.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationTail.then(operation);
    this.operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private ensureOpen(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("SNI WebSocket is not connected");
    }
  }

  private ensureAttached(): void {
    this.ensureOpen();
    if (this.status.phase !== "attached") {
      throw new Error("No SNI device is attached");
    }
  }

  private handleConnectionFailure(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.setStatus({ phase: "disconnected", attachedDevice: null, error: message });
    this.socket?.close();
    this.socket = null;
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer !== null) {
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.openAndAttach();
    }, RECONNECT_DELAY_MS);
  }

  private setStatus(patch: Partial<SniStatus>): void {
    this.status = { ...this.status, ...patch };
    const snapshot = this.getStatus();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
