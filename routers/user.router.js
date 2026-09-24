import express from "express";
import { register, login, deleteAccount } from "../controller/user.controller.js";
import { apiAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.delete("/delete", apiAuth, deleteAccount);

export default router;
