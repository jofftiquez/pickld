import { emptyPeople, toggleAnswer } from '../peopleModel';

describe('Your people answers', () => {
  it('lists toggle and stay in option order; ootd is one answer that a second tap clears', () => {
    let a = toggleAnswer(emptyPeople, 'whoamiwith', 'pets');
    a = toggleAnswer(a, 'whoamiwith', 'barkada');
    a = toggleAnswer(a, 'mebusywith', 'work');
    a = toggleAnswer(a, 'ootd', 'uniform');
    a = toggleAnswer(a, 'ootd', 'pambahay');
    expect(a).toEqual({ whoamiwith: ['barkada', 'pets'], mebusywith: ['work'], ootd: 'pambahay' });
    a = toggleAnswer(toggleAnswer(a, 'whoamiwith', 'pets'), 'ootd', 'pambahay');
    expect(a).toEqual({ whoamiwith: ['barkada'], mebusywith: ['work'], ootd: null });
  });
});
