export type Shape = {
  id: string
  name: string
  /** SVG path, normalized to the 0..1 box */
  path: string
  builtIn: boolean
}
