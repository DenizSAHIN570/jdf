import { Composition } from "remotion";
import { EditInPlace, FPS, DURATION_FRAMES } from "./EditInPlace";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="EditInPlace"
    component={EditInPlace}
    durationInFrames={DURATION_FRAMES}
    fps={FPS}
    width={1280}
    height={720}
  />
);
