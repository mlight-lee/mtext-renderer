/**
 * Represents information about a font in the system
 */
export interface FontInfo {
  /** Array of font names/aliases */
  name: string[]
  /** Font file name */
  file: string
  /** Type of the font - either mesh or shx format */
  type: 'woff' | 'shx'
  /** URL where the font can be accessed */
  url: string
}

/**
 * Represents the status of a font loading operation
 */
export interface FontLoadStatus {
  /** Name of the font that was loaded */
  fontName: string
  /** URL from which the font was loaded */
  url: string
  /** Whether the font was successfully loaded */
  status: boolean
}

/**
 * Interface that defines font loading functionality.
 * Applications should implement this interface to provide font loading capabilities.
 * This interface abstracts the font loading process, allowing different implementations
 * for different font sources or loading strategies.
 */
export interface FontLoader {
  /**
   * Loads the specified fonts into the system
   * @param fontNames - Array of font names to load
   * @returns Promise that resolves to an array of FontLoadStatus objects indicating the load status of each font
   */
  load(fontNames: string[]): Promise<FontLoadStatus[]>

  /**
   * Retrieves information about all available fonts in the system
   * @returns Promise that resolves to an array of FontInfo objects containing details about available fonts
   */
  getAvaiableFonts(): Promise<FontInfo[]>
}
