import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Biohazard, BookOpen, Bot, Crosshair, Factory, Flame, Play, Radio, RotateCcw, Shield, ShieldCheck, Skull, Target, Users, Volume2, VolumeX } from "lucide-react";

type Nation={id:string;name:string;short:string;population:number;defense:number;missiles:number;color:string;ai:string;streak:number;lastBuild:string};
type Hate=Record<string,Record<string,number>>;
type Log={turn:number;actor:string;text:string};
type Visual={kind:string;actor:string;to?:string;blocked?:boolean}|null;

const IDS=["player","north","ember","isles","vault"];
const BASE=[
 {id:"player",name:"曙光共和國",short:"曙光",population:38,defense:2,missiles:2,color:"cyan",ai:"player"},
 {id:"north",name:"北境聯盟",short:"北境",population:32,defense:3,missiles:2,color:"slate",ai:"defensive"},
 {id:"ember",name:"赤焰共同體",short:"赤焰",population:41,defense:2,missiles:3,color:"red",ai:"aggressive"},
 {id:"isles",name:"群島議會",short:"群島",population:24,defense:2,missiles:1,color:"green",ai:"propaganda"},
 {id:"vault",name:"地堡公國",short:"地堡",population:19,defense:3,missiles:2,color:"violet",ai:"defensive"}
];
const COMMANDS=[
 {id:"propaganda",label:"政治宣傳",Icon:Radio,help:"吸收目標 1–3M 人口"},
 {id:"produce",label:"生產核彈",Icon:Factory,help:"依人口生產 1–5 枚"},
 {id:"defend",label:"部署防禦",Icon:ShieldCheck,help:"防禦 +1，上限 3"},
 {id:"attack",label:"發射核彈",Icon:Crosshair,help:"消耗 1 枚核彈攻擊目標"}
];
const wait=(n:number)=>new Promise(r=>setTimeout(r,n));
const rng=(turn:number,salt:number)=>{const x=Math.sin(turn*977+salt*137)*10000;return x-Math.floor(x)};
const clamp=(n:number)=>Math.max(20,Math.min(100,n));
function makeGame(){const nations:Nation[]=BASE.map(n=>({...n,streak:0,lastBuild:""}));const hate:Hate={};IDS.forEach((a,ai)=>{hate[a]={};IDS.forEach((b,bi)=>{if(a!==b)hate[a][b]=40+Math.floor(rng(ai+1,bi+11)*21)})});return{nations,hate}}
function produced(pop:number,turn:number,salt:number){return Math.max(1,Math.min(5,1+Math.floor(pop/15)+Math.floor(rng(turn,salt)*2)))}
function hateClass(v:number){return v<=40?"hate green":v<=70?"hate yellow":"hate red"}
function beep(kind:string,on:boolean){if(!on)return;const AC=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext,c=new AC(),o=c.createOscillator(),g=c.createGain();const p:Record<string,[number,OscillatorType]>={produce:[170,"square"],defend:[340,"triangle"],propaganda:[520,"sine"],attack:[100,"sawtooth"],death:[48,"sawtooth"]};const [f,t]=p[kind]||[440,"sine"];o.frequency.value=f;o.type=t;g.gain.setValueAtTime(.06,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.25);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.25)}

export default function App(){
 const first=useRef(makeGame());
 const [started,setStarted]=useState(false),[nations,setNations]=useState(first.current.nations),[hate,setHate]=useState(first.current.hate),[turn,setTurn]=useState(1),[target,setTarget]=useState("ember"),[command,setCommand]=useState("propaganda"),[busy,setBusy]=useState(false),[phase,setPhase]=useState("玩家待命"),[visual,setVisual]=useState<Visual>(null),[audio,setAudio]=useState(true),[logs,setLogs]=useState<Log[]>([{turn:0,actor:"系統",text:"五國進入高度戒備。"}]);
 const nRef=useRef(nations),hRef=useRef(hate);nRef.current=nations;hRef.current=hate;
 const player=nations[0],living=nations.filter(n=>n.population>0),winner=living.length===1?living[0]:null;
 const commitN=(fn:(s:Nation[])=>Nation[])=>{const x=fn(nRef.current);nRef.current=x;setNations(x)};
 const commitH=(fn:(s:Hate)=>Hate)=>{const x=fn(structuredClone(hRef.current));hRef.current=x;setHate(x)};
 const log=(text:string,actor="系統")=>setLogs(v=>[{turn,actor,text},...v]);
 function changeHate(observer:string,subject:string,delta:number){if(observer===subject)return;commitH(h=>{const raw=(h[observer][subject]??40)+delta,over=Math.max(0,raw-100);h[observer][subject]=clamp(raw);if(over)Object.keys(h[observer]).filter(k=>k!==subject).forEach(k=>h[observer][k]=clamp(h[observer][k]-over));return h})}
 function relief(attacker:string,victim:string,amount:number){IDS.filter(id=>id!==attacker&&id!==victim).forEach(o=>{const n=nRef.current.find(x=>x.id===o);if(n&&n.population>0&&(hRef.current[o]?.[victim]??0)>70)changeHate(o,attacker,-amount)})}
 function weightedTarget(actor:string,salt:number){const opts=nRef.current.filter(n=>n.id!==actor&&n.population>0);if(!opts.length)return;const total=opts.reduce((s,n)=>s+(hRef.current[actor]?.[n.id]??40),0);let roll=rng(turn,salt)*total;for(const n of opts){roll-=hRef.current[actor]?.[n.id]??40;if(roll<=0)return n.id}return opts.at(-1)?.id}
 async function show(kind:string,actor:string,to?:string,blocked=false){setVisual({kind,actor,to,blocked});beep(kind,audio);await wait(kind==="attack"?850:560);setVisual(null)}
 async function die(victim:string,killer:string){const n=nRef.current.find(x=>x.id===victim);if(!n||n.population>0)return;setVisual({kind:"death",actor:n.name});beep("death",audio);await wait(600);setVisual(null);log(`${n.name}人口歸零，立即滅亡並退出行動。`,n.name);relief(killer,victim,20)}
 async function act(actorId:string,kind:string,wanted?:string){const actor=nRef.current.find(n=>n.id===actorId);if(!actor||actor.population<=0)return;const victimId=nRef.current.some(n=>n.id===wanted&&n.population>0&&n.id!==actorId)?wanted:weightedTarget(actorId,actorId.length*31),victim=nRef.current.find(n=>n.id===victimId);setPhase(`${actor.short}正在行動`);
  if(kind==="produce"||kind==="defend"){const streak=actor.lastBuild===kind?actor.streak+1:1;if(kind==="produce"){const q=produced(actor.population,turn,actor.id.length*29);await show("produce",actor.name);commitN(s=>s.map(n=>n.id===actorId?{...n,missiles:n.missiles+q,lastBuild:kind,streak}:n));log(`${actor.name}生產 ${q} 枚核彈，庫存 ${actor.missiles+q}。`,actor.name)}else{await show("defend",actor.name);commitN(s=>s.map(n=>n.id===actorId?{...n,defense:Math.min(3,n.defense+1),lastBuild:kind,streak}:n));log(`${actor.name}部署防禦，目前 ${Math.min(3,actor.defense+1)}/3。`,actor.name)}if(streak>=2)IDS.filter(id=>id!==actorId&&nRef.current.some(n=>n.id===id&&n.population>0)).forEach(id=>changeHate(id,actorId,5));return}
  commitN(s=>s.map(n=>n.id===actorId?{...n,lastBuild:"",streak:0}:n));
  if(kind==="propaganda"&&victim){await show("propaganda",actor.name,victim.name);const moved=1+Math.floor(rng(turn,actor.id.length+victim.id.length)*3);commitN(s=>s.map(n=>n.id===actorId?{...n,population:n.population+moved}:n.id===victim.id?{...n,population:Math.max(0,n.population-moved)}:n));changeHate(victim.id,actorId,5);relief(actorId,victim.id,10);log(`${actor.name}對${victim.name}發動政治宣傳，吸收 ${moved}M 人口。`,actor.name);await die(victim.id,actorId)}
  if(kind==="attack"&&victim){if(actor.missiles<=0)return act(actorId,"produce");const blocked=victim.defense>0&&rng(turn,actor.id.length*17+victim.id.length*23)<.6;await show("attack",actor.name,victim.name,blocked);const damage=4+Math.floor(rng(turn,43+actor.id.length)*4);commitN(s=>s.map(n=>n.id===actorId?{...n,missiles:n.missiles-1}:n.id===victim.id?{...n,defense:Math.max(0,n.defense-1),population:blocked?n.population:Math.max(0,n.population-damage)}:n));changeHate(victim.id,actorId,blocked?5:10);if(!blocked)relief(actorId,victim.id,10);log(blocked?`${victim.name}成功攔截${actor.name}的核彈，防禦剩 ${Math.max(0,victim.defense-1)}/3。`:`${actor.name}核彈命中${victim.name}，造成 ${damage}M 人口損失。`,actor.name);await die(victim.id,actorId)}
 }
 function aiPlan(a:Nation,i:number){const r=rng(turn,i*19);if(a.missiles>0&&(a.ai==="aggressive"?r<.68:r<.42))return"attack";if(a.ai==="defensive"&&a.defense<3&&r<.65)return"defend";if(a.ai==="propaganda"&&r<.72)return"propaganda";return r>.65?"produce":"propaganda"}
 async function round(){if(busy||winner)return;setBusy(true);await act("player",command,target);for(let i=1;i<nRef.current.length;i++){const ai=nRef.current[i];if(ai.population<=0)continue;await act(ai.id,aiPlan(ai,i),weightedTarget(ai.id,i*47))}setTurn(t=>t+1);setPhase("玩家待命");setBusy(false);const next=nRef.current.find(n=>n.id!=="player"&&n.population>0);if(next&&!nRef.current.some(n=>n.id===target&&n.population>0))setTarget(next.id)}
 function reset(){const g=makeGame();nRef.current=g.nations;hRef.current=g.hate;setNations(g.nations);setHate(g.hate);setTurn(1);setCommand("propaganda");setTarget("ember");setLogs([{turn:0,actor:"系統",text:"五國進入高度戒備。"}]);setBusy(false);setPhase("玩家待命");setStarted(true)}
 if(!started)return <main className="screen landing"><div className="shell center"><span className="version"><Flame size={14}/> V4.1</span><h1>末日協議</h1><p>仇恨系統在背景運作，行動紀錄只呈現實際戰略行動與結果。</p><button className="primary" onClick={()=>setStarted(true)}><Play size={20}/>開始戰局</button></div></main>;
 return <main className="screen"><div className="shell"><header className="top"><div className="topline"><div><small>回合 {turn}</small><h2>{phase}</h2></div><div><button className="icon" onClick={()=>setAudio(!audio)}>{audio?<Volume2/>:<VolumeX/>}</button><button className="icon" onClick={reset}><RotateCcw/></button></div></div><div className="stats">{[[Users,"人口",`${player.population}M`],[Target,"核彈",player.missiles],[Shield,"防禦",`${player.defense}/3`],[Biohazard,"存活",living.length]].map(([Icon,l,v]:any)=><div className="stat" key={l}><Icon size={16}/><small>{l}</small><b>{v}</b></div>)}</div></header>
 <section className="content"><div className="section-title"><h2>選擇目標</h2><span className="chip"><Bot size={14}/>仇恨加權 AI</span></div><div className="nation-list">{nations.slice(1).map(n=>{const dead=n.population<=0,h=hate[n.id]?.player??40;return <motion.button key={n.id} disabled={dead} whileTap={{scale:.98}} onClick={()=>setTarget(n.id)} className={`nation ${target===n.id&&!dead?"selected":""} ${dead?"dead":""}`}><span className={`flag ${n.color}`}>{dead?<Skull size={20}/>:n.short[0]}</span><span className="nation-main"><span className="row"><b>{n.name}</b><b>{n.population}M</b></span><span className="row sub"><span>核彈 {n.missiles} · 防禦 {n.defense}/3</span><span className={hateClass(h)}>對我仇恨 {h}</span></span></span></motion.button>})}</div>
 <h2>選擇命令</h2><div className="commands">{COMMANDS.map(c=>{const noMissile=c.id==="attack"&&player.missiles<=0;return <motion.button key={c.id} disabled={busy||noMissile} whileTap={{scale:.97}} onClick={()=>setCommand(c.id)} className={`command ${command===c.id?"selected":""}`}><c.Icon size={22}/><b>{c.label}</b><small>{noMissile?"沒有可發射核彈":c.help}</small></motion.button>})}</div>
 <button className="primary" disabled={busy||!!winner||player.population<=0} onClick={round}>{busy?"各國正在依仇恨值行動…":"送出命令"}</button>
 <div className="section-title log-title"><h2><BookOpen size={20}/>行動紀錄</h2></div><div className="logs">{logs.slice(0,18).map((l,i)=><article key={i}><div className="row sub"><span>{l.actor}</span><span>回合 {l.turn}</span></div><p>{l.text}</p></article>)}</div></section></div>
 <AnimatePresence>{visual&&<motion.div className="overlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><motion.div initial={{scale:.75}} animate={{scale:1}} className="visual">{visual.kind==="produce"&&<Factory size={90}/>} {visual.kind==="defend"&&<ShieldCheck size={90}/>} {visual.kind==="propaganda"&&<Radio size={90}/>} {visual.kind==="attack"&&<Crosshair size={90}/>} {visual.kind==="death"&&<Skull size={90}/>}<h2>{visual.kind==="death"?`${visual.actor}已滅亡`:visual.blocked?"核彈遭攔截":visual.actor}</h2>{visual.to&&<p>目標：{visual.to}</p>}</motion.div></motion.div>}</AnimatePresence>
 {winner&&<div className="overlay"><div className="result"><h2>戰局結束</h2><p>{winner.name}成為最後存活國家。</p><button className="primary" onClick={reset}>重新開始</button></div></div>}</main>
}
