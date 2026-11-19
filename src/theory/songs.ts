// Well-known song openings for each interval, as memory aids. Users can replace them.

export const SONG_REFS: Record<string, { asc: string; desc: string }> = {
  m2: { asc: "Jaws theme", desc: "Für Elise" },
  M2: { asc: "Happy Birthday", desc: "Mary Had a Little Lamb" },
  m3: { asc: "Greensleeves", desc: "Hey Jude" },
  M3: { asc: "When the Saints Go Marching In", desc: "Swing Low, Sweet Chariot" },
  P4: { asc: "Here Comes the Bride", desc: "Eine kleine Nachtmusik" },
  TT: { asc: "The Simpsons theme", desc: "Black Sabbath (riff)" },
  P5: { asc: "Twinkle Twinkle Little Star", desc: "The Flintstones" },
  m6: { asc: "The Entertainer (E → C)", desc: "Love Story (Where Do I Begin)" },
  M6: { asc: "My Bonnie Lies Over the Ocean", desc: "Nobody Knows the Trouble I've Seen" },
  m7: { asc: "Somewhere (West Side Story)", desc: "An American in Paris" },
  M7: { asc: "Take On Me (chorus)", desc: "I Love You (Cole Porter)" },
  P8: { asc: "Somewhere Over the Rainbow", desc: "Willow Weep for Me" },
};

export function songRef(
  id: string,
  dir: "asc" | "desc",
  edits: Record<string, { asc?: string; desc?: string }>,
): string | undefined {
  const own = edits[id]?.[dir];
  if (own !== undefined) return own.trim() || undefined;
  return SONG_REFS[id]?.[dir];
}
