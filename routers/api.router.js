import express from "express";
import {
  createRecord,
  getRecords,
  getRecord,
  updateRecord,
  deleteRecord
} from "../controller/api.controller.js";

import { apiAuth } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/:collection", apiAuth, createRecord);
router.get("/:collection", apiAuth, getRecords);

router.get("/:collection/:id", apiAuth, getRecord);
router.put("/:collection/:id", apiAuth, updateRecord);
router.delete("/:collection/:id", apiAuth, deleteRecord);

export default router;
