// Shared timeline. Seven scenes, 3.6 s each: 1.8 s of information on screen, then a 1.8 s slam.
// Nothing that carries a number is visible for less than 1.8 s.
export const FPS = 30;
export const SPEED = 1;
export const SCENE = 3.6;
export const BEAT = 1.8; // seconds into a scene where its slam lands
export const T = { open: 0, race: SCENE, tokens: SCENE * 2, reindex: SCENE * 3, money: SCENE * 4, convert: SCENE * 5, outro: SCENE * 6, end: SCENE * 7 };
export const HITS = [T.open + BEAT, T.race, T.tokens + BEAT, T.reindex + BEAT, T.money, T.convert + BEAT, T.outro];
export const DURATION_SEC = T.end;
export const DURATION_FRAMES = Math.round(DURATION_SEC * FPS);
export const s = (sec: number) => Math.round(sec * SPEED * FPS);
