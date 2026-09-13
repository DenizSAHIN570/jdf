import { AbsoluteFill, Composition } from "remotion";
import { VideoRag, FPS, DURATION_FRAMES } from "./VideoRag";
const HD: React.FC = () => (
  <AbsoluteFill style={{ background: "#05080f" }}>
    <div style={{ position: "absolute", left: 0, top: 0, width: 1280, height: 720, transform: "scale(1.5)", transformOrigin: "top left" }}><VideoRag /></div>
  </AbsoluteFill>
);
export const RemotionRoot: React.FC = () => <Composition id="VideoRag" component={HD} durationInFrames={DURATION_FRAMES} fps={FPS} width={1920} height={1080} />;
