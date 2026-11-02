export enum DedupeVerdict {
 Process = 'process',
 Drop = 'drop',
}

export const leaveVerdict = (removed: unknown, remaining: unknown): DedupeVerdict =>
 String(removed) === '1' && String(remaining) === '0' ? DedupeVerdict.Process : DedupeVerdict.Drop;
