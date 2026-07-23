/**
 * Last-known playhead position of the lesson video, shared between the Bunny
 * iframe wrapper (writer) and the note form's "current time" checkbox (reader).
 * A module singleton is enough — there is exactly one video per player page,
 * and readers only sample it on user interaction (no re-renders needed).
 */
let currentSeconds = 0;

export function setVideoTime(seconds: number): void {
  currentSeconds = seconds;
}

export function getVideoTime(): number {
  return currentSeconds;
}
