import { AbsoluteFill, Composition } from "remotion";
import { WebFormFill, FPS, DURATION_FRAMES } from "./WebFormFill";

// Laid out on a 1280×720 canvas, rendered at 1920×1080 by scaling 1.5×.
const WebFormFillHD: React.FC = () => (
  <AbsoluteFill style={{ background: "#e5e7eb" }}>
    <div style={{ position: "absolute", left: 0, top: 0, width: 1280, height: 720, transform: "scale(1.5)", transformOrigin: "top left" }}>
      <WebFormFill />
    </div>
  </AbsoluteFill>
);

export const RemotionRoot: React.FC = () => (
  <Composition id="WebFormFill" component={WebFormFillHD} durationInFrames={DURATION_FRAMES} fps={FPS} width={1920} height={1080} />
);
