import "dotenv/config";
import { MINUTE_MS } from "../shared/constants";

export const PORT = Number(process.env.PORT ?? 8787);
export const SYNC_INTERVAL_MS = Number(process.env.SYNC_INTERVAL_MS ?? 5 * MINUTE_MS);
