import { Component, OnInit } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { LibraryService } from '../../shared/services/library.service';
import { JobsService } from '../../shared/services/jobs.service';
import { Game } from '../../shared/types/game.type';
import { gameArt } from '../../shared/types/game.type';

interface ArtRow {
  game: Game;
  remote?: { type: string; fileName: string; downloadUrl: string }[];
  state: 'Local' | 'Available' | 'Missing source' | 'Not checked' | 'Error';
  error?: string;
}

@Component({
  selector: 'app-artwork',
  imports: [LucideAngularModule],
  templateUrl: './artwork.component.html',
  styleUrl: './artwork.component.scss',
})
export class ArtworkComponent implements OnInit {
  rows: ArtRow[] = [];
  checking = false;
  attentionOnly = false;
  lastMessage = '';

  constructor(public library: LibraryService, private jobs: JobsService) {}

  get localCount() { return this.rows.reduce((total, row) => total + (row.game.art?.length || 0), 0); }
  get checkedCount() { return this.rows.filter((row) => !!row.remote).length; }
  get completeCount() { return this.rows.filter((row) => row.state === 'Local').length; }
  get needsRepairCount() { return this.rows.filter((row) => row.state === 'Available' || row.state === 'Error').length; }
  get missingAssetCount() { return this.rows.reduce((total, row) => total + this.missing(row).length, 0); }
  get visibleRows() {
    if (!this.attentionOnly) return this.rows;
    return this.rows.filter((row) => row.state !== 'Local' && row.state !== 'Missing source');
  }

  cover(row: ArtRow): gameArt | undefined {
    return row.game.art?.find((art) => art.type.toUpperCase() === 'COV')
      || row.game.art?.find((art) => art.type.toUpperCase() === 'COV2')
      || row.game.art?.[0];
  }

  artUrl(art: gameArt) {
    return art.url || `data:image/${art.extension.replace('.', '') || 'png'};base64,${art.base64}`;
  }

  visibleAssets(row: ArtRow) { return (row.remote || []).slice(0, 5); }

  stateLabel(row: ArtRow) {
    return row.state === 'Local' ? 'Complete'
      : row.state === 'Available' ? 'Missing assets'
      : row.state === 'Missing source' ? 'Source empty'
      : row.state === 'Not checked' ? 'Not checked'
      : 'Error';
  }

  ngOnInit() {
    this.rebuildRows();
  }

  private rebuildRows() {
    this.rows = this.library.currentLibraryValue
      .filter((g) => g.system !== 'APPS' && !!g.gameId)
      .map((game) => ({ game, state: game.art?.length ? 'Local' : 'Not checked' }));
  }

  localNames(row: ArtRow) {
    return new Set((row.game.art || []).map((a) => `${a.name}${a.extension}`));
  }

  missing(row: ArtRow) {
    const local = this.localNames(row);
    return (row.remote || []).filter((a) => !local.has(a.fileName));
  }

  async check(row: ArtRow) {
    row.error = undefined;
    try {
      const result = await window.libraryAPI.listAvailableArt(
        row.game.gameId,
        row.game.system === 'PS1' ? 'PS1' : 'PS2'
      );
      if (!result.success) throw new Error(result.message);
      row.remote = result.data;
      row.state = result.data.length
        ? (this.missing(row).length ? 'Available' : 'Local')
        : 'Missing source';
    } catch (e: any) {
      row.state = 'Error';
      row.error = e?.message || String(e);
    }
  }

  async checkAll() {
    this.checking = true;
    this.lastMessage = '';
    try {
      for (const row of this.rows) await this.check(row);
      this.lastMessage = this.missingAssetCount
        ? `${this.missingAssetCount} missing artwork asset${this.missingAssetCount === 1 ? '' : 's'} found.`
        : 'Artwork check complete.';
    } finally {
      this.checking = false;
    }
  }

  async fetch(row: ArtRow, forceAll = false) {
    if (!row.remote) await this.check(row);
    const assets = forceAll ? (row.remote || []) : this.missing(row);
    if (!assets.length) {
      this.lastMessage = forceAll ? 'No remote artwork is available for this game.' : 'This game has no missing artwork.';
      return;
    }

    this.jobs.enqueue([{
      type: 'artwork',
      label: row.game.title || row.game.gameId,
      filePath: row.game.path,
      gameId: row.game.gameId,
      gameName: row.game.title || row.game.gameId,
      downloadArtwork: true,
      system: row.game.system === 'PS1' ? 'PS1' : 'PS2',
      artTypes: assets.map((a) => a.type),
      skipExisting: !forceAll,
    }]);
    this.lastMessage = `${assets.length} artwork asset${assets.length === 1 ? '' : 's'} queued for ${row.game.title || row.game.gameId}.`;
  }

  async fetchMissing() {
    if (this.rows.some((row) => !row.remote)) await this.checkAll();
    let queued = 0;
    for (const row of this.rows) {
      const missing = this.missing(row);
      if (missing.length) {
        queued += missing.length;
        void this.fetch(row, false);
      }
    }
    if (queued) this.lastMessage = `${queued} missing artwork asset${queued === 1 ? '' : 's'} queued.`;
  }

  openFolder() {
    const root = this.library.currentDirectoryValue;
    if (root) void window.libraryAPI.openArtFolder(root);
  }

  async manual(row: ArtRow) {
    const root = this.library.currentDirectoryValue;
    if (!root) return;
    const result = await window.libraryAPI.importArtworkManual(root, row.game.gameId);
    if (result.success) {
      row.state = 'Local';
      row.error = undefined;
      this.lastMessage = `Artwork imported for ${row.game.title || row.game.gameId}.`;
      void this.library.refreshGamesFiles();
    }
  }
}
