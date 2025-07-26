export const styles = {
  // === Structural Headers ===
  sectionHeader: "text-2xl font-semibold text-gray-100", // Added margin-bottom for spacing
  subSectionHeader: "text-xl font-medium text-gray-300", // Made larger (xl) and distinct from content

  // === Milestone Styles ===
  milestoneEvent: "text-base font-semibold text-gray-200", // Brightest text for the title
  milestoneDate: "text-sm text-gray-400 dark:text-dark-label-2", // Secondary info
  milestoneProblem: "text-sm text-gray-500 hover:underline", // Can be a problem name or a mono ID

  // === Trophy Card Styles (to be used with new design below) ===
  trophyName: "text-base font-semibold text-gray-200", // Unchanged, as requested.
trophyProblem: "text-sm text-sky-400 hover:underline", // The problem link remains a prominent secondary element.
trophyDescription: "text-[13px] text-gray-400", // **Crucial Change**: Made smaller (xs) and a standard gray.
trophyPersonalNote: "text-xs italic text-gray-500 dark:text-dark-label-2", // Muted, tertiary text

  // === Records Section Styles (to be used with new design below) ===
  recordLabel: "text-base font-medium text-gray-300",
  recordValue: "text-base font-semibold text-gray-100", // For the main number/stat
  recordContext: "text-sm text-gray-400 dark:text-dark-label-2", // For the date/context text

  // === Skill Matrix ===
  skillMatrixColumnHeader: "text-xs font-semibold uppercase tracking-wider text-gray-400",
  skillMatrixRowLabel: "text-base font-medium text-gray-300",
  skillMatrixCellValue: "text-base text-gray-200",
};