import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { Wallet } from "../models/Wallet.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import { Customer } from "../models/Customer.js";
import { tenantFilter } from "../middleware/tenantScope.js";
import {
  createWallet,
  creditWallet,
  debitWallet,
} from "../services/wallet.service.js";
import {
  sendSuccess,
  sendCreated,
  NotFoundError,
} from "../utils/apiResponse.js";
import type {
  CreateWalletInput,
  TopUpWalletInput,
  DebitWalletInput,
  UpdateAutoTopUpInput,
} from "../validators/wallet.validator.js";

/**
 * Wallet Controller — REST endpoints for managing credit wallets.
 */

export async function createNewWallet(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = req.body as CreateWalletInput;
    const tenantId = req.tenantId!;

    const customer = await Customer.findOne({
      ...tenantFilter(req),
      _id: input.customerId,
    });

    if (!customer) {
      throw new NotFoundError("Customer");
    }

    const wallet = await createWallet(
      tenantId,
      new Types.ObjectId(input.customerId),
      input.subscriptionId ? new Types.ObjectId(input.subscriptionId) : undefined
    );

    sendCreated(res, wallet);
  } catch (error) {
    next(error);
  }
}

export async function getWallet(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const wallet = await Wallet.findOne({
      ...tenantFilter(req),
      _id: req.params.id,
    });

    if (!wallet) {
      throw new NotFoundError("Wallet");
    }

    sendSuccess(res, wallet);
  } catch (error) {
    next(error);
  }
}

export async function listWallets(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const filter: Record<string, unknown> = { ...tenantFilter(req) };

    if (req.query.customerId) {
      filter.customerId = req.query.customerId;
    }

    const wallets = await Wallet.find(filter).sort({ createdAt: -1 });

    sendSuccess(res, wallets);
  } catch (error) {
    next(error);
  }
}

export async function topUp(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = req.body as TopUpWalletInput;
    
    // Ensure wallet exists and belongs to tenant
    const wallet = await Wallet.findOne({
      ...tenantFilter(req),
      _id: req.params.id,
    });

    if (!wallet) {
      throw new NotFoundError("Wallet");
    }

    const result = await creditWallet(
      wallet._id,
      input.amount,
      input.description,
      input.referenceId
    );

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function deduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = req.body as DebitWalletInput;
    
    // Ensure wallet exists and belongs to tenant
    const wallet = await Wallet.findOne({
      ...tenantFilter(req),
      _id: req.params.id,
    });

    if (!wallet) {
      throw new NotFoundError("Wallet");
    }

    const result = await debitWallet(
      wallet._id,
      input.amount,
      input.description,
      input.referenceId
    );

    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function listTransactions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Ensure wallet belongs to tenant
    const wallet = await Wallet.findOne({
      ...tenantFilter(req),
      _id: req.params.id,
    });

    if (!wallet) {
      throw new NotFoundError("Wallet");
    }

    const transactions = await WalletTransaction.find({
      walletId: wallet._id,
    }).sort({ createdAt: -1 });

    sendSuccess(res, transactions);
  } catch (error) {
    next(error);
  }
}

export async function updateAutoTopUp(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = req.body as UpdateAutoTopUpInput;

    const wallet = await Wallet.findOneAndUpdate(
      { ...tenantFilter(req), _id: req.params.id },
      { $set: input },
      { new: true, runValidators: true }
    );

    if (!wallet) {
      throw new NotFoundError("Wallet");
    }

    sendSuccess(res, wallet);
  } catch (error) {
    next(error);
  }
}
