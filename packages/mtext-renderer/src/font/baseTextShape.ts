import * as THREE from 'three';

/**
 * Abstract base class for text shape implementations.
 * Provides common functionality and interface for text shape handling.
 * This class defines the core interface that all text shape types must implement.
 */
export abstract class BaseTextShape extends THREE.Shape {
  /** The character this shape represents */
  public readonly char: string;
  /**
   * Width used to render this character
   */
  public width = 0;

  /**
   * Creates a new instance of BaseTextShape
   * @param char - The character this shape represents   */
  constructor(char: string) {
    super();
    this.char = char;
  }

  /**
   * Converts the text shape to a THREE.js geometry
   * @returns A THREE.js BufferGeometry representing the text shape
   */
  abstract toGeometry(): THREE.BufferGeometry;
}
