import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { nombaService } from './src/services/nomba.service.js';
dotenv.config();

async function test() {
  await mongoose.connect(process.env.MONGO_URL!);
  try {
    const authHeaders = await (nombaService as any).getAuthHeaders();
    console.log('Hitting Nomba refund with subaccount...');
    const response = await nombaService.client.post(
      '/v1/checkout/refund',
      {
        transactionId: 'e58a339f-2621-400f-b8c4-254568825185',
        accountNumber: '0441946383',
        bankCode: '035',
      },
      { headers: { ...authHeaders, accountId: '5102a72b-3dac-42d0-a549-3094ad0c36ea' } }
    );
    console.log(JSON.stringify(response.data, null, 2));
  } catch (err: any) {
    if (err.response) {
      console.error(JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err);
    }
  }
  process.exit(0);
}
test();
