import * as THREE from 'three';

import { FontManager } from '../font';
import { BaseText } from './baseText';
import { MTextAttachmentPoint, MTextData, MTextFlowDirection, Point2d, TextStyle } from './types';

import { StyleManager } from './styleManager';
import { MTextLines, TextLineFormatOptions } from './line';
import {
  MTextContext,
  MTextLineAlignment,
  MTextParagraphAlignment,
  MTextParser,
} from '@mlightcad/mtext-parser';

const tempPoint = /*@__PURE__*/ new THREE.Vector3();
const tempVector = /*@__PURE__*/ new THREE.Vector3();
const tempScale = /*@__PURE__*/ new THREE.Vector3();
const tempQuaternion = /*@__PURE__*/ new THREE.Quaternion();
const translateTempMatrix = /*@__PURE__*/ new THREE.Matrix4();
const tempMatrix = /*@__PURE__*/ new THREE.Matrix4();
const AxisX = /*@__PURE__*/ new THREE.Vector3(1, 0, 0);

export class MText extends BaseText {
  private _boxes: THREE.Box3[];

  constructor(
    text: MTextData,
    style: TextStyle,
    styleManager: StyleManager,
    fontManager: FontManager
  ) {
    super(style, styleManager, fontManager);
    this._boxes = [];
    const obj = this.loadMText(text, style);
    if (obj) {
      this.getBoxes(obj, this._boxes);
      this._boxes.forEach((box) => this.box.union(box));
      this.add(obj);
    }
  }

  /**
   * Get intersections between a casted ray and this object. Override this method
   * to calculate intersection using the bounding box of texts.
   */
  raycast(raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
    this._boxes.forEach((box) => {
      // Check for intersection with the bounding box
      if (raycaster.ray.intersectBox(box, tempPoint)) {
        const distance = raycaster.ray.origin.distanceTo(tempPoint);
        // Push intersection details
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

  private loadMText(mtextData: MTextData, style: TextStyle) {
    const { object, height } = this.createMTextGroup(mtextData, style);
    if (!object) {
      return undefined;
    }

    object.matrix.decompose(tempVector, tempQuaternion, tempScale);
    if (mtextData.position) {
      tempVector.x += mtextData.position.x;
      tempVector.y += mtextData.position.y;
      // object.position.z += entity.position.z;
      object.matrix.compose(tempVector, tempQuaternion, tempScale);
    }

    const width = mtextData.width;
    const anchorPoint = this.calculateAnchorPoint(
      width,
      height,
      mtextData.attachmentPoint,
      mtextData.drawingDirection
    );

    // const textAlign = content.style.horizontalAlignment;
    // switch (textAlign) {
    //     case "left":
    //         anchorX = 0;
    //         break;
    //     case "center":
    //         anchorX = 0;
    //         anchorX -= width / 2;
    //         break;
    //     case "right":
    //         anchorX = 0;
    //         anchorX -= width;
    //         break;
    //     default:
    //         break;
    // }
    // object.geometry.translate(anchorX, anchorY, 0);
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
      //object.rotateZ(v.z > 0 ? -angle : angle);
      rotateAngle = v.z > 0 ? -angle : angle;
    }

    // for offset
    // if (content.lineLength > 1) {
    //     object.position.y -= size.y + (content.style.textHeight as number);
    // } else {
    //     object.position.y -= size.y;
    // }

    // if (GeometryUtils.shouldRebasePositionOnRTC(tempVector2)) {
    //   // The translation part of the matrix exceeds the threshold and cannot participate in the merge
    //   this.setRTCUserData(object)
    // }

    object.matrix.compose(tempVector, tempQuaternion, tempScale);
    const translate = mtextData.position ? tempVector.clone().sub(mtextData.position) : tempVector;
    translateTempMatrix.makeTranslation(-translate.x, -translate.y, 0);
    tempMatrix.makeRotationZ(rotateAngle);
    object.matrix.multiply(translateTempMatrix);
    object.matrix.multiply(tempMatrix);
    object.matrix.multiply(translateTempMatrix.invert());
    // for debug
    // const test = new THREE.Line(new THREE.CircleGeometry(3), new THREE.LineBasicMaterial({ color: 0x00ff00 }));
    // object.add(test);
    //object.renderOrder = DxfRenderOrder.Text;
    object.matrix.decompose(object.position, object.quaternion, object.scale);
    return object;
  }

  private createMTextGroup(mtextData: MTextData, style: TextStyle) {
    // no font is exactly supported for now, we'll always use the loaded font with single line texts.
    if (style && style.font && style.font.endsWith('.shx')) {
      const fontFileAndStyleName = `${style.font}_${style.name}`;
      if (!this.styleManager.unsupportedTextStyles[fontFileAndStyleName]) {
        this.styleManager.unsupportedTextStyles[fontFileAndStyleName] = 0;
      }
      this.styleManager.unsupportedTextStyles[fontFileAndStyleName]++;
    }

    // TODO: Calculate this value based on reference rectangle width (DXF group code 41) and
    // horizontal width of the characters (DXF group code 42)
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
    const textLineFormatOptions: TextLineFormatOptions = {
      fontSize: defaultFontSize,
      widthFactor: mtextData.widthFactor ?? 1,
      lineSpaceFactor: defaultLineSpaceFactor,
      horizontalAlignment: horizontalAlignment,
      maxWidth: maxWidth,
      flowDirection: flowDirection,
      byBlockColor: 0xffffff,
      byLayerColor: 0xffffff,
    };

    const context = new MTextContext();
    context.fontFace.family = style.font;
    context.capHeight = { value: mtextData.height || 1.0, isRelative: true };
    context.widthFactor = { value: mtextData.widthFactor ?? 1.0, isRelative: true };
    context.align = verticalAlignment;
    context.paragraph.align = horizontalAlignment;
    const parser = new MTextParser(mtextData.text, context, true);
    const tokens = parser.parse();

    const textLine = new MTextLines(
      style,
      this.styleManager,
      this.fontManager,
      textLineFormatOptions
    );
    const object = textLine.processText(tokens);
    textLine.processLastLine();
    return {
      object: object,
      height: textLine.totalHeight,
    };
  }

  /**
   * Calculate anchor point of text string.
   * @param width Input width of text string.
   * @param height Input height of text string.
   * @param attachmentPoint Input the attachment point of text string. Default is top-left aligned.
   * @param flowDirection Input the direction that the text string follows from its start to its finish.
   * @returns Return the calculated anchor point.
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

  private getBoxes(object: THREE.Object3D, boxes: THREE.Box3[]) {
    // Computes the world-axis-aligned bounding box of an object (including its children),
    // accounting for both the object's, and children's, world transforms
    object.updateWorldMatrix(false, false);
    if (object instanceof THREE.Line || object instanceof THREE.Mesh) {
      const geometry = object.geometry;

      // geometry-level bounding box
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
