import { Component, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { Observable } from 'rxjs';
import { SettingsService } from '../../shared/services/settings.service';
import { LogsService } from '../../shared/services/logs.service';
import { UpdateService } from '../../shared/services/update.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-settings',
  imports: [LucideAngularModule, AsyncPipe, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  public settings$: Observable<AppSettings>;
  public verboseMode = false;
  public cacheMessage = '';
  public section:
    | 'general'
    | 'import'
    | 'artwork'
    | 'safety'
    | 'advanced' = 'general';

  constructor(
    private readonly _settings: SettingsService,
    private readonly _logger: LogsService,
    public readonly _update: UpdateService,
  ) {
    this.settings$ = this._settings.settings$;
  }

  checkForUpdates(): void {
    this._update.check();
  }

  openRelease(): void {
    this._update.openRelease();
  }

  ngOnInit(): void {
    sessionStorage.removeItem('settingsSection');
    this._settings.load();
    this.verboseMode = this._logger.isVerboseMode;
  }

  onAutoReconnectChange(enabled: boolean): void {
    this._settings.set('autoReconnect', enabled);
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    void this._settings.set(key, value);
  }
  async clearArtworkCache(): Promise<void> {
    await window.libraryAPI.clearArtworkCache();
    this.cacheMessage = 'Artwork index cache cleared.';
  }

  onVerboseChange(): void {
    this._logger.toggleVerboseMode();
    this.verboseMode = this._logger.isVerboseMode;
  }
}
