# Ear Trainer

A personal ear-training web app covering intervals, chords, harmony, singing, dictation and transcription. See [SPEC.md](SPEC.md) for the original plan. All seven build stages are done.

## What's in it

**Practice**
- **Daily session:** a spaced-repetition mix of reviews that are due, new items and weak spots, across all the drills you choose.
- **Levels:** 28 levels in 4 units, from first intervals to chord tones with extensions. Each one unlocks when you pass the one before.
- **Genre packs:** ready-made drills for Jazz (shell and rootless voicings, ii–V–I, jazz scales), Gospel, Pop, Modal, Classical and Blues.
- **Presets:** save your own drill options and start them in one tap from the home page.

**Drills**
- **Intervals:** simple and compound, played ascending, descending or harmonic.
- **Chords:** triads, 7ths and extensions in every inversion, with close, drop-2, shell or rootless voicings.
- **Scales and modes:** the modes, the minor family and symmetric scales.
- **Note naming:** with a reference note, or without one for absolute-pitch practice.
- **Progressions:** Roman numerals in major and minor, including borrowed and secondary chords, or name the cadence.
- **Scale degrees:** functional hearing after a cadence, in melody or bass.
- **Chord tones:** name the note over each chord of a 4-bar backing track.
- **Tuning:** an adaptive flat/sharp test that goes down to a few cents.

**Voice:** a voice-range check, singing exercises (match notes, sing intervals, sight-sing from a staff) with a live pitch meter, and singing as an answer method in the drills.

**Dictation:** melodies entered on the piano or with degree buttons and shown on a staff in the key signature. Rhythms are written with notation blocks or tapped back in time.

**Transcribe:** slow down and loop audio files or YouTube videos. Includes a waveform with A–B loops, an octave-down trick for fast passages, a piano and a hum-to-find-the-note meter.

**Answering and feedback**
- Answer with buttons, the on-screen piano (computer keys `A W S E D F T G Y H U J K`; `Z` and `X` change octave) or by singing.
- After each answer, **Hear yours** plays what you chose, notes are spelled correctly for the key, the answer is shown on a staff, and intervals come with song references.
- Settings you can turn on or off: random key, random register, a cadence or drone before each question, song references and a different instrument per question.

**Progress:** a practice calendar, accuracy and answer-time trends, a confusion grid ("what you hear it as"), the weakest items first, streaks and a daily goal.

**Your data:** progress lives on your device and can be backed up to a file. Sign in to sync it across devices.

## Shortcuts

| Where | Keys |
|---|---|
| Drills | `Space` replay · `1`–`9` answer · `Enter` check / next |
| Dictation | `Space` replay melody (or tap, in tap mode) · `Backspace` undo · `Enter` check / next |
| Transcribe | `Space` play/pause · `←` `→` ±5 s (`Shift` ±1 s) · `[` `]` set A/B · `L` loop |

## Development

```bash
npm install
npm run dev       # start the dev server
npm test          # unit tests
npm run build     # type-check and build to dist/
```

Instrument samples are streamed by [smplr](https://github.com/danigb/smplr) and cached in the browser, with a built-in synth as fallback. Staff notation uses [VexFlow](https://www.vexflow.com/), which loads only when a staff is shown.

## Deploying (Vercel)

Pushing to `main` deploys automatically. `vercel.json` sets the build and single-page routing.

## Cloud sync (Supabase)

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in its SQL Editor.
2. Under **Authentication → URL Configuration**, set **Site URL** to your Vercel address and add `https://*.vercel.app/**` to **Redirect URLs**.
3. In Vercel, add the environment variables `VITE_SUPABASE_URL` (the Project URL) and `VITE_SUPABASE_ANON_KEY` (the publishable or anon key, **never** the secret key), then redeploy.

Without these variables the app works fully offline-first, on one device. With them, a **Sign in** card appears in Settings. Sign-in uses an email link, and progress from every device is merged without losing practice.
