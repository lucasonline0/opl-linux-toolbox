import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportComponent } from './import.component';
import { importProvidersFrom } from '@angular/core';
import { LucideAngularModule, icons } from 'lucide-angular';

describe('ImportComponent', () => {
  let component: ImportComponent;
  let fixture: ComponentFixture<ImportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportComponent],
      providers: [importProvidersFrom(LucideAngularModule.pick(icons))],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
