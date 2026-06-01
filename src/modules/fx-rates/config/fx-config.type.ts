export type FxSourceCode = 'DOLARAPI' | 'YADIO' | 'EXCHANGEDYN' | 'MANUAL';

export type FxConfig = {
  cronSchedule: string;
  cronTimezone: string;
  primarySource: FxSourceCode;
  fallbackSources: FxSourceCode[];
  dolarApiUrl: string;
  yadioUrl: string;
  exchangedynUrl: string;
  staleHoursAlert: number;
};
