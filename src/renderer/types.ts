export interface Point3d {
  x: number;
  y: number;
  z: number;
}

export interface Point2d {
  x: number;
  y: number;
}

export enum MTextFlowDirection {
  LEFT_TO_RIGHT = 1,
  RIGHT_TO_LEFT = 2,
  TOP_TO_BOTTOM = 3,
  BOTTOM_TO_TOP = 4,
  BY_STYLE = 5,
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
  BottomRight = 9,
}

export interface MTextData {
  text: string;
  height: number;
  width: number;
  position: Point3d;
  rotation?: number;
  directionVector?: Point3d;
  attachmentPoint?: MTextAttachmentPoint;
  drawingDirection?: MTextFlowDirection;
  lineSpaceFactor?: number;
  widthFactor?: number;
}

/**
 * Text style
 */
export interface TextStyle {
  name: string;
  standardFlag: number;
  fixedTextHeight: number;
  widthFactor: number;
  obliqueAngle: number;
  textGenerationFlag: number;
  lastHeight: number;
  font: string;
  bigFont: string;
  extendedFont?: string;
  color: number;
}
