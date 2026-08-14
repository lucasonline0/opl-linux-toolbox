import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGameId } from "../utils/game-id";
import { sanitizeGameFilename } from "../utils/sanitize";

test("filename sanitizer collapses excess whitespace without changing safe separators", () => {
  assert.equal(
    sanitizeGameFilename("   Ratchet   --   Clank__Up Your Arsenal   "),
    "Ratchet -- Clank__Up Your Arsenal"
  );
});

test("GAME_ID normalization finds a valid ID inside mixed filename text", () => {
  assert.equal(
    normalizeGameId("God of War II [SCUS-97481] (USA).iso"),
    "SCUS_974.81"
  );
  assert.equal(
    normalizeGameId("backup__sces 539 29__Shadow of the Colossus.zso"),
    "SCES_539.29"
  );
});

test("filename sanitizer preserves long titles instead of silently truncating them", () => {
  const title = `A Very Long PlayStation 2 Game Title ${"Extended Edition ".repeat(8)}`.trim();
  assert.equal(sanitizeGameFilename(title), title);
});

test("filename sanitizer removes forbidden path punctuation and preserves safe title punctuation", () => {
  assert.equal(
    sanitizeGameFilename("Tony Hawk's: Underground / Remix? (Disc 1) & More"),
    "Tony Hawk's Underground Remix (Disc 1) & More"
  );
});

test("already-normalized IDs and filenames remain unchanged", () => {
  assert.equal(normalizeGameId("SCUS_974.81"), "SCUS_974.81");
  assert.equal(
    sanitizeGameFilename("Metal Gear Solid 3 - Subsistence"),
    "Metal Gear Solid 3 - Subsistence"
  );
});
