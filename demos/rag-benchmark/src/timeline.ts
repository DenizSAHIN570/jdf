// Shared timeline. Seven scenes, 3.0 s each: 0.9 s build-up, slam, hold.
export const FPS = 30;
export const SPEED = 1;
export const SCENE = 3.0;
export const BEAT = 0.9; // seconds into a scene where its slam lands
export const T = { open: 0, race: SCENE, tokens: SCENE * 2, reindex: SCENE * 3, money: SCENE * 4, convert: SCENE * 5, outro: SCENE * 6, end: SCENE * 7 };
export const HITS = [T.open + BEAT, T.race, T.tokens + BEAT, T.reindex + BEAT, T.money, T.convert + BEAT, T.outro];
export const DURATION_SEC = T.end;
export const DURATION_FRAMES = Math.round(DURATION_SEC * FPS);
export const s = (sec: number) => Math.round(sec * SPEED * FPS);
