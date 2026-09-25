import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Biohazard, BookOpen, Bot, Crosshair, Factory, Flame, Play, Radio, RotateCcw, Shield, ShieldCheck, Skull, Target, Users, Volume2, VolumeX, Dices } from "lucide-react";

type Nation={id:string;name:string;short:string;population:number;defense:number;missiles:number;color:string;ai:string;streak:number;lastBuild:string};
type Hate=Record<string,Record<string,number>>;
type Log={turn:number;actor:string;text:string};
type Visual={kind:string;actor:string;to?:string;blocked?:boolean}|null;
type SetupNation={id:string;name:string;short:string;population:number;defense:number;missiles:number;hateToPlayer:number;color:string;ai:string};

const IDS=["player","north","ember","isles","vault"];
const DEFAULT_SETUP:SetupNation[]=[
 {id:"player",name:"曙光共和國",short:"曙光",population:38,defense:2,missiles:2,hateToPlayer:20,color:"cyan",ai:"player"},
 {id:"north",name:"北境聯盟",short:"北境",population:32,defense:3,missiles:2,hateToPlayer:52,color:"slate",ai:"defensive"},
 {id:"ember",name:"赤焰共同體",short:"赤焰",population:41,defense:2,missiles:3,hateToPlayer:58,color:"red",ai:"aggressive"},
 {id:"isles",name:"群島議會",short:"群島",population:24,defense:2,missiles:1,hateToPlayer:46,color:"green",ai:"propaganda"},
 {id:"vault",name:"地堡公國",short:"地堡",population:19,defense:3,missiles:2,hateToPlayer:55,color:"violet",ai:"defensive"}
];
const COMMANDS=[
 {id:"propaganda",label:"政治宣傳",Icon:Radio,help:"吸收目標 1–3M 人口"},
 {id:"produce",label:"生產核彈",Icon:Factory,help:"依人口生產 1–5 枚"},
 {id:"defend",label:"部署防禦",Icon:ShieldCheck,help:"防禦 +1，上限 3"},
 {id:"attack",label:"發射核彈",Icon:Crosshair,help:"消耗 1 枚核彈攻擊目標"}
];
const wait=(n:number)=>new Promise(r=>setTimeout(r,n));
const rng=(turn:number,salt:number)=>{const x=Math.sin(turn*977+salt*137)*10000;return x-Math.floor(x)};
const randomInt=(min:number,max:number)=>Math.floor(Math.random()*(max-min+1))+min;
const clamp=(n:number,min=20,max=100)=>Math.max(min,Math.min(max,n));
function makeGame(setup:SetupNation[]){
 const nations:Nation[]=setup.map(({hateToPlayer,...n})=>({...n,streak:0,lastBuild:""}));
 const hate:Hate={};
 IDS.forEach(a=>{hate[a]={};IDS.forEach(b=>{if(a!==b)hate[a][b]=randomInt(40,60)})});
 setup.filter(n=>n.id!=="player").forEach(n=>hate[n.id].player=clamp(n.hateToPlayer));
 return{nations,hate};
}
function produced(pop:number){const base=1+Math.floor(pop/18);return Math.max(1,Math.min(5,base+randomInt(0,2)))}
function hateClass(v:number){return v<=40?"hate green":v<=70?"hate yellow":"hate red"}
function beep(kind:string,on:boolean){if(!on)return;const AC=window.AudioContext||(window as any).webkitAudioContext,c=new AC(),o=c.createOscillator(),g=c.createGain();const p:any={produce:[170,"square"],defend:[340,"triangle"],propaganda:[520,"sine"],attack:[100,"sawtooth"],death:[48,"sawtooth"]};const [f,t]=p[kind]||[440,"sine"];o.frequency.value=f;o.type=t;g.gain.setValueAtTime(.06,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.25);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.25)}

export default function App(){
 const [setup,setSetup]=useState<SetupNation[]>(()=>structuredClone(DEFAULT_SETUP));
 const initial=useRef(makeGame(DEFAULT_SETUP));
 const [started,setStarted]=useState(false),[nations,setNations]=useState(initial.current.nations),[hate,setHate]=useState(initial.current.hate),[turn,setTurn]=useState(1),[target,setTarget]=useState("ember"),[command,setCommand]=useState("propaganda"),[busy,setBusy]=useState(false),[phase,setPhase]=useState("玩家待命"),[visual,setVisual]=useState<Visual>(null),[audio,setAudio]=useState(true),[logs,setLogs]=useState<Log[]>([{turn:0,actor:"系統",text:"五國進入高度戒備。"}]);
 const nRef=useRef(nations),hRef=useRef(hate);nRef.current=nations;hRef.current=hate;
 const player=nations[0],living=nations.filter(n=>n.population>0),winner=living.length===1?living[0]:null;
 const commitN=(fn:(s:Nation[])=>Nation[])=>{const x=fn(nRef.current);nRef.current=x;setNations(x)};
 const commitH=(fn:(s:Hate)=>Hate)=>{const x=fn(structuredClone(hRef.current));hRef.current=x;setHate(x)};
 const log=(text:string,actor="系統")=>setLogs(v=>[{turn,actor,text},...v]);
 const updateSetup=(id:string,key:keyof SetupNation,value:number)=>setSetup(v=>v.map(n=>n.id===id?{...n,[key]:value}:n));
 const randomizeSetup=()=>setSetup(v=>v.map(n=>({...n,population:randomInt(18,55),missiles:randomInt(0,5),defense:randomInt(0,3),hateToPlayer:n.id==="player"?20:randomInt(40,60)})));
 function begin(){const g=makeGame(setup);nRef.current=g.nations;hRef.current=g.hate;setNations(g.nations);setHate(g.hate);setTurn(1);setTarget(setup.find(n=>n.id!=="player")!.id);setCommand("propaganda");setLogs([{turn:0,actor:"系統",text:"依開局設定建立新戰局。"}]);setStarted(true)}
 function changeHate(o:string,s:string,d:number){if(o===s)return;commitH(h=>{const raw=(h[o][s]??40)+d,over=Math.max(0,raw-100);h[o][s]=clamp(raw);if(over)Object.keys(h[o]).filter(k=>k!==s).forEach(k=>h[o][k]=clamp(h[o][k]-over));return h})}
 function relief(a:string,v:string,x:number){IDS.filter(id=>id!==a&&id!==v).forEach(o=>{const n=nRef.current.find(q=>q.id===o);if(n&&n.population>0&&(hRef.current[o]?.[v]??0)>70)changeHate(o,a,-x)})}
 function weightedTarget(a:string){const opts=nRef.current.filter(n=>n.id!==a&&n.population>0);const total=opts.reduce((s,n)=>s+(hRef.current[a]?.[n.id]??40),0);let r=Math.random()*total;for(const n of opts){r-=hRef.current[a]?.[n.id]??40;if(r<=0)return n.id}return opts.at(-1)?.id}
 async function show(kind:string,actor:string,to?:string,blocked=false){setVisual({kind,actor,to,blocked});beep(kind,audio);await wait(kind==="attack"?850:560);setVisual(null)}
 async function die(v:string,k:string){const n=nRef.current.find(x=>x.id===v);if(!n||n.population>0)return;setVisual({kind:"death",actor:n.name});beep("death",audio);await wait(600);setVisual(null);log(`${n.name}人口歸零，立即滅亡並退出行動。`,n.name);relief(k,v,20)}
 async function act(aid:string,kind:string,wanted?:string){const a=nRef.current.find(n=>n.id===aid);if(!a||a.population<=0)return;const vid=nRef.current.some(n=>n.id===wanted&&n.population>0&&n.id!==aid)?wanted:weightedTarget(aid),v=nRef.current.find(n=>n.id===vid);setPhase(`${a.short}正在行動`);
  if(kind==="produce"||kind==="defend"){const streak=a.lastBuild===kind?a.streak+1:1;if(kind==="produce"){const q=produced(a.population);await show("produce",a.name);commitN(s=>s.map(n=>n.id===aid?{...n,missiles:n.missiles+q,lastBuild:kind,streak}:n));log(`${a.name}生產 ${q} 枚核彈，庫存 ${a.missiles+q}。`,a.name)}else{await show("defend",a.name);commitN(s=>s.map(n=>n.id===aid?{...n,defense:Math.min(3,n.defense+1),lastBuild:kind,streak}:n));log(`${a.name}部署防禦，目前 ${Math.min(3,a.defense+1)}/3。`,a.name)}if(streak>=2)IDS.filter(id=>id!==aid).forEach(id=>changeHate(id,aid,5));return}
  commitN(s=>s.map(n=>n.id===aid?{...n,lastBuild:"",streak:0}:n));
  if(kind==="propaganda"&&v){await show(kind,a.name,v.name);const moved=randomInt(1,3);commitN(s=>s.map(n=>n.id===aid?{...n,population:n.population+moved}:n.id===v.id?{...n,population:Math.max(0,n.population-moved)}:n));changeHate(v.id,aid,5);relief(aid,v.id,10);log(`${a.name}對${v.name}發動政治宣傳，吸收 ${moved}M 人口。`,a.name);await die(v.id,aid)}
  if(kind==="attack"&&v){if(a.missiles<=0)return act(aid,"produce");const blocked=v.defense>0&&Math.random()<.6;await show(kind,a.name,v.name,blocked);const dmg=randomInt(4,7);commitN(s=>s.map(n=>n.id===aid?{...n,missiles:n.missiles-1}:n.id===v.id?{...n,defense:Math.max(0,n.defense-1),population:blocked?n.population:Math.max(0,n.population-dmg)}:n));changeHate(v.id,aid,blocked?5:10);if(!blocked)relief(aid,v.id,10);log(blocked?`${v.name}成功攔截${a.name}的核彈。`:`${a.name}核彈命中${v.name}，造成 ${dmg}M 人口損失。`,a.name);await die(v.id,aid)}
 }
 function aiPlan(a:Nation){const r=Math.random();if(a.missiles>0&&(a.ai==="aggressive"?r<.68:r<.42))return"attack";if(a.ai==="defensive"&&a.defense<3&&r<.65)return"defend";if(a.ai==="propaganda"&&r<.72)return"propaganda";return r>.65?"produce":"propaganda"}
 async function round(){if(busy||winner)return;setBusy(true);await act("player",command,target);for(let i=1;i<nRef.current.length;i++){const ai=nRef.current[i];if(ai.population>0)await act(ai.id,aiPlan(ai),weightedTarget(ai.id))}setTurn(t=>t+1);setPhase("玩家待命");setBusy(false)}
 function reset(){setStarted(false);setSetup(structuredClone(DEFAULT_SETUP))}

 if(!started)return <main className="screen landing"><div className="shell setup-shell"><span className="version"><Flame size={14}/> V4.2 開局設定</span><h1>末日協議</h1><p>設定五個陣營的開局人口、核彈、防禦，以及各 AI 對玩家的仇恨值。</p><div className="setup-actions"><button className="secondary" onClick={randomizeSetup}><Dices size={18}/>隨機設定</button><button className="secondary" onClick={()=>setSetup(structuredClone(DEFAULT_SETUP))}><RotateCcw size={18}/>恢復預設</button></div><div className="setup-list">{setup.map(n=><section className="setup-card" key={n.id}><div className="row"><b>{n.name}</b>{n.id==="player"&&<span className="chip">玩家</span>}</div><div className="setup-grid"><label>人口 M<input type="number" min="1" max="100" value={n.population} onChange={e=>updateSetup(n.id,"population",clamp(+e.target.value,1,100))}/></label><label>核彈<input type="number" min="0" max="20" value={n.missiles} onChange={e=>updateSetup(n.id,"missiles",clamp(+e.target.value,0,20))}/></label><label>防禦<input type="number" min="0" max="3" value={n.defense} onChange={e=>updateSetup(n.id,"defense",clamp(+e.target.value,0,3))}/></label>{n.id!=="player"&&<label>對玩家仇恨<input type="number" min="20" max="100" value={n.hateToPlayer} onChange={e=>updateSetup(n.id,"hateToPlayer",clamp(+e.target.value))}/></label>}</div></section>)}</div><button className="primary" onClick={begin}><Play size={20}/>依此設定開始戰局</button></div></main>;
 return <main className="screen"><div className="shell"><header className="top"><div className="topline"><div><small>回合 {turn}</small><h2>{phase}</h2></div><div><button className="icon" onClick={()=>setAudio(!audio)}>{audio?<Volume2/>:<VolumeX/>}</button><button className="icon" onClick={reset}><RotateCcw/></button></div></div><div className="stats">{[[Users,"人口",`${player.population}M`],[Target,"核彈",player.missiles],[Shield,"防禦",`${player.defense}/3`],[Biohazard,"存活",living.length]].map(([Icon,l,v]:any)=><div className="stat" key={l}><Icon size={16}/><small>{l}</small><b>{v}</b></div>)}</div></header><section className="content"><div className="section-title"><h2>選擇目標</h2><span className="chip"><Bot size={14}/>仇恨加權 AI</span></div><div className="nation-list">{nations.slice(1).map(n=>{const dead=n.population<=0,h=hate[n.id]?.player??40;return <motion.button key={n.id} disabled={dead} whileTap={{scale:.98}} onClick={()=>setTarget(n.id)} className={`nation ${target===n.id&&!dead?"selected":""} ${dead?"dead":""}`}><span className={`flag ${n.color}`}>{dead?<Skull size={20}/>:n.short[0]}</span><span className="nation-main"><span className="row"><b>{n.name}</b><b>{n.population}M</b></span><span className="row sub"><span>核彈 {n.missiles} · 防禦 {n.defense}/3</span><span className={hateClass(h)}>對我仇恨 {h}</span></span></span></motion.button>})}</div><h2>選擇命令</h2><div className="commands">{COMMANDS.map(c=>{const noMissile=c.id==="attack"&&player.missiles<=0;return <motion.button key={c.id} disabled={busy||noMissile} whileTap={{scale:.97}} onClick={()=>setCommand(c.id)} className={`command ${command===c.id?"selected":""}`}><c.Icon size={22}/><b>{c.label}</b><small>{noMissile?"沒有可發射核彈":c.help}</small></motion.button>})}</div><button className="primary" disabled={busy||!!winner} onClick={round}>{busy?"各國正在行動…":"送出命令"}</button><div className="section-title log-title"><h2><BookOpen size={20}/>行動紀錄</h2></div><div className="logs">{logs.slice(0,18).map((l,i)=><article key={i}><div className="row sub"><span>{l.actor}</span><span>回合 {l.turn}</span></div><p>{l.text}</p></article>)}</div></section></div><AnimatePresence>{visual&&<motion.div className="overlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><motion.div initial={{scale:.75}} animate={{scale:1}} className="visual">{visual.kind==="produce"&&<Factory size={90}/>} {visual.kind==="defend"&&<ShieldCheck size={90}/>} {visual.kind==="propaganda"&&<Radio size={90}/>} {visual.kind==="attack"&&<Crosshair size={90}/>} {visual.kind==="death"&&<Skull size={90}/>}<h2>{visual.kind==="death"?`${visual.actor}已滅亡`:visual.blocked?"核彈遭攔截":visual.actor}</h2>{visual.to&&<p>目標：{visual.to}</p>}</motion.div></motion.div>}</AnimatePresence>{winner&&<div className="overlay"><div className="result"><h2>戰局結束</h2><p>{winner.name}成為最後存活國家。</p><button className="primary" onClick={reset}>返回開局設定</button></div></div>}</main>;
}
