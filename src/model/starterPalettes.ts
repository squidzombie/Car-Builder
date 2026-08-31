import type { Color } from './types'

// Starter palettes (CLAUDE.md §6): ~30 team-color sets plus themed sets.
// Loading one APPENDS to the card's pinned swatches — never replaces.
// Team sets are named by city + color identity, not trademarked team names.

export type StarterPalette = { id: string; name: string; colors: Color[] }

export const STARTER_PALETTES: StarterPalette[] = [
  // team-color sets
  { id: 'la-gold', name: 'LA Purple & Gold', colors: ['#552583', '#fdb927', '#ffffff'] },
  { id: 'boston-green', name: 'Boston Green', colors: ['#007a33', '#ba9653', '#ffffff'] },
  { id: 'chicago-red', name: 'Chicago Red & Black', colors: ['#ce1141', '#000000', '#ffffff'] },
  { id: 'bay-blue-gold', name: 'Bay Blue & Gold', colors: ['#1d428a', '#ffc72c', '#ffffff'] },
  { id: 'miami-heat', name: 'Miami Red & Orange', colors: ['#98002e', '#f9a01b', '#000000'] },
  { id: 'dallas-royal', name: 'Dallas Royal', colors: ['#00538c', '#002b5e', '#b8c4ca'] },
  { id: 'milwaukee-cream', name: 'Milwaukee Cream & Green', colors: ['#00471b', '#eee1c6', '#0077c0'] },
  { id: 'phoenix-valley', name: 'Phoenix Purple & Orange', colors: ['#1d1160', '#e56020', '#63727a'] },
  { id: 'denver-navy', name: 'Denver Navy & Gold', colors: ['#0e2240', '#fec524', '#8b2131'] },
  { id: 'ny-blue-orange', name: 'NY Blue & Orange', colors: ['#006bb6', '#f58426', '#ffffff'] },
  { id: 'philly-tricolor', name: 'Philly Red & Blue', colors: ['#006bb6', '#ed174c', '#ffffff'] },
  { id: 'toronto-north', name: 'Toronto Red & Black', colors: ['#ce1141', '#000000', '#a1a1a4'] },
  { id: 'atlanta-volt', name: 'Atlanta Red & Volt', colors: ['#e03a3e', '#c1d32f', '#26282a'] },
  { id: 'brooklyn-mono', name: 'Brooklyn Black & White', colors: ['#000000', '#ffffff', '#707271'] },
  { id: 'houston-red', name: 'Houston Red & Silver', colors: ['#ce1141', '#c4ced4', '#000000'] },
  { id: 'portland-rip', name: 'Portland Red & Black', colors: ['#e03a3e', '#000000', '#ffffff'] },
  { id: 'utah-mountain', name: 'Utah Purple Mountain', colors: ['#3e2680', '#6caedf', '#f9a01b'] },
  { id: 'sacramento-purple', name: 'Sacramento Purple', colors: ['#5a2d81', '#63727a', '#000000'] },
  { id: 'san-antonio-silver', name: 'San Antonio Silver & Black', colors: ['#c4ced4', '#000000', '#ffffff'] },
  { id: 'minnesota-north', name: 'Minnesota Blue & Green', colors: ['#0c2340', '#236192', '#78be20'] },
  { id: 'okc-thunder', name: 'OKC Blue & Sunset', colors: ['#007ac1', '#ef3b24', '#002d62'] },
  { id: 'memphis-grit', name: 'Memphis Grizzly Blue', colors: ['#5d76a9', '#12173f', '#f5b112'] },
  { id: 'charlotte-buzz', name: 'Charlotte Teal & Purple', colors: ['#1d1160', '#00788c', '#a1a1a4'] },
  { id: 'detroit-motor', name: 'Detroit Red & Blue', colors: ['#c8102e', '#002d62', '#ffffff'] },
  { id: 'indiana-gold', name: 'Indiana Blue & Gold', colors: ['#002d62', '#fdbb30', '#bec0c2'] },
  { id: 'orlando-magic-blue', name: 'Orlando Blue & Silver', colors: ['#0077c0', '#c4ced4', '#000000'] },
  { id: 'cleveland-wine', name: 'Cleveland Wine & Gold', colors: ['#860038', '#fdbb30', '#041e42'] },
  { id: 'nola-fleur', name: 'New Orleans Navy & Gold', colors: ['#0c2340', '#c8102e', '#85714d'] },
  { id: 'dc-tricolor', name: 'DC Navy & Red', colors: ['#002b5c', '#e31837', '#c4ced4'] },
  { id: 'green-bay', name: 'Green Bay Green & Gold', colors: ['#203731', '#ffb612', '#ffffff'] },
  // themed sets
  { id: 'neon', name: 'Neon', colors: ['#39ff14', '#ff2079', '#00e5ff', '#faff00'] },
  { id: 'chrome', name: 'Chrome', colors: ['#f8fafc', '#e8e8e8', '#b0b8c4', '#6b7280'] },
  { id: 'earth', name: 'Earth', colors: ['#7c5c3e', '#a98467', '#556b2f', '#d4b483'] },
  { id: 'stoner-greens', name: 'Stoner Greens', colors: ['#3f7d20', '#7ab648', '#cdd7a6', '#6a0dad'] },
]
