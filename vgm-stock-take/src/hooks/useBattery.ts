import { useState, useEffect } from 'react';

interface BatteryState {
  level: number;
  charging: boolean;
  supported: boolean;
}

export function useBattery(): BatteryState {
  const [battery, setBattery] = useState<BatteryState>({
    level: 1,
    charging: false,
    supported: true
  });

  useEffect(() => {
    let batteryManager: any = null;

    const updateBattery = () => {
      if (batteryManager) {
        setBattery({
          level: batteryManager.level,
          charging: batteryManager.charging,
          supported: true
        });
      }
    };

    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((manager: any) => {
        batteryManager = manager;
        updateBattery();

        manager.addEventListener('levelchange', updateBattery);
        manager.addEventListener('chargingchange', updateBattery);
      }).catch(() => {
        setBattery(prev => ({ ...prev, supported: false }));
      });
    } else {
      setBattery(prev => ({ ...prev, supported: false }));
    }

    return () => {
      if (batteryManager) {
        batteryManager.removeEventListener('levelchange', updateBattery);
        batteryManager.removeEventListener('chargingchange', updateBattery);
      }
    };
  }, []);

  return battery;
}
