import type { Question } from "../drills/types";
import { getSettings } from "../store/settings";
import { songRef } from "../theory/songs";

/** Feedback extra: the song reference for the interval that was played. */
export function renderSongRefs(q: Question) {
  const s = getSettings();
  if (!s.songRefs || q.drill !== "intervals") return null;
  const id = q.parts[0].answer;
  const dir = q.meta?.direction;
  const refs =
    dir === "harm"
      ? [songRef(id, "asc", s.songRefEdits)].filter(Boolean)
      : [songRef(id, dir === "desc" ? "desc" : "asc", s.songRefEdits)].filter(Boolean);
  if (!refs.length) return null;
  return (
    <p className="song-ref">
      <span aria-hidden>♪</span> Sounds like the start of <strong>{refs[0]}</strong>
      {dir === "harm" && <span className="muted"> (played upward)</span>}
    </p>
  );
}
