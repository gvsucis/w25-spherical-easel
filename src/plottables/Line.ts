import { Vector3 } from "three";
import SETTINGS, { LAYER } from "@/global-settings";
import Nodule, { DisplayStyle } from "./Nodule";
import {
  StyleOptions,
  StyleCategory,
  DEFAULT_LINE_FRONT_STYLE,
  DEFAULT_LINE_BACK_STYLE
} from "@/types/Styles";
//import Two from "two.js";
//import { Path } from "two.js/src/path";
//import { Arc } from "two.js/extras/js/arc"
//import "two.js/extras/js/arc"
import Two from "two.js"
import {Arc} from "two.js/extras/jsm/arc"
//import { Vector } from "two.js/src/vector";
import { Group } from "two.js/src/group";

// The number of vectors used to render the front half (and the same number in the back half)
const SUBDIVS = SETTINGS.line.numPoints;
// The radius of the sphere on the screen
const radius = SETTINGS.boundaryCircle.radius;

/**
 * A line
 *
 * @export
 * @class Line
 * @extends Nodule
 */
export default class Line extends Nodule {
  /** The normal vector to the plane containing the line*/
  private _normalVector: Vector3;

  /**
   * NOTE: Once the above variable is set, the updateDisplay() will correctly render the line.
   * This are the only piece of information that is need to do the rendering, so the updateDisplay() is automatically
   * class when the setter is used to update the normal Vector All other
   * calculations in this class are only for the purpose of rendering the line.
   */

  /** The normal vector determines the rotation and minor axis length of the displayed ellipse */
  private _rotation: number;
  private _halfMinorAxis: number;

  /**
   * A line has half on the front and half on the back. There are glowing counterparts for each part.
   */
  protected frontHalf: Arc;
  protected backHalf: Arc;
  protected glowingFrontHalf: Arc;
  protected glowingBackHalf: Arc;

  /**
   * The styling variables for the drawn segment. The user can modify these.
   */
  // Front
  protected glowingStrokeColorFront = SETTINGS.line.glowing.strokeColor.front;
  // Back
  protected glowingStrokeColorBack = SETTINGS.line.glowing.strokeColor.back;

  /** Initialize the current line width that is adjust by the zoom level and the user widthPercent */
  static currentLineStrokeWidthFront = SETTINGS.line.drawn.strokeWidth.front;
  static currentLineStrokeWidthBack = SETTINGS.line.drawn.strokeWidth.back;
  static currentGlowingLineStrokeWidthFront =
    SETTINGS.line.drawn.strokeWidth.front + SETTINGS.line.glowing.edgeWidth;
  static currentGlowingLineStrokeWidthBack =
    SETTINGS.line.drawn.strokeWidth.back + SETTINGS.line.glowing.edgeWidth;

  /**
   * Update all the current stroke widths
   * @param factor The ratio of the current magnification factor over the old magnification factor
   */
  static updateCurrentStrokeWidthForZoom(factor: number): void {
    Line.currentLineStrokeWidthFront *= factor;
    Line.currentLineStrokeWidthBack *= factor;
    Line.currentGlowingLineStrokeWidthFront *= factor;
    Line.currentGlowingLineStrokeWidthBack *= factor;
  }

  constructor(noduleName: string = "None") {
    super(noduleName);
    this.frontHalf = new Arc(0,0,2*radius,2*radius,Math.PI,2*Math.PI,SUBDIVS);
    this.glowingFrontHalf = new Arc(0,0,2*radius,2*radius,Math.PI,2*Math.PI,SUBDIVS);
    // Create the back half, glowing front half, glowing back half circle by cloning the front half
    this.backHalf =  new Arc(0,0,2*radius,2*radius,0,Math.PI,SUBDIVS);
    this.glowingBackHalf = new Arc(0,0,2*radius,2*radius,0,Math.PI,SUBDIVS);


    //Record the path ids for all the TwoJS objects which are not glowing. This is for use in IconBase to create icons.
    Nodule.idPlottableDescriptionMap.set(String(this.frontHalf.id), {
      type: "line",
      side: "front",
      fill: false,
      part: ""
    });
    Nodule.idPlottableDescriptionMap.set(String(this.backHalf.id), {
      type: "line",
      side: "back",
      fill: false,
      part: ""
    });

    // The line is not initially glowing but is visible for the temporary object
    this.frontHalf.visible = true;
    this.backHalf.visible = true;
    this.glowingFrontHalf.visible = false;
    this.glowingBackHalf.visible = false;

    // Set the style that never changes -- Fill
    this.frontHalf.noFill();
    this.glowingFrontHalf.noFill();
    this.backHalf.noFill();
    this.glowingBackHalf.noFill();

    // Be sure to clone() the incoming start and end points
    // Otherwise update by other Line will affect this one!
    this._normalVector = new Vector3();
    //Let \[Beta]  be the angle between the north pole NP= <0,0,1> and the unit normal vector (with z coordinate positive), then cos(\[Beta]) is half the minor axis.
    //Note:
    //  0 <= \[Beta] <= \[Pi]/2.
    //  _normalVector.z = NP._normalVector = |NP||_normalVector|cos(\[Beta])= cos(\[Beta])
    this._halfMinorAxis = this._normalVector.z


    this._rotation = 0; //Initially the normal vector is <0,0,1> so the rotation is 0 in general the rotation angle is
     //Let \[Theta] be the angle between the vector <0,1> and <n_x,n_y>, then \[Theta] is the angle of rotation. I think that \[Theta] = ATan2(n_x,n_y) (measured clockwise)

    this.styleOptions.set(StyleCategory.Front, DEFAULT_LINE_FRONT_STYLE);
    this.styleOptions.set(StyleCategory.Back, DEFAULT_LINE_BACK_STYLE);
  }

  /**
   * This is the only vector that needs to be set in order to render the line.  This also updates the display
   */
  set normalVector(dir: Vector3) {
    this._normalVector.copy(dir).normalize();
    this._halfMinorAxis = this._normalVector.z
    this._rotation = -Math.atan2(this._normalVector.x,this._normalVector.y) // not a typo because we are measuring off of the positive y axis in the screen plane
    this.updateDisplay();
  }

  frontGlowingDisplay(): void {
    this.frontHalf.visible = true;
    this.glowingFrontHalf.visible = true;
  }

  backGlowingDisplay(): void {
    this.backHalf.visible = true;
    this.glowingBackHalf.visible = true;
  }

  glowingDisplay(): void {
    this.frontGlowingDisplay();
    this.backGlowingDisplay();
  }

  frontNormalDisplay(): void {
    this.frontHalf.visible = true;
    this.glowingFrontHalf.visible = false;
  }

  backNormalDisplay(): void {
    this.backHalf.visible = true;
    this.glowingBackHalf.visible = false;
  }

  normalDisplay(): void {
    this.frontNormalDisplay();
    this.backNormalDisplay();
  }

  /**
   * Update the display of line
   * This method updates the TwoJS objects (frontHalf, backHalf, ...) for display
   * This is only accurate if the normal vector is correct so only
   * call this method once that vector is updated.
   */
  public updateDisplay(): void {
    this.frontHalf.rotation= this._rotation
    this.glowingFrontHalf.rotation = this._rotation
    this.backHalf.rotation = this._rotation
    this.glowingBackHalf.rotation = this._rotation

    this.frontHalf.height = 2*radius*this._halfMinorAxis
    this.glowingFrontHalf.height = 2*radius*this._halfMinorAxis
    this.backHalf.height = 2*radius*this._halfMinorAxis
    this.glowingBackHalf.height = 2*radius*this._halfMinorAxis
  }

  setVisible(flag: boolean): void {
    if (!flag) {
      this.frontHalf.visible = false;
      this.glowingFrontHalf.visible = false;
      this.backHalf.visible = false;
      this.glowingBackHalf.visible = false;
    } else {
      this.normalDisplay();
    }
  }

  setSelectedColoring(flag: boolean): void {
    //set the new colors into the variables
    if (flag) {
      this.glowingStrokeColorFront = SETTINGS.style.selectedColor.front;
      this.glowingStrokeColorBack = SETTINGS.style.selectedColor.back;
    } else {
      this.glowingStrokeColorFront = SETTINGS.line.glowing.strokeColor.front;
      this.glowingStrokeColorBack = SETTINGS.line.glowing.strokeColor.back;
    }
    // apply the new color variables to the object
    this.stylize(DisplayStyle.ApplyCurrentVariables);
  }

  // It looks like we have to define our own clone() function
  // The builtin clone() does not seem to work correctly
  clone(): this {
    const dup = new Line(this.name);
    dup.normalVector=this._normalVector;
    // setting the normal vector sets the rotation and halfMinorAxis and calls updateDisplay() for dup
    return dup as this;
  }

  addToLayers(layers: Group[]): void {
    this.frontHalf.addTo(layers[LAYER.foreground]);
    this.glowingFrontHalf.addTo(layers[LAYER.foregroundGlowing]);
    this.backHalf.addTo(layers[LAYER.background]);
    this.glowingBackHalf.addTo(layers[LAYER.backgroundGlowing]);
  }

  removeFromLayers(): void {
    this.frontHalf.remove();
    this.backHalf.remove();
    this.glowingFrontHalf.remove();
    this.glowingBackHalf.remove();
  }

  /**
   * Return the default style state
   */
  defaultStyleState(panel: StyleCategory): StyleOptions {
    switch (panel) {
      case StyleCategory.Front:
        return DEFAULT_LINE_FRONT_STYLE;
      case StyleCategory.Back:
        if (SETTINGS.line.dynamicBackStyle)
          return {
            ...DEFAULT_LINE_BACK_STYLE,
            strokeWidthPercent: Nodule.contrastStrokeWidthPercent(100),
            strokeColor: Nodule.contrastStrokeColor(
              SETTINGS.line.drawn.strokeColor.front
            )
          };
        else return DEFAULT_LINE_BACK_STYLE;
      default:
        return {};
    }
  }
  /**
   * Sets the variables for stroke width glowing/not
   */
  adjustSize(): void {
    const frontStyle = this.styleOptions.get(StyleCategory.Front);
    const backStyle = this.styleOptions.get(StyleCategory.Back);
    const frontStrokeWidthPercent = frontStyle?.strokeWidthPercent ?? 100;
    const backStrokeWidthPercent = backStyle?.strokeWidthPercent ?? 100;
    this.frontHalf.linewidth =
      (Line.currentLineStrokeWidthFront * frontStrokeWidthPercent) / 100;

    this.backHalf.linewidth =
      (Line.currentLineStrokeWidthBack *
        (backStyle?.dynamicBackStyle
          ? Nodule.contrastStrokeWidthPercent(frontStrokeWidthPercent)
          : backStrokeWidthPercent)) /
      100;
    this.glowingFrontHalf.linewidth =
      (Line.currentGlowingLineStrokeWidthFront * frontStrokeWidthPercent) / 100;
    this.glowingBackHalf.linewidth =
      (Line.currentGlowingLineStrokeWidthBack *
        (backStyle?.dynamicBackStyle
          ? Nodule.contrastStrokeWidthPercent(frontStrokeWidthPercent)
          : backStrokeWidthPercent)) /
      100;
  }

  /**
   * Set the rendering style (flags: ApplyTemporaryVariables, ApplyCurrentVariables) of the line
   *
   * ApplyTemporaryVariables means that
   *    1) The temporary variables from SETTINGS.point.temp are copied into the actual js objects
   *    2) The pointScaleFactor is copied from the Point.pointScaleFactor (which accounts for the Zoom magnification) into the actual js objects
   *
   * Apply CurrentVariables means that all current values of the private style variables are copied into the actual js objects
   */
  stylize(flag: DisplayStyle): void {
    switch (flag) {
      case DisplayStyle.ApplyTemporaryVariables: {
        // Use the SETTINGS temporary options to directly modify the js objects.

        // Front
        // no fillColor
        if (
          Nodule.hslaIsNoFillOrNoStroke(SETTINGS.line.temp.strokeColor.front)
        ) {
          this.frontHalf.noStroke();
        } else {
          this.frontHalf.stroke = SETTINGS.line.temp.strokeColor.front;
        }
        // strokeWidthPercent -- The line width is set to the current line width (which is updated for zoom magnification)
        this.frontHalf.linewidth = Line.currentLineStrokeWidthFront;
        // Copy the front dash properties from the front default drawn dash properties
        if (SETTINGS.line.drawn.dashArray.front.length > 0) {
          this.frontHalf.dashes.clear();
          SETTINGS.line.drawn.dashArray.front.forEach(v => {
            this.frontHalf.dashes.push(v);
          });
          if (SETTINGS.line.drawn.dashArray.reverse.front) {
            this.frontHalf.dashes.reverse();
          }
        }

        // Back
        // no fill color
        if (
          Nodule.hslaIsNoFillOrNoStroke(SETTINGS.line.temp.strokeColor.back)
        ) {
          this.backHalf.noStroke();
        } else {
          this.backHalf.stroke = SETTINGS.line.temp.strokeColor.back;
        }
        // strokeWidthPercent -- The line width is set to the current line width (which is updated for zoom magnification)
        this.backHalf.linewidth = Line.currentLineStrokeWidthBack;

        // Copy the back dash properties from the back default drawn dash properties
        if (SETTINGS.line.drawn.dashArray.back.length > 0) {
          this.backHalf.dashes.clear();
          SETTINGS.line.drawn.dashArray.back.forEach(v => {
            this.backHalf.dashes.push(v);
          });
          if (SETTINGS.line.drawn.dashArray.reverse.back) {
            this.backHalf.dashes.reverse();
          }
        }

        // The temporary display is never highlighted
        this.glowingFrontHalf.visible = false;
        this.glowingBackHalf.visible = false;
        break;
      }

      case DisplayStyle.ApplyCurrentVariables: {
        // Use the current variables to directly modify the js objects.

        // Front
        const frontStyle = this.styleOptions.get(StyleCategory.Front);
        // no fillColor
        if (Nodule.hslaIsNoFillOrNoStroke(frontStyle?.strokeColor)) {
          this.frontHalf.noStroke();
        } else {
          this.frontHalf.stroke = frontStyle?.strokeColor ?? "black";
        }
        // strokeWidthPercent applied by adjustSize()

        if (
          frontStyle?.dashArray &&
          frontStyle?.reverseDashArray !== undefined &&
          frontStyle?.dashArray.length > 0
        ) {
          this.frontHalf.dashes.clear();
          this.frontHalf.dashes.push(...frontStyle?.dashArray);
          if (frontStyle.reverseDashArray) {
            this.frontHalf.dashes.reverse();
          }
        } else {
          // the array length is zero and no dash array should be set
          this.frontHalf.dashes.clear();
          this.frontHalf.dashes.push(0);
        }

        // Back
        const backStyle = this.styleOptions.get(StyleCategory.Back);
        // no fillColor
        if (backStyle?.dynamicBackStyle) {
          if (
            Nodule.hslaIsNoFillOrNoStroke(
              Nodule.contrastStrokeColor(frontStyle?.strokeColor)
            )
          ) {
            this.backHalf.noStroke();
          } else {
            this.backHalf.stroke = Nodule.contrastStrokeColor(
              frontStyle?.strokeColor ?? "black"
            );
          }
        } else {
          if (Nodule.hslaIsNoFillOrNoStroke(backStyle?.strokeColor)) {
            this.backHalf.noStroke();
          } else {
            this.backHalf.stroke = backStyle?.strokeColor ?? "black";
          }
        }
        // strokeWidthPercent applied by adjustSize()

        if (
          backStyle?.dashArray &&
          backStyle?.reverseDashArray !== undefined &&
          backStyle.dashArray.length > 0
        ) {
          this.backHalf.dashes.clear();
          this.backHalf.dashes.push(...backStyle.dashArray);
          if (backStyle.reverseDashArray) {
            this.backHalf.dashes.reverse();
          }
        } else {
          // the array length is zero and no dash array should be set
          this.backHalf.dashes.clear();
          this.backHalf.dashes.push(0);
        }

        // Glowing Front
        // no fillColor
        this.glowingFrontHalf.stroke = this.glowingStrokeColorFront;
        // strokeWidthPercent applied by adjustSize()

        // Copy the front dash properties to the glowing object
        if (
          frontStyle?.dashArray &&
          frontStyle?.reverseDashArray !== undefined &&
          frontStyle?.dashArray.length > 0
        ) {
          this.glowingFrontHalf.dashes.clear();
          this.glowingFrontHalf.dashes.push(...frontStyle?.dashArray);
          if (frontStyle.reverseDashArray) {
            this.glowingFrontHalf.dashes.reverse();
          }
        } else {
          // the array length is zero and no dash array should be set
          this.glowingFrontHalf.dashes.clear();
          this.glowingFrontHalf.dashes.push(0);
        }

        // Glowing Back
        // no fillColor
        this.glowingBackHalf.stroke = this.glowingStrokeColorBack;
        // strokeWidthPercent applied by adjustSize()

        // Copy the back dash properties to the glowing object
        if (
          backStyle?.dashArray &&
          backStyle?.reverseDashArray !== undefined &&
          backStyle.dashArray.length > 0
        ) {
          this.glowingBackHalf.dashes.clear();
          this.glowingBackHalf.dashes.push(...backStyle.dashArray);
          if (backStyle.reverseDashArray) {
            this.glowingBackHalf.dashes.reverse();
          }
        } else {
          // the array length is zero and no dash array should be set
          this.glowingBackHalf.dashes.clear();
          this.glowingBackHalf.dashes.push(0);
        }
        break;
      }
    }
  }
}
