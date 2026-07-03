const axios = require('axios');

async function checkBalance() {
  const CLIENT_ID = 'e5e85b13-f560-4643-814e-c87435dbbc15';
  const CLIENT_SECRET = '8/doS7Q3w77EANpk3vpgSrc05hhOiRWp3eBs01sXyZ1AmovtZUXlmrxie+xnEF2tR4q79t0IFufMD1d4JrkT8g==';
  const ACCOUNT_ID = 'f666ef9b-888e-4799-85ce-acb505b28023';
  const SUB_ACCOUNT_ID = '5102a72b-3dac-42d0-a549-3094ad0c36ea';

  try {
    console.log('Obtaining access token...');
    const authRes = await axios.post(
      'https://api.nomba.com/v1/auth/token/issue',
      {
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      },
      {
        headers: {
          accountId: ACCOUNT_ID,
          'Content-Type': 'application/json'
        }
      }
    );

    const accessToken = authRes.data.data.access_token;
    console.log('Token obtained.');

    console.log('Fetching sub-account balance...');
    const balanceRes = await axios.get(
      `https://api.nomba.com/v1/accounts/${SUB_ACCOUNT_ID}/balance`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          accountId: ACCOUNT_ID
        }
      }
    );

    console.log('=== BALANCE RESULT ===');
    console.log(JSON.stringify(balanceRes.data, null, 2));

  } catch (err) {
    console.error('Error fetching balance:');
    if (err.response) {
      console.error(JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err.message);
    }
  }
}

checkBalance();
