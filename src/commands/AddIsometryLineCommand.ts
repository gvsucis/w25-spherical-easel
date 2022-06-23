import { Command } from "./Command";
import { SECircle } from "@/models/SECircle";
import { SEPoint } from "@/models/SEPoint";
import { SELabel } from "@/models/SELabel";
import { SENodule } from "@/models/SENodule";
import { Vector3 } from "three";
import Label from "@/plottables/Label";
import { StyleEditPanels } from "@/types/Styles";
import { SavedNames, SEIsometry } from "@/types";
import { SEExpression } from "@/models/SEExpression";
import NonFreeCircle from "@/plottables/NonFreeCircle";
import { SEMeasuredCircle } from "@/models/SEMeasuredCircle";
import NonFreePoint from "@/plottables/NonFreePoint";
import { SETransformation } from "@/models/SETransformation";
import { SETransformedPoint } from "@/models/SETransformedPoint";
import { compile } from "vue/types/umd";
import { SELine } from "@/models/SELine";
import { SEIsometryLine } from "@/models/SEIsometryLine";
import NonFreeLine from "@/plottables/NonFreeLine";

export class AddIsometryLineCommand extends Command {
  private preimageSELine: SELine;
  private parentIsometry: SEIsometry;
  private isometrySELine: SEIsometryLine;
  private isometrySELineLabel: SELabel;

  constructor(
    isometrySELine: SEIsometryLine,
    isometrySELineLabel: SELabel,
    preimageSELine: SELine,
    parentIsometry: SEIsometry
  ) {
    super();
    this.preimageSELine = preimageSELine;
    this.isometrySELine = isometrySELine;
    this.parentIsometry = parentIsometry;
    this.isometrySELineLabel = isometrySELineLabel;
  }

  do(): void {
    this.preimageSELine.registerChild(this.isometrySELine);
    this.parentIsometry.registerChild(this.isometrySELine);
    this.isometrySELine.registerChild(this.isometrySELineLabel);
    Command.store.addLine(this.isometrySELine);
    Command.store.addLabel(this.isometrySELineLabel);
  }

  saveState(): void {
    this.lastState = this.isometrySELine.id;
  }

  restoreState(): void {
    Command.store.removeLabel(this.isometrySELineLabel.id);
    Command.store.removeLine(this.lastState);
    this.isometrySELine.unregisterChild(this.isometrySELineLabel);
    this.parentIsometry.unregisterChild(this.isometrySELine);
    this.preimageSELine.unregisterChild(this.isometrySELine);
  }

  toOpcode(): null | string | Array<string> {
    return [
      "AddIsometryLine",
      // Any attribute that could possibly have a "= or "&" or "/" should be run through Command.symbolToASCIIDec
      // All plottable objects have these attributes
      "objectName=" + Command.symbolToASCIIDec(this.isometrySELine.name),
      "objectExists=" + this.isometrySELine.exists,
      "objectShowing=" + this.isometrySELine.showing,
      "objectFrontStyle=" +
        Command.symbolToASCIIDec(
          JSON.stringify(
            this.isometrySELine.ref.currentStyleState(StyleEditPanels.Front)
          )
        ),
      "objectBackStyle=" +
        Command.symbolToASCIIDec(
          JSON.stringify(
            this.isometrySELine.ref.currentStyleState(StyleEditPanels.Back)
          )
        ),
      // All labels have these attributes
      "labelName=" + Command.symbolToASCIIDec(this.isometrySELineLabel.name),
      "labelStyle=" +
        Command.symbolToASCIIDec(
          JSON.stringify(
            this.isometrySELineLabel.ref.currentStyleState(
              StyleEditPanels.Label
            )
          )
        ),
      "labelVector=" + this.isometrySELineLabel.ref._locationVector.toFixed(7),
      "labelShowing=" + this.isometrySELineLabel.showing,
      "labelExists=" + this.isometrySELineLabel.exists,
      // Object specific attributes
      "isometryLineParentName=" + this.preimageSELine.name,
      "isometryLineParentIsometryName=" + this.parentIsometry.name,
      "isometryLineStartSEPointName=" +
        Command.symbolToASCIIDec(this.isometrySELine.startSEPoint.name),
      "isometryLineEndSEPointName=" +
        Command.symbolToASCIIDec(this.isometrySELine.endSEPoint.name)
    ].join("&");
  }

  static parse(command: string, objMap: Map<string, SENodule>): Command {
    // console.log(command);
    const tokens = command.split("&");
    const propMap = new Map<SavedNames, string>();
    // load the tokens into the map
    tokens.forEach((token, ind) => {
      if (ind === 0) return; // don't put the command type in the propMap
      const parts = token.split("=");
      propMap.set(parts[0] as SavedNames, Command.asciiDecToSymbol(parts[1]));
    });

    // get the object specific attributes
    const parentSELine = objMap.get(
      propMap.get("isometryLineParentName") ?? ""
    ) as SELine | undefined;

    const isometryLineParentIsometry = objMap.get(
      propMap.get("isometryLineParentIsometryName") ?? ""
    ) as SEIsometry | undefined;

    const isometryLineStartPoint = objMap.get(
      propMap.get("isometryLineStartSEPointName") ?? ""
    ) as SETransformedPoint | undefined;

    const isometryLineEndPoint = objMap.get(
      propMap.get("isometryLineEndSEPointName") ?? ""
    ) as SETransformedPoint | undefined;

    if (
      parentSELine &&
      isometryLineParentIsometry &&
      isometryLineEndPoint &&
      isometryLineStartPoint
    ) {
      //make the Line
      const seg = new NonFreeLine();
      const isometrySELine = new SEIsometryLine(
        seg,
        isometryLineStartPoint,
        isometryLineParentIsometry.f(parentSELine.normalVector),
        isometryLineEndPoint,
        parentSELine,
        isometryLineParentIsometry
      );
      //style the Line
      const LineFrontStyleString = propMap.get("objectFrontStyle");
      if (LineFrontStyleString !== undefined)
        seg.updateStyle(
          StyleEditPanels.Front,
          JSON.parse(LineFrontStyleString)
        );
      const LineBackStyleString = propMap.get("objectBackStyle");
      if (LineBackStyleString !== undefined)
        seg.updateStyle(StyleEditPanels.Back, JSON.parse(LineBackStyleString));

      //make the label and set its location
      const label = new Label();
      const isometrySELineLabel = new SELabel(label, isometrySELine);
      const seLabelLocation = new Vector3();
      seLabelLocation.from(propMap.get("labelVector")); // convert to Number
      isometrySELineLabel.locationVector.copy(seLabelLocation);
      //style the label
      const labelStyleString = propMap.get("labelStyle");
      if (labelStyleString !== undefined)
        label.updateStyle(StyleEditPanels.Label, JSON.parse(labelStyleString));

      //put the Line in the object map
      if (propMap.get("objectName") !== undefined) {
        isometrySELine.name = propMap.get("objectName") ?? "";
        isometrySELine.showing = propMap.get("objectShowing") === "true";
        isometrySELine.exists = propMap.get("objectExists") === "true";
        objMap.set(isometrySELine.name, isometrySELine);
      } else {
        throw new Error("AddIsometrySELine: Line Name doesn't exist");
      }

      //put the label in the object map
      if (propMap.get("labelName") !== undefined) {
        isometrySELineLabel.name = propMap.get("labelName") ?? "";
        isometrySELineLabel.showing = propMap.get("labelShowing") === "true";
        isometrySELineLabel.exists = propMap.get("labelExists") === "true";
        objMap.set(isometrySELineLabel.name, isometrySELineLabel);
      } else {
        throw new Error("AddIsometrySELine: Label Name doesn't exist");
      }
      return new AddIsometryLineCommand(
        isometrySELine,
        isometrySELineLabel,
        parentSELine,
        isometryLineParentIsometry
      );
    }
    throw new Error(
      `AddIsometryLine: ${parentSELine} or ${isometryLineParentIsometry} or ${isometryLineStartPoint} or ${isometryLineEndPoint} is undefined`
    );
  }
}
