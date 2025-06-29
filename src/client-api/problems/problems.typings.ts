export interface ProblemStatus {
  problemSlug: string;
  isLocked: boolean;
  isPublic: boolean;
  solved: boolean;
  attempted: boolean;
}

export type ProblemStatusCode =
  | 'SP'
  | 'AP'
  | 'UP'
  | 'SH'
  | 'AH'
  | 'UH'
  | 'SPL'
  | 'APL'
  | 'UPL'
  | 'SHL'
  | 'AHL'
  | 'UHL';
