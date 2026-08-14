# Artwork troubleshooting and recovery

OPL Linux Toolbox stores game artwork in the library's `ART/` directory. Normal PS2 artwork is named with the normalized Game ID followed by the artwork type, for example:

```text
ART/
├── SCUS_974.81_COV.png
├── SCUS_974.81_BG_00.png
├── SCUS_974.81_LGO.png
└── SCUS_974.81_SCR_01.png
```

The artwork downloader only accepts image assets associated with a valid normalized Game ID and validates downloaded PNG/JPEG data before committing it to the library.

## Artwork is missing for a valid Game ID

1. Confirm the game has a normalized ID such as `SCUS_974.81`.
2. Open the game's artwork action and refresh the available artwork.
3. Select the desired types and run the artwork job again.
4. If the remote database reports no assets, the game currently has no matching artwork in that source. A local image can still be imported manually.

Artwork discovery is cached for up to 24 hours. If you know the remote database changed recently, use the application's artwork cache-clear action and retry instead of deleting library files.

## A download failed or an image is invalid

Remote downloads are written to a hidden `.<filename>.part` temporary file first. The app validates the image, flushes it, and only then renames it to the final artwork name. A failed download removes its temporary file, so an interrupted transfer should not replace a working final image.

If an already-existing final image is visibly corrupt, repair only that asset:

1. Make a backup of the specific bad file if you want to preserve it.
2. Run the artwork action for the same game and type.
3. When the app reports that artwork already exists, explicitly choose overwrite for the damaged file.

Avoid deleting the entire `ART/` directory to fix one game.

## Existing artwork should not be overwritten

The normal artwork workflow checks the target filenames before downloading. Use **skip existing** when you want the job to download only missing selected types. If overwrite confirmation is shown, decline it to leave the existing files untouched.

When every selected type already exists and **skip existing** is enabled, the job completes without downloading anything.

## Retry artwork repair

For a clean retry:

1. Clear the artwork discovery cache from the application's artwork tools if discovery appears stale.
2. Reopen the artwork action for the game.
3. Select only the missing or damaged types.
4. Use **skip existing** to preserve known-good images, or explicitly confirm overwrite only for assets you intend to replace.

The downloader uses HTTPS, timeouts and retry attempts. Re-running the job is safe when a temporary network/API failure caused the previous attempt to fail.

## Manual artwork import

The manual import action accepts PNG/JPG/JPEG files. The selected image is validated before copying, and the copy is SHA-256 verified. If its filename does not already start with the game's normalized ID, the app prefixes that ID automatically.

For predictable OPL matching, prefer standard names such as:

```text
<GAME_ID>_COV.png
<GAME_ID>_BG_00.png
<GAME_ID>_LGO.png
<GAME_ID>_SCR_01.png
```

## Recovery rules

- Repair one game's files rather than clearing the whole artwork library.
- Preserve working files with **skip existing**.
- Do not promote `.part` files to final artwork manually.
- Do not use a different Game ID merely to force a download; fix the game's detected ID instead.
- If a download repeatedly fails but discovery succeeds, check the application logs for the exact HTTP/image-validation error before modifying files.
