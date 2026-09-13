// Shared timeline. Each scene keeps its original beat and gets +1.5 s of hold.
export const FPS = 30;
export const SPEED = 1;
export const T = { open: 0, race: 2.5, tokens: 6.4, reindex: 9.1, money: 11.8, convert: 15.1, outro: 17.8, end: 20.5 };
/** Moments that get a slam on screen (seconds). */
export const HITS = [0.6, T.race, T.tokens + 0.6, T.reindex + 0.65, T.money, T.convert + 0.55, T.outro];
export const DURATION_SEC = T.end;
export const DURATION_FRAMES = Math.round(DURATION_SEC * FPS);
export const s = (sec: number) => Math.round(sec * SPEED * FPS);
