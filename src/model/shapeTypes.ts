export type Shape = {
  id: string
  name: string
  /** SVG path, normalized to the 0..1 box */
  path: string
  builtIn: boolean
  /**
   * Preferred w/h when instantiated (default 1). The path stays in the
   * 0..1 box; non-square shapes like Rectangle carry their aspect here
   * so new layers, stamps, and picker glyphs come out wide.
   */
  defaultAspect?: number
}
