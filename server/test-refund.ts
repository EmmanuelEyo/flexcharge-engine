import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { nombaService } from './src/services/nomba.service.js';
dotenv.config();

async function test() {
  await mongoose.connect(process.env.MONGO_URL!);
  try {
    // We can't access private method getAuthHeaders easily, but we can do it via a cast
    const authHeaders = await (nombaService as any).getAuthHeaders();
    console.log('Hitting Nomba refund...');
    const response = await nombaService.client.post(
      '/v1/checkout/refund',
      {
        transactionId: 'WEB-ONLINE_C-5102A-fe6892ae-95b7-4665-b9f5-709ddeffaee2',
        amount: 50.00,
        accountNumber: '0441946383',
        bankCode: '035',
      },
      { headers: authHeaders }
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
