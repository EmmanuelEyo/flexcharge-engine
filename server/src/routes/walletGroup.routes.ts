import { Router } from "express";
import {
  getWalletGroups,
  getWalletGroupById,
  createWalletGroup,
  updateWalletGroup,
  deleteWalletGroup,
} from "../controllers/walletGroup.controller.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

// All wallet group routes require authentication
router.use(authenticate);

router.get("/", getWalletGroups);
router.get("/:groupId", getWalletGroupById);
router.post("/", createWalletGroup);
router.patch("/:groupId", updateWalletGroup);
router.delete("/:groupId", deleteWalletGroup);

export default router;
