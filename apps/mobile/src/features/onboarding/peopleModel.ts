// Your people (FR-ONB-03): private answers that later suggest stickers. Stored as stable keys in
// onboarding_answers; whoamiwith and mebusywith are lists, ootd is one answer (a text column).
export const PEOPLE_OPTIONS = {
  whoamiwith: ['barkada', 'family', 'partner', 'pets', 'coworkers', 'classmates', 'mostly_me'],
  mebusywith: ['work', 'school', 'side_hustle', 'family_duties', 'figuring_it_out'],
  ootd: ['pambahay', 'office_fit', 'uniform', 'gym_clothes', 'depends'],
} as const;

export type PeopleAnswers = { whoamiwith: string[]; mebusywith: string[]; ootd: string | null };
export const emptyPeople: PeopleAnswers = { whoamiwith: [], mebusywith: [], ootd: null };

/** Tapping a chip: lists toggle the answer (kept in option order); ootd picks it, or clears it if picked. */
export function toggleAnswer(answers: PeopleAnswers, group: keyof typeof PEOPLE_OPTIONS, key: string): PeopleAnswers {
  if (group === 'ootd') return { ...answers, ootd: answers.ootd === key ? null : key };
  const current = answers[group];
  const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
  const order = PEOPLE_OPTIONS[group] as readonly string[];
  return { ...answers, [group]: next.sort((a, b) => order.indexOf(a) - order.indexOf(b)) };
}

export const isSelected = (answers: PeopleAnswers, group: keyof typeof PEOPLE_OPTIONS, key: string) =>
  group === 'ootd' ? answers.ootd === key : answers[group].includes(key);
