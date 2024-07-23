/** This class uses the Command Design Pattern to
 * wrap actions into objects.
 * The most important abstract method of this class is the `do()`
 * method, it performs the action wrapped by the object
 *
 * In order to support undo feature, each command must also
 * implement the restoreState() method to revert the effects of the action.
 * The constructor of every subclass must take the arguments needed to perform
 * the actual action of the command.
 */

import EventBus from "@/eventHandlers/EventBus";
import { Vector3 } from "three";
import { SEStoreType } from "@/stores/se";
import {
  plottableType,
  svgGradientType,
  svgStopType,
  svgStyleType as svgStyleType,
  toSVGReturnType,
  toSVGType
} from "@/types/index";
import SETTINGS, { LAYER } from "@/global-settings";
import { DeleteNoduleCommand } from "./DeleteNoduleCommand";

export abstract class Command {
  protected static store: SEStoreType;
  protected static tmpVector = new Vector3();
  protected static tmpVector1 = new Vector3();

  //#region commandArrays
  static commandHistory: Command[] = []; // stack of executed commands
  static redoHistory: Command[] = []; // stack of undone commands
  //#endregion commandArrays

  //eslint-disable-next-line
  protected lastState: any; // The state can be of ANY type

  //#region undo
  static undo(): void {
    if (Command.commandHistory.length === 0) return;
    // Pop the last command from the history stack
    const lastAction: Command | undefined = Command.commandHistory.pop();
    console.log("undo last", lastAction);
    // Run is restore state logic
    if (lastAction) {
      Command.redoHistory.push(lastAction);
      lastAction.restoreState();
    }
    // Update the free points to update the display so that individual command and visitors do
    // not have to update the display in the middle of undoing or redoing a command (this middle stuff causes
    // problems with the move *redo*)
    Command.store?.updateDisplay();
    EventBus.fire("undo-enabled", { value: Command.commandHistory.length > 0 });
    EventBus.fire("redo-enabled", { value: Command.redoHistory.length > 0 });
    this.store.updateSelectedSENodules([]);
  }
  //#endregion undo

  static undoEnabled = (): boolean => Command.commandHistory.length > 0;
  static redoEnabled = (): boolean => Command.redoHistory.length > 0;

  //#region redo
  static redo(): void {
    if (Command.redoHistory.length === 0) return;
    const nextAction = Command.redoHistory.pop();

    if (nextAction) {
      nextAction.execute(true);
    }
    // Update the free points to update the display so that individual command and visitors do
    // not have to update the display in the middle of undoing or redoing a command (this middle stuff causes
    // problems with the move *redo*)
    Command.store?.updateDisplay();
  }
  //#endregion redo

  execute(fromRedo?: boolean): void {
    // Keep this command in the history stack
    Command.commandHistory.push(this);
    this.saveState(); /* Allow the command to save necessary data to restore later */
    this.do(); /* perform the actual action of this command */

    /**
     * Suppose you create a segment from point A to B, then you move point B to location C, then push
     * undo, this moves the operation "move point from B to C" onto the redo stack and moves the point to location B
     * Now suppose you either
     *
     *    A) Delete the point at point B
     *
     *    B) Move the point from B to location D and create a circle with center the point at D and point on at A
     *
     * What happens when you push redo?
     *
     * In case A, you are trying to move a point that doesn't exist resulting in an error
     * In case B, you end up with a circle with center C and point on it A, which is strange behavior
     *
     * For this reason(A), it seems to me that when you issue a delete command, the redo stack should be cleared and
     * for (B), if you issue any new command while there is something on the redo stack, the redo stack should be cleared
     * But don't clear the redo stack if the new command is from a redo action
     */
    if (Command.redoHistory.length > 0 && fromRedo === undefined) {
      Command.redoHistory.splice(0);
    }

    EventBus.fire("undo-enabled", { value: Command.commandHistory.length > 0 });
    EventBus.fire("redo-enabled", { value: Command.redoHistory.length > 0 });
  }

  /** Just memorize the command without actually executing it */
  push(): void {
    Command.commandHistory.push(this);
    this.saveState();

    //The reasons for this block of code are above
    if (Command.redoHistory.length > 0) {
      Command.redoHistory.splice(0);
    }

    EventBus.fire("undo-enabled", { value: Command.commandHistory.length > 0 });
    EventBus.fire("redo-enabled", { value: Command.redoHistory.length > 0 });
  }

  /**
   * Convert all the commands in the history to textual operation code
   * @returns
   */
  static dumpOpcode(): string {
    const out = Command.commandHistory
      .map(c => c.toOpcode()) // convert each command in the history to its string representation
      .filter(z => z !== null); // but include only non-null output
    return JSON.stringify(out);
  }

  static defaultSVGStyleDictionary = new Map<svgStyleType, string>([
    ["fill", "black"],
    ["stroke", "none"],
    ["fill-opacity", "1"],
    ["stroke-width", "1"],
    ["stroke-opacity", "1"],
    // ["stroke-linecap", "butt"],
    // ["stroke-linejoin", "miter"],
    // ["stroke-miterlimit", "4"],
    ["stroke-dasharray", "none"],
    ["stroke-dashoffset", "0"],
    // ["font-family", ""], no default
    // ["font-size", ""], no default
    // ["line-height", ""], no default?
    ["text-anchor", "start"],
    ["dominant-baseline", "auto"],
    ["font-style", "normal"],
    ["font-weight", "normal"],
    ["text-decoration", "none"],
    ["direction", "ltr"]
  ]);

  /**
   * Returns either null or a six-tuple of information
   * including four (front|back)(gradient|style)dictionaries for the styling,
   * Array of the location and SVG strings, and
   * type of object encoded
   */
  abstract toSVG(deletedNoduleIds: Array<number>): null | toSVGType[];

  /**
   * Make an array of the ids of all deleted nodes for passing to each toSVG method. When an object is deleted, it
   *   is removed from the DAG, but the command history will still reference its creation.
   *   The nodule itself ( and the command that created it) will not know it has been deleted.
   */
  protected static deletedNoduleIds: Array<number> = [];

  static dumpSVG(width: number, height?: number): string {
    if (height == undefined) {
      height = width;
    }
    function gradientDictionariesEqual(
      d1: Map<svgGradientType, string | Map<svgStopType, string>[]>,
      d2: Map<svgGradientType, string | Map<svgStopType, string>[]>
    ): boolean {
      // quick check on the number of entries
      if (d1.size != d2.size) {
        return false;
      } else {
        for (let key of d1.keys()) {
          if (key !== "stops") {
            // comparing strings
            if (d1.get(key) !== d2.get(key)) {
              return false;
            }
          } else {
            // the values of the key "stops" is an array of stop dictionaries
            const d1StopArray = d1.get("stops") as Map<svgStopType, string>[];
            const d2StopArray = d2.get("stops") as Map<svgStopType, string>[];
            if (d1StopArray != undefined && d2StopArray != undefined) {
              if (d1StopArray.length != d2StopArray.length) {
                return false;
              } else {
                for (let ind = 0; ind < d1StopArray.length; ind++) {
                  const stop1Dict = d1StopArray[ind]; // key is "stops" so value is a dictionary and not a string
                  const stop2Dict = d2StopArray[ind];
                  if (stop1Dict !== undefined && stop2Dict !== undefined) {
                    if (stop1Dict.size !== stop2Dict.size) {
                      return false;
                    } else {
                      for (let key of stop1Dict.keys()) {
                        if (stop1Dict.get(key) !== stop2Dict.get(key)) {
                          return false;
                        }
                      }
                    }
                  }
                }
              }
            } else {
              return false;
            }
          }
        }
      }
      return true;
    }

    function styleDictionariesEqual(
      d1: Map<svgStyleType, string>,
      d2: Map<svgStyleType, string>
    ): boolean {
      // quick check on the number of entries
      if (d1.size != d2.size) {
        return false;
      } else {
        for (let key of d1.keys()) {
          if (d1.get(key) !== d2.get(key)) {
            return false;
          }
        }
      }
      return true;
    }
    // Build the header string for the SVG
    const size = Math.min(width, height);
    const sf = (size - 32) / (2 * SETTINGS.boundaryCircle.radius);
    let svgHeaderReturnString =
      '<svg width="' +
      width +
      'px" ' +
      'height="' +
      height +
      'px" ' +
      'xmlns="http://www.w3.org/2000/svg">\n';

    // Record the gradients (which will be radial gradients for us) for the SVG in a dictionary
    // key: names like circleFrontGradient1 and polygonBackGradient2, etc.
    // value: a dictionary with
    //    key: svgGradientType (i.e. string "centerX","focusY", etc.)
    //    value: string (matching the key) or if the key == "stop" a dictionary with
    //        keys svgStopType (offset, stop-color) <-- order matters!  when writing to the final object order from smallest to largest
    //        offest value to match key
    // This starts as an empty dictionary because there might not be any gradients in the SVG (i.e. circles, ellipse, polygon)
    const gradientDictionary = new Map<
      string,
      Map<svgGradientType, string | Map<svgStopType, string>[]>
    >();

    // Next create a style dictionary with
    //  key: name - this would be an object-type name/ front|back / a number like pointFrontStyle0, lineBackStyle1, labelBackStyle3,etc
    //  value: a dictionary with
    //      keys: svgStyleType (string of like "fill", "stroke", etc.)
    //      value: string of attribute]
    //
    //      Note: 1) key "fill" can point to a gradient in the gradient dictionary like ("url(#polygonBackGradient2)")
    //            2) include only those styles key whose values are not the defaults
    //
    //  Initially contains the style of the boundary circle

    const styleDictionary = new Map<string, Map<svgStyleType, string>>();
    // Add the style of the boundary circle
    const boundaryCircleStyleDict = new Map<svgStyleType, string>([
      ["fill", "none"],
      ["stroke", String(SETTINGS.boundaryCircle.color)],
      ["stroke-width", String(SETTINGS.boundaryCircle.lineWidth)]
    ]);
    styleDictionary.set("boundaryCircleStyle", boundaryCircleStyleDict);

    // create an layer dictionary with
    //    key: layer number, like 0 (of type number enum LAYER) corresponding to a layer
    //    value: list of the 1) the style name key from the styleDictionary and 2) SVG code for that object -
    //           Note: there should be NO space between the initial < and the name of the object.
    //                 The first space MUST be after the name of the object
    //
    // Here is a list of the layer name and number Glowing layer is used by anglemarker to get the fill not to overlap with the stroke of the edge
    //    backgroundAngleMarkers,0 --> contains only angle markers (edges and fill)
    //    backgroundFills,3 --> contains circles (fills only), ellipse (fills only), polygon
    //    background,4 --> contains lines, segments, circles (edges only), parametric, ellipse, edges only
    //    backgroundPoints,6 --> only contains points
    //    backgroundText,8 --> only contains labels
    //    foregroundFills,13 --> contains circles (fills only), ellipse (fills only), polygon
    //    midground,9 --> contains only the boundary circle
    //    foregroundAngleMarkers,11 --> contains only angle markers (edges and fill)
    //    foreground,14 --> contains lines, segments, circles (edges only), parametric, ellipse, edges only
    //    foregroundPoints,16 --> only contains points
    //    foregroundText, 18 --> only contains labels
    //
    //  Initially contains the boundary circle in the midground layer (The only object in the midground)

    const layerDictionary = new Map<LAYER, [string, string][]>();
    // Add the boundary circle
    const boundaryCircleSVG =
      '<circle cx="0" cy="0" r="' +
      String(SETTINGS.boundaryCircle.radius) +
      '"/>';
    layerDictionary.set(LAYER.midground, [
      ["boundaryCircleStyle", boundaryCircleSVG]
    ]);

    // For each command in the history add the necessary items to the (gradient|style|layer)Dictionary
    //
    // useful for naming the gradients
    let frontGradientCount = 0;
    let backGradientCount = 0;
    // useful for naming the styles
    let frontStyleCount = 0;
    let backStyleCount = 0;
    Command.commandHistory.forEach((c: Command) => {
      const toSVGReturnArray = c.toSVG(Command.deletedNoduleIds);
      if (toSVGReturnArray != null) {
        // console.log("here style", toSVGReturnArray.length )
        for (let information of toSVGReturnArray) {
          if (information != null) {
            const frontGradientDictionary = information.frontGradientDictionary;
            const backGradientDictionary = information.backGradientDictionary;
            const frontStyleDictionary = information.frontStyleDictionary;
            const backStyleDictionary = information.backStyleDictionary;
            const layerSVGInformation = information.layerSVGArray;
            const typeName = information.type;
            // console.log("type", typeName)
            // console.log("fgd",frontGradientDictionary)
            // console.log("bgd",backGradientDictionary)
            // console.log("fsd", frontStyleDictionary)
            // console.log("bsd",backStyleDictionary)

            // Incorporate the new gradient dictionaries into gradientDictionary
            //  Note: For a single object, there is only one front gradient and one back gradient applied to all front/back object fills
            let frontGradientName: string | null = null;
            if (frontGradientDictionary !== null) {
              // Check to see if this dictionary exists already in styleDictionary
              frontGradientName =
                typeName + "FrontGradient" + String(frontGradientCount);
              for (let [name, dict] of gradientDictionary.entries()) {
                if (gradientDictionariesEqual(dict, frontGradientDictionary)) {
                  frontGradientName = name;
                  break;
                }
              }
              if (
                frontGradientName ==
                typeName + "FrontGradient" + String(frontGradientCount)
              ) {
                // The gradient is new and should be added to the gradientDictionary
                gradientDictionary.set(
                  frontGradientName,
                  frontGradientDictionary
                );
                frontGradientCount++;
              }
            }
            let backGradientName: string | null = null;
            if (backGradientDictionary !== null) {
              // Check to see if this dictionary exists already in styleDictionary
              backGradientName =
                typeName + "BackGradient" + String(backGradientCount);
              for (let [name, dict] of gradientDictionary.entries()) {
                if (gradientDictionariesEqual(dict, backGradientDictionary)) {
                  backGradientName = name;
                  break;
                }
              }
              if (
                backGradientName ==
                typeName + "BackGradient" + String(backGradientCount)
              ) {
                // The gradient is new and should be added to the gradientDictionary
                gradientDictionary.set(
                  backGradientName,
                  backGradientDictionary
                );
                backGradientCount++;
              }
            }

            // Incorporate the style dictionaries into styleDictionary
            //  Note: For a single object, there is only one front style and one back style applied to all front/back object parts
            let frontStyleName: string | null = null;
            if (frontStyleDictionary !== null) {
              // If there is a frontGradient, make sure that the "fill" in the frontStyleDictionary points to it correctly
              if (frontGradientName !== null) {
                frontStyleDictionary.set(
                  "fill",
                  "url(#" + frontGradientName + ")"
                );
              }
              // Check to see if this dictionary exists already in styleDictionary
              frontStyleName =
                typeName + "FrontStyle" + String(frontStyleCount);
              for (let [name, dict] of styleDictionary.entries()) {
                //console.log("check equal",name,frontStyleName)
                if (styleDictionariesEqual(dict, frontStyleDictionary)) {
                  //console.log("yes",dict,frontStyleDictionary)
                  frontStyleName = name;
                  break;
                }
                // else {
                //   console.log("NO")
                // }
              }
              if (
                frontStyleName ==
                typeName + "FrontStyle" + String(frontStyleCount)
              ) {
                // The style is new and should be added to the styleDictionary
                styleDictionary.set(frontStyleName, frontStyleDictionary);
                frontStyleCount++;
              }
            }
            let backStyleName: string | null = null;
            if (backStyleDictionary !== null) {
              // If there is a backGradient, make sure that the "fill" in the backStyleDictionary points it correctly
              if (backGradientName !== null) {
                backStyleDictionary.set(
                  "fill",
                  "url(#" + backGradientName + ")"
                );
              }
              // Check to see if this dictionary exists already in styleDictionary
              backStyleName = typeName + "BackStyle" + String(backStyleCount);
              for (let [name, dict] of styleDictionary.entries()) {
                if (styleDictionariesEqual(dict, backStyleDictionary)) {
                  backStyleName = name;
                  break;
                }
              }
              if (
                backStyleName ==
                typeName + "BackStyle" + String(backStyleCount)
              ) {
                // The style is new and should be added to the styleDictionary
                styleDictionary.set(backStyleName, backStyleDictionary);
                backStyleCount++;
              }
            }

            // Incorporate the location,SVG array into the layerDictionary
            for (let [layer, svgString] of layerSVGInformation) {
              if (layer < LAYER.midground) {
                // the svg is in the background
                if (backStyleName !== null) {
                  const layerSVGStringList = layerDictionary.get(layer);
                  if (layerSVGStringList != undefined) {
                    layerSVGStringList.push([backStyleName, svgString]);
                    layerDictionary.set(layer, layerSVGStringList);
                  } else {
                    // the layer key pair doesn't exist yet in the dictionary
                    layerDictionary.set(layer, [[backStyleName, svgString]]);
                  }
                }
              } else {
                // the svg is in the foreground
                if (frontStyleName !== null) {
                  const styleSVGStringList = layerDictionary.get(layer);
                  if (styleSVGStringList != undefined) {
                    styleSVGStringList.push([frontStyleName, svgString]);
                    layerDictionary.set(layer, styleSVGStringList);
                  } else {
                    // the layer key pair doesn't exist yet in the dictionary
                    layerDictionary.set(layer, [[frontStyleName, svgString]]);
                  }
                }
              }
            }
          }
        }
      }
    });

    // Start with the scene grouping that set the scale
    const sceneLayerStart =
      '\t<g id="sphereScene" ' +
      'transform = "matrix(' +
      String(sf) +
      "," +
      "0" +
      "," +
      "0" +
      "," +
      String(-1 * sf) + // make sure that up is the positive y-axis
      "," +
      String(width / 2) +
      "," +
      String(height / 2) +
      ')">\n';
    const sceneLayerEnd = "\t</g>\n";

    // Build the svgReturnString parts from (gradient|style|layer) dictionaries don't add anything that is default value
    // Start with the gradients
    var gradientSVGReturnString = "";
    // If any, create the gradient part of the SVG return string
    if (gradientDictionary.size != 0) {
      gradientSVGReturnString += "\t<defs>\n";
      for (let [name, dict] of gradientDictionary.entries()) {
        const arrayOfStops: Map<svgStopType, string>[] = [];
        gradientSVGReturnString += '\t\t<radialGradient id="' + name + '" ';
        for (let [attribute, value] of dict) {
          // We have no guarantee of order and the stop attributes must be added last (and in order)
          if (attribute != "stops") {
            // The value is a string which is the value of the attribute
            gradientSVGReturnString +=
              attribute + '="' + (value as string) + '" ';
          } else {
            arrayOfStops.push(...(value as Map<svgStopType, string>[]));
          }
        }
        // close the start of the radial gradient
        gradientSVGReturnString += ">\n";
        // The stops are always added last
        for (let stopDict of arrayOfStops) {
          let tempStopLine = "\t\t\t<stop ";
          let tempStopNumber = 0;
          for (let [key, val] of stopDict) {
            tempStopLine += key + '="' + val + '" ';
            if (key == "offset") {
              tempStopNumber = Number(val);
            }
          }
          tempStopLine += "/>\n";
          gradientSVGReturnString += tempStopLine;
        }
        // Close the radial gradient
        gradientSVGReturnString += "\t\t</radialGradient>\n";
      }
      gradientSVGReturnString += "\t</defs>\n";
    }
    // Every text item has several styles that do not change. create a style string to add those to each text item
    const textStyleString =
      "\t\t\t.text { font-size:15px; text-anchor:middle; line-height:middle; dominant-baseline:middle; }\n";

    // Create the CSS style part of the SVG return string
    var styleSVGReturnString = '\t<style type="text/css"><![CDATA[\n';
    for (let [name, styleDict] of styleDictionary.entries()) {
      styleSVGReturnString += "\t\t\t." + name + " { ";
      //Add the list of attributes, but make sure it is not the default
      for (let [attribute, value] of styleDict) {
        if (this.defaultSVGStyleDictionary.get(attribute) != value) {
          styleSVGReturnString += attribute + ":" + value + "; ";
        }
      }
      // Close the CSS style
      styleSVGReturnString += "}\n";
    }
    //add the close of the style string
    if (styleSVGReturnString.includes("label")) {
      styleSVGReturnString += textStyleString;
    }
    // remove the last newline character
    styleSVGReturnString = styleSVGReturnString.slice(0, -1);
    // Close the CSS style section
    styleSVGReturnString += "]]>\n\t</style>\n";

    // Use the layer dictionary to create the layer SVG string
    let layerSVGReturnString = "";
    // The front fills need to be *before* the mid layer because the when the circle is a hole on the front
    // the edge of the fill that is along the boundary circle can't be not stroked and would be on top of the boundary
    // circle. So customize the order of the layer
    const myLayers: number[] = [];
    for (let layerNumber in LAYER) {
      if (!isNaN(Number(layerNumber))) {
        if (Number(layerNumber) == LAYER.midground) {
          myLayers.push(LAYER.foregroundFills);
          myLayers.push(LAYER.midground);
        } else if (Number(layerNumber) != LAYER.foregroundFills) {
          myLayers.push(Number(layerNumber));
        }
      }
    }
    myLayers.forEach(layerNumber => {
      const itemList = layerDictionary.get(Number(layerNumber));
      if (itemList != undefined) {
        // This layer is not empty
        // Flip the orientation for text layers
        if (LAYER[layerNumber].toLowerCase().includes("text")) {
          layerSVGReturnString +=
            '\t\t<g id="' +
            LAYER[layerNumber].replace("ground", "") +
            '" transform="scale(1,-1)">\n';
        } else {
          layerSVGReturnString +=
            '\t\t<g id="' + LAYER[layerNumber].replace("ground", "") + '">\n';
        }
        for (let [styleID, svgString] of itemList) {
          // insert the style ID class into the svgString using the first space
          if (svgString.toLowerCase().includes("text")) {
            layerSVGReturnString +=
              "\t\t\t" +
              svgString.replace(
                " ",
                ' class="' + styleID + ' text" ' // add the styling that applies to all text items
              ) +
              "\n";
          } else {
            layerSVGReturnString +=
              "\t\t\t" +
              svgString.replace(" ", ' class="' + styleID + '" ') +
              "\n";
          }
        }
        layerSVGReturnString += "\t\t</g>\n";
      }
    });

    // Build and return the svgReturnString
    return (
      svgHeaderReturnString +
      gradientSVGReturnString +
      styleSVGReturnString +
      sceneLayerStart +
      layerSVGReturnString +
      sceneLayerEnd +
      "</svg>"
    ).replace(/[\t]/gm, "   ");
    // return "blah";
  }

  static setGlobalStore(store: SEStoreType): void {
    Command.store = store;
  }
  // Child classes of Command must implement the following abstract methods
  /**
   * restoreState: Perform necessary action to restore the app state.
   * The operation(s) implemented in restoreState() are usually opposite of the
   * operation(s) implemented in do()*/
  abstract restoreState(): void;

  // TODO: consider merging saveState() and do(). They are always invoked one after the other

  /** saveState: Save require information to restore the app state*/
  /**
   * The saveState() method allows a particular command to save necessary information needed for undoing when restoreState()  is invoked (later on). And saveState() is invoked before do() in case the command requires to use/retrieve information before the action itself takes place. One example that I can think of now: let’s say we will implement ChangeLineWidthCommand and its saveState() method would be able to query the current line width before it changes the line width to a new value.
   */
  abstract saveState(): void;

  /**  do: Perform necessary action to alter the app state*/
  abstract do(): void;

  /** Generate an opcode ("assembly code") that can be saved as an executable script
   * and interpreted at runtime by calling the constructor of Command subclasses.
   * The generated opcode shall include sufficient details for invoking the constructor.
   *
   * @returns Several possible return values:

   * - A simple command shall return a string
   * - A command group shall return an array of string (one string per command in the group)
   * - A command that should be excluded/ignored during interpretation at runtime
   *   shall return null
   */

  abstract toOpcode(): null | string | Array<string>;

  // remove the &, / and & from a string and replace with hex equivalent / -> %47, = -> , and & -> %38
  static symbolToASCIIDec(inputString: string | undefined): string {
    if (inputString === undefined) {
      return "";
    }
    if (inputString.match(/%61|%47|%38|%64/)) {
      console.error(
        `Save Command: Forbidden pattern %61, %47, %38, or %64 found in string ${inputString}`
      );
    }
    return inputString
      .replaceAll("@", "%64")
      .replaceAll("=", "%61")
      .replaceAll("/", "%47")
      .replaceAll("&", "%38");
  }
  static asciiDecToSymbol(inputString: string): string {
    return inputString
      .replaceAll("%38", "&")
      .replaceAll("%47", "/")
      .replaceAll("%61", "=")
      .replaceAll("%64", "@");
  }
}
