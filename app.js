const express = require('express');
const app = express();
const path = require('path'); 
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Models
const User = require('./models/User'); 
const Student = require('./models/Student'); 
const Attendance = require('./models/Attendance'); 

// MongoDB Atlas Connection
const dbURI = "mongodb+srv://farwa:attendance123@cluster0.gf29but.mongodb.net/attendanceDB?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(dbURI)
    .then(() => console.log("Cloud Database Connected! ✅"))
    .catch(err => console.log("Database Connection Error: ", err));

// Middlewares
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.set("views", path.join(__dirname, "views")); 

// Auth Middleware
function isLoggedIn (req, res, next){
    let token = req.cookies.token;
    if(!token) return res.redirect("/login");
    try {
        let data = jwt.verify(token, "shhhhhh");
        req.user = data;
        next();
    } catch(err) { res.redirect("/login"); }
}

// --- ROUTES ---

app.get("/", (req, res) => res.render("register"));

app.post("/register", async (req, res) => {
    let { name, email, password } = req.body;
    let user = await User.findOne({ email });
    if(user) return res.send("User already exists");

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    let newUser = await User.create({ name, email, password: hash });

    let token = jwt.sign({ email: email, userid: newUser._id }, "shhhhhh");
    res.cookie("token", token);
    res.redirect("/dashboard");
});

app.get("/login", (req, res) => res.render("login"));

app.post("/login", async (req, res) => {
    let { email, password } = req.body;
    let user = await User.findOne({ email });
    if(!user) return res.send("User not found");
    
    let isMatch = await bcrypt.compare(password, user.password);
    if(isMatch){
        let token = jwt.sign({ email: email, userid: user._id }, "shhhhhh");
        res.cookie("token", token);
        res.redirect("/dashboard");
    } else {
        res.send("Incorrect password");
    }
});

// Merged Dashboard Route (Fixing the double entry)
app.get("/dashboard", isLoggedIn, async function(req, res){
    try {
        const totalStudents = await Student.countDocuments();
        const students = await Student.find().populate('attendanceRecords');

        const attendanceStats = await Attendance.aggregate([
            { $match: { status: "Present" } },
            { $group: { _id: "$date", count: { $sum: 1 } } },
            { $sort: { "_id": 1 } },
            { $limit: 5 }
        ]);

        res.render("dashboard", { 
            user: req.user, 
            totalStudents, 
            students,
            stats: JSON.stringify(attendanceStats) 
        });
    } catch (err) {
        res.status(500).send("Dashboard Error: " + err.message);
    }
});

app.post("/add-student", isLoggedIn, async function(req, res){
    let { name, rollNumber, studentClass } = req.body;
    await Student.create({ name, rollNumber, studentClass });
    res.redirect("/dashboard");
});

app.get("/attendance/mark", isLoggedIn, async function(req, res){
    let students = await Student.find();
    res.render("mark-attendance", { students });
});

app.post("/attendance/submit", isLoggedIn, async function(req, res){
    const { attendanceData } = req.body; 
    const today = new Date().setHours(0,0,0,0);
    
    if(attendanceData && Array.isArray(attendanceData)) {
        for(let record of attendanceData) {
            let newAttendance = await Attendance.create({
                studentId: record.studentId,
                status: record.status,
                date: today
            });
            
            await Student.findByIdAndUpdate(record.studentId, {
                $push: { attendanceRecords: newAttendance._id }
            });
        }
    }
    res.redirect("/dashboard");
});

app.get("/student/:id/report", isLoggedIn, async function(req, res){
    let student = await Student.findById(req.params.id).populate('attendanceRecords');
    res.render("student-report", { student });
});

app.get("/logout", (req, res) => {
    res.cookie("token", "");
    res.redirect("/login");
});

// Vercel compatibility
module.exports = app; 

app.listen(3000, () => console.log("Attendance System running on port 3000"));