export interface IProblemStatus {
  problemSlug: string;
  isLocked: boolean;
  isPublic: boolean;
  solved: boolean;
  attempted: boolean;
}

// export type TProblemStatusCode =
//   | 'SP'
//   | 'AP'
//   | 'UP'
//   | 'SH'
//   | 'AH'
//   | 'UH'
//   | 'SPL'
//   | 'APL'
//   | 'UPL'
//   | 'SHL'
//   | 'AHL'
//   | 'UHL';
