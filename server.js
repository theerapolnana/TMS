const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();

// ==========================================
// 🔓 ตั้งค่าระบบความปลอดภัยและการรับส่งข้อมูล (CORS & Body Parser)
// ==========================================
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const dbPath = path.join(__dirname, 'tms_db.json');
const JWT_SECRET = 'TMS_SUPER_SECRET_KEY_2026'; // คีย์ลับสำหรับระบบล็อกอิน

// ฟังก์ชันผู้ช่วย: อ่านข้อมูลจากฐานข้อมูล JSON
async function getDB() {
    try {
        const data = await fs.readFile(dbPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { users: [], jobs: [], vehicles: [], customers: [], billing: [] };
    }
}

// ฟังก์ชันผู้ช่วย: บันทึกข้อมูลลงฐานข้อมูล JSON
async function saveDB(data) {
    await fs.writeFile(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

// ==========================================
// 🔑 ระบบ AUTHENTICATION (ล็อกอิน & ตรวจสอบสิทธิ์)
// ==========================================

// 1. API สำหรับเข้าสู่ระบบ
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const db = await getDB();
    
    const user = db.users.find(u => u.username === username);
    
    if (!user || user.password !== password) {
        return res.status(401).json({ success: false, message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    }
    
    const token = jwt.sign(
        { id: user.id, name: user.name, role: user.role },
        JWT_SECRET,
        { expiresIn: '8h' }
    );
    
    res.json({ success: true, token, role: user.role, name: user.name });
});

// 2. Middleware ดักจับผู้ใช้งานที่ไม่ได้ล็อกอิน
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // 💡 เคลียร์บั๊ก: แกะเอา Token ออกมาจาก Bearer อย่างถูกต้อง
    
    if (!token) return res.status(401).json({ message: "กรุณาเข้าสู่ระบบก่อนใช้งาน" });
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: "เซสชันหมดอายุ กรุณาล็อกอินใหม่" });
        req.user = user;
        next();
    });
}

// 3. Middleware ตรวจสอบว่าต้องเป็นสิทธิ์ Admin เท่านั้น
function requireAdmin(req, res, next) {
    if (req.user && req.user.role === 'Admin') {
        next();
    } else {
        res.status(403).json({ message: "ปฏิเสธการเข้าถึง: สิทธิ์ของคุณไม่เพียงพอ (เฉพาะ Admin)" });
    }
}

// ==========================================
// 🚚 ระบบจัดการข้อมูลการขนส่ง (TMS RESTful APIs)
// ==========================================

// ------------------- 1. JOBS (งานจัดส่ง) -------------------
app.get('/api/jobs', authenticateToken, async (req, res) => {
    const db = await getDB();
    res.json(db.jobs);
});

// 💡 จัดระเบียบ: วางระบบค้นหาใบงานรายชิ้นไว้ใต้รายการหลักเพื่อป้องกันการแย่งสิทธิ์ข้อมูล
app.get('/api/jobs/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const db = await getDB();
    const job = db.jobs.find(j => j.id === id);
    
    if (job) {
        return res.json(job);
    }
    res.status(404).json({ success: false, message: "ไม่พบข้อมูลใบงาน" });
});

app.post('/api/jobs', authenticateToken, async (req, res) => {
    const db = await getDB();
    const newJob = {
        id: `JOB-${Date.now()}`,
        ...req.body,
        status: req.body.status || 'รอดำเนินการ'
    };
    db.jobs.push(newJob);
    await saveDB(db);
    res.status(201).json({ success: true, data: newJob });
});

app.put('/api/jobs/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const db = await getDB();
    const jobIndex = db.jobs.findIndex(j => j.id === id);
    
    if (jobIndex !== -1) {
        db.jobs[jobIndex] = { ...db.jobs[jobIndex], ...req.body };
        await saveDB(db);
        return res.json({ success: true, message: "อัปเดตข้อมูลใบงานสำเร็จ", data: db.jobs[jobIndex] });
    }
    res.status(404).json({ success: false, message: "ไม่พบข้อมูลใบงาน" });
});

app.delete('/api/jobs/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const db = await getDB();
    const jobIndex = db.jobs.findIndex(j => j.id === id);
    
    if (jobIndex !== -1) {
        db.jobs.splice(jobIndex, 1);
        await saveDB(db);
        return res.json({ success: true, message: "ลบข้อมูลใบงานสำเร็จ" });
    }
    res.status(404).json({ success: false, message: "ไม่พบข้อมูลใบงาน" });
});


// ------------------- 2. VEHICLES (ยานพาหนะ) -------------------
app.get('/api/vehicles', authenticateToken, async (req, res) => {
    const db = await getDB();
    res.json(db.vehicles);
});

app.post('/api/vehicles', authenticateToken, async (req, res) => {
    const db = await getDB();
    const newVehicle = { id: `VHC-${Date.now()}`, ...req.body };
    db.vehicles.push(newVehicle);
    await saveDB(db);
    res.status(201).json({ success: true, data: newVehicle });
});

app.put('/api/vehicles/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const db = await getDB();
    const index = db.vehicles.findIndex(v => v.id === id);
    
    if (index !== -1) {
        db.vehicles[index] = { ...db.vehicles[index], ...req.body };
        await saveDB(db);
        return res.json({ success: true, data: db.vehicles[index] });
    }
    res.status(404).json({ success: false, message: "ไม่พบข้อมูลยานพาหนะ" });
});

app.delete('/api/vehicles/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const db = await getDB();
    const index = db.vehicles.findIndex(v => v.id === id);
    
    if (index !== -1) {
        db.vehicles.splice(index, 1);
        await saveDB(db);
        return res.json({ success: true, message: "ลบข้อมูลยานพาหนะสำเร็จ" });
    }
    res.status(404).json({ success: false, message: "ไม่พบข้อมูลยานพาหนะ" });
});


// ------------------- 3. CUSTOMERS (ลูกค้า) -------------------
app.get('/api/customers', authenticateToken, async (req, res) => {
    const db = await getDB();
    res.json(db.customers);
});

app.post('/api/customers', authenticateToken, async (req, res) => {
    const db = await getDB();
    const newCustomer = { id: `CUST-${Date.now()}`, ...req.body };
    db.customers.push(newCustomer);
    await saveDB(db);
    res.status(201).json({ success: true, data: newCustomer });
});

app.put('/api/customers/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const db = await getDB();
    const index = db.customers.findIndex(c => c.id === id);
    
    if (index !== -1) {
        db.customers[index] = { ...db.customers[index], ...req.body };
        await saveDB(db);
        return res.json({ success: true, data: db.customers[index] });
    }
    res.status(404).json({ success: false, message: "ไม่พบข้อมูลลูกค้า" });
});

app.delete('/api/customers/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const db = await getDB();
    const index = db.customers.findIndex(c => c.id === id);
    
    if (index !== -1) {
        db.customers.splice(index, 1);
        await saveDB(db);
        return res.json({ success: true, message: "ลบข้อมูลลูกค้าสำเร็จ" });
    }
    res.status(404).json({ success: false, message: "ไม่พบข้อมูลลูกค้า" });
});


// ------------------- 4. BILLING & FINANCIALS (ระบบการเงิน) -------------------
app.get('/api/billing', authenticateToken, requireAdmin, async (req, res) => {
    const db = await getDB();
    res.json(db.billing);
});

app.post('/api/billing', authenticateToken, requireAdmin, async (req, res) => {
    const db = await getDB();
    const newBill = { id: `INV-${Date.now()}`, ...req.body };
    db.billing.push(newBill);
    await saveDB(db);
    res.status(201).json({ success: true, data: newBill });
});

app.put('/api/billing/:id', authenticateToken, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const db = await getDB();
    const index = db.billing.findIndex(b => b.id === id);
    
    if (index !== -1) {
        db.billing[index] = { ...db.billing[index], ...req.body };
        await saveDB(db);
        return res.json({ success: true, data: db.billing[index] });
    }
    res.status(404).json({ success: false, message: "ไม่พบข้อมูลบิล" });
});


// ------------------- 5. DASHBOARD SUMMARY (สรุปภาพรวม) -------------------
app.get('/api/dashboard-summary', authenticateToken, async (req, res) => {
    const db = await getDB();
    const summary = {
        totalJobs: db.jobs.length,
        vehiclesCount: db.vehicles.length,
        customersCount: db.customers.length,
        totalNetRevenue: db.jobs
            .filter(j => j.status === 'สำเร็จแล้ว' || j.status === 'Delivered')
            .reduce((sum, j) => sum + (Number(j.netAmount) || Number(j.totalRevenue) || 0), 0)
    };
    res.json(summary);
});

// เริ่มต้นเปิดเซิร์ฟเวอร์
const PORT = 3000;
app.listen(PORT, () => console.log(`🚚 TMS Backend fully stabilized on http://localhost:${PORT}`));
