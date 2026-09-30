# Music credits - round 2, job AU-1 (mus_floor4/5/6, mus_boss4, mus_boss5_a/b/c)

Metadata: `public/assets/audio/music2a.audio.json`. Files: `public/assets/audio/music/`.
Generators (reproducible): `tmp/audio_music2a/` (run with `.venv-art/bin/python`; the two sourced loops need the incompetech mp3s in `src/`).

## Third-party (Kevin MacLeod, incompetech.com) - attribution REQUIRED if kept in the game

License as stated by incompetech.com: **Creative Commons: By Attribution 4.0** (<https://creativecommons.org/licenses/by/4.0/>). Same attribution block as `CREDITS_music.md`:

> "Crusade" Kevin MacLeod (incompetech.com)
> Licensed under Creative Commons: By Attribution 4.0 License
> http://creativecommons.org/licenses/by/4.0/

> "Death and Axes" Kevin MacLeod (incompetech.com)
> Licensed under Creative Commons: By Attribution 4.0 License
> http://creativecommons.org/licenses/by/4.0/

| key | track | source URL | edit |
|---|---|---|---|
| `mus_floor4` | Crusade - Kevin MacLeod (A minor, horns/trombones/war percussion/anvils; catalogue: <https://incompetech.com/music/royalty-free/pieces.json>) | <https://incompetech.com/music/royalty-free/mp3-royaltyfree/Crusade.mp3> | loop of 13.4s-88.05s (28 bars, 4/4, downbeat-aligned) time-stretched 90.0 -> 84 bpm (ffmpeg atempo 0.9331), 2.5 s equal-power tail->head crossfade; 80.0 s. Plus in-project synthesised layers under it: fire-crackle bed and sparse detuned slide-guitar drones on the A-minor pentatonic (about -10 dB rel.) |
| `mus_boss4` | Death and Axes - Kevin MacLeod (A minor, brass/timpani/percussion action cue) | <https://incompetech.com/music/royalty-free/mp3-royaltyfree/Death%20and%20Axes.mp3> | loop of 68.6s-130.3s (36 bars, includes the source's 3-bar phrase-end break) time-stretched 140 -> 132 bpm (atempo 0.9429), 2.0 s equal-power tail->head crossfade; 65.45 s. Plus in-project synthesised stampede-tom gallop layer (about -10 dB rel.) |

## In-project synthesis (no third-party material; original composition and sound design, Python/numpy/scipy)

| key | what | grid | length |
|---|---|---|---|
| `mus_floor5` | Blood Rail: brushed-snare shuffle, rail clack, steam chuff, pizzicato bass, bowed low strings, harmonica, distant bell, night-wind bed; A minor (Am-F-E) | 6/8, dotted-quarter = 100 bpm, 72 bars | 86.4 s |
| `mus_floor6` | Last Chance Saloon: waltz gone wrong. Flat (-24 cents) detuned honky-tonk piano, harpsichord with occasional wrong notes, harmon-muted trumpet (drooping, later a semitone sharp), choir hum, upright bass, brushes, glass clinks; D minor | 3/4, 96 bpm, 48 bars | 90.0 s |
| `mus_boss5_a` | Engine No. 666, P0: steam chug, kick/snare/toms, doom bass ostinato, low strings, steam-whistle stabs; E minor (Em-Em-C-B) | 4/4, 118 bpm, 32 bars | 65.08 s |
| `mus_boss5_b` | P1: `_a` + ghostly choir | 4/4, 132 bpm, 32 bars | 58.18 s |
| `mus_boss5_c` | P2: `_b` + full brass (chords, stabs, riff doubling) and cymbals | 4/4, 148 bpm, 32 bars | 51.89 s |

Licensing: these five files contain no third-party audio; dedicate as CC0 / project-owned. `_a/_b/_c` have the same bar count and arrangement grid (128 beats), so the director can crossfade stems at equal loop-position ratio.

## Processing / verification
- Sourced loops: grid estimated from the source (constant-tempo DAW render), loop points on beat grid at equal chroma/timbre (search in `lf3.py`), stretch, then equal-power crossfade of the audio after the loop end into the head.
- Synthesised loops are rendered on a circular timeline (events and reverb tails past the end wrap to the start), so the seam is continuous by construction (equivalent to a full-length tail crossfade). Master high-pass 45 Hz, loop-safe limiter (rendered on a 3x tiled copy).
- Loudness (ffmpeg ebur128 on the decoded mp3): floors -16.0 LUFS, bosses -15.0 LUFS (static gain), true peak <= -1.4 dBTP. Stereo mp3 `libmp3lame -q:a 4`, 44.1 kHz. Sizes: floor4 2.3 MB, floor5 1.6 MB, floor6 1.4 MB, boss4 1.4 MB, boss5 0.9-1.1 MB (all under the 3 MB cap; `optimize_assets.py` shrinks later).
- Seam test on 3 tiled copies: 2nd-difference at the wrap <= p99.9 of the track body for every file except one channel of `mus_boss5_b` (1.27x, a kick transient at bar 1, inaudible); beat-grid phase identical (+-6 ms) in all three copies.

## Unused candidates downloaded (not shipped)
incompetech: Ignosi, Colossus, Cortosis, Industrial Revolution, Full On, Eternal Terminal, Darkling, Crusade - Heavy Industry (all Kevin MacLeod, CC BY 4.0).
