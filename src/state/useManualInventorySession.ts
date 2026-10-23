import { useCallback, useEffect, useRef, useState } from "react";
import type { InventoryId } from "../data/inventoryDefinitions";
import { INVENTORY_SESSION_CHANNEL, ManualInventorySession } from "./manualInventorySession";

export function useManualInventorySession() {
  const [items, setItems] = useState<ReadonlySet<InventoryId>>(() => new Set());
  const session = useRef<ManualInventorySession | null>(null);
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try { if (typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel(INVENTORY_SESSION_CHANNEL); } catch { /* Isolated/older browsers keep local-only marks. */ }
    const active = new ManualInventorySession(channel);
    session.current = active;
    const unsubscribe = active.subscribe(setItems); active.start();
    return () => { unsubscribe(); active.close(); session.current = null; };
  }, []);
  const toggle = useCallback((id: InventoryId) => session.current?.toggle(id), []);
  const clear = useCallback(() => session.current?.clear(), []);
  return [items, toggle, clear] as const;
}
