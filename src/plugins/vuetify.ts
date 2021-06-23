// import "@mdi/font/css/materialdesignicons.css"
import Vue from "vue";
import Vuetify from "vuetify/lib";

Vue.use(Vuetify);

import colors from "vuetify/es5/util/colors";
import TestIcon1 from "../components/icons/TestIcon1.vue";
import TestIcon2 from "../components/icons/TestIcon2.vue";
import TestIcon3 from "../components/icons/TestIcon3.vue";
import TestIcon4 from "../components/icons/TestIcon4.vue";
import TestIcon5 from "../components/icons/TestIcon5.vue";
import IconBase from "../components/IconBase.vue";
import IconBox from "../assets/icons/IconBox.vue";

/* This allows us to set the global style variables to adjust the look and feel of the 
app from one central place. */
const vuetify = new Vuetify({
  iconfont: "mdiSvg",
  icons: {
    values: {
      point: {
        component: IconBase,
        props: {
          iconName: "Point",
          iconFile: "/icons/iconPointPaths.svg",
          emphasizeTypes: [["point", "front", "back"]]
        }
      },
      line: {
        component: IconBase,
        props: {
          iconName: "Line",
          iconFile: "/icons/iconLinePaths.svg",
          emphasizeTypes: [
            ["line", "front", "back"],
            ["point", "front", "back"]
          ]
        }
      },
      segment: {
        component: IconBase,
        props: {
          iconName: "Segment",
          iconFile: "/icons/iconSegmentPaths.svg",
          emphasizeTypes: [
            ["segment", "front", "back"],
            ["point", "front", "back"]
          ]
        }
      },
      circle: {
        component: IconBase,
        props: {
          iconName: "Circle",
          iconFile: "/icons/iconCirclePaths.svg",
          emphasizeTypes: [
            ["circle", "front", "back"],
            ["point", "front", "back"]
          ]
        }
      },
      antipode: {
        component: IconBase,
        props: {
          iconName: "Antipode",
          iconFile: "/icons/iconAntipodePaths.svg",
          emphasizeTypes: [["point", "front"]]
        }
      },
      perpendicular: {
        component: IconBase,
        props: {
          iconName: "Perpendicular",
          iconFile: "/icons/iconPerpendicularPaths.svg",
          emphasizeTypes: [
            ["point", "front"],
            ["line", "front", "back"]
          ]
        }
      },
      intersection: {
        component: IconBase,
        props: {
          iconName: "Intersection",
          iconFile: "/icons/iconIntersectionPaths.svg",
          emphasizeTypes: [["point", "front"]]
        }
      },
      pointOnObject: {
        component: IconBase,
        props: {
          iconName: "Intersection",
          iconFile: "/icons/iconPointOnObjectPaths.svg",
          emphasizeTypes: [["point", "front"]]
        }
      },
      angle: {
        component: IconBase,
        props: {
          iconName: "Angle",
          iconFile: "/icons/iconAngleMarkerPaths.svg",
          emphasizeTypes: [["angleMarker", "back", "front"]]
        }
      },
      segmentLength: {
        component: IconBase,
        props: {
          iconName: "Segment Length",
          iconFile: "/icons/iconSegmentLengthPaths.svg",
          emphasizeTypes: [["segment", "back", "front"]]
        }
      },
      pointDistance: {
        component: IconBase,
        props: {
          iconName: "Point Distance",
          iconFile: "/icons/iconPointDistancePaths.svg",
          emphasizeTypes: [["point", "front", "back"]]
        }
      },
      ellipse: {
        component: IconBase,
        props: {
          iconName: "Ellipse",
          iconFile: "/icons/iconEllipsePaths.svg",
          emphasizeTypes: [["point", "front", "back"]]
        }
      }
    }
  },
  theme: {
    themes: {
      light: {
        /* TODO: PICK BETTER COLORS!!!!! */
        primary: colors.blue.base,
        secondary: colors.cyan.base,
        //accent: colors.shades.white,
        accent: colors.blue.lighten4,
        error: colors.red.base,
        warning: colors.orange.base,
        info: colors.blue.base,
        success: colors.orange.base,
        background: "#FFFFFF"
      },
      dark: {
        primary: colors.blue.lighten3
      }
    },
    options: {
      /* Enable var(--prop) om CSS */
      customProperties: true
    }
  }
});
export default vuetify;
