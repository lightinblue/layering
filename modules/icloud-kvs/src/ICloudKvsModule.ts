import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { ICloudKvsModuleEvents } from './ICloudKvs.types';

declare class ICloudKvsNativeModule extends NativeModule<ICloudKvsModuleEvents> {
  isICloudAvailable(): boolean;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<boolean>;
  remove(key: string): Promise<boolean>;
  getAllKeys(): Promise<string[]>;
  synchronize(): Promise<boolean>;
}

const native = requireOptionalNativeModule<ICloudKvsNativeModule>('ICloudKvs');

/** Silent stub when native module missing (Expo Go / pre-rebuild). */
const stub: ICloudKvsNativeModule = {
  isICloudAvailable: () => false,
  get: async () => null,
  set: async () => false,
  remove: async () => false,
  getAllKeys: async () => [],
  synchronize: async () => false,
  addListener: () => ({ remove: () => {} }),
  removeListener: () => {},
  removeAllListeners: () => {},
  emit: () => {},
  listenerCount: () => 0,
} as unknown as ICloudKvsNativeModule;

export default native ?? stub;
