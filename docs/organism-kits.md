# Organism Kits

The Organism must not depend on public reference-track playback or raw sample redistribution.

Install third-party kits into a private runtime folder:

```text
/data/organism-kits/<kit-name>/
```

For local development without a Railway volume:

```text
private/organism-kits/<kit-name>/
```

Set `ORGANISM_KIT_ROOT` to override the path.

The app scans WAV, AIFF, and MP3 files and classifies filenames into roles:

- `kick`
- `snare`
- `hat`
- `perc`
- `tom`
- `bass808`
- `loop`

Keep a `LICENSE.txt` or `README.md` inside each kit folder. Many free kits allow use in music but prohibit redistributing the raw samples, so do not put downloaded kits under `server/Assets` unless the license explicitly allows redistribution.

Good starter sources to verify and install privately:

- 99Sounds 99 Drum Samples I/II: https://99sounds.org/drum-samples/
- MusicRadar SampleRadar processed 808/909: https://www.musicradar.com/music-tech/samples/sampleradar-167-free-processed-808-and-909-samples
- MusicRadar SampleRadar 808 drum samples: https://www.musicradar.com/news/sampleradar-378-free-808-drum-samples
- MusicRadar SampleRadar 808 weight samples: https://www.musicradar.com/news/sampleradar-808-weight-samples-1
- BandLab Sounds exports, if the account/license terms fit the product use
