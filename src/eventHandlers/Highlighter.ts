import MouseHandler from "./MouseHandler";
import { SEPoint } from "@/models/SEPoint";
import { LAYER } from "@/global-settings";
import { SEIntersectionPoint } from "@/models/SEIntersectionPoint";
import { SENodule } from "@/models/SENodule";
import { SELine } from "@/models/SELine";
import { SELabel } from "@/models/SELabel";
import { SESegment } from "@/models/SESegment";
import { SECircle } from "@/models/SECircle";
import AppStore from "@/store";

export default abstract class Highlighter extends MouseHandler {
  abstract mousePressed(event: MouseEvent): void;
  abstract mouseReleased(event: MouseEvent): void;
  /**
   * The Vuex store
   */
  protected static store = AppStore;
  /**
   * Provides an array of nearby objects (in hitPoints, hitLines,... ) and highlights them
   * @param event Mouse Event
   */
  mouseMoved(event: MouseEvent): void {
    super.mouseMoved(event);
    if (!this.isOnSphere) return;
    // Set the display to normal for all previously nearby objects
    this.hitSENodules.forEach((n: SENodule) => {
      if (!n.selected) n.glowing = false;
    });

    // Clear the arrays of previously nearby nodules and hide any displayed info boxes
    this.hitSEPoints.clear();
    this.hitSELines.clear();
    this.hitSESegments.clear();
    this.hitSECircles.clear();
    this.hitSELabels.clear();
    this.infoText.hide();

    // Create an array of SENodules of all nearby objects by querying the store
    this.hitSENodules = this.store.getters
      .findNearbySENodules(this.currentSphereVector, this.currentScreenVector)
      .filter((n: SENodule) => {
        if (n instanceof SEIntersectionPoint) {
          if (!n.isUserCreated) {
            return n.exists; //You always select automatically created intersection points if it exists
          } else {
            return n.showing && n.exists; //You can't select hidden objects or items that don't exist
          }
        } else {
          return n.showing && n.exists; //You can't select hidden objects or items that don't exist
        }
      });

    // Make NONE of the nearby objects by glow -- it is the job of the handler (active tool) to turn on
    // the glow of objects that the tool can interact with
    // this.hitSENodules.forEach((obj: SENodule) => {
    //   obj.glowing = true;
    // });

    // From the array of SENodules pull out the different types
    this.hitSEPoints = this.hitSENodules
      .filter((obj: SENodule) => obj instanceof SEPoint)
      .map(obj => obj as SEPoint);

    this.hitSELines = this.hitSENodules
      .filter(obj => obj instanceof SELine)
      .map(obj => obj as SELine);

    this.hitSESegments = this.hitSENodules
      .filter(obj => obj instanceof SESegment)
      .map(obj => obj as SESegment);

    this.hitSECircles = this.hitSENodules
      .filter(obj => obj instanceof SECircle)
      .map(obj => obj as SECircle);

    this.hitSELabels = this.hitSENodules
      .filter(obj => obj instanceof SELabel)
      .map(obj => obj as SELabel);

    // Pull the name field from all these objects into one array of strings
    const text = [
      ...this.hitSEPoints,
      ...this.hitSELines,
      ...this.hitSESegments,
      ...this.hitSECircles
    ]
      .map(n => n.name)
      .join(", ");

    if (text.length > 0) {
      // Show the names temporarily
      this.infoText.showWithDelay(this.layers[LAYER.foregroundText], 300);
      // Textbox is set to handle a ???? How does this work????
      this.infoText.text = text;
      this.infoText.translation.set(
        this.currentScreenVector.x,
        -this.currentScreenVector.y + 16
      );
    }
  }

  activate(): void {
    this.store.getters.selectedSENodules().forEach((obj: SENodule) => {
      obj.selected = false;
    });
    // Clear the selected objects array
    this.store.commit.setSelectedSENodules([]);
  }
}
