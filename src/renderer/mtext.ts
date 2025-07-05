import * as THREE from 'three';

import { FontManager } from '../font';
import {
  ColorSettings,
  MTextAttachmentPoint,
  MTextData,
  MTextFlowDirection,
  Point2d,
  TextStyle,
} from './types';

import { StyleManager } from './styleManager';
import { MTextProcessor, MTextFormatOptions } from './mtextProcessor';
import {
  MTextContext,
  MTextLineAlignment,
  MTextParagraphAlignment,
  MTextParser,
  getFonts,
} from '@mlightcad/mtext-parser';

const tempPoint = /*@__PURE__*/ new THREE.Vector3();
const tempVector = /*@__PURE__*/ new THREE.Vector3();
const tempScale = /*@__PURE__*/ new THREE.Vector3();
const tempQuaternion = /*@__PURE__*/ new THREE.Quaternion();
const translateTempMatrix = /*@__PURE__*/ new THREE.Matrix4();
const tempMatrix = /*@__PURE__*/ new THREE.Matrix4();
const AxisX = /*@__PURE__*/ new THREE.Vector3(1, 0, 0);

/**
 * Represents an AutoCAD MText object in Three.js.
 * This class extends THREE.Object3D to provide MText rendering capabilities,
 * including text layout, alignment, and transformation.
 */
export class MText extends THREE.Object3D {
  /** The text style configuration for this MText object */
  private _style: TextStyle;
  /** The style manager instance for handling text styles */
  private _styleManager: StyleManager;
  /** The font manager instance for handling font operations */
  private _fontManager: FontManager;
  /** Color settings used to decided font color */
  private _colorSettings: ColorSettings;
  /** The bounding box of the entire MText object */
  private _box: THREE.Box3;
  /** Array of bounding boxes for individual text elements */
  private _boxes: THREE.Box3[];

  /**
   * Extracts all unique font names used in an MText string.
   * This function searches for font commands in the format \f{fontname}| or \f{fontname}; and returns a set of unique font names.
   * Font names are converted to lowercase to ensure case-insensitive uniqueness.
   *
   * @param mtext - The MText string to analyze for font names
   * @param removeExtension - Whether to remove font file extensions (e.g., .ttf, .shx) from font names. Defaults to false.
   * @returns A Set containing all unique font names found in the MText string, converted to lowercase
   * @example
   * ```ts
   * const mtext = "\\fArial.ttf|Hello\\fTimes New Roman.otf|World";
   * const fonts = getFonts(mtext, true);
   * // Returns: Set(2) { "arial", "times new roman" }
   * ```
   */
  static getFonts(mtext: string, removeExtension: boolean = false) {
    return getFonts(mtext, removeExtension);
  }

  /**
   * Creates a new instance of MText.
   * @param text - The MText data containing text content and properties
   * @param style - The text style configuration
   * @param styleManager - The style manager instance
   * @param fontManager - The font manager instance
   * @param colorSettings - Color settings used to decided font color
   */
  constructor(
    text: MTextData,
    style: TextStyle,
    styleManager: StyleManager,
    fontManager: FontManager,
    colorSettings: ColorSettings = { byLayerColor: 0xffffff, byBlockColor: 0xffffff }
  ) {
    super();
    this._style = style;
    this._styleManager = styleManager;
    this._fontManager = fontManager;
    this._colorSettings = {
      byLayerColor: colorSettings.byLayerColor,
      byBlockColor: colorSettings.byBlockColor,
    };
    this._box = new THREE.Box3();
    this._boxes = [];
    const obj = this.loadMText(text, style);
    if (obj) {
      this.getBoxes(obj, this._boxes);
      this._boxes.forEach((box) => this.box.union(box));
      this.add(obj);
    }
  }

  /**
   * Gets the font manager instance associated with this MText object.
   * @returns The FontManager instance
   */
  get fontManager() {
    return this._fontManager;
  }

  /**
   * Gets the style manager instance associated with this MText object.
   * @returns The StyleManager instance
   */
  get styleManager() {
    return this._styleManager;
  }

  /**
   * Gets the text style configuration for this MText object.
   * @returns The TextStyle configuration
   */
  get textStyle() {
    return this._style;
  }

  /**
   * Gets or sets the bounding box of this MText object.
   * The bounding box is calculated without considering the transformation matrix.
   * To get the bounding box with transformation, call `applyMatrix4` on this box.
   */
  get box() {
    return this._box;
  }
  set box(box: THREE.Box3) {
    this._box.copy(box);
  }

  /**
   * Calculates intersections between a ray and this MText object.
   * Overrides the base THREE.Object3D raycast method to use the text's bounding boxes.
   * @param raycaster - The raycaster to use for intersection testing
   * @param intersects - Array to store intersection results
   */
  raycast(raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
    this._boxes.forEach((box) => {
      if (raycaster.ray.intersectBox(box, tempPoint)) {
        const distance = raycaster.ray.origin.distanceTo(tempPoint);
        intersects.push({
          distance: distance,
          point: tempPoint.clone(),
          object: this,
          face: null,
          faceIndex: undefined,
          uv: undefined,
        });
      }
    });
  }

  /**
   * Loads and processes MText data to create a Three.js object.
   * @param mtextData - The MText data to process
   * @param style - The text style configuration
   * @returns The created Three.js object, or undefined if creation fails
   */
  private loadMText(mtextData: MTextData, style: TextStyle) {
    const { object, height } = this.createMTextGroup(mtextData, style);
    if (!object) {
      return undefined;
    }

    object.matrix.decompose(tempVector, tempQuaternion, tempScale);
    if (mtextData.position) {
      tempVector.x += mtextData.position.x;
      tempVector.y += mtextData.position.y;
      object.matrix.compose(tempVector, tempQuaternion, tempScale);
    }

    const width = mtextData.width;
    const anchorPoint = this.calculateAnchorPoint(
      width,
      height,
      mtextData.attachmentPoint,
      mtextData.drawingDirection
    );

    object.traverse((obj) => {
      if ('geometry' in obj) {
        const geometry = obj.geometry as THREE.BufferGeometry;
        geometry.translate(anchorPoint.x, anchorPoint.y, 0);
      }
      obj.layers.enableAll();
    });

    let rotateAngle = mtextData.rotation || 0;
    if (mtextData.directionVector) {
      const dv = mtextData.directionVector;
      const vec = new THREE.Vector3(dv.x, dv.y, dv.z);
      const v = vec.clone().cross(AxisX);
      const angle = AxisX.angleTo(vec);
      rotateAngle = v.z > 0 ? -angle : angle;
    }

    object.matrix.compose(tempVector, tempQuaternion, tempScale);
    const translate = mtextData.position ? tempVector.clone().sub(mtextData.position) : tempVector;
    translateTempMatrix.makeTranslation(-translate.x, -translate.y, 0);
    tempMatrix.makeRotationZ(rotateAngle);
    object.matrix.multiply(translateTempMatrix);
    object.matrix.multiply(tempMatrix);
    object.matrix.multiply(translateTempMatrix.invert());
    object.matrix.decompose(object.position, object.quaternion, object.scale);
    return object;
  }

  /**
   * Creates a group of text elements from MText data.
   * @param mtextData - The MText data to process
   * @param style - The text style configuration
   * @returns An object containing the created Three.js object and its height
   */
  private createMTextGroup(mtextData: MTextData, style: TextStyle) {
    if (style && style.font && style.font.endsWith('.shx')) {
      const fontFileAndStyleName = `${style.font}_${style.name}`;
      if (!this.styleManager.unsupportedTextStyles[fontFileAndStyleName]) {
        this.styleManager.unsupportedTextStyles[fontFileAndStyleName] = 0;
      }
      this.styleManager.unsupportedTextStyles[fontFileAndStyleName]++;
    }

    const maxWidth = mtextData.width || 0;
    let horizontalAlignment = MTextParagraphAlignment.LEFT;
    if (mtextData.width && mtextData.attachmentPoint) {
      if ([1, 4, 7].includes(mtextData.attachmentPoint)) {
        horizontalAlignment = MTextParagraphAlignment.LEFT;
      } else if ([2, 5, 8].includes(mtextData.attachmentPoint)) {
        horizontalAlignment = MTextParagraphAlignment.CENTER;
      } else if ([3, 6, 9].includes(mtextData.attachmentPoint)) {
        horizontalAlignment = MTextParagraphAlignment.RIGHT;
      }
    }

    let verticalAlignment = MTextLineAlignment.BOTTOM;
    if (mtextData.attachmentPoint) {
      if ([1, 2, 3].includes(mtextData.attachmentPoint)) {
        verticalAlignment = MTextLineAlignment.TOP;
      } else if ([4, 5, 6].includes(mtextData.attachmentPoint)) {
        verticalAlignment = MTextLineAlignment.MIDDLE;
      } else if ([7, 8, 9].includes(mtextData.attachmentPoint)) {
        verticalAlignment = MTextLineAlignment.BOTTOM;
      }
    }

    const defaultFontSize = mtextData.height || 0;
    const defaultLineSpaceFactor = mtextData.lineSpaceFactor || 0.3;
    const flowDirection = mtextData.drawingDirection ?? MTextFlowDirection.LEFT_TO_RIGHT;
    const textLineFormatOptions: MTextFormatOptions = {
      fontSize: defaultFontSize,
      widthFactor: mtextData.widthFactor ?? 1,
      lineSpaceFactor: defaultLineSpaceFactor,
      horizontalAlignment: horizontalAlignment,
      maxWidth: maxWidth,
      flowDirection: flowDirection,
      byBlockColor: this._colorSettings.byBlockColor,
      byLayerColor: this._colorSettings.byLayerColor,
      removeFontExtension: true,
    };

    const context = new MTextContext();
    context.fontFace.family = style.font;
    context.capHeight = { value: mtextData.height || 1.0, isRelative: true };
    context.widthFactor = { value: mtextData.widthFactor ?? 1.0, isRelative: true };
    context.align = verticalAlignment;
    context.paragraph.align = horizontalAlignment;
    const textLine = new MTextProcessor(
      style,
      this.styleManager,
      this.fontManager,
      textLineFormatOptions
    );
    const parser = new MTextParser(mtextData.text, context, {
      resetParagraphParameters: true,
      yieldPropertyCommands: true,
    });
    const tokens = parser.parse();
    const object = textLine.processText(tokens);
    return {
      object: object,
      height: textLine.totalHeight,
    };
  }

  /**
   * Calculates the anchor point for text positioning based on alignment and flow direction.
   * @param width - The width of the text
   * @param height - The height of the text
   * @param attachmentPoint - The attachment point for text alignment
   * @param flowDirection - The text flow direction
   * @returns The calculated anchor point coordinates
   */
  private calculateAnchorPoint(
    width: number,
    height: number,
    attachmentPoint?: MTextAttachmentPoint,
    flowDirection?: MTextFlowDirection
  ): Point2d {
    let anchorX = 0,
      anchorY = 0;
    switch (attachmentPoint) {
      case undefined:
      case 1:
        // Top Left
        anchorX = 0;
        anchorY = 0;
        break;
      case 2:
        // Top Center
        anchorX -= width / 2;
        anchorY = 0;
        break;
      case 3:
        // Top Right
        anchorX -= width;
        anchorY = 0;
        break;
      case 4:
        // Middle Left
        anchorX = 0;
        anchorY += height / 2;
        break;
      case 5:
        // Middle Center
        anchorX -= width / 2;
        anchorY += height / 2;
        break;
      case 6:
        // Middle Right
        anchorX -= width;
        anchorY += height / 2;
        break;
      case 7:
        // Bottom Left
        anchorX = 0;
        anchorY += height;
        break;
      case 8:
        // Bottom Center
        anchorX -= width / 2;
        anchorY += height;
        break;
      case 9:
        // Bottom Right
        anchorX -= width;
        anchorY += height;
        break;
    }
    if (flowDirection == MTextFlowDirection.BOTTOM_TO_TOP) {
      anchorY -= height;
    }
    return { x: anchorX, y: anchorY };
  }

  /**
   * Recursively calculates bounding boxes for an object and its children.
   * @param object - The Three.js object to process
   * @param boxes - Array to store the calculated bounding boxes
   */
  private getBoxes(object: THREE.Object3D, boxes: THREE.Box3[]) {
    object.updateWorldMatrix(false, false);
    if (object instanceof THREE.Line || object instanceof THREE.Mesh) {
      const geometry = object.geometry;

      if (geometry.boundingBox === null) {
        geometry.computeBoundingBox();
      }
      const box = new THREE.Box3().copy(geometry.boundingBox);
      box.applyMatrix4(object.matrixWorld);
      boxes.push(box);
    }

    const children = object.children;
    for (let i = 0, l = children.length; i < l; i++) {
      this.getBoxes(children[i], boxes);
    }
  }
}
