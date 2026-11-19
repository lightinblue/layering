/** Mirrors NSUbiquitousKeyValueStore change-reason constants. */
export const KVS_CHANGE_REASON = {
  serverChange: 0,
  initialSync: 1,
  quotaViolation: 2,
  accountChange: 3,
} as const;

export type ExternalChangePayload = {
  reason: number;
  keys: string[];
};

export type ICloudKvsModuleEvents = {
  onExternalChange: (params: ExternalChangePayload) => void;
};
