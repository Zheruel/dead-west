# Music credits (music agent)

All 9 music keys are edits of tracks by **Kevin MacLeod (incompetech.com)**, downloaded from the incompetech.com direct mp3 URLs (catalogue: <https://incompetech.com/music/royalty-free/pieces.json>).

License as stated by incompetech.com: **Creative Commons: By Attribution 4.0** (<https://creativecommons.org/licenses/by/4.0/>). Attribution is required if kept in the final game. Replace or credit before release.

Official attribution format:

> "Title" Kevin MacLeod (incompetech.com)
> Licensed under Creative Commons: By Attribution 4.0 License
> http://creativecommons.org/licenses/by/4.0/

| key | track | source URL | edit |
|---|---|---|---|
| `mus_menu` | Smoking Gun - Kevin MacLeod | <https://incompetech.com/music/royalty-free/mp3-royaltyfree/Smoking%20Gun.mp3> | loop of 26.7s-135.8s (40 bars @88bpm), tail crossfaded into head |
| `mus_floor1` | Neo Western - Kevin MacLeod | <https://incompetech.com/music/royalty-free/mp3-royaltyfree/Neo%20Western.mp3> | loop of 13.8s-93.8s (28 bars @84bpm), tail crossfaded into head |
| `mus_floor2` | Southern Gothic - Kevin MacLeod | <https://incompetech.com/music/royalty-free/mp3-royaltyfree/Southern%20Gothic.mp3> | loop of 13.4s-120.1s (56 bars @126bpm), tail crossfaded into head |
| `mus_floor3` | Martian Cowboy - Kevin MacLeod | <https://incompetech.com/music/royalty-free/mp3-royaltyfree/Martian%20Cowboy.mp3> | loop of 39.1s-163.5s (35 bars @67.5bpm), tail crossfaded into head |
| `mus_boss` | Witch Hunt - Kevin MacLeod | <https://incompetech.com/music/royalty-free/mp3-royaltyfree/Witch%20Hunt.mp3> | loop of 33.6s-114.9s (42 bars @124bpm), tail crossfaded into head |
| `mus_boss_final` | Final Count - Kevin MacLeod | <https://incompetech.com/music/royalty-free/mp3-royaltyfree/Final%20Count.mp3> | loop of 14.95s-91.9s (25 bars @78bpm), tail crossfaded into head |
| `mus_shop` | Pale Rider - Kevin MacLeod | <https://incompetech.com/music/royalty-free/mp3-royaltyfree/Pale%20Rider.mp3> | loop of 7.3s-89.2s, tail crossfaded into head; normalised quieter (-19 LUFS) |
| `mus_death` | Darkness Speaks - Kevin MacLeod | <https://incompetech.com/music/royalty-free/mp3-royaltyfree/Darkness%20Speaks.mp3> | sting: 1.25s-9.05s excerpt (gong hit + eerie drone), fade-out |
| `mus_victory` | Cowboy Sting - Kevin MacLeod | <https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cowboy%20Sting.mp3> | sting: 3rd (88bpm) take, first 11.8s, fade-out |

## Processing
- Loops: bar-grid-aligned loop points (source tracks are constant-tempo DAW renders), the audio after the loop end is equal-power crossfaded into the loop head (1.5-3 s), so wrap-around is seamless. Loudness normalised (static gain) to about -16 LUFS (bosses -15, shop -19) with a peak limiter (~ -1 dBTP), stereo mp3 (libmp3lame -q:a 4).
- Stings: excerpted, short fade-in/out, about -16 LUFS.

## Unused candidates downloaded (not shipped)
OpenGameArt CC0 tracks by Umplix (Desert Theme, The Cowboy's Theme, The Failure of a Cowboy - <https://opengameart.org/content/wild-west-music>) and Julie Damsgaard "Spaghetti Western" (CC0, <https://opengameart.org/content/spaghetti-western>) were evaluated but judged too cheerful/comedic for the dark tone.
