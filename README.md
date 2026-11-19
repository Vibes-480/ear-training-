# Ear Trainer

A personal ear-training web app. See [SPEC.md](SPEC.md) for the full feature plan and build stages.

## What works now (stage 1)

- **Drills:** intervals (simple and compound; ascending, descending, harmonic), chords (triads, 7ths, extended, all inversions, block or arpeggiated), scales and modes, and note naming.
- **Answer with buttons or the piano.** On a computer, keys `A W S E D F T G Y H U J K` play the piano and `Z` / `X` change octave.
- **Shortcuts:** `Space` replays, `1`–`9` picks an answer, `Enter` checks or moves to the next question.
- **After each answer:** the notes are shown spelled correctly for the key, and **Hear yours** plays the answer you chose so you can compare it with the right one.
- **Settings you can turn on or off:** random key, random register, a different instrument each question, focus on weak spots, auto-advance.
- **Progress:** accuracy, answer time and what each item is most often confused with, plus a day streak and backup or restore to a file.

Progress is stored in the browser for now. Cloud sync arrives in stage 6.

## Development

```bash
npm install
npm run dev       # start the dev server
npm test          # unit tests
npm run build     # type-check and build to dist/
```

Instrument samples are streamed by [smplr](https://github.com/danigb/smplr) and cached in the browser. If they can't load, a built-in synth plays instead.

## Deploying to Vercel

1. Go to vercel.com, choose **Add New → Project**, and import this GitHub repository.
2. Vercel reads `vercel.json` (Vite, output `dist/`, single-page routing), so no settings are needed. Click **Deploy**.
3. Every push to a branch gets its own preview link, and pushes to the main branch update the live site.
