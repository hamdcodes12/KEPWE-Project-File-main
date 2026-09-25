import { pool } from './src/config/db.js';

const userId = '0b7d3ed8-4a27-40a7-924f-6033414f89f2';

async function createRiskProfile() {
  try {
    await pool.query(
      `INSERT INTO risk_profiles (user_id, capital_amount, max_acceptable_loss, onboarding_complete) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (user_id) 
       DO UPDATE SET capital_amount = $2, max_acceptable_loss = $3, onboarding_complete = $4`,
      [userId, 100000, 10000, true]
    );
    console.log('Risk profile created for user:', userId);
  } catch (error) {
    console.error('Error creating risk profile:', error.message);
  } finally {
    await pool.end();
  }
}

createRiskProfile();