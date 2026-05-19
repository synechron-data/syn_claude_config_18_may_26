const { validatePhoneNumber } = require('../src/utils/validators');

describe('validatePhoneNumber', () => {
  test.each([
    ['+14155552671', true],
    ['+442071838750', true],
    ['14155552671', true],
    ['+1 (415) 555-2671', true],
    ['415-555-2671', true],
  ])('accepts valid phone %s', (input, expected) => {
    expect(validatePhoneNumber(input)).toBe(expected);
  });

  test.each([
    ['123', false],
    ['', false],
    [null, false],
    [undefined, false],
    ['abcdefghij', false],
    ['+0123456789', false],
  ])('rejects invalid phone %s', (input, expected) => {
    expect(validatePhoneNumber(input)).toBe(expected);
  });
});
