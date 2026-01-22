const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt"); 
const sqlite3 = require("sqlite3").verbose();
const session=require("express-session");
const { match } = require("node:assert");
const { error } = require("node:console");


const app = express();

const db = new sqlite3.Database("./users.db", (err) => {
    if (err) console.log("DB Error:", err.message);
    else console.log("DB Connected");

    db.run(`
      CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      )
    `, (err) => {
        if (err) console.log("Table creation error:", err.message);
        else console.log("Table ready");
    }
);

db.run(
    `
    CREATE TABLE IF NOT EXISTS feeds(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feed TEXT NOT NULL,
    username TEXT NOT NULL
    )
    `,(err)=>{
        if(err) console.log("Feeds Error: ",err.message);
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS relations(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userid INTEGER NOT NULL,
        username TEXT NOT NULL,
        targetid INTEGER NOT NULL,
        targetname TEXT NOT NULL,
        status TEXT NOT NULL
        )
        `,(err)=>{
            if(err) console.log("DB ERROR: ",err.message);
        });

        db.run(`
            CREATE TABLE IF NOT EXISTS messages(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender TEXT NOT NULL,
            receiver TEXT NOT NULL,
            message TEXT NOT NULL
            )
            `,(err)=>{
                if(err) console.log("DB ERROR",err.message);
            }
        );

}
);


app.use(
  session(
    {
        secret:"147258369",
        resave:false,
        saveUninitialized:false,
        cookie:{
            httpOnly:true
        }
    }
  )  
);

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/register", (req, res) => {
    res.sendFile(__dirname + "/signUp.html");
}
);

app.get("/signIn",(req,res)=>
{
    res.sendFile(__dirname+"/signIn.html");
}
);

app.get("/api/users",(req,res)=>
{
    if(!req.session.user) return res.status(401).json({error:"You are not logged in"});

    const userid=req.session.user.id;

    db.all("SELECT id,username,email FROM users WHERE id !=?",[userid],(err,rows)=>
    {
        if (err) return res.status(500).json({error:"DB Error"});
        res.json(rows);
    }
);
}
);

app.post("/api/add-friend",(req,res)=>{
    if(!req.session.user) return res.status(401).json({error:"You are not logged in"});

    const {targetId,targetName}=req.body;
    const userId=req.session.user.id;
    const username=req.session.user.username;

    if(!targetId || !targetName) return res.status(400).json({error:"Invalid Data"});

    db.get("SELECT * FROM relations WHERE userid=? AND targetid=? OR userid=? AND targetid=?",[userId,targetId,targetId,userId],(err,row)=>{
        if(err) return res.status(500).json({error:"DB Error"});
        if(row) return res.status(400).json({error:"Already added Or Pending Request"});
        const status ="pending";
        db.run("INSERT INTO relations(userid,username,targetid,targetname,status) VALUES(?,?,?,?,?)",
            [userId,username,targetId,targetName,status],
            function(err){
                if (err) return res.status(500).json({error:"DB Error"});
                res.json({success:true});
            }
        )
    });
});

app.post("/api/accept",(req,res)=>{
    if(!req.session.user) return res.status(401).json({error:"You are not logged in"});

    const {userid,targetid}=req.body;
    const status="accepted";
    db.run("UPDATE relations SET status=? WHERE userid=? AND targetid=?",[status,userid,targetid],function(err){
        if(err) return res.status(500).json({error:"DB Error"});
        res.json({success:true});
    })
});

app.get("/api/feeds",(req,res)=>{
    if(!req.session.user) return res.status(401).json({error:"You are not logged in"});

    const target=req.session.user.username;
    const status="accepted";

    db.all("SELECT username,targetname FROM relations WHERE (targetname=? OR username=?) AND status=?",[target,target,status],(err,rows)=>{
        if(err) return res.status(500).json({error:"DB Error"});

        const friendUsernames=rows.map(r=>{
            return r.username===target? r.targetname:r.username;
        });

        friendUsernames.push(target);

        if(friendUsernames.length===0){
            return res.json([]);
        }

        const placeholder=friendUsernames.map(()=>"?").join(",");

        db.all(`SELECT feed,username FROM feeds WHERE username IN (${placeholder}) ORDER BY id DESC`,
            friendUsernames,
            (err2,feedRows)=>{
                if(err2) return res.status(500).json({error:"DB Error"});
                res.json(feedRows);
            }
        );
    });

});

app.get("/api/friends",(req,res)=>{

    if(!req.session.user) return res.status(401).json({error:"You are not logged in"});
    const target=req.session.user.username;
    const status="accepted";

    db.all("SELECT * FROM relations WHERE (targetname=? OR username=?) AND status=?",[target,target,status],(err,rows)=>{
        if(err) return res.status(500).json({error:"DB Error"});
        res.json(rows);
    });
});

app.get("/signUp.html",(req,res)=>
{
    res.sendFile(__dirname+"/signUp.html");
}
);

app.post("/api/message",(req,res)=>{
if(!req.session.user.username){
    return res.status(401).json({error:"You are not logged in"});
}
    const {receiver,message}=req.body;
    const sender=req.session.user.username;

    db.run("INSERT INTO messages(sender,receiver,message) VALUES(?,?,?)",[sender,receiver,message],function(err){
         if(err) return res.status(500).json({error:"DB Error"});
        res.json({success:true});
    });
});

app.post("/api/allConvo",(req,res)=>{
    if(!req.session.user.username){
    return res.status(401).json({error:"You are not logged in"});
}

const sender=req.session.user.username;
const {receiver}=req.body;

db.all(`SELECT * FROM messages WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?) ORDER BY id ASC`,[sender,receiver,receiver,sender],(err,rows)=>{
    if (err) return res.status(500).json({ error: "DB Error" });
        res.json({ success: true, messages: rows });
});
});

app.get("/profile.html",(req,res)=>
{
    res.sendFile(__dirname+"/profile.html");
}
);

app.get("/posts.html",(req,res)=>
{
    res.sendFile(__dirname+"/posts.html");
}
);

app.get("/people.html",(req,res)=>
{
    res.sendFile(__dirname+"/people.html");
}
);

app.get("/friends.html",(req,res)=>
{
    res.sendFile(__dirname+"/friends.html");
}
);

app.get("/message.html",(req,res)=>
{
    res.sendFile(__dirname+"/message.html");
}
);

app.get("/profile",(req,res)=>
{

    if(!req.session.user){
        return res.redirect("/signIn");
    }
    res.sendFile(__dirname+"/profile.html");
}
);

app.get("/logout",(req,res)=>
{
    req.session.destroy(()=>
    {
        res.redirect("/signIn");
    }
)
}  
);

app.get("/api/user",(req,res)=>
{
    if(!req.session.user) return res.status(401).json({error:"You are not logged in"});
    res.json(req.session.user);
}
);

app.get("/api/friendRequest",(req,res)=>
{

    if(!req.session.user){
        return res.status(401).json({error:"You are not logged in"});
    }
    const target=req.session.user.username;
    const status="pending";
    db.all(`SELECT * FROM relations WHERE targetname=? AND status=?`,[target,status],(err,rows)=>
    {
if(err) return res.status(500).json({error:"DB Error"});

return res.json(rows);
    });
}
);

app.post("/auth/login",async(req,res)=>
{
const {username,password}=req.body;

if(!username || !password) return res.send("All Fields are required");


db.get("SELECT * FROM users WHERE username=?",[username],async(err,row)=>
{
if (err) return res.send("DB Error");
if(!row) return res.send("User not Found");

const match = await bcrypt.compare(password,row.password);
if (!match) return res.send("Incorrect password");
if(match){
    req.session.user={
        id:row.id,
        username:row.username,
        email:row.email
    };
    return res.redirect("/profile");
}
}
);
}
);

app.post("/auth/post",(req,res)=>
{
    if(!req.session.user){
        return res.status(401).send("You are not logged in");
    }

    const {feed}=req.body;
    const username=req.session.user.username;

    if(!feed) return res.send("Feed cannot be empty");

    db.run(
        `
        INSERT INTO feeds(feed,username) VALUES(?,?)
        `,[feed,username],function(err){
            if(err) return res.send("DB Error");
            console.log("You made a post");

            res.redirect("/posts.html");
        }
    );
}
);



app.post("/auth/register", async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.send("All Fields are required");

    try {
        const hashedPass = await bcrypt.hash(password, 10);

        db.get("SELECT id FROM users WHERE email=?", [email], (err, row) => {
            if (err) return res.send("DB Error");
            if (row) return res.send("User Exists");

            db.run(
                "INSERT INTO users (username,email,password) VALUES (?,?,?)",
                [username, email, hashedPass],
                function (err) {
                    if (err) {
                        console.log("Insert Error:", err.message);
                        return res.send("DB Error");
                    }
                    console.log("User Added:", username);
                    return res.redirect("/signIn");
                }
            );
        }
    );
    } catch (e) {
        console.log("Server error:", e);
        return res.send("Server Error");
    }
}
);


app.listen(5000, () => 
    {
        console.log("Server running at http://localhost:5000")
    }
);