import { Request, Response, NextFunction } from "express";
import { WalletGroupService } from "../services/walletGroup.service.js";

export const getWalletGroups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groups = await WalletGroupService.getWalletGroups(req.tenantId!.toString());
    res.status(200).json({ success: true, data: groups });
  } catch (error) {
    next(error);
  }
};

export const getWalletGroupById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const group = await WalletGroupService.getWalletGroupById(req.tenantId!.toString(), req.params.groupId as string);
    res.status(200).json({ success: true, data: group });
  } catch (error) {
    next(error);
  }
};

export const createWalletGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const group = await WalletGroupService.createWalletGroup(req.tenantId!.toString(), req.body);
    res.status(201).json({ success: true, data: group });
  } catch (error) {
    next(error);
  }
};

export const updateWalletGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const group = await WalletGroupService.updateWalletGroup(req.tenantId!.toString(), req.params.groupId as string, req.body);
    res.status(200).json({ success: true, data: group });
  } catch (error) {
    next(error);
  }
};

export const deleteWalletGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await WalletGroupService.deleteWalletGroup(req.tenantId!.toString(), req.params.groupId as string);
    res.status(200).json({ success: true, message: "Wallet group deleted successfully" });
  } catch (error) {
    next(error);
  }
};
