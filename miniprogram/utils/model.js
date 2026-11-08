const uid=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
const date=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const fresh=()=>({id:uid(),title:'好友局',date:date(),buyIn:2000,players:[]});
const empty=()=>({friends:[],sessions:[],draft:fresh(),selected:[],room:'',meal:''});
const cents=n=>Math.round(Number(n||0)*100);
const profit=(p,buyIn)=>cents(p.remaining)-p.hands*cents(buyIn);
const amount=n=>(typeof n==='number'||typeof n==='string'&&/^\d+(\.\d{1,2})?$/.test(n))&&Number.isFinite(Number(n))&&Number(n)>=0&&Number(n)<=1000000&&Math.abs(Number(n)*100-Math.round(Number(n)*100))<0.00001;
function ensure(ok,message='数据格式不正确'){if(!ok){const e=new Error(message);e.code='INVALID';throw e;}}
const keys=(o,allowed)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).every(k=>allowed.includes(k));
const identifier=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(s);
const unique=a=>new Set(a).size===a.length;
function person(p){ensure(keys(p,['id','name','hands','remaining'])&&identifier(p.id)&&typeof p.name==='string'&&p.name.trim().length>0&&p.name.length<=20);}
function session(s,draft){ensure(keys(s,['id','title','date','buyIn','players','roomFee','roomPayer'])&&identifier(s.id)&&typeof s.title==='string'&&s.title.trim().length>0&&s.title.length<=40&&typeof s.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s.date)&&new Date(s.date).toISOString().slice(0,10)===s.date&&amount(s.buyIn)&&Number(s.buyIn)>0&&Array.isArray(s.players)&&s.players.length<=50&&unique(s.players.map(p=>p.id)));
 if(s.roomFee!==undefined)ensure((draft&&s.roomFee==='')||amount(s.roomFee),'房费需为非负金额');
 if(s.roomPayer!=null){ensure(keys(s.roomPayer,['id','name']),'垫付人格式不正确');person(s.roomPayer);}
 if(!draft&&cents(s.roomFee)>0)ensure(!!s.roomPayer,'请选择房费垫付人');
 s.players.forEach(p=>{person(p);ensure(Number.isInteger(p.hands)&&p.hands>=1&&p.hands<=9999&&(draft&&p.remaining===''||amount(p.remaining)));});
 if(!draft)ensure(s.players.length>0&&s.players.reduce((n,p)=>n+profit(p,s.buyIn),0)===0,'历史牌局账目不平衡');
}
function validate(s){ensure(keys(s,['friends','sessions','draft','selected','room','meal','mealPayer']));ensure(Array.isArray(s.friends)&&s.friends.length<=200&&unique(s.friends.map(p=>p.id))&&unique(s.friends.map(p=>p.name)),'好友最多 200 位且不可重复');s.friends.forEach(p=>{ensure(keys(p,['id','name']));person(p);});ensure(Array.isArray(s.sessions)&&s.sessions.length<=500&&unique(s.sessions.map(p=>p.id)),'历史牌局最多 500 局且不可重复');s.sessions.forEach(g=>session(g,false));session(s.draft,true);ensure(!s.sessions.some(g=>g.id===s.draft.id));ensure(Array.isArray(s.selected)&&unique(s.selected)&&s.selected.every(id=>s.sessions.some(g=>g.id===id)));ensure((s.room===''||amount(s.room))&&(s.meal===''||amount(s.meal)));if(s.mealPayer!=null){ensure(keys(s.mealPayer,['id','name']),'餐费垫付人格式不正确');person(s.mealPayer);}ensure(JSON.stringify(s).length<=180000,'记录容量已满，请整理不需要的历史记录后重试');return s;}
// 总额与结果均为整数分；最大余数法分配尾差，保证合计不变。
function allocate(total,weights){
 const sum=weights.reduce((n,w)=>n+w,0);if(!sum)return weights.map(()=>0);
 const parts=weights.map((w,i)=>{const exact=total*(w/sum);return {i,value:Math.floor(exact),rest:exact-Math.floor(exact)};});
 let left=total-parts.reduce((n,p)=>n+p.value,0);
 const order=parts.slice().sort((a,b)=>b.rest-a.rest||a.i-b.i);
 for(let i=0;i<left;i++)order[i%order.length].value++;
 return parts.map(p=>p.value);
}
function summarize(sessions,room=0,meal=0,mealPayer=null){
 const map=new Map();
 const get=p=>{if(!map.has(p.id))map.set(p.id,{id:p.id,name:p.name,games:0,gross:0,cashGross:0,room:0,meal:0,advance:0});return map.get(p.id);};
 let carriedRoom=0;
 sessions.forEach(s=>{s.players.forEach(p=>{const r=get(p);r.gross+=profit(p,s.buyIn);r.games++;});const fee=cents(s.roomFee);carriedRoom+=fee;if(fee&&s.roomPayer)get(s.roomPayer).advance+=fee;});
 if(cents(meal)>0&&mealPayer)get(mealPayer).advance+=cents(meal);
 const rows=[...map.values()].sort((a,b)=>b.gross-a.gross||a.id.localeCompare(b.id)),winners=rows.filter(r=>r.gross>0);
 // gross 单位为百分之一积分；10 积分=1元，因此 gross/10 为人民币分。
 // 收付两端分别分配不足一分的尾差，确保原始平账的积分兑换后仍平账。
 for(const sign of [1,-1]){const group=rows.filter(r=>r.gross*sign>0);const weights=group.map(r=>Math.abs(r.gross));const shares=allocate(Math.round(weights.reduce((a,b)=>a+b,0)/10),weights);group.forEach((r,i)=>r.cashGross=sign*shares[i]);}
 const totalRoom=carriedRoom+cents(room);
 [['room',totalRoom],['meal',cents(meal)]].forEach(([key,total])=>{const shares=allocate(total,winners.map(r=>r.gross));winners.forEach((r,i)=>r[key]=shares[i]);});
 rows.forEach(r=>r.net=r.cashGross-r.room-r.meal+r.advance);
 return {rows,missingMealPayer:cents(meal)>0&&!mealPayer,winners:winners.length,roomTotal:totalRoom,unallocated:winners.length?0:totalRoom+cents(meal)};
}
module.exports={uid,date,fresh,empty,cents,profit,amount,validate,summarize};
