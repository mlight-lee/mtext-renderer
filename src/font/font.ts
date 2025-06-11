/**
 * Represents the type of font supported by the system
 * - 'shx': SHX font format commonly used in CAD systems
 * - 'mesh': Mesh-based font format (e.g., TTF, OTF, WOFF)
 */
export type FontType = 'shx' | 'mesh';

/**
 * Represents font data stored in the cache database.
 * This interface defines the structure of font data that is stored and retrieved from the cache.
 */
export interface FontData {
  /** The name of the font */
  name: string;
  /** The type of font (shx or mesh) */
  type: FontType;
  /** The parsed font data. Different types of fonts have different data structures. */
  data: unknown;
}
