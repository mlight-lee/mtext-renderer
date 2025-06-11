export type FontType = 'shx' | 'mesh';

/**
 * Represents font data stored in the cache database
 */
export interface FontData {
  /** Font name */
  name: string;
  /** Font type */
  type: FontType;
  /** Parsed font data. Different types of fonts have different data structure.  */
  data: unknown;
}
