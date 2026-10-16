// Vendored from poliva/smartcube-web-bluetooth src/smartcube/index.ts (see README.md in this folder).
// Change: only the GAN protocol (gen2-4) is vendored and registered.

// Register all protocols (side-effect imports)
import './protocols/gan';

// Re-export types and connect function
export type {
    SmartCubeEvent,
    SmartCubeEventMessage,
    SmartCubeMoveEvent,
    SmartCubeFaceletsEvent,
    SmartCubeGyroEvent,
    SmartCubeBatteryEvent,
    SmartCubeProtocolInfo,
    SmartCubeHardwareEvent,
    SmartCubeDisconnectEvent,
    SmartCubeCommand,
    SmartCubeCapabilities,
    SmartCubeConnection,
    MacAddressProvider
} from './types';

export { connectSmartCube } from './connect';
export { buildRequestDeviceOptions } from './attachment/build-picker-options';
export { getCachedMacForDevice, removeCachedMacForDevice } from './attachment/address-hints';

export type {
    SmartCubeProtocol,
    SmartCubeNameFilter,
    AttachmentContext,
    ConnectSmartCubeOptions,
    DeviceSelectionMode
} from './protocol';
export { registerProtocol, getRegisteredProtocols } from './protocol';
