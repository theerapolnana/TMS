const express = require('express');
const app = express();
const cors = require('cors');
const fs = require('fs');
const path = require('path');

app.use(cors());
app.use(express.json());

const FILE_PATH = path.join(__dirname, 'tms_db.json');

// 1. Data Customers
let customers = [
    { id: 1, name: "บจก. เอสซีจี เทรดดิ้ง", phone: "02-586-2222", address: "บางซื่อ กรุงเทพฯ", billingMethod: "น้ำหนักหลังลงสินค้า" }
];

// 2. Data Vehicles
let vehicles = [
    { id: 1, plateNumber: "1กข-1234 กรุงเทพฯ", type: "รถ 4 ล้อ" },
    { id: 2, plateNumber: "2คข-5678 นนทบุรี", type: "รถ 6 ล้อ" },
    { id: 3, plateNumber: "3ตข-9012 เชียงใหม่", type: "รถ 10 ล้อ" }
];

// 3. Data Jobs
let jobs = [
    { 
        id: 1, 
        customer: "บจก. เอสซีจี เทรดดิ้ง",
        plateNumber: "2คข-5678 นนทบุรี", 
        product: "ปูนซีเมนต์ถุง", 
        origin: "กรุงเทพฯ", 
        destination: "ขอนแก่น", 
        pricePerTon: 350, 
        weightIn: 15.00,
        weightOut: 14.85,
        totalRevenue: 5197.50, 
        tax1Percent: 51.98,
        lossAmount: 0,
        unloadingFee: 0,
        netAmount: 5145.52,
        status: "กำลังจัดส่ง",
        date: "2026-08-19"
    }
];

// Local Disk Saving Functions
function saveToLocalDisk() {
    try {
        const data = { customers, vehicles, jobs };
        fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error("Cannot save data to file:", error);
    }
}

function loadFromLocalDisk() {
    if (fs.existsSync(FILE_PATH)) {
        try {
            const fileData = fs.readFileSync(FILE_PATH, 'utf-8');
            const parsed = JSON.parse(fileData);
            if (parsed.customers) customers = parsed.customers;
            if (parsed.vehicles) vehicles = parsed.vehicles;
            if (parsed.jobs) jobs = parsed.jobs;
            console.log("SUCCESS: Loaded local data from tms_db.json");
        } catch (err) {
            console.error("Load local data failed:", err);
        }
    } else {
        console.log("No existing database file found. Using default memory data.");
    }
}

// Initialize database load
loadFromLocalDisk();

// Revenue calculation logic
function calculateRevenue(customerName, pricePerTon, weightIn, weightOut) {
    const pPerTon = parseFloat(pricePerTon) || 0;
    const wIn = parseFloat(weightIn) || 0;
    const wOut = parseFloat(weightOut) || 0;

    const customer = customers.find(c => c.name === customerName);
    const method = customer ? customer.billingMethod : "น้ำหนักหลังลงสินค้า"; 

    let targetWeight = wOut; 

    if (method === "น้ำหนักขึ้นสินค้า") {
        targetWeight = wIn;
    } else if (method === "น้ำหนักหลังลงสินค้า") {
        targetWeight = wOut;
    } else if (method === "น้ำหนักที่น้อย") {
        targetWeight = Math.min(wIn, wOut);
    } else if (method === "น้ำหนักที่มาก") {
        targetWeight = Math.max(wIn, wOut);
    }

    return targetWeight * pPerTon;
}

// API Customers
app.get('/api/customers', (req, res) => res.status(200).json(customers));

app.post('/api/customers', (req, res) => {
    const { name, phone, address, billingMethod } = req.body;
    if (!name || !phone || !address || !billingMethod) return res.status(400).json({ message: "กรุณากรอกข้อมูลลูกค้าให้ครบถ้วน" });
    if (customers.some(c => c.name.trim() === name.trim())) return res.status(400).json({ message: "ชื่อลูกค้ารายนี้มีอยู่ในระบบแล้ว" });

    const newCustomer = {
        id: customers.length > 0 ? Math.max(...customers.map(c => c.id)) + 1 : 1,
        name: name.trim(), phone: phone.trim(), address: address.trim(), billingMethod
    };
    customers.push(newCustomer);
    saveToLocalDisk();
    res.status(201).json({ message: "เพิ่มข้อมูลลูกค้าสำเร็จ", customer: newCustomer });
});

app.delete('/api/customers/:id', (req, res) => {
    customers = customers.filter(c => c.id !== parseInt(req.params.id));
    saveToLocalDisk();
    res.status(200).json({ message: "ลบข้อมูลลูกค้าสำเร็จ" });
});

// API Vehicles
app.get('/api/vehicles', (req, res) => res.status(200).json(vehicles));

app.post('/api/vehicles', (req, res) => {
    const { plateNumber, type } = req.body;
    if (!plateNumber || !type) return res.status(400).json({ message: "ข้อมูลรถไม่ครบถ้วน" });
    if (vehicles.some(v => v.plateNumber.trim() === plateNumber.trim())) return res.status(400).json({ message: "ทะเบียนรถนี้มีอยู่ในระบบแล้ว" });

    const newVehicle = {
        id: vehicles.length > 0 ? Math.max(...vehicles.map(v => v.id)) + 1 : 1,
        plateNumber: plateNumber.trim(), type
    };
    vehicles.push(newVehicle);
    saveToLocalDisk();
    res.status(201).json({ message: "เพิ่มทะเบียนรถสำเร็จ", vehicle: newVehicle });
});

app.delete('/api/vehicles/:id', (req, res) => {
    vehicles = vehicles.filter(v => v.id !== parseInt(req.params.id));
    saveToLocalDisk();
    res.status(200).json({ message: "ลบทะเบียนรถสำเร็จ" });
});

// API Jobs
app.get('/api/jobs', (req, res) => res.status(200).json(jobs));

app.post('/api/jobs', (req, res) => {
    const { customer, origin, destination, plateNumber, product, pricePerTon } = req.body;
    if (!customer || !origin || !destination || !plateNumber || !product || !pricePerTon) {
        return res.status(400).json({ message: "กรุณากรอกข้อมูลใบงานให้ครบถ้วนทุกช่อง" });
    }

    const pPerTon = parseFloat(pricePerTon) || 0;
    const newJob = {
        id: jobs.length > 0 ? Math.max(...jobs.map(j => j.id)) + 1 : 1,
        customer, plateNumber, product, origin, destination,
        pricePerTon: pPerTon, weightIn: 0, weightOut: 0, totalRevenue: 0,
        tax1Percent: 0, lossAmount: 0, unloadingFee: 0, netAmount: 0,
        status: "รอดำเนินการ",
        date: new Date().toISOString().split('T')[0] // เก็บบันทึกวันที่ปัจจุบันแบบอัตโนมัติ (YYYY-MM-DD)
    };
    jobs.unshift(newJob);
    saveToLocalDisk();
    res.status(201).json({ message: "บันทึกใบงานสำเร็จ", job: newJob });
});

// คัดลอกไปวางทับ app.put('/api/jobs/:id') ตัวเดิมในไฟล์ server.js ของคุณ
app.put('/api/jobs/:id', (req, res) => {
    const id = parseInt(req.params.id);
    // ปลดล็อกรับค่าลูกค้า ทะเบียนรถ สินค้า วันรับ วันส่ง จากหน้าบ้าน
    const { customer, plateNumber, product, origin, destination, pricePerTon, weightIn, weightOut, status, dateReceive, dateSend } = req.body;
    const idx = jobs.findIndex(j => j.id === id);
    if (idx === -1) return res.status(404).json({ message: "ไม่พบใบงานที่ต้องการแก้ไข" });

    const pPerTon = parseFloat(pricePerTon) || 0;
    const wIn = parseFloat(weightIn) || 0;
    const wOut = parseFloat(weightOut) || 0;

    // คำนวณเงินโดยอิงตามชื่อลูกค้าตัวใหม่ที่อาจจะถูกแก้ไข
    const targetCustomer = customer || jobs[idx].customer;
    const revenue = calculateRevenue(targetCustomer, pPerTon, wIn, wOut);
    const tax1 = revenue * 0.01;
    const net = revenue - tax1;

    jobs[idx] = {
        ...jobs[idx],
        customer: targetCustomer,
        plateNumber: plateNumber || jobs[idx].plateNumber,
        product: product || jobs[idx].product,
        pricePerTon: pPerTon,
        weightIn: wIn,
        weightOut: wOut,
        totalRevenue: revenue,
        tax1Percent: tax1,            
        netAmount: net,               
        origin: origin || jobs[idx].origin,
        destination: destination || jobs[idx].destination,
        status: status || jobs[idx].status,
        dateReceive: dateReceive || jobs[idx].dateReceive || job[idx].date, // วันที่รับสินค้า
        dateSend: dateSend || jobs[idx].dateSend || job[idx].date         // วันที่ส่งสินค้า
    };
    saveToLocalDisk();
    res.status(200).json({ message: "อัปเดตใบงานและคำนวณเงินสำเร็จ", job: jobs[idx] });
});


app.delete('/api/jobs/:id', (req, res) => {
    jobs = jobs.filter(j => j.id !== parseInt(req.params.id));
    saveToLocalDisk();
    res.status(200).json({ message: "ลบใบงานขนส่งสำเร็จ" });
});
// ==================== เพิ่มเติม: API จัดการผู้ใช้งานใหม่ (ต่อท้ายเซิร์ฟเวอร์เดิม) ====================

// 1. API ดึงรายชื่อผู้ใช้ทั้งหมดไปแสดงในตาราง
app.get('/api/users', (req, res) => {
    // อ่านฐานข้อมูล JSON เดิมของคุณตามวิธีที่เซิร์ฟเวอร์เดิมของคุณเรียกใช้
    // สมมุติว่าฟังก์ชันอ่านไฟล์ของคุณชื่อ readDB() หรือเขียนแบบปกติ
    try {
        const data = fs.readFileSync(path.join(__dirname, 'tms_db.json'), 'utf-8');
        const db = JSON.parse(data);
        res.json(db.users || []); // คืนค่าตัวแปรอาร์เรย์ users (ถ้าไม่มีให้ส่งอาร์เรย์ว่าง)
    } catch (err) {
        res.status(500).json({ message: "อ่านข้อมูลล้มเหลว" });
    }
});

// 2. API บันทึกผู้ใช้ใหม่ลงไฟล์ JSON ถาวร
app.post('/api/users', (req, res) => {
    try {
        const dbPath = path.join(__dirname, 'tms_db.json');
        const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        
        // สร้างโครงสร้างข้อมูลสำหรับบันทึก
        const newUser = {
            id: 'USR-' + Date.now().toString().slice(-4), // สร้าง ID สุ่มแบบสั้น
            username: req.body.username,
            password: req.body.password,
            fullName: req.body.fullName
        };

        // หากในไฟล์ json ยังไม่มีคีย์ users ให้สร้างขึ้นมาใหม่
        if (!db.users) { db.users = []; }
        
        db.users.push(newUser); // เพิ่มเข้าอาร์เรย์
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2)); // บันทึกลงไฟล์ตู้ฐานข้อมูลเดิม
        
        res.status(201).json(newUser);
    } catch (err) {
        res.status(500).json({ message: "บันทึกข้อมูลล้มเหลว" });
    }
});
// 3. API สำหรับแก้ไขข้อมูลผู้ใช้ (PUT)
app.put('/api/users/:id', (req, res) => {
    try {
        const dbPath = path.join(__dirname, 'tms_db.json');
        const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        const index = db.users.findIndex(u => u.id === req.params.id);
        
        if (index !== -1) {
            // อัปเดตข้อมูลทับตัวเดิม โดยยังคงรักษา ID เดิมไว้
            db.users[index] = { id: req.params.id, ...req.body };
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
            return res.json(db.users[index]);
        }
        res.status(404).json({ message: 'ไม่พบผู้ใช้ที่ต้องการแก้ไข' });
    } catch (err) {
        res.status(500).json({ message: 'แก้ไขข้อมูลล้มเหลว' });
    }
});

// 4. API สำหรับลบข้อมูลผู้ใช้ (DELETE)
app.delete('/api/users/:id', (req, res) => {
    try {
        const dbPath = path.join(__dirname, 'tms_db.json');
        const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        const index = db.users.findIndex(u => u.id === req.params.id);
        
        if (index !== -1) {
            db.users.splice(index, 1); // ลบสมาชิกออกจากอาเรย์
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
            return res.json({ message: 'ลบผู้ใช้สำเร็จ' });
        }
        res.status(404).json({ message: 'ไม่พบผู้ใช้ที่ต้องการลบ' });
    } catch (err) {
        res.status(500).json({ message: 'ลบข้อมูลล้มเหลว' });
    }
});

// Run server
const PORT = 3000;
app.listen(PORT, () => {
    console.log("===================================================");
    console.log("Server running smoothly on port: " + PORT);
    console.log("Database file path: " + FILE_PATH);
    console.log("===================================================");
});
