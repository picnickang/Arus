/**
 * Deck Log Storage Adapter - Backward Compatible Shim
 * Delegates to modular files in ./deck-log/
 */

export type { DeckLogFilters, DeckLogEventFilters, SignData, LockData, DeckLogComplete } from "./deck-log/index.js";
export { DbDeckLogStorage, DbDeckLogStorage as DatabaseDeckLogStorage } from "./deck-log/index.js";
