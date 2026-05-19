const { validatePhoneNumber, validatePasswordStrength } = require('../src/utils/validators');

describe('validatePasswordStrength', () => {
  test.each([
    ['Abcdefg1@3'],
    ['ValidP@ss1word'],
    ['A1b2c3d4e!'],
    ['Str0ng&Pass'],
    ['Exactly10!A'],
  ])('accepts valid password %s', (password) => {
    expect(validatePasswordStrength(password)).toBe(true);
  });

  test.each([
    ['short1A!',         'too short (8 chars)'],
    ['alllowercase1!',   'no uppercase'],
    ['ALLUPPERCASE1!',   'no lowercase'],
    ['NoDigitsHere!',    'no digit'],
    ['NoSpecial1Abc',    'no special character'],
    ['Exact1A!x',        'exactly 9 chars'],
    ['',                 'empty string'],
    [null,               'null'],
    [undefined,          'undefined'],
    [12345678910,        'number type'],
  ])('rejects %s (%s)', (password) => {
    expect(validatePasswordStrength(password)).toBe(false);
  });

  test('boundary: exactly 10 chars with all requirements', () => {
    expect(validatePasswordStrength('Abcde1234!')).toBe(true);
  });

  test('boundary: 9 chars meeting all requirements except length', () => {
    expect(validatePasswordStrength('Abcd123!X')).toBe(false);
  });

  test('rejects password with only special characters and digits', () => {
    expect(validatePasswordStrength('!@#$%^&*12')).toBe(false);
  });

  test('accepts password with multiple special characters', () => {
    expect(validatePasswordStrength('A1!b@c#d$ef')).toBe(true);
  });
});

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
