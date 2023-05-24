import { makeAutoObservable } from "mobx"
import { MainApp } from '../app/MainApp';
import { makeId } from "../app/Util";
import { Vertex } from "../math/path";
import { UnitOfLength, UnitConverter } from "../math/unit";
import { GeneralConfig, OutputConfig, SpeedConfig } from "./config";
import { Format } from "./format";
import { Box, Typography } from "@mui/material";
import { NumberRange, RangeSlider } from "../app/RangeSlider";

// observable class
class GeneralConfigImpl implements GeneralConfig {
  robotWidth: number = 12;
  robotHeight: number = 12;
  showRobot: boolean = true;
  uol: UnitOfLength = UnitOfLength.Inch;
  knotDensity: number = 2; // inches
  controlMagnetDistance: number = 5 / 2.54;

  constructor() {
    makeAutoObservable(this);
  }

  getConfigPanel() {
    return <></>
  }
}

// observable class
class SpeedConfigImpl implements SpeedConfig {
  speedLimit: NumberRange = {
    minLimit: { value: 0, label: "0" },
    maxLimit: { value: 127, label: "127" },
    step: 1,
    from: 20,
    to: 100,
  };
  applicationRange: NumberRange = {
    minLimit: { value: 0, label: "0" },
    maxLimit: { value: 4, label: "4" },
    step: 0.01,
    from: 1.4,
    to: 1.8,
  };
  transitionRange: NumberRange = {
    minLimit: { value: 0, label: "0" },
    maxLimit: { value: 1, label: "1" },
    step: 0.01,
    from: 0,
    to: 0.95,
  };

  constructor() {
    makeAutoObservable(this);
  }

  getConfigPanel() {
    return (
      <>
        <Box className="panel-box">
          <Typography>Min/Max Speed</Typography>
          <RangeSlider range={this.speedLimit} />
        </Box>
        <Box className="panel-box">
          <Typography>Curve Deceleration Range</Typography>
          <RangeSlider range={this.applicationRange} />
        </Box>
        <Box className="panel-box">
          <Typography>Acceleration/Deceleration</Typography>
          <RangeSlider range={this.transitionRange} inverted />
        </Box>
      </>
    )
  }
}

// observable class
class OutputConfigImpl implements OutputConfig {

  constructor() {
    makeAutoObservable(this);
  }

  getConfigPanel() {
    return <></>
  }
}

export class LemLibFormatV0_4 implements Format {
  isInit: boolean = false;
  uid: string;

  constructor() {
    this.uid = makeId(10);
  }

  getName(): string {
    return "LemLib v0.4.x (inch, byte-voltage)";
  }

  init(): void {
    if (this.isInit) return;
    this.isInit = true;
  }

  buildGeneralConfig(): GeneralConfig {
    return new GeneralConfigImpl();
  }

  buildSpeedConfig(): SpeedConfig {
    return new SpeedConfigImpl();
  }

  buildOutputConfig(): OutputConfig {
    return new OutputConfigImpl();
  }

  exportPathFile(app: MainApp): string | undefined {
    // ALGO: The implementation is adopted from https://github.com/LemLib/Path-Gen under the GPLv3 license.

    let rtn = "";

    if (app.paths.length === 0) return;

    const path = app.paths[0]; // TODO use selected path
    if (path.splines.length === 0) return;

    const uc = new UnitConverter(app.gc.uol, UnitOfLength.Inch);

    const knots = path.calculateKnots(app.gc, app.sc);
    for (const knot of knots) {
      // ALGO: heading is not supported in LemLib V0.4 format.
      rtn += `${uc.fromAtoB(knot.x)}, ${uc.fromAtoB(knot.y)}, ${uc.fixPrecision(knot.speed)}\n`;
    }

    if (knots.length > 1) {
      /*
      Here is the original code of how the ghost knot is calculated:

      ```cpp
      // create a "ghost point" at the end of the path to make stopping nicer
      const lastPoint = path.points[path.points.length-1];
      const lastControl = path.splines[path.splines.length-1].p2;
      const ghostPoint = Vector.interpolate(Vector.distance(lastControl, lastPoint) + 20, lastControl, lastPoint);
      ```

      Notice that the variable "lastControl" is not the last control point, but the second last control point.
      This implementation is different from the original implementation by using the last knot and the second last knot.
      */
      const last2 = knots[knots.length - 2]; // second last knot, last knot by the calculation
      const last1 = knots[knots.length - 1]; // last knot, also the last control point
      // ALGO: The 20 inches constant is a constant value in the original LemLib-Path-Gen implementation.
      const ghostKnot = last2.interpolate(last1, last2.distance(last1) + uc.fromBtoA(20));
      rtn += `${uc.fromAtoB(ghostKnot.x)}, ${uc.fromAtoB(ghostKnot.y)}, 0\n`;
    }

    rtn += `endData\n`;
    rtn += `200\n`; // Not supported
    rtn += `${app.sc.speedLimit.to}\n`;
    rtn += `200\n`; // Not supported

    function output(control: Vertex, postfix: string = ", ") {
      rtn += `${uc.fromAtoB(control.x)}, ${uc.fromAtoB(control.y)}${postfix}`;
    }

    for (const spline of path.splines) {
      if (spline.controls.length === 4) {
        output(spline.controls[0]);
        output(spline.controls[1]);
        output(spline.controls[2]);
        output(spline.controls[3], "\n");
      } else if (spline.controls.length === 2) {
        const center = spline.controls[0].add(spline.controls[1]).divide(new Vertex(2, 2));
        output(spline.controls[0]);
        output(center);
        output(center);
        output(spline.controls[1], "\n");
      }
    }

    rtn += "#PATH.JERRYIO-DATA " + JSON.stringify(app.exportAppData());

    return rtn;
  }
}