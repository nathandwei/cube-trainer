// A Web Bluetooth device in memory: just enough GATT (services, characteristics, notifications, writes, disconnect)
// for the vendored driver to run unchanged. Test-only; the app never imports this folder.

type WriteHandler = (data: Uint8Array) => void;

const PROPERTIES: BluetoothCharacteristicProperties = {
  broadcast: false,
  read: false,
  writeWithoutResponse: false,
  write: true,
  notify: true,
  indicate: false,
  authenticatedSignedWrites: false,
  reliableWrite: false,
  writableAuxiliaries: false,
};

function toBytes(value: BufferSource): Uint8Array {
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
}

export class FakeCharacteristic extends EventTarget {
  readonly properties = PROPERTIES;
  value: DataView | undefined;
  #notifying = false;
  #onWrite: WriteHandler | null = null;

  constructor(
    readonly uuid: string,
    readonly service: FakeService,
  ) {
    super();
  }

  get notifying(): boolean {
    return this.#notifying;
  }

  onWrite(handler: WriteHandler): void {
    this.#onWrite = handler;
  }

  async startNotifications(): Promise<this> {
    this.#notifying = true;
    return this;
  }

  async stopNotifications(): Promise<this> {
    this.#notifying = false;
    return this;
  }

  async writeValueWithResponse(value: BufferSource): Promise<void> {
    if (!this.service.device.gatt.connected) throw new DOMException("GATT Server is disconnected.", "NetworkError");
    this.#onWrite?.(toBytes(value));
  }

  async writeValueWithoutResponse(value: BufferSource): Promise<void> {
    await this.writeValueWithResponse(value);
  }

  async readValue(): Promise<DataView> {
    throw new DOMException("Not readable", "NotSupportedError");
  }

  /** The device sends a notification (dropped unless notifications are on, like a real stack). */
  notify(bytes: Uint8Array): void {
    if (!this.#notifying || !this.service.device.gatt.connected) return;
    this.value = new DataView(bytes.slice().buffer);
    this.dispatchEvent(new Event("characteristicvaluechanged"));
  }
}

export class FakeService {
  readonly isPrimary = true;
  readonly #characteristics = new Map<string, FakeCharacteristic>();

  constructor(
    readonly uuid: string,
    readonly device: FakeBluetoothDevice,
  ) {}

  add(uuid: string): FakeCharacteristic {
    const characteristic = new FakeCharacteristic(uuid.toLowerCase(), this);
    this.#characteristics.set(uuid.toLowerCase(), characteristic);
    return characteristic;
  }

  async getCharacteristic(uuid: string): Promise<FakeCharacteristic> {
    const found = this.#characteristics.get(String(uuid).toLowerCase());
    if (!found) throw new DOMException(`No characteristic ${uuid}`, "NotFoundError");
    return found;
  }

  async getCharacteristics(): Promise<FakeCharacteristic[]> {
    return [...this.#characteristics.values()];
  }
}

export class FakeGattServer {
  connected = false;
  readonly #services = new Map<string, FakeService>();
  /** Set to make the next connect() calls fail, like a cube that is off or out of range. */
  refuseConnections = false;

  constructor(readonly device: FakeBluetoothDevice) {}

  addService(uuid: string): FakeService {
    const service = new FakeService(uuid.toLowerCase(), this.device);
    this.#services.set(uuid.toLowerCase(), service);
    return service;
  }

  async connect(): Promise<this> {
    if (this.refuseConnections) throw new DOMException("Connection failed for unknown reason.", "NetworkError");
    this.connected = true;
    return this;
  }

  disconnect(): void {
    if (!this.connected) return;
    this.connected = false;
    queueMicrotask(() => this.device.dispatchEvent(new Event("gattserverdisconnected")));
  }

  async getPrimaryService(uuid: string): Promise<FakeService> {
    if (!this.connected) throw new DOMException("GATT Server is disconnected.", "NetworkError");
    const found = this.#services.get(String(uuid).toLowerCase());
    if (!found) throw new DOMException(`No service ${uuid}`, "NotFoundError");
    return found;
  }

  async getPrimaryServices(): Promise<FakeService[]> {
    if (!this.connected) throw new DOMException("GATT Server is disconnected.", "NetworkError");
    return [...this.#services.values()];
  }
}

export class FakeBluetoothDevice extends EventTarget {
  readonly gatt: FakeGattServer;
  /** Present only when the fake should behave like Chrome with the new-permissions flag (MAC readable). */
  watchAdvertisements?: (options?: WatchAdvertisementsOptions) => Promise<void>;

  constructor(
    readonly id: string,
    readonly name: string,
  ) {
    super();
    this.gatt = new FakeGattServer(this);
  }

  /** The browser's view of this object. */
  asBluetoothDevice(): BluetoothDevice {
    return this as unknown as BluetoothDevice;
  }
}
