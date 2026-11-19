# Ear Trainer: spec

A personal ear trainer covering everything needed to develop strong relative pitch, harmonic hearing and transcription skills.

## Decisions

| Topic | Choice |
|---|---|
| Platform | Web app for phone and desktop |
| Hosting | Vercel |
| Accounts and sync | Supabase (login + cloud progress sync), plus export and backup |
| Level | Intermediate, with difficulty adjusting separately for each skill |
| Design | Clean and minimal, light and dark mode, big tap targets |
| Answer input | On-screen buttons, on-screen piano (also playable from the computer keyboard), singing into the mic |
| Notation | Letter names, scale degrees and Roman numerals, staff notation |
| Voice range | Auto-detected on first use |

## Training areas

1. **Intervals and pitch:** melodic (up and down) and harmonic intervals, compound intervals, single-note naming with or without a reference.
2. **Chords and scales:** triads, 7th and extended chords, inversions and voicings, scales and modes.
3. **Progressions and harmony:** Roman-numeral progressions, cadences, bass lines, functional ear training (each note as a scale degree in a key).
4. **Chord tones over a backing track:** a looping progression plays and you name what a single note is over the current chord (root, 3rd, 5th, 7th, then extensions).
5. **Melody and rhythm dictation:** entered on a staff.
6. **Sight-singing:** sing into the mic with live pitch display.
7. **Tuning drills:** detect notes a few cents sharp or flat.
8. **Transcribing from audio:** load a song, slow it down without changing pitch, loop sections. YouTube can be embedded with speed and loop controls, but its audio can't be analyzed.
9. **Genre packs:** jazz voicings, gospel, pop progressions, modal harmony.

## Practice modes

- **Smart daily session:** a 10–20 minute mix built from spaced repetition, weighted toward weak spots.
- **Free practice:** any drill, fully configurable.
- **Curriculum:** levels that unlock in order.
- **Presets:** saved drill setups, one tap to run.

## Sound and realism

- Real instrument samples (piano, electric piano, guitar, strings, vibraphone), with an optional per-question instrument change.
- Options you can turn on or off:
  - random key and random register for each question
  - real-music context (a drone or cadence before each question)
  - song references for intervals (editable)

## Progress

- A confusion grid showing what you mix up with what
- Accuracy and reaction-time charts for each item over time
- Streaks, daily goals and a practice calendar
- Export and backup

## Build stages

1. **Core** ✅: app shell, sound engine, interval, chord, scale and note-naming drills, on-screen piano and keyboard input, local progress, basic stats, backup and restore.
2. **Daily session and stats** ✅: spaced-repetition daily session, confusion grid, charts, presets, streak goals and calendar.
3. **Harmony:** progressions, functional training, chord tones over a backing track, drone and cadence context, song references.
4. **Voice:** mic pitch detection, voice-range detection, sight-singing, tuning drills.
5. **Dictation:** melody and rhythm on a staff.
6. **Accounts:** Supabase login and cloud sync.
7. **Extras:** curriculum, genre packs, transcription tool.
