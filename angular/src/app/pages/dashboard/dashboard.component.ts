import { Component, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { LibraryService } from '../../shared/services/library.service';
import { JobsService } from '../../shared/services/jobs.service';
import { Router } from '@angular/router';
import { Game, gameArt } from '../../shared/types/game.type';

@Component({
  selector: 'app-dashboard',
  imports: [AsyncPipe, RouterLink, LucideAngularModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  issues = 0;
  refreshing = false;
  lastScanAt = '';

  constructor(public library: LibraryService, public jobs: JobsService, private router: Router) {}

  async ngOnInit() {
    await this.refreshOverview();
  }

  async refreshOverview() {
    const root = this.library.currentDirectoryValue;
    if (!root || this.refreshing) return;
    this.refreshing = true;
    try {
      await this.library.refreshStorageInfo(root);
      const findings = await window.libraryAPI.scanMaintenance(root);
      this.issues = findings.length;
      this.lastScanAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } finally {
      this.refreshing = false;
    }
  }

  get games() { return this.library.currentLibraryValue; }
  get ps2() { return this.games.filter((g) => g.system === 'PS2').length; }
  get ps1() { return this.games.filter((g) => g.system === 'PS1').length; }
  get apps() { return this.games.filter((g) => g.system === 'APPS').length; }
  get ul() { return this.games.filter((g) => g.format === 'UL').length; }
  get withoutCover() { return this.games.filter((g) => g.system !== 'APPS' && !g.art?.some((a) => a.type.toUpperCase() === 'COV')).length; }
  get artworkEligible() { return this.games.filter((g) => g.system !== 'APPS').length; }
  get gamesWithArtwork() { return this.games.filter((g) => g.system !== 'APPS' && !!g.art?.length).length; }
  get artworkPercent() { return this.artworkEligible ? Math.round(this.gamesWithArtwork / this.artworkEligible * 100) : 0; }
  get gamesWithCovers() { return this.games.filter((g) => !!this.coverFor(g)); }
  get showcaseGames() { return this.games.filter((g) => g.system !== 'APPS').slice(0, 4); }
  get attentionCount() { return this.issues + this.withoutCover; }

  get heroGame(): Game | undefined {
    return this.games.find((game) => game.art?.some((art) => /^BG(?:_|$)/i.test(art.type)))
      || this.games.find((game) => !!this.coverFor(game))
      || this.games.find((game) => game.system !== 'APPS');
  }

  get heroAsset(): gameArt | undefined {
    const art = this.heroGame?.art || [];
    return art.find((item) => /^BG(?:_00)?$/i.test(item.type))
      || art.find((item) => /^COV2?$/i.test(item.type))
      || art[0];
  }

  coverFor(game: Game): gameArt | undefined {
    return game.art?.find((art) => art.type.toUpperCase() === 'COV')
      || game.art?.find((art) => art.type.toUpperCase() === 'COV2')
      || game.art?.[0];
  }

  artDataUrl(art: gameArt) {
    return art.url || `data:image/${art.extension.replace('.', '') || 'png'};base64,${art.base64}`;
  }

  openGame(game: Game) {
    this.library.selectGame(game);
    this.library.returnTab = game.system === 'PS1' ? 'PS1' : 'PS2';
    void this.router.navigate(['/library/details']);
  }

  percent(storage: StorageInfo) { return storage.totalBytes ? Math.round(storage.usedBytes / storage.totalBytes * 100) : 0; }
  gb(bytes: number) { return (bytes / 1073741824).toFixed(1); }
}
