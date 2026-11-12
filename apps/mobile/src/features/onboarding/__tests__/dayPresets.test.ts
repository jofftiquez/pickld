import { DAY_PRESETS, timeOptions, toLocalTime } from '../dayPresets';

describe('Your day presets (FR-ONB-02)', () => {
  it('match the requirement exactly', () => {
    const shown = Object.fromEntries(
      Object.entries(DAY_PRESETS).map(([k, t]) => [k, [t.morning, t.afternoon, t.evening].map(toLocalTime)]),
    );
    expect(shown).toEqual({
      early_bird: ['07:00', '12:30', '19:00'],
      coffee_first: ['08:30', '13:00', '20:00'],
      night_owl: ['10:00', '15:00', '21:30'],
    });
  });

  it('every preset is one of the choices Change offers, inside its slot', () => {
    for (const t of Object.values(DAY_PRESETS)) {
      expect(timeOptions('morning')).toContain(t.morning);
      expect(timeOptions('afternoon')).toContain(t.afternoon);
      expect(timeOptions('evening')).toContain(t.evening);
    }
    expect(timeOptions('morning').map(toLocalTime).slice(0, 2)).toEqual(['05:00', '05:15']);
    expect(toLocalTime(timeOptions('evening').at(-1)!)).toBe('23:45');
  });
});
