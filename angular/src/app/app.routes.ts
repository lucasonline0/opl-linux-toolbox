import { Routes } from '@angular/router';
import { LibraryComponent } from './pages/library/library.component';
import { LogsComponent } from './pages/logs/logs.component';
import { InvalidComponent } from './pages/invalid/invalid.component';
import { ImportComponent } from './pages/import/import.component';
import { InfoComponent } from './pages/info/info.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { VmcComponent } from './pages/vmc/vmc.component';
import { DetailsComponent } from './pages/details/details.component';
import { loadingGuard } from './shared/guards/loading.guard';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ArtworkComponent } from './pages/artwork/artwork.component';
import { MaintenanceComponent } from './pages/maintenance/maintenance.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  { path: 'dashboard', component: DashboardComponent, canActivate: [loadingGuard] },
  { path: 'artwork', component: ArtworkComponent, canActivate: [loadingGuard] },
  { path: 'maintenance', component: MaintenanceComponent, canActivate: [loadingGuard] },
  {
    path: 'library',
    component: LibraryComponent,
    canActivate: [loadingGuard],
  },
  {
    path: 'library/details',
    component: DetailsComponent,
    canActivate: [loadingGuard],
  },
  {
    path: 'logs',
    component: LogsComponent,
    canActivate: [loadingGuard],
  },
  {
    path: 'invalid-files',
    component: InvalidComponent,
    canActivate: [loadingGuard],
  },
  {
    path: 'import',
    component: ImportComponent,
    canActivate: [loadingGuard],
  },
  {
    path: 'memory-cards',
    component: VmcComponent,
    canActivate: [loadingGuard],
  },
  {
    path: 'settings',
    component: SettingsComponent,
    canActivate: [loadingGuard],
  },
  {
    path: 'info',
    component: InfoComponent,
  },
];
