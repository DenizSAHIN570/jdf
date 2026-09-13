// Shared by the composition and the score generator so hits land on the cuts.
export const FPS = 30;
/** 1.15 = the 10-second cut stretched to 11.5 s (user: "1.5 seconds slower"). */
export const SPEED = 1.15;
export const T = { open: 0, race: 1.0, tokens: 3.4, reindex: 4.6, money: 5.8, convert: 7.6, outro: 8.8, end: 10 };
/** Moments that get a slam on screen and a hit in the score (seconds, unscaled). */
export const HITS = [0.6, T.race, T.tokens + 0.6, T.reindex + 0.65, T.money, T.convert + 0.55, T.outro];
export const DURATION_SEC = T.end * SPEED;
export const DURATION_FRAMES = Math.round(DURATION_SEC * FPS);
export const s = (sec: number) => Math.round(sec * SPEED * FPS);
