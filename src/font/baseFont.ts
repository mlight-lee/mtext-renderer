import { BaseTextShape } from './baseTextShape';
import { FontType } from './font';

/**
 * Abstract base class for font implementations.
 * Provides common functionality and interface for font handling.
 */
export abstract class BaseFont {
  /** Font type */
  public abstract readonly type: FontType;
  /**
   * Parsed font data. Different types of fonts have different data structure.
   */
  public abstract readonly data: unknown;
  /**
   * Record of characters that are not supported by this font.
   * Maps character strings to their occurrence count.
   */
  public unsupportedChars: Record<string, number> = {};

  /**
   * Gets the shape data for a specific character at a given size.
   * @param char - The character to get the shape for
   * @param size - The desired size of the character
   * @returns The shape data for the character, or undefined if not found
   */
  abstract getCharShape(char: string, size: number): BaseTextShape | undefined;

  /**
   * Gets the scale factor for this font.
   * This is used to adjust the size of characters when rendering.
   * @returns The scale factor as a number
   */
  abstract getScaleFactor(): number;

  /**
   * Gets the shape to display when a character is not found in the font.
   * @param size - The desired size of the not found shape
   * @returns The shape data for the not found indicator, or undefined if not available
   */
  abstract getNotFoundTextShape(size: number): BaseTextShape | undefined;

  /**
   * Records an unsupported character in the font.
   * Increments the count for the given character in unsupportedChars.
   * @param char - The unsupported character to record
   */
  protected addUnsupportedChar(char: string) {
    if (!this.unsupportedChars[char]) {
      this.unsupportedChars[char] = 0;
    }
    this.unsupportedChars[char]++;
  }
}
