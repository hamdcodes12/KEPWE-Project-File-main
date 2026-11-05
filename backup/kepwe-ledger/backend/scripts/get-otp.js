import { pool } from '../src/config/db.js';

async function getLatestOTP() {
  try {
    const result = await pool.query(
      `SELECT id, email, purpose, attempts, expires_at, created_at, consumed_at
       FROM email_otp_challenges 
       WHERE email = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      ['test@kepwe.in']
    );

    if (result.rows.length === 0) {
      console.log('\n❌ No OTP found for test@kepwe.in');
      console.log('💡 Click "Verify and sign in" button first to request OTP\n');
      return;
    }

    const otp = result.rows[0];
    const now = new Date();
    const expired = new Date(otp.expires_at) < now;
    const consumed = otp.consumed_at !== null;

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 LATEST OTP REQUEST FOR test@kepwe.in');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\n   ⚠️  OTP is stored as HASH only (security)`);
    console.log(`   📧 Check your email for the actual code`);
    console.log(`\n   Purpose:  ${otp.purpose}`);
    console.log(`   Attempts: ${otp.attempts}`);
    console.log(`   Created:  ${otp.created_at.toLocaleString()}`);
    console.log(`   Expires:  ${otp.expires_at.toLocaleString()}`);
    console.log(`   Status:   ${consumed ? '❌ USED' : expired ? '❌ EXPIRED' : '✅ VALID'}`);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (consumed) {
      console.log('⚠️  This OTP was already used. Request a new one!\n');
    } else if (expired) {
      console.log('⚠️  This OTP has expired. Request a new one!\n');
    } else {
      console.log('💡 The OTP was sent to test@kepwe.in');
      console.log('   Check your email inbox or use PASSWORD LOGIN instead:\n');
      console.log('   Email:    test@kepwe.in');
      console.log('   Password: Kepwe@2024\n');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

getLatestOTP();
