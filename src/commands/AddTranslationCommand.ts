import { Command } from "./Command";
import { SENodule } from "@/models/SENodule";
import { SETranslation } from "@/models/SETranslation";
import { SESegment } from "@/models/SESegment";
import { SavedNames } from "@/types";

export class AddTranslationCommand extends Command {
  private seTranslation: SETranslation;
  private seSegment: SESegment;
  /**
   *
   * @param SETranslation The translation object being added
   * @param parent The line segment parent
   *
   */
  constructor(seTranslation: SETranslation, parent: SESegment) {
    super();
    this.seTranslation = seTranslation;
    this.seSegment = parent;
  }
  do(): void {
    Command.store.addTransformation(this.seTranslation);
    this.seSegment.registerChild(this.seTranslation);
  }

  saveState(): void {
    this.lastState = this.seSegment.id;
  }

  restoreState(): void {
    this.seSegment.unregisterChild(this.seTranslation);
    Command.store.removeTransformation(this.lastState);
  }

  toOpcode(): null | string | Array<string> {
    return [
      "AddTranslation",
      // Any attribute that could possibly have a "=", "@", "&" or "/" should be run through Command.symbolToASCIIDec
      // All plottable objects have these attributes
      "objectName=" + Command.symbolToASCIIDec(this.seTranslation.name),
      "objectExists=" + this.seTranslation.exists,
      // "objectShowing=" + this.seTranslation.showing, // this object is always showing so showing has no effect

      // Object specific attributes
      "translationSegmentParentName=" +
        Command.symbolToASCIIDec(this.seSegment.name)
    ].join("&");
  }

  static parse(command: string, objMap: Map<string, SENodule>): Command {
    const tokens = command.split("&");
    const propMap = new Map<SavedNames, string>();
    // load the tokens into the map
    tokens.forEach((token, ind) => {
      if (ind === 0) return; // don't put the command type in the propMap
      const parts = token.split("=");
      propMap.set(parts[0] as SavedNames, Command.asciiDecToSymbol(parts[1]));
    });

    // get the object specific attributes
    const segmentParent = objMap.get(
      propMap.get("translationSegmentParentName") ?? ""
    ) as SESegment | undefined;

    if (segmentParent) {
      const translation = new SETranslation(segmentParent);

      //put the translation in the object map
      if (propMap.get("objectName") !== undefined) {
        translation.name = propMap.get("objectName") ?? "";
        // translation.showing = propMap.get("objectShowing") === "true";
        translation.exists = propMap.get("objectExists") === "true";
        objMap.set(translation.name, translation);
      } else {
        throw new Error(
          "AddTranslationCommand:  translation name doesn't exist"
        );
      }
      return new AddTranslationCommand(translation, segmentParent);
    }
    throw new Error(`AddTranslationCommand: ${segmentParent} is undefined`);
  }
}
