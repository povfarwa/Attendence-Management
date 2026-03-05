const express = require('express');
const app = express();
const path = require('path'); // Yeh line top par honi chahiye
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Models ko bulana
const User = require('./models/User'); // Same (Teacher/Admin)
const Student = require('./models/Student'); // NEW: Students ka data
const Attendance = require('./models/Attendance'); // NEW: Rozana ki hazri

// Purani line aisi hogi: mongoose.connect("mongodb://127.0.0.1:27017/attendanceDB")
// Usay hata kar ye likhein:

// Is block ko copy-paste kar dein
const dbURI = "mongodb+srv://farwa:attendance123@cluster0.gf29but.mongodb.net/attendanceDB?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(dbURI)
    .then(() => console.log("Cloud Database Connected! ✅"))
    .catch(err => console.log("Database Connection Error: ", err));

// Middlewares (Same as DevFlow)
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.set("views", path.join(__dirname, "views")); // Yeh line sabse zaroori hai!

//----------------------
// AUTH ROUTES (Same as DevFlow)
//----------------------

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

function isLoggedIn (req, res, next){
    let token = req.cookies.token;
    if(!token) return res.redirect("/login");
    try {
        let data = jwt.verify(token, "shhhhhh");
        req.user = data;
        next();
    } catch(err) { res.redirect("/login"); }
}

//----------------------
// APP SPECIFIC ROUTES
//----------------------

// 1. DASHBOARD (UPDATE: Ab yahan summary aur charts ka data jayega)
app.get("/dashboard", isLoggedIn, async function(req, res){
    const totalStudents = await Student.countDocuments(); // NEW: Total students ginte hain
    const students = await Student.find().populate('attendanceRecords'); // UPDATE: Populate attendance
    res.render("dashboard", { user: req.user, totalStudents, students });
});

app.get("/dashboard", isLoggedIn, async function(req, res){
    const totalStudents = await Student.countDocuments();
    const students = await Student.find().populate('attendanceRecords');

    // Chart ke liye data nikaalna: Pichle 5 dinon ki presence count
    // (Yeh thora advanced hai, lekin aap samajh jayengi)
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
        stats: JSON.stringify(attendanceStats) // Isay frontend par bhej dein
    });
});

// 2. ADD STUDENT (NEW: Naya student system mein shamil karne ke liye)
app.post("/add-student", isLoggedIn, async function(req, res){
    let { name, rollNumber, studentClass } = req.body;
    await Student.create({ name, rollNumber, studentClass });
    res.redirect("/dashboard");
});

// 3. MARK ATTENDANCE PAGE (NEW: Hazri lagane wala page dikhana)
app.get("/attendance/mark", isLoggedIn, async function(req, res){
    let students = await Student.find();
    res.render("mark-attendance", { students });
});

// 4. SUBMIT ATTENDANCE (NEW: Poori class ki hazri database mein save karna)
app.post("/attendance/submit", isLoggedIn, async function(req, res){
    const { attendanceData } = req.body; // Array of {studentId, status}
    
    // Har student ke liye attendance record banana
    const today = new Date().setHours(0,0,0,0);
    
    for(let record of attendanceData) {
        let newAttendance = await Attendance.create({
            studentId: record.studentId,
            status: record.status,
            date: today
        });
        
        // Student ke model mein hazri ka link dalna (UPDATE: Like notes in DevFlow)
        await Student.findByIdAndUpdate(record.studentId, {
            $push: { attendanceRecords: newAttendance._id }
        });
    }
    res.redirect("/dashboard");
});

// 5. STUDENT PROFILE / CHART DATA (NEW: Chart ke liye specific data bhejna)
app.get("/student/:id/report", isLoggedIn, async function(req, res){
    let student = await Student.findById(req.params.id).populate('attendanceRecords');
    res.render("student-report", { student });
});

// Logout (Same)
app.get("/logout", (req, res) => {
    res.cookie("token", "");
    res.redirect("/login");
});

app.listen(3000, () => console.log("Attendance System running on port 3000"));
