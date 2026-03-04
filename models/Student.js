const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    rollNumber: { type: String, required: true, unique: true },
    studentClass: { type: String, required: true },
    // UPDATE: Jaise DevFlow mein notes thay, yahan attendance records hain
    attendanceRecords: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Attendance'
    }]
});

module.exports = mongoose.model('Student', studentSchema);