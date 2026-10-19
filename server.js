import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Database from 'better-sqlite3';
import {mkdirSync} from 'node:fs';
const app=express();
mkdirSync('data',{recursive:true});
const db=new Database('data/kerbside.sqlite');
db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS enquiries(id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, vehicle TEXT, service TEXT, preferred_date TEXT, message TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, status TEXT DEFAULT 'new')`);
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({limit:'20kb'}));
app.use(express.static('public'));
const limiter=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:'draft-7',legacyHeaders:false});
app.post('/api/enquiries',limiter,(req,res)=>{
 const b=req.body||{}; const trim=(v,max=500)=>typeof v==='string'?v.trim().slice(0,max):'';
 const kind=trim(b.kind,20),name=trim(b.name,100),email=trim(b.email,150),phone=trim(b.phone,50),message=trim(b.message,2000);
 if(!['booking','quote'].includes(kind)||name.length<2||!/^\S+@\S+\.\S+$/.test(email)||phone.length<7||message.length<5)return res.status(400).json({error:'Please complete all required fields.'});
 const result=db.prepare('INSERT INTO enquiries(kind,name,email,phone,vehicle,service,preferred_date,message) VALUES(?,?,?,?,?,?,?,?)').run(kind,name,email,phone,trim(b.vehicle,100),trim(b.service,100),trim(b.preferred_date,30),message);
 res.status(201).json({ok:true,id:result.lastInsertRowid});
});
app.get('/api/admin/enquiries',(req,res)=>{
 const key=process.env.ADMIN_API_KEY;
 if(!key||req.get('x-admin-key')!==key)return res.status(401).json({error:'Unauthorized'});
 res.json(db.prepare('SELECT * FROM enquiries ORDER BY id DESC LIMIT 200').all());
});
app.listen(process.env.PORT||3000,()=>console.log(`Kerbside Mechanic running on http://localhost:${process.env.PORT||3000}`));
