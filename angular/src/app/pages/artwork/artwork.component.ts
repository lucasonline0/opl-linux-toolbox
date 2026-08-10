import { Component, OnInit } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { LibraryService } from '../../shared/services/library.service';
import { JobsService } from '../../shared/services/jobs.service';
import { Game } from '../../shared/types/game.type';
import { gameArt } from '../../shared/types/game.type';

interface ArtRow { game: Game; remote?: { type:string; fileName:string; downloadUrl:string }[]; state:'Local'|'Available'|'Missing source'|'Not checked'|'Error'; error?:string; }
@Component({selector:'app-artwork',imports:[LucideAngularModule],templateUrl:'./artwork.component.html',styleUrl:'./artwork.component.scss'})
export class ArtworkComponent implements OnInit {
  rows: ArtRow[]=[]; checking=false;
  constructor(public library:LibraryService, private jobs:JobsService){}
  get localCount(){return this.rows.reduce((total,row)=>total+(row.game.art?.length||0),0);}
  get checkedCount(){return this.rows.filter((row)=>!!row.remote).length;}
  get needsRepairCount(){return this.rows.filter((row)=>row.state==='Available'||row.state==='Error').length;}
  cover(row:ArtRow):gameArt|undefined{return row.game.art?.find((art)=>art.type.toUpperCase()==='COV')||row.game.art?.find((art)=>art.type.toUpperCase()==='COV2')||row.game.art?.[0];}
  artUrl(art:gameArt){return art.url||`data:image/${art.extension.replace('.','')||'png'};base64,${art.base64}`;}
  visibleAssets(row:ArtRow){return (row.remote||[]).slice(0,5);}
  stateLabel(row:ArtRow){return row.state==='Local'?'Complete':row.state==='Available'?'Missing assets':row.state==='Missing source'?'Source empty':row.state==='Not checked'?'Not checked':'Error';}
  ngOnInit(){ this.rows=this.library.currentLibraryValue.filter((g)=>g.system!=='APPS'&&!!g.gameId).map((game)=>({game,state:game.art?.length?'Local':'Not checked'})); }
  localNames(row:ArtRow){return new Set((row.game.art||[]).map((a)=>`${a.name}${a.extension}`));}
  missing(row:ArtRow){const local=this.localNames(row);return (row.remote||[]).filter((a)=>!local.has(a.fileName));}
  async check(row:ArtRow){try{const result=await window.libraryAPI.listAvailableArt(row.game.gameId,row.game.system==='PS1'?'PS1':'PS2');if(!result.success)throw new Error(result.message);row.remote=result.data;row.state=result.data.length?(this.missing(row).length?'Available':'Local'):'Missing source';}catch(e:any){row.state='Error';row.error=e?.message||String(e);}}
  async checkAll(){this.checking=true;try{for(const row of this.rows)await this.check(row);}finally{this.checking=false;}}
  async fetch(row:ArtRow, all=false){if(!row.remote)await this.check(row);const assets=all?(row.remote||[]):this.missing(row);if(!assets.length)return;this.jobs.enqueue([{type:'artwork',label:row.game.title||row.game.gameId,filePath:row.game.path,gameId:row.game.gameId,gameName:row.game.title||row.game.gameId,downloadArtwork:true,system:row.game.system==='PS1'?'PS1':'PS2',artTypes:assets.map((a)=>a.type),skipExisting:!all}]);}
  async fetchMissing(){if(this.rows.some((row)=>!row.remote))await this.checkAll();for(const row of this.rows)if(this.missing(row).length)void this.fetch(row);}
  openFolder(){const root=this.library.currentDirectoryValue;if(root)void window.libraryAPI.openArtFolder(root);}
  async manual(row:ArtRow){const root=this.library.currentDirectoryValue;if(!root)return;const result=await window.libraryAPI.importArtworkManual(root,row.game.gameId);if(result.success)this.library.refreshGamesFiles();}
}
