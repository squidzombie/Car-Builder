import { test, expect } from '@jest/globals'
import {
  hexToHsva,
  hsvToRgb,
  hsvaToHex,
  isValidHexInput,
  normalizeHexInput,
  parseColor,
  rgbToHsv,
  rgbaToHex,
} from '../color'

test('hex → hsva → hex round-trips', () => {
  for (const hex of [
    '#ff0000',
    '#00ff00',
    '#0000ff',
    '#123456',
    '#808080',
    '#000000',
    '#ffffff',
    '#ff8800cc',
  ]) {
    expect(hsvaToHex(hexToHsva(hex))).toBe(hex)
  }
})

test('primary hues land where expected', () => {
  expect(hexToHsva('#ff0000')).toMatchObject({ h: 0, s: 1, v: 1, a: 1 })
  expect(hexToHsva('#00ff00').h).toBeCloseTo(120)
  expect(hexToHsva('#0000ff').h).toBeCloseTo(240)
  expect(rgbToHsv(0.5, 0.5, 0.5)).toMatchObject({ h: 0, s: 0 })
  expect(hsvToRgb(0, 0, 1)).toEqual([1, 1, 1])
})

test('rgbaToHex appends alpha only when < 1', () => {
  expect(rgbaToHex(1, 0, 0)).toBe('#ff0000')
  expect(rgbaToHex(1, 0, 0, 0.5)).toBe('#ff000080')
  expect(rgbaToHex(0, 0, 0, 0)).toBe('#00000000')
  expect(rgbaToHex(2, -1, 0.5)).toBe('#ff0080') // clamps
})

test('hex input validation and normalization', () => {
  expect(isValidHexInput('fff')).toBe(true)
  expect(isValidHexInput('#aBc')).toBe(true)
  expect(isValidHexInput('123456')).toBe(true)
  expect(isValidHexInput('#12345678')).toBe(true)
  expect(isValidHexInput('#12345')).toBe(false)
  expect(isValidHexInput('ggg')).toBe(false)
  expect(normalizeHexInput('ABC')).toBe('#aabbcc')
  expect(normalizeHexInput('#FF8800CC')).toBe('#ff8800cc')
})

test('parseColor falls back to magenta on junk', () => {
  expect(parseColor('not-a-color')).toEqual([1, 0, 1, 1])
})
