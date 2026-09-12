import { generateUUID } from './uuid';

const DEVICE_ID_KEY = 'monefy_device_id';

export function getOrCreateDeviceId(): string {
  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = `dev_${generateUUID().substring(0, 18)}`;
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return `dev_${generateUUID().substring(0, 18)}`;
  }
}
