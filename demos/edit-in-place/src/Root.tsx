import { Composition } from "remotion";
import { EditInPlace, FPS, DURATION_FRAMES } from "./EditInPlace";
import { AbsoluteFill } from "remotion";

// The scene is laid out on a 1280×720 canvas; render it at 1920×1080 by
// scaling the whole scene 1.5× — crisp text, same coordinates.
const EditInPlaceHD: React.FC = () => (
  <AbsoluteFill style={{ background: "#f3f4f6" }}>
    <div style={{ position: "absolute", left: 0, top: 0, width: 1280, height: 720, transform: "scale(1.5)", transformOrigin: "top left" }}>
      <EditInPlace />
    </div>
  </AbsoluteFill>
);

export const RemotionRoot: React.FC = () => (
  <Composition
    id="EditInPlace"
    component={EditInPlaceHD}
    durationInFrames={DURATION_FRAMES}
    fps={FPS}
    width={1920}
    height={1080}
  />
);
