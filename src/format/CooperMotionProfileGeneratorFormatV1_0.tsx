import { makeAutoObservable, action } from "mobx";
import { MainApp, getAppStores } from "@core/MainApp";
import { EditableNumberRange, IS_MAC_OS, ValidateNumber, getMacHotKeyString, makeId } from "@core/Util";
import { BentRateApplicationDirection, Path, Segment, Vector } from "@core/Path";
import { UnitOfLength, UnitConverter, Quantity } from "@core/Unit";
import { GeneralConfig, PathConfig, convertFormat, initGeneralConfig } from "./Config";
import { Format, importPDJDataFromTextFile } from "./Format";
import { Exclude, Expose, Type } from "class-transformer";
import { IsBoolean, IsObject, IsPositive, IsString, MinLength, ValidateNested } from "class-validator";
import { PointCalculationResult, getPathPoints, getDiscretePoints, fromDegreeToRadian } from "@core/Calculation";
import { FieldImageOriginType, FieldImageSignatureAndOrigin, getDefaultBuiltInFieldImage } from "@core/Asset";
import { UpdateProperties } from "@core/Command";
import { ObserverInput } from "@app/component.blocks/ObserverInput";
import { Box, Button, Typography } from "@mui/material";
import { euclideanRotation } from "@core/Coordinate";
import { CodePointBuffer, Int } from "../token/Tokens";
import { observer } from "mobx-react-lite";
import { enqueueErrorSnackbar, enqueueSuccessSnackbar } from "@app/Notice";
import { Logger } from "@core/Logger";
import { FormTags } from "react-hotkeys-hook/dist/types";
import { useCustomHotkeys } from "@core/Hook";
import { ObserverCheckbox } from "@app/component.blocks/ObserverCheckbox";
const logger = Logger("Cooper Motion Profile Code Gen v1.0 (inch)");

const GeneralConfigPanel = observer((props: { config: GeneralConfigImpl }) => {
  const { config } = props;

  const { app, confirmation, modals } = getAppStores();

  const isUsingEditor = !confirmation.isOpen && !modals.isOpen;

  const ENABLE_ON_NON_TEXT_INPUT_FIELDS = {
    preventDefaultOnlyIfEnabled: true,
    enableOnFormTags: ["input", "INPUT"] as FormTags[],
    // UX: It is okay to enable hotkeys on some input fields (e.g. checkbox, button, range)
    enabled: (kvEvt: KeyboardEvent) => {
      if (isUsingEditor === false) return false;
      if (kvEvt.target instanceof HTMLInputElement)
        return ["button", "checkbox", "radio", "range", "reset", "submit"].includes(kvEvt.target.type);
      else return true;
    }
  };

  const onCopyCode = action(() => {
    try {
      const code = config.format.exportCode();

      navigator.clipboard.writeText(code);

      enqueueSuccessSnackbar(logger, "Copied");
    } catch (e) {
      enqueueErrorSnackbar(logger, e);
    }
  });

  useCustomHotkeys("Shift+Mod+C", onCopyCode, ENABLE_ON_NON_TEXT_INPUT_FIELDS);

  const hotkey = IS_MAC_OS ? getMacHotKeyString("Shift+Mod+C") : "Shift+Ctrl+C";

  return (
    <>
      <Box className="Panel-Box">
        <Typography sx={{ marginTop: "16px" }}>Export Settings</Typography>
        <Box className="Panel-FlexBox">
          <ObserverInput
            label="Chassis Name"
            getValue={() => config.chassisName}
            setValue={(value: string) => {
              app.history.execute(`Change chassis variable name`, new UpdateProperties(config, { chassisName: value }));
            }}
            isValidIntermediate={() => true}
            isValidValue={(candidate: string) => candidate !== ""}
            sx={{ marginTop: "16px" }}
          />
          <ObserverInput
            label="Movement Timeout"
            getValue={() => config.movementTimeout.toString()}
            setValue={(value: string) => {
              const parsedValue = parseInt(Int.parse(new CodePointBuffer(value))!.value);
              app.history.execute(
                `Change default movement timeout to ${parsedValue}`,
                new UpdateProperties(config, { movementTimeout: parsedValue })
              );
            }}
            isValidIntermediate={() => true}
            isValidValue={(candidate: string) => Int.parse(new CodePointBuffer(candidate)) !== null}
            sx={{ marginTop: "16px" }}
            numeric
          />
        </Box>
        <Box className="Panel-FlexBox">
          <ObserverCheckbox
            label="Use Relative Coordinates"
            checked={config.relativeCoords}
            onCheckedChange={value => {
              app.history.execute(
                `Set using relative coordinates to ${value}`,
                new UpdateProperties(config, { relativeCoords: value })
              );
            }}
          />
        </Box>
        <Box className="Panel-FlexBox" sx={{ marginTop: "32px" }}>
          <Button variant="contained" title={`Copy Generated Code (${hotkey})`} onClick={onCopyCode}>
            Copy Code
          </Button>
        </Box>
      </Box>
    </>
  );
});

// observable class
class GeneralConfigImpl implements GeneralConfig {
  @IsPositive()
  @Expose()
  robotWidth: number = 12;
  @IsPositive()
  @Expose()
  robotHeight: number = 12;
  @IsBoolean()
  @Expose()
  robotIsHolonomic: boolean = false;
  @IsBoolean()
  @Expose()
  showRobot: boolean = false;
  @ValidateNumber(num => num > 0 && num <= 1000) // Don't use IsEnum
  @Expose()
  uol: UnitOfLength = UnitOfLength.Inch;
  @IsPositive()
  @Expose()
  pointDensity: number = 2; // inches
  @IsPositive()
  @Expose()
  controlMagnetDistance: number = 5 / 2.54;
  @Type(() => FieldImageSignatureAndOrigin)
  @ValidateNested()
  @IsObject()
  @Expose()
  fieldImage: FieldImageSignatureAndOrigin<FieldImageOriginType> =
    getDefaultBuiltInFieldImage().getSignatureAndOrigin();
  @IsString()
  @MinLength(1)
  @Expose()
  chassisName: string = "chassis";
  @ValidateNumber(num => num >= 0)
  @Expose()
  movementTimeout: number = 5000;
  @IsBoolean()
  @Expose()
  relativeCoords: boolean = true;
  @Exclude()
  private format_: CooperMotionProfileGeneratorFormatV1_0;

  constructor(format: CooperMotionProfileGeneratorFormatV1_0) {
    this.format_ = format;
    makeAutoObservable(this);

    initGeneralConfig(this);
  }

  get format() {
    return this.format_;
  }

  getConfigPanel() {
    return <GeneralConfigPanel config={this} />;
  }
}

// observable class
class PathConfigImpl implements PathConfig {
  @Exclude()
  speedLimit: EditableNumberRange = {
    minLimit: { value: 0, label: "" },
    maxLimit: { value: 0, label: "" },
    step: 0,
    from: 0,
    to: 0
  };
  @Exclude()
  bentRateApplicableRange: EditableNumberRange = {
    minLimit: { value: 0, label: "" },
    maxLimit: { value: 0, label: "" },
    step: 0,
    from: 0,
    to: 0
  };
  @Exclude()
  bentRateApplicationDirection = BentRateApplicationDirection.HighToLow;

  @Exclude()
  readonly format: CooperMotionProfileGeneratorFormatV1_0;

  @Exclude()
  public path!: Path;

  constructor(format: CooperMotionProfileGeneratorFormatV1_0) {
    this.format = format;
    makeAutoObservable(this);
  }

  getConfigPanel() {
    return (
      <>
        <Typography>(No setting)</Typography>
      </>
    );
  }
}

// observable class
export class CooperMotionProfileGeneratorFormatV1_0 implements Format {
  isInit: boolean = false;
  uid: string;

  private gc = new GeneralConfigImpl(this);

  constructor() {
    this.uid = makeId(10);
    makeAutoObservable(this);
  }

  createNewInstance(): Format {
    return new CooperMotionProfileGeneratorFormatV1_0();
  }

  getName(): string {
    return "Cooper Motion Profile Code Gen v1.0 (inch)";
  }

  register(app: MainApp): void {
    if (this.isInit) return;
    this.isInit = true;
  }

  unregister(app: MainApp): void {}

  getGeneralConfig(): GeneralConfig {
    return this.gc;
  }

  createPath(...segments: Segment[]): Path {
    return new Path(new PathConfigImpl(this), ...segments);
  }

  getPathPoints(path: Path): PointCalculationResult {
    const result = getPathPoints(path, new Quantity(this.gc.pointDensity, this.gc.uol));
    return result;
  }

  convertFromFormat(oldFormat: Format, oldPaths: Path[]): Path[] {
    return convertFormat(this, oldFormat, oldPaths);
  }

  importPathsFromFile(buffer: ArrayBuffer): Path[] {
    throw new Error("Unable to import paths from this format, try other formats?");
  }

  exportCode(): string {
    const { app } = getAppStores();

    let rtn = "";
    const gc = app.gc as GeneralConfigImpl;

    const path = app.interestedPath();
    if (path === undefined) throw new Error("No path to export");
    if (path.segments.length === 0) throw new Error("No segment to export");

    const uc = new UnitConverter(this.gc.uol, UnitOfLength.Inch);
    const segments = path.segments;
    rtn = `${gc.chassisName}.followPath(new mpLib::Spline({`;
    if (segments.length > 0) {
      for (const segment of segments) {
        console.log(segment.controls);
        rtn += "new mpLib::CubicBezier(";
        for (const control of segment.controls) {
          rtn += `{${uc.fromAtoB(control.x).toUser()}, ${uc.fromAtoB(control.y).toUser()}}, `;
        }
        rtn = rtn.slice(0, -2);
        rtn += "), ";
      }
      rtn = rtn.slice(0, -2);
      rtn += "}));";
    }

    return rtn;
  }

  importPDJDataFromFile(buffer: ArrayBuffer): Record<string, any> | undefined {
    return importPDJDataFromTextFile(buffer);
  }

  exportFile(): ArrayBuffer {
    const { app } = getAppStores();

    let fileContent = this.exportCode();

    fileContent += "\n";

    fileContent += "#PATH.JERRYIO-DATA " + JSON.stringify(app.exportPDJData());

    return new TextEncoder().encode(fileContent);
  }
}
