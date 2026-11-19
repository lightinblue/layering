import { NativeModule, registerWebModule } from 'expo';

import type { ICloudKvsModuleEvents } from './ICloudKvs.types';

class ICloudKvsModule extends NativeModule<ICloudKvsModuleEvents> {
  isICloudAvailable(): boolean {
    return false;
  }

  async get(_key: string): Promise<string | null> {
    return null;
  }

  async set(_key: string, _value: string): Promise<boolean> {
    return false;
  }

  async remove(_key: string): Promise<boolean> {
    return false;
  }

  async getAllKeys(): Promise<string[]> {
    return [];
  }

  async synchronize(): Promise<boolean> {
    return false;
  }
}

export default registerWebModule(ICloudKvsModule, 'ICloudKvs');
