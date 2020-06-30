import Two from "two.js";
import { SENodule } from "@/models/SENodule";
import { Stylable } from "./Styleable";
import { Resizeable } from "./Resizeable";
import SETTINGS from "@/global-settings";

export enum DisplayStyle {
  DEFAULT,
  TEMPORARY,
  UPDATE,
  GLOWING
}

/**
 * A Nodule consists of one or more SVG elements
 */
export default abstract class Nodule extends Two.Group
  implements Stylable, Resizeable {
  // Declare owner, this field will be initialized by the associated owner of the plottable Nodule
  public owner!: SENodule;
  public name!: string;

  constructor() {
    super();
    //this.name = "Nodule" + this.id;
  }

  /**
   * Add various SVG elements of this nodule to appropriate layers
   * @param {Two.Group[]} layers
   */
  abstract addToLayers(layers: Two.Group[]): void;

  /**
   * This operation reverses the action performed by addToLayers()
   */
  abstract removeFromLayers(/*layers: Two.Group[]*/): void;

  /**This operation constraint the visual properties (linewidth, circle size, etc) when the view is zoomed in/out */
  abstract adjustSizeForZoom(factor: number): void;

  /** Update visual style(s) */
  // abstract frontGlowingDisplay(): void;
  // abstract backGlowingDisplay(): void;
  // abstract frontNormalDisplay(): void;
  // abstract backNormalDisplay(): void;
  abstract normalDisplay(): void;
  abstract glowingDisplay(): void;

  /** Set the temporary/glowing style and update the current display*/
  abstract stylize(flag: DisplayStyle): void;
  abstract setVisible(flag: boolean): void;

  //** Get the back contrasting style using the value of contrast */
  static contrastFillColor(frontColor: string): string {
    return frontColor;
  }
  static contrastStrokeColor(frontColor: string): string {
    return frontColor;
  }
  static contractStrokeWidth(frontStrokeWidth: number): number {
    return frontStrokeWidth;
  }
  static contrastOpacity(frontOpacity: number): number {
    return SETTINGS.contrast * frontOpacity;
  }
  static contrastDashArray(frontDashArray: number[]): number[] {
    return frontDashArray;
  }
  static contrastDashArrayOffset(frontOffset: number): number {
    return frontOffset;
  }
}
