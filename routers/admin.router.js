import express from "express";
import jwt from "jsonwebtoken";
import {
  adminLogin,
  getTablesList,
  createTable,
  dropTable,
  editSchema,
  getTableData,
  updateRow,
  deleteRow,
  createRow,
  getRelations,
  createRelation,
  getAllRelations,
  deleteRelation
} from "../controller/admin.controller.js";

const router = express.Router();

// Middleware to protect admin routes
const adminAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid token" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admins only." });
    }
    
    req.adminUser = { username: process.env.ADMIN_USERNAME, role: 'admin' };
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// Admin Login endpoint
router.post('/login', adminLogin);

// Protected Admin API Routes
router.use(adminAuth);

router.get("/tables", getTablesList);
router.post("/tables", createTable);
router.delete("/tables/:table", dropTable);
router.put("/schema/:table", editSchema);

router.get("/data/:table", getTableData);
router.post("/data/:table", createRow);
router.put("/data/:table/:id", updateRow);
router.delete("/data/:table/:id", deleteRow);

router.get("/relations/:table", getRelations);
router.post("/relations", createRelation);
router.get("/all-relations", getAllRelations);
router.delete("/relations/:table/:column", deleteRelation);

export default router;
