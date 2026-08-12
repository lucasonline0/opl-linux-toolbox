import { Component, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { LibraryService } from '../../shared/services/library.service';
import { VMC_SIZES_MB, VmcService } from '../../shared/services/vmc.service';

@Component({
  selector: 'app-vmc',
  imports: [LucideAngularModule, AsyncPipe],
  templateUrl: './vmc.component.html',
  styleUrl: './vmc.component.scss',
})
export class VmcComponent implements OnInit {
  readonly sizes = VMC_SIZES_MB;

  newName = '';
  newSize = 8;
  query = '';
  creating = false;
  refreshing = false;
  error = '';
  message = '';

  constructor(
    public readonly _library: LibraryService,
    public readonly _vmc: VmcService
  ) {}

  get cards() { return this._vmc.cards; }
  get filteredCards() {
    const query = this.query.trim().toLowerCase();
    return query ? this.cards.filter((card) => card.name.toLowerCase().includes(query)) : this.cards;
  }
  get totalMb() { return this.cards.reduce((total, card) => total + card.sizeMb, 0); }

  ngOnInit() {
    void this.refresh();
  }

  async refresh() {
    this.refreshing = true;
    this.error = '';
    await this._vmc.refresh();
    this.refreshing = false;
  }

  usePreset(name: string, sizeMb = 8) {
    this.newName = name;
    this.newSize = sizeMb;
    this.error = '';
    this.message = '';
  }

  async create() {
    this.error = '';
    this.message = '';
    if (!this.newName.trim()) {
      this.error = 'Enter a name for the card.';
      return;
    }
    this.creating = true;
    const res = await this._vmc.create(this.newName, this.newSize);
    this.creating = false;
    if (res.ok) {
      this.message = `Created ${res.name || this.newName} (${this.newSize} MB). You can assign it to a PS2 game from that game's OPL settings.`;
      this.newName = '';
    } else {
      this.error = res.message || 'Could not create the card.';
    }
  }

  confirmDelete(name: string) {
    if (window.confirm(`Delete memory card "${name}"? Saved data on it will be lost.`)) {
      void this._vmc.delete(name);
    }
  }
}
