import { Types } from "mongoose";
import { WalletGroup, IWalletGroup } from "../models/WalletGroup.js";
import { NotFoundError, AppError } from "../utils/apiResponse.js";
import { logger } from "../utils/logger.js";

export class WalletGroupService {
  /**
   * Retrieves all wallet groups for a tenant
   */
  static async getWalletGroups(tenantId: string): Promise<IWalletGroup[]> {
    return WalletGroup.find({ tenantId }).sort({ createdAt: -1 });
  }

  /**
   * Retrieves a specific wallet group
   */
  static async getWalletGroupById(
    tenantId: string,
    groupId: string
  ): Promise<IWalletGroup> {
    const group = await WalletGroup.findOne({ _id: groupId, tenantId });
    if (!group) {
      throw new NotFoundError("Wallet Group");
    }
    return group;
  }

  /**
   * Creates a new wallet group
   */
  static async createWalletGroup(
    tenantId: string,
    data: Partial<IWalletGroup>
  ): Promise<IWalletGroup> {
    if (data.isDefault) {
      // Unset any existing default group for this tenant
      await WalletGroup.updateMany(
        { tenantId, isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    const group = new WalletGroup({
      ...data,
      tenantId,
    });
    
    await group.save();
    
    logger.info({ tenantId, groupId: group._id }, "Wallet Group created");
    return group;
  }

  /**
   * Updates an existing wallet group
   */
  static async updateWalletGroup(
    tenantId: string,
    groupId: string,
    data: Partial<IWalletGroup>
  ): Promise<IWalletGroup> {
    if (data.isDefault) {
      // Unset any existing default group for this tenant
      await WalletGroup.updateMany(
        { tenantId, _id: { $ne: groupId }, isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    const group = await WalletGroup.findOneAndUpdate(
      { _id: groupId, tenantId },
      { $set: data },
      { returnDocument: 'after' }
    );

    if (!group) {
      throw new NotFoundError("Wallet Group");
    }

    logger.info({ tenantId, groupId: group._id }, "Wallet Group updated");
    return group;
  }

  /**
   * Deletes a wallet group
   */
  static async deleteWalletGroup(
    tenantId: string,
    groupId: string
  ): Promise<void> {
    const group = await WalletGroup.findOne({ _id: groupId, tenantId });
    if (!group) {
      throw new NotFoundError("Wallet Group");
    }
    
    if (group.isDefault) {
      throw new AppError("Cannot delete the default Wallet Group.", 400);
    }

    // TODO: Verify that no wallets are currently using this group before deleting
    // If we have a Wallet model handy:
    // const walletsCount = await Wallet.countDocuments({ walletGroupId: groupId });
    // if (walletsCount > 0) throw new ValidationError("Cannot delete a Wallet Group that is currently assigned to wallets.");

    await WalletGroup.deleteOne({ _id: groupId, tenantId });
    logger.info({ tenantId, groupId }, "Wallet Group deleted");
  }

  /**
   * Ensures a default wallet group exists for a tenant, and returns it.
   */
  static async ensureDefaultWalletGroup(tenantId: string | Types.ObjectId): Promise<IWalletGroup> {
    let group = await WalletGroup.findOne({ tenantId, isDefault: true });
    
    if (!group) {
      group = await WalletGroup.create({
        tenantId,
        name: "Default Group",
        description: "Automatically created default group.",
        isDefault: true,
      });
      logger.info({ tenantId, groupId: group._id }, "Default Wallet Group created");
    }
    
    return group;
  }
}
