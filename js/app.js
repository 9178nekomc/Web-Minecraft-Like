(() => {
  'use strict';

  const SAVE_KEY = 'voxel-survival-state-v1';
  const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
  const TIERS = {
    wood:{level:1,speed:2,durability:59,damage:0}, stone:{level:2,speed:4,durability:131,damage:1},
    iron:{level:3,speed:6,durability:250,damage:2}, gold:{level:1,speed:12,durability:32,damage:0},
    diamond:{level:4,speed:8,durability:1561,damage:3}
  };
  const TOOL_NAMES={pickaxe:'镐',axe:'斧',shovel:'锹',hoe:'锄',sword:'剑'};
  const BLOCK_PROFILE = {
    1:{hardness:.6,tool:'shovel',drop:'block:2'},2:{hardness:.5,tool:'shovel'},3:{hardness:1.5,tool:'pickaxe',level:1,drop:'block:10'},4:{hardness:.5,tool:'shovel'},
    5:{hardness:2,tool:'axe'},6:{hardness:.2,tool:'hoe',drop:'block:6'},7:{hardness:2,tool:'pickaxe',level:1},8:{hardness:3,tool:'pickaxe',level:2},9:{hardness:2,tool:'axe'},
    10:{hardness:2,tool:'pickaxe',level:1},11:{hardness:.3,tool:'pickaxe',drop:null},12:{hardness:.8,tool:'hoe'},13:{hardness:.8,tool:'hoe'},14:{hardness:.8,tool:'hoe'},15:{hardness:.8,tool:'hoe'},16:{hardness:.8,tool:'hoe'},
    17:{hardness:3,tool:'pickaxe',level:1,drop:'coal'},18:{hardness:3,tool:'pickaxe',level:2,drop:'raw_iron'},19:{hardness:3,tool:'pickaxe',level:3,drop:'raw_gold'},20:{hardness:3,tool:'pickaxe',level:3,drop:'diamond'},
    21:{hardness:50,tool:'pickaxe',level:4},22:{hardness:.8,tool:'pickaxe'},23:{hardness:1.5,tool:'axe'},24:{hardness:2.5,tool:'axe'},25:{hardness:3.5,tool:'pickaxe',level:1},
    26:{hardness:.2,tool:'shovel'},27:{hardness:.6,tool:'shovel'},28:{hardness:2,tool:'pickaxe',level:1},29:{hardness:2,tool:'axe'},30:{hardness:1,tool:'axe'},31:{hardness:.4,tool:'axe'},32:{hardness:1.8,tool:'pickaxe'},33:{hardness:-1}
  };

  const ITEMS = {
    stick:{name:'木棍',max:64}, coal:{name:'煤炭',max:64,fuel:80}, charcoal:{name:'木炭',max:64,fuel:80},
    raw_iron:{name:'粗铁',max:64},iron_ingot:{name:'铁锭',max:64},raw_gold:{name:'粗金',max:64},gold_ingot:{name:'金锭',max:64},diamond:{name:'钻石',max:64},
    raw_pork:{name:'生猪排',max:64,food:3,saturation:.3},cooked_pork:{name:'熟猪排',max:64,food:8,saturation:.8},
    raw_beef:{name:'生牛肉',max:64,food:3,saturation:.3},steak:{name:'牛排',max:64,food:8,saturation:.8},
    raw_mutton:{name:'生羊肉',max:64,food:2,saturation:.3},cooked_mutton:{name:'熟羊肉',max:64,food:6,saturation:.8},
    leather:{name:'皮革',max:64},wool:{name:'羊毛',max:64},wood_sword:{name:'木剑',max:1,tool:'sword',tier:'wood'},stone_sword:{name:'石剑',max:1,tool:'sword',tier:'stone'},
    iron_sword:{name:'铁剑',max:1,tool:'sword',tier:'iron'},gold_sword:{name:'金剑',max:1,tool:'sword',tier:'gold'},diamond_sword:{name:'钻石剑',max:1,tool:'sword',tier:'diamond'}
  };
  for (const tier of Object.keys(TIERS)) for (const tool of ['pickaxe','axe','shovel','hoe']) ITEMS[`${tier}_${tool}`]={name:`${{wood:'木',stone:'石',iron:'铁',gold:'金',diamond:'钻石'}[tier]}${TOOL_NAMES[tool]}`,max:1,tool,tier};
  for(let i=1;i<=33;i++) ITEMS[`block:${i}`]={name:null,max:64,block:i};

  const R = (id,count=1)=>({id,count});
  const shaped=(name,station,pattern,key,out)=>({name,station,pattern,key,out});
  const RECIPES = [
    shaped('橡木木板 ×4','hand',['L'],{L:'block:5'},R('block:9',4)),
    shaped('木棍 ×4','hand',['P','P'],{P:'block:9'},R('stick',4)),
    shaped('工作台','hand',['PP','PP'],{P:'block:9'},R('block:24')),
    shaped('熔炉','table',['CCC','C C','CCC'],{C:'block:10'},R('block:25')),
    shaped('白色羊毛','table',['WW','WW'],{W:'wool'},R('block:12')),
  ];
  const mats={wood:'block:9',stone:'block:10',iron:'iron_ingot',gold:'gold_ingot',diamond:'diamond'};
  for(const tier of Object.keys(TIERS)){
    const M=mats[tier];
    RECIPES.push(shaped(`${ITEMS[`${tier}_pickaxe`].name}`,'table',['MMM',' S ',' S '],{M,S:'stick'},R(`${tier}_pickaxe`)));
    RECIPES.push(shaped(`${ITEMS[`${tier}_axe`].name}`,'table',['MM ','MS ',' S '],{M,S:'stick'},R(`${tier}_axe`)));
    RECIPES.push(shaped(`${ITEMS[`${tier}_shovel`].name}`,'table',[' M ',' S ',' S '],{M,S:'stick'},R(`${tier}_shovel`)));
    RECIPES.push(shaped(`${ITEMS[`${tier}_hoe`].name}`,'table',['MM ',' S ',' S '],{M,S:'stick'},R(`${tier}_hoe`)));
    RECIPES.push(shaped(`${ITEMS[`${tier}_sword`].name}`,'table',[' M ',' M ',' S '],{M,S:'stick'},R(`${tier}_sword`)));
  }
  const SMELT={raw_iron:'iron_ingot',raw_gold:'gold_ingot',raw_pork:'cooked_pork',raw_beef:'steak',raw_mutton:'cooked_mutton','block:5':'charcoal','block:4':'block:11','block:10':'block:3'};

  function itemName(id,api){ const it=ITEMS[id]; return it?.name || (it?.block ? api.blockName(it.block) : id); }
  function stack(id,count=1,damage=0){return {id,count,damage};}

  class SurvivalSystem {
    constructor(api){
      this.api=api; this.enabled=true; this.pvp=true; this.health=20; this.hunger=20; this.saturation=5; this.exhaustion=0;
      this.inventory=new Array(36).fill(null); this.selected=0; this.mining=null; this.attackCooldown=0; this.regenTimer=0; this.hungerTimer=0;
      this.entities=new Map(); this.nextEntity=1; this.lastMobSync=0; this.lastSpawn=0; this.uiOpen=null; this.furnace={input:null,fuel:null,output:null,burn:0,cook:0}; this.cursor=null; this.handGrid=new Array(4).fill(null); this.craftGrid=new Array(9).fill(null); this.iconCache=new Map();
      this.load(); this.buildUI(); this.bind(); this.seedStarterItems();
    }
    seedStarterItems(){ if(this.inventory.some(Boolean)) return; this.add('block:5',4); this.add('raw_pork',1); }
    load(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');if(!s)return;const inventory=Array.isArray(s.inventory)?s.inventory:new Array(36).fill(null);for(const slot of inventory){if(slot?.id==='wooden_sword')slot.id='wood_sword';}const furnace=s.furnace||this.furnace;for(const key of ['input','fuel','output'])if(furnace?.[key]?.id==='wooden_sword')furnace[key].id='wood_sword';Object.assign(this,{health:s.health??20,hunger:s.hunger??20,saturation:s.saturation??5,inventory,selected:s.selected??0,furnace});}catch(error){console.warn('Survival save migration failed:',error);}}
    save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify({health:this.health,hunger:this.hunger,saturation:this.saturation,inventory:this.inventory,selected:this.selected,furnace:this.furnace}));}catch{}}
    setMode(mode){this.enabled=mode==='survival'; document.documentElement.dataset.gameplayMode=this.enabled?'survival':'creative'; document.body.classList.toggle('survival-mode',this.enabled); this.api.setFlyingAllowed(!this.enabled); const sb=document.getElementById('survival-mode-btn'),cb=document.getElementById('creative-mode-btn'),desc=document.getElementById('mode-description'); if(sb){sb.classList.toggle('primary',this.enabled);sb.textContent=this.enabled?'生存模式 ✓':'生存模式';} if(cb){cb.classList.toggle('primary',!this.enabled);cb.textContent=!this.enabled?'创造模式 ✓':'创造模式';} if(desc)desc.textContent=this.enabled?'当前：生存模式 · 有生命、饥饿、工具耐久、挖掘硬度和生物':'当前：创造模式 · 无限方块、瞬间破坏并允许飞行'; this.renderHotbar(); this.updateHUD();}
    buildUI(){
      const hud=document.createElement('div');hud.id='survival-hud';hud.innerHTML='<div id="health-bar"></div><div id="hunger-bar"></div><div id="mining-bar"><span></span></div>';document.getElementById('hud').appendChild(hud);
      const panel=document.createElement('section');panel.id='survival-panel';panel.className='overlay-panel';panel.innerHTML=`<div class="panel survival-window"><div class="panel-heading"><div><h2 id="survival-title">物品栏与合成</h2><p id="survival-subtitle">生存物品、工具耐久与配方</p></div><button id="survival-close" class="pixel-button compact">返回游戏</button></div><div class="survival-tabs"><button data-tab="inventory">物品栏</button><button data-tab="craft">合成</button><button data-tab="furnace">熔炉</button></div><div id="survival-content"></div></div>`;document.body.appendChild(panel);
      this.panel=panel;this.content=panel.querySelector('#survival-content');
      const cursor=document.createElement('div');cursor.id='inventory-cursor';cursor.className='inventory-cursor';document.body.appendChild(cursor);this.cursorEl=cursor;
      document.addEventListener('mousemove',e=>{cursor.style.left=(e.clientX+12)+'px';cursor.style.top=(e.clientY+12)+'px';});
      panel.addEventListener('contextmenu',e=>e.preventDefault());
      panel.querySelector('#survival-close').onclick=()=>this.closeUI(true);panel.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>this.renderPanel(b.dataset.tab));
      const mode=document.getElementById('mode-choice')||document.createElement('div');
      if(!mode.id){mode.id='mode-choice';mode.className='mode-choice';mode.innerHTML='<button id="survival-mode-btn" class="pixel-button primary">生存模式</button><button id="creative-mode-btn" class="pixel-button">创造模式</button>';document.querySelector('.main-panel .button-row.four')?.before(mode);}
      const survivalButton=document.getElementById('survival-mode-btn'),creativeButton=document.getElementById('creative-mode-btn');
      const applyRequestedMode=mode=>{this.setMode(mode);window.VoxelModePreference?.set(mode);this.api.toast(mode==='survival'?'已切换为生存模式':'已切换为创造模式');};
      survivalButton.onclick=()=>applyRequestedMode('survival'); creativeButton.onclick=()=>applyRequestedMode('creative');
      window.addEventListener('voxel-mode-change',event=>this.setMode(event.detail?.mode||'survival'));
      const pvp=document.createElement('label');pvp.className='lan-pvp-toggle';pvp.innerHTML='<input id="pvp-toggle" type="checkbox" checked> 允许 PVP（仅主机可改）';document.querySelector('.lan-actions').after(pvp);pvp.querySelector('input').onchange=e=>{if(this.api.mode()==='client'){e.target.checked=this.pvp;return;}this.pvp=e.target.checked;this.broadcastConfig();};
      this.updateHUD();this.renderHotbar();
    }
    bind(){window.addEventListener('beforeunload',()=>this.save());}
    selectedStack(){return this.inventory[this.selected]||null;}
    add(id,count=1){const def=ITEMS[id];if(!def)return false;for(const s of this.inventory){if(s&&s.id===id&&s.count<(def.max||64)){const n=Math.min(count,(def.max||64)-s.count);s.count+=n;count-=n;if(!count){this.renderHotbar();this.save();return true;}}}for(let i=0;i<this.inventory.length&&count;i++){if(!this.inventory[i]){const n=Math.min(count,def.max||64);this.inventory[i]=stack(id,n,0);count-=n;}}this.renderHotbar();this.save();return count===0;}
    remove(id,count=1){for(const s of this.inventory){if(s?.id===id){const n=Math.min(count,s.count);s.count-=n;count-=n;if(!count)break;}}for(let i=0;i<this.inventory.length;i++)if(this.inventory[i]?.count<=0)this.inventory[i]=null;this.renderHotbar();this.save();return count===0;}
    count(id){return this.inventory.reduce((n,s)=>n+(s?.id===id?s.count:0),0);}
    canCraft(r){return r.in.every(x=>this.count(x.id)>=x.count);}
    craft(r){if(!this.canCraft(r))return this.api.toast('材料不足');for(const x of r.in)this.remove(x.id,x.count);this.add(r.out.id,r.out.count);this.api.toast(`合成：${itemName(r.out.id,this.api)} ×${r.out.count}`);this.renderPanel('craft');}
    renderHotbar(){if(!this.enabled)return;const root=document.getElementById('hotbar');root.innerHTML='';for(let i=0;i<9;i++){const st=this.inventory[i];const el=document.createElement('div');el.className='hotbar-slot '+(i===this.selected?'selected':'')+(st?'':' empty-slot');if(st){const icon=document.createElement('span');icon.className='item-icon';icon.style.backgroundImage=`url(${this.iconURL(st.id)})`;el.appendChild(icon);const count=document.createElement('b');count.textContent=st.count>1?st.count:'';el.appendChild(count);const d=document.createElement('small');d.textContent=this.durabilityText(st);el.appendChild(d);}else el.innerHTML=`<span class="slot-number">${i+1}</span>`;root.appendChild(el);}const held=this.selectedStack();this.api.setHeldBlock(held?.id||null,held?this.iconURL(held.id):null);}
    iconURL(id){if(this.iconCache.has(id))return this.iconCache.get(id);const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d');x.imageSmoothingEnabled=false;const it=ITEMS[id]||{};const px=(a,b,w,h,col)=>{x.fillStyle=col;x.fillRect(a,b,w,h)};const outline=(pts,col='#241b16')=>{x.strokeStyle=col;x.lineWidth=3;x.lineJoin='miter';x.beginPath();pts.forEach((p,i)=>i?x.lineTo(...p):x.moveTo(...p));x.stroke()};
      if(it.block){const hues=['#6c9b45','#8b623f','#858585','#d7c178','#7b5234','#4d8b45','#a94b3c','#f4d85a','#bb8b55','#777','#b7dce8','#eee','#b94040','#3d68b8','#3e8b48','#d4b53c','#444','#b8b8b8','#c69b34','#61cde0','#291b43'];const col=hues[(it.block-1)%hues.length];px(5,7,22,20,col);px(5,7,22,4,'rgba(255,255,255,.28)');px(5,23,22,4,'rgba(0,0,0,.25)');outline([[5,7],[27,7],[27,27],[5,27],[5,7]]);} 
      else if(it.tool){const tier=it.tier||'wood', metal={wood:'#9a6635',stone:'#777',iron:'#d8d8d8',gold:'#f1c232',diamond:'#42d7d2'}[tier];px(14,13,4,16,'#6f431f');px(15,13,2,16,'#b57a3c');if(it.tool==='sword'){outline([[16,2],[21,8],[18,18],[14,18],[11,8],[16,2]]);px(14,5,4,13,metal);px(9,18,14,4,'#5d3b22');px(14,22,4,8,'#7a4a25');}else if(it.tool==='pickaxe'){outline([[4,7],[13,3],[27,6],[26,11],[18,9],[17,15],[13,15],[13,10],[5,12],[4,7]]);px(5,7,21,4,metal);px(14,10,4,19,'#7a4a25');}else if(it.tool==='axe'){outline([[13,3],[25,5],[26,13],[18,17],[13,13],[13,3]]);px(14,5,10,9,metal);px(13,12,4,17,'#7a4a25');}else if(it.tool==='shovel'){outline([[12,3],[20,3],[23,10],[18,15],[14,15],[9,10],[12,3]]);px(12,5,8,8,metal);px(14,13,4,16,'#7a4a25');}else{outline([[7,6],[25,6],[25,11],[17,12],[17,29],[13,29],[13,12],[7,11],[7,6]]);px(8,7,16,4,metal);px(14,10,4,19,'#7a4a25');}}
      else if(it.food){const cooked=id.startsWith('cooked')||id==='steak';px(8,9,16,15,cooked?'#8f3c25':'#d56b61');px(5,12,6,8,'#eee2cf');px(21,18,6,6,'#eee2cf');outline([[8,9],[23,9],[26,14],[24,23],[10,24],[6,19],[8,9]]);} 
      else {const col=id.includes('gold')?'#f2c94c':id.includes('iron')?'#d5d9dc':id==='diamond'?'#42d7d2':id.includes('coal')?'#252525':id==='leather'?'#9b572f':id==='wool'?'#eee':'#a97845';if(id==='stick'){x.save();x.translate(16,16);x.rotate(-.65);px(-2,-13,4,26,col);x.restore();}else if(id.includes('ingot')){outline([[7,10],[24,10],[27,21],[4,21],[7,10]]);px(7,11,17,8,col);px(9,12,13,3,'rgba(255,255,255,.35)');}else if(id==='diamond'){outline([[16,3],[27,12],[16,29],[5,12],[16,3]]);px(7,12,18,4,col);px(12,6,8,20,col);}else{px(7,7,18,18,col);outline([[7,7],[25,7],[25,25],[7,25],[7,7]]);}}
      const url=c.toDataURL();this.iconCache.set(id,url);return url;}
    durabilityText(s){const d=ITEMS[s.id];if(!d?.tool)return '';return `${Math.max(0,TIERS[d.tier].durability-(s.damage||0))}`;}
    select(i){this.selected=(i+9)%9;this.renderHotbar();this.api.toast(this.selectedStack()?itemName(this.selectedStack().id,this.api):`快捷栏 ${this.selected+1}：空`);}
    toolInfo(){const s=this.selectedStack(),d=s&&ITEMS[s.id];return d?.tool?{...d,...TIERS[d.tier],stack:s}:null;}
    damageTool(amount=1){const t=this.toolInfo();if(!t)return;t.stack.damage=(t.stack.damage||0)+amount;if(t.stack.damage>=t.durability){this.inventory[this.selected]=null;this.api.toast(`${itemName(t.stack.id,this.api)} 损坏了`);}this.renderHotbar();this.save();}
    miningSpeed(blockId){const p=BLOCK_PROFILE[blockId]||{hardness:1};const t=this.toolInfo();if(p.hardness<0)return 0;let speed=1;if(t&&t.tool===p.tool)speed=t.speed;if((p.level||0)>(t?.level||0)&&p.tool==='pickaxe')speed=.35;return speed/Math.max(.05,p.hardness)/1.5;}
    canHarvest(blockId){const p=BLOCK_PROFILE[blockId]||{};if(!p.level)return true;const t=this.toolInfo();return t?.tool==='pickaxe'&&t.level>=p.level;}
    beginPrimary(hit){if(!this.enabled)return false;if(this.attackEntity())return true;if(!hit||hit.id===33)return true;this.mining={x:hit.x,y:hit.y,z:hit.z,id:hit.id,progress:0};return true;}
    endPrimary(){this.mining=null;this.updateMiningBar();}
    updateMining(dt,hit,held){if(!this.enabled)return;if(!held||!this.mining||!hit||hit.x!==this.mining.x||hit.y!==this.mining.y||hit.z!==this.mining.z){if(!held)this.endPrimary();return;}this.mining.progress+=dt*this.miningSpeed(hit.id);this.updateMiningBar();if(this.mining.progress>=1){const can=this.canHarvest(hit.id);const drop=(BLOCK_PROFILE[hit.id]?.drop===undefined?`block:${hit.id}`:BLOCK_PROFILE[hit.id].drop);this.api.breakBlock(hit,()=>{if(can&&drop)this.add(drop,1);this.exhaustion+=.005;this.damageTool(1);});this.endPrimary();}}
    updateMiningBar(){const el=document.querySelector('#mining-bar span');if(el)el.style.width=`${this.mining?clamp(this.mining.progress*100,0,100):0}%`;}
    secondary(hit){if(!this.enabled)return false;const s=this.selectedStack();if(hit?.id===24){this.openUI('craft');return true;}if(hit?.id===25){this.openUI('furnace');return true;}if(s&&ITEMS[s.id]?.food){this.eat(s);return true;}if(s&&ITEMS[s.id]?.block){this.api.placeBlock(ITEMS[s.id].block,()=>{s.count--;if(s.count<=0)this.inventory[this.selected]=null;this.renderHotbar();this.save();});return true;}return true;}
    eat(s){const f=ITEMS[s.id];if(this.hunger>=20)return this.api.toast('你现在不饿');this.hunger=clamp(this.hunger+f.food,0,20);this.saturation=clamp(this.saturation+f.food*f.saturation,0,this.hunger);s.count--;if(s.count<=0)this.inventory[this.selected]=null;this.api.toast(`食用：${itemName(s.id,this.api)} · 饥饿 +${f.food}`);this.renderHotbar();this.updateHUD();this.save();}
    attackDamage(){const t=this.toolInfo();return t?.tool==='sword'?4+t.damage:1;}
    attackEntity(){if(this.attackCooldown>0)return false;const target=this.closestEntityInSight();if(!target)return false;this.attackCooldown=.5;const damage=this.attackDamage();if(this.api.mode()==='client')this.api.netSend('mobAttack',{entityId:target.id,damage});else this.damageMob(target.id,damage,this.api.localId());this.damageTool(1);return true;}
    closestEntityInSight(){const o=this.api.camera(),f=this.api.forward();let best=null,bd=4.2;for(const e of this.entities.values()){const dx=e.x-o.x,dy=e.y+0.7-o.y,dz=e.z-o.z,d=Math.hypot(dx,dy,dz);if(d>bd)continue;const dot=(dx*f[0]+dy*f[1]+dz*f[2])/d;if(dot>.93){best=e;bd=d;}}return best;}
    damageMob(id,damage,actor){const e=this.entities.get(id);if(!e)return;e.health-=clamp(damage,0,12);e.hurt=.25;if(e.health<=0){this.entities.delete(id);const drops=e.type==='pig'?[R('raw_pork',1+Math.floor(Math.random()*3))]:e.type==='cow'?[R('raw_beef',1+Math.floor(Math.random()*3)),R('leather',1)]:[R('raw_mutton',1+Math.floor(Math.random()*2)),R('wool',1)];if(actor===this.api.localId()||this.api.mode()==='single')drops.forEach(d=>this.add(d.id,d.count));else this.api.netSend('loot',{items:drops},{to:actor});this.api.toast(`${{pig:'猪',cow:'牛',sheep:'羊'}[e.type]} 被击败`);}if(this.api.mode()==='host')this.syncMobs(true);}
    damage(amount,reason='受伤'){this.health=clamp(this.health-amount,0,20);this.api.toast(`${reason} · -${amount.toFixed(1)} 生命`);if(this.health<=0)this.die();this.updateHUD();}
    die(){this.health=20;this.hunger=20;this.saturation=5;this.api.respawn();this.api.toast('你死亡了，已在出生点复活');}
    onLand(speed){if(!this.enabled)return;const dmg=Math.max(0,Math.floor((speed-10)/2));if(dmg)this.damage(dmg,'摔落伤害');}
    update(dt,now){if(!this.enabled)return;this.attackCooldown=Math.max(0,this.attackCooldown-dt);this.hungerTimer+=dt;this.regenTimer+=dt;const moving=this.api.horizontalSpeed();this.exhaustion+=dt*(moving>5?.035:moving>.2?.01:0);while(this.exhaustion>=4){this.exhaustion-=4;if(this.saturation>0)this.saturation=Math.max(0,this.saturation-1);else this.hunger=Math.max(0,this.hunger-1);}if(this.hunger>=18&&this.health<20&&this.regenTimer>4){this.regenTimer=0;this.health=Math.min(20,this.health+1);this.exhaustion+=3;}if(this.hunger===0&&this.hungerTimer>4){this.hungerTimer=0;this.damage(1,'饥饿伤害');}this.updateFurnace(dt);if(this.api.mode()!=='client'){this.spawnMobs(now);this.updateMobs(dt,now);if(now-this.lastMobSync>500)this.syncMobs();}this.updateHUD();}
    updateHUD(){const h=document.getElementById('health-bar'),g=document.getElementById('hunger-bar');if(!h||!g)return;h.innerHTML=Array.from({length:10},(_,i)=>`<i class="heart ${this.health>i*2?'full':this.health>i*2+1?'half':''}">♥</i>`).join('');g.innerHTML=Array.from({length:10},(_,i)=>`<i class="hunger ${this.hunger>i*2?'full':this.hunger>i*2+1?'half':''}">◆</i>`).join('');}
    spawnMobs(now){if(now-this.lastSpawn<3000||this.entities.size>=18)return;this.lastSpawn=now;const c=this.api.camera();for(let n=0;n<3;n++){const a=Math.random()*Math.PI*2,d=10+Math.random()*25,x=Math.floor(c.x+Math.cos(a)*d)+.5,z=Math.floor(c.z+Math.sin(a)*d)+.5,y=this.api.surface(x,z)+1;if(Math.abs(y-c.y)>12)continue;const type=['pig','cow','sheep'][Math.floor(Math.random()*3)];const id=`m${this.nextEntity++}`;this.entities.set(id,{id,type,x,y,z,yaw:Math.random()*6.28,health:type==='cow'?10:8,vx:0,vz:0,nextTurn:0,hurt:0});break;}}
    updateMobs(dt,now){const c=this.api.camera();for(const [id,e] of this.entities){e.hurt=Math.max(0,e.hurt-dt);if(now>e.nextTurn){e.nextTurn=now+1000+Math.random()*3500;e.yaw+=Math.random()*2-1;e.speed=Math.random()<.2?0:.55;}e.vx=Math.sin(e.yaw)*(e.speed||0);e.vz=Math.cos(e.yaw)*(e.speed||0);const nx=e.x+e.vx*dt,nz=e.z+e.vz*dt,ny=this.api.surface(nx,nz)+1;if(Math.abs(ny-e.y)<1.2){e.x=nx;e.z=nz;e.y=ny;}if(Math.hypot(e.x-c.x,e.z-c.z)>55)this.entities.delete(id);}}
    appendModels(out,append){for(const e of this.entities.values()){const colors=e.type==='pig'?[[.95,.57,.62],[.75,.35,.42]]:e.type==='cow'?[[.38,.22,.13],[.88,.84,.72]]:[[.88,.88,.84],[.30,.30,.30]];const m={x:e.x,z:e.z,feetY:e.y,yaw:e.yaw};append(out,m,[0,.75,0],[1.05,.8,.48],e.hurt?[1,.25,.25]:colors[0]);append(out,m,[0,.9,-.48],[.62,.62,.62],colors[0]);for(const x of[-.35,.35])for(const z of[-.25,.25])append(out,m,[x,.25,z],[.18,.5,.18],colors[1]);if(e.type==='cow')append(out,m,[0,1.22,-.53],[.65,.12,.12],colors[1]);}}
    openUI(tab){this.uiOpen=tab;this.panel.classList.add('visible');this.renderPanel(tab);this.api.releasePointer();}
    closeUI(resume){for(const grid of [this.handGrid,this.craftGrid])for(let i=0;i<grid.length;i++){if(grid[i]){this.putBack(grid[i]);grid[i]=null;}}if(this.cursor){this.putBack(this.cursor);this.cursor=null;this.updateCursor();}this.validateFurnaceSlots();this.uiOpen=null;this.panel.classList.remove('visible');this.renderHotbar();this.save();if(resume)this.api.capturePointer();}
    renderPanel(tab){this.uiOpen=tab;const title=document.getElementById('survival-title');title.textContent=tab==='craft'?'工作台合成':tab==='furnace'?'熔炉':'物品栏';if(tab==='inventory')this.renderInventory();else if(tab==='craft')this.renderCraft();else this.renderFurnace();}
    cloneStack(s,count=s?.count){return s?{id:s.id,count,damage:s.damage||0}:null;}
    compatible(a,b){return Boolean(a&&b&&a.id===b.id&&(a.damage||0)===(b.damage||0));}
    maxStack(s){return ITEMS[s?.id]?.max||64;}
    putBack(s){if(!s)return;const left={...s};for(const slot of this.inventory){if(this.compatible(slot,left)&&slot.count<this.maxStack(slot)){const n=Math.min(left.count,this.maxStack(slot)-slot.count);slot.count+=n;left.count-=n;if(!left.count)return;}}for(let i=0;i<this.inventory.length;i++)if(!this.inventory[i]){const n=Math.min(left.count,this.maxStack(left));this.inventory[i]=this.cloneStack(left,n);left.count-=n;if(!left.count)return;}if(left.count)this.api.toast('背包已满，手持物品无法收回');}
    updateCursor(){const s=this.cursor;this.cursorEl.classList.toggle('visible',Boolean(s));this.cursorEl.innerHTML=s?`<span class="cursor-item-icon" style="background-image:url(${this.iconURL(s.id)})"></span><b>${s.count>1?s.count:''}</b>`:'';}
    slotHTML(s,label=''){return s?`<span class="slot-item-icon" style="background-image:url(${this.iconURL(s.id)})"></span><b class="slot-count">${s.count>1?s.count:''}</b><small>${this.durabilityText(s)}</small>`:`<span class="slot-empty">${label}</span>`;}
    clickSlot(get,set,button=0,readonly=false){const slot=get();if(readonly){if(!slot)return;const max=this.maxStack(slot);if(!this.cursor){this.cursor=this.cloneStack(slot);set(null);}else if(this.compatible(this.cursor,slot)&&this.cursor.count<max){const n=Math.min(slot.count,max-this.cursor.count);this.cursor.count+=n;slot.count-=n;set(slot.count?slot:null);}this.updateCursor();this.afterSlotChange();return;}
      if(button===2){if(!this.cursor&&slot){const n=Math.ceil(slot.count/2);this.cursor=this.cloneStack(slot,n);slot.count-=n;set(slot.count?slot:null);}else if(this.cursor&&!slot){set(this.cloneStack(this.cursor,1));if(--this.cursor.count<=0)this.cursor=null;}else if(this.cursor&&this.compatible(this.cursor,slot)&&slot.count<this.maxStack(slot)){slot.count++;this.cursor.count--;set(slot);if(this.cursor.count<=0)this.cursor=null;}}
      else {if(!this.cursor&&slot){this.cursor=slot;set(null);}else if(this.cursor&&!slot){set(this.cursor);this.cursor=null;}else if(this.cursor&&slot){if(this.compatible(this.cursor,slot)&&slot.count<this.maxStack(slot)){const n=Math.min(this.cursor.count,this.maxStack(slot)-slot.count);slot.count+=n;this.cursor.count-=n;set(slot);if(this.cursor.count<=0)this.cursor=null;}else{set(this.cursor);this.cursor=slot;}}}
      this.updateCursor();this.afterSlotChange();}
    afterSlotChange(){this.renderHotbar();this.save();if(this.uiOpen)this.renderPanel(this.uiOpen);}
    makeSlot(get,set,{label='',readonly=false,className=''}={}){const s=get();const b=document.createElement('button');b.className='mc-slot '+className;b.innerHTML=this.slotHTML(s,label);b.title=s?`${itemName(s.id,this.api)}${s.count>1?' ×'+s.count:''}`:label;b.onmousedown=e=>{e.preventDefault();this.clickSlot(get,set,e.button,readonly);};return b;}
    inventoryGridElement(){const wrap=document.createElement('div');wrap.className='mc-inventory-area';const main=document.createElement('div');main.className='mc-grid mc-main-grid';for(let i=9;i<36;i++)main.appendChild(this.makeSlot(()=>this.inventory[i],v=>this.inventory[i]=v));const hot=document.createElement('div');hot.className='mc-grid mc-hotbar-grid';for(let i=0;i<9;i++)hot.appendChild(this.makeSlot(()=>this.inventory[i],v=>this.inventory[i]=v,{className:i===this.selected?'selected':''}));wrap.append(main,hot);return wrap;}
    renderInventory(){this.content.innerHTML='<div class="mc-gui"><h3>物品栏</h3></div>';this.content.firstChild.appendChild(this.inventoryGridElement());}
    normalizedGrid(grid,size){let minX=size,minY=size,maxX=-1,maxY=-1;for(let i=0;i<grid.length;i++)if(grid[i]){const x=i%size,y=Math.floor(i/size);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}if(maxX<0)return {rows:[],slots:[]};const rows=[],slots=[];for(let y=minY;y<=maxY;y++){let row='';for(let x=minX;x<=maxX;x++){const slot=grid[y*size+x];row+=slot?slot.id+'|':' |';slots.push(slot);}rows.push(row);}return {rows,slots,width:maxX-minX+1,height:maxY-minY+1};}
    matchRecipe(grid,size,station){for(const r of RECIPES){if(r.station!==station)continue;const h=r.pattern.length,w=Math.max(...r.pattern.map(v=>v.length));for(const mirror of [false,true])for(let oy=0;oy<=size-h;oy++)for(let ox=0;ox<=size-w;ox++){let ok=true;for(let y=0;y<size&&ok;y++)for(let x=0;x<size;x++){const rx=x-ox,ry=y-oy;const ch=(rx>=0&&ry>=0&&rx<w&&ry<h)?(r.pattern[ry][mirror?w-1-rx:rx]||' '):' ';const expected=ch===' '?null:r.key[ch];const slot=grid[y*size+x];if((slot?.id||null)!==expected){ok=false;break;}}if(ok)return r;} }return null;}
    takeCraftOutput(grid,size,station){const r=this.matchRecipe(grid,size,station);if(!r)return;const out=this.cloneStack(r.out);if(this.cursor&&!this.compatible(this.cursor,out))return;if(this.cursor&&this.cursor.count+out.count>this.maxStack(out))return;for(let i=0;i<grid.length;i++)if(grid[i]){grid[i].count--;if(grid[i].count<=0)grid[i]=null;}if(this.cursor)this.cursor.count+=out.count;else this.cursor=out;this.updateCursor();this.afterSlotChange();}
    craftingWidget(grid,size,station,title){const wrap=document.createElement('div');wrap.className='craft-layout '+(size===2?'personal-craft-layout':'');const gridEl=document.createElement('div');gridEl.className=`mc-grid craft-grid craft-grid-${size}`;for(let i=0;i<grid.length;i++)gridEl.appendChild(this.makeSlot(()=>grid[i],v=>grid[i]=v));const arrow=document.createElement('div');arrow.className='craft-arrow';arrow.textContent='➜';const outWrap=document.createElement('div');outWrap.className='craft-output';const recipe=this.matchRecipe(grid,size,station),out=recipe?this.cloneStack(recipe.out):null;const b=this.makeSlot(()=>out,()=>{}, {label:'产物',readonly:true,className:'output-slot'});b.onmousedown=e=>{e.preventDefault();if(e.button===0||e.button===2)this.takeCraftOutput(grid,size,station);};outWrap.appendChild(b);wrap.append(gridEl,arrow,outWrap);return wrap;}
    renderInventory(){this.content.innerHTML='<div class="mc-gui"><div class="player-inventory-top"><div class="player-preview">玩家</div><div><h3>随身合成</h3><p>2×2 合成栏</p></div></div></div>';const root=this.content.firstChild;root.appendChild(this.craftingWidget(this.handGrid,2,'hand'));root.appendChild(this.inventoryGridElement());}
    renderCraft(){this.content.innerHTML='<div class="mc-gui"><h3>工作台 · 3×3 合成</h3></div>';const root=this.content.firstChild;root.appendChild(this.craftingWidget(this.craftGrid,3,'table'));root.appendChild(this.inventoryGridElement());}
    renderFurnace(){const f=this.furnace;this.content.innerHTML='<div class="mc-gui"><h3>熔炉</h3><div class="furnace-layout"><div class="furnace-left"><div class="furnace-input"></div><div class="furnace-flame-meter"><span>♨</span><i></i></div><div class="furnace-fuel"></div></div><div class="furnace-arrow"><i></i></div><div class="furnace-output"></div></div></div>';const root=this.content.firstChild;root.querySelector('.furnace-input').appendChild(this.makeSlot(()=>f.input,v=>f.input=v,{label:'输入'}));root.querySelector('.furnace-fuel').appendChild(this.makeSlot(()=>f.fuel,v=>f.fuel=v,{label:'燃料'}));root.querySelector('.furnace-output').appendChild(this.makeSlot(()=>f.output,v=>f.output=v,{label:'产物',readonly:true,className:'output-slot'}));root.querySelector('.furnace-arrow i').style.width=`${clamp(f.cook/10*100,0,100)}%`;root.querySelector('.furnace-flame-meter i').style.height=`${f.burn>0?Math.max(8,Math.min(100,f.burn/80*100)):0}%`;root.appendChild(this.inventoryGridElement());}
    validateFurnaceSlots(){if(this.furnace.input&&!SMELT[this.furnace.input.id]){this.putBack(this.furnace.input);this.furnace.input=null;this.api.toast('该物品不能熔炼');}if(this.furnace.fuel&&!ITEMS[this.furnace.fuel.id]?.fuel){this.putBack(this.furnace.fuel);this.furnace.fuel=null;this.api.toast('该物品不能作为燃料');}}
    updateFurnace(dt){this.validateFurnaceSlots();const f=this.furnace;if(f.burn<=0&&f.fuel&&f.input){f.burn=ITEMS[f.fuel.id]?.fuel||0;f.fuel.count--;if(f.fuel.count<=0)f.fuel=null;}if(f.burn>0&&f.input&&SMELT[f.input.id]){f.burn-=dt;f.cook+=dt;if(f.cook>=10){f.cook=0;const out=SMELT[f.input.id];if(!f.output||f.output.id===out){if(f.output)f.output.count++;else f.output=stack(out,1);f.input.count--;if(f.input.count<=0)f.input=null;this.save();if(this.uiOpen==='furnace')this.renderFurnace();}}}else f.cook=Math.max(0,f.cook-dt*2);}
    broadcastConfig(){if(this.api.mode()==='host')this.api.netSend('survivalConfig',{pvp:this.pvp},{broadcast:true});}
    syncMobs(force=false){this.lastMobSync=performance.now();if(this.api.mode()==='host')this.api.netSend('mobSnapshot',{entities:[...this.entities.values()],force},{broadcast:true});}
    onNet(type,m){if(type==='survivalConfig'){this.pvp=Boolean(m.pvp);const box=document.getElementById('pvp-toggle');if(box)box.checked=this.pvp;return;}if(type==='mobSnapshot'&&this.api.mode()==='client'){const incoming=new Map((m.entities||[]).map(e=>[e.id,e]));this.entities=incoming;return;}if(type==='mobAttack'&&this.api.mode()==='host'){const p=this.api.remote(m.from);const e=this.entities.get(m.entityId);if(!p||!e||Math.hypot(p.targetX-e.x,p.targetY-e.y,p.targetZ-e.z)>5)return;this.damageMob(e.id,clamp(Number(m.damage)||1,1,10),m.from);return;}if(type==='loot'&&(!m.to||m.to===this.api.localId())){for(const d of m.items||[])this.add(d.id,d.count);return;}if(type==='pvpAttack'&&this.api.mode()==='host'){if(!this.pvp)return;const a=this.api.remote(m.from),t=m.targetId===this.api.localId()?this.api.camera():this.api.remote(m.targetId);if(!a||!t||Math.hypot((a.targetX??a.x)-(t.targetX??t.x),(a.targetY??a.y)-(t.targetY??t.y),(a.targetZ??a.z)-(t.targetZ??t.z))>4.5)return;const amount=clamp(Number(m.amount)||1,1,10),reason=`${m.fromName||'玩家'} 的攻击`;if(m.targetId===this.api.localId())this.damage(amount,reason);else this.api.netSend('playerDamage',{targetId:m.targetId,amount,reason},{broadcast:true});return;}if(type==='playerDamage'&&m.targetId===this.api.localId())this.damage(Number(m.amount)||1,m.reason||'PVP 伤害');}
    tryPVP(){if(!this.enabled||!this.pvp||this.attackCooldown>0)return false;const target=this.api.remoteInSight(4.2);if(!target)return false;this.attackCooldown=.55;const amount=this.attackDamage();if(this.api.mode()==='host')this.api.netSend('playerDamage',{targetId:target.id,amount,reason:`${this.api.playerName()} 的攻击`},{broadcast:true});else this.api.netSend('pvpAttack',{targetId:target.id,amount});this.damageTool(1);return true;}
  }
  window.VoxelSurvival={create:api=>new SurvivalSystem(api),ITEMS,RECIPES,BLOCK_PROFILE};
})();
(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const menu = document.getElementById('menu');
  const loading = document.getElementById('loading');
  const loadingText = document.getElementById('loading-text');
  const progressBar = document.getElementById('progress-bar');
  const playButton = document.getElementById('play-button');
  const newWorldButton = document.getElementById('new-world-button');
  const qualityButton = document.getElementById('quality-button');
  const settingsButton = document.getElementById('settings-button');
  const lanButton = document.getElementById('lan-button');
  const lanPanel = document.getElementById('lan-panel');
  const lanCloseButton = document.getElementById('lan-close-button');
  const lanHostButton = document.getElementById('lan-host-button');
  const lanJoinButton = document.getElementById('lan-join-button');
  const lanDisconnectButton = document.getElementById('lan-disconnect-button');
  const lanNameInput = document.getElementById('lan-name-input');
  const lanAddressInput = document.getElementById('lan-address-input');
  const lanStatus = document.getElementById('lan-status');
  const lanAddressList = document.getElementById('lan-address-list');
  const lanHudBadge = document.getElementById('lan-hud-badge');
  const menuNetworkStatus = document.getElementById('menu-network-status');
  const playerTags = document.getElementById('player-tags');
  const settingsPanel = document.getElementById('settings-panel');
  const settingsCloseButton = document.getElementById('settings-close-button');
  const settingsResetButton = document.getElementById('settings-reset-button');
  const sensitivityInput = document.getElementById('sensitivity-input');
  const sensitivityValue = document.getElementById('sensitivity-value');
  const fovInput = document.getElementById('fov-input');
  const fovValue = document.getElementById('fov-value');
  const invertXInput = document.getElementById('invert-x-input');
  const invertYInput = document.getElementById('invert-y-input');
  const masterVolumeInput = document.getElementById('master-volume-input');
  const masterVolumeValue = document.getElementById('master-volume-value');
  const effectsVolumeInput = document.getElementById('effects-volume-input');
  const effectsVolumeValue = document.getElementById('effects-volume-value');
  const ambientVolumeInput = document.getElementById('ambient-volume-input');
  const ambientVolumeValue = document.getElementById('ambient-volume-value');
  const muteInput = document.getElementById('mute-input');
  const soundPreviewButton = document.getElementById('sound-preview-button');
  const inventoryPanel = document.getElementById('inventory-panel');
  const inventoryCloseButton = document.getElementById('inventory-close-button');
  const inventoryGrid = document.getElementById('inventory-grid');
  const inventoryHotbar = document.getElementById('inventory-hotbar');
  const debugLine = document.getElementById('debug-line');
  const targetLine = document.getElementById('target-line');
  const hotbarElement = document.getElementById('hotbar');
  const heldBlock = document.getElementById('held-block');
  const toast = document.getElementById('toast');

  const WORLD_H = 80;
  const CHUNK_SIZE = 16;
  const CHUNK_AREA = CHUNK_SIZE * CHUNK_SIZE;
  const MAX_RAY_DISTANCE = 9;
  const SAVE_KEY = 'voxel-creative-save-v3';
  const LEGACY_SAVE_KEY = 'voxel-creative-save-v2';
  const CHUNK_SAVE_PREFIX = `${SAVE_KEY}:chunk:`;
  const SETTINGS_KEY = 'voxel-creative-settings-v1';
  const LAN_PROFILE_KEY = 'voxel-creative-lan-profile-v1';
  const LAN_PROTOCOL = 1;
  const POSE_INTERVAL_MS = 50;
  const SURVIVAL_PROTOCOL = 1;

  const PLAYER_WIDTH = 0.60;
  const PLAYER_HEIGHT = 1.80;
  const EYE_HEIGHT = 1.62;
  const WALK_SPEED = 4.35;
  const SPRINT_SPEED = 6.35;
  const FLY_SPEED = 7.5;
  const GRAVITY = 25.0;
  const JUMP_SPEED = 8.4;
  const MAX_FALL_SPEED = 48;
  const DOUBLE_SPACE_MS = 310;
  const COLLISION_STEP = 0.075;

  // 默认保持两个鼠标轴均为负系数；设置页可调整灵敏度或单独反转。
  const BASE_MOUSE_SCALE = 0.00225;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const BLOCKS = [
    { id: 0, name: '空气', solid: false },
    { id: 1, name: '草方块', side: 1, top: 0, bottom: 2, solid: true },
    { id: 2, name: '泥土', all: 2, solid: true },
    { id: 3, name: '石头', all: 3, solid: true },
    { id: 4, name: '沙块', all: 4, solid: true },
    { id: 5, name: '橡木原木', side: 5, top: 6, bottom: 6, solid: true },
    { id: 6, name: '橡树叶', all: 7, cutout: true, solid: true },
    { id: 7, name: '砖块', all: 8, solid: true },
    { id: 8, name: '发光石', all: 9, emissive: true, solid: true },
    { id: 9, name: '橡木木板', all: 10, solid: true },
    { id: 10, name: '圆石', all: 11, solid: true },
    { id: 11, name: '玻璃', all: 12, cutout: true, solid: true },
    { id: 12, name: '白色羊毛', all: 13, solid: true },
    { id: 13, name: '红色羊毛', all: 14, solid: true },
    { id: 14, name: '蓝色羊毛', all: 15, solid: true },
    { id: 15, name: '绿色羊毛', all: 16, solid: true },
    { id: 16, name: '黄色羊毛', all: 17, solid: true },
    { id: 17, name: '煤矿石', all: 18, solid: true },
    { id: 18, name: '铁矿石', all: 19, solid: true },
    { id: 19, name: '金矿石', all: 20, solid: true },
    { id: 20, name: '钻石矿石', all: 21, solid: true },
    { id: 21, name: '黑曜石', all: 22, solid: true },
    { id: 22, name: '石英块', all: 23, solid: true },
    { id: 23, name: '书架', side: 24, top: 10, bottom: 10, solid: true },
    { id: 24, name: '工作台', side: 25, top: 26, bottom: 10, solid: true },
    { id: 25, name: '熔炉', side: 27, north: 28, top: 3, bottom: 3, solid: true },
    { id: 26, name: '雪块', all: 29, solid: true },
    { id: 27, name: '黏土块', all: 30, solid: true },
    { id: 28, name: '苔石', all: 31, solid: true },
    { id: 29, name: '深色木板', all: 32, solid: true },
    { id: 30, name: '南瓜灯', side: 33, north: 35, top: 34, bottom: 34, emissive: true, solid: true },
    { id: 31, name: '仙人掌', side: 36, top: 37, bottom: 37, solid: true },
    { id: 32, name: '彩色混凝土', all: 38, solid: true },
    { id: 33, name: '基岩', all: 39, solid: true },
  ];

  const BLOCK_SOUND = {
    1: 'grass', 2: 'dirt', 3: 'stone', 4: 'sand', 5: 'wood', 6: 'leaves',
    7: 'brick', 8: 'crystal', 9: 'wood', 10: 'stone', 11: 'glass',
    12: 'wool', 13: 'wool', 14: 'wool', 15: 'wool', 16: 'wool',
    17: 'stone', 18: 'metal', 19: 'metal', 20: 'crystal', 21: 'stone',
    22: 'stone', 23: 'wood', 24: 'wood', 25: 'stone', 26: 'snow',
    27: 'dirt', 28: 'stone', 29: 'wood', 30: 'crystal', 31: 'cactus',
    32: 'stone', 33: 'stone',
  };
  const blockSound = id => BLOCK_SOUND[id] || 'stone';
  const HOTBAR = new Array(9).fill(0);
  const XRAY_ORES = new Set([17, 18, 19, 20]);
  let xrayEnabled = false;

  const FACES = [
    { name: 'east',   dir: [ 1, 0, 0], n: [ 1, 0, 0], shade: .84, verts: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]] },
    { name: 'west',   dir: [-1, 0, 0], n: [-1, 0, 0], shade: .66, verts: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]] },
    { name: 'top',    dir: [ 0, 1, 0], n: [ 0, 1, 0], shade: 1.00, verts: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
    { name: 'bottom', dir: [ 0,-1, 0], n: [ 0,-1, 0], shade: .52, verts: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
    { name: 'south',  dir: [ 0, 0, 1], n: [ 0, 0, 1], shade: .80, verts: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]] },
    { name: 'north',  dir: [ 0, 0,-1], n: [ 0, 0,-1], shade: .72, verts: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]] },
  ];
  const TRI = [0, 1, 2, 0, 2, 3];
  const UV_CORNERS = [[0,0],[1,0],[1,1],[0,1]];

  const Mat4 = {
    create() {
      const out = new Float32Array(16);
      out[0] = out[5] = out[10] = out[15] = 1;
      return out;
    },
    perspective(out, fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2);
      out.fill(0);
      out[0] = f / aspect;
      out[5] = f;
      out[11] = -1;
      if (far !== Infinity) {
        const nf = 1 / (near - far);
        out[10] = (far + near) * nf;
        out[14] = 2 * far * near * nf;
      } else {
        out[10] = -1;
        out[14] = -2 * near;
      }
      return out;
    },
    lookAt(out, eye, center, up) {
      let zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
      let len = Math.hypot(zx, zy, zz) || 1;
      zx /= len; zy /= len; zz /= len;
      let xx = up[1] * zz - up[2] * zy;
      let xy = up[2] * zx - up[0] * zz;
      let xz = up[0] * zy - up[1] * zx;
      len = Math.hypot(xx, xy, xz) || 1;
      xx /= len; xy /= len; xz /= len;
      const yx = zy * xz - zz * xy;
      const yy = zz * xx - zx * xz;
      const yz = zx * xy - zy * xx;
      out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
      out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
      out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
      out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
      out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
      out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
      out[15] = 1;
      return out;
    }
  };

  let gl;
  let program;
  let lineProgram;
  let playerProgram;
  let playerBuffer;
  let playerVertexCount = 0;
  let atlasTexture;
  let noise;
  let seed = 0;
  let selectedSlot = 0;
  let selectedBlock = 0;
  let quality = 0;
  let active = false;
  let currentTarget = null;
  let saveTimer = null;
  let toastTimer = null;
  let lastStreamCX = Number.NaN;
  let lastStreamCZ = Number.NaN;
  let streamForce = true;
  let lastSpaceTap = -Infinity;
  let inventoryOpen = false;
  let settingsOpen = false;
  let rebindingAction = null;
  let hasEnteredWorld = false;
  let lanPanelOpen = false;
  let gameMode = 'single'; // single | host | client
  let lanPlayerName = '玩家';
  let lastPoseSentAt = 0;
  let networkReadyForWorld = false;
  let suppressLanCloseNotice = false;
  let survival = null;
  let primaryHeld = false;
  let flyingAllowed = true;

  const DEFAULT_SETTINGS = {
    sensitivity: 1,
    fov: 70,
    invertX: false,
    invertY: false,
    masterVolume: 80,
    effectsVolume: 85,
    ambientVolume: 42,
    mute: false,
    bindings: {
      forward: 'KeyW', backward: 'KeyS', left: 'KeyA', right: 'KeyD',
      jump: 'Space', sprint: 'ControlLeft', sneak: 'ShiftLeft',
      inventory: 'KeyE', speed: 'KeyF',
    },
  };
  let settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  let audio = null;
  let lan = null;
  const remotePlayers = new Map();
  const requestedChunkSnapshots = new Set();
  const chunkRevisions = new Map();
  const playerTagElements = new Map();

  // 已装载区块只保存附近的运行时方块与 GPU 网格；离开范围后可安全卸载。
  const chunks = new Map();
  const meshQueue = new Set();
  const chunkLoadQueue = [];
  const chunkLoadSet = new Set();

  // 永久修改按区块分片保存。Map<"cx,cz", Map<localIndex, blockId>>。
  const chunkEdits = new Map();
  const editedChunkKeys = new Set();
  const dirtySaveChunks = new Set();

  const camera = {
    x: .5,
    y: 30,
    z: .5,
    yaw: 0,
    pitch: -.12,
    speedMultiplier: 1,
  };
  const player = {
    velocityX: 0,
    velocityY: 0,
    velocityZ: 0,
    grounded: false,
    flying: false,
  };
  const keys = Object.create(null);
  const projection = Mat4.create();
  const view = Mat4.create();
  let lastTime = performance.now();
  let fpsSmooth = 60;
  let outlineBuffer = null;
  let outlineVertexCount = 0;
  let lastOutlineKey = '';
  let stepTravel = 0;
  let lastGroundMaterial = 'grass';

  function progress(percent, text) {
    progressBar.style.width = `${percent}%`;
    loadingText.textContent = text;
  }

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || '未知着色器错误';
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  function createProgram(vsSource, fsSource) {
    const p = gl.createProgram();
    gl.attachShader(p, compileShader(gl.VERTEX_SHADER, vsSource));
    gl.attachShader(p, compileShader(gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || '程序链接失败');
    return p;
  }

  function setupWebGL() {
    // Some Windows drivers stall when a high-performance adapter is forced.
    // Ask for the default adapter first, then fall back to WebGL 1.
    const options = {
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: false,
    };
    gl = canvas.getContext('webgl2', options);
    let webgl2 = !!gl;
    if (!gl) gl = canvas.getContext('webgl', options) || canvas.getContext('experimental-webgl', options);
    if (!gl) throw new Error('无法创建 WebGL 上下文。请在 Chrome/Edge 设置中开启“使用图形加速”，然后重启浏览器。');

    if (!webgl2) {
      const vaoExt = gl.getExtension('OES_vertex_array_object');
      if (!vaoExt) throw new Error('当前显卡仅支持 WebGL 1，但缺少 OES_vertex_array_object 扩展。请更新显卡驱动或使用新版 Chrome/Edge。');
      gl.createVertexArray = () => vaoExt.createVertexArrayOES();
      gl.bindVertexArray = vao => vaoExt.bindVertexArrayOES(vao);
      gl.deleteVertexArray = vao => vaoExt.deleteVertexArrayOES(vao);
    }

    progress(7, webgl2 ? 'WebGL 2 已连接，编译地形着色器…' : 'WebGL 1 兼容模式，编译地形着色器…');

    const vs = webgl2 ? `#version 300 es
      precision highp float;
      in vec3 aPosition;
      in vec3 aNormal;
      in vec2 aUV;
      in float aShade;
      in float aEmissive;
      uniform mat4 uProjection;
      uniform mat4 uView;
      uniform vec3 uCamera;
      out vec2 vUV;
      out float vLight;
      out float vFog;
      void main() {
        vec4 worldPos = vec4(aPosition, 1.0);
        gl_Position = uProjection * uView * worldPos;
        vec3 sunDir = normalize(vec3(0.45, 0.90, 0.28));
        float diffuse = max(dot(aNormal, sunDir), 0.0);
        float hemi = 0.72 + aNormal.y * 0.14;
        vLight = mix((0.56 + diffuse * 0.44) * aShade * hemi, 1.18, aEmissive);
        vUV = aUV;
        vFog = distance(aPosition, uCamera);
      }
    ` : `
      precision highp float;
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      attribute vec2 aUV;
      attribute float aShade;
      attribute float aEmissive;
      uniform mat4 uProjection;
      uniform mat4 uView;
      uniform vec3 uCamera;
      varying vec2 vUV;
      varying float vLight;
      varying float vFog;
      void main() {
        vec4 worldPos = vec4(aPosition, 1.0);
        gl_Position = uProjection * uView * worldPos;
        vec3 sunDir = normalize(vec3(0.45, 0.90, 0.28));
        float diffuse = max(dot(aNormal, sunDir), 0.0);
        float hemi = 0.72 + aNormal.y * 0.14;
        vLight = mix((0.56 + diffuse * 0.44) * aShade * hemi, 1.18, aEmissive);
        vUV = aUV;
        vFog = distance(aPosition, uCamera);
      }
    `;
    const fs = webgl2 ? `#version 300 es
      precision highp float;
      uniform sampler2D uAtlas;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      in vec2 vUV;
      in float vLight;
      in float vFog;
      out vec4 outColor;
      void main() {
        vec4 texel = texture(uAtlas, vUV);
        if (texel.a < 0.42) discard;
        vec3 lit = texel.rgb * vLight;
        float fog = smoothstep(uFogNear, uFogFar, vFog);
        outColor = vec4(mix(lit, uFogColor, fog), 1.0);
      }
    ` : `
      precision mediump float;
      uniform sampler2D uAtlas;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec2 vUV;
      varying float vLight;
      varying float vFog;
      void main() {
        vec4 texel = texture2D(uAtlas, vUV);
        if (texel.a < 0.42) discard;
        vec3 lit = texel.rgb * vLight;
        float fog = smoothstep(uFogNear, uFogFar, vFog);
        gl_FragColor = vec4(mix(lit, uFogColor, fog), 1.0);
      }
    `;
    program = createProgram(vs, fs);
    program.locations = {
      pos: gl.getAttribLocation(program, 'aPosition'),
      normal: gl.getAttribLocation(program, 'aNormal'),
      uv: gl.getAttribLocation(program, 'aUV'),
      shade: gl.getAttribLocation(program, 'aShade'),
      emissive: gl.getAttribLocation(program, 'aEmissive'),
      projection: gl.getUniformLocation(program, 'uProjection'),
      view: gl.getUniformLocation(program, 'uView'),
      camera: gl.getUniformLocation(program, 'uCamera'),
      atlas: gl.getUniformLocation(program, 'uAtlas'),
      fogColor: gl.getUniformLocation(program, 'uFogColor'),
      fogNear: gl.getUniformLocation(program, 'uFogNear'),
      fogFar: gl.getUniformLocation(program, 'uFogFar'),
    };

    progress(10, '编译轮廓着色器…');
    const lineVS = webgl2 ? `#version 300 es
      precision highp float;
      in vec3 aPosition;
      uniform mat4 uProjection;
      uniform mat4 uView;
      void main() { gl_Position = uProjection * uView * vec4(aPosition, 1.0); }
    ` : `
      precision highp float;
      attribute vec3 aPosition;
      uniform mat4 uProjection;
      uniform mat4 uView;
      void main() { gl_Position = uProjection * uView * vec4(aPosition, 1.0); }
    `;
    const lineFS = webgl2 ? `#version 300 es
      precision highp float;
      out vec4 outColor;
      void main() { outColor = vec4(0.06, 0.06, 0.06, 1.0); }
    ` : `
      precision mediump float;
      void main() { gl_FragColor = vec4(0.06, 0.06, 0.06, 1.0); }
    `;
    lineProgram = createProgram(lineVS, lineFS);
    lineProgram.locations = {
      pos: gl.getAttribLocation(lineProgram, 'aPosition'),
      projection: gl.getUniformLocation(lineProgram, 'uProjection'),
      view: gl.getUniformLocation(lineProgram, 'uView'),
    };

    progress(13, '编译玩家与生物着色器…');
    const playerVS = webgl2 ? `#version 300 es
      precision highp float;
      in vec3 aPosition;
      in vec3 aColor;
      uniform mat4 uProjection;
      uniform mat4 uView;
      uniform vec3 uCamera;
      out vec3 vColor;
      out float vFog;
      void main() {
        gl_Position = uProjection * uView * vec4(aPosition, 1.0);
        vColor = aColor;
        vFog = distance(aPosition, uCamera);
      }
    ` : `
      precision highp float;
      attribute vec3 aPosition;
      attribute vec3 aColor;
      uniform mat4 uProjection;
      uniform mat4 uView;
      uniform vec3 uCamera;
      varying vec3 vColor;
      varying float vFog;
      void main() {
        gl_Position = uProjection * uView * vec4(aPosition, 1.0);
        vColor = aColor;
        vFog = distance(aPosition, uCamera);
      }
    `;
    const playerFS = webgl2 ? `#version 300 es
      precision highp float;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      in vec3 vColor;
      in float vFog;
      out vec4 outColor;
      void main() {
        float fog = smoothstep(uFogNear, uFogFar, vFog);
        outColor = vec4(mix(vColor, uFogColor, fog), 1.0);
      }
    ` : `
      precision mediump float;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec3 vColor;
      varying float vFog;
      void main() {
        float fog = smoothstep(uFogNear, uFogFar, vFog);
        gl_FragColor = vec4(mix(vColor, uFogColor, fog), 1.0);
      }
    `;
    playerProgram = createProgram(playerVS, playerFS);
    playerProgram.locations = {
      pos: gl.getAttribLocation(playerProgram, 'aPosition'),
      color: gl.getAttribLocation(playerProgram, 'aColor'),
      projection: gl.getUniformLocation(playerProgram, 'uProjection'),
      view: gl.getUniformLocation(playerProgram, 'uView'),
      camera: gl.getUniformLocation(playerProgram, 'uCamera'),
      fogColor: gl.getUniformLocation(playerProgram, 'uFogColor'),
      fogNear: gl.getUniformLocation(playerProgram, 'uFogNear'),
      fogFar: gl.getUniformLocation(playerProgram, 'uFogFar'),
    };
    playerBuffer = gl.createBuffer();

    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      loading.classList.add('visible');
      progressBar.style.width = '100%';
      progressBar.style.background = '#b64d4d';
      loadingText.textContent = '显卡上下文已丢失。请关闭其他占用显卡的程序并刷新页面。';
    });

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    gl.disable(gl.BLEND);
    gl.clearColor(.56, .78, .96, 1);
  }

  async function setupTexture() {
    const image = await window.VoxelTextures.loadImage();
    atlasTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  function chunkKey(cx, cz) { return `${cx},${cz}`; }
  function chunkCoords(x, z) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    return { cx, cz, lx: x - cx * CHUNK_SIZE, lz: z - cz * CHUNK_SIZE };
  }
  function localIndex(lx, y, lz) { return lx + lz * CHUNK_SIZE + y * CHUNK_AREA; }

  function hash2(x, z, salt = 0) {
    let h = (Math.imul((x | 0) ^ seed, 374761393) + Math.imul((z | 0) + seed, 668265263) + Math.imul(salt | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  function heightAt(x, z) {
    const broad = noise.fbm2((x + seed * .001) * .017, (z - seed * .001) * .017, 5, 2.03, .5);
    const hills = noise.fbm2((x - 800) * .043, (z + 420) * .043, 4, 2, .52);
    const ridgeN = noise.noise2((x + 160) * .0095, (z - 220) * .0095);
    const ridge = 1 - Math.abs(ridgeN);
    const continental = noise.fbm2((x - 3000) * .0042, (z + 1800) * .0042, 3, 2, .5);
    const h = Math.floor(17 + broad * 9.2 + hills * 4.1 + ridge * 3.0 + continental * 6.0);
    return Math.max(6, Math.min(WORLD_H - 12, h));
  }

  function surfaceKind(x, z) {
    const h = heightAt(x, z);
    const dry = noise.fbm2((x + 300) * .021, (z - 650) * .021, 3, 2, .5);
    const nx = heightAt(x + 1, z);
    const nz = heightAt(x, z + 1);
    const slope = Math.max(Math.abs(h - nx), Math.abs(h - nz));
    const cold = noise.fbm2((x - 940) * .013, (z + 1220) * .013, 3, 2, .5);
    const sand = dry > .22 && slope < 3;
    const snowy = !sand && slope < 3 && h > 25 && cold > .40;
    return { h, slope, sand, snowy, top: sand ? 4 : (slope > 3 ? 3 : (snowy ? 26 : 1)) };
  }

  function stoneVariantAt(x, y, z) {
    if (y === 0) return 33;
    const vein = noise.noise3((x + 411) * .135, (y - 9) * .17, (z - 287) * .135);
    const detail = noise.noise3((x - 91) * .29, y * .23, (z + 173) * .29);
    if (y < 15 && vein > .66 && detail > .05) return 20;
    if (y < 28 && vein > .59 && detail > -.12) return 19;
    if (y < 48 && vein > .50 && detail > -.22) return 18;
    if (vein > .41 && detail > -.28) return 17;
    return 3;
  }

  function baseBlockAt(x, y, z) {
    if (y < 0) return 33;
    if (y >= WORLD_H) return 0;
    const surface = surfaceKind(x, z);
    if (y > surface.h) return 0;
    let id;
    if (y === 0) id = 33;
    else if (y === surface.h) id = surface.top;
    else if (y > surface.h - 4) id = surface.sand ? 4 : 2;
    else id = stoneVariantAt(x, y, z);

    if (y > 4 && y < surface.h - 5) {
      const cave = noise.noise3((x + 120) * .082, (y - 12) * .095, (z - 340) * .082);
      const tunnel = noise.noise3((x - 210) * .047, y * .063, (z + 80) * .047);
      if (cave > .57 && tunnel > -.15) id = 0;
    }
    return id;
  }

  function treeRootInfo(x, z) {
    if (hash2(x, z, 73) > .018) return null;
    const surface = surfaceKind(x, z);
    if (surface.top !== 1) return null;
    const trunk = 4 + Math.floor(hash2(x, z, 91) * 3);
    if (surface.h + trunk + 3 >= WORLD_H) return null;
    return { y: surface.h, trunk };
  }

  function treeBlockAt(x, y, z) {
    if (baseBlockAt(x, y, z) !== 0) return 0;
    let leaf = false;
    for (let rz = z - 2; rz <= z + 2; rz++) {
      for (let rx = x - 2; rx <= x + 2; rx++) {
        const tree = treeRootInfo(rx, rz);
        if (!tree) continue;
        if (x === rx && z === rz && y >= tree.y + 1 && y <= tree.y + tree.trunk) return 5;
        const dy = y - (tree.y + tree.trunk);
        if (dy >= -2 && dy <= 2) {
          const radius = dy === 2 ? 1 : 2;
          const dx = x - rx;
          const dz = z - rz;
          if (Math.abs(dx) <= radius && Math.abs(dz) <= radius) {
            const edge = Math.abs(dx) === radius && Math.abs(dz) === radius;
            if (!edge || hash2(x, z, dy + 200) >= .34) leaf = true;
          }
        }
        if (x === rx && z === rz && y === tree.y + tree.trunk + 3) leaf = true;
      }
    }
    return leaf ? 6 : 0;
  }

  function naturalBlockAt(x, y, z) {
    const base = baseBlockAt(x, y, z);
    if (base !== 0) return base;
    return treeBlockAt(x, y, z);
  }

  function getEditAt(x, y, z) {
    if (y < 0 || y >= WORLD_H) return undefined;
    const pos = chunkCoords(x, z);
    const edits = chunkEdits.get(chunkKey(pos.cx, pos.cz));
    if (!edits) return undefined;
    return edits.get(localIndex(pos.lx, y, pos.lz));
  }

  function getBlock(x, y, z) {
    if (y < 0) return 33;
    if (y >= WORLD_H) return 0;
    const pos = chunkCoords(x, z);
    const key = chunkKey(pos.cx, pos.cz);
    const chunk = chunks.get(key);
    if (chunk) return chunk.blocks[localIndex(pos.lx, y, pos.lz)];
    const edited = getEditAt(x, y, z);
    return edited === undefined ? naturalBlockAt(x, y, z) : edited;
  }

  function getBlockForMesh(x, y, z) {
    if (y < 0) return 33;
    if (y >= WORLD_H) return 0;
    const pos = chunkCoords(x, z);
    const chunk = chunks.get(chunkKey(pos.cx, pos.cz));
    return chunk ? chunk.blocks[localIndex(pos.lx, y, pos.lz)] : 0;
  }

  function generateChunkBlocks(cx, cz) {
    const blocks = new Uint8Array(CHUNK_AREA * WORLD_H);
    const startX = cx * CHUNK_SIZE;
    const startZ = cz * CHUNK_SIZE;

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const z = startZ + lz;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const x = startX + lx;
        const surface = surfaceKind(x, z);
        for (let y = 0; y <= surface.h; y++) {
          let id;
          if (y === 0) id = 33;
          else if (y === surface.h) id = surface.top;
          else if (y > surface.h - 4) id = surface.sand ? 4 : 2;
          else id = stoneVariantAt(x, y, z);
          if (y > 4 && y < surface.h - 5) {
            const cave = noise.noise3((x + 120) * .082, (y - 12) * .095, (z - 340) * .082);
            const tunnel = noise.noise3((x - 210) * .047, y * .063, (z + 80) * .047);
            if (cave > .57 && tunnel > -.15) id = 0;
          }
          blocks[localIndex(lx, y, lz)] = id;
        }
      }
    }

    // 根节点扩展两格，确保跨区块树冠在边界处无断裂。
    for (let rz = startZ - 2; rz < startZ + CHUNK_SIZE + 2; rz++) {
      for (let rx = startX - 2; rx < startX + CHUNK_SIZE + 2; rx++) {
        const tree = treeRootInfo(rx, rz);
        if (!tree) continue;
        for (let t = 1; t <= tree.trunk; t++) {
          writeGeneratedBlock(blocks, cx, cz, rx, tree.y + t, rz, 5, false);
        }
        for (let dy = -2; dy <= 2; dy++) {
          const radius = dy === 2 ? 1 : 2;
          for (let dz = -radius; dz <= radius; dz++) {
            for (let dx = -radius; dx <= radius; dx++) {
              const edge = Math.abs(dx) === radius && Math.abs(dz) === radius;
              if (edge && hash2(rx + dx, rz + dz, dy + 200) < .34) continue;
              writeGeneratedBlock(blocks, cx, cz, rx + dx, tree.y + tree.trunk + dy, rz + dz, 6, true);
            }
          }
        }
        writeGeneratedBlock(blocks, cx, cz, rx, tree.y + tree.trunk + 3, rz, 6, true);
      }
    }

    const edits = chunkEdits.get(chunkKey(cx, cz));
    if (edits) {
      for (const [index, id] of edits) blocks[index] = id;
    }
    return blocks;
  }

  function writeGeneratedBlock(blocks, cx, cz, x, y, z, id, onlyAir) {
    if (y < 0 || y >= WORLD_H) return;
    const pos = chunkCoords(x, z);
    if (pos.cx !== cx || pos.cz !== cz) return;
    const index = localIndex(pos.lx, y, pos.lz);
    if (!onlyAir || blocks[index] === 0) blocks[index] = id;
  }

  function ensureChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    const existing = chunks.get(key);
    if (existing) return existing;
    const chunk = {
      cx,
      cz,
      key,
      blocks: generateChunkBlocks(cx, cz),
      vao: gl.createVertexArray(),
      buffer: gl.createBuffer(),
      count: 0,
      centerX: cx * CHUNK_SIZE + CHUNK_SIZE / 2,
      centerZ: cz * CHUNK_SIZE + CHUNK_SIZE / 2,
    };
    chunks.set(key, chunk);
    meshQueue.add(key);
    chunkLoadSet.delete(key);
    if (gameMode === 'client' && networkReadyForWorld) requestChunkSnapshot(cx, cz);
    for (const [nx, nz] of [[cx - 1, cz], [cx + 1, cz], [cx, cz - 1], [cx, cz + 1]]) {
      const neighborKey = chunkKey(nx, nz);
      if (chunks.has(neighborKey)) meshQueue.add(neighborKey);
    }
    return chunk;
  }

  function unloadChunk(key) {
    const chunk = chunks.get(key);
    if (!chunk) return;
    gl.deleteBuffer(chunk.buffer);
    gl.deleteVertexArray(chunk.vao);
    chunks.delete(key);
    meshQueue.delete(key);
  }

  function blockTexture(id, faceName) {
    const b = BLOCKS[id] || BLOCKS[1];
    if (typeof b[faceName] === 'number') return b[faceName];
    if (typeof b.all === 'number') return b.all;
    if (faceName === 'top') return b.top;
    if (faceName === 'bottom') return b.bottom;
    return b.side;
  }

  function isOccluding(neighborId, currentId) {
    if (neighborId === 0) return false;
    const neighbor = BLOCKS[neighborId];
    const current = BLOCKS[currentId];
    if (!neighbor || !current) return true;
    if (neighbor.cutout) return current.cutout && neighborId === currentId;
    return true;
  }

  function tileUV(tile, corner) {
    const cols = window.VoxelTextures.columns;
    const rows = window.VoxelTextures.rows;
    const col = tile % cols;
    const row = Math.floor(tile / cols);
    const padU = .5 / (cols * 32);
    const padV = .5 / (rows * 32);
    const u0 = col / cols + padU;
    const u1 = (col + 1) / cols - padU;
    const v0 = 1 - (row + 1) / rows + padV;
    const v1 = 1 - row / rows - padV;
    return [corner[0] ? u1 : u0, corner[1] ? v1 : v0];
  }

  function rebuildChunk(key) {
    const chunk = chunks.get(key);
    if (!chunk) return;
    const vertices = [];
    const startX = chunk.cx * CHUNK_SIZE;
    const startZ = chunk.cz * CHUNK_SIZE;

    for (let y = 0; y < WORLD_H; y++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const z = startZ + lz;
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const x = startX + lx;
          const id = chunk.blocks[localIndex(lx, y, lz)];
          if (id === 0 || (xrayEnabled && !XRAY_ORES.has(id))) continue;
          const def = BLOCKS[id];
          for (const face of FACES) {
            const neighbor = getBlockForMesh(x + face.dir[0], y + face.dir[1], z + face.dir[2]);
            if (xrayEnabled ? XRAY_ORES.has(neighbor) : isOccluding(neighbor, id)) continue;
            const tile = blockTexture(id, face.name);
            const positionVariation = .97 + hash2(x, z, y * 31 + face.dir[0] * 7 + face.dir[2] * 13) * .06;
            for (const index of TRI) {
              const v = face.verts[index];
              const uv = tileUV(tile, UV_CORNERS[index]);
              vertices.push(
                x + v[0], y + v[1], z + v[2],
                face.n[0], face.n[1], face.n[2],
                uv[0], uv[1],
                face.shade * positionVariation,
                def.emissive ? 1 : 0
              );
            }
          }
        }
      }
    }

    const data = new Float32Array(vertices);
    chunk.count = data.length / 10;
    gl.bindVertexArray(chunk.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, chunk.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const stride = 10 * 4;
    gl.enableVertexAttribArray(program.locations.pos);
    gl.vertexAttribPointer(program.locations.pos, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(program.locations.normal);
    gl.vertexAttribPointer(program.locations.normal, 3, gl.FLOAT, false, stride, 3 * 4);
    gl.enableVertexAttribArray(program.locations.uv);
    gl.vertexAttribPointer(program.locations.uv, 2, gl.FLOAT, false, stride, 6 * 4);
    gl.enableVertexAttribArray(program.locations.shade);
    gl.vertexAttribPointer(program.locations.shade, 1, gl.FLOAT, false, stride, 8 * 4);
    gl.enableVertexAttribArray(program.locations.emissive);
    gl.vertexAttribPointer(program.locations.emissive, 1, gl.FLOAT, false, stride, 9 * 4);
    gl.bindVertexArray(null);
  }

  function processMeshQueue(limit) {
    let built = 0;
    for (const key of [...meshQueue]) {
      meshQueue.delete(key);
      if (chunks.has(key)) rebuildChunk(key);
      built++;
      if (built >= limit) break;
    }
  }

  function markMeshDirty(cx, cz) {
    const key = chunkKey(cx, cz);
    if (chunks.has(key)) meshQueue.add(key);
  }

  function markAroundDirty(x, z) {
    const pos = chunkCoords(x, z);
    markMeshDirty(pos.cx, pos.cz);
    if (pos.lx === 0) markMeshDirty(pos.cx - 1, pos.cz);
    if (pos.lx === CHUNK_SIZE - 1) markMeshDirty(pos.cx + 1, pos.cz);
    if (pos.lz === 0) markMeshDirty(pos.cx, pos.cz - 1);
    if (pos.lz === CHUNK_SIZE - 1) markMeshDirty(pos.cx, pos.cz + 1);
  }

  function streamRadius() { return quality === 0 ? 4 : 3; }

  function queueChunkLoad(cx, cz) {
    const key = chunkKey(cx, cz);
    if (chunks.has(key) || chunkLoadSet.has(key)) return;
    chunkLoadSet.add(key);
    chunkLoadQueue.push({ cx, cz, key });
  }

  function processChunkLoadQueue(limit) {
    let loaded = 0;
    const centerCX = Math.floor(camera.x / CHUNK_SIZE);
    const centerCZ = Math.floor(camera.z / CHUNK_SIZE);
    const radius = streamRadius();
    while (chunkLoadQueue.length && loaded < limit) {
      const item = chunkLoadQueue.shift();
      if (!item) continue;
      if (chunks.has(item.key) || Math.abs(item.cx - centerCX) > radius || Math.abs(item.cz - centerCZ) > radius) {
        chunkLoadSet.delete(item.key);
        continue;
      }
      ensureChunk(item.cx, item.cz);
      loaded++;
    }
  }

  function updateChunkStreaming(force = false) {
    const centerCX = Math.floor(camera.x / CHUNK_SIZE);
    const centerCZ = Math.floor(camera.z / CHUNK_SIZE);
    if (!force && !streamForce && centerCX === lastStreamCX && centerCZ === lastStreamCZ) return;
    streamForce = false;
    lastStreamCX = centerCX;
    lastStreamCZ = centerCZ;
    const radius = streamRadius();
    const pending = [];

    // 丢弃上一位置尚未生成的排队区块，防止快速移动/传送后继续加载旧区域。
    for (let i = chunkLoadQueue.length - 1; i >= 0; i--) {
      const item = chunkLoadQueue[i];
      if (Math.abs(item.cx - centerCX) > radius || Math.abs(item.cz - centerCZ) > radius) {
        chunkLoadSet.delete(item.key);
        chunkLoadQueue.splice(i, 1);
      }
    }

    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        pending.push({ cx: centerCX + dx, cz: centerCZ + dz, d: dx * dx + dz * dz });
      }
    }
    pending.sort((a, b) => a.d - b.d);
    for (const item of pending) queueChunkLoad(item.cx, item.cz);

    const unloadRadius = radius + 2;
    for (const [key, chunk] of chunks) {
      if (Math.abs(chunk.cx - centerCX) > unloadRadius || Math.abs(chunk.cz - centerCZ) > unloadRadius) unloadChunk(key);
    }
  }

  function setupOutline() {
    outlineBuffer = gl.createBuffer();
  }

  function updateOutline(target) {
    const key = target ? `${target.x},${target.y},${target.z}` : '';
    if (key === lastOutlineKey) return;
    lastOutlineKey = key;
    if (!target) { outlineVertexCount = 0; return; }
    const e = .0035;
    const x0 = target.x - e, y0 = target.y - e, z0 = target.z - e;
    const x1 = target.x + 1 + e, y1 = target.y + 1 + e, z1 = target.z + 1 + e;
    const p = [
      x0,y0,z0, x1,y0,z0,  x1,y0,z0, x1,y0,z1,  x1,y0,z1, x0,y0,z1,  x0,y0,z1, x0,y0,z0,
      x0,y1,z0, x1,y1,z0,  x1,y1,z0, x1,y1,z1,  x1,y1,z1, x0,y1,z1,  x0,y1,z1, x0,y1,z0,
      x0,y0,z0, x0,y1,z0,  x1,y0,z0, x1,y1,z0,  x1,y0,z1, x1,y1,z1,  x0,y0,z1, x0,y1,z1,
    ];
    outlineVertexCount = p.length / 3;
    gl.bindBuffer(gl.ARRAY_BUFFER, outlineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(p), gl.DYNAMIC_DRAW);
  }

  function randomSeed() {
    try {
      const random = new Uint32Array(1);
      crypto.getRandomValues(random);
      return random[0] % 1000000000;
    } catch {
      return Math.floor(Math.random() * 1000000000);
    }
  }

  function importLegacySave(saved) {
    if (!saved || !Number.isInteger(saved.seed) || !Array.isArray(saved.mods)) return false;
    seed = saved.seed >>> 0;
    for (const [worldKey, id] of saved.mods) {
      const [x, y, z] = worldKey.split(',').map(Number);
      if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z) || y < 0 || y >= WORLD_H) continue;
      const pos = chunkCoords(x, z);
      const key = chunkKey(pos.cx, pos.cz);
      let edits = chunkEdits.get(key);
      if (!edits) { edits = new Map(); chunkEdits.set(key, edits); }
      edits.set(localIndex(pos.lx, y, pos.lz), id);
      editedChunkKeys.add(key);
      dirtySaveChunks.add(key);
    }
    return true;
  }

  function loadSave() {
    try {
      const meta = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (meta && meta.version === 3 && Number.isInteger(meta.seed)) {
        seed = meta.seed >>> 0;
        if (Array.isArray(meta.editedChunks)) {
          for (const key of meta.editedChunks) {
            const rows = JSON.parse(localStorage.getItem(CHUNK_SAVE_PREFIX + key) || '[]');
            const edits = new Map(Array.isArray(rows) ? rows : []);
            if (edits.size) {
              chunkEdits.set(key, edits);
              editedChunkKeys.add(key);
            }
          }
        }
        if (meta.player && Number.isFinite(meta.player.x) && Number.isFinite(meta.player.y) && Number.isFinite(meta.player.z)) {
          camera.x = meta.player.x;
          camera.y = meta.player.y;
          camera.z = meta.player.z;
          camera.yaw = Number.isFinite(meta.player.yaw) ? meta.player.yaw : 0;
          camera.pitch = Number.isFinite(meta.player.pitch) ? meta.player.pitch : -.12;
        }
        if (Array.isArray(meta.hotbar)) {
          for (let i = 0; i < HOTBAR.length; i++) {
            const id = Number(meta.hotbar[i]);
            HOTBAR[i] = Number.isInteger(id) && id > 0 && id < BLOCKS.length ? id : 0;
          }
        }
        selectedSlot = Number.isInteger(meta.selectedSlot) ? Math.max(0, Math.min(HOTBAR.length - 1, meta.selectedSlot)) : 0;
        selectedBlock = HOTBAR[selectedSlot] || 0;
        return;
      }
      const legacy = JSON.parse(localStorage.getItem(LEGACY_SAVE_KEY) || 'null');
      if (importLegacySave(legacy)) return;
      seed = randomSeed();
    } catch {
      seed = 48291357;
      chunkEdits.clear();
      editedChunkKeys.clear();
    }
  }

  function saveMeta() {
    if (gameMode === 'client') return;
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      version: 3,
      seed,
      editedChunks: [...editedChunkKeys],
      player: { x: camera.x, y: camera.y, z: camera.z, yaw: camera.yaw, pitch: camera.pitch },
      hotbar: [...HOTBAR],
      selectedSlot,
    }));
  }

  function flushSave() {
    if (gameMode === 'client') return;
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      for (const key of dirtySaveChunks) {
        const edits = chunkEdits.get(key);
        if (edits && edits.size) {
          localStorage.setItem(CHUNK_SAVE_PREFIX + key, JSON.stringify([...edits.entries()]));
          editedChunkKeys.add(key);
        } else {
          localStorage.removeItem(CHUNK_SAVE_PREFIX + key);
          editedChunkKeys.delete(key);
        }
      }
      dirtySaveChunks.clear();
      saveMeta();
      localStorage.removeItem(LEGACY_SAVE_KEY);
    } catch {
      // file:// 隐私模式或存储配额不足时忽略，游戏仍可继续运行。
    }
  }

  function scheduleSave() {
    if (gameMode === 'client') return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 220);
  }

  function clearWorldSave() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CHUNK_SAVE_PREFIX)) keysToRemove.push(key);
      }
      for (const key of keysToRemove) localStorage.removeItem(key);
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(LEGACY_SAVE_KEY);
    } catch { /* ignored */ }
  }

  function editBlock(x, y, z, id, options = {}) {
    if (y < 0 || y >= WORLD_H) return false;
    if (!Number.isInteger(id) || id < 0 || id >= BLOCKS.length) return false;
    const persist = options.persist !== undefined ? Boolean(options.persist) : gameMode !== 'client';
    const pos = chunkCoords(x, z);
    const key = chunkKey(pos.cx, pos.cz);
    const index = localIndex(pos.lx, y, pos.lz);
    const chunk = ensureChunk(pos.cx, pos.cz);
    const natural = naturalBlockAt(x, y, z);
    let edits = chunkEdits.get(key);
    if (!edits) { edits = new Map(); chunkEdits.set(key, edits); }
    if (id === natural) {
      edits.delete(index);
      if (edits.size === 0) chunkEdits.delete(key);
    } else {
      edits.set(index, id);
    }
    chunk.blocks[index] = id;
    markAroundDirty(x, z);
    if (persist) {
      dirtySaveChunks.add(key);
      scheduleSave();
    }
    return true;
  }

  function commitAuthoritativeBlockEdit(x, y, z, id, actorId = '') {
    const previousId = getBlock(x, y, z);
    if (!editBlock(x, y, z, id, { persist: true })) return false;
    if (gameMode === 'host' && lan.ready) {
      const key = chunkKey(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE));
      const revision = (chunkRevisions.get(key) || 0) + 1;
      chunkRevisions.set(key, revision);
      lan.send('blockSet', { x, y, z, id, actorId, previousId, revision }, { broadcast: true });
    }
    return true;
  }

  function applyNetworkBlockSet(message) {
    const x = Number(message.x), y = Number(message.y), z = Number(message.z), id = Number(message.id);
    if (![x, y, z, id].every(Number.isInteger) || y < 0 || y >= WORLD_H || id < 0 || id >= BLOCKS.length) return;
    const key = chunkKey(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE));
    const revision = Number(message.revision) || 0;
    if (revision && revision < (chunkRevisions.get(key) || 0)) return;
    if (revision) chunkRevisions.set(key, revision);
    editBlock(x, y, z, id, { persist: false });
    if (message.actorId === lan.id) {
      if (id === 0) {
        const previousId = Number(message.previousId) || 3;
        audio.break(blockSound(previousId));
        showToast(`移除：${BLOCKS[previousId]?.name || '方块'}`);
      } else {
        audio.place(blockSound(id));
        showToast(`放置：${BLOCKS[id].name}`);
      }
    }
  }

  function forwardVector() {
    const cp = Math.cos(camera.pitch);
    return [-Math.sin(camera.yaw) * cp, Math.sin(camera.pitch), -Math.cos(camera.yaw) * cp];
  }

  function horizontalForward() {
    return [-Math.sin(camera.yaw), 0, -Math.cos(camera.yaw)];
  }

  function raycast(maxDistance = MAX_RAY_DISTANCE) {
    const origin = [camera.x, camera.y, camera.z];
    const dir = forwardVector();
    let x = Math.floor(origin[0]), y = Math.floor(origin[1]), z = Math.floor(origin[2]);
    const stepX = dir[0] > 0 ? 1 : -1;
    const stepY = dir[1] > 0 ? 1 : -1;
    const stepZ = dir[2] > 0 ? 1 : -1;
    const deltaX = dir[0] === 0 ? Infinity : Math.abs(1 / dir[0]);
    const deltaY = dir[1] === 0 ? Infinity : Math.abs(1 / dir[1]);
    const deltaZ = dir[2] === 0 ? Infinity : Math.abs(1 / dir[2]);
    const intBound = (s, ds) => ds > 0 ? (Math.floor(s + 1) - s) / ds : (s - Math.floor(s)) / -ds;
    let maxX = dir[0] === 0 ? Infinity : intBound(origin[0], dir[0]);
    let maxY = dir[1] === 0 ? Infinity : intBound(origin[1], dir[1]);
    let maxZ = dir[2] === 0 ? Infinity : intBound(origin[2], dir[2]);
    let distance = 0;
    let previous = { x, y, z };
    let normal = [0, 0, 0];

    for (let i = 0; i < 160 && distance <= maxDistance; i++) {
      const id = getBlock(x, y, z);
      if (id !== 0) return { x, y, z, id, previous, normal, distance };
      previous = { x, y, z };
      if (maxX < maxY) {
        if (maxX < maxZ) {
          x += stepX; distance = maxX; maxX += deltaX; normal = [-stepX, 0, 0];
        } else {
          z += stepZ; distance = maxZ; maxZ += deltaZ; normal = [0, 0, -stepZ];
        }
      } else if (maxY < maxZ) {
        y += stepY; distance = maxY; maxY += deltaY; normal = [0, -stepY, 0];
      } else {
        z += stepZ; distance = maxZ; maxZ += deltaZ; normal = [0, 0, -stepZ];
      }
      if (y < -2 || y > WORLD_H + 2) break;
    }
    return null;
  }

  function playerBounds(x = camera.x, eyeY = camera.y, z = camera.z) {
    const half = PLAYER_WIDTH / 2;
    const feet = eyeY - EYE_HEIGHT;
    return {
      minX: x - half,
      maxX: x + half,
      minY: feet,
      maxY: feet + PLAYER_HEIGHT,
      minZ: z - half,
      maxZ: z + half,
    };
  }

  function collidesAt(x, eyeY, z) {
    const b = playerBounds(x, eyeY, z);
    const epsilon = 1e-5;
    const minX = Math.floor(b.minX + epsilon);
    const maxX = Math.floor(b.maxX - epsilon);
    const minY = Math.floor(b.minY + epsilon);
    const maxY = Math.floor(b.maxY - epsilon);
    const minZ = Math.floor(b.minZ + epsilon);
    const maxZ = Math.floor(b.maxZ - epsilon);
    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          const id = getBlock(bx, by, bz);
          if (id !== 0 && BLOCKS[id].solid !== false) return true;
        }
      }
    }
    return false;
  }

  function blockIntersectsPlayer(x, y, z) {
    const b = playerBounds();
    return b.maxX > x && b.minX < x + 1 && b.maxY > y && b.minY < y + 1 && b.maxZ > z && b.minZ < z + 1;
  }

  function moveAxis(axis, amount) {
    if (amount === 0) return true;
    const steps = Math.max(1, Math.ceil(Math.abs(amount) / COLLISION_STEP));
    const step = amount / steps;
    for (let i = 0; i < steps; i++) {
      const nx = axis === 'x' ? camera.x + step : camera.x;
      const ny = axis === 'y' ? camera.y + step : camera.y;
      const nz = axis === 'z' ? camera.z + step : camera.z;
      if (collidesAt(nx, ny, nz)) {
        if (axis === 'y') {
          if (step < 0) player.grounded = true;
          player.velocityY = 0;
        } else if (axis === 'x') player.velocityX = 0;
        else player.velocityZ = 0;
        return false;
      }
      camera.x = nx;
      camera.y = ny;
      camera.z = nz;
    }
    return true;
  }

  function placeBlock() {
    if (survival?.enabled) { survival.secondary(raycast()); return; }
    if (!selectedBlock) {
      audio.error();
      showToast('快捷栏为空 · 按背包键取出方块');
      return;
    }
    const hit = raycast();
    if (!hit) return;
    const p = hit.previous;
    if (p.y < 0 || p.y >= WORLD_H || blockIntersectsPlayer(p.x, p.y, p.z)) {
      audio.error();
      return;
    }
    if (gameMode === 'client') {
      if (!lan.ready) { audio.error(); showToast('联机连接尚未就绪'); return; }
      lan.send('editRequest', { action: 'place', x: p.x, y: p.y, z: p.z, id: selectedBlock });
      return;
    }
    if (getBlock(p.x, p.y, p.z) !== 0) return;
    commitAuthoritativeBlockEdit(p.x, p.y, p.z, selectedBlock, lan.id || 'local');
    audio.place(blockSound(selectedBlock));
    showToast(`放置：${BLOCKS[selectedBlock].name}`);
  }

  function removeBlock() {
    const hit = raycast();
    if (survival?.enabled) { if (!survival.tryPVP()) survival.beginPrimary(hit); return; }
    if (!hit || hit.y === 0 || hit.id === 33) return;
    if (gameMode === 'client') {
      if (!lan.ready) { audio.error(); showToast('联机连接尚未就绪'); return; }
      lan.send('editRequest', { action: 'break', x: hit.x, y: hit.y, z: hit.z, id: 0 });
      return;
    }
    commitAuthoritativeBlockEdit(hit.x, hit.y, hit.z, 0, lan.id || 'local');
    audio.break(blockSound(hit.id));
    showToast(`移除：${BLOCKS[hit.id].name}`);
  }

  function setSelectedSlot(index, quiet = false) {
    if (survival?.enabled) { selectedSlot=(index+HOTBAR.length)%HOTBAR.length; survival.select(selectedSlot); return; }
    selectedSlot = (index + HOTBAR.length) % HOTBAR.length;
    selectedBlock = HOTBAR[selectedSlot] || 0;
    [...hotbarElement.children].forEach((el, i) => el.classList.toggle('selected', i === selectedSlot));
    [...inventoryHotbar.children].forEach((el, i) => el.classList.toggle('selected', i === selectedSlot));
    updateHeldBlock();
    scheduleSave();
    audio.hotbar();
    if (!quiet) showToast(selectedBlock ? BLOCKS[selectedBlock].name : `快捷栏 ${selectedSlot + 1}：空`);
  }

  function atlasStyle(tile) {
    const cols = window.VoxelTextures.columns;
    const rows = window.VoxelTextures.rows;
    const col = tile % cols;
    const row = Math.floor(tile / cols);
    return {
      image: `url(${window.VoxelTextures.atlasDataUrl})`,
      size: `${cols * 100}% ${rows * 100}%`,
      position: `${(col / (cols - 1)) * 100}% ${(row / (rows - 1)) * 100}%`,
    };
  }

  function applyTileStyle(el, tile) {
    const style = atlasStyle(tile);
    el.style.backgroundImage = style.image;
    el.style.backgroundSize = style.size;
    el.style.backgroundPosition = style.position;
  }

  function makeBlockIcon(id, className = 'icon') {
    const icon = document.createElement('span');
    icon.className = className;
    if (id > 0 && BLOCKS[id]) applyTileStyle(icon, blockTexture(id, 'top'));
    return icon;
  }

  function buildHotbar() {
    hotbarElement.textContent = '';
    HOTBAR.forEach((id, index) => {
      const slot = document.createElement('div');
      slot.className = 'hotbar-slot' + (index === selectedSlot ? ' selected' : '') + (id ? '' : ' empty-slot');
      slot.title = id ? `${index + 1} · ${BLOCKS[id].name}` : `${index + 1} · 空`;
      if (id) slot.appendChild(makeBlockIcon(id));
      const number = document.createElement('span');
      number.className = 'number';
      number.textContent = String(index + 1);
      slot.appendChild(number);
      hotbarElement.appendChild(slot);
    });
    updateHeldBlock();
  }

  function buildInventoryHotbar() {
    inventoryHotbar.textContent = '';
    HOTBAR.forEach((id, index) => {
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'inventory-slot' + (index === selectedSlot ? ' selected' : '') + (id ? '' : ' empty-slot');
      slot.title = id ? `${index + 1} · ${BLOCKS[id].name}` : `${index + 1} · 空（右键清空）`;
      slot.dataset.index = String(index);
      if (id) slot.appendChild(makeBlockIcon(id, 'inventory-icon'));
      const number = document.createElement('span'); number.className = 'number'; number.textContent = String(index + 1); slot.appendChild(number);
      slot.addEventListener('click', () => setSelectedSlot(index, true));
      slot.addEventListener('contextmenu', event => { event.preventDefault(); clearHotbarSlot(index); });
      inventoryHotbar.appendChild(slot);
    });
  }

  function buildInventory() {
    inventoryGrid.textContent = '';
    for (let id = 1; id < BLOCKS.length; id++) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'inventory-item';
      item.title = `放入快捷栏 ${selectedSlot + 1}`;
      item.appendChild(makeBlockIcon(id, 'inventory-icon'));
      const label = document.createElement('span'); label.textContent = BLOCKS[id].name; item.appendChild(label);
      item.addEventListener('click', () => takeInventoryBlock(id));
      inventoryGrid.appendChild(item);
    }
    buildInventoryHotbar();
  }

  function takeInventoryBlock(id) {
    HOTBAR[selectedSlot] = id;
    selectedBlock = id;
    buildHotbar();
    buildInventoryHotbar();
    scheduleSave();
    audio.pickup();
    showToast(`已取出：${BLOCKS[id].name}`);
  }

  function clearHotbarSlot(index) {
    HOTBAR[index] = 0;
    if (selectedSlot === index) selectedBlock = 0;
    buildHotbar();
    buildInventoryHotbar();
    scheduleSave();
    audio.uiClick(true);
    showToast(`已清空快捷栏 ${index + 1}`);
  }

  function updateHeldBlock() {
    const id = selectedBlock;
    heldBlock.classList.toggle('empty', !id);
    if (!id) return;
    applyTileStyle(heldBlock.querySelector('.top'), blockTexture(id, 'top'));
    applyTileStyle(heldBlock.querySelector('.left'), blockTexture(id, 'west'));
    applyTileStyle(heldBlock.querySelector('.right'), blockTexture(id, 'south'));
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1000);
  }

  function resize() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, quality === 0 ? 1.55 : .95);
    const width = Math.max(1, Math.floor(innerWidth * pixelRatio));
    const height = Math.max(1, Math.floor(innerHeight * pixelRatio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    Mat4.perspective(projection, settings.fov * Math.PI / 180, width / height, .08, quality === 0 ? 126 : 88);
  }

  function toggleFlight() {
    if (!flyingAllowed) { audio.error(); showToast('生存模式不能飞行'); return; }
    player.flying = !player.flying;
    player.velocityY = 0;
    player.grounded = false;
    stepTravel = 0;
    audio.flight(player.flying);
    showToast(player.flying ? '飞行模式：开启' : '飞行模式：关闭');
  }

  function requestJumpOrFlightToggle() {
    const now = performance.now();
    if (now - lastSpaceTap <= DOUBLE_SPACE_MS) {
      lastSpaceTap = -Infinity;
      toggleFlight();
      return;
    }
    lastSpaceTap = now;
    if (!player.flying && player.grounded) {
      player.velocityY = JUMP_SPEED;
      player.grounded = false;
      stepTravel = 0;
      audio.jump();
    }
  }

  function updatePlayer(dt) {
    if (!active) return;
    const startX = camera.x;
    const startZ = camera.z;
    const wasGrounded = player.grounded;
    const forward = horizontalForward();
    const right = [Math.cos(camera.yaw), 0, -Math.sin(camera.yaw)];
    let inputX = 0;
    let inputZ = 0;
    if (isActionDown('forward')) { inputX += forward[0]; inputZ += forward[2]; }
    if (isActionDown('backward')) { inputX -= forward[0]; inputZ -= forward[2]; }
    if (isActionDown('right')) { inputX += right[0]; inputZ += right[2]; }
    if (isActionDown('left')) { inputX -= right[0]; inputZ -= right[2]; }
    const inputLength = Math.hypot(inputX, inputZ);
    if (inputLength > 0) { inputX /= inputLength; inputZ /= inputLength; }

    const sprinting = isActionDown('sprint');
    if (player.flying) {
      const boost = sprinting ? 2.1 : 1;
      const speed = FLY_SPEED * camera.speedMultiplier * boost;
      player.velocityX = inputX * speed;
      player.velocityZ = inputZ * speed;
      player.velocityY = ((isActionDown('jump') ? 1 : 0) - (isActionDown('sneak') ? 1 : 0)) * speed;
      player.grounded = false;
    } else {
      const speed = sprinting ? SPRINT_SPEED : WALK_SPEED;
      player.velocityX = inputX * speed;
      player.velocityZ = inputZ * speed;
      player.velocityY = Math.max(-MAX_FALL_SPEED, player.velocityY - GRAVITY * dt);
      player.grounded = false;
    }

    moveAxis('x', player.velocityX * dt);
    moveAxis('z', player.velocityZ * dt);
    const landingVelocity = player.velocityY;
    moveAxis('y', player.velocityY * dt);

    const feetY = camera.y - EYE_HEIGHT;
    const groundId = getBlock(Math.floor(camera.x), Math.floor(feetY - .08), Math.floor(camera.z));
    if (groundId) lastGroundMaterial = blockSound(groundId);

    if (!player.flying && !wasGrounded && player.grounded && landingVelocity < -2.5) {
      audio.land(clamp((-landingVelocity - 2.5) / 12, .2, 1.25), lastGroundMaterial);
      stepTravel = 0;
    }

    const horizontalTravel = Math.hypot(camera.x - startX, camera.z - startZ);
    if (!player.flying && player.grounded && inputLength > 0 && horizontalTravel > 0) {
      stepTravel += horizontalTravel;
      const stride = sprinting ? .66 : .82;
      if (stepTravel >= stride) {
        stepTravel %= stride;
        audio.step(lastGroundMaterial, sprinting);
      }
    } else if (!player.grounded || player.flying) stepTravel = 0;

    // 极端情况下（例如读取了旧版本的无碰撞存档）把人物拉回最近的安全高度。
    if (collidesAt(camera.x, camera.y, camera.z)) {
      for (let i = 0; i < WORLD_H + 20 && collidesAt(camera.x, camera.y, camera.z); i++) camera.y += .25;
      player.velocityY = 0;
    }

    updateChunkStreaming();
  }

  function localPosePacket() {
    return {
      id: lan.id || 'local',
      name: lanPlayerName,
      x: camera.x, y: camera.y, z: camera.z,
      yaw: camera.yaw, pitch: camera.pitch,
      flying: player.flying, grounded: player.grounded,
      speed: Math.hypot(player.velocityX, player.velocityZ),
      selectedBlock,
    };
  }

  function sanitizedPose(data) {
    const values = ['x', 'y', 'z', 'yaw', 'pitch'];
    if (!data || values.some(key => !Number.isFinite(Number(data[key])))) return null;
    const x = clamp(Number(data.x), -10000000, 10000000);
    const y = clamp(Number(data.y), -20, WORLD_H + 200);
    const z = clamp(Number(data.z), -10000000, 10000000);
    return {
      x, y, z,
      yaw: Number(data.yaw),
      pitch: clamp(Number(data.pitch), -Math.PI / 2, Math.PI / 2),
      flying: Boolean(data.flying), grounded: Boolean(data.grounded),
      speed: clamp(Number(data.speed) || 0, 0, 40),
      selectedBlock: Number.isInteger(Number(data.selectedBlock)) ? clamp(Number(data.selectedBlock), 0, BLOCKS.length - 1) : 0,
    };
  }

  function upsertRemotePlayer(id, name, poseData = {}) {
    if (!id || id === lan.id) return null;
    const pose = sanitizedPose({
      x: poseData.x ?? camera.x,
      y: poseData.y ?? camera.y,
      z: poseData.z ?? camera.z,
      yaw: poseData.yaw ?? 0,
      pitch: poseData.pitch ?? 0,
      speed: poseData.speed ?? 0,
      flying: poseData.flying,
      grounded: poseData.grounded,
      selectedBlock: poseData.selectedBlock,
    });
    if (!pose) return null;
    let remote = remotePlayers.get(id);
    if (!remote) {
      remote = {
        id, name: String(name || id).slice(0, 20),
        x: pose.x, y: pose.y, z: pose.z,
        yaw: pose.yaw, pitch: pose.pitch, speed: pose.speed,
        targetX: pose.x, targetY: pose.y, targetZ: pose.z,
        targetYaw: pose.yaw, targetPitch: pose.pitch, targetSpeed: pose.speed,
        flying: pose.flying, grounded: pose.grounded, selectedBlock: pose.selectedBlock,
        lastSeen: performance.now(), palette: null,
      };
      remotePlayers.set(id, remote);
    } else {
      remote.name = String(name || remote.name).slice(0, 20);
      const distance = Math.hypot(pose.x - remote.targetX, pose.y - remote.targetY, pose.z - remote.targetZ);
      remote.targetX = pose.x; remote.targetY = pose.y; remote.targetZ = pose.z;
      remote.targetYaw = pose.yaw; remote.targetPitch = pose.pitch; remote.targetSpeed = pose.speed;
      remote.flying = pose.flying; remote.grounded = pose.grounded; remote.selectedBlock = pose.selectedBlock;
      if (distance > 40) {
        remote.x = pose.x; remote.y = pose.y; remote.z = pose.z;
        remote.yaw = pose.yaw; remote.pitch = pose.pitch;
      }
      remote.lastSeen = performance.now();
    }
    return remote;
  }

  function removeRemotePlayer(id) {
    remotePlayers.delete(id);
    const tag = playerTagElements.get(id);
    if (tag) tag.remove();
    playerTagElements.delete(id);
    updateLanLabels();
  }

  function clearRemotePlayers() {
    for (const id of [...remotePlayers.keys()]) removeRemotePlayer(id);
  }

  function setLanStatus(message, state = '') {
    lanStatus.textContent = message;
    lanStatus.classList.toggle('error', state === 'error');
    lanStatus.classList.toggle('success', state === 'success');
  }

  function loadLanProfile() {
    try {
      const profile = JSON.parse(localStorage.getItem(LAN_PROFILE_KEY) || 'null');
      if (profile && typeof profile === 'object') {
        if (typeof profile.name === 'string' && profile.name.trim()) lanPlayerName = profile.name.trim().slice(0, 20);
        if (typeof profile.address === 'string' && profile.address.trim()) lanAddressInput.value = profile.address.trim();
      } else lanPlayerName = `玩家${Math.floor(100 + Math.random() * 900)}`;
    } catch { lanPlayerName = `玩家${Math.floor(100 + Math.random() * 900)}`; }
    lanNameInput.value = lanPlayerName;
    if ((location.protocol === 'http:' || location.protocol === 'https:') && location.host) lanAddressInput.value = location.host;
  }

  function saveLanProfile() {
    lanPlayerName = String(lanNameInput.value || '玩家').trim().slice(0, 20) || '玩家';
    lanNameInput.value = lanPlayerName;
    try { localStorage.setItem(LAN_PROFILE_KEY, JSON.stringify({ name: lanPlayerName, address: lanAddressInput.value.trim() })); } catch { /* ignored */ }
  }

  async function refreshLanAddresses() {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') {
      lanAddressList.textContent = '使用 start_lan 脚本启动后，服务窗口会列出可分享的局域网地址。';
      return;
    }
    try {
      const response = await fetch('/_lan/info', { cache: 'no-store' });
      if (!response.ok) throw new Error(`LAN_INFO_${response.status}`);
      const type = response.headers.get('content-type') || '';
      if (!type.includes('application/json')) throw new Error('LAN_INFO_NOT_JSON');
      const info = await response.json();
      lanAddressList.textContent = '';
      const addresses = Array.isArray(info.addresses) ? info.addresses : [];
      if (!addresses.length) lanAddressList.textContent = '未检测到局域网 IPv4 地址。';
      for (const address of addresses) {
        const chip = document.createElement('span');
        chip.className = 'lan-address-chip';
        chip.textContent = address;
        chip.title = '把此地址发给同一局域网中的朋友';
        lanAddressList.appendChild(chip);
      }
    } catch (error) {
      const code = String(error?.message || '');
      lanAddressList.textContent = code === 'LAN_INFO_404'
        ? '检测到静态服务器：它没有 /_lan/info 与 /ws。请关闭当前 Python 窗口，然后双击 start_lan.bat（或运行 start_lan.sh）。'
        : '当前页面不是由完整的局域网 Node 服务提供；请运行 start_lan 脚本。';
    }
  }

  function updateLanLabels() {
    const count = 1 + remotePlayers.size;
    if (gameMode === 'host') {
      lanHudBadge.textContent = `局域网主机 · ${count} 人 · ${lan.latency}ms`;
      menuNetworkStatus.textContent = `正在主持局域网世界 · ${count} 人在线`;
      playButton.textContent = '返回联机世界';
    } else if (gameMode === 'client') {
      lanHudBadge.textContent = `局域网客户端 · ${count} 人 · ${lan.latency}ms`;
      menuNetworkStatus.textContent = lan.ready ? `已加入局域网世界 · ${count} 人在线` : '联机连接已断开';
      playButton.textContent = '返回联机世界';
    } else {
      lanHudBadge.textContent = '单人世界';
      menuNetworkStatus.textContent = '离线 · 单人世界';
      playButton.textContent = hasEnteredWorld ? '返回世界' : '单人世界';
    }
    lanDisconnectButton.disabled = gameMode === 'single';
  }

  function openLanPanel() {
    audio.unlock(); audio.uiClick();
    lanPanelOpen = true;
    menu.classList.remove('visible');
    lanPanel.classList.add('visible');
    updateLanLabels();
    refreshLanAddresses();
    setLanStatus(gameMode === 'single' ? '先运行局域网服务，再创建或加入房间。' : `当前模式：${gameMode === 'host' ? '主机' : '客户端'}。`, gameMode === 'single' ? '' : 'success');
  }

  function closeLanPanel() {
    audio.uiClick(true);
    lanPanelOpen = false;
    lanPanel.classList.remove('visible');
    menu.classList.add('visible');
  }

  function networkSpawnNearHost(index = 0) {
    const originX = Math.floor(camera.x) + 2 + index;
    const originZ = Math.floor(camera.z) + 2;
    for (let radius = 0; radius <= 10; radius++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (radius && Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;
          const x = originX + dx, z = originZ + dz;
          const h = heightAt(x, z);
          if (getBlock(x, h, z) !== 0 && getBlock(x, h + 1, z) === 0 && getBlock(x, h + 2, z) === 0) {
            return { x: x + .5, y: h + 1 + EYE_HEIGHT + .01, z: z + .5, yaw: camera.yaw, pitch: 0 };
          }
        }
      }
    }
    return { x: camera.x + 2, y: camera.y + 1, z: camera.z + 2, yaw: camera.yaw, pitch: 0 };
  }

  function resetRuntimeWorldForNetwork(networkSeed) {
    for (const key of [...chunks.keys()]) unloadChunk(key);
    chunks.clear(); meshQueue.clear(); chunkLoadQueue.length = 0; chunkLoadSet.clear();
    chunkEdits.clear(); editedChunkKeys.clear(); dirtySaveChunks.clear();
    requestedChunkSnapshots.clear(); chunkRevisions.clear();
    seed = Number(networkSeed) >>> 0;
    noise = new window.PerlinNoise(seed);
    lastStreamCX = Number.NaN; lastStreamCZ = Number.NaN; streamForce = true;
    currentTarget = null; lastOutlineKey = '';
  }

  function requestChunkSnapshot(cx, cz) {
    if (gameMode !== 'client' || !lan.ready) return;
    const key = chunkKey(cx, cz);
    if (requestedChunkSnapshots.has(key)) return;
    requestedChunkSnapshots.add(key);
    lan.send('chunkRequest', { cx, cz });
  }

  function sendChunkSnapshot(peerId, cx, cz) {
    if (gameMode !== 'host' || !lan.ready) return;
    if (!Number.isInteger(cx) || !Number.isInteger(cz) || Math.abs(cx) > 625000 || Math.abs(cz) > 625000) return;
    const key = chunkKey(cx, cz);
    const edits = chunkEdits.get(key);
    lan.send('chunkSnapshot', {
      cx, cz,
      revision: chunkRevisions.get(key) || 0,
      entries: edits ? [...edits.entries()] : [],
    }, { to: peerId });
  }

  function applyChunkSnapshot(message) {
    if (gameMode !== 'client') return;
    const cx = Number(message.cx), cz = Number(message.cz);
    if (!Number.isInteger(cx) || !Number.isInteger(cz)) return;
    const key = chunkKey(cx, cz);
    const revision = Number(message.revision) || 0;
    if (revision < (chunkRevisions.get(key) || 0)) return;
    const edits = new Map();
    for (const row of Array.isArray(message.entries) ? message.entries : []) {
      if (!Array.isArray(row) || row.length < 2) continue;
      const index = Number(row[0]), id = Number(row[1]);
      if (Number.isInteger(index) && index >= 0 && index < CHUNK_AREA * WORLD_H && Number.isInteger(id) && id >= 0 && id < BLOCKS.length) edits.set(index, id);
    }
    if (edits.size) chunkEdits.set(key, edits); else chunkEdits.delete(key);
    chunkRevisions.set(key, revision);
    requestedChunkSnapshots.add(key);
    const chunk = chunks.get(key);
    if (chunk) {
      chunk.blocks = generateChunkBlocks(cx, cz);
      meshQueue.add(key);
      for (const [nx, nz] of [[cx - 1, cz], [cx + 1, cz], [cx, cz - 1], [cx, cz + 1]]) {
        const neighborKey = chunkKey(nx, nz);
        if (chunks.has(neighborKey)) meshQueue.add(neighborKey);
      }
    }
  }

  function networkPlayerBounds(pose) {
    return playerBounds(pose.targetX ?? pose.x, pose.targetY ?? pose.y, pose.targetZ ?? pose.z);
  }

  function blockIntersectsAnyPlayer(x, y, z) {
    if (blockIntersectsPlayer(x, y, z)) return true;
    for (const p of remotePlayers.values()) {
      const b = networkPlayerBounds(p);
      if (b.maxX > x && b.minX < x + 1 && b.maxY > y && b.minY < y + 1 && b.maxZ > z && b.minZ < z + 1) return true;
    }
    return false;
  }

  function rejectPeerEdit(peerId, reason) {
    lan.send('editReject', { reason }, { to: peerId });
  }

  function handlePeerEditRequest(message) {
    if (gameMode !== 'host' || !lan.ready) return;
    const peer = remotePlayers.get(message.from);
    const x = Number(message.x), y = Number(message.y), z = Number(message.z), id = Number(message.id);
    if (!peer || ![x, y, z, id].every(Number.isInteger)) { rejectPeerEdit(message.from, '无效的方块请求'); return; }
    if (y < 0 || y >= WORLD_H || id < 0 || id >= BLOCKS.length) { rejectPeerEdit(message.from, '方块坐标超出范围'); return; }
    const px = peer.targetX, py = peer.targetY, pz = peer.targetZ;
    if (Math.hypot(x + .5 - px, y + .5 - py, z + .5 - pz) > MAX_RAY_DISTANCE + 2.2) { rejectPeerEdit(message.from, '目标距离过远'); return; }
    const current = getBlock(x, y, z);
    if (message.action === 'break') {
      if (current === 0 || current === 33 || y === 0) { rejectPeerEdit(message.from, '该方块不可破坏'); return; }
      commitAuthoritativeBlockEdit(x, y, z, 0, message.from);
    } else if (message.action === 'place') {
      if (id === 0 || current !== 0) { rejectPeerEdit(message.from, '目标位置不可放置'); return; }
      if (blockIntersectsAnyPlayer(x, y, z)) { rejectPeerEdit(message.from, '不能把方块放进玩家身体'); return; }
      commitAuthoritativeBlockEdit(x, y, z, id, message.from);
    } else rejectPeerEdit(message.from, '未知操作');
  }

  function sendWelcome(peer) {
    if (gameMode !== 'host') return;
    const players = [localPosePacket()];
    for (const p of remotePlayers.values()) {
      if (p.id === peer.id) continue;
      players.push({ id: p.id, name: p.name, x: p.targetX, y: p.targetY, z: p.targetZ, yaw: p.targetYaw, pitch: p.targetPitch, flying: p.flying, grounded: p.grounded, speed: p.targetSpeed, selectedBlock: p.selectedBlock });
    }
    lan.send('welcome', {
      protocol: LAN_PROTOCOL,
      seed,
      spawn: networkSpawnNearHost(remotePlayers.size),
      players,
    }, { to: peer.id });
    lan.send('survivalConfig', { pvp: survival?.pvp !== false }, { to: peer.id });
    survival?.syncMobs(true);
  }

  function handleWelcome(message) {
    if (gameMode !== 'client' || Number(message.protocol) !== LAN_PROTOCOL || !Number.isInteger(Number(message.seed))) return;
    resetRuntimeWorldForNetwork(Number(message.seed));
    clearRemotePlayers();
    const spawn = sanitizedPose({ ...(message.spawn || {}), speed: 0, flying: false, grounded: false });
    if (!spawn) { setLanStatus('主机发送了无效出生点。', 'error'); return; }
    camera.x = spawn.x; camera.y = spawn.y; camera.z = spawn.z;
    camera.yaw = spawn.yaw; camera.pitch = spawn.pitch;
    player.velocityX = player.velocityY = player.velocityZ = 0;
    player.flying = false; player.grounded = false;
    for (const p of Array.isArray(message.players) ? message.players : []) upsertRemotePlayer(p.id, p.name, p);
    networkReadyForWorld = true;
    survival?.setMode('survival');
    updateChunkStreaming(true);
    processChunkLoadQueue(2);
    setLanStatus(`已加入主机世界 · 种子 ${seed}`, 'success');
    updateLanLabels();
    lanPanelOpen = false;
    lanPanel.classList.remove('visible');
    enterGame();
  }

  async function verifySameOriginLanService(address) {
    const wsAddress = window.VoxelLAN.normalizeAddress(address);
    let wsUrl;
    try { wsUrl = new URL(wsAddress, location.href); } catch { return; }
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    if (wsUrl.host !== location.host) return;
    const infoUrl = `${location.origin}/_lan/info`;
    let response;
    try { response = await fetch(infoUrl, { cache: 'no-store' }); }
    catch { throw new Error('无法访问局域网服务。请确认 start_lan 窗口仍在运行。'); }
    if (response.status === 404) {
      throw new Error('当前运行的是 Python 静态服务器，不支持联机。请关闭该窗口并双击 start_lan.bat；不要使用 python -m http.server。');
    }
    if (!response.ok || !(response.headers.get('content-type') || '').includes('application/json')) {
      throw new Error('当前网页服务不包含局域网 WebSocket。请改用 start_lan 脚本启动。');
    }
  }

  async function connectLan(role) {
    if (gameMode !== 'single' || lan.ready) {
      setLanStatus('已经处于联机模式，请先断开。', 'error');
      return;
    }
    saveLanProfile();
    const address = lanAddressInput.value.trim();
    lanHostButton.disabled = lanJoinButton.disabled = true;
    setLanStatus(role === 'host' ? '正在连接轻量服务并创建房间…' : '正在连接主机房间…');
    try {
      await verifySameOriginLanService(address);
      await lan.connect(address, role, lanPlayerName);
      gameMode = role;
      networkReadyForWorld = role === 'host';
      lanDisconnectButton.disabled = false;
      if (role === 'host') {
        setLanStatus(`主机房间已创建 · 世界种子 ${seed}`, 'success');
        updateLanLabels();
        lanPanelOpen = false;
        lanPanel.classList.remove('visible');
        enterGame();
      } else {
        setLanStatus('已连接服务，正在等待主机发送世界种子与出生点…');
        updateLanLabels();
      }
    } catch (error) {
      gameMode = 'single'; networkReadyForWorld = false;
      setLanStatus(error.message || '连接失败。', 'error');
      lan.close(false);
    } finally {
      lanHostButton.disabled = lanJoinButton.disabled = false;
      updateLanLabels();
    }
  }

  function disconnectLanAndReload() {
    suppressLanCloseNotice = true;
    lan.close();
    try { flushSave(); } catch { /* ignored */ }
    location.reload();
  }

  function updateNetwork(now) {
    if (!lan.ready || !networkReadyForWorld || now - lastPoseSentAt < POSE_INTERVAL_MS) return;
    lastPoseSentAt = now;
    const pose = localPosePacket();
    if (gameMode === 'host') lan.send('pose', pose, { broadcast: true });
    else if (gameMode === 'client') lan.send('pose', pose);
  }

  function setupLanProtocol() {
    loadLanProfile();
    updateLanLabels();
    lan.on('latency', () => updateLanLabels());
    lan.on('peerJoin', message => {
      if (gameMode !== 'host' || !message.peer) return;
      const spawn = networkSpawnNearHost(remotePlayers.size);
      upsertRemotePlayer(message.peer.id, message.peer.name, { ...spawn, speed: 0, grounded: false });
      sendWelcome(message.peer);
      showToast(`${message.peer.name} 加入了世界`);
      updateLanLabels();
    });
    lan.on('peerLeave', message => {
      if (!message.peer) return;
      removeRemotePlayer(message.peer.id);
      showToast(`${message.peer.name} 离开了世界`);
    });
    lan.on('welcome', handleWelcome);
    lan.on('chunkRequest', message => { if (gameMode === 'host') sendChunkSnapshot(message.from, Number(message.cx), Number(message.cz)); });
    lan.on('chunkSnapshot', applyChunkSnapshot);
    lan.on('editRequest', handlePeerEditRequest);
    lan.on('blockSet', message => { if (gameMode === 'client') applyNetworkBlockSet(message); });
    lan.on('editReject', message => { audio.error(); showToast(message.reason || '主机拒绝了操作'); });
    lan.on('pose', message => {
      if (gameMode === 'host') {
        const pose = sanitizedPose(message);
        if (!pose || !message.from) return;
        upsertRemotePlayer(message.from, message.fromName, pose);
        lan.send('pose', { id: message.from, name: message.fromName, ...pose }, { broadcast: true });
      } else if (gameMode === 'client') {
        const id = String(message.id || '');
        if (!id || id === lan.id) return;
        upsertRemotePlayer(id, message.name, message);
      }
    });
    for (const type of ['survivalConfig','mobSnapshot','mobAttack','loot','pvpAttack','playerDamage']) lan.on(type, message => survival?.onNet(type, message));
    lan.on('survivalBreak', message => {
      if(gameMode!=='host')return; const p=remotePlayers.get(message.from); const x=Number(message.x),y=Number(message.y),z=Number(message.z),id=Number(message.id);
      if(!p||![x,y,z,id].every(Number.isInteger)||Math.hypot(x+.5-p.targetX,y+.5-p.targetY,z+.5-p.targetZ)>11)return;
      if(getBlock(x,y,z)!==id||id===33)return; commitAuthoritativeBlockEdit(x,y,z,0,message.from);
    });
    lan.on('survivalPlace', message => {
      if(gameMode!=='host')return; const p=remotePlayers.get(message.from); const x=Number(message.x),y=Number(message.y),z=Number(message.z),id=Number(message.id);
      if(!p||![x,y,z,id].every(Number.isInteger)||id<=0||id>=BLOCKS.length||getBlock(x,y,z)!==0||Math.hypot(x+.5-p.targetX,y+.5-p.targetY,z+.5-p.targetZ)>11||blockIntersectsAnyPlayer(x,y,z))return;
      commitAuthoritativeBlockEdit(x,y,z,id,message.from);
    });
    lan.on('hostClosed', message => {
      networkReadyForWorld = false;
      document.exitPointerLock?.();
      setLanStatus(message.message || '主机已离开房间。', 'error');
      showToast('主机已离开 · 请断开并返回本地');
      updateLanLabels();
    });
    lan.on('close', info => {
      if (!info.wasReady || suppressLanCloseNotice) return;
      networkReadyForWorld = false;
      document.exitPointerLock?.();
      setLanStatus('联机连接已断开。点击“断开并返回本地”重新载入。', 'error');
      showToast('联机连接已断开');
      updateLanLabels();
    });
    lan.on('error', message => {
      if (message.code === 'HOST_EXISTS' || message.code === 'NO_HOST') setLanStatus(message.message, 'error');
    });
  }

  function angleLerp(a, b, t) {
    let delta = (b - a + Math.PI) % (Math.PI * 2) - Math.PI;
    if (delta < -Math.PI) delta += Math.PI * 2;
    return a + delta * t;
  }

  function nameHash(value) {
    let hash = 2166136261;
    for (const ch of String(value || 'player')) {
      hash ^= ch.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function hslToRgb(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = n => {
      const k = (n + h * 12) % 12;
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [f(0), f(8), f(4)];
  }

  function playerPalette(playerState) {
    const hash = nameHash(`${playerState.id}:${playerState.name}`);
    const shirt = hslToRgb(((hash % 360) / 360), .56, .48);
    const accent = hslToRgb((((hash >>> 8) % 360) / 360), .48, .32);
    const skinTone = (hash >>> 16) % 4;
    const skins = [[.76,.54,.37],[.90,.70,.52],[.55,.34,.22],[.36,.22,.15]];
    return {
      skin: skins[skinTone],
      hair: [.13 + (hash & 3) * .025, .09, .055],
      shirt,
      accent,
      pants: [.14,.20,.43],
      shoes: [.08,.08,.09],
      eyes: [.06,.10,.12],
    };
  }

  function shadeColor(color, shade) {
    return [Math.min(1, color[0] * shade), Math.min(1, color[1] * shade), Math.min(1, color[2] * shade)];
  }

  function appendModelCuboid(out, model, center, size, color, options = {}) {
    const yaw = model.yaw || 0;
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    const swing = options.swing || 0;
    const pivot = options.pivot || center;
    const cosS = Math.cos(swing), sinS = Math.sin(swing);
    const faceShades = [.80, .66, 1.0, .52, .86, .72];

    for (let faceIndex = 0; faceIndex < FACES.length; faceIndex++) {
      const face = FACES[faceIndex];
      const faceColor = shadeColor(color, faceShades[faceIndex]);
      for (const triangleIndex of TRI) {
        const corner = face.verts[triangleIndex];
        let lx = center[0] + (corner[0] - .5) * size[0];
        let ly = center[1] + (corner[1] - .5) * size[1];
        let lz = center[2] + (corner[2] - .5) * size[2];
        if (swing) {
          const dy = ly - pivot[1];
          const dz = lz - pivot[2];
          ly = pivot[1] + dy * cosS - dz * sinS;
          lz = pivot[2] + dy * sinS + dz * cosS;
        }
        const wx = model.x + lx * cosY + lz * sinY;
        const wz = model.z - lx * sinY + lz * cosY;
        const wy = model.feetY + ly;
        out.push(wx, wy, wz, faceColor[0], faceColor[1], faceColor[2]);
      }
    }
  }

  function blockModelColor(id) {
    const colors = [[.50,.50,.50],[.35,.66,.25],[.45,.28,.15],[.52,.52,.52],[.78,.70,.40],[.42,.25,.12],[.26,.53,.22],[.65,.24,.18],[.92,.76,.32],[.52,.34,.17],[.42,.42,.42],[.70,.84,.88]];
    return colors[Math.abs(Number(id) || 0) % colors.length];
  }

  function appendPlayerModel(out, p, now) {
    const palette = p.palette || (p.palette = playerPalette(p));
    const speedRatio = clamp((p.speed || 0) / SPRINT_SPEED, 0, 1.5);
    const phase = now * .011 * (1.2 + speedRatio * 1.8) + (nameHash(p.id) % 100) * .1;
    let walk = p.grounded && !p.flying ? Math.sin(phase) * .72 * speedRatio : 0;
    if (p.flying) walk = -1.05;
    const model = { x: p.x, z: p.z, feetY: p.y - EYE_HEIGHT, yaw: p.yaw };

    appendModelCuboid(out, model, [0, 1.17, 0], [.50, .68, .28], palette.shirt);
    appendModelCuboid(out, model, [0, 1.48, -.005], [.46, .10, .29], palette.accent);
    appendModelCuboid(out, model, [0, 1.72, 0], [.50, .50, .50], palette.skin);
    appendModelCuboid(out, model, [0, 1.955, .01], [.52, .07, .52], palette.hair);
    appendModelCuboid(out, model, [0, 1.83, .215], [.52, .23, .07], palette.hair);
    appendModelCuboid(out, model, [-.105, 1.76, -.258], [.065, .052, .025], palette.eyes);
    appendModelCuboid(out, model, [.105, 1.76, -.258], [.065, .052, .025], palette.eyes);
    appendModelCuboid(out, model, [0, 1.61, -.26], [.11, .035, .022], [.30,.12,.10]);

    appendModelCuboid(out, model, [-.35, 1.27, 0], [.19, .40, .20], palette.shirt, { swing: walk, pivot: [-.35, 1.48, 0] });
    appendModelCuboid(out, model, [-.35, .93, 0], [.17, .30, .18], palette.skin, { swing: walk, pivot: [-.35, 1.48, 0] });
    appendModelCuboid(out, model, [.35, 1.27, 0], [.19, .40, .20], palette.shirt, { swing: -walk, pivot: [.35, 1.48, 0] });
    appendModelCuboid(out, model, [.35, .93, 0], [.17, .30, .18], palette.skin, { swing: -walk, pivot: [.35, 1.48, 0] });

    appendModelCuboid(out, model, [-.14, .67, 0], [.22, .66, .23], palette.pants, { swing: -walk, pivot: [-.14, .98, 0] });
    appendModelCuboid(out, model, [.14, .67, 0], [.22, .66, .23], palette.pants, { swing: walk, pivot: [.14, .98, 0] });
    appendModelCuboid(out, model, [-.14, .20, -.025], [.23, .28, .31], palette.shoes, { swing: -walk, pivot: [-.14, .98, 0] });
    appendModelCuboid(out, model, [.14, .20, -.025], [.23, .28, .31], palette.shoes, { swing: walk, pivot: [.14, .98, 0] });

    if (p.selectedBlock) {
      appendModelCuboid(out, model, [.42, .78, -.18], [.25, .25, .25], blockModelColor(p.selectedBlock), { swing: -walk, pivot: [.35, 1.48, 0] });
    }
  }

  function updateRemoteInterpolation(dt) {
    const factor = 1 - Math.exp(-dt * 13);
    const now = performance.now();
    for (const [id, p] of remotePlayers) {
      if (now - p.lastSeen > 20000) { removeRemotePlayer(id); continue; }
      const distance = Math.hypot(p.targetX - p.x, p.targetY - p.y, p.targetZ - p.z);
      if (distance > 18) {
        p.x = p.targetX; p.y = p.targetY; p.z = p.targetZ;
      } else {
        p.x += (p.targetX - p.x) * factor;
        p.y += (p.targetY - p.y) * factor;
        p.z += (p.targetZ - p.z) * factor;
      }
      p.yaw = angleLerp(p.yaw, p.targetYaw, factor);
      p.pitch += (p.targetPitch - p.pitch) * factor;
      p.speed += (p.targetSpeed - p.speed) * factor;
    }
  }

  function rebuildPlayerBuffer(now) {
    const data = [];
    const drawDistance = quality === 0 ? 88 : 60;
    for (const p of remotePlayers.values()) {
      const dx = p.x - camera.x, dz = p.z - camera.z;
      if (dx * dx + dz * dz > drawDistance * drawDistance) continue;
      appendPlayerModel(data, p, now);
    }
    survival?.appendModels(data, appendModelCuboid);
    playerVertexCount = data.length / 6;
    gl.bindBuffer(gl.ARRAY_BUFFER, playerBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW);
  }

  function renderRemotePlayers(now) {
    if (!remotePlayers.size && !(survival?.entities?.size)) return;
    rebuildPlayerBuffer(now);
    if (!playerVertexCount) return;
    gl.useProgram(playerProgram);
    gl.uniformMatrix4fv(playerProgram.locations.projection, false, projection);
    gl.uniformMatrix4fv(playerProgram.locations.view, false, view);
    gl.uniform3f(playerProgram.locations.camera, camera.x, camera.y, camera.z);
    gl.uniform3f(playerProgram.locations.fogColor, .56, .78, .96);
    gl.uniform1f(playerProgram.locations.fogNear, quality === 0 ? 54 : 36);
    gl.uniform1f(playerProgram.locations.fogFar, quality === 0 ? 92 : 64);
    gl.bindBuffer(gl.ARRAY_BUFFER, playerBuffer);
    gl.enableVertexAttribArray(playerProgram.locations.pos);
    gl.vertexAttribPointer(playerProgram.locations.pos, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(playerProgram.locations.color);
    gl.vertexAttribPointer(playerProgram.locations.color, 3, gl.FLOAT, false, 24, 12);
    gl.drawArrays(gl.TRIANGLES, 0, playerVertexCount);
  }

  function projectWorldPoint(x, y, z) {
    const vx = view[0] * x + view[4] * y + view[8] * z + view[12];
    const vy = view[1] * x + view[5] * y + view[9] * z + view[13];
    const vz = view[2] * x + view[6] * y + view[10] * z + view[14];
    const vw = view[3] * x + view[7] * y + view[11] * z + view[15];
    const cx = projection[0] * vx + projection[4] * vy + projection[8] * vz + projection[12] * vw;
    const cy = projection[1] * vx + projection[5] * vy + projection[9] * vz + projection[13] * vw;
    const cw = projection[3] * vx + projection[7] * vy + projection[11] * vz + projection[15] * vw;
    if (cw <= .001) return null;
    const nx = cx / cw, ny = cy / cw;
    return { x: (nx * .5 + .5) * innerWidth, y: (-ny * .5 + .5) * innerHeight, visible: Math.abs(nx) < 1.1 && Math.abs(ny) < 1.1 };
  }

  function updatePlayerTags() {
    if (gameMode === 'single') {
      for (const element of playerTagElements.values()) element.style.display = 'none';
      return;
    }
    for (const [id, p] of remotePlayers) {
      let element = playerTagElements.get(id);
      if (!element) {
        element = document.createElement('div');
        element.className = 'player-name-tag';
        playerTags.appendChild(element);
        playerTagElements.set(id, element);
      }
      element.textContent = `${p.name}${p.flying ? ' ✦' : ''}`;
      const screen = projectWorldPoint(p.x, p.y + .48, p.z);
      const distance = Math.hypot(p.x - camera.x, p.y - camera.y, p.z - camera.z);
      if (!screen || !screen.visible || distance > 45) element.style.display = 'none';
      else {
        element.style.display = 'block';
        element.style.left = `${screen.x}px`;
        element.style.top = `${screen.y}px`;
        element.style.opacity = String(clamp(1 - distance / 60, .35, 1));
      }
    }
  }

  function updateCameraMatrices() {
    const f = forwardVector();
    Mat4.lookAt(view, [camera.x, camera.y, camera.z], [camera.x + f[0], camera.y + f[1], camera.z + f[2]], [0, 1, 0]);
  }

  function render(now) {
    resize();
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    updateCameraMatrices();

    gl.useProgram(program);
    gl.uniformMatrix4fv(program.locations.projection, false, projection);
    gl.uniformMatrix4fv(program.locations.view, false, view);
    gl.uniform3f(program.locations.camera, camera.x, camera.y, camera.z);
    gl.uniform3f(program.locations.fogColor, .56, .78, .96);
    gl.uniform1f(program.locations.fogNear, quality === 0 ? 54 : 36);
    gl.uniform1f(program.locations.fogFar, quality === 0 ? 92 : 64);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
    gl.uniform1i(program.locations.atlas, 0);

    const drawDistance = quality === 0 ? 88 : 60;
    for (const chunk of chunks.values()) {
      const dx = chunk.centerX - camera.x;
      const dz = chunk.centerZ - camera.z;
      if (dx * dx + dz * dz > drawDistance * drawDistance || chunk.count === 0) continue;
      gl.bindVertexArray(chunk.vao);
      gl.drawArrays(gl.TRIANGLES, 0, chunk.count);
    }
    gl.bindVertexArray(null);

    renderRemotePlayers(now);

    if (outlineVertexCount) {
      gl.useProgram(lineProgram);
      gl.uniformMatrix4fv(lineProgram.locations.projection, false, projection);
      gl.uniformMatrix4fv(lineProgram.locations.view, false, view);
      gl.bindBuffer(gl.ARRAY_BUFFER, outlineBuffer);
      gl.enableVertexAttribArray(lineProgram.locations.pos);
      gl.vertexAttribPointer(lineProgram.locations.pos, 3, gl.FLOAT, false, 0, 0);
      gl.lineWidth(2);
      gl.drawArrays(gl.LINES, 0, outlineVertexCount);
    }
    updatePlayerTags();
  }

  function setXrayEnabled(enabled) {
    xrayEnabled = Boolean(enabled);
    for (const key of chunks.keys()) meshQueue.add(key);
    document.body.classList.toggle('xray-enabled', xrayEnabled);
    let badge = document.getElementById('xray-hud-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'xray-hud-badge';
      badge.textContent = '矿透 X';
      document.getElementById('hud')?.appendChild(badge);
    }
    badge.classList.toggle('visible', xrayEnabled);
    audio.uiClick(true);
    showToast(xrayEnabled ? '矿透已开启 · 仅显示煤、铁、金、钻石矿' : '矿透已关闭');
  }

  function updateHUD() {
    const hit = currentTarget;
    const cx = Math.floor(camera.x / CHUNK_SIZE);
    const cz = Math.floor(camera.z / CHUNK_SIZE);
    const networkMode = gameMode === 'host' ? `主机 ${1 + remotePlayers.size}人` : (gameMode === 'client' ? `客户端 ${1 + remotePlayers.size}人` : '单人');
    debugLine.textContent = `XYZ ${camera.x.toFixed(1)} / ${camera.y.toFixed(1)} / ${camera.z.toFixed(1)} · 区块 ${cx}, ${cz} · ${chunks.size} 已加载 · ${networkMode}${xrayEnabled ? ' · 矿透开启' : ''} · ${Math.round(fpsSmooth)} FPS`;
    const mode = player.flying ? `飞行 ×${camera.speedMultiplier.toFixed(1)}` : (player.grounded ? '地面' : '空中');
    targetLine.textContent = hit
      ? `${BLOCKS[hit.id].name} · ${hit.x}, ${hit.y}, ${hit.z} · 距离 ${hit.distance.toFixed(1)} · ${mode}`
      : `${survival?.enabled ? '生存模式' : '创造模式'} · ${mode} · 种子 ${seed} · 无水无限地形`;
  }

  function frame(now) {
    const dt = Math.min(.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    const instantFps = dt > 0 ? 1 / dt : 60;
    fpsSmooth += (instantFps - fpsSmooth) * .05;
    updatePlayer(dt);
    updateRemoteInterpolation(dt);
    updateNetwork(now);
    audio.updateAmbience({
      active,
      altitude: camera.y - EYE_HEIGHT,
      surface: heightAt(Math.floor(camera.x), Math.floor(camera.z)),
      speed: Math.hypot(player.velocityX, player.velocityY, player.velocityZ),
      flying: player.flying,
    });
    processChunkLoadQueue(quality === 0 ? 1 : 2);
    processMeshQueue(quality === 0 ? 1 : 2);
    currentTarget = active ? raycast() : null;
    survival?.updateMining(dt, currentTarget, primaryHeld);
    survival?.update(dt, now);
    updateOutline(currentTarget);
    render(now);
    updateHUD();
    requestAnimationFrame(frame);
  }

  function cloneDefaults() { return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); }

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      if (!saved || typeof saved !== 'object') return;
      settings.sensitivity = Number.isFinite(saved.sensitivity) ? Math.max(.2, Math.min(3, saved.sensitivity)) : settings.sensitivity;
      settings.fov = Number.isFinite(saved.fov) ? Math.max(55, Math.min(100, saved.fov)) : settings.fov;
      settings.invertX = Boolean(saved.invertX);
      settings.invertY = Boolean(saved.invertY);
      settings.masterVolume = Number.isFinite(saved.masterVolume) ? Math.max(0, Math.min(100, saved.masterVolume)) : settings.masterVolume;
      settings.effectsVolume = Number.isFinite(saved.effectsVolume) ? Math.max(0, Math.min(100, saved.effectsVolume)) : settings.effectsVolume;
      settings.ambientVolume = Number.isFinite(saved.ambientVolume) ? Math.max(0, Math.min(100, saved.ambientVolume)) : settings.ambientVolume;
      settings.mute = Boolean(saved.mute);
      if (saved.bindings && typeof saved.bindings === 'object') {
        for (const action of Object.keys(settings.bindings)) {
          if (typeof saved.bindings[action] === 'string' && saved.bindings[action]) settings.bindings[action] = saved.bindings[action];
        }
      }
    } catch { settings = cloneDefaults(); }
  }

  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* 忽略存储限制 */ }
    audio.configure(settings);
  }

  function isActionDown(action) { return Boolean(keys[settings.bindings[action]]); }

  function formatKey(code) {
    const names = { Space: '空格', ControlLeft: '左 Ctrl', ControlRight: '右 Ctrl', ShiftLeft: '左 Shift', ShiftRight: '右 Shift', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
    if (names[code]) return names[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    return code.replace('Left', ' 左').replace('Right', ' 右');
  }

  function updateControlLabels() {
    document.querySelectorAll('[data-control-action]').forEach(el => {
      const action = el.dataset.controlAction;
      el.textContent = formatKey(settings.bindings[action]);
    });
    document.querySelectorAll('.binding-button').forEach(button => {
      const action = button.dataset.binding;
      button.textContent = rebindingAction === action ? '请按新按键…' : formatKey(settings.bindings[action]);
      button.classList.toggle('capturing', rebindingAction === action);
    });
    document.getElementById('help-chip').textContent = `ESC 暂停 · ${formatKey(settings.bindings.inventory)} 背包 · 双击 ${formatKey(settings.bindings.jump)} 切换飞行`;
  }

  function renderSettings() {
    sensitivityInput.value = String(settings.sensitivity);
    sensitivityValue.textContent = `${settings.sensitivity.toFixed(2)}×`;
    fovInput.value = String(settings.fov);
    fovValue.textContent = `${Math.round(settings.fov)}°`;
    invertXInput.checked = settings.invertX;
    invertYInput.checked = settings.invertY;
    masterVolumeInput.value = String(settings.masterVolume);
    masterVolumeValue.textContent = `${Math.round(settings.masterVolume)}%`;
    effectsVolumeInput.value = String(settings.effectsVolume);
    effectsVolumeValue.textContent = `${Math.round(settings.effectsVolume)}%`;
    ambientVolumeInput.value = String(settings.ambientVolume);
    ambientVolumeValue.textContent = `${Math.round(settings.ambientVolume)}%`;
    muteInput.checked = settings.mute;
    audio.configure(settings);
    updateControlLabels();
  }

  function openSettings() {
    audio.unlock();
    audio.uiClick();
    settingsOpen = true;
    rebindingAction = null;
    menu.classList.remove('visible');
    settingsPanel.classList.add('visible');
    renderSettings();
  }

  function closeSettings() {
    audio.uiClick(true);
    settingsOpen = false;
    rebindingAction = null;
    settingsPanel.classList.remove('visible');
    menu.classList.add('visible');
    updateControlLabels();
  }

  function openInventory() {
    if (survival?.enabled) { survival.openUI('inventory'); return; }
    if (!active || inventoryOpen) return;
    audio.inventory(true);
    inventoryOpen = true;
    for (const key of Object.keys(keys)) keys[key] = false;
    buildInventory();
    inventoryPanel.classList.add('visible');
    menu.classList.remove('visible');
    document.exitPointerLock?.();
  }

  function closeInventory(resume = true) {
    audio.inventory(false);
    inventoryOpen = false;
    inventoryPanel.classList.remove('visible');
    if (resume) canvas.requestPointerLock?.();
    else menu.classList.add('visible');
  }

  function enterGame() {
    if (gameMode === 'client' && !networkReadyForWorld) {
      audio.error();
      showToast('正在等待主机世界或连接已断开');
      openLanPanel();
      return;
    }
    audio.unlock().then(() => {
      if (!hasEnteredWorld) {
        hasEnteredWorld = true;
        audio.worldEnter();
      }
    });
    canvas.requestPointerLock?.();
  }

  function findSafeSpawn() {
    const savedPosition = Number.isFinite(camera.x) && Number.isFinite(camera.y) && Number.isFinite(camera.z) && (camera.x !== .5 || camera.z !== .5);
    if (savedPosition && !collidesAt(camera.x, camera.y, camera.z)) return;
    for (let radius = 0; radius <= 18; radius++) {
      for (let z = -radius; z <= radius; z++) {
        for (let x = -radius; x <= radius; x++) {
          if (radius > 0 && Math.abs(x) !== radius && Math.abs(z) !== radius) continue;
          const h = heightAt(x, z);
          if (getBlock(x, h, z) === 0 || getBlock(x, h + 1, z) !== 0 || getBlock(x, h + 2, z) !== 0) continue;
          camera.x = x + .5;
          camera.z = z + .5;
          camera.y = h + 1 + EYE_HEIGHT + .01;
          return;
        }
      }
    }
    camera.x = .5;
    camera.z = .5;
    camera.y = heightAt(0, 0) + 1 + EYE_HEIGHT + .01;
  }

  function bindEvents() {
    window.addEventListener('resize', resize);
    document.addEventListener('pointerdown', () => audio.unlock(), { passive: true });
    document.addEventListener('keydown', () => audio.unlock());
    document.addEventListener('click', event => {
      const button = event.target.closest?.('button');
      if (button && button !== soundPreviewButton && button !== playButton && button !== settingsButton && button !== settingsCloseButton) audio.uiClick(true);
    });
    playButton.addEventListener('click', enterGame);
    canvas.addEventListener('click', () => { if (!active && !inventoryOpen && !settingsOpen && !lanPanelOpen) enterGame(); });
    lanButton.addEventListener('click', openLanPanel);
    lanCloseButton.addEventListener('click', closeLanPanel);
    lanHostButton.addEventListener('click', () => connectLan('host'));
    lanJoinButton.addEventListener('click', () => connectLan('client'));
    lanDisconnectButton.addEventListener('click', disconnectLanAndReload);
    lanNameInput.addEventListener('change', saveLanProfile);
    lanAddressInput.addEventListener('change', saveLanProfile);
    settingsButton.addEventListener('click', openSettings);
    settingsCloseButton.addEventListener('click', closeSettings);
    settingsResetButton.addEventListener('click', () => {
      settings = cloneDefaults();
      rebindingAction = null;
      saveSettings();
      renderSettings();
      resize();
      showToast('设置已恢复默认');
    });
    inventoryCloseButton.addEventListener('click', () => closeInventory(true));

    sensitivityInput.addEventListener('input', () => {
      settings.sensitivity = Number(sensitivityInput.value);
      sensitivityValue.textContent = `${settings.sensitivity.toFixed(2)}×`;
      saveSettings();
    });
    fovInput.addEventListener('input', () => {
      settings.fov = Number(fovInput.value);
      fovValue.textContent = `${Math.round(settings.fov)}°`;
      saveSettings(); resize();
    });
    invertXInput.addEventListener('change', () => { settings.invertX = invertXInput.checked; saveSettings(); });
    invertYInput.addEventListener('change', () => { settings.invertY = invertYInput.checked; saveSettings(); });
    masterVolumeInput.addEventListener('input', () => {
      settings.masterVolume = Number(masterVolumeInput.value);
      masterVolumeValue.textContent = `${Math.round(settings.masterVolume)}%`;
      saveSettings();
    });
    effectsVolumeInput.addEventListener('input', () => {
      settings.effectsVolume = Number(effectsVolumeInput.value);
      effectsVolumeValue.textContent = `${Math.round(settings.effectsVolume)}%`;
      saveSettings();
    });
    ambientVolumeInput.addEventListener('input', () => {
      settings.ambientVolume = Number(ambientVolumeInput.value);
      ambientVolumeValue.textContent = `${Math.round(settings.ambientVolume)}%`;
      saveSettings();
    });
    muteInput.addEventListener('change', () => { settings.mute = muteInput.checked; saveSettings(); });
    soundPreviewButton.addEventListener('click', () => audio.preview());
    document.querySelectorAll('.binding-button').forEach(button => {
      button.addEventListener('click', () => { rebindingAction = button.dataset.binding; updateControlLabels(); });
    });

    newWorldButton.addEventListener('click', () => {
      if (gameMode !== 'single') { audio.error(); showToast('联机中只能由主机当前世界继续运行'); return; }
      clearWorldSave();
      location.reload();
    });
    qualityButton.addEventListener('click', () => {
      quality = quality ? 0 : 1;
      qualityButton.textContent = quality === 0 ? '视距：高' : '视距：流畅';
      streamForce = true;
      updateChunkStreaming(true);
      showToast(quality === 0 ? '高视距模式' : '流畅模式');
    });

    document.addEventListener('pointerlockchange', () => {
      active = document.pointerLockElement === canvas;
      if (active) {
        menu.classList.remove('visible');
        inventoryPanel.classList.remove('visible');
        settingsPanel.classList.remove('visible');
        lastTime = performance.now();
      } else if (survival?.uiOpen) {
        menu.classList.remove('visible');
        survival.panel.classList.add('visible');
      } else if (inventoryOpen) {
        menu.classList.remove('visible');
        inventoryPanel.classList.add('visible');
      } else if (settingsOpen) {
        menu.classList.remove('visible');
        settingsPanel.classList.add('visible');
      } else if (lanPanelOpen) {
        menu.classList.remove('visible');
        lanPanel.classList.add('visible');
      } else {
        menu.classList.add('visible');
        flushSave();
      }
    });
    document.addEventListener('mousemove', event => {
      if (!active) return;
      const xScale = BASE_MOUSE_SCALE * settings.sensitivity * (settings.invertX ? 1 : -1);
      const yScale = BASE_MOUSE_SCALE * settings.sensitivity * (settings.invertY ? 1 : -1);
      camera.yaw += event.movementX * xScale;
      camera.pitch += event.movementY * yScale;
      camera.pitch = Math.max(-Math.PI / 2 + .012, Math.min(Math.PI / 2 - .012, camera.pitch));
    });
    document.addEventListener('keydown', event => {
      if (lanPanelOpen) {
        if (event.code === 'Escape') { event.preventDefault(); closeLanPanel(); }
        return;
      }
      if (settingsOpen) {
        if (rebindingAction) {
          event.preventDefault();
          if (event.code === 'Escape') rebindingAction = null;
          else { settings.bindings[rebindingAction] = event.code; rebindingAction = null; saveSettings(); }
          renderSettings();
        } else if (event.code === 'Escape') {
          event.preventDefault();
          closeSettings();
        }
        return;
      }
      if (survival?.uiOpen) {
        if (event.code === settings.bindings.inventory || event.code === 'Escape') { event.preventDefault(); survival.closeUI(event.code !== 'Escape'); }
        return;
      }
      if (inventoryOpen) {
        if (event.code === settings.bindings.inventory) { event.preventDefault(); closeInventory(true); return; }
        if (event.code === 'Escape') { event.preventDefault(); closeInventory(false); return; }
        if (event.code.startsWith('Digit')) {
          const n = Number(event.code.slice(5));
          if (n >= 1 && n <= HOTBAR.length) setSelectedSlot(n - 1, true);
        }
        return;
      }

      if (!active) return;
      keys[event.code] = true;
      if (event.code === 'KeyX' && !event.repeat) {
        event.preventDefault();
        setXrayEnabled(!xrayEnabled);
        return;
      }
      if (event.code.startsWith('Digit')) {
        const n = Number(event.code.slice(5));
        if (n >= 1 && n <= HOTBAR.length) setSelectedSlot(n - 1);
      }
      if (event.code === settings.bindings.inventory && !event.repeat && active) { event.preventDefault(); openInventory(); return; }
      if (event.code === settings.bindings.jump && !event.repeat && active) requestJumpOrFlightToggle();
      if (event.code === settings.bindings.speed && !event.repeat && flyingAllowed) {
        camera.speedMultiplier = camera.speedMultiplier > 1 ? 1 : 1.8;
        audio.uiClick();
        showToast(`飞行速度 ×${camera.speedMultiplier.toFixed(1)}`);
      }
      if ([settings.bindings.jump, settings.bindings.sneak, settings.bindings.sprint].includes(event.code)) event.preventDefault();
    });
    document.addEventListener('keyup', event => { keys[event.code] = false; });
    window.addEventListener('blur', () => {
      for (const key of Object.keys(keys)) keys[key] = false;
      flushSave();
    });
    window.addEventListener('beforeunload', flushSave);
    canvas.addEventListener('mousedown', event => {
      if (!active) return;
      if (event.button === 0) { primaryHeld = true; removeBlock(); }
      else if (event.button === 2) placeBlock();
    });
    document.addEventListener('mouseup', event => { if (event.button === 0) { primaryHeld = false; survival?.endPrimary(); } });
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    canvas.addEventListener('wheel', event => {
      if (!active) return;
      event.preventDefault();
      setSelectedSlot(selectedSlot + (event.deltaY > 0 ? 1 : -1));
    }, { passive: false });
  }

  async function init() {
    try {
      progress(1, '检查启动模块…');
      await new Promise(resolve => setTimeout(resolve, 0));
      const missing = [];
      if (typeof window.PerlinNoise !== 'function') missing.push('noise.js');
      if (!window.VoxelTextures || typeof window.VoxelTextures.loadImage !== 'function') missing.push('textures.js');
      if (typeof window.VoxelAudio !== 'function') missing.push('audio.js');
      if (typeof window.VoxelLAN !== 'function') missing.push('lan.js');
      if (missing.length) throw new Error(`缺少启动模块：${missing.join(', ')}。请关闭旧服务器，从新版文件夹重新运行 start_lan.bat，然后按 Ctrl+Shift+R。`);
      progress(2, '初始化音频与局域网模块…');
      audio = new window.VoxelAudio();
      lan = new window.VoxelLAN();
      progress(3, '读取控制设置…');
      loadSettings();
      audio.configure(settings);
      progress(5, '检测显卡与 WebGL…');
      await new Promise(resolve => requestAnimationFrame(resolve));
      setupWebGL();
      progress(16, '载入原创 32×32 材质图集…');
      await setupTexture();
      progress(27, '读取世界种子与脏区块记录…');
      loadSave();
      noise = new window.PerlinNoise(seed);
      progress(38, '定位安全出生点…');
      findSafeSpawn();
      player.flying = false;
      player.grounded = true;
      player.velocityY = 0;
      setupOutline();
      buildHotbar();
      buildInventory();
      renderSettings();

      const centerCX = Math.floor(camera.x / CHUNK_SIZE);
      const centerCZ = Math.floor(camera.z / CHUNK_SIZE);
      const initialRadius = 1;
      let done = 0;
      const total = (initialRadius * 2 + 1) ** 2;
      for (let dz = -initialRadius; dz <= initialRadius; dz++) {
        for (let dx = -initialRadius; dx <= initialRadius; dx++) {
          ensureChunk(centerCX + dx, centerCZ + dz);
          done++;
          progress(40 + Math.round(done / total * 28), `生成噪声区块 ${done} / ${total}…`);
          if (done % 7 === 0) await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      progress(70, '构建区块可见表面…');
      let meshed = 0;
      while (meshQueue.size) {
        processMeshQueue(4);
        meshed += 4;
        progress(70 + Math.min(25, Math.round(meshed / total * 25)), `构建区块网格 ${Math.min(meshed, total)} / ${total}…`);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      lastStreamCX = centerCX;
      lastStreamCZ = centerCZ;
      streamForce = true;
      progress(96, '启用重力、碰撞、生存系统、玩家模型与局域网协议…');
      if (!window.VoxelSurvival || typeof window.VoxelSurvival.create !== 'function') {
        throw new Error('Survival module was not initialized. Reload with Ctrl+F5 or verify js/app.js is served completely.');
      }
      survival = window.VoxelSurvival.create({
        blockName: id => BLOCKS[id]?.name || `方块 ${id}`,
        camera: () => ({ x: camera.x, y: camera.y, z: camera.z }),
        forward: forwardVector,
        surface: (x,z) => heightAt(Math.floor(x), Math.floor(z)),
        horizontalSpeed: () => Math.hypot(player.velocityX, player.velocityZ),
        currentTarget: () => currentTarget,
        mode: () => gameMode,
        localId: () => lan.id || 'local',
        playerName: () => lanPlayerName,
        remote: id => remotePlayers.get(id),
        remoteInSight: max => {
          const f=forwardVector(); let best=null,bd=max;
          for(const p of remotePlayers.values()){const dx=p.x-camera.x,dy=p.y-camera.y,dz=p.z-camera.z,d=Math.hypot(dx,dy,dz);if(d>bd)continue;const dot=(dx*f[0]+dy*f[1]+dz*f[2])/d;if(dot>.94){best=p;bd=d;}}
          return best;
        },
        toast: showToast,
        setFlyingAllowed: allowed => { flyingAllowed=allowed; if(!allowed){player.flying=false;camera.speedMultiplier=1;} },
        setHeldBlock: (itemId,iconUrl) => {
          const item=window.VoxelSurvival.ITEMS[itemId]; selectedBlock=item?.block||0; updateHeldBlock();
          let sprite=heldBlock.querySelector('.held-item-sprite');if(!sprite){sprite=document.createElement('span');sprite.className='held-item-sprite';heldBlock.appendChild(sprite);}
          const nonBlock=Boolean(itemId&&!item?.block);heldBlock.classList.toggle('held-flat-item',nonBlock);sprite.style.backgroundImage=nonBlock&&iconUrl?`url(${iconUrl})`:'';
        },
        breakBlock: (hit, done) => {
          if(gameMode==='client'){lan.send('survivalBreak',{x:hit.x,y:hit.y,z:hit.z,id:hit.id}); done?.(); return;}
          if(commitAuthoritativeBlockEdit(hit.x,hit.y,hit.z,0,lan.id||'local')){audio.break(blockSound(hit.id));done?.();}
        },
        placeBlock: (id, done) => {
          const hit=raycast();if(!hit)return;const q=hit.previous;if(q.y<0||q.y>=WORLD_H||blockIntersectsPlayer(q.x,q.y,q.z)||getBlock(q.x,q.y,q.z)!==0)return;
          if(gameMode==='client'){lan.send('survivalPlace',{x:q.x,y:q.y,z:q.z,id});done?.();return;}
          if(commitAuthoritativeBlockEdit(q.x,q.y,q.z,id,lan.id||'local')){audio.place(blockSound(id));done?.();}
        },
        netSend: (type,data,opts={}) => lan.ready && lan.send(type,data,opts),
        releasePointer: () => document.exitPointerLock?.(),
        capturePointer: () => canvas.requestPointerLock?.(),
        respawn: () => { camera.x=.5;camera.z=.5;camera.y=heightAt(0,0)+1+EYE_HEIGHT+.01;player.velocityX=player.velocityY=player.velocityZ=0; }
      });
      survival.setMode(window.VoxelModePreference?.get?.() || 'survival');
      setupLanProtocol();
      bindEvents();
      if (dirtySaveChunks.size) flushSave();
      resize();
      requestAnimationFrame(frame);
      progress(100, '世界已就绪');
      setTimeout(() => {
        loading.classList.remove('visible');
        menu.classList.add('visible');
      }, 220);
    } catch (error) {
      console.error(error);
      progressBar.style.width = '100%';
      progressBar.style.background = '#b64d4d';
      loadingText.textContent = `启动失败：${error.message}`;
    }
  }

  init();
})();
