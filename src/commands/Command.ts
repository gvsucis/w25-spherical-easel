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

import { SEStore } from "@/store";
import EventBus from "@/eventHandlers/EventBus";
import { SEPoint } from "@/models/SEPoint";
import { SELabel } from "@/models/SELabel";
import Point from "@/plottables/Point";
import { DisplayStyle } from "@/plottables/Nodule";
import Label from "@/plottables/Label";
import SETTINGS from "@/global-settings";
import { Vector3 } from "three";
import { StyleEditPanels, StyleOptions } from "@/types/Styles";
export abstract class Command {
  protected static store = SEStore;

  //#region commmandArrays
  static commandHistory: Command[] = []; // stack of executed commands
  static redoHistory: Command[] = []; // stack of undone commands
  //#endregion commmandArrays

  //eslint-disable-next-line
  protected lastState: any; // The state can be of ANY type

  //#region undo
  static undo(): void {
    if (Command.commandHistory.length === 0) return;
    // Pop the last command from the history stack
    const lastAction: Command | undefined = Command.commandHistory.pop();
    // Run is restore state logic
    if (lastAction) {
      Command.redoHistory.push(lastAction);
      lastAction.restoreState();
    }
    // Update the free points to update the display so that individual command and visitors do
    // not have to update the display in the middle of undoing or redoing a command (this middle stuff causes
    // problems with the move *redo*)
    Command.store.updateDisplay();
    EventBus.fire("undo-enabled", { value: Command.commandHistory.length > 0 });
    EventBus.fire("redo-enabled", { value: Command.redoHistory.length > 0 });
  }
  //#endregion undo

  static undoEnabled = (): boolean => Command.commandHistory.length > 0;
  static redoEnabled = (): boolean => Command.redoHistory.length > 0;

  //#region redo
  static redo(): void {
    if (Command.redoHistory.length === 0) return;
    const nextAction = Command.redoHistory.pop();

    if (nextAction) {
      nextAction.execute();
    }
    // Update the free points to update the display so that individual command and visitors do
    // not have to update the display in the middle of undoing or redoing a command (this middle stuff causes
    // problems with the move *redo*)
    Command.store.updateDisplay();
  }
  //#endregion redo

  execute(): void {
    // Keep this command in the history stack
    Command.commandHistory.push(this);
    this.saveState(); /* Allow the command to save necessary data to restore later */
    this.do(); /* perform the actual action of this command */

    EventBus.fire("undo-enabled", { value: Command.commandHistory.length > 0 });
    EventBus.fire("redo-enabled", { value: Command.redoHistory.length > 0 });
  }

  /** Just memorize the command without actually executing it */
  push(): void {
    Command.commandHistory.push(this);
    this.saveState();

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

  static makePointAndLabel(
    pointLocation: Vector3,
    pointFrontStyleString: string | undefined,
    pointBackStyleString: string | undefined,
    labelLocation: Vector3,
    labelStyleString: string | undefined
  ): { point: SEPoint; label: SELabel } {
    const newPoint = new Point();
    const point = new SEPoint(newPoint);
    point.locationVector.copy(pointLocation);
    if (pointFrontStyleString !== undefined)
      newPoint.updateStyle(
        StyleEditPanels.Front,
        JSON.parse(pointFrontStyleString)
      );
    if (pointBackStyleString !== undefined)
      newPoint.updateStyle(
        StyleEditPanels.Back,
        JSON.parse(pointBackStyleString)
      );

    const newLabel = new Label();
    const label = new SELabel(newLabel, point);
    label.locationVector.copy(labelLocation);
    if (labelStyleString !== undefined)
      newLabel.updateStyle(StyleEditPanels.Label, JSON.parse(labelStyleString));
    return { point, label };
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
  static symbolToASCIIDec(inputString: string): string {
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
