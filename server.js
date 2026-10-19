import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Database from 'better-sqlite3';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {randomBytes,scryptSync,timingSafeEqual,createHmac} from 'node:crypto';

const app=express();
app.disable('x-powered-by');
app.set('trust proxy',1);
const dataDir=process.env.DATA_DIR||path.join(process.cwd(),'data');
mkdirSync(dataDir,{recursive:true});
const db=new Database(path.join(dataDir,'kerbside.sqlite'));
db.pragma('journal_mode = WAL');
db.exec("CREATE TABLE IF NOT EXISTS enquiries(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL,name TEXT NOT NULL,email TEXT NOT NULL,phone TEXT NOT NULL,vehicle TEXT,service TEXT,preferred_date TEXT,message TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,status TEXT DEFAULT 'new')");
db.exec("CREATE TABLE IF NOT EXISTS services(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE NOT NULL,price TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1)");
for(const [name,price,description] of [['Diagnostics','Quote on request','Find the fault'],['Servicing','Quote on request','Keep your vehicle running'],['Brakes','Quote on request','Pads and discs'],['Batteries','Quote on request','Battery testing and replacement'],['Repairs','Quote on request','General vehicle repairs']]) db.prepare('INSERT OR IGNORE INTO services(name,price,description) VALUES(?,?,?)').run(name,price,description);
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({limit:'24kb'}));
app.use(express.urlencoded({extended:false,limit:'24kb'}));
app.use(express.static('public',{index:'index.html'}));
const secure=process.env.NODE_ENV==='production';
const adminUser=process.env.ADMIN_USERNAME||'admin';
const adminPassword=process.env.ADMIN_PASSWORD||'';
const secret=process.env.SESSION_SECRET||'';
if(!adminPassword||!secret||secret.length<32) console.error('ADMIN_PASSWORD and SESSION_SECRET (32+ characters) required for admin login.');
const cookieName='km_admin';
const cookieOptions='Path=/; HttpOnly; SameSite=Strict'+(secure?'; Secure':'');
const hash=(s)=>createHmac('sha256',secret).update(s).digest('hex');
const safeEqual=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)};
const credentials=(password)=>scryptSync(password,'kerbside-admin-v1',64);
function auth(req,res,next){
 if(!secret||!adminPassword)return res.status(503).json({error:'Admin credentials are not configured.'});
 const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='));
 if(!raw)return res.status(401).json({error:'Please sign in.'});
 const value=raw.slice(cookieName.length+1),parts=value.split('.');
 if(parts.length!==3)return res.status(401).json({error:'Please sign in.'});
 const [expiry,nonce,mac]=parts;
 if(!/^\d+$/.test(expiry)||Number(expiry)<Date.now()||!safeEqual(mac,hash(expiry+'.'+nonce)))return res.status(401).json({error:'Session expired.'});
 next();
}
function sameOrigin(req,res,next){
 const origin=req.get('origin');
 const host=req.get('x-forwarded-host')||req.get('host');
 if(origin){try{if(new URL(origin).host!==host)return res.status(403).json({error:'Invalid origin.'})}catch{return res.status(403).json({error:'Invalid origin.'})}}
 else if(req.get('sec-fetch-site')==='cross-site')return res.status(403).json({error:'Invalid request.'});
 next();
}
const loginLimiter=rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:'draft-7',legacyHeaders:false});
const enquiryLimiter=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:'draft-7',legacyHeaders:false});
const trim=(v,n=500)=>typeof v==='string'?v.trim().slice(0,n):'';
app.get('/admin',(req,res)=>res.sendFile(path.resolve('public/admin.html')));
app.post('/api/admin/login',loginLimiter,sameOrigin,(req,res)=>{
 if(!adminPassword||secret.length<32)return res.status(503).json({error:'Set ADMIN_PASSWORD and SESSION_SECRET in Render environment.'});
 const username=trim(req.body?.username,80),password=String(req.body?.password||'');
 if(password.length>512)return res.status(401).json({error:'Invalid login.'});
 const good=safeEqual(credentials(password),credentials(adminPassword))&&username===adminUser;
 if(!good)return res.status(401).json({error:'Invalid username or password.'});
 const expiry=String(Date.now()+8*60*60*1000),nonce=randomBytes(16).toString('hex');
 res.setHeader('Set-Cookie',cookieName+'='+expiry+'.'+nonce+'.'+hash(expiry+'.'+nonce)+'; Max-Age=28800; '+cookieOptions);
 res.json({ok:true});
});
app.post('/api/admin/logout',sameOrigin,(req,res)=>{res.setHeader('Set-Cookie',cookieName+'=; Max-Age=0; '+cookieOptions);res.json({ok:true})});
app.get('/api/admin/me',auth,(_req,res)=>res.json({ok:true,user:adminUser}));
app.get('/api/services',(_req,res)=>res.json(db.prepare('SELECT id,name,price,description FROM services WHERE active=1 ORDER BY id').all()));
app.post('/api/enquiries',enquiryLimiter,sameOrigin,(req,res)=>{
 const b=req.body||{},kind=trim(b.kind,20),name=trim(b.name,100),email=trim(b.email,150),phone=trim(b.phone,50),message=trim(b.message,2000);
 if(!['booking','quote'].includes(kind)||name.length<2||!/^\S+@\S+\.\S+$/.test(email)||phone.length<7||message.length<5)return res.status(400).json({error:'Please complete all required fields.'});
 const result=db.prepare('INSERT INTO enquiries(kind,name,email,phone,vehicle,service,preferred_date,message) VALUES(?,?,?,?,?,?,?,?)').run(kind,name,email,phone,trim(b.vehicle,100),trim(b.service,100),trim(b.preferred_date,30),message);
 res.status(201).json({ok:true,id:result.lastInsertRowid});
});
app.get('/api/admin/enquiries',auth,(_req,res)=>res.json(db.prepare('SELECT * FROM enquiries ORDER BY id DESC LIMIT 500').all()));
app.patch('/api/admin/enquiries/:id',auth,sameOrigin,(req,res)=>{
 const status=trim(req.body?.status,30),id=Number(req.params.id);
 if(!['new','contacted','booked','in_progress','completed','cancelled'].includes(status)||!Number.isSafeInteger(id))return res.status(400).json({error:'Invalid status or ID.'});
 const result=db.prepare('UPDATE enquiries SET status=? WHERE id=?').run(status,id);
 res.json({ok:result.changes>0});
});
app.get('/api/admin/services',auth,(_req,res)=>res.json(db.prepare('SELECT * FROM services ORDER BY id').all()));
app.post('/api/admin/services',auth,sameOrigin,(req,res)=>{
 const name=trim(req.body?.name,100),price=trim(req.body?.price,80),description=trim(req.body?.description,300);
 if(!name||!price)return res.status(400).json({error:'Service name and price are required.'});
 try{const result=db.prepare('INSERT INTO services(name,price,description) VALUES(?,?,?)').run(name,price,description);res.status(201).json({ok:true,id:result.lastInsertRowid})}catch{res.status(409).json({error:'Service already exists.'})}
});
app.patch('/api/admin/services/:id',auth,sameOrigin,(req,res)=>{
 const id=Number(req.params.id),name=trim(req.body?.name,100),price=trim(req.body?.price,80),description=trim(req.body?.description,300),active=req.body?.active===false?0:1;
 if(!Number.isSafeInteger(id)||!name||!price)return res.status(400).json({error:'Invalid service.'});
 try{const result=db.prepare('UPDATE services SET name=?,price=?,description=?,active=? WHERE id=?').run(name,price,description,active,id);res.json({ok:result.changes>0})}catch{res.status(409).json({error:'Service name already exists.'})}
});
app.get('/health',(_req,res)=>res.json({ok:true}));
const port=process.env.PORT||3000;
app.listen(port,'0.0.0.0',()=>console.log('Kerbside Mechanic listening on '+port));
