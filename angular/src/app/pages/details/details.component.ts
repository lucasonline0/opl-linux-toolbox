import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { LibraryService } from '@shared/services/library.service';
import {
  CfgService,
  CFG_KEY_NAME,
  CFG_KEY_COMPAT,
  CFG_KEY_VMC0,
  CFG_KEY_VMC1,
  COMPAT_MODES,
  GameCfg,
} from '@shared/services/cfg.service';
import { TitleCfgService } from '@shared/services/title-cfg.service';
import { VmcService } from '@shared/services/vmc.service';
import { Game, gameArt } from '@shared/types/game.type';

/** Details view for a single game or app. */
@Component({
  selector: 'app-details',
  imports: [LucideAngularModule],
  templateUrl: './details.component.html',
  styleUrl: './details.component.scss',
})
export class DetailsComponent {
  private _router = inject(Router);
  private _library = inject(LibraryService);
  private _cfg = inject(CfgService);
  private _titleCfg = inject(TitleCfgService);
  private _vmc = inject(VmcService);
  private _cdr = inject(ChangeDetectorRef);

  game: Game | null = null;
  bgArt: string | null = null;
  covArt: string | null = null;
  screenshots: gameArt[] = [];
  assetGallery: gameArt[] = [];
  loading = true;

  displayTitle = '';
  developer = '';
  genre = '';
  release = '';
  description = '';
  ratingValue = 0;
  parentalType = '';
  parentalDisplayValue = '';
  players = '';
  layoutVariant: 'default' | 'alt' = 'default';

  readonly compatModes = COMPAT_MODES;
  cfgEntries: GameCfg = {};
  compatValue = 0;
  vmc0 = '';
  vmc1 = '';
  cfgSaving = false;
  cfgMessage = '';
  cfgError = '';

  ngOnInit() {
    this.game = this._library.selectedGameValue;

    if (!this.game) {
      this.loading = false;
      this._cdr.detectChanges();
      return;
    }

    if (Array.isArray(this.game.art)) {
      const background = this.game.art.find((a) => /^BG(?:_|$)/i.test(a.type || ''));
      this.bgArt = background ? this.artDataUrl(background) : null;
      this.covArt = this.findBase64Art(this.game.art, 'COV');
      this.screenshots = this.game.art.filter((a) => /^SCR(?:\d|_|$)/i.test(a.type || '')).sort((a,b)=>a.type.localeCompare(b.type));
      this.assetGallery = this.game.art.filter((a) => a.type?.toUpperCase() !== 'COV').sort((a,b)=>a.type.localeCompare(b.type));
    }

    const root = this._library.currentDirectoryValue;
    if (root) {
      this._loadMetadata(root);
    } else {
      this.loading = false;
      this._cdr.detectChanges();
    }
  }

  private _loadMetadata(root: string): void {
    const game = this.game!;
    const isPs1LauncherApp = game.system === 'APPS' && !!game.isPs1Launcher;
    const isElfApp = game.system === 'APPS' && !game.isPs1Launcher;
    const isDiscGame = !isPs1LauncherApp && !isElfApp && !!game.gameId;

    if (isDiscGame && game.gameId) {
      this._cfg.getGameCfg(game.gameId).then((cfg) => {
        this.cfgEntries = { ...cfg };
        this.displayTitle = cfg[CFG_KEY_NAME] || '';
        this.developer = cfg['Developer'] || '';
        this.genre = cfg['Genre'] || '';
        this.release = cfg['Release'] || '';
        this.description = cfg['Description'] || '';
        this.ratingValue = this.parseRating(cfg['RatingText'] || cfg['Rating'] || '');
        this._formatParentalLabel(cfg['Parental'] || '', cfg['ParentalText'] || '');
        this.players = cfg['PlayersText'] || cfg['Players'] || '';
        const parsedCompatibility = Number.parseInt(cfg[CFG_KEY_COMPAT] || '0', 0);
        this.compatValue = Number.isFinite(parsedCompatibility) ? parsedCompatibility : 0;
        this.vmc0 = cfg[CFG_KEY_VMC0] || '';
        this.vmc1 = cfg[CFG_KEY_VMC1] || '';
        void this._vmc.refresh();
        this._applyFallbackTitle();
        this.loading = false;
        this._cdr.detectChanges();
      }).catch(() => {
        this._applyFallbackTitle();
        this.loading = false;
        this._cdr.detectChanges();
      });
      return;
    }

    if ((isPs1LauncherApp || isElfApp) && game.appFolder) {
      this._loadTitleCfg(game.appFolder);
      return;
    }

    this._applyFallbackTitle();
    this.loading = false;
    this._cdr.detectChanges();
  }

  private _loadTitleCfg(folder: string): void {
    this._titleCfg.getTitleCfg(folder).then((data) => {
      if (data.title) this.displayTitle = data.title;
      if (data.developer) this.developer = data.developer;
      if (data.genre) this.genre = data.genre;
      if (data.release) this.release = data.release;
      if (data.description) this.description = data.description;
      if (data.ratingText || data.rating) {
        this.ratingValue = this.parseRating(data.ratingText || data.rating || '');
      }
      if (data.parental || data.parentalText) {
        this._formatParentalLabel(data.parental || '', data.parentalText || '');
      }
      if (data.playersText) this.players = data.playersText;
      this._applyFallbackTitle();
      this.loading = false;
      this._cdr.detectChanges();
    });
  }

  private _applyFallbackTitle(): void {
    if (!this.displayTitle && this.game) {
      this.displayTitle = this.game.title || this.game.gameId || this.game.filename;
    }
  }

  private _formatParentalLabel(parental: string, text: string): void {
    if (parental.includes('/')) {
      this.parentalType = parental.split('/')[0].trim();
      this.parentalDisplayValue = text || parental.split('/')[1].trim();
    } else {
      this.parentalType = '';
      this.parentalDisplayValue = text || parental;
    }
  }

  get parentalLabel(): string {
    if (!this.parentalType && !this.parentalDisplayValue) return '';
    if (!this.parentalType) return this.parentalDisplayValue;
    return `${this.parentalType.toUpperCase()} - ${this.parentalDisplayValue}`;
  }

  get isSquareCover(): boolean {
    if (!this.game) return false;
    return this.game.system === 'PS1' || this.game.system === 'APPS';
  }

  get isElfApp(): boolean {
    return this.game?.system === 'APPS' && !this.game?.isPs1Launcher;
  }

  get supportsOplSettings(): boolean {
    return !!this.game?.gameId && this.game?.system !== 'APPS';
  }

  get vmcCards() {
    return this._vmc.cards;
  }

  get enabledCompatCount(): number {
    return this.compatModes.filter((mode) => this.isCompatEnabled(mode.bit)).length;
  }

  isCompatEnabled(bit: number): boolean {
    return (this.compatValue & (1 << bit)) !== 0;
  }

  toggleCompat(bit: number): void {
    this.compatValue ^= (1 << bit);
    this.cfgMessage = '';
    this.cfgError = '';
  }

  resetOplSettings(): void {
    this.compatValue = 0;
    this.vmc0 = '';
    this.vmc1 = '';
    this.cfgMessage = 'OPL-specific fields reset locally. Save to apply.';
    this.cfgError = '';
  }

  async saveOplSettings(): Promise<void> {
    if (!this.game?.gameId) return;
    this.cfgSaving = true;
    this.cfgMessage = '';
    this.cfgError = '';

    const next: GameCfg = { ...this.cfgEntries };
    if (this.compatValue) next[CFG_KEY_COMPAT] = String(this.compatValue);
    else delete next[CFG_KEY_COMPAT];

    if (this.vmc0.trim()) next[CFG_KEY_VMC0] = this.vmc0.trim();
    else delete next[CFG_KEY_VMC0];

    if (this.vmc1.trim()) next[CFG_KEY_VMC1] = this.vmc1.trim();
    else delete next[CFG_KEY_VMC1];

    try {
      const ok = await this._cfg.saveGameCfg(this.game.gameId, next);
      if (!ok) throw new Error('Could not save the game CFG.');
      this.cfgEntries = next;
      this.cfgMessage = 'OPL settings saved. Existing unknown CFG keys were preserved.';
    } catch (error: any) {
      this.cfgError = error?.message || String(error);
    } finally {
      this.cfgSaving = false;
      this._cdr.detectChanges();
    }
  }

  get ratingStars(): boolean[] {
    const r = Math.round(this.ratingValue);
    return [1, 2, 3, 4, 5].map((i) => i <= r);
  }

  get playersCount(): number {
    if (!this.players) return 0;
    const m = this.players.match(/(\d+)/);
    const n = m ? parseInt(m[1], 10) : 0;
    return Math.min(Math.max(n, 1), 4);
  }

  private parseRating(raw: string): number {
    if (!raw) return 0;
    const trimmed = raw.trim();
    const slashIdx = trimmed.lastIndexOf('/');
    const numStr = slashIdx >= 0 ? trimmed.slice(slashIdx + 1) : trimmed;
    const num = Number(numStr);
    return !isNaN(num) ? Math.min(Math.max(num, 0), 5) : 0;
  }

  private findBase64Art(art: gameArt[], type: string): string | null {
    const found = art.find((a) => a.type?.toUpperCase() === type.toUpperCase());
    return found ? this.artDataUrl(found) : null;
  }

  artDataUrl(art: gameArt): string {
    if (art.url) return art.url;
    const mime = /jpe?g/i.test(art.extension) ? 'image/jpeg' : 'image/png';
    return `data:${mime};base64,${art.base64}`;
  }

  get launcherFullPath(): string | null {
    const g = this.game;
    if (!g?.isPs1Launcher || !g.ps1LauncherPath) return null;
    const sep = g.ps1LauncherPath.includes('\\') ? '\\' : '/';
    return g.ps1LauncherBoot
      ? `${g.ps1LauncherPath}${sep}${g.ps1LauncherBoot}`
      : g.ps1LauncherPath;
  }

  back() {
    if (this.game) {
      const system = this.game.system ?? 'PS2';
      this._library.returnTab = system === 'PS2' ? 'PS2' : system === 'PS1' ? 'PS1' : 'APPS';
    }
    this._library.selectGame(null);
    this._router.navigate(['/library']);
  }
}
