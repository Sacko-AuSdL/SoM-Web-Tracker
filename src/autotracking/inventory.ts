import {
  decodePresent,
  INVENTORY_BY_ID,
  WEAPON_OWNERSHIP_BASE_ADDRESS,
} from "../data/inventoryDefinitions";
import { usb2snesAddressForSnesBus } from "./addressing";
import type { SniClient } from "./SniClient";

export const MIDGE_MALLET_ADDRESS = INVENTORY_BY_ID.get("midge-mallet")!.address;
export { WEAPON_OWNERSHIP_BASE_ADDRESS };
export const SPEAR_WEAPON_INDEX = 0x03;
export const SPEAR_OWNERSHIP_ADDRESS = INVENTORY_BY_ID.get("weapon-spear")!.address;

export const decodeInventoryFlag = decodePresent;

export function readMidgeMalletState(client: SniClient): Promise<boolean> {
  return readBooleanInventory(client, MIDGE_MALLET_ADDRESS);
}

export function readSpearState(client: SniClient): Promise<boolean> {
  return readBooleanInventory(client, SPEAR_OWNERSHIP_ADDRESS);
}

async function readBooleanInventory(client: SniClient, address: number): Promise<boolean> {
  const bytes = await client.readMemory(usb2snesAddressForSnesBus(address), 1);
  return decodePresent(bytes[0]);
}
