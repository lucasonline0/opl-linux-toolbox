import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LogsService } from './logs.service';

interface UpdateInstallProgress {
  percent: number;
  stage: string;
  detail?: string;
}

@Injectable({
  providedIn: 'root',
})
export class UpdateService {
  private resultSubject = new BehaviorSubject<UpdateCheckResult | null>(null);
  public get result$(): Observable<UpdateCheckResult | null> {
    return this.resultSubject.asObservable();
  }

  private checkingSubject = new BehaviorSubject<boolean>(false);
  public get checking$(): Observable<boolean> {
    return this.checkingSubject.asObservable();
  }

  private dismissedSubject = new BehaviorSubject<boolean>(false);
  public get dismissed$(): Observable<boolean> {
    return this.dismissedSubject.asObservable();
  }

  private installingSubject = new BehaviorSubject<boolean>(false);
  public get installing$(): Observable<boolean> {
    return this.installingSubject.asObservable();
  }

  private progressSubject = new BehaviorSubject<number>(0);
  public get progress$(): Observable<number> {
    return this.progressSubject.asObservable();
  }

  private stageSubject = new BehaviorSubject<string>('');
  public get stage$(): Observable<string> {
    return this.stageSubject.asObservable();
  }

  private detailSubject = new BehaviorSubject<string>('');
  public get detail$(): Observable<string> {
    return this.detailSubject.asObservable();
  }

  private installErrorSubject = new BehaviorSubject<string>('');
  public get installError$(): Observable<string> {
    return this.installErrorSubject.asObservable();
  }

  constructor(private readonly _logger: LogsService) {
    const api = window.libraryAPI as typeof window.libraryAPI & {
      onUpdateProgress?: (callback: (progress: UpdateInstallProgress) => void) => void;
    };
    api?.onUpdateProgress?.((progress) => {
      this.progressSubject.next(progress.percent);
      this.stageSubject.next(progress.stage);
      this.detailSubject.next(progress.detail || '');
    });
  }

  public async check(): Promise<UpdateCheckResult | null> {
    if (!window.libraryAPI?.checkForUpdates) {
      return null;
    }
    this.checkingSubject.next(true);
    try {
      const result = await window.libraryAPI.checkForUpdates();
      this.resultSubject.next(result);
      this.dismissedSubject.next(false);
      if (result.updateAvailable) {
        this._logger.log(
          'updateService',
          `Update available: ${result.latestVersion} (current ${result.currentVersion})`
        );
      } else if (result.error) {
        this._logger.error(
          'updateService',
          `Update check failed: ${result.error}`
        );
      } else {
        this._logger.log('updateService', 'Application is up to date');
      }
      return result;
    } finally {
      this.checkingSubject.next(false);
    }
  }

  public openRelease(): void {
    const url = this.resultSubject.value?.releaseUrl;
    if (url) {
      window.libraryAPI.openExternal(url);
    }
  }

  public dismiss(): void {
    if (!this.installingSubject.value) {
      this.dismissedSubject.next(true);
    }
  }

  public async installLatest(): Promise<void> {
    if (!window.libraryAPI?.installLatestUpdate) {
      this.openRelease();
      return;
    }

    this.installErrorSubject.next('');
    this.progressSubject.next(0);
    this.stageSubject.next('Preparing update');
    this.detailSubject.next('Starting secure update');
    this.installingSubject.next(true);

    try {
      await window.libraryAPI.installLatestUpdate();
    } catch (error: any) {
      const message = error?.message || String(error);
      this.installErrorSubject.next(message);
      this.stageSubject.next('Update failed');
      this.detailSubject.next('No changes were applied. You can retry or open the release page.');
      this._logger.error('updateService', `Update installation failed: ${message}`);
      this.installingSubject.next(false);
    }
  }
}
