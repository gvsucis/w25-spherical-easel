import { Command } from "./Command";
import { SENodule } from "@/models/SENodule";
import { SEPoint } from "@/models/SEPoint";
import { SELine } from "@/models/SELine";
import { SECircle } from "@/models/SECircle";
import { SESegment } from "@/models/SESegment";
import { SELabel } from "@/models/SELabel";
import { SEEllipse } from "@/models/SEEllipse";

export class DeleteNoduleCommand extends Command {
  private seNodule: SENodule;
  private parentIds: number[] = [];
  constructor(seNodule: SENodule) {
    super();
    this.seNodule = seNodule;
    this.seNodule.parents.forEach(nodule => {
      this.parentIds.push(nodule.id);
    });
  }

  do(): void {
    // Remove from the Data Structure (DAG)
    // Notice that this make the parents array empty so that is why we stored the parents ids in a separate
    // array for restore state. Also notice that we can *not* do this with
    // this.seNodule.parents.forEach (obj => obj.unregister(this.seNodule))
    // because unregister modifies the parent array and you never want to modify the parent array while in a forEach
    //
    //This command is always called when there are no children of the
    for (let i = 0; i < this.parentIds.length; i++) {
      const nodule = Command.store.getters.getSENoduleById(this.parentIds[i]);
      if (nodule) {
        nodule.unregisterChild(this.seNodule);
      } else {
        throw "Attempted to unregister a child from a non-existent nodule in the DeleteNoduleCommand";
      }
    }
    // Remove from the store and turn off the display
    if (this.seNodule instanceof SEPoint) {
      Command.store.commit.removePoint(this.seNodule.id);
    } else if (this.seNodule instanceof SELine) {
      Command.store.commit.removeLine(this.seNodule.id);
    } else if (this.seNodule instanceof SECircle) {
      Command.store.commit.removeCircle(this.seNodule.id);
    } else if (this.seNodule instanceof SEEllipse) {
      Command.store.commit.removeEllipse(this.seNodule.id);
    } else if (this.seNodule instanceof SESegment) {
      Command.store.commit.removeSegment(this.seNodule.id);
    } else if (this.seNodule instanceof SELabel) {
      Command.store.commit.removeLabel(this.seNodule.id);
    }
  }

  saveState(): void {
    this.lastState = this.seNodule.id;
  }

  restoreState(): void {
    // Add the point to the store and turn on display
    if (this.seNodule instanceof SEPoint) {
      Command.store.commit.addPoint(this.seNodule);
    } else if (this.seNodule instanceof SELine) {
      Command.store.commit.addLine(this.seNodule);
    } else if (this.seNodule instanceof SECircle) {
      Command.store.commit.addCircle(this.seNodule);
    } else if (this.seNodule instanceof SEEllipse) {
      Command.store.commit.addEllipse(this.seNodule);
    } else if (this.seNodule instanceof SESegment) {
      Command.store.commit.addSegment(this.seNodule);
    } else if (this.seNodule instanceof SELabel) {
      Command.store.commit.addLabel(this.seNodule);
    }
    // The parent array of this.seNodule is empty prior to the execution of this loop
    for (let i = 0; i < this.parentIds.length; i++) {
      const nodule = Command.store.getters.getSENoduleById(this.parentIds[i]);
      if (nodule) {
        nodule.registerChild(this.seNodule);
      } else {
        throw "Attempted to register a child to a non-existent nodule in the DeleteNoduleCommand";
      }
    }
  }

  toOpcode(): null | string | Array<string> {
    return null; // Exclude this command from interpretation
  }
}
