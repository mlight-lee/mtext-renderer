export interface Point3d {
  x: number
  y: number
  z: number
}

export interface Point2d {
  x: number
  y: number
}

export enum MTextFlowDirection {
  LEFT_TO_RIGHT = 1,
  RIGHT_TO_LEFT = 2,
  TOP_TO_BOTTOM = 3,
  BOTTOM_TO_TOP = 4,
  BY_STYLE = 5
}

export enum MTextAttachmentPoint {
  TopLeft = 1,
  TopCenter = 2,
  TopRight = 3,
  MiddleLeft = 4,
  MiddleCenter = 5,
  MiddleRight = 6,
  BottomLeft = 7,
  BottomCenter = 8,
  BottomRight = 9
}

/**
 * Represents the data structure for multiline text (MText) entities.
 * Contains all necessary properties to define the appearance and positioning of text.
 */
export interface MTextData {
  /** The actual text content to be displayed */
  text: string
  /** The height of the text characters in drawing units */
  height: number
  /** The width of the text box in drawing units. Text will wrap if it exceeds this width */
  width: number
  /** The 3D insertion point coordinates where the text will be placed */
  position: Point3d
  /** The rotation angle of the text in radians. Default is 0 (horizontal) */
  rotation?: number
  /** The normal vector that defines the plane in which the text lies. Used for 3D orientation */
  directionVector?: Point3d
  /** Specifies which point of the text boundary is aligned with the insertion point */
  attachmentPoint?: MTextAttachmentPoint
  /** Determines the primary direction in which text flows */
  drawingDirection?: MTextFlowDirection
  /** Factor that controls the spacing between text lines. Default is 1.0 */
  lineSpaceFactor?: number
  /** The width scaling factor applied to each character. Default is 1.0 */
  widthFactor?: number
}

/**
 * Represents a text style configuration that defines the visual appearance and formatting of text.
 * This interface contains properties that control various aspects of text rendering including font,
 * dimensions, and display characteristics.
 */
export interface TextStyle {
  /** The unique name identifier for this text style */
  name: string
  /** Flag indicating standard text style settings. Controls various text generation behaviors */
  standardFlag: number
  /** The fixed height of the text in drawing units. Used when text height should remain constant */
  fixedTextHeight: number
  /** The horizontal scaling factor applied to text characters. Default is 1.0 for normal width */
  widthFactor: number
  /** The angle in radians for italic text. 0.0 represents vertical text, positive values slant to the right */
  obliqueAngle: number
  /** Bit-coded flag controlling text generation options (e.g., mirroring, upside-down) */
  textGenerationFlag: number
  /** The most recently used text height for this style */
  lastHeight: number
  /** The primary font name or file to be used for text rendering */
  font: string
  /** The font name or file to be used for wide characters (typically used for CJK characters) */
  bigFont: string
  /** Optional extended font settings or alternative font specification */
  extendedFont?: string
  /** The color index or value for the text. May reference a color table or direct color value */
  color: number
}

/**
 * Defines the default color settings for special color modes in text rendering.
 * These settings are used to resolve color values when text uses layer-dependent
 * or block-dependent coloring.
 */
export interface ColorSettings {
  /** The color value to use when text is set to "by layer" color mode */
  byLayerColor: number
  /** The color value to use when text is set to "by block" color mode */
  byBlockColor: number
}
