import { hitSlopFor } from '../hitSlop';

describe('hitSlopFor', () => {
  it('extends small controls to 44 × 44 and leaves large ones alone', () => {
    expect(hitSlopFor(36, 36)).toEqual({ top: 4, bottom: 4, left: 4, right: 4 });
    expect(hitSlopFor(undefined, 31)).toEqual({ top: 7, bottom: 7, left: 0, right: 0 }); // rounds up
    expect(hitSlopFor(54, 54)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });
});
