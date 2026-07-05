import { Types, ClientSession } from "mongoose";
import mongoose from "mongoose";
import { Wallet } from "../models/Wallet.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import { queueWebhook } from "./webhook.service.js";
import { WalletGroupService } from "./walletGroup.service.js";
import { logger } from "../utils/logger.js";
import { AppError, NotFoundError } from "../utils/apiResponse.js";

/**
 * Wallet Service — Manages the credit wallet ledger and operations.
 *
 * All amounts must be in KOBO (integers) per AGENTS.md §3.
 * Ledger operations are wrapped in Mongoose transactions to ensure
 * atomic updates of the Wallet balance and WalletTransaction creation.
 */

export interface CreditDebitResult {
  success: boolean;
  walletId: Types.ObjectId;
  transactionId: Types.ObjectId;
  balanceBefore: number;
  balanceAfter: number;
}

/**
 * Initialize a wallet for a customer.
 */
export async function createWallet(
  tenantId: Types.ObjectId,
  customerId: Types.ObjectId,
  subscriptionId?: Types.ObjectId
) {
  const existingWallet = await Wallet.findOne({ tenantId, customerId });
  if (existingWallet) {
    return existingWallet;
  }

  const defaultGroup = await WalletGroupService.ensureDefaultWalletGroup(tenantId);

  const wallet = await Wallet.create({
    tenantId,
    customerId,
    subscriptionId,
    walletGroupId: defaultGroup._id,
    balance: 0,
    currency: "NGN",
    lowBalanceThreshold: 50000, // Default 500 NGN
  });

  logger.info({ walletId: wallet._id, customerId, groupId: defaultGroup._id }, "Wallet created");
  return wallet;
}

/**
 * Credit (add funds to) a wallet.
 * Uses a Mongoose transaction to ensure atomicity.
 */
export async function creditWallet(
  walletId: Types.ObjectId,
  amount: number, // KOBO
  description: string,
  referenceId?: string
): Promise<CreditDebitResult> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new AppError("Credit amount must be a positive integer in kobo");
  }

  const session = await mongoose.startSession();
  let result: CreditDebitResult;

  try {
    session.startTransaction();

    // Use findOneAndUpdate with $inc to ensure atomic increment and get the latest document
    const wallet = await Wallet.findOneAndUpdate(
      { _id: walletId },
      { $inc: { balance: amount } },
      { returnDocument: "after", session }
    );

    if (!wallet) {
      throw new NotFoundError("Wallet");
    }

    const balanceBefore = wallet.balance - amount;
    const balanceAfter = wallet.balance;

    const [transaction] = await WalletTransaction.create(
      [
        {
          tenantId: wallet.tenantId,
          walletId: wallet._id,
          customerId: wallet.customerId,
          type: "credit",
          amount,
          balanceAfter,
          currency: wallet.currency,
          description,
          referenceId,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    logger.info(
      { walletId, amount, balanceAfter },
      "Wallet credited successfully"
    );

    result = {
      success: true,
      walletId,
      transactionId: transaction!._id as Types.ObjectId,
      balanceBefore,
      balanceAfter,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  // Fire webhook outside the transaction
  const wallet = await Wallet.findById(walletId);
  if (wallet) {
    await queueWebhook(wallet.tenantId, "wallet.credited", {
      walletId,
      customerId: wallet.customerId,
      amount,
      balanceBefore: result.balanceBefore,
      balanceAfter: result.balanceAfter,
      description,
      referenceId,
    });
  }

  return result;
}

/**
 * Debit (deduct funds from) a wallet.
 * Uses a Mongoose transaction to ensure atomicity.
 */
export async function debitWallet(
  walletId: Types.ObjectId,
  amount: number, // KOBO
  description: string,
  referenceId?: string
): Promise<CreditDebitResult> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new AppError("Debit amount must be a positive integer in kobo");
  }

  const session = await mongoose.startSession();
  let result: CreditDebitResult;
  let isLowBalance = false;

  try {
    session.startTransaction();

    // Fetch the wallet within the transaction to check balance
    const walletCheck = await Wallet.findById(walletId).session(session);
    if (!walletCheck) {
      throw new NotFoundError("Wallet");
    }

    if (walletCheck.balance < amount) {
      throw new AppError("Insufficient wallet balance", 400);
    }

    // Use findOneAndUpdate with $inc to ensure atomic decrement
    const wallet = await Wallet.findOneAndUpdate(
      { _id: walletId },
      { $inc: { balance: -amount } },
      { returnDocument: "after", session }
    );

    if (!wallet) {
      throw new NotFoundError("Wallet");
    }

    const balanceBefore = wallet.balance + amount;
    const balanceAfter = wallet.balance;
    
    // Check if we crossed the low balance threshold
    if (
      balanceBefore > wallet.lowBalanceThreshold &&
      balanceAfter <= wallet.lowBalanceThreshold
    ) {
      isLowBalance = true;
    }

    const [transaction] = await WalletTransaction.create(
      [
        {
          tenantId: wallet.tenantId,
          walletId: wallet._id,
          customerId: wallet.customerId,
          type: "debit",
          amount,
          balanceAfter,
          currency: wallet.currency,
          description,
          referenceId,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    logger.info(
      { walletId, amount, balanceAfter },
      "Wallet debited successfully"
    );

    result = {
      success: true,
      walletId,
      transactionId: transaction!._id as Types.ObjectId,
      balanceBefore,
      balanceAfter,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  // Fire webhooks outside the transaction
  const wallet = await Wallet.findById(walletId);
  if (wallet) {
    await queueWebhook(wallet.tenantId, "wallet.debited", {
      walletId,
      customerId: wallet.customerId,
      amount,
      balanceBefore: result.balanceBefore,
      balanceAfter: result.balanceAfter,
      description,
      referenceId,
    });

    if (isLowBalance) {
      await queueWebhook(wallet.tenantId, "wallet.low_balance", {
        walletId,
        customerId: wallet.customerId,
        balance: result.balanceAfter,
        threshold: wallet.lowBalanceThreshold,
      });
      logger.info({ walletId, balance: result.balanceAfter }, "Wallet low balance threshold reached");
    }
  }

  return result;
}
