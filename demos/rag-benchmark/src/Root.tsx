import { AbsoluteFill, Composition } from "remotion";
import { RagBenchmark, FPS, DURATION_FRAMES } from "./RagBenchmark";

// Laid out on a 1280×720 canvas, rendered at 1920×1080 by scaling 1.5× (same as the other demos).
const RagBenchmarkHD: React.FC = () => (
  <AbsoluteFill style={{ background: "#0b1220" }}>
    <div style={{ position: "absolute", left: 0, top: 0, width: 1280, height: 720, transform: "scale(1.5)", transformOrigin: "top left" }}>
      <RagBenchmark />
    </div>
  </AbsoluteFill>
);

export const RemotionRoot: React.FC = () => (
  <Composition id="RagBenchmark" component={RagBenchmarkHD} durationInFrames={DURATION_FRAMES} fps={FPS} width={1920} height={1080} />
);
