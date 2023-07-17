import { h, JSXComponent } from "vue";
import IconBase from "@/components/IconBase.vue";

const iconNames = [
  "earthPoint",
  "angle",
  "angleBisector",
  "antipodalPoint",
  "applyTransformation",
  "appSettings",
  "calculationObject",
  "circle",
  "clearConstruction",
  "constructionsTab",
  "coordinate",
  "copyToClipboard",
  "cycleNodeValueDisplayMode",
  "delete",
  "deleteConstruction",
  "deleteNode",
  "downloadConstruction",
  "ellipse",
  "hide",
  "hideNode",
  "hideNodeLabel",
  "iconFactory",
  "intersect",
  "inversion",
  "line",
  "measuredCircle",
  "measurementObject",
  "measurePolygon",
  "measureTriangle",
  "midpoint",
  "move",
  "notifications",
  "nSectLine",
  "nSectPoint",
  "objectsTab",
  "parametric",
  "perpendicular",
  "point",
  "pointDistance",
  "pointOnObject",
  "pointReflection",
  "polar",
  "redo",
  "reflection",
  "rotate",
  "rotation",
  "segment",
  "segment",
  "segmentLength",
  "select",
  "shareConstruction",
  "showNode",
  "showNodeLabel",
  "slider",
  "stylePanel",
  "tangent",
  "threePointCircle",
  "toggleLabelDisplay",
  "toolsTab",
  "transformedCircle",
  "transformedEllipse",
  "transformedLine",
  "transformedPoint",
  "transformedSegment",
  "translation",
  "undo",
  "zoomFit",
  "zoomIn",
  "zoomOut"
];

const toRecord = (n: Array<string>): Record<string, JSXComponent> => {
  return n.reduce(
    (acc: Record<string, JSXComponent>, curr: string, pos: number) => {
      return {
        ...acc,
        [curr]: () => h(IconBase as any, { iconName: curr })
      };
    },
    {} as Record<string, JSXComponent>
  );
};
export const customIcons = toRecord(iconNames);
