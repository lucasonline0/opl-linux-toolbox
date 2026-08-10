import { Component, OnInit } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { LibraryService } from '../../shared/services/library.service';

@Component({ selector:'app-maintenance', imports:[LucideAngularModule], templateUrl:'./maintenance.component.html', styleUrl:'./maintenance.component.scss' })
export class MaintenanceComponent implements OnInit {
  issues: MaintenanceIssue[] = [];
  selected = new Set<string>();
  loading = false;
  constructor(public library: LibraryService) {}
  ngOnInit() { void this.scan(); }
  async scan() {
    const root = this.library.currentDirectoryValue;
    if (!root) return;
    this.loading = true;
    try { this.issues = await window.libraryAPI.scanMaintenance(root); this.selected.clear(); } finally { this.loading = false; }
  }
  toggle(id:string, enabled:boolean) { enabled ? this.selected.add(id) : this.selected.delete(id); }
  async repairSelected() {
    const root = this.library.currentDirectoryValue;
    const chosen = this.issues.filter((item) => this.selected.has(item.id) && item.repairable);
    if (!root || !chosen.length) return;
    const files = chosen.flatMap((item) => item.files).join('\n');
    if (!window.confirm(`Remove only these validated remnants?\n\n${files || chosen.map((i) => i.gameId).join('\n')}\n\nul.cfg will be backed up before UL changes.`)) return;
    this.loading = true;
    try { for (const issue of chosen) await window.libraryAPI.repairMaintenanceIssue(root, issue.id); } finally { await this.scan(); }
  }
}
